import { ETIQUETA_ESTADO_RESERVA } from "@/lib/format";
import type { EstadoPago, EstadoReserva, PasoActual } from "./types";

/**
 * Máquina de estados de la reserva (PRD §6).
 *
 * Lógica pura: describe qué transiciones existen y qué se puede hacer en cada
 * estado. El servidor sigue siendo la autoridad al aplicar el cambio.
 */

/** Transiciones permitidas por estado (PRD §6). */
export const TRANSICIONES: Record<EstadoReserva, EstadoReserva[]> = {
  enlace_creado: ["en_registro", "expirada", "cancelada"],
  en_registro: ["pendiente_firma", "expirada", "cancelada"],
  // La firma confirma la reserva (sin paso de pago); `pendiente_pago` queda
  // sólo para reservas legacy creadas antes de quitar ese paso.
  pendiente_firma: ["confirmada", "pendiente_pago", "cancelada"],
  pendiente_pago: ["pago_en_verificacion", "confirmada", "expirada", "cancelada"],
  pago_en_verificacion: ["confirmada", "pendiente_pago", "cancelada"],
  confirmada: ["cancelada", "completada"],
  completada: [],
  cancelada: [],
  expirada: ["enlace_creado"],
};

/** Estados en los que el cliente todavía puede editar la reserva (D-07/D-09). */
export const ESTADOS_EDITABLES: EstadoReserva[] = [
  "enlace_creado",
  "en_registro",
  "pendiente_firma",
  "pendiente_pago",
  "pago_en_verificacion",
];

/** Flujo de pasos del cliente (Spec §4.2). Sin paso de pago: el voucher
 *  se genera al firmar y el pago se registra al crear el enlace. */
export const PASOS: PasoActual[] = [
  "paso_registro",
  "titular",
  "acompanantes",
  "preguntas",
  "resumen",
  "firma",
  "confirmada",
  "cerrada",
];

/** ¿La transición existe en la máquina de estados? */
export function puedeTransicionar(desde: EstadoReserva, hacia: EstadoReserva): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

/** Transiciones disponibles desde un estado (copia defensiva). */
export function transicionesValidas(estado: EstadoReserva): EstadoReserva[] {
  return [...TRANSICIONES[estado]];
}

/** Siguiente paso del flujo, o `null` si ya no hay avance posible. */
export function siguientePaso(paso: PasoActual): PasoActual | null {
  const indice = PASOS.indexOf(paso);
  if (indice < 0) return null;
  return PASOS[indice + 1] ?? null;
}

/** Texto legible del estado (nunca el identificador interno). */
export function etiquetaEstado(estado: EstadoReserva): string {
  return ETIQUETA_ESTADO_RESERVA[estado] ?? "Estado desconocido";
}

/**
 * Un estado es terminal cuando no tiene transiciones de salida
 * (`completada` y `cancelada`). `expirada` no lo es: el operador puede
 * reactivarla (PRD §6).
 */
export function esTerminal(estado: EstadoReserva): boolean {
  return TRANSICIONES[estado].length === 0;
}

/** ¿Se puede editar la reserva en este estado? (D-07/D-09) */
export function puedeEditar(estado: EstadoReserva): boolean {
  return ESTADOS_EDITABLES.includes(estado);
}

/**
 * ¿El cliente puede reportar un pago?
 * Sólo en `pendiente_pago` y cuando no hay un pago pendiente de verificación
 * ni la reserva ya está pagada o reembolsada.
 */
export function puedeReportarPago(estado: EstadoReserva, estadoPago: EstadoPago): boolean {
  if (estado !== "pendiente_pago") return false;
  return estadoPago === "sin_pago" || estadoPago === "parcial" || estadoPago === "rechazado";
}
