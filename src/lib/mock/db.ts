/**
 * Base de datos en memoria — Escapate Tours CRM
 *
 * Simula el "servidor" del backend: guarda el `SeedData` en una variable de
 * módulo y expone operaciones de lectura/escritura de bajo nivel. No hay
 * I/O: todo vive en memoria y se reinicia con `resetDb()`.
 *
 * La persistencia en `localStorage` está DESACTIVADA a propósito: la demo
 * debe ser reproducible (mismos datos y mismos vencimientos en cada arranque).
 *
 * Nota de arquitectura: `store.ts` no existe porque este módulo ya cubre las
 * dos responsabilidades previstas (estado + operaciones de bajo nivel). Cuando
 * haga falta un store *observable* (notificar cambios a React Query), se puede
 * añadir encima sin reescribir nada de aquí.
 */

import type {
  Auditoria,
  FechaTour,
  Formulario,
  MetodoPago,
  Notificacion,
  Pago,
  PoliticaCancelacion,
  PlantillaMensaje,
  Reserva,
  Tarifa,
  TasaCambio,
  Tour,
  Usuario,
  VersionTerminos,
  CodigoPromocional,
} from "@/lib/domain/types";

import { crearSeed, generarRefCorta, mulberry32, type SeedData } from "./seed";

// ---------------------------------------------------------------------------
// Colecciones
// ---------------------------------------------------------------------------

/** Colecciones con elementos identificables por `id`. */
export interface DbCollections {
  usuarios: Usuario[];
  tours: Tour[];
  fechas: FechaTour[];
  tarifas: Tarifa[];
  formularios: Formulario[];
  reservas: Reserva[];
  pagos: Pago[];
  metodos_pago: MetodoPago[];
  tasa: TasaCambio[];
  terminos: VersionTerminos[];
  politicas: PoliticaCancelacion[];
  plantillas: PlantillaMensaje[];
  promos: CodigoPromocional[];
  auditoria: Auditoria[];
  notificaciones: Notificacion[];
}

export type ColeccionKey = keyof DbCollections;

/** Índices derivados por id, para búsquedas O(1). */
export interface DbIndices {
  usuarios: Record<string, Usuario>;
  tours: Record<string, Tour>;
  fechas: Record<string, FechaTour>;
  tarifas: Record<string, Tarifa>;
  formularios: Record<string, Formulario>;
  reservas: Record<string, Reserva>;
  pagos: Record<string, Pago>;
  metodos_pago: Record<string, MetodoPago>;
  tasa: Record<string, TasaCambio>;
  terminos: Record<string, VersionTerminos>;
  politicas: Record<string, PoliticaCancelacion>;
  plantillas: Record<string, PlantillaMensaje>;
  promos: Record<string, CodigoPromocional>;
  auditoria: Record<string, Auditoria>;
  notificaciones: Record<string, Notificacion>;
}

export interface DbState {
  data: SeedData;
  indices: DbIndices;
}

/**
 * Persistencia en `localStorage` desactivada por defecto: la demo debe ser
 * reproducible. Si algún día se activa, hay que serializar `data` y reconstruir
 * los índices con `reconstruirIndices`.
 */
export const persistenciaActiva = false;

// ---------------------------------------------------------------------------
// Estado interno
// ---------------------------------------------------------------------------

function indexar<T extends { id: string }>(items: T[]): Record<string, T> {
  const indice: Record<string, T> = {};
  for (const item of items) {
    indice[item.id] = item;
  }
  return indice;
}

function construirIndices(data: SeedData): DbIndices {
  return {
    usuarios: indexar(data.usuarios),
    tours: indexar(data.tours),
    fechas: indexar(data.fechas),
    tarifas: indexar(data.tarifas),
    formularios: indexar(data.formularios),
    reservas: indexar(data.reservas),
    pagos: indexar(data.pagos),
    metodos_pago: indexar(data.metodos_pago),
    tasa: indexar(data.tasa),
    terminos: indexar(data.terminos),
    politicas: indexar(data.politicas),
    plantillas: indexar(data.plantillas),
    promos: indexar(data.promos),
    auditoria: indexar(data.auditoria),
    notificaciones: indexar(data.notificaciones),
  };
}

let estado: DbState = crearEstadoInicial();

function crearEstadoInicial(): DbState {
  const data = crearSeed();
  return { data, indices: construirIndices(data) };
}

/** Generador determinista para referencias cortas nuevas. */
const rngRef = mulberry32(0x52454631); // "REF1"

// ---------------------------------------------------------------------------
// Acceso al estado
// ---------------------------------------------------------------------------

/** Estado actual (datos + índices derivados). */
export function obtenerDb(): DbState {
  return estado;
}

/** Restaura el dataset inicial. Útil para reiniciar la demo y entre tests. */
export function resetDb(): void {
  estado = crearEstadoInicial();
}

// ---------------------------------------------------------------------------
// Operaciones de lectura
// ---------------------------------------------------------------------------

/** Copia superficial de los elementos de una colección. */
export function listar<T>(coleccion: ColeccionKey): T[] {
  const items: unknown[] = estado.data[coleccion];
  return items.slice() as T[];
}

/** Busca un elemento por id en el índice derivado. */
export function buscarPorId<T extends { id: string }>(
  coleccion: ColeccionKey,
  id: string,
): T | undefined {
  const indice = estado.indices[coleccion] as unknown as Record<string, T>;
  return indice[id];
}

// ---------------------------------------------------------------------------
// Operaciones de escritura
// ---------------------------------------------------------------------------

/** Inserta un elemento y actualiza el índice. */
export function insertar<T extends { id: string }>(coleccion: ColeccionKey, item: T): T {
  const items = estado.data[coleccion] as unknown as T[];
  items.push(item);
  (estado.indices[coleccion] as unknown as Record<string, T>)[item.id] = item;
  return item;
}

/**
 * Aplica cambios parciales a un elemento y devuelve la versión actualizada.
 * Lanza si el id no existe: es un error de programación, no un caso de negocio.
 */
export function actualizar<T extends { id: string }>(
  coleccion: ColeccionKey,
  id: string,
  cambios: Partial<T>,
): T {
  const actual = buscarPorId<T>(coleccion, id);
  if (!actual) {
    throw new Error(`No existe el elemento "${id}" en la colección "${coleccion}"`);
  }
  const actualizado: T = { ...actual, ...cambios };
  const items = estado.data[coleccion] as unknown as T[];
  const indiceItems = items.findIndex((item) => item.id === id);
  if (indiceItems >= 0) {
    items[indiceItems] = actualizado;
  }
  (estado.indices[coleccion] as unknown as Record<string, T>)[id] = actualizado;
  return actualizado;
}

/** Elimina un elemento por id. No hace nada si no existe. */
export function eliminar(coleccion: ColeccionKey, id: string): void {
  const items = estado.data[coleccion] as unknown as { id: string }[];
  const indiceItems = items.findIndex((item) => item.id === id);
  if (indiceItems >= 0) {
    items.splice(indiceItems, 1);
  }
  delete (estado.indices[coleccion] as Record<string, unknown>)[id];
}

// ---------------------------------------------------------------------------
// Generadores de identificadores
// ---------------------------------------------------------------------------

const PREFIJO_CODIGO = "VJ-2026-";

/**
 * Siguiente código de reserva correlativo y continuo (RF-8.2): `VJ-2026-00xxx`.
 * No reutiliza números: toma el mayor correlativo existente y lo incrementa.
 */
export function siguienteCodigoReserva(): string {
  let mayor = 0;
  for (const reserva of estado.data.reservas) {
    if (!reserva.codigo.startsWith(PREFIJO_CODIGO)) continue;
    const correlativo = Number.parseInt(reserva.codigo.slice(PREFIJO_CODIGO.length), 10);
    if (Number.isFinite(correlativo) && correlativo > mayor) {
      mayor = correlativo;
    }
  }
  return `${PREFIJO_CODIGO}${String(mayor + 1).padStart(5, "0")}`;
}

/** Siguiente referencia corta de 7 caracteres en mayúsculas. */
export function siguienteRefCorta(): string {
  let referencia = generarRefCorta(rngRef);
  const existentes = new Set(estado.data.reservas.map((reserva) => reserva.ref_corta));
  while (existentes.has(referencia)) {
    referencia = generarRefCorta(rngRef);
  }
  return referencia;
}

// ---------------------------------------------------------------------------
// Auditoría y notificaciones
// ---------------------------------------------------------------------------

let contadorAuditoria = 0;
let contadorNotificacion = 0;

/**
 * Registra una entrada de auditoría. El `id`, la `fecha` y la `cadena` los
 * pone la base de datos (el cliente nunca los envía).
 */
export function registrarAuditoria(entry: Omit<Auditoria, "id" | "fecha" | "cadena">): Auditoria {
  contadorAuditoria += 1;
  const auditoria: Auditoria = {
    ...entry,
    id: `aud_${String(contadorAuditoria).padStart(4, "0")}_${Date.now().toString(36)}`,
    fecha: new Date().toISOString(),
    cadena: "ok",
  };
  insertar("auditoria", auditoria);
  return auditoria;
}

/** Crea una notificación (siempre empieza sin leer). */
export function crearNotificacion(n: Omit<Notificacion, "id" | "fecha" | "leida">): Notificacion {
  contadorNotificacion += 1;
  const notificacion: Notificacion = {
    ...n,
    id: `not_${String(contadorNotificacion).padStart(4, "0")}_${Date.now().toString(36)}`,
    fecha: new Date().toISOString(),
    leida: false,
  };
  insertar("notificaciones", notificacion);
  return notificacion;
}
