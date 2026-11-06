/**
 * Formateadores — RNF 9.4, Spec Frontend 3.10
 *
 * Todos los montos viajan como string decimal (FD-09). Nunca se usa `number`
 * de punto flotante para dinero.
 */

const TZ_AGENCIA = "America/Caracas";

/** Convierte "12.50" | "12,50" | 12.5 a un decimal en string canónico. */
export function toDecimalString(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "0.00";
  const normalizado = String(value).replace(",", ".").replace(/[^0-9.-]/g, "");
  const n = Number.parseFloat(normalizado);
  if (Number.isNaN(n)) return "0.00";
  return n.toFixed(2);
}

/** Suma de strings decimales sin pasar por float para el resultado final. */
export function addDecimals(a: string, b: string): string {
  const cents = (v: string) => Math.round(Number.parseFloat(toDecimalString(v)) * 100);
  const total = cents(a) + cents(b);
  return (total / 100).toFixed(2);
}

export function subtractDecimals(a: string, b: string): string {
  const cents = (v: string) => Math.round(Number.parseFloat(toDecimalString(v)) * 100);
  const total = cents(a) - cents(b);
  return (total / 100).toFixed(2);
}

export function multiplyDecimal(a: string, factor: number): string {
  const cents = Math.round(Number.parseFloat(toDecimalString(a)) * 100);
  return ((cents * factor) / 100).toFixed(2);
}

export function isGreaterThan(a: string, b: string): boolean {
  return Number.parseFloat(toDecimalString(a)) > Number.parseFloat(toDecimalString(b));
}

/** `$90,00` con separadores es-VE. */
export function formatUsd(value: string | number | null | undefined): string {
  const n = Number.parseFloat(toDecimalString(value));
  return `$${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** `Bs. 3.150,00` con separadores es-VE. */
export function formatBs(value: string | number | null | undefined): string {
  const n = Number.parseFloat(toDecimalString(value));
  return `Bs. ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** USD primero cuando se muestran ambos (Spec 3.10). */
export function formatDual(usd: string, bs: string | null | undefined): string {
  if (!bs) return formatUsd(usd);
  return `${formatUsd(usd)} · ${formatBs(bs)}`;
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

/** `2026-12-14` -> Date UTC medianoche (evita tz local). */
export function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function formatDate(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString("es-VE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateLong(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** `5:00 a. m.` en la zona de la agencia. */
export function formatTime(hora: string): string {
  const [h = "0", m = "0"] = hora.split(":");
  const horaNum = Number.parseInt(h, 10);
  const suffix = horaNum < 12 ? "a. m." : "p. m.";
  const h12 = horaNum % 12 === 0 ? 12 : horaNum % 12;
  return `${h12}:${m} ${suffix}`;
}

/** Instante ISO -> `14 dic 2026, 5:00 a. m.` en zona de agencia. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric", timeZone: TZ_AGENCIA })}, ${d.toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ_AGENCIA })}`;
}

/** `hace 3 h` / `hace 2 min` / `hace 4 días`. */
export function formatRelative(iso: string, ahora: number = Date.now()): string {
  const diff = ahora - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "hace instantes";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `hace ${meses} mes${meses === 1 ? "" : "es"}`;
  const anios = Math.floor(meses / 12);
  return `hace ${anio(anios)}`;
}

function anio(n: number): string {
  return `${n} año${n === 1 ? "" : "s"}`;
}

/** Cuenta regresiva: `Hh MMm` bajo 24 h, `MM:SS` bajo 10 min. */
export function formatCountdown(msRestantes: number): string {
  if (msRestantes <= 0) return "00:00";
  const totalSeg = Math.floor(msRestantes / 1000);
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Texto de hold: «Tu cupo está reservado por 23 h 40 min». */
export function formatHorasMinutos(msRestantes: number): string {
  const totalMin = Math.max(0, Math.floor(msRestantes / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${m} min`;
}

// ---------------------------------------------------------------------------
// Documento y teléfono
// ---------------------------------------------------------------------------

/** `V-****5678` */
export function maskDocumento(tipo: string, documento: string): string {
  const limpio = (documento || "").replace(/\s+/g, "");
  if (limpio.length <= 4) return `${tipo}-****`;
  return `${tipo}-****${limpio.slice(-4)}`;
}

export function maskDocumentoSimple(documento: string): string {
  const limpio = (documento || "").replace(/\s+/g, "");
  if (limpio.length <= 4) return `****${limpio.slice(-4)}`;
  return `****${limpio.slice(-4)}`;
}

/** Solo dígitos, conservando el prefijo V/E/P. */
export function normalizeDocumento(tipo: string, documento: string): string {
  const d = (documento || "").replace(/\D/g, "");
  if (tipo === "OTRO") return (documento || "").trim().toUpperCase();
  return d;
}

/** `+58 412 1234567` */
export function formatPhoneE164(telefono: string): string {
  const d = (telefono || "").replace(/\D/g, "");
  if (d.startsWith("58")) return `+${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
  return `+${d}`;
}

export function isValidPhone(telefono: string): boolean {
  const d = (telefono || "").replace(/\D/g, "");
  return d.length >= 10 && d.length <= 15;
}

export function isValidEmail(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((correo || "").trim().toLowerCase());
}

/** Sugerencia de dominio: `gmail.co` -> `gmail.com`. */
export function suggestEmail(correo: string): string | null {
  const c = (correo || "").trim().toLowerCase();
  const dominios: Record<string, string> = {
    "gmail.co": "gmail.com",
    "gmail.con": "gmail.com",
    "gmial.com": "gmail.com",
    "gmail.cm": "gmail.com",
    "hotmial.com": "hotmail.com",
    "hotmai.com": "hotmail.com",
    "outlok.com": "outlook.com",
    "yahooo.com": "yahoo.com",
    "yaho.com": "yahoo.com",
  };
  const [, dominio] = c.split("@");
  if (!dominio) return null;
  const sugerido = dominios[dominio];
  if (!sugerido) return null;
  const [local] = c.split("@");
  return `${local}@${sugerido}`;
}

// ---------------------------------------------------------------------------
// Edad y categoría
// ---------------------------------------------------------------------------

export function edadEn(fechaNacimiento: string, fechaReferencia: string): number | null {
  if (!fechaNacimiento || !fechaReferencia) return null;
  const nac = parseIsoDate(fechaNacimiento);
  const ref = parseIsoDate(fechaReferencia);
  if (Number.isNaN(nac.getTime()) || Number.isNaN(ref.getTime())) return null;
  let edad = ref.getUTCFullYear() - nac.getUTCFullYear();
  const m = ref.getUTCMonth() - nac.getUTCMonth();
  if (m < 0 || (m === 0 && ref.getUTCDate() < nac.getUTCDate())) edad -= 1;
  return edad;
}

export function formatFechaNacimiento(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ---------------------------------------------------------------------------
// Estados (texto legible, nunca el identificador interno)
// ---------------------------------------------------------------------------

export const ETIQUETA_ESTADO_RESERVA: Record<string, string> = {
  enlace_creado: "Enlace creado",
  en_registro: "En registro",
  pendiente_firma: "Pendiente de firma",
  pendiente_pago: "Pendiente de pago",
  pago_en_verificacion: "Pago en verificación",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  expirada: "Expirada",
};

export const ETIQUETA_ESTADO_PAGO: Record<string, string> = {
  sin_pago: "Sin pago",
  reportado: "Reportado",
  parcial: "Parcial",
  pagado: "Pagado",
  rechazado: "Rechazado",
  reembolsado: "Reembolsado",
};

export const ETIQUETA_METODO_PAGO: Record<string, string> = {
  transferencia: "Transferencia bancaria",
  pago_movil: "Pago Móvil",
  zelle: "Zelle",
  efectivo: "Efectivo",
  binance: "Binance",
};

export const ETIQUETA_MOTIVO_RECHAZO: Record<string, string> = {
  comprobante_ilegible: "El comprobante no se lee bien",
  monto_incorrecto: "El monto no coincide",
  referencia_no_encontrada: "No encontramos la referencia",
  pago_no_recibido: "No hemos recibido el pago",
  otro: "Otro motivo",
};

export const ETIQUETA_TIPO_TOUR: Record<string, string> = {
  full_day: "Full Day",
  fin_de_semana: "Fin de semana",
  multi_dia: "Multi-día",
};

/** Plural simple para evitar textos hardcodeados con conteos. */
export function plural(n: number, singular: string, pluralForma: string): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}
