import {
  ApiError,
  type AccionValidacion,
  type ApiSurface,
  type DatosTitular,
  type FiltroPagos,
  type FiltrosReservas,
  type Pagina,
  type ReportePago,
  type ReservaAdmin,
  type RespuestasFormulario,
  type ResultadoConfirmar,
  type ResultadoFirma,
  type ResultadoIniciar,
  type ResultadoVoucher,
  type SesionAdmin,
} from "@/lib/domain/api";
import { calcularPrecio, type EntradaCalculo } from "@/lib/domain/pricing";
import { puedeTransicionar } from "@/lib/domain/state-machine";
import {
  validarCorreo,
  validarDocumentosUnicos,
  validarNombre,
  validarTelefono,
} from "@/lib/domain/validators";
import { edadEn, toDecimalString } from "@/lib/format";
import type {
  Auditoria,
  CampoDef,
  CodigoError,
  Categoria,
  Configuracion,
  DetalleError,
  EstadoReserva,
  Exportacion,
  FechaTour,
  Formulario,
  LineaPrecio,
  MetodoPago,
  Notificacion,
  Pago,
  Pasajero,
  PoliticaCancelacion,
  Progreso,
  Reserva,
  ResumenReserva,
  Respuesta,
  Tarifa,
  TasaCambio,
  Tour,
  Usuario,
} from "@/lib/domain/types";
import { obtenerDb, resetDb } from "./db";
import type { SeedData } from "./seed";

/**
 * Backend simulado en memoria.
 *
 * Reproduce la autoridad del servidor described en el PRD v2.0 y el Spec
 * Frontend: el cliente NUNCA calcula precio, categoría, cupos ni estados; solo
 * los muestra. Aquí se resuelven las transiciones (T1-T11), el hold, los cupos,
 * el versionado optimista y la idempotencia.
 */

// ---------------------------------------------------------------------------
// Utilidades internas
// ---------------------------------------------------------------------------

const IDEMPORALIDAD = new Map<string, unknown>();

let contadorRequest = 0;

function requestId(): string {
  contadorRequest += 1;
  return `req_${contadorRequest.toString(36).padStart(4, "0")}${Math.random().toString(36).slice(2, 6)}`;
}

function err(
  status: number,
  codigo: CodigoError,
  mensaje: string,
  extra?: { detalles?: DetalleError[]; data?: Record<string, unknown> },
): ApiError {
  return new ApiError(status, {
    codigo,
    mensaje,
    request_id: requestId(),
    ...(extra?.detalles ? { detalles: extra.detalles } : {}),
    ...(extra?.data ? { data: extra.data } : {}),
  });
}

function ahoraIso(): string {
  return new Date().toISOString();
}

function horasDesde(h: number): string {
  return new Date(Date.now() + h * 3_600_000).toISOString();
}

function db(): SeedData {
  return obtenerDb().data;
}

/** Idempotencia: misma clave + mismo resultado. Si el cuerpo cambia, conflicto. */
async function conIdempotencia<T>(clave: string, fn: () => T | Promise<T>): Promise<T> {
  if (!clave) return fn();
  const previo = IDEMPORALIDAD.get(clave);
  if (previo !== undefined) return previo as T;
  const resultado = await fn();
  IDEMPORALIDAD.set(clave, resultado);
  return resultado;
}

function buscarReservaPorToken(token: string): Reserva | undefined {
  const datos = db();
  const id = datos.enlaces[token];
  if (!id) return undefined;
  return datos.reservas.find((r) => r.id === id);
}

function guardarReserva(reserva: Reserva): void {
  const datos = db();
  const i = datos.reservas.findIndex((r) => r.id === reserva.id);
  if (i >= 0) datos.reservas[i] = reserva;
  else datos.reservas.push(reserva);
}

function buscarReserva(id: string): Reserva {
  const r = db().reservas.find((x) => x.id === id);
  if (!r) throw err(404, "NO_ENCONTRADO", "No encontramos esa reserva.");
  return r;
}

function auditoria(
  usuario: Usuario,
  entidad: string,
  entidad_id: string,
  accion: string,
  valor_anterior: string,
  valor_nuevo: string,
  motivo?: string,
): void {
  const datos = db();
  const entrada: Auditoria = {
    id: `aud_${(datos.auditoria.length + 1).toString(36)}`,
    usuario_id: usuario.id,
    usuario_nombre: usuario.nombre,
    entidad,
    entidad_id,
    accion,
    valor_anterior,
    valor_nuevo,
    fecha: ahoraIso(),
    ...(motivo ? { motivo } : {}),
    cadena: "ok",
  };
  datos.auditoria.unshift(entrada);
}

function notificar(
  tipo: Notificacion["tipo"],
  titulo: string,
  detalle: string,
  entidad_id?: string,
): void {
  const datos = db();
  const n: Notificacion = {
    id: `ntf_${(datos.notificaciones.length + 1).toString(36)}`,
    tipo,
    titulo,
    detalle,
    leida: false,
    fecha: ahoraIso(),
    ...(entidad_id ? { entidad_id } : {}),
  };
  datos.notificaciones.unshift(n);
}

// ---------------------------------------------------------------------------
// Progreso
// ---------------------------------------------------------------------------

const ORDEN_PASOS = ["titular", "acompanantes", "preguntas", "resumen", "firma", "pago"] as const;

const LABEL_PASO: Record<string, string> = {
  titular: "Titular",
  acompanantes: "Acompañantes",
  preguntas: "Preguntas",
  resumen: "Resumen",
  firma: "Firma",
  pago: "Pago",
};

function computarProgreso(r: Reserva): Progreso {
  const indiceActual = ORDEN_PASOS.indexOf(r.paso_actual as (typeof ORDEN_PASOS)[number]);
  const cerrada = r.estado === "cancelada" || r.estado === "expirada" || r.estado === "completada";

  const pasos = ORDEN_PASOS.map((id, i) => {
    let estado: Progreso["pasos"][number]["estado"];
    if (r.estado === "confirmada" || r.estado === "completada") {
      estado = "completo";
    } else if (cerrada) {
      estado = i <= Math.max(indiceActual, -1) ? "completo" : "bloqueado";
    } else if (indiceActual < 0) {
      estado = "pendiente";
    } else if (i < indiceActual) {
      estado = "completo";
    } else if (i === indiceActual) {
      estado = "actual";
    } else {
      estado = "bloqueado";
    }
    return { id, label: LABEL_PASO[id] ?? id, estado };
  });

  const camposFaltantes: string[] = [];
  const titular = r.pasajeros.find((p) => p.es_titular);
  if (!titular?.nombre) camposFaltantes.push("titular.nombre");
  if (!titular?.documento) camposFaltantes.push("titular.documento");
  if (!titular?.fecha_nacimiento) camposFaltantes.push("titular.fecha_nacimiento");
  if (!titular?.telefono) camposFaltantes.push("titular.telefono");
  if (!titular?.correo) camposFaltantes.push("titular.correo");
  if (r.pasajeros.length < 1) camposFaltantes.push("pasajeros");
  if (!r.firma) camposFaltantes.push("firma");
  if (r.estado_pago !== "pagado") camposFaltantes.push("pago");

  let mensajeReanudacion: string | undefined;
  if (r.estado === "en_registro" && indiceActual > 0) {
    mensajeReanudacion = `Continuamos donde te quedaste: ${LABEL_PASO[r.paso_actual] ?? r.paso_actual} del tour`;
  }

  return {
    paso_actual: r.paso_actual,
    pasos,
    campos_faltantes: camposFaltantes,
    ultima_actividad_en: r.ultima_actividad_en,
    cerrada,
    ...(r.motivo_cierre ? { motivo_cierre: r.motivo_cierre as Progreso["motivo_cierre"] } : {}),
    ...(mensajeReanudacion ? { mensaje_reanudacion: mensajeReanudacion } : {}),
  };
}

// ---------------------------------------------------------------------------
// Cálculo de resumen (el servidor es la autoridad)
// ---------------------------------------------------------------------------

function formularioDe(r: Reserva) {
  return db().formularios.find((f) => f.id === r.formulario_id);
}

function camposExtraDe(r: Reserva) {
  const formulario = formularioDe(r);
  if (!formulario) return [];
  return formulario.definicion.campos
    .filter((c: CampoDef) => c.tipo === "extra")
    .map((c: CampoDef) => ({
      id: c.id,
      label: c.label,
      precio_usd: c.precio_usd ?? "0.00",
      cantidad_max: c.cantidad_max ?? 1,
    }));
}

function tarifaDe(fechaId: string, categoria: string) {
  return db().tarifas.find((t) => t.fecha_tour_id === fechaId && t.categoria === categoria);
}

function construirResumen(r: Reserva): ResumenReserva {
  const fecha = db().fechas.find((f) => f.id === r.fecha_tour_id);
  const formulario = formularioDe(r);
  const campos = formulario?.definicion.campos ?? [];

  const tarifas = db()
    .tarifas.filter((t) => t.fecha_tour_id === r.fecha_tour_id)
    .map((t) => ({ categoria: t.categoria, precio_usd: t.precio_usd }));

  const entrada: EntradaCalculo = {
    pasajeros: r.pasajeros.map((p) => ({ categoria: p.categoria, respuestas: p.respuestas })),
    tarifas,
    camposExtra: camposExtraDe(r),
    respuestasGlobales: r.respuestas_globales,
    ...(fecha ? { cuposOpcion: fecha.opciones_cupo } : {}),
    ...(r.promocion ? { promocion: { tipo: r.promocion.tipo, valor: r.promocion.valor } } : {}),
    saldoPrevio: totalPagado(r),
  };

  const calculo = calcularPrecio(entrada);
  const tasaVigente = db().tasa.find((t) => t.vigente)?.valor ?? null;

  const categorias = db()
    .tarifas.filter((t) => t.fecha_tour_id === r.fecha_tour_id)
    .map((t) => ({
      categoria: t.categoria,
      edad_min: t.edad_min,
      edad_max: t.edad_max,
      precio_usd: t.precio_usd,
    }));

  const cuposRestantes = fecha
    ? Math.max(0, fecha.cupos_total - fecha.cupos_vendidos - fecha.cupos_retenidos)
    : 0;

  return {
    pasajeros: r.pasajeros.map((p) => ({
      ...p,
      documento_enmascarado: `${p.tipo_doc}-****${p.documento.slice(-4)}`,
    })),
    respuestas_globales: r.respuestas_globales,
    lineas: calculo.lineas,
    subtotal_usd: calculo.subtotal_usd,
    adicionales_usd: calculo.adicionales_usd,
    descuento_usd: calculo.descuento_usd,
    total_usd: calculo.total_usd,
    total_bs_estimado: tasaVigente
      ? (Number.parseFloat(calculo.total_usd) * Number.parseFloat(tasaVigente)).toFixed(2)
      : null,
    tasa_vigente: tasaVigente,
    saldo_usd: calculo.saldo_usd,
    estado_pago: r.estado_pago,
    ...(r.requiere_accion ? { requiere_accion: r.requiere_accion } : {}),
    categorias_aplicables: categorias,
    cupos_restantes: cuposRestantes,
  };
}

function totalPagado(r: Reserva): string {
  const pagos = db().pagos.filter((p) => p.reserva_id === r.id && p.estado === "aprobado");
  const cents = pagos.reduce((acc, p) => acc + Math.round(Number.parseFloat(p.monto) * 100), 0);
  return (cents / 100).toFixed(2);
}

function opcionesAgotadas(r: Reserva): Record<string, boolean> {
  const fecha = db().fechas.find((f) => f.id === r.fecha_tour_id);
  const resultado: Record<string, boolean> = {};
  if (!fecha) return resultado;
  for (const op of fecha.opciones_cupo) {
    if (op.agotados >= op.cupo) resultado[`${op.campo_id}:${op.opcion}`] = true;
  }
  return resultado;
}

/**
 * Contexto de la salida que acompaña a la reserva pública: el tour, la fecha,
 * las tarifas y el snapshot del formulario (RF-3.7). El cliente lo muestra tal
 * cual; nunca lo calcula.
 */
function contextoDeSalida(r: Reserva): {
  tour?: Tour;
  fecha?: FechaTour;
  tarifas?: Tarifa[];
  politica_cancelacion?: PoliticaCancelacion;
  config?: Configuracion;
  formulario?: Formulario;
  opciones_agotadas?: Record<string, boolean>;
} {
  const datos = db();
  const fecha = datos.fechas.find((f) => f.id === r.fecha_tour_id);
  const tour = fecha ? datos.tours.find((t) => t.id === fecha.tour_id) : undefined;
  const formulario = datos.formularios.find((f) => f.id === r.formulario_id);
  const politica = tour
    ? datos.politicas.find((p) => p.id === tour.politica_cancelacion_id)
    : undefined;

  return {
    ...(tour ? { tour } : {}),
    ...(fecha ? { fecha } : {}),
    tarifas: datos.tarifas.filter((t) => t.fecha_tour_id === r.fecha_tour_id),
    ...(politica ? { politica_cancelacion: politica } : {}),
    config: datos.config,
    ...(formulario ? { formulario } : {}),
    opciones_agotadas: opcionesAgotadas(r),
  };
}

// ---------------------------------------------------------------------------
// Validaciones del servidor
// ---------------------------------------------------------------------------

function validarVersion(r: Reserva, version: number): void {
  if (typeof version === "number" && version !== r.version) {
    throw err(
      409,
      "VERSION_DESACTUALIZADA",
      "Se actualizó en otro dispositivo. Revisamos tus datos.",
    );
  }
}

function validarReservaAbierta(r: Reserva): void {
  if (r.estado === "cancelada" || r.estado === "expirada" || r.estado === "completada") {
    throw err(409, "RESERVA_CERRADA", "Esta reserva ya está cerrada.");
  }
}

function validarHold(r: Reserva): void {
  if (!r.expira_en) return;
  if (r.estado_pago === "reportado" || r.estado === "pago_en_verificacion") return;
  if (new Date(r.expira_en).getTime() < Date.now() && r.estado !== "confirmada") {
    // Liberar cupos retenidos al expirar
    const fecha = db().fechas.find((f) => f.id === r.fecha_tour_id);
    if (fecha && r.pasajeros.length > 0) {
      fecha.cupos_retenidos = Math.max(0, fecha.cupos_retenidos - r.pasajeros.length);
    }

    r.estado = "expirada";
    r.paso_actual = "cerrada";
    r.motivo_cierre = "expiracion";
    guardarReserva(r);
    throw err(410, "ENLACE_VENCIDO", "Tu enlace venció.");
  }
}

function tocar(r: Reserva): void {
  r.version += 1;
  r.ultima_actividad_en = ahoraIso();
  guardarReserva(r);
}

function titularDe(r: Reserva): Pasajero {
  const t = r.pasajeros.find((p) => p.es_titular);
  if (!t) throw err(422, "VALIDACION", "No encontramos al titular de la reserva.");
  return t;
}

function fechaSalidaDe(r: Reserva): string {
  return db().fechas.find((f) => f.id === r.fecha_tour_id)?.fecha_salida ?? ahoraIso().slice(0, 10);
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

const publica: ApiSurface["publica"] = {
  async reserva(token: string) {
    const datos = db();
    let id = datos.enlaces[token];

    // Si no está en la base de datos mock, buscar en localStorage (para demo desde admin)
    if (!id && token.startsWith("demo-")) {
      try {
        const clave = `mock_token_${token}`;
        const sessionData = localStorage.getItem(clave);
        if (sessionData) {
          // Para la demo, usamos un ID fijo
          id = "demo-reserva-id";
        }
      } catch {
        // Si localStorage falla, continuamos
      }
    }

    if (!id) {
      throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
    }

    // Si es un token demo, crear una reserva mock al vuelo
    let r = datos.reservas.find((x) => x.id === id);
    if (!r && token.startsWith("demo-")) {
      try {
        const clave = `mock_token_${token}`;
        const sessionData = localStorage.getItem(clave);
        if (sessionData) {
          const data = JSON.parse(sessionData);
          // Usar el token como parte del ID para que cada demo tenga su propia reserva
          const uniqueId = `demo-reserva-${token}`;
          // El formulario sale del tour de la fecha elegida, igual que en
          // `crearReserva`; sin esto las preguntas del tour nunca cargan.
          const fechaDemo = datos.fechas.find((f) => f.id === data.fecha_id);
          const tourDemo = datos.tours.find((t) => t.id === (fechaDemo?.tour_id ?? data.tour_id));
          // Crear pasajero titular inicial para la demo
          const titularDemo: Pasajero = {
            ref_cliente: crypto.randomUUID(),
            es_titular: true,
            nombre: "",
            tipo_doc: "V",
            documento: "",
            fecha_nacimiento: "",
            categoria: "Adulto",
            respuestas: {},
          };
          r = {
            id: uniqueId,
            codigo: `VJ-2026-${(datos.reservas.length + 1).toString().padStart(5, "0")}`,
            ref_corta: "DEMO123",
            tour_id: data.tour_id,
            fecha_tour_id: data.fecha_id,
            formulario_id: tourDemo?.formulario_id ?? "",
            estado: "enlace_creado",
            paso_actual: "paso_registro",
            expira_en: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            pasajeros: [titularDemo],
            respuestas_globales: {},
            total_usd: "0",
            saldo_usd: "0",
            tasa_aplicada: null,
            version: 1,
            estado_pago: "sin_pago",
            creado_en: data.creado_en || new Date().toISOString(),
            ultima_actividad_en: data.creado_en || new Date().toISOString(),
            titular: null,
            acompanantes: [],
            respuestas: {},
            created_at: data.creado_en || new Date().toISOString(),
            updated_at: data.creado_en || new Date().toISOString(),
          };
          datos.reservas.push(r);
          datos.enlaces[token] = uniqueId;
        }
      } catch {
        // Si falla, continuamos
      }
    }

    if (!r) {
      throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
    }

    // El ENLACE caduca si el cliente nunca inició el registro (RF-4.4):
    // eso es un 410 y lleva a la pantalla P-10 «Tu enlace venció».
    const enlaceVencido =
      r.estado === "enlace_creado" &&
      r.expira_en !== null &&
      new Date(r.expira_en).getTime() < Date.now();
    if (enlaceVencido) {
      throw err(410, "ENLACE_VENCIDO", "Tu enlace venció.");
    }

    // La RESERVA expirada por el hold sí devuelve 200 con `cerrada`: el
    // cliente ve la pantalla P-12 con el motivo del cierre (Spec §4.2).
    if (r.estado === "expirada" && !r.motivo_cierre) {
      r.motivo_cierre = "expiracion";
      guardarReserva(r);
    }

    if (
      r.expira_en &&
      r.estado !== "confirmada" &&
      r.estado !== "pago_en_verificacion" &&
      r.estado_pago !== "reportado" &&
      ["en_registro", "pendiente_firma", "pendiente_pago"].includes(r.estado) &&
      new Date(r.expira_en).getTime() < Date.now()
    ) {
      // Liberar cupos retenidos al expirar
      const fecha = db().fechas.find((f) => f.id === r.fecha_tour_id);
      if (fecha && r.pasajeros.length > 0) {
        fecha.cupos_retenidos = Math.max(0, fecha.cupos_retenidos - r.pasajeros.length);
      }

      r.estado = "expirada";
      r.paso_actual = "cerrada";
      r.motivo_cierre = "expiracion";
      guardarReserva(r);
    }

    return { reserva: r, progreso: computarProgreso(r), ...contextoDeSalida(r) };
  },

  async iniciar(token, body) {
    return conIdempotencia("", async () => {
      const r = buscarReservaPorToken(token);
      if (!r) throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
      if (r.estado !== "enlace_creado") {
        return { reserva_id: r.id, ya_iniciada: true };
      }
      if (!body.acepta_aviso_privacidad) {
        throw err(
          422,
          "VALIDACION",
          "Necesitamos que aceptes el aviso de privacidad para continuar.",
          {
            detalles: [
              { campo: "acepta_aviso_privacidad", mensaje: "Marca la casilla para continuar." },
            ],
          },
        );
      }

      // Crear pasajero titular inicial si no existe
      if (!r.pasajeros.find((p) => p.es_titular)) {
        const titularInicial: Pasajero = {
          ref_cliente: crypto.randomUUID(),
          es_titular: true,
          nombre: "",
          tipo_doc: "V",
          documento: "",
          fecha_nacimiento: "",
          categoria: "Adulto",
          respuestas: {},
        };
        r.pasajeros.push(titularInicial);
      }

      r.estado = "en_registro";
      r.paso_actual = "titular";
      tocar(r);
      return { reserva_id: r.id, ya_iniciada: false };
    });
  },

  async guardarTitular(token, datos: DatosTitular, version) {
    const r = buscarReservaPorToken(token);
    if (!r) throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
    validarReservaAbierta(r);
    validarHold(r);
    validarVersion(r, version);

    const detalles: DetalleError[] = [];
    const nombre = validarNombre(datos.nombre);
    if (!nombre.ok)
      detalles.push({ campo: "nombre", mensaje: nombre.mensaje ?? "Revisa el nombre." });
    const documento = datos.documento.replace(/\D/g, "");
    if (documento.length < 5) {
      detalles.push({ campo: "documento", mensaje: "Escribe un número de documento válido." });
    }
    const correo = validarCorreo(datos.correo);
    if (!correo.ok)
      detalles.push({ campo: "correo", mensaje: correo.mensaje ?? "Revisa el correo." });
    const telefono = validarTelefono(datos.telefono);
    if (!telefono.ok) {
      detalles.push({ campo: "telefono", mensaje: telefono.mensaje ?? "Revisa el teléfono." });
    }
    if (!datos.fecha_nacimiento) {
      detalles.push({ campo: "fecha_nacimiento", mensaje: "Escribe la fecha de nacimiento." });
    }

    const edad = edadEn(datos.fecha_nacimiento, fechaSalidaDe(r));
    if (edad !== null && edad < 18) {
      throw err(
        422,
        "TITULAR_MENOR_DE_EDAD",
        "El titular debe ser mayor de 18 años. Pide a un adulto responsable que haga la reserva.",
        {
          detalles: [
            {
              campo: "fecha_nacimiento",
              mensaje:
                "El titular debe ser mayor de 18 años. Pide a un adulto responsable que haga la reserva.",
            },
          ],
        },
      );
    }

    const otros = r.pasajeros
      .filter((p) => !p.es_titular)
      .map((p) => ({ tipo_doc: p.tipo_doc, documento: p.documento }));
    const duplicado = validarDocumentosUnicos([{ tipo_doc: datos.tipo_doc, documento }, ...otros]);
    if (!duplicado.ok) {
      throw err(422, "DOCUMENTO_DUPLICADO", "Este documento ya está en la reserva.", {
        detalles: [{ campo: "documento", mensaje: "Este documento ya está en la reserva." }],
      });
    }

    if (detalles.length > 0) {
      throw err(422, "VALIDACION", "Revisa los datos marcados antes de continuar.", { detalles });
    }

    // Crear titular si no existe (para compatibilidad con reservas ya iniciadas)
    let titular = r.pasajeros.find((p) => p.es_titular);
    if (!titular) {
      titular = {
        ref_cliente: crypto.randomUUID(),
        es_titular: true,
        nombre: "",
        tipo_doc: "V",
        documento: "",
        fecha_nacimiento: "",
        categoria: "Adulto",
        respuestas: {},
      };
      r.pasajeros.push(titular);
    }

    titular.nombre = datos.nombre.trim();
    titular.tipo_doc = datos.tipo_doc;
    titular.documento = documento;
    titular.fecha_nacimiento = datos.fecha_nacimiento;
    titular.categoria = categoriaDe(titular, r);
    titular.respuestas = titular.respuestas ?? {};
    (titular as Pasajero & { telefono?: string; correo?: string }).telefono = datos.telefono;
    (titular as Pasajero & { telefono?: string; correo?: string }).correo = datos.correo;
    (
      titular as Pasajero & {
        contacto_emergencia_nombre?: string;
        contacto_emergencia_telefono?: string;
      }
    ).contacto_emergencia_nombre = datos.contacto_emergencia_nombre;
    (
      titular as Pasajero & {
        contacto_emergencia_nombre?: string;
        contacto_emergencia_telefono?: string;
      }
    ).contacto_emergencia_telefono = datos.contacto_emergencia_telefono;

    tocar(r);
    return { version: r.version };
  },

  async guardarAcompanantes(token, pasajeros, version) {
    const r = buscarReservaPorToken(token);
    if (!r) throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
    validarReservaAbierta(r);
    validarVersion(r, version);

    const max = db().config.max_pasajeros_reserva ?? 10;
    if (pasajeros.length > max) {
      throw err(422, "VALIDACION", `Esta reserva admite hasta ${max} pasajeros.`, {
        detalles: [{ campo: "pasajeros", mensaje: `Máximo ${max} pasajeros por reserva.` }],
      });
    }

    const documentos = pasajeros.map((p) => ({ tipo_doc: p.tipo_doc, documento: p.documento }));
    const duplicado = validarDocumentosUnicos(documentos);
    if (!duplicado.ok) {
      throw err(422, "DOCUMENTO_DUPLICADO", "Este documento ya está en la reserva.", {
        detalles: [{ campo: "pasajeros", mensaje: "Este documento ya está en la reserva." }],
      });
    }

    const titulares = r.pasajeros.filter((p) => p.es_titular);
    const titular = titulares[0];
    if (!titular) {
      throw err(422, "VALIDACION", "No encontramos al titular de la reserva.");
    }
    const pasajerosAnteriores = r.pasajeros.length;
    // El cliente envía el reemplazo completo. El titular es el pasajero 1 y
    // lo identifica el servidor: nunca se duplica ni se elimina desde aquí.
    const entranteTitular = pasajeros.find((p) => p.es_titular);
    if (entranteTitular) {
      if (entranteTitular.ref_cliente && entranteTitular.ref_cliente !== titular.ref_cliente) {
        // El cliente generó su propio identificador: lo adoptamos y migramos
        // las respuestas que ya tuvieran esa clave.
        const refViejo = titular.ref_cliente;
        titular.ref_cliente = entranteTitular.ref_cliente;
        const respuestasTitular = r.pasajeros.find((p) => p.ref_cliente === refViejo)?.respuestas;
        if (respuestasTitular) titular.respuestas = { ...respuestasTitular, ...titular.respuestas };
        if (r.respuestas_globales[refViejo] !== undefined) {
          r.respuestas_globales[titular.ref_cliente] = r.respuestas_globales[refViejo];
          delete r.respuestas_globales[refViejo];
        }
      }
      titular.nombre = entranteTitular.nombre || titular.nombre;
      titular.tipo_doc = entranteTitular.tipo_doc;
      titular.documento = entranteTitular.documento || titular.documento;
      titular.fecha_nacimiento = entranteTitular.fecha_nacimiento || titular.fecha_nacimiento;
    }

    const companions = pasajeros
      .filter((p) => !p.es_titular && p.ref_cliente !== titular.ref_cliente)
      .map((p) => ({ ...p, es_titular: false, categoria: categoriaDe(p, r) }));

    r.pasajeros = [titular, ...companions];

    // Reajusta los cupos retenidos si cambió el tamaño del grupo, solo si ya hay hold activo
    const fecha = db().fechas.find((f) => f.id === r.fecha_tour_id);
    if (
      fecha &&
      fecha.estado === "publicada" &&
      r.expira_en &&
      ["pendiente_firma", "pendiente_pago"].includes(r.estado)
    ) {
      const diferencia = r.pasajeros.length - pasajerosAnteriores;
      if (diferencia !== 0) {
        fecha.cupos_retenidos = Math.max(0, fecha.cupos_retenidos + diferencia);
      }
    }

    tocar(r);
    return { version: r.version, pasajeros: r.pasajeros };
  },

  async guardarRespuestas(token, respuestas: RespuestasFormulario, version) {
    const r = buscarReservaPorToken(token);
    if (!r) throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
    validarReservaAbierta(r);
    validarVersion(r, version);

    r.respuestas_globales = { ...r.respuestas_globales, ...respuestas.globales };
    for (const pasajero of r.pasajeros) {
      const nuevas = respuestas.por_pasajero[pasajero.ref_cliente];
      if (nuevas) pasajero.respuestas = { ...pasajero.respuestas, ...nuevas };
    }
    tocar(r);
    return { version: r.version };
  },

  async completarPaso(token, paso, payload, version) {
    const r = buscarReservaPorToken(token);
    if (!r) throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
    validarReservaAbierta(r);
    validarHold(r);
    validarVersion(r, version);

    const detalles: DetalleError[] = [];

    if (paso === "titular") {
      const t = titularDe(r);
      if (!t.nombre) detalles.push({ campo: "nombre", mensaje: "Escribe el nombre completo." });
      if (!t.documento)
        detalles.push({ campo: "documento", mensaje: "Escribe el número de documento." });
      if (!t.fecha_nacimiento)
        detalles.push({ campo: "fecha_nacimiento", mensaje: "Escribe la fecha de nacimiento." });
    }

    if (paso === "acompanantes") {
      for (const p of r.pasajeros) {
        if (!p.nombre) {
          detalles.push({
            campo: `pasajero:${p.ref_cliente}:nombre`,
            mensaje: "Escribe el nombre del pasajero.",
          });
        }
        const esMenor = (edadEn(p.fecha_nacimiento, fechaSalidaDe(r)) ?? 99) < 18;
        const politica = db().config.documento_menores ?? "opcional";
        if (!p.fecha_nacimiento) {
          detalles.push({
            campo: `pasajero:${p.ref_cliente}:fecha_nacimiento`,
            mensaje: "Escribe la fecha de nacimiento.",
          });
        } else if (!esMenor || politica === "obligatorio") {
          if (!p.documento) {
            detalles.push({
              campo: `pasajero:${p.ref_cliente}:documento`,
              mensaje: "Escribe el número de documento.",
            });
          }
        }
      }
    }

    if (paso === "preguntas") {
      const formulario = formularioDe(r);
      if (formulario) {
        const { validarFormulario } = await import("@/lib/domain/form-engine");
        const ctx = {
          campos: formulario.definicion.campos,
          globales: r.respuestas_globales,
          porPasajero: Object.fromEntries(r.pasajeros.map((p) => [p.ref_cliente, p.respuestas])),
          categorias: Object.fromEntries(r.pasajeros.map((p) => [p.ref_cliente, p.categoria])),
          agotadas: opcionesAgotadas(r),
        };
        const validacion = validarFormulario(ctx);
        for (const e of validacion.errores) {
          detalles.push({
            campo: e.pasajero_ref ? `pasajero:${e.pasajero_ref}:${e.campo}` : e.campo,
            mensaje: e.mensaje,
          });
        }
      }
    }

    if (paso === "terminos") {
      if (!payload["scroll_completo"]) {
        detalles.push({
          campo: "scroll_completo",
          mensaje: "Desplázate hasta el final de los términos.",
        });
      }
      if (!payload["versionTerminosId"]) {
        detalles.push({
          campo: "versionTerminosId",
          mensaje: "No se identificó la versión de términos.",
        });
      }
    }

    if (detalles.length > 0) {
      throw err(422, "VALIDACION", "Revisa los datos marcados antes de continuar.", { detalles });
    }

    const siguiente: Record<string, string> = {
      titular: "acompanantes",
      acompanantes: "preguntas",
      preguntas: "resumen",
    };
    if (siguiente[paso]) {
      r.paso_actual = siguiente[paso] as Reserva["paso_actual"];
      if (r.estado === "enlace_creado") r.estado = "en_registro";
    }
    if (paso === "resumen") {
      r.paso_actual = "terminos";
      r.estado = "pendiente_firma";
      if (!r.expira_en) r.expira_en = horasDesde(db().config.hold_horas ?? 24);
    }
    if (paso === "terminos") {
      r.paso_actual = "firma";
      r.estado = "pendiente_firma";
      if (!r.expira_en) r.expira_en = horasDesde(db().config.hold_horas ?? 24);
      if (payload["versionTerminosId"]) {
        r.terminos_version_id = payload["versionTerminosId"] as string;
      }
    }
    if (paso === "firma") {
      r.paso_actual = "pago";
      r.estado = "pendiente_pago";
    }
    if (paso === "pago" && r.estado === "pendiente_pago") {
      r.paso_actual = "verificacion";
      r.estado = "pago_en_verificacion";
    }

    tocar(r);
    return { version: r.version, paso_actual: r.paso_actual, progreso: computarProgreso(r) };
  },

  async resumen(token) {
    const r = buscarReservaPorToken(token);
    if (!r) throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
    return construirResumen(r);
  },

  async aplicarPromocion(token, codigo, version) {
    const r = buscarReservaPorToken(token);
    if (!r) throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
    validarVersion(r, version);
    const promo = db().promos.find(
      (p) => p.codigo.toUpperCase() === codigo.trim().toUpperCase() && p.activo,
    );
    if (!promo) {
      throw err(409, "PROMO_INVALIDA", "Ese código no es válido o ya no está disponible.");
    }
    if (promo.usos >= promo.usos_max) {
      throw err(409, "PROMO_INVALIDA", "Ese código ya alcanzó su límite de usos.");
    }
    r.promocion = {
      codigo: promo.codigo,
      tipo: promo.tipo,
      valor: promo.valor,
      descuento_usd: "0.00",
    };
    const resumen = construirResumen(r);
    r.promocion.descuento_usd = resumen.descuento_usd;
    tocar(r);
    return { version: r.version, descuento_usd: resumen.descuento_usd };
  },

  async quitarPromocion(token, version) {
    const r = buscarReservaPorToken(token);
    if (!r) throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
    validarVersion(r, version);
    delete r.promocion;
    tocar(r);
    return { version: r.version, descuento_usd: "0.00" };
  },

  async confirmarResumen(token, body, idempotencyKey) {
    return conIdempotencia(idempotencyKey, async () => {
      const r = buscarReservaPorToken(token);
      if (!r) throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
      validarReservaAbierta(r);
      validarHold(r);
      validarVersion(r, body.version);
      if (!body.acepta_politica) {
        throw err(422, "VALIDACION", "Necesitamos que aceptes la política de cancelación.", {
          detalles: [{ campo: "acepta_politica", mensaje: "Marca la casilla para continuar." }],
        });
      }

      const resumen = construirResumen(r);
      const totalVisto = toDecimalString(body.total_visto_usd);
      if (totalVisto !== resumen.total_usd) {
        throw err(409, "PRECIO_CAMBIO", "El precio cambió. Revisa el total antes de confirmar.", {
          data: { total_usd: resumen.total_usd },
        });
      }

      const fecha = db().fechas.find((f) => f.id === r.fecha_tour_id);
      if (fecha) {
        const disponibles = fecha.cupos_total - fecha.cupos_vendidos - fecha.cupos_retenidos;
        if (disponibles < r.pasajeros.length) {
          throw err(409, "SIN_CUPO", "Ya no hay cupos suficientes para tu grupo.");
        }
        if (fecha.estado !== "publicada") {
          throw err(409, "FECHA_CERRADA", "Esta salida ya no está disponible.");
        }
      }

      r.estado = "pendiente_firma";
      r.paso_actual = "firma";
      r.expira_en = r.expira_en ?? horasDesde(db().config.hold_horas ?? 24);
      r.total_usd = resumen.total_usd;
      r.saldo_usd = resumen.saldo_usd;

      // Retener cupos al confirmar el resumen (hold)
      if (fecha && r.pasajeros.length > 0) {
        fecha.cupos_retenidos += r.pasajeros.length;
      }

      tocar(r);

      const resultado: ResultadoConfirmar = {
        total_usd: resumen.total_usd,
        expira_en: r.expira_en,
      };
      return resultado;
    });
  },

  async terminos(token) {
    const r = buscarReservaPorToken(token);
    if (!r) throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
    const terminos = db().terminos.find((t) => t.activa);
    if (!terminos) throw err(404, "NO_ENCONTRADO", "No encontramos los términos publicados.");
    return terminos;
  },

  async firmar(token, body, idempotencyKey) {
    return conIdempotencia(idempotencyKey, async () => {
      const r = buscarReservaPorToken(token);
      if (!r) throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
      validarReservaAbierta(r);
      validarHold(r);
      if (!body.scroll_completo) {
        throw err(
          422,
          "VALIDACION",
          "Desplázate hasta el final de los términos para poder firmar.",
        );
      }
      if (body.n_trazos < 1 || body.longitud_px < 150 || body.duracion_ms < 300) {
        throw err(
          422,
          "FIRMA_INVALIDA",
          "La firma es muy pequeña o muy corta. Firma ocupando más espacio.",
        );
      }
      const terminos = db().terminos.find((t) => t.activa);
      r.firma = {
        id: `firma_${r.id}`,
        hash_imagen: hashSimple(body.firma_png_base64),
        hash_documento: terminos?.hash ?? "",
        version_terminos_id: body.version_terminos_id || (terminos?.id ?? ""),
        firmada_en: ahoraIso(),
        ip: "192.0.2.10",
        user_agent: "demo/navegador",
        n_trazos: body.n_trazos,
        longitud_px: body.longitud_px,
        duracion_ms: body.duracion_ms,
        integridad: "ok",
        preview: body.firma_png_base64.slice(0, 200),
      };
      r.estado = "pendiente_pago";
      r.paso_actual = "pago";
      r.terminos_version_id = body.version_terminos_id;
      tocar(r);
      console.log("Firma guardada, reserva actualizada a:", r.estado, r.paso_actual);
      notificar("reserva", "Registro completado", `${r.codigo} firmó los términos.`, r.id);
      const resultado: ResultadoFirma = {
        ok: true,
        hash_imagen: r.firma.hash_imagen,
        firmada_en: r.firma.firmada_en,
      };
      return resultado;
    });
  },

  async metodosPago(token) {
    const r = buscarReservaPorToken(token);
    if (!r) throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
    const metodos = db()
      .metodos_pago.filter((m) => m.activo && m.id !== "efectivo")
      .sort((a, b) => a.orden - b.orden);
    const tasa = db().tasa.find((t) => t.vigente) ?? null;
    return { metodos, tasa_vigente: tasa };
  },

  async reportarPago(token, body: ReportePago, idempotencyKey) {
    return conIdempotencia(idempotencyKey, async () => {
      const r = buscarReservaPorToken(token);
      if (!r) throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
      validarReservaAbierta(r);

      const monto = toDecimalString(body.monto);
      const total = Number.parseFloat(r.total_usd || "0");
      const montoNum = Number.parseFloat(monto);
      // El control de sobrepago solo aplica cuando el total ya se conoce y
      // los montos están en la misma moneda (Spec P-08).
      const tasa = db().tasa.find((t) => t.vigente)?.valor ?? null;
      const montoEnUsd =
        body.moneda === "VES" && tasa ? montoNum / Number.parseFloat(tasa) : montoNum;
      if (total > 0 && body.moneda === "USD" && montoEnUsd > total * 2) {
        throw err(422, "VALIDACION", "Revisa el monto; parece demasiado alto.", {
          detalles: [{ campo: "monto", mensaje: "El monto reportado supera el doble del total." }],
        });
      }

      const pago: Pago = {
        id: `pgo_${(db().pagos.length + 1).toString(36)}`,
        reserva_id: r.id,
        metodo: body.metodo as Pago["metodo"],
        monto,
        moneda: body.moneda,
        tasa: tasa ?? null,
        fecha_pago: body.fecha_pago,
        referencia: body.referencia,
        estado: "reportado",
        alertas: [],
        creado_en: ahoraIso(),
        ...(body.comprobante_nombre
          ? {
              comprobante: {
                nombre: body.comprobante_nombre,
                tipo: body.comprobante_tipo ?? "image/png",
                tamano: body.comprobante_tamano ?? 0,
                ...(body.comprobante_preview ? { preview: body.comprobante_preview } : {}),
              },
            }
          : {}),
      };

      // Anti-duplicado: método + referencia (D-05). El cliente no ve nada, el validador sí.
      const duplicado = db().pagos.find(
        (p) =>
          p.metodo === pago.metodo && p.referencia === pago.referencia && p.estado !== "anulado",
      );
      if (duplicado) {
        pago.duplicado_de_pago_id = duplicado.id;
        pago.alertas = [
          { codigo: "duplicado_referencia", mensaje: "Esta referencia ya se usó en otra reserva." },
        ];
      }

      db().pagos.unshift(pago);
      r.estado = "pago_en_verificacion";
      r.paso_actual = "verificacion";
      r.estado_pago = "reportado";
      if (!r.tasa_aplicada) r.tasa_aplicada = tasa ?? null;
      tocar(r);

      notificar("pago", "Pago reportado", `${r.codigo} reportó un pago por ${monto}.`, r.id);
      return { pago_id: pago.id };
    });
  },

  async pagos(token) {
    const r = buscarReservaPorToken(token);
    if (!r) throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
    return db().pagos.filter((p) => p.reserva_id === r.id);
  },

  async solicitarCorreccion(token, pagoId, body) {
    const r = buscarReservaPorToken(token);
    if (!r) throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
    const pago = db().pagos.find((p) => p.id === pagoId && p.reserva_id === r.id);
    if (!pago) throw err(404, "NO_ENCONTRADO", "No encontramos ese pago.");
    if (body.referencia) pago.referencia = body.referencia;
    if (body.monto) pago.monto = toDecimalString(body.monto);
    if (body.comprobante) {
      pago.comprobante = {
        nombre: body.comprobante.nombre,
        tipo: body.comprobante.tipo,
        tamano: body.comprobante.tamano,
        ...(body.comprobante.preview ? { preview: body.comprobante.preview } : {}),
      };
    }
    pago.estado = "reportado";
    r.estado = "pago_en_verificacion";
    r.paso_actual = "verificacion";
    r.estado_pago = "reportado";
    tocar(r);
    return { ok: true };
  },

  async voucher(token) {
    const r = buscarReservaPorToken(token);
    if (!r) throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
    if (r.estado === "cancelada" || r.estado === "expirada") {
      throw err(409, "RESERVA_CERRADA", "Esta reserva está cerrada.");
    }
    if (!r.voucher) {
      r.voucher = {
        id: `vou_${r.id}`,
        version: 1,
        estado: "generando",
        vigente: true,
        generado_en: ahoraIso(),
        verif_token: db().verificaciones
          ? (Object.keys(db().verificaciones).find((k) => db().verificaciones[k] === r.id) ??
            `qr_${r.id}`)
          : `qr_${r.id}`,
      };
      guardarReserva(r);
      return { estado: "generando" } satisfies ResultadoVoucher;
    }
    if (r.voucher.estado === "generando") {
      r.voucher.estado = "listo";
      r.voucher.url_descarga = `/descarga/voucher?t=${r.voucher.verif_token}`;
      guardarReserva(r);
    }
    return {
      estado: r.voucher.estado,
      ...(r.voucher.url_descarga ? { url_descarga: r.voucher.url_descarga } : {}),
      version: r.voucher.version,
    } satisfies ResultadoVoucher;
  },

  async reabrirEdicion(token, motivo) {
    const r = buscarReservaPorToken(token);
    if (!r) throw err(404, "ENLACE_INVALIDO", "Este enlace no es válido.");
    validarReservaAbierta(r);
    if (!["pendiente_firma", "pendiente_pago", "pago_en_verificacion"].includes(r.estado)) {
      throw err(409, "TRANSICION_INVALIDA", "Ahora mismo no puedes editar esta reserva.");
    }
    r.estado = "en_registro";
    r.paso_actual = "titular";
    delete r.firma;
    r.expira_en = horasDesde(db().config.hold_horas ?? 24);
    tocar(r);
    return { version: r.version };
  },
};

function categoriaDe(pasajero: Pasajero, r: Reserva): Categoria {
  const fechaSalida = fechaSalidaDe(r);
  const edad = edadEn(pasajero.fecha_nacimiento, fechaSalida);
  if (edad === null) return "Adulto";
  const tarifas = db().tarifas.filter((t) => t.fecha_tour_id === r.fecha_tour_id);
  const encontrada = tarifas.find((t) => edad >= t.edad_min && edad <= t.edad_max);
  return encontrada?.categoria ?? "Adulto";
}

function hashSimple(texto: string): string {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = (h * 33) ^ texto.charCodeAt(i);
  return Math.abs(h).toString(16).padStart(8, "0").repeat(8).slice(0, 64);
}

/** Referencia corta legible para el cliente (8 caracteres, ej. "K7M2QX9A"). */
const CARACTERES_REF = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function refCorta(): string {
  let salida = "";
  for (let i = 0; i < 8; i++) {
    salida += CARACTERES_REF[Math.floor(Math.random() * CARACTERES_REF.length)];
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Sesión admin
// ---------------------------------------------------------------------------

const sesiones = new Map<string, Usuario>();
/** Notas internas de clientes (la ficha se arma a partir de las reservas). */
const notasCliente = new Map<string, string>();
/** Exportaciones XLSX simuladas (en producción las genera el worker del backend). */
const exportacionesMock = new Map<string, Exportacion>();

function usuarioActual(token?: string): Usuario {
  if (!token) throw err(401, "NO_AUTENTICADO", "Tu sesión expiró. Vuelve a entrar.");
  const u = sesiones.get(token);
  if (!u) throw err(401, "NO_AUTENTICADO", "Tu sesión expiró. Vuelve a entrar.");
  return u;
}

// ---------------------------------------------------------------------------
// API admin
// ---------------------------------------------------------------------------

const admin: ApiSurface["admin"] = {
  async login(body) {
    const datos = db();
    const credencial = CREDENCIALES.find(
      (c) => c.correo.toLowerCase() === body.correo.trim().toLowerCase(),
    );
    if (!credencial || credencial.password !== body.password) {
      throw err(401, "NO_AUTENTICADO", "Correo o contraseña incorrectos.");
    }
    const usuario = datos.usuarios.find((u) => u.correo === credencial.correo);
    if (!usuario || !usuario.activo) {
      throw err(401, "NO_AUTENTICADO", "Correo o contraseña incorrectos.");
    }
    const token = `tok_${Math.random().toString(36).slice(2)}`;
    sesiones.set(token, usuario);
  },

  async recuperar() {
    return { ok: true };
  },

  async restablecer() {
    return { ok: true };
  },

  async yo() {
    return { usuario: db().usuarios[0] as Usuario };
  },

  async notificaciones() {
    return db().notificaciones;
  },

  async dashboard() {
    const datos = db();
    const porEstado = new Map<EstadoReserva, number>();
    for (const r of datos.reservas) porEstado.set(r.estado, (porEstado.get(r.estado) ?? 0) + 1);

    const ocupacion = datos.fechas
      .filter((f) => f.estado === "publicada")
      .sort((a, b) => a.fecha_salida.localeCompare(b.fecha_salida))
      .slice(0, 6)
      .map((f) => ({
        fecha_tour_id: f.id,
        tour: datos.tours.find((t) => t.id === f.tour_id)?.nombre ?? "Tour",
        fecha: f.fecha_salida,
        hora: f.hora_salida,
        vendidos: f.cupos_vendidos,
        retenidos: f.cupos_retenidos,
        total: f.cupos_total,
      }));

    const pendientes = datos.pagos.filter((p) => p.estado === "reportado");
    const masAntiguo = pendientes.length
      ? Math.max(
          ...pendientes.map((p) =>
            Math.max(0, Math.round((Date.now() - new Date(p.creado_en).getTime()) / 60000)),
          ),
        )
      : 0;

    const ingresos = datos.pagos
      .filter((p) => p.estado === "aprobado")
      .reduce((acc, p) => acc + Math.round(Number.parseFloat(p.monto) * 100), 0);

    const requiereAtencion: {
      id: string;
      tipo: string;
      titulo: string;
      detalle: string;
      entidad_id: string;
      severidad: "alta" | "media" | "baja";
    }[] = [];

    for (const p of datos.pagos.filter((x) => x.estado === "reportado")) {
      if (p.duplicado_de_pago_id) {
        requiereAtencion.push({
          id: `dup_${p.id}`,
          tipo: "pago_duplicado",
          titulo: "Pago con referencia duplicada",
          detalle: `${p.referencia} ya se usó en otra reserva`,
          entidad_id: p.id,
          severidad: "alta",
        });
      }
    }
    for (const r of datos.reservas) {
      if (r.expira_en && ["en_registro", "pendiente_firma", "pendiente_pago"].includes(r.estado)) {
        const ms = new Date(r.expira_en).getTime() - Date.now();
        if (ms > 0 && ms < 2 * 3_600_000) {
          requiereAtencion.push({
            id: `exp_${r.id}`,
            tipo: "reserva_por_expirar",
            titulo: "Reserva por expirar",
            detalle: `${r.codigo} vence en menos de 2 horas`,
            entidad_id: r.id,
            severidad: "alta",
          });
        }
      }
      if (r.requiere_accion) {
        requiereAtencion.push({
          id: `acc_${r.id}`,
          tipo: "requiere_accion",
          titulo: "Reserva requiere acción",
          detalle: `${r.codigo}: ${r.requiere_accion}`,
          entidad_id: r.id,
          severidad: "media",
        });
      }
    }
    for (const f of datos.fechas.filter((x) => x.estado === "publicada")) {
      const libres = f.cupos_total - f.cupos_vendidos - f.cupos_retenidos;
      if (libres > 0 && libres <= 3) {
        requiereAtencion.push({
          id: `llena_${f.id}`,
          tipo: "fecha_casi_llena",
          titulo: "Fecha casi llena",
          detalle: `${datos.tours.find((t) => t.id === f.tour_id)?.nombre ?? "Tour"} · ${f.fecha_salida} · quedan ${libres}`,
          entidad_id: f.id,
          severidad: "baja",
        });
      }
    }

    return {
      reservas_por_estado: [...porEstado.entries()].map(([estado, total]) => ({ estado, total })),
      ocupacion_proximas: ocupacion,
      pagos_por_verificar: [{ total: pendientes.length, mas_antiguo_min: masAntiguo }],
      ingresos_mes_usd: (ingresos / 100).toFixed(2),
      requiere_atencion: requiereAtencion,
    };
  },

  async reservas(filtros: FiltrosReservas) {
    const datos = db();
    let items = [...datos.reservas];

    if (filtros.tour_id) {
      const fechas = new Set(
        datos.fechas.filter((f) => f.tour_id === filtros.tour_id).map((f) => f.id),
      );
      items = items.filter((r) => fechas.has(r.fecha_tour_id));
    }
    if (filtros.fecha_tour_id)
      items = items.filter((r) => r.fecha_tour_id === filtros.fecha_tour_id);
    if (filtros.estado) items = items.filter((r) => r.estado === filtros.estado);
    if (filtros.estado_pago) items = items.filter((r) => r.estado_pago === filtros.estado_pago);
    if (filtros.requiere_accion) items = items.filter((r) => Boolean(r.requiere_accion));
    if (filtros.por_expirar) {
      items = items.filter(
        (r) =>
          r.expira_en !== null &&
          new Date(r.expira_en).getTime() - Date.now() < 2 * 3_600_000 &&
          new Date(r.expira_en).getTime() > Date.now(),
      );
    }
    if (filtros.con_pago_por_validar)
      items = items.filter((r) => r.estado === "pago_en_verificacion");
    if (filtros.busqueda) {
      const q = filtros.busqueda.toLowerCase().trim();
      items = items.filter((r) => {
        const titular = r.pasajeros.find((p) => p.es_titular);
        return (
          r.codigo.toLowerCase().includes(q) ||
          r.ref_corta.toLowerCase().includes(q) ||
          (r.referencia_interna ?? "").toLowerCase().includes(q) ||
          (titular?.nombre ?? "").toLowerCase().includes(q) ||
          (titular?.documento ?? "").includes(q)
        );
      });
    }

    items.sort(
      (a, b) =>
        new Date(b.ultima_actividad_en).getTime() - new Date(a.ultima_actividad_en).getTime(),
    );

    const limite = filtros.limite ?? 20;
    const cursor = filtros.cursor ? Number.parseInt(filtros.cursor, 10) : 0;
    const pagina = items.slice(cursor, cursor + limite);
    const siguiente = cursor + limite < items.length ? String(cursor + limite) : null;

    return { items: pagina, next_cursor: siguiente, total: items.length } satisfies Pagina<Reserva>;
  },

  async tablero(fecha_tour_id) {
    const datos = db();
    const estados: EstadoReserva[] = [
      "enlace_creado",
      "en_registro",
      "pendiente_firma",
      "pendiente_pago",
      "pago_en_verificacion",
      "confirmada",
      "cancelada",
      "expirada",
    ];
    const reservas = datos.reservas.filter((r) => r.fecha_tour_id === fecha_tour_id);
    return {
      columnas: estados.map((estado) => {
        const lista = reservas.filter((r) => r.estado === estado);
        return { estado, total: lista.length, reservas: lista };
      }),
    };
  },

  async reserva(id) {
    const datos = db();
    const r = buscarReserva(id);
    const fecha = datos.fechas.find((f) => f.id === r.fecha_tour_id);
    const tour = datos.tours.find((t) => t.id === fecha?.tour_id);
    const pagos = datos.pagos.filter((p) => p.reserva_id === r.id);
    const terminos = datos.terminos.find((t) => t.id === r.terminos_version_id) ?? null;
    const auditoriaDe = datos.auditoria.filter((a) => a.entidad_id === r.id);
    return {
      ...r,
      tour: (tour ?? {}) as Tour,
      fecha: (fecha ?? {}) as FechaTour,
      pagos,
      terminos,
      auditoria: auditoriaDe,
    } satisfies ReservaAdmin;
  },

  async crearReserva(body) {
    const datos = db();
    const fecha = datos.fechas.find((f) => f.id === body.fecha_tour_id);
    if (!fecha) throw err(404, "NO_ENCONTRADO", "No encontramos esa salida.");
    if (fecha.estado !== "publicada") {
      throw err(409, "FECHA_CERRADA", "Esa salida no está disponible para nuevas reservas.");
    }
    const libres = fecha.cupos_total - fecha.cupos_vendidos - fecha.cupos_retenidos;
    if (libres <= 0) {
      throw err(409, "SIN_CUPO", "Esa salida no tiene cupos disponibles.");
    }

    const advertencias: { codigo: string; mensaje: string }[] = [];
    const referencia = body.referencia_interna?.trim() ?? "";
    if (referencia) {
      const duplicada = datos.reservas.find(
        (r) =>
          r.fecha_tour_id === body.fecha_tour_id &&
          (r.referencia_interna ?? "").toLowerCase() === referencia.toLowerCase() &&
          !["cancelada", "expirada", "completada"].includes(r.estado),
      );
      if (duplicada) {
        advertencias.push({
          codigo: "posible_duplicado",
          mensaje: `Ya existe la reserva ${duplicada.codigo} con la misma referencia en esta fecha.`,
        });
      }
    }
    const tasa = datos.tasa.find((t) => t.vigente);
    if (tasa && Date.now() - new Date(tasa.registrada_en).getTime() > 24 * 3_600_000) {
      advertencias.push({
        codigo: "tasa_desactualizada",
        mensaje: "La tasa de cambio lleva más de un día sin actualizarse.",
      });
    }

    const id = `res_${(datos.reservas.length + 1).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const token = `lnk_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    const tour = datos.tours.find((t) => t.id === fecha.tour_id);
    const titular: Pasajero = {
      ref_cliente: `ref_${Math.random().toString(36).slice(2)}`,
      es_titular: true,
      nombre: referencia,
      tipo_doc: "V",
      documento: "",
      fecha_nacimiento: "",
      categoria: "Adulto",
      respuestas: {},
    };

    const reserva: Reserva = {
      id,
      codigo: `VJ-2026-${(datos.reservas.length + 1).toString().padStart(5, "0")}`,
      ref_corta: refCorta(),
      tour_id: fecha.tour_id,
      fecha_tour_id: fecha.id,
      formulario_id: tour?.formulario_id ?? "",
      estado: "enlace_creado",
      estado_pago: "sin_pago",
      pasajeros: [titular],
      respuestas_globales: {},
      total_usd: "0.00",
      saldo_usd: "0.00",
      tasa_aplicada: null,
      expira_en: horasDesde(datos.config.enlace_vigencia_horas ?? 72),
      version: 1,
      paso_actual: "paso_registro",
      ...(referencia ? { referencia_interna: referencia } : {}),
      creado_en: ahoraIso(),
      ultima_actividad_en: ahoraIso(),
      link_token: token,
    };

    datos.reservas.unshift(reserva);
    datos.enlaces[token] = id;

    const operador = datos.usuarios.find((u) => u.rol === "OP") ?? datos.usuarios[0];
    if (operador) {
      auditoria(operador, "reserva", id, "enlace.creado", "—", reserva.codigo);
    }

    return {
      reserva,
      enlace: `${window.location.origin}/r/${token}`,
      advertencias,
    };
  },

  async regenerarEnlace(id, body) {
    const datos = db();
    const r = buscarReserva(id);
    for (const [token, resId] of Object.entries(datos.enlaces)) {
      if (resId === id) delete datos.enlaces[token];
    }
    const token = `lnk_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    datos.enlaces[token] = id;
    r.link_token = token;
    const usuario = db().usuarios[0] as Usuario;
    auditoria(usuario, "reserva", id, "enlace.regenerado", "—", token, body.motivo);
    return { enlace: `${window.location.origin}/r/${token}` };
  },

  async revocarEnlace(id, body) {
    const datos = db();
    for (const [token, resId] of Object.entries(datos.enlaces)) {
      if (resId === id) delete datos.enlaces[token];
    }
    const usuario = datos.usuarios[0] as Usuario;
    auditoria(usuario, "reserva", id, "enlace.revocado", "activo", "revocado", body.motivo);
    return { ok: true };
  },

  async extenderHold(id, body) {
    const r = buscarReserva(id);
    const horas = Math.min(body.horas, 72);
    r.expira_en = new Date(Date.now() + horas * 3_600_000).toISOString();
    const usuario = db().usuarios[0] as Usuario;
    auditoria(usuario, "reserva", id, "hold.extendido", "—", `${horas} h`, body.motivo);
    return { expira_en: r.expira_en };
  },

  async editarReserva(id, body) {
    const r = buscarReserva(id);
    const usuario = db().usuarios[0] as Usuario;
    const cambios = body.cambios as {
      pasajeros?: Pasajero[];
      respuestas_globales?: Record<string, Respuesta>;
    };
    if (cambios.pasajeros) r.pasajeros = cambios.pasajeros;
    if (cambios.respuestas_globales) r.respuestas_globales = cambios.respuestas_globales;
    auditoria(usuario, "reserva", id, "reserva.editada", "—", "datos actualizados", body.motivo);
    return { ok: true };
  },

  async revelar(id, body) {
    const r = buscarReserva(id);
    const pasajero = body.pasajero_ref
      ? r.pasajeros.find((p) => p.ref_cliente === body.pasajero_ref)
      : r.pasajeros.find((p) => p.es_titular);
    if (!pasajero) throw err(404, "NO_ENCONTRADO", "No encontramos esos datos.");
    const usuario = db().usuarios[0] as Usuario;
    const valor =
      body.campo === "fecha_nacimiento" ? pasajero.fecha_nacimiento : pasajero.documento;
    auditoria(usuario, "reserva", id, "datos.revelados", "enmascarado", "revelado", body.motivo);
    return { valor };
  },

  async simularCancelacion(id) {
    const r = buscarReserva(id);
    const fecha = db().fechas.find((f) => f.id === r.fecha_tour_id);
    if (!fecha) throw err(404, "NO_ENCONTRADO", "No encontramos la salida.");
    const dias = Math.max(
      0,
      Math.ceil((new Date(`${fecha.fecha_salida}T12:00:00Z`).getTime() - Date.now()) / 86_400_000),
    );
    const politica =
      db().politicas.find(
        (p) =>
          p.id === (db().tours.find((t) => t.id === fecha.tour_id)?.politica_cancelacion_id ?? ""),
      ) ?? db().politicas[0];
    const tramo =
      [...(politica?.tramos ?? [])]
        .sort((a, b) => b.dias_desde_salida - a.dias_desde_salida)
        .find((t) => dias >= t.dias_desde_salida) ?? politica?.tramos[0];
    const porcentaje = tramo?.porcentaje_reembolso ?? 0;
    const pagado = Number.parseFloat(totalPagado(r));
    return {
      dias_para_salida: dias,
      tramo: { porcentaje, descripcion: tramo?.descripcion ?? "Sin reembolso" },
      monto_sugerido: ((pagado * porcentaje) / 100).toFixed(2),
    };
  },

  async cancelarReserva(id, body) {
    const datos = db();
    const r = buscarReserva(id);
    if (!puedeTransicionar(r.estado, "cancelada")) {
      throw err(
        409,
        "TRANSICION_INVALIDA",
        "Esta reserva no se puede cancelar desde su estado actual.",
      );
    }
    const pagosReportados = datos.pagos.filter(
      (p) => p.reserva_id === id && p.estado === "reportado",
    );
    if (pagosReportados.length > 0 && !body.forzar) {
      throw err(
        409,
        "TRANSICION_INVALIDA",
        "Hay un pago sin validar. Confirma si quieres forzar la cancelación.",
      );
    }
    r.estado = "cancelada";
    r.paso_actual = "cerrada";
    r.motivo_cierre = body.origen;
    r.expira_en = null;
    const usuario = datos.usuarios[0] as Usuario;
    auditoria(usuario, "reserva", id, "reserva.cancelada", r.estado, "cancelada", body.motivo);
    // Libera el cupo retenido.
    const fecha = datos.fechas.find((f) => f.id === r.fecha_tour_id);
    if (fecha) fecha.cupos_retenidos = Math.max(0, fecha.cupos_retenidos - r.pasajeros.length);
    return { ok: true };
  },

  async reprogramar(id, body) {
    const datos = db();
    const r = buscarReserva(id);
    const destino = datos.fechas.find((f) => f.id === body.fecha_tour_id);
    if (!destino) throw err(404, "NO_ENCONTRADO", "No encontramos la salida destino.");
    const libres = destino.cupos_total - destino.cupos_vendidos - destino.cupos_retenidos;
    if (libres < r.pasajeros.length) {
      throw err(409, "SIN_CUPO", "La salida destino no tiene cupos suficientes.", {
        data: { fecha_tour_id: destino.id },
      });
    }
    const anterior = r.fecha_tour_id;
    r.fecha_tour_id = destino.id;
    if (r.voucher) {
      r.voucher.version += 1;
      r.voucher.estado = "generando";
      delete r.voucher.url_descarga;
    }
    const usuario = datos.usuarios[0] as Usuario;
    auditoria(usuario, "reserva", id, "reserva.reprogramada", anterior, destino.id, body.motivo);
    return { ok: true, diferencia_usd: body.diferencia_usd ?? "0.00" };
  },

  async reactivar(id, body) {
    const r = buscarReserva(id);
    if (r.estado !== "expirada") {
      throw err(409, "TRANSICION_INVALIDA", "Solo puedes reactivar una reserva expirada.");
    }
    r.estado = "enlace_creado";
    r.paso_actual = "paso_registro";
    r.expira_en = horasDesde(db().config.enlace_vigencia_horas ?? 72);
    const usuario = db().usuarios[0] as Usuario;
    auditoria(
      usuario,
      "reserva",
      id,
      "reserva.reactivada",
      "expirada",
      "enlace_creado",
      body.motivo,
    );
    return { ok: true };
  },

  async pagos(filtros: FiltroPagos) {
    const datos = db();
    let items = datos.pagos.map((p) => ({
      ...p,
      reserva: datos.reservas.find((r) => r.id === p.reserva_id)!,
    }));
    if (filtros.estado) items = items.filter((p) => p.estado === filtros.estado);
    if (filtros.reserva_id) items = items.filter((p) => p.reserva_id === filtros.reserva_id);
    if (filtros.busqueda) {
      const q = filtros.busqueda.toLowerCase().trim();
      items = items.filter(
        (p) =>
          p.referencia.toLowerCase().includes(q) ||
          p.reserva.codigo.toLowerCase().includes(q) ||
          p.reserva.ref_corta.toLowerCase().includes(q),
      );
    }
    items.sort((a, b) => new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime());
    const limite = filtros.limite ?? 20;
    const cursor = filtros.cursor ? Number.parseInt(filtros.cursor, 10) : 0;
    const pagina = items.slice(cursor, cursor + limite);
    return {
      items: pagina,
      next_cursor: cursor + limite < items.length ? String(cursor + limite) : null,
      total: items.length,
    } satisfies Pagina<Pago & { reserva: Reserva }>;
  },

  async pago(id) {
    const datos = db();
    const p = datos.pagos.find((x) => x.id === id);
    if (!p) throw err(404, "NO_ENCONTRADO", "No encontramos ese pago.");
    const reserva = datos.reservas.find((r) => r.id === p.reserva_id);
    if (!reserva) throw err(404, "NO_ENCONTRADO", "No encontramos la reserva del pago.");
    return { ...p, reserva, comprobante_url: `/api/mock/comprobante/${p.id}` };
  },

  async validarPago(id, body: AccionValidacion) {
    return conIdempotencia(body.idempotencyKey, async () => {
      const datos = db();
      const pago = datos.pagos.find((p) => p.id === id);
      if (!pago) throw err(404, "NO_ENCONTRADO", "No encontramos ese pago.");
      if (pago.estado !== "reportado" && pago.estado !== "correccion_solicitada") {
        throw err(409, "TRANSICION_INVALIDA", "Otro validador ya resolvió este pago.");
      }
      const reserva = datos.reservas.find((r) => r.id === pago.reserva_id);
      if (!reserva) throw err(404, "NO_ENCONTRADO", "No encontramos la reserva.");

      const usuario = datos.usuarios[0] as Usuario;

      if (body.accion === "aprobar") {
        if (pago.duplicado_de_pago_id && !body.confirmar_duplicado) {
          throw err(422, "VALIDACION", "Confirma que este pago no es un duplicado.", {
            detalles: [
              { campo: "confirmar_duplicado", mensaje: "Marca la confirmación del duplicado." },
            ],
          });
        }
        pago.estado = "aprobado";
        pago.validado_por = usuario.nombre;
        pago.validado_en = ahoraIso();
        if (body.monto_validado) pago.monto = toDecimalString(body.monto_validado);

        const pagado = Number.parseFloat(totalPagado(reserva));
        const total = Number.parseFloat(reserva.total_usd || "0");
        const saldo = Math.max(0, total - pagado);
        reserva.saldo_usd = saldo.toFixed(2);
        reserva.estado_pago = saldo <= 0 ? "pagado" : "parcial";

        if (saldo <= 0) {
          reserva.estado = "confirmada";
          reserva.paso_actual = "confirmada";
          reserva.expira_en = null;
          reserva.voucher = {
            id: `vou_${reserva.id}`,
            version: 1,
            estado: "listo",
            vigente: true,
            generado_en: ahoraIso(),
            url_descarga: `/descarga/voucher?t=${reserva.ref_corta}`,
            verif_token: `qr_${reserva.id}`,
          };
          datos.verificaciones[`qr_${reserva.id}`] = reserva.id;
          // Vende los cupos.
          const fecha = datos.fechas.find((f) => f.id === reserva.fecha_tour_id);
          if (fecha) {
            fecha.cupos_vendidos += reserva.pasajeros.length;
            fecha.cupos_retenidos = Math.max(0, fecha.cupos_retenidos - reserva.pasajeros.length);
          }
        } else {
          reserva.estado = "pago_en_verificacion";
          reserva.paso_actual = "verificacion";
        }
        auditoria(usuario, "pago", id, "pago.aprobado", "reportado", "aprobado", body.motivo);
      } else if (body.accion === "rechazar") {
        if (!body.motivo && !body.motivo_catalogo) {
          throw err(422, "VALIDACION", "Elige el motivo del rechazo.", {
            detalles: [{ campo: "motivo", mensaje: "Selecciona un motivo." }],
          });
        }
        pago.estado = "rechazado";
        pago.motivo_rechazo = body.motivo_catalogo ?? body.motivo;
        pago.comentario_validador = body.motivo;
        pago.validado_por = usuario.nombre;
        pago.validado_en = ahoraIso();
        reserva.estado = "pendiente_pago";
        reserva.paso_actual = "pago";
        reserva.estado_pago = "rechazado";
        auditoria(usuario, "pago", id, "pago.rechazado", "reportado", "rechazado", body.motivo);
      } else if (body.accion === "solicitar_correccion") {
        if (!body.texto_cliente || body.texto_cliente.trim().length < 10) {
          throw err(
            422,
            "VALIDACION",
            "Escribe un mensaje de al menos 10 caracteres para el cliente.",
            {
              detalles: [{ campo: "texto_cliente", mensaje: "Escribe al menos 10 caracteres." }],
            },
          );
        }
        pago.estado = "correccion_solicitada";
        pago.comentario_validador = body.texto_cliente;
        pago.validado_por = usuario.nombre;
        pago.validado_en = ahoraIso();
        auditoria(usuario, "pago", id, "pago.correccion", "reportado", "correccion_solicitada");
      } else {
        pago.estado = "anulado";
        auditoria(usuario, "pago", id, "pago.anulado", "reportado", "anulado", body.motivo);
      }

      return { ok: true, saldo_usd: reserva.saldo_usd };
    });
  },

  async registrarPagoEfectivo(id, body) {
    const datos = db();
    const r = buscarReserva(id);
    const pago: Pago = {
      id: `pgo_${(datos.pagos.length + 1).toString(36)}`,
      reserva_id: r.id,
      metodo: "efectivo",
      monto: toDecimalString(body.monto),
      moneda: "USD",
      tasa: null,
      fecha_pago: ahoraIso().slice(0, 10),
      referencia: body.referencia ?? "EFECTIVO",
      estado: "aprobado",
      alertas: [],
      registrado_por: "Operador",
      validado_por: "Operador",
      validado_en: ahoraIso(),
      creado_en: ahoraIso(),
    };
    datos.pagos.unshift(pago);
    const pagado = Number.parseFloat(totalPagado(r));
    const total = Number.parseFloat(r.total_usd || "0");
    const saldo = Math.max(0, total - pagado);
    r.saldo_usd = saldo.toFixed(2);
    r.estado_pago = saldo <= 0 ? "pagado" : "parcial";
    if (saldo <= 0) {
      r.estado = "confirmada";
      r.paso_actual = "confirmada";
      r.voucher = {
        id: `vou_${r.id}`,
        version: 1,
        estado: "listo",
        vigente: true,
        generado_en: ahoraIso(),
        url_descarga: `/descarga/voucher?t=${r.ref_corta}`,
        verif_token: `qr_${r.id}`,
      };
      datos.verificaciones[`qr_${r.id}`] = r.id;
    }
    const usuario = datos.usuarios[0] as Usuario;
    auditoria(usuario, "pago", pago.id, "pago.efectivo", "—", pago.monto, body.nota);
    return { ok: true };
  },

  async reembolsar(id, body) {
    const datos = db();
    const pago = datos.pagos.find((p) => p.id === id);
    if (!pago) throw err(404, "NO_ENCONTRADO", "No encontramos ese pago.");
    const reserva = datos.reservas.find((r) => r.id === pago.reserva_id);
    if (reserva) {
      reserva.estado_pago = "reembolsado";
      reserva.estado = "cancelada";
      reserva.paso_actual = "cerrada";
      reserva.motivo_cierre = "agencia";
      const fecha = datos.fechas.find((f) => f.id === reserva.fecha_tour_id);
      if (fecha)
        fecha.cupos_vendidos = Math.max(0, fecha.cupos_vendidos - reserva.pasajeros.length);
    }
    const usuario = datos.usuarios[0] as Usuario;
    auditoria(usuario, "pago", id, "pago.reembolsado", "aprobado", body.monto, body.motivo);
    return { ok: true };
  },

  async tours() {
    return db().tours;
  },

  async tour(id) {
    const datos = db();
    const tour = datos.tours.find((t) => t.id === id);
    if (!tour) throw err(404, "NO_ENCONTRADO", "No encontramos ese tour.");
    return {
      tour,
      fechas: datos.fechas.filter((f) => f.tour_id === id),
      tarifas: datos.tarifas.filter((t) =>
        datos.fechas.some((f) => f.id === t.fecha_tour_id && f.tour_id === id),
      ),
    };
  },

  async guardarTour(id, body) {
    const datos = db();
    if (id) {
      const i = datos.tours.findIndex((t) => t.id === id);
      if (i >= 0) datos.tours[i] = { ...datos.tours[i], ...body } as Tour;
      return datos.tours[i] as Tour;
    }
    const nuevo: Tour = {
      id: `tour_${Math.random().toString(36).slice(2, 8)}`,
      nombre: body.nombre ?? "Tour sin nombre",
      tipo: body.tipo ?? "full_day",
      descripcion: body.descripcion ?? "",
      itinerario: body.itinerario ?? [],
      incluye: body.incluye ?? [],
      no_incluye: body.no_incluye ?? [],
      imagenes: body.imagenes ?? [],
      puntos_abordaje: body.puntos_abordaje ?? [],
      estado: "borrador",
      politica_cancelacion_id: body.politica_cancelacion_id ?? "",
      terminos_version_id: body.terminos_version_id ?? "",
      formulario_id: "",
      fecha_creacion: ahoraIso(),
    };
    datos.tours.unshift(nuevo);
    return nuevo;
  },

  async duplicarTour(id) {
    const datos = db();
    const original = datos.tours.find((t) => t.id === id);
    if (!original) throw err(404, "NO_ENCONTRADO", "No encontramos ese tour.");
    const nuevo: Tour = {
      ...original,
      id: `tour_${Math.random().toString(36).slice(2, 8)}`,
      nombre: `${original.nombre} (copia)`,
      estado: "borrador",
      fecha_creacion: ahoraIso(),
    };
    datos.tours.unshift(nuevo);
    return nuevo;
  },

  async cambiarEstadoTour(id, body) {
    const datos = db();
    const tour = datos.tours.find((t) => t.id === id);
    if (!tour) throw err(404, "NO_ENCONTRADO", "No encontramos ese tour.");
    const bloqueos: string[] = [];
    if (body.estado === "activo") {
      if (!tour.politica_cancelacion_id)
        bloqueos.push("Falta asociar una política de cancelación.");
      if (!tour.terminos_version_id) bloqueos.push("Falta publicar los términos y condiciones.");
    }
    if (body.estado === "archivado") {
      const futuras = datos.fechas.filter(
        (f) =>
          f.tour_id === id && f.estado === "publicada" && f.fecha_salida >= ahoraIso().slice(0, 10),
      );
      if (futuras.length > 0) {
        bloqueos.push(
          `Tiene ${futuras.length} fechas futuras publicadas. Ciérralas antes de archivar.`,
        );
      }
    }
    if (bloqueos.length === 0) tour.estado = body.estado;
    return { ok: bloqueos.length === 0, bloqueos };
  },

  async fechas(tour_id) {
    if (!tour_id) return db().fechas;
    return db().fechas.filter((f) => f.tour_id === tour_id);
  },

  async guardarFecha(body) {
    const datos = db();
    if (body.id) {
      const i = datos.fechas.findIndex((f) => f.id === body.id);
      if (i >= 0) datos.fechas[i] = { ...datos.fechas[i], ...body } as FechaTour;
      return datos.fechas[i] as FechaTour;
    }
    const nueva: FechaTour = {
      id: `fec_${Math.random().toString(36).slice(2, 8)}`,
      tour_id: body.tour_id,
      fecha_salida: body.fecha_salida ?? ahoraIso().slice(0, 10),
      hora_salida: body.hora_salida ?? "05:30",
      cupos_total: body.cupos_total ?? 40,
      cupos_retenidos: 0,
      cupos_vendidos: 0,
      estado: body.estado ?? "borrador",
      corte_venta_horas: body.corte_venta_horas ?? 12,
      opciones_cupo: body.opciones_cupo ?? [],
    };
    datos.fechas.push(nueva);
    // Tarifas por defecto.
    const precios: Record<string, [number, number, string]> = {
      Adulto: [18, 120, "55.00"],
      Niño: [3, 11, "35.00"],
      "Tercera Edad": [61, 120, "50.00"],
      Infante: [0, 2, "0.00"],
    };
    for (const [categoria, [min, max, precio]] of Object.entries(precios)) {
      datos.tarifas.push({
        id: `tar_${nueva.id}_${categoria}`,
        fecha_tour_id: nueva.id,
        categoria: categoria as Categoria,
        edad_min: min,
        edad_max: max,
        precio_usd: precio,
      });
    }
    return nueva;
  },

  async cerrarFecha(id, body) {
    const datos = db();
    const fecha = datos.fechas.find((f) => f.id === id);
    if (!fecha) throw err(404, "NO_ENCONTRADO", "No encontramos esa salida.");
    fecha.estado = "cerrada";
    fecha.motivo_cierre = body.motivo ?? "Cierre manual";
    if (body.expirar_pendientes) {
      for (const r of datos.reservas.filter(
        (x) =>
          x.fecha_tour_id === id &&
          ["en_registro", "pendiente_firma", "pendiente_pago"].includes(x.estado),
      )) {
        // Liberar cupos retenidos
        if (r.pasajeros.length > 0) {
          fecha.cupos_retenidos = Math.max(0, fecha.cupos_retenidos - r.pasajeros.length);
        }
        r.estado = "expirada";
        r.paso_actual = "cerrada";
        r.motivo_cierre = "expiracion";
      }
    }
    return { ok: true };
  },

  async cancelarFecha(id, body) {
    const datos = db();
    const fecha = datos.fechas.find((f) => f.id === id);
    if (!fecha) throw err(404, "NO_ENCONTRADO", "No encontramos esa salida.");
    fecha.estado = "cancelada";
    fecha.motivo_cierre = body.motivo;
    for (const r of datos.reservas.filter((x) => x.fecha_tour_id === id)) {
      if (["en_registro", "pendiente_firma", "pendiente_pago"].includes(r.estado)) {
        // Liberar cupos retenidos
        if (r.pasajeros.length > 0) {
          fecha.cupos_retenidos = Math.max(0, fecha.cupos_retenidos - r.pasajeros.length);
        }
        r.estado = "expirada";
        r.paso_actual = "cerrada";
        r.motivo_cierre = "fecha_cancelada";
      } else if (r.estado === "confirmada") {
        r.requiere_accion = "La salida fue cancelada. Elige reprogramar o reembolso.";
      }
    }
    const usuario = datos.usuarios[0] as Usuario;
    auditoria(usuario, "salida", id, "salida.cancelada", fecha.estado, "cancelada", body.motivo);
    return { tarea_id: `tarea_${id}` };
  },

  async progresoCancelacion(tarea_id) {
    return { estado: "completada", porcentaje: 100 };
  },

  async autorizarSobrecupo(id, body) {
    const datos = db();
    const fecha = datos.fechas.find((f) => f.id === id);
    if (!fecha) throw err(404, "NO_ENCONTRADO", "No encontramos esa salida.");
    if (body.codigo_totp.trim() !== "123456") {
      throw err(401, "NO_AUTENTICADO", "El código de confirmación no es válido.");
    }
    fecha.cupos_total += body.cupos_extra;
    fecha.sobrecupo_autorizado = true;
    const usuario = datos.usuarios[0] as Usuario;
    auditoria(usuario, "salida", id, "salida.sobrecupo", "—", `+${body.cupos_extra}`, body.motivo);
    return { ok: true };
  },

  async guardarTarifa(body) {
    const datos = db();
    if (body.id) {
      const i = datos.tarifas.findIndex((t) => t.id === body.id);
      if (i >= 0) {
        datos.tarifas[i] = { ...datos.tarifas[i], ...body } as Tarifa;
        return datos.tarifas[i] as Tarifa;
      }
      throw err(404, "NO_ENCONTRADO", "No encontramos esa tarifa.");
    }
    if (!body.fecha_tour_id) {
      throw err(422, "VALIDACION", "La tarifa debe estar asociada a una fecha de salida.");
    }
    const fecha = datos.fechas.find((f) => f.id === body.fecha_tour_id);
    if (!fecha) {
      throw err(404, "NO_ENCONTRADO", "No encontramos esa fecha de salida.");
    }
    const nueva: Tarifa = {
      id: `tar_${Math.random().toString(36).slice(2, 8)}`,
      fecha_tour_id: body.fecha_tour_id,
      categoria: body.categoria ?? "Adulto",
      edad_min: body.edad_min ?? 18,
      edad_max: body.edad_max ?? 120,
      precio_usd: body.precio_usd ?? "0.00",
    };
    datos.tarifas.push(nueva);
    return nueva;
  },

  async eliminarTarifa(id) {
    const datos = db();
    const i = datos.tarifas.findIndex((t) => t.id === id);
    if (i < 0) throw err(404, "NO_ENCONTRADO", "No encontramos esa tarifa.");
    datos.tarifas.splice(i, 1);
    return { ok: true };
  },

  async formulario(tour_id) {
    const datos = db();
    const formulario = datos.formularios.find((f) => f.tour_id === tour_id);
    // Permitir abrir el constructor incluso si no existe formulario
    if (!formulario) {
      return { formulario: null };
    }
    return { formulario };
  },

  async guardarFormulario(tour_id, body) {
    const datos = db();
    let formulario = datos.formularios.find((f) => f.tour_id === tour_id);
    const errores: { campo: string; mensaje: string; nivel: "bloqueante" | "advertencia" }[] = [];

    const ids = new Set<string>();
    for (const campo of body.definicion.campos) {
      if (!campo.id) {
        errores.push({
          campo: "(sin id)",
          mensaje: "Todos los campos necesitan un identificador.",
          nivel: "bloqueante",
        });
        continue;
      }
      if (ids.has(campo.id)) {
        errores.push({
          campo: campo.id,
          mensaje: "Hay dos campos con el mismo identificador.",
          nivel: "bloqueante",
        });
      }
      ids.add(campo.id);
      if (!campo.label?.trim()) {
        errores.push({
          campo: campo.id,
          mensaje: "El campo necesita una etiqueta.",
          nivel: "bloqueante",
        });
      }
      if (campo.tipo === "select" || campo.tipo === "multiselect") {
        if (!campo.opciones || campo.opciones.length === 0) {
          errores.push({
            campo: campo.id,
            mensaje: "Agrega al menos una opción.",
            nivel: "bloqueante",
          });
        }
      }
      if (campo.visible_si) {
        const dep = body.definicion.campos.find((c: CampoDef) => c.id === campo.visible_si?.campo);
        if (!dep) {
          errores.push({
            campo: campo.id,
            mensaje: "La condición apunta a un campo inexistente.",
            nivel: "bloqueante",
          });
        } else if (dep.alcance !== campo.alcance && !dep.permite_por_pasajero) {
          errores.push({
            campo: campo.id,
            mensaje: `No puedes condicionar un campo "${campo.alcance}" a uno "${dep.alcance}".`,
            nivel: "advertencia",
          });
        }
      }
    }

    if (!formulario) {
      formulario = {
        id: `form_${tour_id}`,
        tour_id,
        definicion: body.definicion,
        actualizado_en: ahoraIso(),
      };
      datos.formularios.push(formulario);
      const tour = datos.tours.find((t) => t.id === tour_id);
      if (tour) tour.formulario_id = formulario.id;
    } else {
      formulario.definicion = body.definicion;
      formulario.actualizado_en = ahoraIso();
    }

    return { errores };
  },

  async salidas(params) {
    const datos = db();
    return datos.fechas
      .filter((f) => (params?.tour_id ? f.tour_id === params.tour_id : true))
      .filter((f) => (params?.mes ? f.fecha_salida.startsWith(params.mes) : true))
      .sort((a, b) => a.fecha_salida.localeCompare(b.fecha_salida))
      .map((f) => {
        const alertas: string[] = [];
        const libres = f.cupos_total - f.cupos_vendidos - f.cupos_retenidos;
        if (f.estado === "publicada" && libres === 0) alertas.push("Agotada");
        else if (f.estado === "publicada" && libres > 0 && libres <= 3) alertas.push("Casi llena");
        if (f.estado === "cerrada") alertas.push("Cerrada");
        if (f.estado === "cancelada") alertas.push("Cancelada");
        return {
          fecha_tour_id: f.id,
          tour: datos.tours.find((t) => t.id === f.tour_id)?.nombre ?? "Tour",
          fecha: f.fecha_salida,
          hora: f.hora_salida,
          estado: f.estado,
          vendidos: f.cupos_vendidos,
          retenidos: f.cupos_retenidos,
          total: f.cupos_total,
          alertas,
        };
      });
  },

  async salida(id) {
    const datos = db();
    const fecha = datos.fechas.find((f) => f.id === id);
    if (!fecha) throw err(404, "NO_ENCONTRADO", "No encontramos esa salida.");
    const tour = datos.tours.find((t) => t.id === fecha.tour_id);
    const manifest = datos.reservas.filter((r) => r.fecha_tour_id === id);
    const porEstado = new Map<EstadoReserva, number>();
    for (const r of manifest) porEstado.set(r.estado, (porEstado.get(r.estado) ?? 0) + 1);

    const opciones = fecha.opciones_cupo.map((o) => {
      const campo = datos.formularios
        .find((f) => f.id === tour?.formulario_id)
        ?.definicion.campos.find((c) => c.id === o.campo_id);
      const etiqueta = campo?.opciones?.find((op: any) => op.valor === o.opcion)?.label ?? o.opcion;
      const cantidad = manifest.reduce((acc, r) => {
        const v = r.respuestas_globales[o.campo_id];
        if (v === o.opcion) return acc + 1;
        return acc + r.pasajeros.filter((p) => p.respuestas[o.campo_id] === o.opcion).length;
      }, 0);
      return {
        opcion: etiqueta,
        campo_id: o.campo_id,
        cantidad,
        agotados: o.agotados,
        cupo: o.cupo,
      };
    });

    return {
      fecha,
      tour: (tour ?? {}) as Tour,
      tarifas: datos.tarifas.filter((t) => t.fecha_tour_id === id),
      reservas_por_estado: [...porEstado.entries()].map(([estado, total]) => ({ estado, total })),
      opciones,
      manifest,
    };
  },

  async clientes(params) {
    const datos = db();
    const porDocumento = new Map<
      string,
      { nombre: string; tipo_doc: string; documento: string; telefono: string; reservas: Reserva[] }
    >();
    for (const r of datos.reservas) {
      const t = r.pasajeros.find((p) => p.es_titular);
      if (!t || !t.documento) continue;
      const item = porDocumento.get(t.documento) ?? {
        nombre: t.nombre,
        tipo_doc: t.tipo_doc,
        documento: t.documento,
        telefono: "",
        reservas: [],
      };
      item.reservas.push(r);
      porDocumento.set(t.documento, item);
    }
    let items = [...porDocumento.values()].map((c) => ({
      id: c.documento,
      nombre: c.nombre,
      documento_enmascarado: `${c.tipo_doc}-****${c.documento.slice(-4)}`,
      telefono: c.telefono,
      reservas: c.reservas.length,
    }));
    if (params.busqueda) {
      const q = params.busqueda.toLowerCase().trim();
      items = items.filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) ||
          c.documento_enmascarado.includes(q) ||
          c.telefono.includes(q),
      );
    }
    return { items };
  },

  async cliente(id) {
    const datos = db();
    const reservas = datos.reservas.filter((r) =>
      r.pasajeros.some((p) => p.es_titular && p.documento === id),
    );
    const t = reservas[0]?.pasajeros.find((p) => p.es_titular);
    if (!t) throw err(404, "NO_ENCONTRADO", "No encontramos ese cliente.");
    return {
      id,
      nombre: t.nombre,
      tipo_doc: t.tipo_doc,
      documento_enmascarado: `${t.tipo_doc}-****${t.documento.slice(-4)}`,
      telefono: "",
      correo: "",
      notas: notasCliente.get(id) ?? "",
      reservas,
    };
  },

  async guardarNotaCliente(id, body) {
    notasCliente.set(id, body.notas);
    const usuario = db().usuarios[0] as Usuario;
    auditoria(usuario, "cliente", id, "cliente.nota", "—", body.notas.slice(0, 60));
    return { ok: true };
  },

  async reportes(params) {
    const datos = db();
    const desde = params.desde;
    const hasta = params.hasta;
    const pagos = datos.pagos.filter((p) => {
      const f = p.fecha_pago;
      return f >= desde && f <= hasta;
    });

    const porTour = new Map<string, { total: number; reservas: number }>();
    const porMetodo = new Map<string, { total: number; pagos: number }>();
    for (const p of pagos) {
      const reserva = datos.reservas.find((r) => r.id === p.reserva_id);
      const tour = datos.tours.find(
        (t) => t.id === datos.fechas.find((f) => f.id === reserva?.fecha_tour_id)?.tour_id,
      );
      const key = tour?.nombre ?? "Sin tour";
      const actual = porTour.get(key) ?? { total: 0, reservas: 0 };
      actual.total += Math.round(Number.parseFloat(p.monto) * 100);
      actual.reservas += 1;
      porTour.set(key, actual);

      const m = porMetodo.get(p.metodo) ?? { total: 0, pagos: 0 };
      m.total += Math.round(Number.parseFloat(p.monto) * 100);
      m.pagos += 1;
      porMetodo.set(p.metodo, m);
    }

    const pendientes = datos.pagos.filter((p) => p.estado === "reportado");
    const reembolsos = datos.pagos.filter((p) => p.estado === "anulado");

    return {
      ventas_por_tour: [...porTour.entries()].map(([tour, v]) => ({
        tour,
        total_usd: (v.total / 100).toFixed(2),
        reservas: v.reservas,
      })),
      ventas_por_metodo: [...porMetodo.entries()].map(([metodo, v]) => ({
        metodo,
        total_usd: (v.total / 100).toFixed(2),
        pagos: v.pagos,
      })),
      pagos_pendientes: {
        total_usd: (
          pendientes.reduce((a, p) => a + Math.round(Number.parseFloat(p.monto) * 100), 0) / 100
        ).toFixed(2),
        pagos: pendientes.length,
      },
      reembolsos: {
        total_usd: (
          reembolsos.reduce((a, p) => a + Math.round(Number.parseFloat(p.monto) * 100), 0) / 100
        ).toFixed(2),
        count: reembolsos.length,
      },
      ocupacion: datos.fechas
        .filter((f) => f.fecha_salida >= desde && f.fecha_salida <= hasta)
        .map((f) => ({
          fecha: f.fecha_salida,
          tour: datos.tours.find((t) => t.id === f.tour_id)?.nombre ?? "Tour",
          vendidos: f.cupos_vendidos,
          total: f.cupos_total,
          pct: f.cupos_total > 0 ? Math.round((f.cupos_vendidos / f.cupos_total) * 100) : 0,
        })),
    };
  },

  // ── exportaciones (mock: genera "al instante" para demo) ────────────
  async exportaciones() {
    return [...exportacionesMock.values()];
  },

  async crearExportacion(tipo, filtros) {
    const exp: Exportacion = {
      id: `exp_${Date.now().toString(36)}`,
      tipo,
      filtros: filtros ?? {},
      estado: "lista",
      nombre_archivo: `${tipo}-${ahoraIso().slice(0, 10)}.xlsx`,
      solicitada_por: "admin",
      intentos: 1,
      creado_en: ahoraIso(),
      actualizado_en: ahoraIso(),
    };
    exportacionesMock.set(exp.id, exp);
    return exp;
  },

  async exportacion(id) {
    const exp = exportacionesMock.get(id);
    if (!exp) throw new Error("Exportación no encontrada");
    return exp;
  },

  async descargarExportacion(id) {
    const exp = exportacionesMock.get(id);
    if (!exp) throw new Error("Exportación no encontrada");
    return { url: `/mock/exports/${exp.nombre_archivo}`, expira_en: ahoraIso() };
  },

  async configuracion() {
    const datos = db();
    return {
      config: datos.config,
      tasa: datos.tasa,
      metodos: datos.metodos_pago,
      terminos: datos.terminos,
      politicas: datos.politicas,
      plantillas: datos.plantillas,
      promos: datos.promos,
      usuarios: datos.usuarios,
    };
  },

  async guardarConfiguracion(body) {
    const datos = db();
    datos.config = { ...datos.config, ...body };
    return datos.config;
  },

  async registrarTasa(body) {
    const datos = db();
    for (const t of datos.tasa) t.vigente = false;
    const nueva: TasaCambio = {
      id: `tasa_${(datos.tasa.length + 1).toString(36)}`,
      valor: body.valor,
      registrada_por: "Administrador",
      registrada_en: ahoraIso(),
      vigente: true,
    };
    datos.tasa.push(nueva);
    return nueva;
  },

  async guardarMetodoPago(body) {
    const datos = db();
    if (body.id) {
      const i = datos.metodos_pago.findIndex((m) => m.id === body.id);
      if (i >= 0) {
        const actual = datos.metodos_pago[i] as MetodoPago;
        datos.metodos_pago[i] = {
          ...actual,
          ...body,
          id: actual.id,
          nombre: body.nombre ?? actual.nombre,
          moneda: body.moneda ?? actual.moneda,
          activo: body.activo ?? actual.activo,
          orden: body.orden ?? actual.orden,
          datos: body.datos ?? actual.datos,
          campos_requeridos: body.campos_requeridos ?? actual.campos_requeridos,
          requiere_comprobante: body.requiere_comprobante ?? actual.requiere_comprobante,
        };
      }
      return datos.metodos_pago[i] as MetodoPago;
    }
    const nuevo: MetodoPago = {
      id: (body.id ?? "efectivo") as MetodoPago["id"],
      nombre: body.nombre ?? "Método",
      moneda: body.moneda ?? "USD",
      activo: body.activo ?? true,
      orden: body.orden ?? datos.metodos_pago.length,
      datos: body.datos ?? [],
      campos_requeridos: body.campos_requeridos ?? [],
      requiere_comprobante: body.requiere_comprobante ?? true,
    };
    datos.metodos_pago.push(nuevo);
    return nuevo;
  },

  async publicarTerminos(body) {
    const datos = db();
    for (const t of datos.terminos) t.activa = false;
    const nueva = {
      id: `ter_${(datos.terminos.length + 1).toString(36)}`,
      version: (datos.terminos.at(-1)?.version ?? 0) + 1,
      titulo: body.titulo,
      cuerpo: body.cuerpo,
      publicada_en: ahoraIso(),
      activa: true,
      hash: hashSimple(body.cuerpo),
    };
    datos.terminos.push(nueva);
    return nueva;
  },

  async guardarPlantilla(body) {
    const datos = db();
    if (body.id) {
      const i = datos.plantillas.findIndex((p) => p.id === body.id);
      if (i >= 0) {
        const actual = datos.plantillas[i]!;
        datos.plantillas[i] = {
          ...actual,
          ...body,
          id: actual.id,
          clave: body.clave ?? actual.clave,
          nombre: body.nombre ?? actual.nombre,
          variables: body.variables ?? actual.variables,
          cuerpo: body.cuerpo ?? actual.cuerpo,
        };
      }
      return datos.plantillas[i]!;
    }
    const nueva = {
      id: `plt_${(datos.plantillas.length + 1).toString(36)}`,
      clave: body.clave ?? "nueva",
      nombre: body.nombre ?? "Plantilla",
      variables: body.variables ?? [],
      cuerpo: body.cuerpo ?? "",
    };
    datos.plantillas.push(nueva);
    return nueva;
  },

  async guardarPolitica(body) {
    const datos = db();
    if (body.id) {
      const i = datos.politicas.findIndex((p) => p.id === body.id);
      if (i >= 0) {
        const actual = datos.politicas[i]!;
        datos.politicas[i] = {
          ...actual,
          ...body,
          id: actual.id,
          nombre: body.nombre ?? actual.nombre,
          tramos: body.tramos ?? actual.tramos,
        };
      }
      return datos.politicas[i]!;
    }
    const nueva = {
      id: `pol_${(datos.politicas.length + 1).toString(36)}`,
      nombre: body.nombre ?? "Política",
      tramos: body.tramos ?? [],
    };
    datos.politicas.push(nueva);
    return nueva;
  },

  async guardarPromo(body) {
    const datos = db();
    if (body.id) {
      const i = datos.promos.findIndex((p) => p.id === body.id);
      if (i >= 0) {
        const actual = datos.promos[i]!;
        datos.promos[i] = {
          ...actual,
          ...body,
          id: actual.id,
          codigo: body.codigo ?? actual.codigo,
          tipo: body.tipo ?? actual.tipo,
          valor: body.valor ?? actual.valor,
          vigente_desde: body.vigente_desde ?? actual.vigente_desde,
          vigente_hasta: body.vigente_hasta ?? actual.vigente_hasta,
          usos_max: body.usos_max ?? actual.usos_max,
          usos: actual.usos,
          activo: body.activo ?? actual.activo,
        };
      }
      return datos.promos[i]!;
    }
    const nuevo = {
      id: `prm_${(datos.promos.length + 1).toString(36)}`,
      codigo: body.codigo ?? "NUEVO",
      tipo: body.tipo ?? "porcentaje",
      valor: body.valor ?? 0,
      vigente_desde: body.vigente_desde ?? ahoraIso(),
      vigente_hasta: body.vigente_hasta ?? "",
      usos_max: body.usos_max ?? 100,
      usos: 0,
      activo: body.activo ?? true,
    };
    datos.promos.push(nuevo);
    return nuevo;
  },

  async guardarUsuario(body) {
    const datos = db();
    if (body.id) {
      const i = datos.usuarios.findIndex((u) => u.id === body.id);
      if (i >= 0) {
        const actual = datos.usuarios[i]!;
        datos.usuarios[i] = {
          ...actual,
          ...body,
          id: actual.id,
          nombre: body.nombre ?? actual.nombre,
          correo: body.correo ?? actual.correo,
          rol: body.rol ?? actual.rol,
          dos_factores_activo: body.dos_factores_activo ?? actual.dos_factores_activo,
          activo: body.activo ?? actual.activo,
        };
      }
      return datos.usuarios[i]!;
    }
    const nuevo: Usuario = {
      id: `usr_${Math.random().toString(36).slice(2, 8)}`,
      nombre: body.nombre ?? "Nuevo usuario",
      correo: body.correo ?? "",
      rol: body.rol ?? "OP",
      dos_factores_activo: body.dos_factores_activo ?? false,
      activo: body.activo ?? true,
    };
    datos.usuarios.push(nuevo);
    return nuevo;
  },

  async subirFirmaEmpresa(body) {
    const datos = db();
    datos.config.firma_empresa_fecha = ahoraIso();
    const usuario = datos.usuarios[0] as Usuario;
    auditoria(usuario, "configuracion", "firma_empresa", "firma.subida", "—", body.nombre);
    return { ok: true, fecha: datos.config.firma_empresa_fecha };
  },

  async auditoria(params) {
    const datos = db();
    let items = datos.auditoria;
    if (params?.entidad) items = items.filter((a) => a.entidad === params.entidad);
    if (params?.usuario_id) items = items.filter((a) => a.usuario_id === params.usuario_id);
    if (params?.accion) items = items.filter((a) => a.accion.includes(params.accion as string));
    return items;
  },
};

// ---------------------------------------------------------------------------
// Credenciales de la demo
// ---------------------------------------------------------------------------

interface Credencial {
  correo: string;
  password: string;
}

const CREDENCIALES: (Credencial & { rol: string })[] = [
  { correo: "admin@rutaclara.ve", password: "demo1234", rol: "SA" },
  { correo: "operador@rutaclara.ve", password: "demo1234", rol: "OP" },
  { correo: "validador@rutaclara.ve", password: "demo1234", rol: "VAL" },
  { correo: "guia@rutaclara.ve", password: "demo1234", rol: "GU" },
];

// ---------------------------------------------------------------------------
// Superficie pública
// ---------------------------------------------------------------------------

export const api: ApiSurface = { publica, admin };

/** Reinicia la base en memoria (útil para la demo y para pruebas). */
export function reiniciarDemo(): void {
  resetDb();
  IDEMPORALIDAD.clear();
  sesiones.clear();
  notasCliente.clear();
  exportacionesMock.clear();
}

export type { LineaPrecio, Progreso, Respuesta };
