import type { Notificacion, TipoNotificacion } from "./types";

/**
 * Rutas base por tipo de notificación, usadas cuando no hay una entidad
 * concreta a la que llevar (lista del tipo).
 */
const RUTA_LISTA: Record<TipoNotificacion, string> = {
  pago: "/admin/pagos",
  reserva: "/admin/reservas",
  salida: "/admin/salidas",
  sistema: "/admin",
};

/**
 * Ruta a la que lleva una notificación al hacer clic (Spec §9.1).
 *
 * Lleva **directo a la entidad relacionada**: la reserva, el pago o la
 * salida en su detalle. Las exportaciones se revisan en Reportes. Si no
 * hay entidad identifiable, cae a la lista del tipo. Nunca usa `?id=`:
 * el detalle se resuelve por el id de la ruta.
 */
export function rutaNotificacion(
  notificacion: Pick<Notificacion, "tipo" | "titulo" | "detalle" | "entidad_id">,
): string {
  const id = notificacion.entidad_id;

  // Exportaciones (tipo «sistema»): el resultado se consulta en Reportes.
  const esExportacion =
    notificacion.tipo === "sistema" &&
    /exportaci/i.test(`${notificacion.titulo} ${notificacion.detalle ?? ""}`);
  if (esExportacion) return "/admin/reportes";

  if (id) {
    if (notificacion.tipo === "reserva") return `/admin/reservas/${encodeURIComponent(id)}`;
    if (notificacion.tipo === "pago") return `/admin/pagos/${encodeURIComponent(id)}`;
    if (notificacion.tipo === "salida") return `/admin/salidas/${encodeURIComponent(id)}`;
  }

  return RUTA_LISTA[notificacion.tipo];
}
