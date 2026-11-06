import type { Categoria, CampoDef, Condicion, OpcionCampo, Respuesta, TipoCampo } from "./types";

/**
 * Motor de formularios dinámicos (Spec Frontend §6, PRD RF-3.x).
 *
 * Lógica pura: no conoce React, ni red, ni estado global. Recibe la
 * definición (snapshot) del formulario y las respuestas actuales, y devuelve
 * la evaluación de cada campo (aplica / visible / agotada / valor).
 *
 * El servidor sigue siendo la autoridad (Spec §6.3): aquí sólo se resuelve la
 * experiencia de cliente.
 */

/** Tipos que esta versión del frontend sabe mostrar (Spec §6.2). */
export const TIPOS_SOPORTADOS: TipoCampo[] = [
  "text",
  "textarea",
  "select",
  "multiselect",
  "checkbox",
  "number",
  "date",
  "extra",
];

const LONGITUD_TEXTO = 500;
const LONGITUD_TEXTAREA = 1000;

const TIPOS_SOPORTADOS_SET: ReadonlySet<string> = new Set<string>(TIPOS_SOPORTADOS);

/** Mensaje único para campos con tipo desconocido (Spec §6.4). */
export const MENSAJE_CAMPO_NO_SOPORTADO = "Hay una pregunta que no se puede mostrar. Contáctanos";

/** Aviso cuando la opción ya elegida se agotó (Spec §6.3, punto 6). */
export const MENSAJE_OPCION_AGOTADA = "Esta opción se agotó. Elige otra";

export interface ContextoMotor {
  campos: CampoDef[];
  /** respuestas globales de la reserva */
  globales: Record<string, Respuesta>;
  /** respuestas por pasajero, indexadas por ref_cliente */
  porPasajero: Record<string, Record<string, Respuesta>>;
  /** categoría de cada pasajero */
  categorias: Record<string, Categoria>;
  /** opciones agotadas reportadas por el servidor: "campoId:valor" -> true */
  agotadas?: Record<string, boolean>;
  /**
   * Claves de los campos cuyo valor por defecto ya se aplicó.
   * Evita recargar el default cuando el cliente restaura una reserva
   * (Spec §6.3, punto 7).
   */
  defaultsAplicados?: string[];
}

export interface CampoEvaluado {
  campo: CampoDef;
  /** ¿aplica a este pasajero? (alcance + aplica_a) */
  aplica: boolean;
  /** ¿es visible ahora? (visible_si) */
  visible: boolean;
  /** ¿la opción elegida sigue disponible? */
  agotada: boolean;
  /** valor actual (global o del pasajero) */
  valor: Respuesta;
}

export interface ErrorValidacion {
  ok: boolean;
  mensaje?: string;
}

export interface ErrorFormulario {
  campo: string;
  pasajero_ref?: string;
  mensaje: string;
}

// ---------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------

/** Un valor está "vacío" si no hay nada que mostrar (Spec §6.3). */
function esVacio(valor: Respuesta | undefined): boolean {
  if (valor === null || valor === undefined) return true;
  if (valor === "") return true;
  if (Array.isArray(valor) && valor.length === 0) return true;
  if (valor === false) return true;
  return false;
}

function valoresIguales(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}

function esTipoSoportado(tipo: string): tipo is TipoCampo {
  return TIPOS_SOPORTADOS_SET.has(tipo);
}

function esMultiploDe(valor: number, paso: number): boolean {
  if (paso === 0) return true;
  const cociente = valor / paso;
  return Math.abs(cociente - Math.round(cociente)) < 1e-9;
}

function esFechaIso(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const partes = iso.split("-").map((n) => Number.parseInt(n, 10));
  const anio = partes[0];
  const mes = partes[1];
  const dia = partes[2];
  if (anio === undefined || mes === undefined || dia === undefined) return false;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  );
}

// ---------------------------------------------------------------------------
// Condiciones y visibilidad
// ---------------------------------------------------------------------------

/**
 * Evalúa una condición `visible_si` contra un mapa de respuestas.
 * Sin operadores reconocibles la condición se cumple (fail-open).
 */
export function evaluarCondicion(cond: Condicion, respuestas: Record<string, Respuesta>): boolean {
  const actual = respuestas[cond.campo];
  const resultados: boolean[] = [];

  if ("igual_a" in cond) resultados.push(valoresIguales(actual ?? null, cond.igual_a));
  if ("en" in cond) {
    const opciones = Array.isArray(cond.en) ? cond.en : [];
    resultados.push(opciones.some((opcion) => valoresIguales(actual ?? null, opcion)));
  }
  if ("distinto_de" in cond) resultados.push(!valoresIguales(actual ?? null, cond.distinto_de));
  if ("no_vacio" in cond) resultados.push(!esVacio(actual));

  if (resultados.length === 0) return true;
  return resultados.every(Boolean);
}

/**
 * Visibilidad de un campo según su `visible_si`.
 * `respuestas` debe ser el mapa del ámbito del campo (global o del pasajero).
 */
export function esVisible(campo: CampoDef, respuestas: Record<string, Respuesta>): boolean {
  const condicion = campo.visible_si;
  if (!condicion) return true;
  return evaluarCondicion(condicion, respuestas);
}

/**
 * Un campo `por_reserva` no puede depender de uno `por_pasajero`, y uno
 * `por_pasajero` no puede depender de uno `por_reserva` salvo que este último
 * tenga `permite_por_pasajero` (Spec §9.9 A-13).
 */
function dependenciaFueraDeAlcance(campo: CampoDef, dependencia: CampoDef): boolean {
  if (campo.alcance === "por_reserva" && dependencia.alcance === "por_pasajero") return true;
  if (
    campo.alcance === "por_pasajero" &&
    dependencia.alcance === "por_reserva" &&
    dependencia.permite_por_pasajero !== true
  ) {
    return true;
  }
  return false;
}

/**
 * Detecta dependencias con ámbitos incompatibles (Spec §9.9 A-13).
 * Los mensajes son aptos para mostrar en el constructor de formularios.
 */
export function validarDependencias(campos: CampoDef[]): { campo: string; mensaje: string }[] {
  const porId = new Map(campos.map((campo) => [campo.id, campo]));
  const errores: { campo: string; mensaje: string }[] = [];

  for (const campo of campos) {
    const condicion = campo.visible_si;
    if (!condicion) continue;
    const dependencia = porId.get(condicion.campo);
    if (!dependencia) continue;
    if (!dependenciaFueraDeAlcance(campo, dependencia)) continue;
    const ambito =
      dependencia.alcance === "por_pasajero" ? "por cada pasajero" : "para toda la reserva";
    errores.push({
      campo: campo.id,
      mensaje: `«${campo.label}» depende de «${dependencia.label}», que se responde ${ambito}. Una pregunta no puede depender de un ámbito que no le corresponde.`,
    });
  }

  return errores;
}

/**
 * Respuestas del ámbito en el que se evalúa la condición de un campo:
 * - `por_pasajero`: respuestas del pasajero (con las globales de respaldo,
 *   porque un campo global con `permite_por_pasajero` sí puede sizeable).
 * - `por_reserva`: respuestas globales.
 */
function respuestasDeAmbito(
  campo: CampoDef,
  ctx: ContextoMotor,
  refPasajero?: string,
): Record<string, Respuesta> {
  if (campo.alcance === "por_pasajero") {
    if (!refPasajero) return {};
    return { ...ctx.globales, ...(ctx.porPasajero[refPasajero] ?? {}) };
  }
  return ctx.globales;
}

// ---------------------------------------------------------------------------
// Aplicabilidad y valores
// ---------------------------------------------------------------------------

/**
 * ¿La categoría del pasajero está cubierta por `aplica_a`?
 * Lista vacía = aplica a todas las categorías (RF-3.6).
 */
export function campoAplicaA(campo: CampoDef, categoria: Categoria): boolean {
  const categorias = campo.aplica_a ?? [];
  return categorias.length === 0 || categorias.includes(categoria);
}

/**
 * Prioridad de valores (Spec §6.3, punto 9):
 * - campo `por_pasajero`: sólo el valor del pasajero.
 * - campo `por_reserva` con `permite_por_pasajero`: el valor del pasajero
 *   tiene prioridad sobre el global.
 * - campo `por_reserva`: el valor global.
 */
export function mergeGlobalYPasajero(
  campo: CampoDef,
  globales: Record<string, Respuesta>,
  porPasajero: Record<string, Record<string, Respuesta>>,
  refPasajero: string,
): Respuesta {
  const global = globales[campo.id];

  if (campo.alcance === "por_pasajero") {
    const propio = porPasajero[refPasajero]?.[campo.id];
    return propio === undefined ? null : propio;
  }

  if (campo.permite_por_pasajero) {
    const propio = porPasajero[refPasajero]?.[campo.id];
    if (propio !== undefined) return propio;
  }

  return global === undefined ? null : global;
}

/**
 * Mapa unificado de respuestas (global + pasajero) para evaluar `visible_si`
 * cuando no se conoce el ámbito. Los valores por pasajero tienen prioridad
 * sobre los globales.
 */
export function valoresPorCampo(ctx: ContextoMotor): Record<string, Respuesta> {
  const merged: Record<string, Respuesta> = { ...ctx.globales };
  for (const respuestas of Object.values(ctx.porPasajero)) {
    for (const [campo, valor] of Object.entries(respuestas)) {
      merged[campo] = valor;
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Evaluación de campos
// ---------------------------------------------------------------------------

function campoAplicaEnContexto(campo: CampoDef, ctx: ContextoMotor, refPasajero?: string): boolean {
  if (campo.alcance === "por_reserva") return true;
  if (!refPasajero) return false;
  const categoria = ctx.categorias[refPasajero];
  if (!categoria) return false;
  return campoAplicaA(campo, categoria);
}

function visibleEnContexto(
  campo: CampoDef,
  ctx: ContextoMotor,
  refPasajero: string | undefined,
  porId: Map<string, CampoDef>,
): boolean {
  const condicion = campo.visible_si;
  if (!condicion) return true;
  const dependencia = porId.get(condicion.campo);
  if (dependencia && dependenciaFueraDeAlcance(campo, dependencia)) {
    // Dependencia inválida: fail-open (el campo se muestra) y el error lo
    // reporta `validarDependencias`.
    return true;
  }
  return evaluarCondicion(condicion, respuestasDeAmbito(campo, ctx, refPasajero));
}

function valorEnContexto(campo: CampoDef, ctx: ContextoMotor, refPasajero?: string): Respuesta {
  if (!refPasajero) {
    const global = ctx.globales[campo.id];
    return global === undefined ? null : global;
  }
  return mergeGlobalYPasajero(campo, ctx.globales, ctx.porPasajero, refPasajero);
}

/** ¿La opción elegida se agotó? El cliente solo sabe `agotada: true/false`. */
function esValorAgotado(
  campo: CampoDef,
  valor: Respuesta,
  agotadas?: Record<string, boolean>,
): boolean {
  if (!agotadas) return false;
  if (campo.tipo === "select" && typeof valor === "string") {
    return agotadas[`${campo.id}:${valor}`] === true;
  }
  if (campo.tipo === "multiselect" && Array.isArray(valor)) {
    return valor.some((v) => typeof v === "string" && agotadas[`${campo.id}:${v}`] === true);
  }
  return false;
}

/**
 * Evalúa todos los campos del formulario.
 * Sin `refPasajero` se evalúa el ámbito "para toda la reserva".
 */
export function evaluarCampos(ctx: ContextoMotor, refPasajero?: string): CampoEvaluado[] {
  const porId = new Map(ctx.campos.map((campo) => [campo.id, campo]));

  return ctx.campos.map((campo) => {
    const valor = valorEnContexto(campo, ctx, refPasajero);
    return {
      campo,
      aplica: campoAplicaEnContexto(campo, ctx, refPasajero),
      visible: visibleEnContexto(campo, ctx, refPasajero, porId),
      agotada: esValorAgotado(campo, valor, ctx.agotadas),
      valor,
    };
  });
}

/** ¿Es visible el campo indicado para ese pasajero? */
export function campoVisibleParaCampo(
  campoId: string,
  ctx: ContextoMotor,
  refPasajero: string,
): boolean {
  const campo = ctx.campos.find((c) => c.id === campoId);
  if (!campo) return false;
  const porId = new Map(ctx.campos.map((c) => [c.id, c]));
  return visibleEnContexto(campo, ctx, refPasajero, porId);
}

/** Opciones del campo marcando cuáles están agotadas (sin mostrar cupos). */
export function opcionesDisponibles(
  campo: CampoDef,
  agotadas?: Record<string, boolean>,
): (OpcionCampo & { agotada: boolean })[] {
  const mapa = agotadas ?? {};
  return (campo.opciones ?? []).map((opcion) => ({
    ...opcion,
    agotada: opcion.agotada === true || mapa[`${campo.id}:${opcion.valor}`] === true,
  }));
}

// ---------------------------------------------------------------------------
// Limpieza de respuestas
// ---------------------------------------------------------------------------

/**
 * Devuelve el mapa de respuestas del ámbito del campo **sin** la clave del
 * campo ocultado. No muta el contexto de entrada.
 */
export function limpiarRespuestasAlOcultar(
  ctx: ContextoMotor,
  campoOcultadoId: string,
  refPasajero: string,
): Record<string, Respuesta> {
  const campo = ctx.campos.find((c) => c.id === campoOcultadoId);

  if (campo && campo.alcance === "por_reserva") {
    const copia = { ...ctx.globales };
    delete copia[campoOcultadoId];
    return copia;
  }

  const propias = ctx.porPasajero[refPasajero] ?? {};
  const copia = { ...propias };
  delete copia[campoOcultadoId];
  return copia;
}

/**
 * Igual que `limpiarRespuestasAlOcultar` pero devuelve el contexto completo
 * sin el campo ocultado (globales y respuestas por pasajero).
 */
export function limpiarCampoOcultado(
  ctx: ContextoMotor,
  campoOcultadoId: string,
  refPasajero: string,
): ContextoMotor {
  const campo = ctx.campos.find((c) => c.id === campoOcultadoId);

  if (campo && campo.alcance === "por_reserva") {
    const globales = { ...ctx.globales };
    delete globales[campoOcultadoId];
    const porPasajero: Record<string, Record<string, Respuesta>> = {};
    for (const [ref, respuestas] of Object.entries(ctx.porPasajero)) {
      if (!(campoOcultadoId in respuestas)) {
        porPasajero[ref] = respuestas;
        continue;
      }
      const copia = { ...respuestas };
      delete copia[campoOcultadoId];
      porPasajero[ref] = copia;
    }
    return { ...ctx, globales, porPasajero };
  }

  const propias = ctx.porPasajero[refPasajero];
  if (!propias || !(campoOcultadoId in propias)) return ctx;
  const copia = { ...propias };
  delete copia[campoOcultadoId];
  return { ...ctx, porPasajero: { ...ctx.porPasajero, [refPasajero]: copia } };
}

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

/** Un valor está vacío según el tipo del campo (para exigir obligatoriedad). */
function esValorVacio(valor: Respuesta, tipo: TipoCampo): boolean {
  if (valor === null) return true;
  switch (tipo) {
    case "text":
    case "textarea":
    case "select":
    case "date":
      return typeof valor === "string" && valor.trim() === "";
    case "multiselect":
      return Array.isArray(valor) && valor.length === 0;
    case "checkbox":
    case "number":
    case "extra":
      return false;
  }
}

/**
 * Valida un valor contra la definición del campo.
 * `opcionesAgotadas` usa la clave `"<campoId>:<valor>"`.
 */
export function validarCampo(
  campo: CampoDef,
  valor: Respuesta,
  opcionesAgotadas: Record<string, boolean>,
): ErrorValidacion {
  if (!esTipoSoportado(campo.tipo)) {
    return campo.obligatorio ? { ok: false, mensaje: MENSAJE_CAMPO_NO_SOPORTADO } : { ok: true };
  }

  if (esValorAgotado(campo, valor, opcionesAgotadas)) {
    return { ok: false, mensaje: MENSAJE_OPCION_AGOTADA };
  }

  if (esValorVacio(valor, campo.tipo)) {
    if (!campo.obligatorio) return { ok: true };
    return { ok: false, mensaje: "Esta pregunta es obligatoria" };
  }

  switch (campo.tipo) {
    case "text": {
      if (typeof valor !== "string") {
        return { ok: false, mensaje: "Escribe una respuesta de texto" };
      }
      const max = campo.max_length ?? LONGITUD_TEXTO;
      if (valor.length > max) {
        return { ok: false, mensaje: `Escribe máximo ${max} caracteres` };
      }
      return { ok: true };
    }
    case "textarea": {
      if (typeof valor !== "string") {
        return { ok: false, mensaje: "Escribe una respuesta de texto" };
      }
      const max = campo.max_length ?? LONGITUD_TEXTAREA;
      if (valor.length > max) {
        return { ok: false, mensaje: `Escribe máximo ${max} caracteres` };
      }
      return { ok: true };
    }
    case "select": {
      if (typeof valor !== "string") {
        return { ok: false, mensaje: "Elige una de las opciones disponibles" };
      }
      const opciones = campo.opciones ?? [];
      if (!opciones.some((opcion) => opcion.valor === valor)) {
        return { ok: false, mensaje: "Elige una de las opciones disponibles" };
      }
      return { ok: true };
    }
    case "multiselect": {
      if (!Array.isArray(valor)) {
        return { ok: false, mensaje: "Elige una o varias opciones de la lista" };
      }
      const valores = valor.filter((v): v is string => typeof v === "string");
      if (valores.length !== valor.length) {
        return { ok: false, mensaje: "Elige una o varias opciones de la lista" };
      }
      if (new Set(valores).size !== valores.length) {
        return { ok: false, mensaje: "No repitas la misma opción" };
      }
      const opciones = campo.opciones ?? [];
      if (valores.some((v) => !opciones.some((opcion) => opcion.valor === v))) {
        return { ok: false, mensaje: "Elige solo opciones de la lista" };
      }
      return { ok: true };
    }
    case "checkbox": {
      if (typeof valor !== "boolean") {
        return { ok: false, mensaje: "Indica sí o no" };
      }
      return { ok: true };
    }
    case "number": {
      if (typeof valor !== "number" || !Number.isFinite(valor)) {
        return { ok: false, mensaje: "Escribe un número válido, por ejemplo 2" };
      }
      if (campo.min !== undefined && valor < campo.min) {
        return { ok: false, mensaje: `El valor no puede ser menor que ${campo.min}` };
      }
      if (campo.max !== undefined && valor > campo.max) {
        return { ok: false, mensaje: `El valor no puede ser mayor que ${campo.max}` };
      }
      if (campo.step !== undefined && !esMultiploDe(valor, campo.step)) {
        return { ok: false, mensaje: `El valor debe ir en pasos de ${campo.step}` };
      }
      return { ok: true };
    }
    case "date": {
      if (typeof valor !== "string" || !esFechaIso(valor)) {
        return { ok: false, mensaje: "Escribe una fecha válida, por ejemplo 2026-12-14" };
      }
      return { ok: true };
    }
    case "extra": {
      if (typeof valor !== "number" || !Number.isInteger(valor)) {
        return { ok: false, mensaje: "Escribe una cantidad válida, por ejemplo 1" };
      }
      if (valor < 0) {
        return { ok: false, mensaje: "La cantidad no puede ser menos de 0" };
      }
      if (campo.cantidad_max !== undefined && valor > campo.cantidad_max) {
        return { ok: false, mensaje: `La cantidad máxima es ${campo.cantidad_max}` };
      }
      return { ok: true };
    }
  }
}

/**
 * Valida el formulario completo.
 * Sólo se exigen los campos visibles y aplicables a cada pasajero (Spec §6.3).
 */
export function validarFormulario(ctx: ContextoMotor): {
  ok: boolean;
  errores: ErrorFormulario[];
} {
  const errores: ErrorFormulario[] = [];
  const porId = new Map(ctx.campos.map((campo) => [campo.id, campo]));
  const agotadas = ctx.agotadas ?? {};

  for (const campo of ctx.campos) {
    if (!esTipoSoportado(campo.tipo)) {
      if (campo.obligatorio) {
        errores.push({ campo: campo.id, mensaje: MENSAJE_CAMPO_NO_SOPORTADO });
      }
      continue;
    }

    if (campo.alcance === "por_reserva") {
      if (!visibleEnContexto(campo, ctx, undefined, porId)) continue;

      const porPasajero = campo.permite_por_pasajero
        ? Object.keys(ctx.categorias).filter(
            (ref) => ctx.porPasajero[ref]?.[campo.id] !== undefined,
          )
        : [];

      if (porPasajero.length > 0) {
        // El valor por pasajero tiene prioridad sobre el global (Spec §6.3.9).
        for (const ref of porPasajero) {
          const valor = ctx.porPasajero[ref]?.[campo.id] ?? null;
          const resultado = validarCampo(campo, valor, agotadas);
          if (!resultado.ok && resultado.mensaje) {
            errores.push({ campo: campo.id, pasajero_ref: ref, mensaje: resultado.mensaje });
          }
        }
        continue;
      }

      const resultado = validarCampo(campo, ctx.globales[campo.id] ?? null, agotadas);
      if (!resultado.ok && resultado.mensaje) {
        errores.push({ campo: campo.id, mensaje: resultado.mensaje });
      }
      continue;
    }

    for (const [ref, categoria] of Object.entries(ctx.categorias)) {
      if (!campoAplicaA(campo, categoria)) continue;
      if (!visibleEnContexto(campo, ctx, ref, porId)) continue;
      const valor = ctx.porPasajero[ref]?.[campo.id] ?? null;
      const resultado = validarCampo(campo, valor, agotadas);
      if (!resultado.ok && resultado.mensaje) {
        errores.push({ campo: campo.id, pasajero_ref: ref, mensaje: resultado.mensaje });
      }
    }
  }

  return { ok: errores.length === 0, errores };
}

// ---------------------------------------------------------------------------
// Valores por defecto
// ---------------------------------------------------------------------------

function normalizarValorDefecto(valor: unknown): Respuesta {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean") {
    return valor;
  }
  if (Array.isArray(valor)) {
    const lista = valor as unknown[];
    if (lista.every((v) => typeof v === "string")) return [...(lista as string[])];
  }
  return null;
}

/**
 * Precarga `valor_defecto` sólo en la primera aparición del campo.
 * Si el campo ya tiene respuesta o ya se aplicó su default, no se toca.
 * No muta el contexto de entrada.
 */
export function aplicarValorDefecto(ctx: ContextoMotor): ContextoMotor {
  const aplicados = new Set<string>(ctx.defaultsAplicados ?? []);
  const globales = { ...ctx.globales };
  const porPasajero: Record<string, Record<string, Respuesta>> = {};
  for (const [ref, respuestas] of Object.entries(ctx.porPasajero)) {
    porPasajero[ref] = { ...respuestas };
  }

  for (const campo of ctx.campos) {
    if (campo.valor_defecto === undefined) continue;
    const defecto = normalizarValorDefecto(campo.valor_defecto);

    if (campo.alcance === "por_reserva") {
      const clave = campo.id;
      if (aplicados.has(clave)) continue;
      if (globales[campo.id] === undefined) {
        globales[campo.id] = defecto;
      }
      aplicados.add(clave);
      continue;
    }

    for (const [ref, categoria] of Object.entries(ctx.categorias)) {
      if (!campoAplicaA(campo, categoria)) continue;
      const clave = `${campo.id}@${ref}`;
      if (aplicados.has(clave)) continue;
      const propias = porPasajero[ref] ?? {};
      if (propias[campo.id] === undefined) {
        porPasajero[ref] = { ...propias, [campo.id]: defecto };
      }
      aplicados.add(clave);
    }
  }

  return { ...ctx, globales, porPasajero, defaultsAplicados: [...aplicados] };
}
