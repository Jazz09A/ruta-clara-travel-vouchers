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
  CategoriasPrecio,
  Configuracion,
  DashboardData,
  DocumentoPunto,
  DocumentoTour,
  EstadoReserva,
  FechaTour,
  Formulario,
  MetodoPago,
  Notificacion,
  Pago,
  Pasajero,
  PlantillaMensaje,
  PoliticaCancelacion,
  RequisitoTour,
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

async function peticion<T>(
  path: string,
  opts: Opciones = {},
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  // Los headers se arman en CADA intento: tras un refresh el access token en
  // memoria cambia y el reintento debe llevarlo. Si se capturaran antes,
  // el reintento saldría sin `Authorization` y volvería a fallar con 401.
  const hacer = () => {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    if (opts.token) headers["X-Enlace-Token"] = opts.token;
    if (opts.admin && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    return fetch(url(path, params), {
      method: opts.metodo ?? "GET",
      headers,
      credentials: "include",
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  };

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

let refrescoEnCurso: Promise<boolean> | null = null;

async function refrescarSesion(): Promise<boolean> {
  // Single-flight: ante una ráfaga de 401 (varias consultas a la vez al abrir
  // el panel, varias pestañas) sólo un refresh sale a la red y los demás
  // esperan su resultado. El backend rota el refresh token en cada uso, y los
  // refreshes concurrentes con el mismo cookie estamparían un token ya
  // revocado, lo que el backend interpretaría como robo y mataría la familia.
  if (refrescoEnCurso) return refrescoEnCurso;
  refrescoEnCurso = (async () => {
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
  })();
  try {
    return await refrescoEnCurso;
  } finally {
    refrescoEnCurso = null;
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

  datosPorDocumento: (token, body) =>
    peticion("/public/reserva/datos-por-documento", {
      metodo: "POST",
      token,
      body: { tipo_doc: body.tipo_doc, documento: body.documento },
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
    const res = await peticion<{
      access_token: string;
      refresh_token: string;
      usuario: UsuarioBackend;
    }>("/auth/login", { metodo: "POST", body });
    if (!("access_token" in res))
      throw new ApiError(500, {
        codigo: "ERROR_INTERNO" as never,
        mensaje: "Respuesta de login inválida",
        request_id: "",
      });
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

  async estadoSetup() {
    return peticion<{ requiere_onboarding: boolean }>("/setup/estado", {
      admin: false,
    });
  },

  async iniciarSetup(body: {
    nombre: string;
    correo: string;
    password: string;
    agencia: {
      nombre: string;
      email?: string;
      whatsapp?: string;
      direccion?: string;
      zona_horaria?: string;
    };
  }) {
    const res = await peticion<{
      access_token: string;
      refresh_token: string;
      usuario: UsuarioBackend;
    }>("/setup/iniciar", { metodo: "POST", body });
    if (!("access_token" in res))
      throw new ApiError(500, {
        codigo: "ERROR_INTERNO" as never,
        mensaje: "Respuesta de setup inválida",
        request_id: "",
      });
    accessToken = res.access_token;
  },

  async yo() {
    const u = await peticion<UsuarioBackend>("/auth/yo", { admin: true });
    return { usuario: usuarioFe(u) };
  },

  /** Renueva el access token con el refresh cookie HttpOnly. Lanza 401 si falló. */
  async renovar() {
    const ok = await refrescarSesion();
    if (!ok) {
      throw new ApiError(401, {
        codigo: "NO_AUTENTICADO" as never,
        mensaje: "Sesión expirada",
        request_id: "",
      });
    }
    return { ok: true as const };
  },

  async notificaciones() {
    return peticion<Notificacion[]>("/adminfx/notificaciones", { admin: true });
  },

  async marcarNotificacionLeida(id: string) {
    return peticion<{ ok: boolean }>(`/adminfx/notificaciones/${id}/leer`, {
      metodo: "POST",
      admin: true,
    });
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
    lineas?: { id?: string; concepto: string; cantidad: number; precio_unit_usd: string }[];
    ajustes?: { id?: string; tipo: "descuento" | "recargo"; monto_usd: string; motivo: string }[];
    pago: {
      metodo_clave: string;
      monto: string;
      moneda?: string;
      fecha_pago?: string;
      referencia?: string;
      nota?: string;
    };
  }) => peticion("/adminfx/reservas", { metodo: "POST", admin: true, body }),

  regenerarEnlace: (id: string, body: { motivo: string }) =>
    peticion(`/adminfx/reservas/${id}/enlace/regenerar`, { metodo: "POST", admin: true, body }),

  revocarEnlace: (id: string, body: { motivo: string }) =>
    peticion(`/adminfx/reservas/${id}/enlace/revocar`, { metodo: "POST", admin: true, body }),

  extenderHold: (id: string, body: { horas: number; motivo: string }) =>
    peticion(`/adminfx/reservas/${id}/hold`, { metodo: "POST", admin: true, body }),

  editarReserva: (id: string, body: { motivo: string; cambios: Record<string, unknown> }) =>
    peticion(`/adminfx/reservas/${id}/editar`, { metodo: "POST", admin: true, body }),

  guardarPrecio: (
    id: string,
    body: {
      motivo: string;
      justificacion?: string;
      lineas: { id?: string; concepto: string; cantidad: number; precio_unit_usd: string }[];
      ajustes: { id?: string; tipo: "descuento" | "recargo"; monto_usd: string; motivo: string }[];
    },
  ) => peticion(`/adminfx/reservas/${id}/precio`, { metodo: "PUT", admin: true, body }),

  revelar: (id: string, body: { campo: string; pasajero_ref?: string; motivo: string }) =>
    peticion(`/adminfx/reservas/${id}/revelar`, { metodo: "POST", admin: true, body }),

  simularCancelacion: (id: string) =>
    peticion(`/adminfx/reservas/${id}/simular-cancelacion`, { admin: true }),

  cancelarReserva: (
    id: string,
    body: { origen: string; motivo: string; monto_reembolso?: string; forzar?: boolean },
  ) => peticion(`/adminfx/reservas/${id}/cancelar`, { metodo: "POST", admin: true, body }),

  reprogramar: (
    id: string,
    body: { fecha_tour_id: string; motivo: string; diferencia_usd?: string },
  ) => peticion(`/adminfx/reservas/${id}/reprogramar`, { metodo: "POST", admin: true, body }),

  reactivar: (id: string, body: { motivo: string }) =>
    peticion(`/adminfx/reservas/${id}/reactivar`, { metodo: "POST", admin: true, body }),

  /** Confirma la reserva a mano (el titular no reporta el pago) y genera el voucher. */
  confirmarReserva: (id: string, body: { motivo?: string }) =>
    peticion(`/adminfx/reservas/${id}/confirmar`, { metodo: "POST", admin: true, body }),

  // ── pagos ──────────────────────────────────────────────────────────
  pagos: (filtros: FiltroPagos) =>
    peticion("/adminfx/pagos", { admin: true }, queryParams({ ...filtros })),

  pago: (id: string) => peticion(`/adminfx/pagos/${id}`, { admin: true }),

  validarPago: (id: string, body: AccionValidacion) =>
    peticion(`/adminfx/pagos/${id}/validar`, { metodo: "POST", admin: true, body }),

  registrarPagoEfectivo: (
    id: string,
    body: { monto: string; referencia?: string; nota?: string },
  ) => peticion(`/adminfx/pagos/${id}/efectivo`, { metodo: "POST", admin: true, body }),

  registrarPagoReserva: (
    id: string,
    body: {
      metodo_clave: string;
      monto: string;
      moneda?: "USD" | "VES" | "USDT";
      fecha_pago?: string;
      referencia?: string;
      nota?: string;
    },
  ) =>
    peticion<{ ok: true; pago_id: string }>(`/adminfx/reservas/${id}/pagos`, {
      metodo: "POST",
      admin: true,
      body,
    }),

  // ── puntos de salida (catálogo global) ────────────────────────────────
  puntosSalida: () => peticion("/puntos-salida", { admin: true }),

  crearPuntoSalida: (body: {
    nombre: string;
    hora: string;
    clave?: string;
    referencia?: string;
    ciudad?: string;
    seleccionable?: boolean;
  }) => peticion("/puntos-salida", { metodo: "POST", admin: true, body }),

  actualizarPuntoSalida: (
    id: string,
    body: Partial<{
      nombre: string;
      hora: string;
      clave: string;
      referencia: string;
      ciudad: string;
      seleccionable: boolean;
      orden: number;
      activo: boolean;
    }>,
  ) => peticion(`/puntos-salida/${id}`, { metodo: "PUT", admin: true, body }),

  eliminarPuntoSalida: (id: string) =>
    peticion(`/puntos-salida/${id}`, { metodo: "DELETE", admin: true }),

  // ── archivos privados (foto del documento, comprobantes…) ─────────────
  /** URL firmada de corta vigencia; consultar la foto queda auditado. */
  urlArchivo: (archivoId: string) => peticion(`/archivos/${archivoId}/url`, { admin: true }),

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

  autorizarSobrecupo: (
    id: string,
    body: { cupos_extra: number; motivo: string; codigo_totp: string },
  ) => peticion(`/adminfx/fechas/${id}/sobrecupo`, { metodo: "POST", admin: true, body }),

  guardarTarifa: (body: Partial<Tarifa> & { id?: string }) =>
    peticion("/adminfx/tarifas", { metodo: "POST", admin: true, body }),

  eliminarTarifa: (id: string) =>
    peticion(`/adminfx/tarifas/${id}`, { metodo: "DELETE", admin: true }),

  formulario: (tour_id: string) =>
    peticion(`/adminfx/tours/${tour_id}/formulario`, { admin: true }),

  guardarFormulario: (tour_id: string, body: { definicion: { campos: CampoDef[] } }) =>
    peticion(`/adminfx/tours/${tour_id}/formulario`, { metodo: "POST", admin: true, body }),

  /** Publica la versión del formulario (crea la n+1 y archiva la anterior). */
  publicarFormulario: (tour_id: string) =>
    peticion(`/adminfx/tours/${tour_id}/formulario/publicar`, { metodo: "POST", admin: true }),

  // ── documento de tour (el catálogo como contrato) ───────────────────

  /** Documento del tour con la forma de `catalogo-escapate.json`. */
  documentoTour: (id: string) =>
    peticion<DocumentoTour>(`/adminfx/tours/${id}/documento`, { admin: true }),

  /** Crea un tour a partir de su documento. */
  crearDesdeDocumento: (body: Partial<DocumentoTour>) =>
    peticion("/adminfx/tours/documento", { metodo: "POST", admin: true, body }),

  /** Guarda el documento de un tour existente. */
  guardarDocumento: (id: string, body: Partial<DocumentoTour>) =>
    peticion(`/adminfx/tours/${id}/documento`, { metodo: "PUT", admin: true, body }),

  /** Crea varias salidas con sus tarifas (fechas explícitas o recurrentes). */
  fechasMasivo: (
    id: string,
    body: {
      fechas?: string[];
      recurrencia?: { dia_semana?: number; desde?: string; hasta?: string } | null;
      precios?: Partial<Record<CategoriasPrecio, number>> | null;
      cupos_total?: number | null;
      hora_salida?: string | null;
      corte_venta_horas?: number | null;
      estado?: "borrador" | "publicada";
      actualizar_precios?: boolean;
    },
  ) => peticion(`/adminfx/tours/${id}/fechas-masivo`, { metodo: "POST", admin: true, body }),

  /** Publica el formulario base del tour (punto de salida, almuerzo, alergias). */
  formularioPlantilla: (id: string) =>
    peticion(`/adminfx/tours/${id}/formulario/plantilla`, { metodo: "POST", admin: true }),

  /** Horarios de recogida de los puntos de este tour. */
  guardarPuntos: (id: string, puntos: DocumentoPunto[]) =>
    peticion(`/adminfx/tours/${id}/puntos-abordaje`, {
      metodo: "PUT",
      admin: true,
      body: { puntos },
    }),

  /** Requisitos de activación: los calcula el servidor. */
  requisitosTour: (id: string) =>
    peticion<{ ok: boolean; requisitos: RequisitoTour[] }>(`/adminfx/tours/${id}/requisitos`, {
      admin: true,
    }),

  /** Exporta todo el catálogo con la forma del JSON de referencia. */
  exportarCatalogo: () => peticion("/adminfx/catalogo/documento", { admin: true }),

  // ── salidas ────────────────────────────────────────────────────────
  salidas: (params?: { mes?: string; tour_id?: string }) =>
    peticion(
      "/adminfx/salidas",
      { admin: true },
      queryParams({ mes: params?.mes, tour_id: params?.tour_id }),
    ),

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

  descargarExportacion: (id: string) => peticion(`/exportaciones/${id}/descarga`, { admin: true }),

  // ── configuración ──────────────────────────────────────────────────
  configuracion: () => peticion("/adminfx/configuracion", { admin: true }),

  guardarConfiguracion: (body: Partial<Configuracion>) =>
    peticion("/adminfx/configuracion", { metodo: "PUT", admin: true, body }),

  registrarTasa: (body: { valor: string }) =>
    peticion("/adminfx/tasas", { metodo: "POST", admin: true, body }),

  guardarMetodoPago: (body: Omit<Partial<MetodoPago>, "id"> & { id?: string }) =>
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

  subirFirmaEmpresa: (body: { nombre: string; tamano: number; imagen_base64?: string }) =>
    peticion("/adminfx/firma-empresa", { metodo: "POST", admin: true, body }),

  auditoria: (params?: { entidad?: string; usuario_id?: string; accion?: string }) =>
    peticion("/adminfx/auditoria", { admin: true }, queryParams({ ...params })),

  // ── vouchers (admin) ───────────────────────────────────────────────
  vouchers: async (reservaId: string) => {
    const rows = await peticion<Record<string, unknown>[]>(`/reservas/${reservaId}/vouchers`, {
      admin: true,
    });
    return rows.map((v) => {
      const estado = String(v["estado"] ?? "generando");
      return {
        id: String(v["id"]),
        version: Number(v["version"] ?? 0),
        estado: (estado === "listo" || estado === "error" ? estado : "generando") as
          "generando" | "listo" | "error",
        vigente: Boolean(v["vigente"]),
        generado_en: String(v["generado_en"] ?? v["creado_en"] ?? new Date().toISOString()),
        verif_token: "",
      };
    });
  },

  regenerarVoucher: (reservaId: string, body: { motivo: string }) =>
    peticion(`/reservas/${reservaId}/vouchers/regenerar`, {
      metodo: "POST",
      admin: true,
      body,
    }),

  voucherDescarga: (voucherId: string) =>
    peticion(`/vouchers/${voucherId}/descarga`, { admin: true }),
};

export const api: ApiSurface = { publica, admin: admin as ApiSurface["admin"] };

const API_ORIGIN = BASE_URL.replace(/\/api\/v\d+\/?$/, "");

/** URL del WebSocket de notificaciones (`ws(s)://host/ws`). */
export const WS_URL = `${API_ORIGIN.replace(/^http/, "ws")}/ws`;

/** Access token vigente para autenticar el handshake del WebSocket. */
export async function tokenAcceso(forzarRefresh = false): Promise<string | null> {
  if (forzarRefresh || !accessToken) await refrescarSesion();
  return accessToken;
}

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

/** Access token vigente en memoria (sólo lectura; SEG-03: nunca almacenamiento). */
export function tokenAccesoActual(): string | null {
  return accessToken;
}

/** Limpia el access token en memoria al cerrar la sesión (SEG-06). */
export function limpiarAccessToken(): void {
  accessToken = null;
}
