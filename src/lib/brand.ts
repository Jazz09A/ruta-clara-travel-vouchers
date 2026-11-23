/**
 * Identidad de la agencia — configuración de marca compartida por ambas apps.
 */

export const MARCA = {
  nombre: "Escapate Tours",
  nombreCompleto: "Escapate Tours",
  eslogan: "Full Days y Fines de Semana",
  whatsapp: "+584121234567",
  email: "hola@escapetour.app",
  direccion: "Av. Libertador, Caracas",
  zonaHoraria: "America/Caracas",
} as const;

/** Etiquetas de las etapas del flujo público (Spec 4.2). Sin paso de pago. */
export const ETAPAS_RESERVA = [
  { id: "titular", label: "Titular", corto: "Titular" },
  { id: "acompanantes", label: "Acompañantes", corto: "Grupo" },
  { id: "preguntas", label: "Preguntas", corto: "Preguntas" },
  { id: "resumen", label: "Resumen", corto: "Resumen" },
  { id: "firma", label: "Firma", corto: "Firma" },
] as const;

export type EtapaId = (typeof ETAPAS_RESERVA)[number]["id"];

/** Destinos de las acciones principales del panel. */
export const RUTAS_ADMIN = {
  dashboard: "/admin",
  reservas: "/admin/reservas",
  nuevaReserva: "/admin/reservas/nueva",
  pagos: "/admin/pagos",
  salidas: "/admin/salidas",
  tours: "/admin/tours",
  clientes: "/admin/clientes",
  reportes: "/admin/reportes",
  configuracion: "/admin/configuracion",
  auditoria: "/admin/auditoria",
} as const;
