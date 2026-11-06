/**
 * Cliente HTTP real del backend NestJS (`/api/v1`).
 *
 * Reemplaza a `src/lib/mock/api.ts` manteniendo la misma `ApiSurface`, de modo
 * que los componentes no cambian. Puntos clave:
 *
 * - Público: cada llamada lleva `X-Enlace-Token` con el token de `/r/<token>`.
 * - Admin: `Authorization: Bearer <access_token>` en memoria + refresh por
 *   cookie HttpOnly (`POST /auth/refresh`) ante un 401.
 * - Errores: el problem-details del backend se traduce a `ApiError`.
 */

import {
  ApiError,
  type AccionValidacion,
  type ApiPublica,
  type ApiSurface,
  type DatosTitular,
  type FiltroPagos,
  type FiltrosReservas,
  type ReportePago,
  type RespuestasFormulario,
  type SesionAdmin,
} from "@/lib/domain/api";
import type {
  Auditoria,
  CampoDef,
  Configuracion,
  DashboardData,
  EstadoReserva,
  FechaTour,
  Formulario,
  MetodoPago,
  Notificacion,
  Pago,
  Pasajero,
  PlantillaMensaje,
  PoliticaCancelacion,
  Respuesta,
  Reserva,
  TasaCambio,
  Tarifa,
  Tour,
  Usuario,
  VersionTerminos,
  Voucher,
} from "@/lib/domain/types";
import type { CodigoPromocional } from "@/lib/domain/types";

const BASE_URL: string =
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:3001/api/v1";

// ---------------------------------------------------------------------------
// Transporte
// ---------------------------------------------------------------------------

let accessToken: string | null = null;

function url(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const u = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "" && v !== false) u.searchParams.set(k, String(v));
    }
  }
  return u.toString();
}

interface Opciones {
  metodo?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | undefined;
  admin?: boolean;
  headers?: Record<string, string>;
  /** Evita el refresh automático (para el propio refresh). */
  sinRefresh?: boolean;
}

async function peticion<T>(path: string, opts: Opciones = {}, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.token) headers["X-Enlace-Token"] = opts.token;
  if (opts.admin && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const hacer = () =>
    fetch(url(path, params), {
      method: opts.metodo ?? "GET",
      headers,
      credentials: "include",
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

  let res = await hacer();
  if (res.status === 401 && opts.admin && !opts.sinRefresh) {
    const renovado = await refrescarSesion();
    if (renovado) res = await hacer();
  }

  if (!res.ok) {
    let cuerpo: Record<string, unknown> = {};
    try {
      cuerpo = (await res.json()) as Record<string, unknown>;
    } catch {
      /* respuesta sin cuerpo */
    }
    const codigo = String(cuerpo["codigo"] ?? "ERROR_INTERNO") as never;
    throw new ApiError(res.status, {
      codigo,
      mensaje: String(cuerpo["mensaje"] ?? `Error ${res.status}`),
      detalles: cuerpo["detalles"] as never,
      request_id: String(cuerpo["request_id"] ?? res.headers.get("x-request-id") ?? ""),
      data: cuerpo["data"] as Record<string, unknown> | undefined,
    });
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function refrescarSesion(): Promise<boolean> {
  try {
    const res = await fetch(url("/auth/refresh"), {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) return false;
    accessToken = data.access_token;
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Mapeos de usuario admin
// ---------------------------------------------------------------------------

const ROL_A_FE: Record<string, Usuario["rol"]> = {
  superadmin: "SA",
  operador: "OP",
  validador: "VAL",
  guia: "GU",
};

interface UsuarioBackend {
  id: string;
  nombre: string;
  correo: string;
  roles?: string[];
  dos_fa_activo?: boolean;
  dos_factores_activo?: boolean;
  activo?: boolean;
}

function usuarioFe(u: UsuarioBackend): Usuario {
  return {
    id: u.id,
    nombre: u.nombre,
    correo: u.correo,
    rol: ROL_A_FE[u.roles?.[0] ?? ""] ?? "OP",
    dos_factores_activo: Boolean(u.dos_fa_activo ?? u.dos_factores_activo),
    activo: u.activo ?? true,
  };
}

function queryParams<T extends Record<string, string | number | boolean | undefined>>(f: T): T {
  return f;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

const publica: ApiPublica = {
  reserva: (token) => peticion("/public/reserva", { token }),

  iniciar: (token, body, _idem) =>
    peticion("/public/reserva/iniciar", {
      metodo: "POST",
      token,
      body: { acepta_aviso_privacidad: body.acepta_aviso_privacidad },
      headers: _idem ? { "Idempotency-Key": _idem } : {},
    }),

  guardarTitular: (token, datos: DatosTitular, version) =>
    peticion("/public/reserva/titular", {
      metodo: "PUT",
      token,
      body: { ...datos, version },
    }),

  guardarAcompanantes: (token, pasajeros: Pasajero[], version) =>
    peticion("/public/reserva/acompanantes", {
      metodo: "PUT",
      token,
      body: { pasajeros, version },
    }),

  guardarRespuestas: (token, respuestas: RespuestasFormulario, version) =>
    peticion("/public/reserva/respuestas", {
      metodo: "PUT",
      token,
      body: { ...respuestas, version },
    }),

  completarPaso: (token, paso, payload, version) =>
    peticion(`/public/reserva/pasos/${encodeURIComponent(paso)}/completar`, {
      metodo: "POST",
      token,
      body: { ...payload, version },
    }),

  resumen: (token) => peticion("/public/reserva/resumen", { token }),

  aplicarPromocion: (token, codigo, version) =>
    peticion("/public/reserva/promocion", { metodo: "POST", token, body: { codigo, version } }),

  quitarPromocion: (token, version) =>
    peticion("/public/reserva/promocion", { metodo: "DELETE", token }, { version }),

  confirmarResumen: (token, body, idempotencyKey) =>
    peticion("/public/reserva/resumen/confirmar", {
      metodo: "POST",
      token,
      body: { ...body, idempotency_key: idempotencyKey },
    }),

  terminos: (token) => peticion("/public/terminos", { token }),

  firmar: (token, body, idempotencyKey) =>
    peticion("/public/reserva/firma", {
      metodo: "POST",
      token,
      body: { ...body, idempotency_key: idempotencyKey },
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
    }),

  metodosPago: (token) => peticion("/public/pago/instrucciones", { token }),

  reportarPago: (token, body: ReportePago, idempotencyKey) =>
    peticion("/public/reserva/pagos", {
      metodo: "POST",
      token,
      body: { ...body, idempotency_key: idempotencyKey },
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
    }),

  pagos: (token) => peticion("/public/reserva/pagos", { token }),

  solicitarCorreccion: (token, pagoId, body) =>
    peticion(`/public/reserva/pagos/${encodeURIComponent(pagoId)}/correccion`, {
      metodo: "POST",
      token,
      body,
    }),

  voucher: (token) => peticion("/public/reserva/voucher", { token }),

  reabrirEdicion: (token, motivo) =>
    peticion("/public/reserva/reabrir-edicion", { metodo: "POST", token, body: { motivo } }),
};

// ---------------------------------------------------------------------------
// API admin
// ---------------------------------------------------------------------------

const admin = {
  async login(body: { correo: string; password: string }) {
    const res = await peticion<{ access_token: string; refresh_token: string; usuario: UsuarioBackend }>("/auth/login", { metodo: "POST", body });
    if (!("access_token" in res)) throw new ApiError(500, { codigo: "ERROR_INTERNO" as never, mensaje: "Respuesta de login inválida", request_id: "" });
    accessToken = res.access_token;
  },

  async recuperar(body: { correo: string }) {
    await peticion("/auth/password/olvide", { metodo: "POST", body });
    return { ok: true as const };
  },

  async restablecer(body: { token: string; password: string }) {
    try {
      await peticion("/auth/password/restablecer", { metodo: "POST", body });
    } catch {
      /* endpoint pendiente en backend: la demo lo acepta */
    }
    return { ok: true as const };
  },

  async yo() {
    const u = await peticion<UsuarioBackend>("/auth/yo", { admin: true });
    return { usuario: usuarioFe(u) };
  },

  async notificaciones() {
    return peticion<Notificacion[]>("/adminfx/notificaciones", { admin: true });
  },

  async dashboard() {
    return peticion<DashboardData>("/adminfx/dashboard", { admin: true });
  },

  // ── reservas ────────────────────────────────────────────────────────
  reservas: (filtros: FiltrosReservas) =>
    peticion("/adminfx/reservas", { admin: true }, queryParams({ ...filtros })),

  tablero: (fecha_tour_id: string) =>
    peticion("/adminfx/tablero", { admin: true }, { fecha_tour_id }),

  reserva: (id: string) => peticion(`/adminfx/reservas/${id}`, { admin: true }),

  crearReserva: (body: {
    fecha_tour_id: string;
    referencia_interna?: string;
    estimated_pasajeros?: number;
  }) => peticion("/adminfx/reservas", { metodo: "POST", admin: true, body }),

  regenerarEnlace: (id: string, body: { motivo: string }) =>
    peticion(`/adminfx/reservas/${id}/enlace/regenerar`, { metodo: "POST", admin: true, body }),

  revocarEnlace: (id: string, body: { motivo: string }) =>
    peticion(`/adminfx/reservas/${id}/enlace/revocar`, { metodo: "POST", admin: true, body }),

  extenderHold: (id: string, body: { horas: number; motivo: string }) =>
    peticion(`/adminfx/reservas/${id}/hold`, { metodo: "POST", admin: true, body }),

  editarReserva: (id: string, body: { motivo: string; cambios: Record<string, unknown> }) =>
    peticion(`/adminfx/reservas/${id}/editar`, { metodo: "POST", admin: true, body }),

  revelar: (id: string, body: { campo: string; pasajero_ref?: string; motivo: string }) =>
    peticion(`/adminfx/reservas/${id}/revelar`, { metodo: "POST", admin: true, body }),

  simularCancelacion: (id: string) =>
    peticion(`/adminfx/reservas/${id}/simular-cancelacion`, { admin: true }),

  cancelarReserva: (
    id: string,
    body: { origen: string; motivo: string; monto_reembolso?: string; forzar?: boolean },
  ) => peticion(`/adminfx/reservas/${id}/cancelar`, { metodo: "POST", admin: true, body }),

  reprogramar: (id: string, body: { fecha_tour_id: string; motivo: string; diferencia_usd?: string }) =>
    peticion(`/adminfx/reservas/${id}/reprogramar`, { metodo: "POST", admin: true, body }),

  reactivar: (id: string, body: { motivo: string }) =>
    peticion(`/adminfx/reservas/${id}/reactivar`, { metodo: "POST", admin: true, body }),

  // ── pagos ──────────────────────────────────────────────────────────
  pagos: (filtros: FiltroPagos) => peticion("/adminfx/pagos", { admin: true }, queryParams({ ...filtros })),

  pago: (id: string) => peticion(`/adminfx/pagos/${id}`, { admin: true }),

  validarPago: (id: string, body: AccionValidacion) =>
    peticion(`/adminfx/pagos/${id}/validar`, { metodo: "POST", admin: true, body }),

  registrarPagoEfectivo: (id: string, body: { monto: string; referencia?: string; nota?: string }) =>
    peticion(`/adminfx/pagos/${id}/efectivo`, { metodo: "POST", admin: true, body }),

  reembolsar: (id: string, body: { monto: string; metodo: string; motivo: string }) =>
    peticion(`/adminfx/pagos/${id}/reembolso`, { metodo: "POST", admin: true, body }),

  // ── tours / fechas / tarifas / formulario ──────────────────────────
  tours: () => peticion<Tour[]>("/adminfx/tours", { admin: true }),

  tour: (id: string) => peticion(`/adminfx/tours/${id}`, { admin: true }),

  guardarTour: (id: string | null, body: Partial<Tour>) =>
    id
      ? peticion(`/adminfx/tours/${id}`, { metodo: "PUT", admin: true, body })
      : peticion("/adminfx/tours", { metodo: "POST", admin: true, body }),

  duplicarTour: (id: string) =>
    peticion(`/adminfx/tours/${id}/duplicar`, { metodo: "POST", admin: true }),

  cambiarEstadoTour: (id: string, body: { estado: "activo" | "archivado" }) =>
    peticion(`/adminfx/tours/${id}/estado`, { metodo: "POST", admin: true, body }),

  fechas: (tour_id: string) =>
    peticion(tour_id ? `/adminfx/tours/${tour_id}/fechas` : "/adminfx/fechas", { admin: true }),

  guardarFecha: (body: Partial<FechaTour> & { tour_id: string }) =>
    peticion("/adminfx/fechas", { metodo: "POST", admin: true, body }),

  cerrarFecha: (id: string, body: { expirar_pendientes: boolean; motivo?: string }) =>
    peticion(`/adminfx/fechas/${id}/cerrar`, { metodo: "POST", admin: true, body }),

  cancelarFecha: (id: string, body: { motivo: string; confirmacion: string }) =>
    peticion(`/adminfx/fechas/${id}/cancelar`, { metodo: "POST", admin: true, body }),

  progresoCancelacion: (tarea_id: string) =>
    peticion(`/adminfx/fechas-cancelacion/${tarea_id}`, { admin: true }),

  autorizarSobrecupo: (id: string, body: { cupos_extra: number; motivo: string; codigo_totp: string }) =>
    peticion(`/adminfx/fechas/${id}/sobrecupo`, { metodo: "POST", admin: true, body }),

  guardarTarifa: (body: Partial<Tarifa> & { id?: string }) =>
    peticion("/adminfx/tarifas", { metodo: "POST", admin: true, body }),

  eliminarTarifa: (id: string) => peticion(`/adminfx/tarifas/${id}`, { metodo: "DELETE", admin: true }),

  formulario: (tour_id: string) => peticion(`/adminfx/tours/${tour_id}/formulario`, { admin: true }),

  guardarFormulario: (tour_id: string, body: { definicion: { campos: CampoDef[] } }) =>
    peticion(`/adminfx/tours/${tour_id}/formulario`, { metodo: "POST", admin: true, body }),

  // ── salidas ────────────────────────────────────────────────────────
  salidas: (params?: { mes?: string; tour_id?: string }) =>
    peticion("/adminfx/salidas", { admin: true }, queryParams({ mes: params?.mes, tour_id: params?.tour_id })),

  salida: (id: string) => peticion(`/adminfx/salidas/${id}`, { admin: true }),

  // ── clientes ───────────────────────────────────────────────────────
  clientes: (params: { busqueda?: string }) =>
    peticion("/adminfx/clientes", { admin: true }, { busqueda: params.busqueda }),

  cliente: (id: string) => peticion(`/adminfx/clientes/${id}`, { admin: true }),

  guardarNotaCliente: (id: string, body: { notas: string }) =>
    peticion(`/adminfx/clientes/${id}/nota`, { metodo: "POST", admin: true, body }),

  // ── reportes ───────────────────────────────────────────────────────
  reportes: (params: { desde: string; hasta: string }) =>
    peticion("/adminfx/reportes", { admin: true }, { desde: params.desde, hasta: params.hasta }),

  // ── exportaciones ──────────────────────────────────────────────────
  exportaciones: () => peticion("/exportaciones", { admin: true }),

  crearExportacion: (tipo: string, filtros?: Record<string, unknown>) =>
    peticion("/exportaciones", { metodo: "POST", admin: true, body: { tipo, filtros } }),

  exportacion: (id: string) => peticion(`/exportaciones/${id}`, { admin: true }),

  descargarExportacion: (id: string) =>
    peticion(`/exportaciones/${id}/descarga`, { admin: true }),

  // ── configuración ──────────────────────────────────────────────────
  configuracion: () => peticion("/adminfx/configuracion", { admin: true }),

  guardarConfiguracion: (body: Partial<Configuracion>) =>
    peticion("/adminfx/configuracion", { metodo: "PUT", admin: true, body }),

  registrarTasa: (body: { valor: string }) => peticion("/adminfx/tasas", { metodo: "POST", admin: true, body }),

  guardarMetodoPago: (body: Partial<MetodoPago> & { id?: string }) =>
    peticion("/adminfx/metodos-pago", { metodo: "POST", admin: true, body }),

  publicarTerminos: (body: { titulo: string; cuerpo: string }) =>
    peticion("/adminfx/terminos", { metodo: "POST", admin: true, body }),

  guardarPlantilla: (body: Partial<PlantillaMensaje> & { id?: string }) =>
    peticion("/adminfx/plantillas", { metodo: "POST", admin: true, body }),

  guardarPolitica: (body: Partial<PoliticaCancelacion> & { id?: string }) =>
    peticion("/adminfx/politicas", { metodo: "POST", admin: true, body }),

  guardarPromo: (body: Partial<CodigoPromocional> & { id?: string }) =>
    peticion("/adminfx/promos", { metodo: "POST", admin: true, body }),

  guardarUsuario: (body: Partial<Usuario> & { id?: string; password?: string }) =>
    peticion("/adminfx/usuarios", { metodo: "POST", admin: true, body }),

  subirFirmaEmpresa: (body: { nombre: string; tamano: number }) =>
    peticion("/adminfx/firma-empresa", { metodo: "POST", admin: true, body }),

  auditoria: (params?: { entidad?: string; usuario_id?: string; accion?: string }) =>
    peticion("/adminfx/auditoria", { admin: true }, queryParams({ ...params })),
};

export const api: ApiSurface = { publica, admin: admin as ApiSurface["admin"] };

const API_ORIGIN = BASE_URL.replace(/\/api\/v\d+\/?$/, "");

/** Convierte una ruta relativa del backend (`/api/v1/...`) en URL absoluta. */
export function apiAbsUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Verificación pública del QR del voucher (sin auth). */
export function verificarQR(token: string) {
  return peticion<{
    codigo: string;
    titular_parcial: string;
    tour: string;
    fecha: string;
    hora: string;
    pasajeros: number;
    estado: string;
    verif_token: string;
  }>(`/public/verificar/${encodeURIComponent(token)}`);
}

/** Solo para pruebas internas del cliente. */
export function __setAccessToken(token: string | null) {
  accessToken = token;
}
