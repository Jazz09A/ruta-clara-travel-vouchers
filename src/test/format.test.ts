import { describe, expect, it } from "vitest";

import {
  addDecimals,
  edadEn,
  formatBs,
  formatCountdown,
  formatDate,
  formatDateLong,
  formatDateTime,
  formatDual,
  formatFechaNacimiento,
  formatHorasMinutos,
  formatPhoneE164,
  formatRelative,
  formatTime,
  formatUsd,
  isValidEmail,
  isValidPhone,
  maskDocumento,
  maskDocumentoSimple,
  multiplyDecimal,
  normalizeDocumento,
  plural,
  subtractDecimals,
  suggestEmail,
  toDecimalString,
} from "@/lib/format";

// ---------------------------------------------------------------------------
// Decimales — el dinero viaja como string; estas funciones son la base.
// ---------------------------------------------------------------------------

describe("toDecimalString — normalización hostil", () => {
  it("acepta coma decimal y símbolos de moneda", () => {
    expect(toDecimalString("12,50")).toBe("12.50");
    expect(toDecimalString("$50.00")).toBe("50.00");
    expect(toDecimalString(" 50.00 ")).toBe("50.00");
  });

  it("un separador de miles con coma/punto rompe el parseo (documentado)", () => {
    // "1.234,56" → "1.234.56" → parseFloat se queda con 1.234.
    // El formato es-VE con separador de miles NO es soportado por diseño:
    // el dinero viaja como "1234.56", nunca con puntos de miles.
    expect(toDecimalString("1.234,56")).toBe("1.23");
    expect(toDecimalString("1,234.56")).toBe("1.23");
  });

  it("devuelve 0.00 para entradas sin número", () => {
    expect(toDecimalString("")).toBe("0.00");
    expect(toDecimalString("   ")).toBe("0.00");
    expect(toDecimalString("abc")).toBe("0.00");
    expect(toDecimalString("-")).toBe("0.00");
    expect(toDecimalString(null)).toBe("0.00");
    expect(toDecimalString(undefined)).toBe("0.00");
  });

  it("parseFloat se queda con el prefijo válido de cadenas raras", () => {
    // Documenta el comportamiento real: parseFloat("1.2.3") = 1.2.
    expect(toDecimalString("1.2.3")).toBe("1.20");
    // La "e" se elimina como carácter no numérico: "1e3" → "13".
    expect(toDecimalString("1e3")).toBe("13.00");
    expect(toDecimalString("10abc20")).toBe("1020.00");
  });

  it("conserva negativos y números", () => {
    expect(toDecimalString(-5)).toBe("-5.00");
    expect(toDecimalString("-12,5")).toBe("-12.50");
    expect(toDecimalString(0)).toBe("0.00");
  });
});

describe("operaciones decimales — sin trampas de float", () => {
  it("suma sin el error clásico de 0.1 + 0.2", () => {
    expect(addDecimals("0.10", "0.20")).toBe("0.30");
    expect(addDecimals("10.00", "0.10")).toBe("10.10");
    expect(addDecimals("-5.00", "10.00")).toBe("5.00");
  });

  it("resta y puede quedar negativa (el piso lo pone quien llama)", () => {
    expect(subtractDecimals("0.30", "0.10")).toBe("0.20");
    expect(subtractDecimals("0.10", "0.30")).toBe("-0.20");
  });

  it("multiplica por factor entero y fraccionario", () => {
    expect(multiplyDecimal("10.00", 3)).toBe("30.00");
    expect(multiplyDecimal("0.10", 3)).toBe("0.30");
    expect(multiplyDecimal("33.33", 0.1)).toBe("3.33");
    expect(multiplyDecimal("10.00", -2)).toBe("-20.00");
  });

  it("tolera entradas basura tratándolas como cero", () => {
    expect(addDecimals("abc", "5.00")).toBe("5.00");
    expect(subtractDecimals("5.00", "xyz")).toBe("5.00");
    expect(multiplyDecimal("no-es-numero", 4)).toBe("0.00");
  });
});

// ---------------------------------------------------------------------------
// Fechas relativas y cuenta regresiva
// ---------------------------------------------------------------------------

describe("formatRelative — bordes de tiempo", () => {
  const ahora = Date.parse("2026-11-23T12:00:00.000Z");
  const hace = (ms: number) => new Date(ahora - ms).toISOString();

  it("menos de un minuto dice «hace instantes»", () => {
    expect(formatRelative(hace(30_000), ahora)).toBe("hace instantes");
    expect(formatRelative(hace(0), ahora)).toBe("hace instantes");
  });

  it("una fecha futura también cae en «hace instantes» (diff negativo)", () => {
    expect(formatRelative(new Date(ahora + 60_000).toISOString(), ahora)).toBe("hace instantes");
  });

  it("cambia de unidad en los bordes exactos", () => {
    expect(formatRelative(hace(59 * 60_000), ahora)).toBe("hace 59 min");
    expect(formatRelative(hace(60 * 60_000), ahora)).toBe("hace 1 h");
    expect(formatRelative(hace(23 * 3_600_000), ahora)).toBe("hace 23 h");
    expect(formatRelative(hace(24 * 3_600_000), ahora)).toBe("ayer");
    expect(formatRelative(hace(2 * 86_400_000), ahora)).toBe("hace 2 días");
    expect(formatRelative(hace(30 * 86_400_000), ahora)).toBe("hace 1 mes");
    expect(formatRelative(hace(365 * 86_400_000), ahora)).toBe("hace 1 año");
    expect(formatRelative(hace(730 * 86_400_000), ahora)).toBe("hace 2 años");
  });

  it("un ISO inválido produce NaN en el texto (documentado, no crashea)", () => {
    // Documenta el comportamiento real: Math.floor(NaN) propaga NaN.
    expect(formatRelative("no-es-fecha", ahora)).toContain("NaN");
  });
});

describe("formatCountdown y formatHorasMinutos", () => {
  it("cuenta regresiva en cero o negativo da 00:00", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5000)).toBe("00:00");
  });

  it("bajo 10 minutos muestra MM:SS", () => {
    expect(formatCountdown(9 * 60_000 + 59_000)).toBe("09:59");
    expect(formatCountdown(10 * 60_000)).toBe("10:00");
  });

  it("con horas muestra Hh MMm", () => {
    expect(formatCountdown(3_600_000)).toBe("1h 00m");
    expect(formatCountdown(3_599_999)).toBe("59:59");
    expect(formatCountdown(90 * 60_000)).toBe("1h 30m");
  });

  it("horas/minutos nunca negativos y sin hora cuando es 0", () => {
    expect(formatHorasMinutos(-1000)).toBe("0 min");
    expect(formatHorasMinutos(0)).toBe("0 min");
    expect(formatHorasMinutos(45_000)).toBe("0 min"); // 0.75 min → floor 0
    expect(formatHorasMinutos(60_000)).toBe("1 min");
    expect(formatHorasMinutos(3_600_000)).toBe("1 h 0 min");
    expect(formatHorasMinutos(5_400_000)).toBe("1 h 30 min");
  });
});

// ---------------------------------------------------------------------------
// Hora, fechas y documentos
// ---------------------------------------------------------------------------

describe("formatTime — entradas que no son HH:MM", () => {
  it("convierte a 12 horas con a. m./p. m.", () => {
    expect(formatTime("05:00")).toBe("5:00 a. m.");
    expect(formatTime("17:30")).toBe("5:30 p. m.");
    expect(formatTime("00:15")).toBe("12:15 a. m.");
    expect(formatTime("12:00")).toBe("12:00 p. m.");
  });

  it("24:00 y horas de un dígito no rompen (documenta comportamiento)", () => {
    // "24" pasa el %12 → 12 p. m. (la validación real la hace el backend).
    expect(formatTime("24:00")).toBe("12:00 p. m.");
    expect(formatTime("7:05")).toBe("7:05 a. m.");
  });

  it("entradas basura producen texto con NaN, no excepción", () => {
    expect(formatTime("abc")).toContain("NaN");
    expect(formatTime("")).toContain("NaN");
  });
});

describe("formatDate / formatDateLong / formatDateTime / formatFechaNacimiento", () => {
  it("formatea una fecha ISO sin correrse de día por la zona horaria", () => {
    expect(formatDate("2026-12-14")).toContain("14");
    expect(formatDate("2026-12-14")).toContain("dic");
    expect(formatDateLong("2026-12-14")).toContain("lunes");
    expect(formatFechaNacimiento("1990-05-14")).toBe("14/05/1990");
  });

  it("formatDateTime convierte a la zona de la agencia", () => {
    const texto = formatDateTime("2026-12-14T10:00:00.000Z");
    expect(texto).toContain("2026");
    expect(texto).toMatch(/a\. m\.|p\. m\./);
  });

  it("entradas inválidas o vacías no lanzan", () => {
    expect(formatDate("no-fecha")).toBe("Invalid Date");
    expect(formatFechaNacimiento("")).toBe("—");
    expect(formatFechaNacimiento("1990-5-4")).toBe("4/5/1990"); // no valida formato
  });
});

describe("máscaras y normalización de documento", () => {
  it("enmascara dejando sólo los últimos 4 caracteres", () => {
    expect(maskDocumento("V", "12345678")).toBe("V-****5678");
    expect(maskDocumento("P", "A1234567")).toBe("P-****4567");
    expect(maskDocumentoSimple("12345678")).toBe("****5678");
  });

  it("documentos de 4 caracteres o menos se enmascaran enteros", () => {
    expect(maskDocumento("V", "1234")).toBe("V-****");
    expect(maskDocumento("V", "12")).toBe("V-****");
    expect(maskDocumento("V", "")).toBe("V-****");
    expect(maskDocumentoSimple("")).toBe("****");
  });

  it("ignora espacios internos al enmascarar", () => {
    expect(maskDocumento("V", "12 345 678")).toBe("V-****5678");
  });

  it("normalizeDocumento: dígitos para V/E/P, mayúsculas para OTRO", () => {
    expect(normalizeDocumento("V", "V-12.345-678")).toBe("12345678");
    expect(normalizeDocumento("p", "a1b2")).toBe("12");
    expect(normalizeDocumento("OTRO", "  doc-123 ")).toBe("DOC-123");
    expect(normalizeDocumento("OTRO", "")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Teléfono, correo y edad
// ---------------------------------------------------------------------------

describe("isValidPhone / isValidEmail", () => {
  it("teléfono: 10 a 15 dígitos ignorando formato", () => {
    expect(isValidPhone("1234567890")).toBe(true);
    expect(isValidPhone("+58 412 1234567")).toBe(true);
    expect(isValidPhone("123456789")).toBe(false); // 9 dígitos
    expect(isValidPhone("1234567890123456")).toBe(false); // 16 dígitos
    expect(isValidPhone("abcdefghij")).toBe(false); // letras no cuentan
    expect(isValidPhone("")).toBe(false);
  });

  it("correo: exige TLD de al menos 2 caracteres", () => {
    expect(isValidEmail("nombre@gmail.com")).toBe(true);
    expect(isValidEmail("NOMBRE@GMAIL.COM")).toBe(true);
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("a@b.c")).toBe(false); // TLD de 1 char
    expect(isValidEmail("a@b")).toBe(false); // sin punto
    expect(isValidEmail("a b@c.com")).toBe(false); // espacio interno
    expect(isValidEmail("@c.com")).toBe(false); // sin local
    expect(isValidEmail("")).toBe(false);
  });
});

describe("suggestEmail — typos de dominio", () => {
  it("sugiere la corrección para dominios conocidos mal escritos", () => {
    expect(suggestEmail("ana@gmail.co")).toBe("ana@gmail.com");
    expect(suggestEmail("ana@gmial.com")).toBe("ana@gmail.com");
    expect(suggestEmail("ana@hotmail.com".replace("hotmail", "hotmial"))).toBe("ana@hotmail.com");
  });

  it("devuelve null para dominios correctos, desconocidos o sin @", () => {
    expect(suggestEmail("ana@gmail.com")).toBeNull();
    expect(suggestEmail("ana@empresa.com")).toBeNull();
    expect(suggestEmail("sin-arroba")).toBeNull();
    expect(suggestEmail("")).toBeNull();
  });
});

describe("edadEn — cumpleaños y bisiestos", () => {
  it("en el día del cumpleaños la edad ya subió", () => {
    expect(edadEn("1990-05-14", "2026-05-14")).toBe(36);
    expect(edadEn("1990-05-14", "2026-05-13")).toBe(35);
  });

  it("29 de febrero: en año no bisiesto cumple el 1 de marzo", () => {
    expect(edadEn("2024-02-29", "2025-02-28")).toBe(0);
    expect(edadEn("2024-02-29", "2025-03-01")).toBe(1);
    expect(edadEn("2024-02-29", "2028-02-29")).toBe(4);
  });

  it("entradas vacías o inválidas devuelven null", () => {
    expect(edadEn("", "2026-01-01")).toBeNull();
    expect(edadEn("1990-01-01", "")).toBeNull();
    expect(edadEn("no-fecha", "2026-01-01")).toBeNull();
  });

  it("referencia anterior al nacimiento da edad negativa (documentado)", () => {
    expect(edadEn("2020-01-01", "2010-01-01")).toBe(-10);
  });
});

// ---------------------------------------------------------------------------
// Formato de moneda y plural
// ---------------------------------------------------------------------------

describe("formatUsd / formatBs / formatDual", () => {
  it("formatea con separadores es-VE", () => {
    expect(formatUsd("1234.5")).toBe("$1.234,50");
    expect(formatBs("1234.5")).toBe("Bs. 1.234,50");
  });

  it("entradas nulas o basura caen a cero", () => {
    expect(formatUsd(null)).toBe("$0,00");
    expect(formatUsd(undefined)).toBe("$0,00");
    expect(formatUsd("abc")).toBe("$0,00");
    expect(formatBs("")).toBe("Bs. 0,00");
  });

  it("formatDual muestra USD primero y BS sólo si existe", () => {
    expect(formatDual("50.00", "1825.00")).toBe("$50,00 · Bs. 1.825,00");
    expect(formatDual("50.00", null)).toBe("$50,00");
    // Un BS basura no es null: se muestra formateado a cero (documentado).
    expect(formatDual("50.00", "abc")).toBe("$50,00 · Bs. 0,00");
  });
});

describe("plural", () => {
  it("singular sólo con exactamente 1", () => {
    expect(plural(1, "pasajero", "pasajeros")).toBe("1 pasajero");
    expect(plural(0, "pasajero", "pasajeros")).toBe("0 pasajeros");
    expect(plural(2, "pasajero", "pasajeros")).toBe("2 pasajeros");
    expect(plural(-1, "pasajero", "pasajeros")).toBe("-1 pasajeros");
    expect(plural(1.5, "unidad", "unidades")).toBe("1.5 unidades");
  });
});

describe("formatPhoneE164", () => {
  it("agrega +58 desglosado para números venezolanos", () => {
    expect(formatPhoneE164("584121234567")).toBe("+58 412 1234567");
    expect(formatPhoneE164("+58 412 1234567")).toBe("+58 412 1234567");
  });

  it("otros prefijos quedan como +digitos", () => {
    expect(formatPhoneE164("14155552671")).toBe("+14155552671");
    expect(formatPhoneE164("")).toBe("+");
  });
});
