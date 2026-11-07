import type {
  ApiErrorBody,
  Auditoria,
  CampoDef,
  Categoria,
  CodigoError,
  Configuracion,
  DashboardData,
  DetalleError,
  EstadoReserva,
  Exportacion,
  FechaTour,
  Formulario,
  MetodoPago,
  MotivoCierre,
  Notificacion,
  Pago,
  Pasajero,
  PoliticaCancelacion,
  Progreso,
  Reserva,
  ResumenReserva,
  Respuesta,
  Rol,
  Tarifa,
  TarifaPublica,
  TasaCambio,
  Tour,
  TipoExportacion,
  Usuario,
  VersionTerminos,
  Voucher,
  CodigoPromocional,
  PlantillaMensaje,
} from "./types";

/**
 * Contrato de la API simulada.
 *
 * En producción esto lo implementa el cliente HTTP generado desde el OpenAPI.
 * En la demo local lo implementa `src/lib/mock/api.ts` como un backend en
 * memoria con las mismas reglas (autoridad del servidor, §4.2 del Spec).
 */

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  readonly codigo: CodigoError;
  readonly status: number;
  readonly detalles: DetalleError[] | undefined;
  readonly requestId: string;
  readonly data: Record<string, unknown> | undefined;

  constructor(status: number, body: ApiErrorBody) {
    super(body.mensaje);
    this.name = "ApiError";
    this.status = status;
    this.codigo = body.codigo;
    this.detalles = body.detalles;
    this.requestId = body.request_id;
    this.data = body.data;
  }

  /** Errores de validación por campo (422). */
  get esValidacion(): boolean {
    return this.codigo === "VALIDACION";
  }

  /** El mensaje del servidor ya viene en español apto para mostrar (Spec §11). */
  get mensajeMostrable(): string {
    return this.message;
  }
}

export function esApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export interface DatosTitular {
  nombre: string;
  tipo_doc: "V" | "E" | "P" | "OTRO";
  documento: string;
  fecha_nacimiento: string;
  telefono: string;
  correo: string;
  contacto_emergencia_nombre: string;
  contacto_emergencia_telefono: string;
}

export interface RespuestasFormulario {
  por_pasajero: Record<string, Record<string, Respuesta>>;
  globales: Record<string, Respuesta>;
}

export interface ResultadoIniciar {
  reserva_id: string;
  ya_iniciada: boolean;
}

export interface ResultadoFirma {
  ok: true;
  hash_imagen: string;
  firmada_en: string;
  /** Versión de la reserva tras firmar (fuente de verdad del servidor). */
  version: number;
}

export interface ResultadoConfirmar {
  total_usd: string;
  expira_en: string | null;
  /** Versión de la reserva tras confirmar (fuente de verdad del servidor). */
  version: number;
}

export interface ReportePago {
  metodo: string;
  monto: string;
  moneda: "USD" | "VES";
  fecha_pago: string;
  referencia: string;
  comprobante_nombre?: string | undefined;
  comprobante_tipo?: string | undefined;
  comprobante_tamano?: number | undefined;
  comprobante_preview?: string | undefined;
  campos_extra?: Record<string, string> | undefined;
  tasa_id_vista?: string | undefined;
}

export interface ResultadoVoucher {
  estado: "generando" | "listo" | "error";
  url_descarga?: string | undefined;
  version?: number | undefined;
}

export interface VerificacionQR {
  codigo: string;
  titular_parcial: string;
  tour: string;
  fecha: string;
  hora: string;
  pasajeros: number;
  estado: EstadoReserva;
  verif_token: string;
}

// ---------------------------------------------------------------------------
// API pública (cliente sin cuenta)
// ---------------------------------------------------------------------------

export interface ContextoReservaPublica {
  reserva: Reserva;
  progreso: Progreso;
  /** Tour de la salida, para las pantallas de bienvenida y resumen. */
  tour?: Tour;
  fecha?: FechaTour;
  /** Tarifas por categoría sin precio: el cliente solo ve rangos de edad. */
  tarifas?: TarifaPublica[];
  politica_cancelacion?: PoliticaCancelacion;
  config?: Configuracion;
  /** Snapshot del formulario fijado a esta reserva, sin campos `extra`. */
  formulario?: Formulario;
  /** Opciones agotadas: `"campoId:valor" -> true`. */
  opciones_agotadas?: Record<string, boolean>;
}

export interface ApiPublica {
  /** Arranque: resuelve el estado y decide la pantalla. */
  reserva(token: string): Promise<ContextoReservaPublica>;
  iniciar(
    token: string,
    body: { acepta_aviso_privacidad: boolean },
    idempotencyKey: string,
  ): Promise<ResultadoIniciar>;
  guardarTitular(token: string, datos: DatosTitular, version: number): Promise<{ version: number }>;
  guardarAcompanantes(
    token: string,
    pasajeros: Pasajero[],
    version: number,
  ): Promise<{ version: number; pasajeros: Pasajero[] }>;
  guardarRespuestas(
    token: string,
    respuestas: RespuestasFormulario,
    version: number,
  ): Promise<{ version: number }>;
  completarPaso(
    token: string,
    paso: string,
    payload: Record<string, unknown>,
    version: number,
  ): Promise<{ version: number; paso_actual: string; progreso: Progreso }>;
  resumen(token: string): Promise<ResumenReserva>;
  confirmarResumen(
    token: string,
    body: { total_visto_usd: string; version: number; acepta_politica: boolean },
    idempotencyKey: string,
  ): Promise<ResultadoConfirmar>;
  terminos(token: string): Promise<VersionTerminos>;
  firmar(
    token: string,
    body: {
      firma_png_base64: string;
      n_trazos: number;
      longitud_px: number;
      duracion_ms: number;
      scroll_completo: boolean;
      version_terminos_id: string;
    },
    idempotencyKey: string,
  ): Promise<ResultadoFirma>;
  metodosPago(token: string): Promise<{ metodos: MetodoPago[]; tasa_vigente: TasaCambio | null }>;
  reportarPago(
    token: string,
    body: ReportePago,
    idempotencyKey: string,
  ): Promise<{ pago_id: string }>;
  pagos(token: string): Promise<Pago[]>;
  solicitarCorreccion(
    token: string,
    pagoId: string,
    body: {
      referencia?: string;
      monto?: string;
      comprobante?: { nombre: string; tipo: string; tamano: number; preview?: string };
    },
  ): Promise<{ ok: true }>;
  voucher(token: string): Promise<ResultadoVoucher>;
  reabrirEdicion(token: string, motivo: string): Promise<{ version: number }>;
}

// ---------------------------------------------------------------------------
// API admin
// ---------------------------------------------------------------------------

export interface SesionAdmin {
  token: string;
  usuario: Usuario;
}

export interface FiltrosReservas {
  tour_id?: string | undefined;
  fecha_tour_id?: string | undefined;
  estado?: EstadoReserva | undefined;
  estado_pago?: string | undefined;
  requiere_accion?: boolean | undefined;
  por_expirar?: boolean | undefined;
  con_pago_por_validar?: boolean | undefined;
  busqueda?: string | undefined;
  cursor?: string | undefined;
  limite?: number | undefined;
}

export interface Pagina<T> {
  items: T[];
  next_cursor: string | null;
  total: number;
}

export interface FiltroPagos {
  estado?: string | undefined;
  busqueda?: string | undefined;
  /** Limita a los pagos de una reserva (A-09: historial de la reserva). */
  reserva_id?: string | undefined;
  cursor?: string | undefined;
  limite?: number | undefined;
}

export interface AccionValidacion {
  accion: "aprobar" | "rechazar" | "solicitar_correccion" | "anular";
  monto_validado?: string | undefined;
  motivo?: string | undefined;
  motivo_catalogo?: string | undefined;
  texto_cliente?: string | undefined;
  confirmar_duplicado?: boolean | undefined;
  idempotencyKey: string;
}

export interface ReservaAdmin extends Reserva {
  tour: Tour;
  fecha: FechaTour;
  pagos: Pago[];
  terminos: VersionTerminos | null;
  auditoria: Auditoria[];
}

export interface ApiAdmin {
  login(body: { correo: string; password: string }): Promise<void>;
  /** Renueva el access token con el refresh cookie; lanza 401 si la sesión ya no existe. */
  renovar(): Promise<{ ok: true }>;
  recuperar(body: { correo: string }): Promise<{ ok: true }>;
  restablecer(body: { token: string; password: string }): Promise<{ ok: true }>;
  yo(): Promise<{ usuario: Usuario }>;
  notificaciones(): Promise<Notificacion[]>;
  marcarNotificacionLeida(id: string): Promise<{ ok: boolean }>;

  dashboard(): Promise<DashboardData>;

  reservas(filtros: FiltrosReservas): Promise<Pagina<Reserva>>;
  tablero(
    fecha_tour_id: string,
  ): Promise<{ columnas: { estado: EstadoReserva; total: number; reservas: Reserva[] }[] }>;
  reserva(id: string): Promise<ReservaAdmin>;
  crearReserva(body: {
    fecha_tour_id: string;
    referencia_interna?: string | undefined;
    estimated_pasajeros?: number | undefined;
  }): Promise<{
    reserva: Reserva;
    enlace: string;
    advertencias: { codigo: string; mensaje: string }[];
  }>;
  regenerarEnlace(id: string, body: { motivo: string }): Promise<{ enlace: string }>;
  revocarEnlace(id: string, body: { motivo: string }): Promise<{ ok: true }>;
  extenderHold(id: string, body: { horas: number; motivo: string }): Promise<{ expira_en: string }>;
  editarReserva(
    id: string,
    body: { motivo: string; cambios: Partial<Record<string, unknown>> },
  ): Promise<{ ok: true; requiere_ajuste?: boolean }>;
  /** Precio administrado: líneas extra (toldos) y ajustes manuales con motivo. */
  guardarPrecio(
    id: string,
    body: {
      motivo: string;
      lineas: { id?: string; concepto: string; cantidad: number; precio_unit_usd: string }[];
      ajustes: { id?: string; tipo: "descuento" | "recargo"; monto_usd: string; motivo: string }[];
    },
  ): Promise<{
    ok: true;
    total_usd: string;
    saldo_usd: string;
    advertencia?: string | undefined;
    advertencias?: string[] | undefined;
  }>;
  revelar(
    id: string,
    body: { campo: string; pasajero_ref?: string; motivo: string },
  ): Promise<{ valor: string }>;
  simularCancelacion(id: string): Promise<{
    dias_para_salida: number;
    tramo: { porcentaje: number; descripcion: string };
    monto_sugerido: string;
  }>;
  cancelarReserva(
    id: string,
    body: { origen: MotivoCierre; motivo: string; monto_reembolso?: string; forzar?: boolean },
  ): Promise<{ ok: true }>;
  reprogramar(
    id: string,
    body: { fecha_tour_id: string; motivo: string; diferencia_usd?: string },
  ): Promise<{ ok: true; diferencia_usd?: string }>;
  reactivar(id: string, body: { motivo: string }): Promise<{ ok: true }>;

  pagos(filtros: FiltroPagos): Promise<Pagina<Pago & { reserva: Reserva }>>;
  pago(id: string): Promise<Pago & { reserva: Reserva; comprobante_url?: string }>;
  validarPago(id: string, body: AccionValidacion): Promise<{ ok: true; saldo_usd: string }>;
  registrarPagoEfectivo(
    id: string,
    body: { monto: string; referencia?: string; nota?: string },
  ): Promise<{ ok: true }>;
  reembolsar(
    id: string,
    body: { monto: string; metodo: string; motivo: string },
  ): Promise<{ ok: true }>;

  tours(): Promise<Tour[]>;
  tour(id: string): Promise<{
    tour: Tour;
    fechas: FechaTour[];
    tarifas: Tarifa[];
    formulario?: Formulario | null;
    form_versiones?: Formulario[];
  }>;
  guardarTour(id: string | null, body: Partial<Tour>): Promise<Tour>;
  duplicarTour(id: string): Promise<Tour>;
  cambiarEstadoTour(
    id: string,
    body: { estado: "activo" | "archivado" },
  ): Promise<{
    ok: boolean;
    bloqueos: string[];
  }>;

  fechas(tour_id: string): Promise<FechaTour[]>;
  guardarFecha(body: Partial<FechaTour> & { tour_id: string }): Promise<FechaTour>;
  cerrarFecha(
    id: string,
    body: { expirar_pendientes: boolean; motivo?: string },
  ): Promise<{ ok: true }>;
  cancelarFecha(
    id: string,
    body: { motivo: string; confirmacion: string },
  ): Promise<{ tarea_id: string }>;
  progresoCancelacion(tarea_id: string): Promise<{ estado: string; porcentaje: number }>;
  autorizarSobrecupo(
    id: string,
    body: { cupos_extra: number; motivo: string; codigo_totp: string },
  ): Promise<{ ok: true }>;
  guardarTarifa(body: Partial<Tarifa> & { id?: string }): Promise<Tarifa>;
  eliminarTarifa(id: string): Promise<{ ok: true }>;

  formulario(tour_id: string): Promise<{ formulario: Formulario | null }>;
  guardarFormulario(
    tour_id: string,
    body: { definicion: { campos: CampoDef[] } },
  ): Promise<{
    errores: { campo: string; mensaje: string; nivel: "bloqueante" | "advertencia" }[];
  }>;

  salidas(params?: { mes?: string; tour_id?: string }): Promise<
    {
      fecha_tour_id: string;
      tour: string;
      fecha: string;
      hora: string;
      estado: string;
      vendidos: number;
      retenidos: number;
      total: number;
      alertas: string[];
    }[]
  >;
  salida(id: string): Promise<{
    fecha: FechaTour;
    tour: Tour;
    tarifas: Tarifa[];
    reservas_por_estado: { estado: EstadoReserva; total: number }[];
    opciones: {
      opcion: string;
      campo_id: string;
      cantidad: number;
      agotados: number;
      cupo: number;
    }[];
    manifest: Reserva[];
  }>;

  clientes(params: { busqueda?: string }): Promise<{
    items: {
      id: string;
      nombre: string;
      documento_enmascarado: string;
      telefono: string;
      correo?: string;
      reservas: number;
      ultima_reserva?: string | null;
      notas?: string;
    }[];
  }>;
  cliente(id: string): Promise<{
    id: string;
    nombre: string;
    tipo_doc: string;
    documento_enmascarado: string;
    telefono: string;
    correo: string;
    notas: string;
    reservas: Reserva[];
    viajes: {
      total: number;
      confirmadas: number;
      canceladas: number;
      tours: { tour_id: string; tour: string; veces: number }[];
      primera_fecha: string | null;
      ultima_fecha: string | null;
    };
  }>;
  guardarNotaCliente(id: string, body: { notas: string }): Promise<{ ok: true }>;

  vouchers(reservaId: string): Promise<Voucher[]>;
  regenerarVoucher(reservaId: string, body: { motivo: string }): Promise<Voucher>;
  voucherDescarga(voucherId: string): Promise<{ url: string; expira_en: string }>;

  reportes(params: { desde: string; hasta: string }): Promise<{
    ventas_por_tour: { tour: string; total_usd: string; reservas: number }[];
    ventas_por_metodo: { metodo: string; total_usd: string; pagos: number }[];
    pagos_pendientes: { total_usd: string; pagos: number };
    reembolsos: { total_usd: string; count: number };
    ocupacion: { fecha: string; tour: string; vendidos: number; total: number; pct: number }[];
  }>;

  exportaciones(): Promise<Exportacion[]>;
  crearExportacion(tipo: TipoExportacion, filtros?: Record<string, unknown>): Promise<Exportacion>;
  exportacion(id: string): Promise<Exportacion>;
  descargarExportacion(id: string): Promise<{ url: string; expira_en: string }>;

  configuracion(): Promise<{
    config: Configuracion;
    tasa: TasaCambio[];
    metodos: MetodoPago[];
    terminos: VersionTerminos[];
    politicas: PoliticaCancelacion[];
    plantillas: PlantillaMensaje[];
    promos: CodigoPromocional[];
    usuarios: Usuario[];
  }>;
  guardarConfiguracion(body: Partial<Configuracion>): Promise<Configuracion>;
  registrarTasa(body: { valor: string }): Promise<TasaCambio>;
  guardarMetodoPago(body: Partial<MetodoPago> & { id?: string }): Promise<MetodoPago>;
  publicarTerminos(body: { titulo: string; cuerpo: string }): Promise<VersionTerminos>;
  guardarPlantilla(body: Partial<PlantillaMensaje> & { id?: string }): Promise<PlantillaMensaje>;
  guardarPolitica(
    body: Partial<PoliticaCancelacion> & { id?: string },
  ): Promise<PoliticaCancelacion>;
  guardarPromo(body: Partial<CodigoPromocional> & { id?: string }): Promise<CodigoPromocional>;
  guardarUsuario(body: Partial<Usuario> & { id?: string }): Promise<Usuario>;
  subirFirmaEmpresa(body: {
    nombre: string;
    tamano: number;
    /** PNG en base64 (con o sin prefijo `data:`); de la subida de archivo o del lienzo. */
    imagen_base64?: string;
  }): Promise<{ ok: true; fecha: string; archivo_id?: string | null }>;

  auditoria(params?: {
    entidad?: string;
    usuario_id?: string;
    accion?: string;
  }): Promise<Auditoria[]>;
}

// ---------------------------------------------------------------------------
// Superficie completa
// ---------------------------------------------------------------------------

export interface ApiSurface {
  publica: ApiPublica;
  admin: ApiAdmin;
}

export type { Categoria, Rol };
