/**
 * Contratos de dominio — Escapate Tours CRM
 *
 * These types are the single source of truth shared by the mock "backend"
 * (src/lib/mock) and both apps (publica + admin). They intentionally mirror the
 * shape described in the PRD v2.0 and the Frontend Spec, so that replacing the
 * mock with a real API later only requires re-implementing `src/lib/mock/api.ts`.
 */

// ---------------------------------------------------------------------------
// Roles y permisos
// ---------------------------------------------------------------------------

export type Rol = "SA" | "AD" | "OP" | "VAL" | "GU";

export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  /** 2FA desactivado del flujo actual; el campo se conserva por compatibilidad. */
  dos_factores_activo?: boolean;
  activo: boolean;
}

export type Permiso =
  | "reservas.ver"
  | "reservas.crear"
  | "reservas.editar"
  | "reservas.cancelar"
  | "reservas.revelar"
  | "reservas.reprogramar"
  | "pagos.ver"
  | "pagos.validar"
  | "pagos.registrar"
  | "pagos.reembolsar"
  | "salidas.ver"
  | "salidas.editar"
  | "salidas.manifiesto"
  | "tours.ver"
  | "tours.editar"
  | "formularios.editar"
  | "clientes.ver"
  | "clientes.exportar"
  | "clientes.anonimizar"
  | "reportes.ver"
  | "reportes.exportar"
  | "config.ver"
  | "config.editar"
  | "auditoria.ver";

export const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  SA: [
    "reservas.ver",
    "reservas.crear",
    "reservas.editar",
    "reservas.cancelar",
    "reservas.revelar",
    "reservas.reprogramar",
    "pagos.ver",
    "pagos.validar",
    "pagos.registrar",
    "pagos.reembolsar",
    "salidas.ver",
    "salidas.editar",
    "salidas.manifiesto",
    "tours.ver",
    "tours.editar",
    "formularios.editar",
    "clientes.ver",
    "clientes.exportar",
    "clientes.anonimizar",
    "reportes.ver",
    "reportes.exportar",
    "config.ver",
    "config.editar",
    "auditoria.ver",
  ],
  AD: [
    "reservas.ver",
    "reservas.crear",
    "reservas.editar",
    "reservas.cancelar",
    "reservas.revelar",
    "reservas.reprogramar",
    "pagos.ver",
    "pagos.validar",
    "pagos.registrar",
    "pagos.reembolsar",
    "salidas.ver",
    "salidas.editar",
    "salidas.manifiesto",
    "tours.ver",
    "tours.editar",
    "formularios.editar",
    "clientes.ver",
    "clientes.exportar",
    "clientes.anonimizar",
    "reportes.ver",
    "reportes.exportar",
    "config.ver",
    "config.editar",
  ],
  OP: [
    "reservas.ver",
    "reservas.crear",
    "reservas.editar",
    "reservas.revelar",
    "pagos.ver",
    "pagos.registrar",
    "salidas.ver",
    "salidas.manifiesto",
    "tours.ver",
    "clientes.ver",
    "reportes.ver",
  ],
  VAL: [
    "reservas.ver",
    "pagos.ver",
    "pagos.validar",
    "salidas.ver",
    "salidas.manifiesto",
    "tours.ver",
  ],
  GU: ["reservas.ver", "salidas.ver", "salidas.manifiesto", "tours.ver", "clientes.ver"],
};

export function tienePermiso(rol: Rol, permiso: Permiso): boolean {
  return PERMISOS_POR_ROL[rol].includes(permiso);
}

// ---------------------------------------------------------------------------
// Catálogo: tours, fechas, tarifas
// ---------------------------------------------------------------------------

export type TipoTour = "full_day" | "fin_de_semana" | "multi_dia";
export type EstadoTour = "borrador" | "activo" | "archivado";

export interface BloqueItinerario {
  hora: string;
  titulo: string;
  detalle: string;
}

export interface PuntoAbordaje {
  id: string;
  /** Clave del catálogo global de puntos (`guatire_castillejo`…). */
  clave?: string;
  nombre: string;
  hora: string;
  referencia_ubicacion?: string | undefined;
  mapa_url?: string | undefined;
  /** `true` = la hora se confirma después (Caracas: «punto por confirmar»). */
  confirmar_hora?: boolean | undefined;
}

/**
 * Punto de salida del catálogo global (Guatire, Guarenas, Caracas…).
 * Compartido por todos los tours y administrable desde Configuración.
 */
export interface PuntoSalida {
  id: string;
  clave: string;
  nombre: string;
  /** Hora estimada de recogida (HH:MM). */
  hora: string;
  referencia?: string | null;
  /** Ciudad del punto (Guatire, Guarenas, Caracas…). */
  ciudad?: string | null;
  /**
   * `false` = sólo se muestra como referencia en el formulario (los puntos
   * de Caracas se confirman después por el grupo de viaje / WhatsApp):
   * no puede elegirlo el cliente.
   */
  seleccionable?: boolean;
  orden: number;
  activo: boolean;
}

/** Grupo de puntos de referencia (no elegibles) agrupados por ciudad. */
export interface PuntoReferencia {
  ciudad: string;
  puntos: { clave: string; nombre: string; hora: string; referencia?: string | null }[];
}

export interface Tour {
  id: string;
  nombre: string;
  /** Clave estable del catálogo (slug). */
  clave?: string;
  tipo: TipoTour;
  /** Región o destino (Higuerote, Chuspa, Mérida…). */
  familia?: string;
  /** Duración del viaje en días y noches. */
  duracion_dias?: number | null;
  duracion_noches?: number | null;
  /** Hora de salida del tour (las salidas la heredan). */
  hora_salida?: string;
  /** Cupos que ofrece el tour por salida. */
  cupos?: number | null;
  /** Monto de la reserva por persona que fija el catálogo. */
  reserva_usd?: number | null;
  /** Avisos internos del catálogo (no se muestran al cliente). */
  notas?: string[];
  descripcion: string;
  itinerario: BloqueItinerario[];
  incluye: string[];
  no_incluye: string[];
  imagenes: string[];
  puntos_abordaje: PuntoAbordaje[];
  estado: EstadoTour;
  politica_cancelacion_id: string;
  terminos_version_id: string;
  formulario_id: string;
  fecha_creacion: string;
}

// ---------------------------------------------------------------------------
// Documento de tour: el catálogo como contrato
// ---------------------------------------------------------------------------

export interface DocumentoPunto {
  clave: string;
  /** Hora de recogida **de este tour**. */
  hora: string;
  /** `true` = la hora se confirma después (Caracas). */
  confirmar_hora?: boolean;
}

export interface DocumentoItinerario {
  /** Opcional: el catálogo transcribe la hora dentro del `detalle`. */
  hora?: string;
  titulo: string;
  detalle: string;
}

export type CategoriasPrecio = "adulto" | "nino" | "tercera_edad" | "infante";

/** Documento con la misma forma que `catalogo-escapate.json`. */
export interface DocumentoTour {
  clave: string;
  nombre: string;
  tipo: TipoTour;
  duracion?: { dias?: number | null; noches?: number | null };
  familia?: string | null;
  /** Clave de la política de cancelación (Configuración). */
  politica?: string | null;
  /** Clave de la plantilla de términos (Configuración). */
  terminos?: string | null;
  hora_salida?: string | null;
  reserva_usd?: number | null;
  cupos?: number | null;
  descripcion?: string | null;
  puntos: DocumentoPunto[];
  precios: Partial<Record<CategoriasPrecio, number>>;
  fechas: string[];
  incluye: string[];
  no_incluye: string[];
  itinerario: DocumentoItinerario[];
  notas: string[];
}

/** Requisito de activación de un tour (lo calcula el servidor). */
export interface RequisitoTour {
  clave: string;
  titulo: string;
  detalle: string;
  ok: boolean;
}

export type EstadoFecha = "borrador" | "publicada" | "cerrada" | "cancelada";

export interface CupoOpcion {
  campo_id: string;
  opcion: string;
  cupo: number;
  agotados: number;
}

export interface FechaTour {
  id: string;
  tour_id: string;
  fecha_salida: string; // YYYY-MM-DD
  hora_salida: string; // HH:mm (24h)
  cupos_total: number;
  cupos_retenidos: number;
  cupos_vendidos: number;
  estado: EstadoFecha;
  corte_venta_horas: number;
  motivo_cierre?: string | undefined;
  opciones_cupo: CupoOpcion[];
  sobrecupo_autorizado?: boolean | undefined;
}

export type Categoria = "Adulto" | "Niño" | "Tercera Edad" | "Infante";

export interface Tarifa {
  id: string;
  fecha_tour_id: string;
  categoria: Categoria;
  edad_min: number;
  edad_max: number;
  precio_usd: string;
}

/** Tarifa tal como la ve el cliente: sin precio (el total lo fija la agencia). */
export type TarifaPublica = Omit<Tarifa, "precio_usd">;

// ---------------------------------------------------------------------------
// Motor de formularios dinámicos
// ---------------------------------------------------------------------------

export type TipoCampo =
  "text" | "textarea" | "select" | "multiselect" | "checkbox" | "number" | "date" | "extra";

export type AlcanceCampo = "por_pasajero" | "por_reserva";

export interface OpcionCampo {
  valor: string;
  label: string;
  /** Cupo propio opcional (RF-3.5). El cliente solo ve "Agotado". */
  cupo?: number | undefined;
  agotada?: boolean | undefined;
  /** Precio adicional en USD cuando el campo es de tipo `extra`. */
  extra_usd?: string | undefined;
}

export interface Condicion {
  campo: string;
  igual_a?: unknown | undefined;
  en?: unknown[] | undefined;
  distinto_de?: unknown | undefined;
  no_vacio?: boolean | undefined;
}

export interface CampoDef {
  id: string;
  label: string;
  ayuda?: string | undefined;
  tipo: TipoCampo;
  alcance: AlcanceCampo;
  obligatorio: boolean;
  valor_defecto?: unknown | undefined;
  /** Vacío = aplica a todas las categorías. */
  aplica_a?: Categoria[] | undefined;
  visible_si?: Condicion | undefined;
  opciones?: OpcionCampo[] | undefined;
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  max_length?: number | undefined;
  /** Solo para tipo `extra`. */
  precio_usd?: string | undefined;
  cantidad_max?: number | undefined;
  unidad?: string | undefined;
  /** Permite bajar el campo a nivel de pasajero aunque sea `por_reserva`. */
  permite_por_pasajero?: boolean | undefined;
  /** Marca de origen para opciones dinámicas: `puntos_salida` usa el catálogo global. */
  fuente?: string | undefined;
  /**
   * Puntos del catálogo que NO se pueden elegir (p. ej. los de Caracas),
   * agrupados por ciudad y mostrados sólo como referencia en el formulario.
   */
  puntos_referencia?: PuntoReferencia[] | undefined;
  /** Agrupación funcional; `comida` se oculta con el flag global de comidas. */
  grupo?: "comida" | undefined;
}

export interface FormDefinicion {
  campos: CampoDef[];
}

export interface Formulario {
  id: string;
  tour_id: string;
  /** Número de versión (1, 2, 3…). */
  version?: number;
  /** Estado de la versión en el servidor. */
  estado?: "borrador" | "publicada" | "archivada";
  definicion: FormDefinicion;
  actualizado_en: string;
  publicada_en?: string | null;
  autor?: string | null;
  hash?: string;
}

// ---------------------------------------------------------------------------
// Reserva
// ---------------------------------------------------------------------------

export type EstadoReserva =
  | "enlace_creado"
  | "en_registro"
  | "pendiente_firma"
  | "pendiente_pago"
  | "pago_en_verificacion"
  | "confirmada"
  | "completada"
  | "cancelada"
  | "expirada";

export type EstadoPago =
  "sin_pago" | "reportado" | "parcial" | "pagado" | "rechazado" | "reembolsado";

export type PasoActual =
  | "paso_registro"
  | "titular"
  | "acompanantes"
  | "preguntas"
  | "resumen"
  | "terminos"
  | "firma"
  | "confirmada"
  | "cerrada";

export type TipoDocumento = "V" | "E" | "P" | "OTRO";

export type Respuesta = string | number | boolean | string[] | null;

/**
 * Foto del documento de identidad lista para enviar: `data` es un data URL
 * ya comprimido en el navegador (legible y ≤ 5 MB en el servidor).
 */
export interface FotoDocumento {
  data: string;
  tipo: string;
  nombre: string;
}

export interface Pasajero {
  /** Identificador estable generado por el cliente (UUID). */
  ref_cliente: string;
  es_titular: boolean;
  nombre: string;
  tipo_doc: TipoDocumento;
  documento: string;
  fecha_nacimiento: string; // YYYY-MM-DD
  categoria: Categoria;
  respuestas: Record<string, Respuesta>;
  /** Id del archivo con la foto del documento (política de la agencia). */
  documento_imagen_id?: string | null;
  /** Foto elegida y aún no confirmada por el servidor: se envía en el guardado. */
  documento_imagen?: FotoDocumento | null;
  /** Solo el titular tiene datos de contacto (Spec §5 P-02). */
  telefono?: string | undefined;
  correo?: string | undefined;
  contacto_emergencia_nombre?: string | undefined;
  contacto_emergencia_telefono?: string | undefined;
}

export type MotivoCierre =
  "cliente" | "agencia" | "fuerza_mayor" | "expiracion" | "fecha_cancelada";

export interface Firma {
  id: string;
  hash_imagen: string;
  hash_documento: string;
  version_terminos_id: string;
  firmada_en: string;
  ip: string;
  user_agent: string;
  n_trazos: number;
  longitud_px: number;
  duracion_ms: number;
  integridad: "ok" | "alterada";
  /** Miniatura en base64 (solo en la demo en memoria). */
  preview?: string | undefined;
  /** URL firmada de la imagen de la firma (detalle admin; '' si no hay). */
  imagen_url?: string | undefined;
  /** `false` si el archivo de la firma ya no está en el storage. */
  imagen_disponible?: boolean | undefined;
}

export type EstadoVoucher = "generando" | "listo" | "error";

export interface Voucher {
  id: string;
  version: number;
  estado: EstadoVoucher;
  vigente: boolean;
  generado_en: string;
  url_descarga?: string | undefined;
  verif_token: string;
}

export interface Reserva {
  id: string;
  codigo: string;
  ref_corta: string;
  tour_id: string;
  fecha_tour_id: string;
  formulario_id: string;
  estado: EstadoReserva;
  estado_pago: EstadoPago;
  /** El titular es también pasajero 1 (ver PRD 10.3). */
  pasajeros: Pasajero[];
  respuestas_globales: Record<string, Respuesta>;
  total_usd: string;
  saldo_usd: string;
  /** Desglose del precio administrado (solo admin). */
  subtotal_usd?: string | undefined;
  adicionales_usd?: string | undefined;
  descuentos_usd?: string | undefined;
  precio_lineas?: LineaPrecioAdmin[] | undefined;
  precio_ajustes?: AjustePrecioAdmin[] | undefined;
  desglose?: Record<string, unknown> | null | undefined;
  tasa_aplicada: string | null;
  expira_en: string | null;
  version: number;
  paso_actual: PasoActual;
  referencia_interna?: string | undefined;
  requiere_accion?: string | undefined;
  motivo_cierre?: string | undefined;
  terminos_version_id?: string | undefined;
  firma?: Firma | undefined;
  voucher?: Voucher | undefined;
  promocion?:
    | { codigo: string; tipo: "porcentaje" | "monto"; valor: number; descuento_usd: string }
    | undefined;
  creado_en: string;
  ultima_actividad_en: string;
  /** Campos de listado que devuelve el backend (admin). */
  tour_nombre?: string | undefined;
  fecha_salida?: string | null | undefined;
  hora_salida?: string | null | undefined;
  titular_nombre?: string | undefined;
  /** Token del enlace; solo se devuelve al crearlo (D-08). */
  link_token?: string | undefined;
  duplications?: string[] | undefined;
  /** Datos adicionales para backwards compatibility */
  titular?: Pasajero | null;
  acompanantes?: Pasajero[];
  respuestas?: Record<string, Respuesta>;
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Progreso y datos del cliente
// ---------------------------------------------------------------------------

export type EstadoPaso = "completo" | "actual" | "pendiente" | "bloqueado";

export interface Progreso {
  paso_actual: PasoActual;
  pasos: { id: string; label: string; estado: EstadoPaso }[];
  campos_faltantes: string[];
  ultima_actividad_en: string;
  cerrada: boolean;
  motivo_cierre?: MotivoCierre | undefined;
  mensaje_reanudacion?: string | undefined;
}

export interface LineaPrecio {
  concepto: string;
  detalle?: string | undefined;
  cantidad?: number | undefined;
  precio_usd: string;
  total_usd: string;
}

/** Resumen público: el precio lo fija la agencia; el cliente solo ve el total. */
export interface ResumenReserva {
  pasajeros: (Pasajero & { documento_enmascarado: string })[];
  respuestas_globales: Record<string, Respuesta>;
  total_usd: string;
  total_bs_estimado: string | null;
  tasa_vigente: string | null;
  saldo_usd: string;
  estado_pago: EstadoPago;
  requiere_accion?: string | undefined;
  cupos_restantes: number;
}

// ---------------------------------------------------------------------------
// Precio administrado (admin)
// ---------------------------------------------------------------------------

/** Línea extra con costo gestionada por la agencia (toldos y demás cargos). */
export interface LineaPrecioAdmin {
  id?: string | undefined;
  concepto: string;
  cantidad: number;
  precio_unit_usd: string;
  subtotal_usd?: string | undefined;
}

/** Ajuste manual del admin sobre el precio de la reserva. */
export interface AjustePrecioAdmin {
  id?: string | undefined;
  tipo: "descuento" | "recargo";
  monto_usd: string;
  motivo: string;
  origen?: "manual" | "promo" | undefined;
}

// ---------------------------------------------------------------------------
// Pagos
// ---------------------------------------------------------------------------

export type MetodoPagoId = "transferencia" | "pago_movil" | "zelle" | "efectivo" | "binance";
export type Moneda = "USD" | "VES";

export interface MetodoPago {
  id: MetodoPagoId;
  nombre: string;
  moneda: Moneda;
  activo: boolean;
  orden: number;
  datos: { etiqueta: string; valor: string; copiable?: boolean }[];
  campos_requeridos: string[];
  requiere_comprobante: boolean;
  instrucciones?: string | undefined;
}

export type EstadoPagoRegistro =
  "reportado" | "aprobado" | "rechazado" | "correccion_solicitada" | "anulado";

export interface Pago {
  id: string;
  reserva_id: string;
  metodo: MetodoPagoId;
  monto: string;
  moneda: Moneda;
  tasa: string | null;
  fecha_pago: string;
  referencia: string;
  estado: EstadoPagoRegistro;
  motivo_rechazo?: string | undefined;
  comentario_validador?: string | undefined;
  duplicado_de_pago_id?: string | undefined;
  alertas: { codigo: string; mensaje: string }[];
  registrado_por?: string | undefined;
  validado_por?: string | undefined;
  validado_en?: string | undefined;
  comprobante?: { nombre: string; tipo: string; tamano: number; preview?: string } | undefined;
  creado_en: string;
}

export interface TasaCambio {
  id: string;
  valor: string;
  registrada_por: string;
  registrada_en: string;
  vigente: boolean;
}

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

export interface VersionTerminos {
  id: string;
  version: number;
  titulo: string;
  cuerpo: string;
  publicada_en: string;
  activa: boolean;
  hash: string;
  /** Clave de la plantilla a la que pertenece (`escapate-v1`). */
  clave?: string | null;
  /** Id de la plantilla (para asociarla a un tour). */
  plantilla_id?: string | null;
}

export interface TramoCancelacion {
  dias_desde_salida: number;
  porcentaje_reembolso: number;
  descripcion: string;
}

export interface PoliticaCancelacion {
  id: string;
  /** Clave estable con la que un tour la referencia (`full_day`). */
  clave?: string | null;
  nombre: string;
  tramos: TramoCancelacion[];
}

export interface PlantillaMensaje {
  id: string;
  clave: string;
  nombre: string;
  variables: string[];
  cuerpo: string;
}

export interface Configuracion {
  agencia_nombre: string;
  agencia_whatsapp: string;
  agencia_email: string;
  agencia_direccion: string;
  idioma: "es";
  zona_horaria: string;
  hold_horas: number;
  enlace_vigencia_horas: number;
  abono_minimo_porcentaje: number;
  max_pasajeros_reserva: number;
  permite_sobreventa: boolean;
  Requires_autorizacion_menores: boolean;
  documento_menores: "opcional" | "obligatorio" | "del_representante";
  minutos_inactividad: number;
  firma_empresa_fecha?: string | undefined;
  firma_empresa_archivo_id?: string | undefined;
  /** URL firmada temporal para el preview en el panel (solo lectura). */
  firma_empresa_url?: string | undefined;
  tour_activo_default: string;
  /**
   * Oculta la selección de comida en el formulario público (los campos no se
   * borran; se reactivan con este mismo flag).
   */
  comidas_deshabilitadas?: boolean | undefined;
  /**
   * Oculta el paso de pago del cliente: la agencia anota los datos del pago
   * desde la reserva. El flujo de reporte queda guardado por si se reactiva.
   */
  reporte_pago_cliente?: boolean | undefined;
}

export interface CodigoPromocional {
  id: string;
  codigo: string;
  tipo: "porcentaje" | "monto";
  valor: number;
  vigente_desde: string;
  vigente_hasta: string;
  usos_max: number;
  usos: number;
  tour_id?: string | undefined;
  activo: boolean;
}

// ---------------------------------------------------------------------------
// Auditoría y notificaciones
// ---------------------------------------------------------------------------

export interface Auditoria {
  id: string;
  usuario_id: string;
  usuario_nombre: string;
  entidad: string;
  entidad_id: string;
  accion: string;
  valor_anterior: string;
  valor_nuevo: string;
  fecha: string;
  motivo?: string | undefined;
  cadena: "ok" | "rota";
}

export type TipoNotificacion = "pago" | "reserva" | "salida" | "sistema";

export interface Notificacion {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  detalle: string;
  entidad_id?: string | undefined;
  leida: boolean;
  fecha: string;
}

// ---------------------------------------------------------------------------
// Reportes
// ---------------------------------------------------------------------------

export interface DashboardData {
  reservas_por_estado: { estado: EstadoReserva; total: number }[];
  ocupacion_proximas: {
    fecha_tour_id: string;
    tour: string;
    fecha: string;
    hora: string;
    vendidos: number;
    retenidos: number;
    total: number;
  }[];
  /** Reservas firmadas que la agencia todavía no confirma. */
  por_confirmar: { total: number; mas_antiguo_min: number }[];
  ingresos_mes_usd: string;
  ventas_por_mes: { mes: string; total_usd: string; reservas: number }[];
  requiere_atencion: {
    id: string;
    tipo: string;
    titulo: string;
    detalle: string;
    entidad_id: string;
    severidad: "alta" | "media" | "baja";
  }[];
}

// ---------------------------------------------------------------------------
// Exportaciones XLSX
// ---------------------------------------------------------------------------

export type TipoExportacion =
  "reservas" | "tours" | "pasajeros_tour" | "clientes" | "pagos" | "manifest" | "cocina";

export type EstadoExportacion = "en_cola" | "procesando" | "lista" | "error" | "expirada";

export interface Exportacion {
  id: string;
  tipo: TipoExportacion;
  filtros: Record<string, unknown>;
  estado: EstadoExportacion;
  archivo_id?: string | null;
  solicitada_por: string;
  nombre_archivo?: string | null;
  expira_en?: string | null;
  error?: string | null;
  intentos: number;
  creado_en: string;
  actualizado_en: string;
}

// ---------------------------------------------------------------------------
// Errores de API
// ---------------------------------------------------------------------------

export type CodigoError =
  | "JSON_INVALIDO"
  | "NO_AUTENTICADO"
  | "SIN_PERMISO"
  | "CAPTCHA_FALLIDO"
  | "SEGREGACION_FUNCIONES"
  | "NO_ENCONTRADO"
  | "ENLACE_INVALIDO"
  | "VERSION_DESACTUALIZADA"
  | "TRANSICION_INVALIDA"
  | "SIN_CUPO"
  | "OPCION_AGOTADA"
  | "PRECIO_CAMBIO"
  | "TASA_CAMBIO"
  | "PROMO_INVALIDA"
  | "FECHA_CERRADA"
  | "CORTE_VENTA_CUMPLIDO"
  | "CONTENIDO_CAMBIO"
  | "TERMINOS_ACTUALIZADOS"
  | "FIRMA_PENDIENTE"
  | "RESERVA_CERRADA"
  /** El reporte de pago del cliente está desactivado por la agencia. */
  | "PAGO_CLIENTE_DESACTIVADO"
  | "REFERENCIA_YA_APROBADA"
  | "ENLACE_VENCIDO"
  | "ARCHIVO_GRANDE"
  | "ARCHIVO_TIPO_INVALIDO"
  /** Punto de salida que no puede elegir el cliente (p. ej. Caracas). */
  | "PUNTO_NO_SELECCIONABLE"
  | "VALIDACION"
  | "EDAD_NO_COINCIDE_CATEGORIA"
  | "DOCUMENTO_DUPLICADO"
  | "TITULAR_MENOR_DE_EDAD"
  | "FIRMA_INVALIDA"
  | "CAMBIO_ALTERA_PRECIO"
  | "CUPO_MENOR_A_OCUPADO"
  | "IDEMPOTENCIA_CONFLICTO"
  | "DEMASIADAS_SOLICITUDES"
  | "TASA_NO_CONFIGURADA"
  | "ERROR_INTERNO"
  | "STEP_UP_REQUERIDO"
  /** Login con credenciales válidas, pero la verificación de la sesión (`/auth/yo`) falló. */
  | "VERIFICACION_SESION"
  /** Onboarding ya completado: no se puede crear otro superadmin. */
  | "SETUP_YA_COMPLETADO";

export interface DetalleError {
  campo: string;
  mensaje: string;
}

export interface ApiErrorBody {
  codigo: CodigoError;
  mensaje: string;
  detalles?: DetalleError[] | undefined;
  request_id: string;
  data?: Record<string, unknown> | undefined;
}
