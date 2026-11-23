import {
  BarChart3,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Map,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";

import { RUTAS_ADMIN } from "@/lib/brand";
import { tienePermiso, type Permiso, type Rol } from "@/lib/domain/types";

/**
 * Menú del panel: se construye **desde los permisos** (Spec §9.1).
 * Lo que el rol no puede hacer no aparece, ni siquiera deshabilitado.
 */

export type GrupoMenu = "principal" | "gestion" | "sistema";

export interface ItemMenu {
  id: string;
  etiqueta: string;
  ruta: string;
  icono: LucideIcon;
  /** Permiso necesario para que el ítem aparezca (`null` = siempre visible). */
  permiso: Permiso | null;
  grupo: GrupoMenu;
  /** Aparece también en la barra inferior del móvil. */
  barraInferior?: boolean;
  /**
   * Ocultado temporalmente del menú (el código queda por si vuelve el flujo).
   * «Pagos» se oculta porque ya no hay cola de validación: los pagos se
   * gestionan desde la reserva (panel de pagos) y su historial queda en
   * `/admin/pagos`, accesible por URL.
   */
  oculto?: boolean;
}

export const MENU: ItemMenu[] = [
  {
    id: "panel",
    etiqueta: "Inicio",
    ruta: RUTAS_ADMIN.dashboard,
    icono: LayoutDashboard,
    permiso: null,
    grupo: "principal",
    barraInferior: true,
  },
  {
    id: "reservas",
    etiqueta: "Reservas",
    ruta: RUTAS_ADMIN.reservas,
    icono: Ticket,
    permiso: "reservas.ver",
    grupo: "principal",
    barraInferior: true,
  },
  {
    id: "pagos",
    etiqueta: "Pagos",
    ruta: RUTAS_ADMIN.pagos,
    icono: CreditCard,
    permiso: "pagos.ver",
    grupo: "principal",
    barraInferior: true,
    // Sin cola de validación el acceso directo sobra: los pagos se gestionan
    // desde la reserva. Cambia a `false` para volver a mostrarlo.
    oculto: true,
  },
  {
    id: "salidas",
    etiqueta: "Salidas",
    ruta: RUTAS_ADMIN.salidas,
    icono: CalendarDays,
    permiso: "salidas.ver",
    grupo: "principal",
    barraInferior: true,
  },
  {
    id: "tours",
    etiqueta: "Tours",
    ruta: RUTAS_ADMIN.tours,
    icono: Map,
    permiso: "tours.ver",
    grupo: "gestion",
  },
  {
    id: "clientes",
    etiqueta: "Clientes",
    ruta: RUTAS_ADMIN.clientes,
    icono: Users,
    permiso: "clientes.ver",
    grupo: "gestion",
  },
  {
    id: "reportes",
    etiqueta: "Reportes",
    ruta: RUTAS_ADMIN.reportes,
    icono: BarChart3,
    permiso: "reportes.ver",
    grupo: "gestion",
  },
  {
    id: "configuracion",
    etiqueta: "Configuración",
    ruta: RUTAS_ADMIN.configuracion,
    icono: Settings,
    permiso: "config.ver",
    grupo: "sistema",
  },
  {
    id: "auditoria",
    etiqueta: "Auditoría",
    ruta: RUTAS_ADMIN.auditoria,
    icono: ShieldCheck,
    permiso: "auditoria.ver",
    grupo: "sistema",
  },
];

export const ORDEN_GRUPOS: GrupoMenu[] = ["principal", "gestion", "sistema"];

export const ETIQUETA_GRUPO: Record<GrupoMenu, string> = {
  principal: "Operación",
  gestion: "Gestión",
  sistema: "Sistema",
};

/** Etiqueta legible del rol (nunca el identificador interno). */
export const ETIQUETA_ROL: Record<Rol, string> = {
  SA: "Administración",
  AD: "Administrador",
  OP: "Operación",
  VAL: "Validación de pagos",
  GU: "Guía / logística",
};

/** Ítems que el rol actual puede ver (los marcados `oculto` no aparecen). */
export function menuDelRol(rol: Rol | null): ItemMenu[] {
  if (!rol) return [];
  return MENU.filter(
    (item) => !item.oculto && (item.permiso === null || tienePermiso(rol, item.permiso)),
  );
}

/** ¿La ruta actual corresponde a este ítem del menú? */
export function esRutaActiva(rutaActual: string, ruta: string): boolean {
  if (ruta === "/admin") return rutaActual === "/admin" || rutaActual === "/admin/";
  return rutaActual === ruta || rutaActual.startsWith(`${ruta}/`);
}
