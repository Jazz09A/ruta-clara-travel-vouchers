import { RUTAS_ADMIN } from "@/lib/brand";

/**
 * Rutas del panel declaradas como `string` (y no como literales).
 *
 * Motivo: el árbol de rutas se autogenera (`src/routeTree.gen.ts`). Al
 * declarar las rutas como `string`, los enlaces y la navegación no dependen
 * de que la ruta ya esté en el árbol generado, y `to` acepta cualquier
 * destino interno sin romper la comprobación de tipos.
 */
export interface RutasAdmin {
  panel: string;
  reservas: string;
  nuevaReserva: string;
  pagos: string;
  salidas: string;
  tours: string;
  clientes: string;
  reportes: string;
  configuracion: string;
  auditoria: string;
  login: string;
  dosFactores: string;
  recuperar: string;
  formularioCliente: string;
}

export const RUTA: RutasAdmin = {
  panel: RUTAS_ADMIN.dashboard,
  reservas: RUTAS_ADMIN.reservas,
  nuevaReserva: RUTAS_ADMIN.nuevaReserva,
  pagos: RUTAS_ADMIN.pagos,
  salidas: RUTAS_ADMIN.salidas,
  tours: RUTAS_ADMIN.tours,
  clientes: RUTAS_ADMIN.clientes,
  reportes: RUTAS_ADMIN.reportes,
  configuracion: RUTAS_ADMIN.configuracion,
  auditoria: RUTAS_ADMIN.auditoria,
  login: "/admin/login",
  dosFactores: "/admin/2fa",
  recuperar: "/admin/recuperar",
  formularioCliente: "/r/demo",
};

/** Añade parámetros de consulta a una ruta interna. */
export function conConsulta(ruta: string, parametros: Record<string, string | number | boolean>): string {
  const partes = Object.entries(parametros)
    .filter(([, valor]) => valor !== "" && valor !== undefined && valor !== null)
    .map(([clave, valor]) => `${encodeURIComponent(clave)}=${encodeURIComponent(String(valor))}`);
  if (partes.length === 0) return ruta;
  return `${ruta}?${partes.join("&")}`;
}
