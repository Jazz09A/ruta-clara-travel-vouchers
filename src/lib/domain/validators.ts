import { edadEn, isValidEmail, isValidPhone } from "@/lib/format";
import type { Categoria, TipoDocumento } from "./types";

/**
 * Validadores de datos del cliente y del titular (RF-5.3, RF-5.4).
 *
 * Lógica pura. Todos los mensajes están en español, en segunda persona y
 * con un ejemplo cuando ayuda a entender qué se espera.
 */

export interface ResultadoValidacion {
  ok: boolean;
  mensaje?: string;
}

export interface ResultadoDocumentosUnicos extends ResultadoValidacion {
  /** Índice del pasajero con el documento repetido (la segunda aparición). */
  indiceDuplicado?: number;
}

const EDAD_MAXIMA = 120;
const EDAD_TITULAR = 18;

/** Fecha local de hoy en formato YYYY-MM-DD. */
function hoyIso(): string {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/** Nombre del pasajero: no vacío y no exageradamente largo. */
export function validarNombre(nombre: string): ResultadoValidacion {
  const limpio = nombre.trim();
  if (limpio.length === 0) {
    return { ok: false, mensaje: "Escribe el nombre del pasajero, por ejemplo Juan Pérez" };
  }
  if (limpio.length > 120) {
    return { ok: false, mensaje: "El nombre no puede tener más de 120 caracteres" };
  }
  return { ok: true };
}

/**
 * Documento de identidad según el tipo:
 * - `V` / `E`: 6 a 9 dígitos.
 * - `P`: 6 a 12 caracteres alfanuméricos.
 * - `OTRO`: 3 a 32 caracteres.
 */
export function validarDocumento(tipo: TipoDocumento, documento: string): ResultadoValidacion {
  const limpio = documento.trim();
  if (limpio.length === 0) {
    return { ok: false, mensaje: "Escribe el número de documento, por ejemplo 12345678" };
  }

  if (tipo === "V" || tipo === "E") {
    if (!/^\d+$/.test(limpio)) {
      return { ok: false, mensaje: "La cédula debe tener solo números, por ejemplo 12345678" };
    }
    if (limpio.length < 6 || limpio.length > 9) {
      return {
        ok: false,
        mensaje: "La cédula debe tener entre 6 y 9 dígitos, por ejemplo 12345678",
      };
    }
    return { ok: true };
  }

  if (tipo === "P") {
    if (!/^[a-zA-Z0-9]+$/.test(limpio)) {
      return {
        ok: false,
        mensaje: "El pasaporte debe tener solo letras y números, por ejemplo A1234567",
      };
    }
    if (limpio.length < 6 || limpio.length > 12) {
      return {
        ok: false,
        mensaje: "El pasaporte debe tener entre 6 y 12 caracteres, por ejemplo A1234567",
      };
    }
    return { ok: true };
  }

  if (limpio.length < 3 || limpio.length > 32) {
    return {
      ok: false,
      mensaje: "El documento debe tener entre 3 y 32 caracteres, por ejemplo DOC-1234",
    };
  }
  return { ok: true };
}

/** Fecha de nacimiento: YYYY-MM-DD válida, no futura y con edad razonable. */
export function validarFechaNacimiento(fecha: string): ResultadoValidacion {
  const limpio = fecha.trim();
  if (limpio.length === 0) {
    return { ok: false, mensaje: "Escribe la fecha de nacimiento, por ejemplo 1990-05-14" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpio)) {
    return {
      ok: false,
      mensaje: "Escribe la fecha de nacimiento en formato AAAA-MM-DD, por ejemplo 1990-05-14",
    };
  }

  const partes = limpio.split("-").map((n) => Number.parseInt(n, 10));
  const anio = partes[0];
  const mes = partes[1];
  const dia = partes[2];
  if (anio === undefined || mes === undefined || dia === undefined) {
    return { ok: false, mensaje: "Escribe la fecha de nacimiento, por ejemplo 1990-05-14" };
  }

  const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fechaUtc.getUTCFullYear() !== anio ||
    fechaUtc.getUTCMonth() !== mes - 1 ||
    fechaUtc.getUTCDate() !== dia
  ) {
    return {
      ok: false,
      mensaje: "Esa fecha no existe. Revisa el día y el mes, por ejemplo 1990-05-14",
    };
  }

  const hoy = hoyIso();
  if (limpio > hoy) {
    return { ok: false, mensaje: "La fecha de nacimiento no puede ser una fecha futura" };
  }

  const edad = edadEn(limpio, hoy);
  if (edad === null || edad > EDAD_MAXIMA) {
    return { ok: false, mensaje: "Revisa la fecha de nacimiento: no parece correcta" };
  }
  return { ok: true };
}

/** Edad mínima exigida por el tour en la fecha de salida (RF-2.5). */
export function validarEdadMinima(
  fechaNacimiento: string,
  fechaSalida: string,
  minimo: number,
): ResultadoValidacion {
  const edad = edadEn(fechaNacimiento, fechaSalida);
  if (edad === null) {
    return {
      ok: false,
      mensaje: "Escribe la fecha de nacimiento en formato AAAA-MM-DD, por ejemplo 1990-05-14",
    };
  }
  if (edad < minimo) {
    return {
      ok: false,
      mensaje: `El pasajero debe tener al menos ${minimo} años para este tour`,
    };
  }
  return { ok: true };
}

/** Teléfono de contacto: 10 a 15 dígitos (ignora espacios y guiones). */
export function validarTelefono(telefono: string): ResultadoValidacion {
  const limpio = telefono.trim();
  if (limpio.length === 0) {
    return { ok: false, mensaje: "Escribe el teléfono de contacto, por ejemplo +58 412 1234567" };
  }
  if (!isValidPhone(limpio)) {
    return { ok: false, mensaje: "Escribe un teléfono válido, por ejemplo +58 412 1234567" };
  }
  return { ok: true };
}

/** Correo electrónico del titular. */
export function validarCorreo(correo: string): ResultadoValidacion {
  const limpio = correo.trim();
  if (limpio.length === 0) {
    return { ok: false, mensaje: "Escribe el correo, por ejemplo nombre@gmail.com" };
  }
  if (!isValidEmail(limpio)) {
    return { ok: false, mensaje: "Escribe un correo válido, por ejemplo nombre@gmail.com" };
  }
  return { ok: true };
}

/** Clave de comparación de un documento (ignora espacios y guiones). */
function claveDocumento(tipo: string, documento: string): string {
  const limpio = documento.trim();
  if (tipo === "OTRO") return `OTRO:${limpio.toUpperCase().replace(/\s+/g, " ")}`;
  return limpio.replace(/\D/g, "");
}

/**
 * Detecta documentos repetidos dentro de la misma reserva (RF-4.8).
 * Devuelve el índice del pasajero que repite el documento.
 */
export function validarDocumentosUnicos(
  documentos: {
    tipo_doc: string;
    documento: string;
  }[],
): ResultadoDocumentosUnicos {
  const vistos = new Map<string, number>();

  for (const [indice, documento] of documentos.entries()) {
    const clave = claveDocumento(documento.tipo_doc, documento.documento);
    if (clave.length === 0) continue;
    if (vistos.has(clave)) {
      return {
        ok: false,
        mensaje: "Este documento ya está en la reserva",
        indiceDuplicado: indice,
      };
    }
    vistos.set(clave, indice);
  }

  return { ok: true };
}

/** El titular de la reserva debe ser mayor de edad (RF-5.3). */
export function esTitularMayorDeEdad(fechaNacimiento: string, fechaSalida: string): boolean {
  const edad = edadEn(fechaNacimiento, fechaSalida);
  return edad !== null && edad >= EDAD_TITULAR;
}

/** Texto con las categorías y sus rangos de edad, para que el cliente elija. */
export function categoriasDisponibles(
  tarifas: { categoria: Categoria; edad_min: number; edad_max: number }[],
): string {
  if (tarifas.length === 0) {
    return "Por ahora no hay categorías disponibles para esta salida";
  }
  return tarifas
    .map((tarifa) =>
      tarifa.edad_max >= EDAD_MAXIMA
        ? `${tarifa.categoria}: desde ${tarifa.edad_min} años`
        : `${tarifa.categoria}: de ${tarifa.edad_min} a ${tarifa.edad_max} años`,
    )
    .join(" · ");
}
