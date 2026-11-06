import { esApiError } from "@/lib/domain/api";

/**
 * Convierte cualquier error en un mensaje **apto para mostrar**.
 *
 * El servidor ya devuelve mensajes en español (Spec §11); aquí solo se evita
 * que al usuario le llegue un texto técnico o un código.
 */
export function mensajeError(error: unknown): string {
  if (esApiError(error)) {
    if (error.codigo === "STEP_UP_REQUERIDO") {
      return "Confirma tu identidad con el código de seguridad para continuar.";
    }
    return error.mensajeMostrable;
  }
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "Algo salió mal al cargar estos datos. Vuelve a intentarlo.";
}

/** Detalles de campo (`422 VALIDACION`) indexados por nombre de campo. */
export function erroresPorCampo(error: unknown): Record<string, string> {
  if (!esApiError(error) || !error.detalles) return {};
  const mapa: Record<string, string> = {};
  for (const detalle of error.detalles) {
    mapa[detalle.campo] = detalle.mensaje;
  }
  return mapa;
}
