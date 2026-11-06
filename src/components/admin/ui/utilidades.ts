import { esApiError } from "@/lib/domain/api";

/**
 * Utilidades compartidas del panel administrativo.
 *
 * Reglas que aplican a todo el panel:
 * - Ninguna clave técnica llega al usuario: los mensajes del servidor ya
 *   vienen en español y son la base del texto que se muestra (Spec §11).
 * - Toda acción de efecto lleva su propia clave de idempotencia, que se
 *   reutiliza en los reintentos (Spec §8.2).
 */

/** Ventana durante la que un dato sensible revelado sigue visible (SEG-05). */
export const DURACION_REVELADO_MS = 30_000;

/** Tolerancia por defecto al comparar montos (5 céntimos). */
export const TOLERANCIA_MONTO_USD = "0.05";

/**
 * Clave de idempotencia (UUID v4) para una acción de efecto.
 *
 * Se genera **una vez por acción**: si la petición falla y el operador
 * reintenta, se reutiliza la misma clave para no duplicar el efecto.
 */
export function nuevoIdempotencyKey(): string {
  const cripto = globalThis.crypto;
  if (cripto && typeof cripto.randomUUID === "function") {
    return cripto.randomUUID();
  }
  // Respaldo para navegadores sin `crypto.randomUUID`.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (caracter) => {
    const aleatorio = Math.floor(Math.random() * 16);
    const valor = caracter === "x" ? aleatorio : (aleatorio & 0x3) | 0x8;
    return valor.toString(16);
  });
}

/**
 * Mensaje listo para mostrar de un error.
 *
 * - `ApiError`: se usa el mensaje del servidor (ya está en español).
 * - Cualquier otro fallo: una frase con la causa y la acción a seguir.
 */
export function mensajeDeError(
  error: unknown,
  porDefecto = "No pudimos completar la acción. Revisa tu conexión e inténtalo de nuevo.",
): string {
  if (esApiError(error)) return error.mensajeMostrable;
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return porDefecto;
}

/**
 * Código de soporte abreviado para que el operador pueda dictarlo.
 * Nunca se muestra junto a un mensaje técnico: solo como referencia.
 */
export function codigoDeSoporte(error: unknown): string | undefined {
  if (!esApiError(error)) return undefined;
  return error.requestId.slice(0, 8);
}

/** Convierte un texto en un identificador estable para elementos del DOM. */
export function idEstable(prefijo: string, valor: string): string {
  return `${prefijo}-${valor.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`;
}
