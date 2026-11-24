import { describe, expect, it } from "vitest";
import type { Categoria } from "@/lib/domain/types";
import {
  categoriasDisponibles,
  esTitularMayorDeEdad,
  validarCorreo,
  validarDocumento,
  validarDocumentosUnicos,
  validarEdadMinima,
  validarFechaNacimiento,
  validarNombre,
  validarTelefono,
} from "@/lib/domain/validators";

describe("validadores — nombre", () => {
  it("acepta un nombre completo", () => {
    expect(validarNombre("Juan Pérez").ok).toBe(true);
    expect(validarNombre("  Juan Pérez  ").ok).toBe(true);
  });

  it("rechaza un nombre vacío", () => {
    const resultado = validarNombre("   ");
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toBe("Escribe el nombre del pasajero, por ejemplo Juan Pérez");
  });

  it("rechaza un nombre exageradamente largo", () => {
    expect(validarNombre("a".repeat(121)).ok).toBe(false);
  });
});

describe("validadores — documento", () => {
  it("acepta cédulas de 6 a 9 dígitos", () => {
    expect(validarDocumento("V", "123456").ok).toBe(true);
    expect(validarDocumento("V", "12345678").ok).toBe(true);
    expect(validarDocumento("E", "123456789").ok).toBe(true);
  });

  it("rechaza cédulas con letras o demasiado cortas", () => {
    const conLetras = validarDocumento("V", "V-12345678");
    expect(conLetras.ok).toBe(false);
    expect(conLetras.mensaje).toContain("solo números");
    expect(validarDocumento("V", "12345").ok).toBe(false);
    expect(validarDocumento("V", "1234567890").ok).toBe(false);
  });

  it("acepta pasaportes alfanuméricos de 6 a 12 caracteres", () => {
    expect(validarDocumento("P", "A1234567").ok).toBe(true);
    expect(validarDocumento("P", "A12345").ok).toBe(true);
    expect(validarDocumento("P", "A1234").ok).toBe(false);
    expect(validarDocumento("P", "A1234567890123").ok).toBe(false);
    expect(validarDocumento("P", "A-123456").ok).toBe(false);
  });

  it("acepta otros documentos de 3 a 32 caracteres", () => {
    expect(validarDocumento("OTRO", "DOC-1234").ok).toBe(true);
    expect(validarDocumento("OTRO", "AB").ok).toBe(false);
    expect(validarDocumento("OTRO", "x".repeat(33)).ok).toBe(false);
  });

  it("pide el documento cuando está vacío", () => {
    const resultado = validarDocumento("V", "");
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toContain("12345678");
  });
});

describe("validadores — fecha de nacimiento", () => {
  it("acepta una fecha válida en formato AAAA-MM-DD", () => {
    expect(validarFechaNacimiento("1990-05-14").ok).toBe(true);
  });

  it("rechaza otro formato", () => {
    const resultado = validarFechaNacimiento("14/05/1990");
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toContain("AAAA-MM-DD");
  });

  it("rechaza una fecha que no existe", () => {
    expect(validarFechaNacimiento("2026-02-31").ok).toBe(false);
  });

  it("rechaza una fecha futura", () => {
    const resultado = validarFechaNacimiento("2099-01-01");
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toBe("La fecha de nacimiento no puede ser una fecha futura");
  });

  it("rechaza una edad imposible", () => {
    expect(validarFechaNacimiento("1900-01-01").ok).toBe(false);
  });
});

describe("validadores — edad mínima", () => {
  it("acepta a quien cumple la edad mínima", () => {
    expect(validarEdadMinima("2018-01-01", "2026-12-14", 8).ok).toBe(true);
  });

  it("rechaza a quien no cumple la edad mínima", () => {
    const resultado = validarEdadMinima("2018-01-01", "2026-12-14", 12);
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toBe("El pasajero debe tener al menos 12 años para este tour");
  });

  it("pide una fecha válida", () => {
    expect(validarEdadMinima("", "2026-12-14", 3).ok).toBe(false);
  });
});

describe("validadores — teléfono y correo", () => {
  it("acepta un teléfono con espacios y guiones", () => {
    expect(validarTelefono("+58 412 1234567").ok).toBe(true);
    expect(validarTelefono("+58-412-1234567").ok).toBe(true);
  });

  it("rechaza un teléfono muy corto o muy largo", () => {
    const resultado = validarTelefono("12345");
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toBe("Escribe un teléfono válido, por ejemplo +58 412 1234567");
    expect(validarTelefono("+58 412 1234567890123").ok).toBe(false);
  });

  it("acepta un correo válido", () => {
    expect(validarCorreo("nombre@gmail.com").ok).toBe(true);
  });

  it("rechaza un correo inválido", () => {
    const resultado = validarCorreo("nombre@");
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toBe("Escribe un correo válido, por ejemplo nombre@gmail.com");
  });
});

describe("validadores — documentos repetidos", () => {
  it("acepta documentos distintos", () => {
    const resultado = validarDocumentosUnicos([
      { tipo_doc: "V", documento: "12345678" },
      { tipo_doc: "V", documento: "87654321" },
    ]);
    expect(resultado.ok).toBe(true);
    expect(resultado.indiceDuplicado).toBeUndefined();
  });

  it("detecta el documento repetido e indica el pasajero", () => {
    const resultado = validarDocumentosUnicos([
      { tipo_doc: "V", documento: "12345678" },
      { tipo_doc: "V", documento: "87654321" },
      { tipo_doc: "E", documento: "12345678" },
    ]);
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toBe("Este documento ya está en la reserva");
    expect(resultado.indiceDuplicado).toBe(2);
  });

  it("no compara documentos con guiones ni espacios", () => {
    const resultado = validarDocumentosUnicos([
      { tipo_doc: "V", documento: "12345678" },
      { tipo_doc: "V", documento: " 12.345.678 " },
    ]);
    expect(resultado.ok).toBe(false);
    expect(resultado.indiceDuplicado).toBe(1);
  });
});

describe("validadores — titular y categorías", () => {
  it("exige que el titular sea mayor de edad", () => {
    expect(esTitularMayorDeEdad("1990-01-01", "2026-12-14")).toBe(true);
    expect(esTitularMayorDeEdad("2010-01-01", "2026-12-14")).toBe(false);
    expect(esTitularMayorDeEdad("", "2026-12-14")).toBe(false);
  });

  it("lista las categorías con su rango de edad", () => {
    const texto = categoriasDisponibles([
      { categoria: "Adulto" as Categoria, edad_min: 18, edad_max: 120 },
      { categoria: "Niño" as Categoria, edad_min: 3, edad_max: 11 },
    ]);
    expect(texto).toContain("Adulto");
    expect(texto).toContain("desde 18 años");
    expect(texto).toContain("Niño");
    expect(texto).toContain("de 3 a 11 años");
  });

  it("avisa cuando no hay categorías", () => {
    expect(categoriasDisponibles([])).toContain("no hay categorías disponibles");
  });
});

// ---------------------------------------------------------------------------
// Edge cases: fechas límite, documentos hostiles y duplicados cruzados.
// ---------------------------------------------------------------------------

describe("edge cases — fecha de nacimiento", () => {
  it("acepta el 29 de febrero sólo en año bisiesto", () => {
    expect(validarFechaNacimiento("2024-02-29").ok).toBe(true);
    expect(validarFechaNacimiento("2026-02-29").ok).toBe(false);
    expect(validarFechaNacimiento("2100-02-29").ok).toBe(false); // 2100 no es bisiesto
  });

  it("acepta exactamente 120 años y rechaza 121", () => {
    const hoy = new Date();
    const hace = (anios: number) =>
      `${hoy.getFullYear() - anios}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(
        hoy.getDate(),
      ).padStart(2, "0")}`;
    expect(validarFechaNacimiento(hace(120)).ok).toBe(true);
    expect(validarFechaNacimiento(hace(121)).ok).toBe(false);
  });

  it("tolera espacios alrededor de la fecha", () => {
    expect(validarFechaNacimiento("  1990-05-14  ").ok).toBe(true);
  });

  it("rechaza formatos casi válidos", () => {
    expect(validarFechaNacimiento("1990-5-14").ok).toBe(false); // mes sin padding
    expect(validarFechaNacimiento("1990-05-14T00:00:00Z").ok).toBe(false);
    expect(validarFechaNacimiento("0000-01-01").ok).toBe(false); // año 0 no existe
  });
});

describe("edge cases — documento", () => {
  it("acepta cédulas con ceros a la izquierda en el mínimo", () => {
    expect(validarDocumento("V", "000001").ok).toBe(true);
    expect(validarDocumento("V", "0000001").ok).toBe(true); // 7 dígitos
  });

  it("acepta pasaporte en minúsculas", () => {
    expect(validarDocumento("P", "a1234567").ok).toBe(true);
  });

  it("OTRO con sólo espacios cuenta como vacío", () => {
    const resultado = validarDocumento("OTRO", "   ");
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toContain("12345678");
  });

  it("OTRO acepta unicode dentro del rango", () => {
    expect(validarDocumento("OTRO", "ñoño-123").ok).toBe(true);
  });
});

describe("edge cases — documentos repetidos", () => {
  it("detecta la colisión cruzada V vs P con los mismos dígitos", () => {
    // claveDocumento quita no-dígitos para todo tipo ≠ OTRO:
    // "V:123456" y "P:123456" generan la MISMA clave → duplicado.
    const resultado = validarDocumentosUnicos([
      { tipo_doc: "V", documento: "123456" },
      { tipo_doc: "P", documento: "123456" },
    ]);
    expect(resultado.ok).toBe(false);
    expect(resultado.indiceDuplicado).toBe(1);
  });

  it("los documentos vacíos no cuentan como duplicados", () => {
    const resultado = validarDocumentosUnicos([
      { tipo_doc: "V", documento: "" },
      { tipo_doc: "V", documento: "   " },
      { tipo_doc: "V", documento: "---" }, // clave vacía tras quitar dígitos
      { tipo_doc: "V", documento: "12345678" },
    ]);
    expect(resultado.ok).toBe(true);
  });

  it("OTRO compara sin distinguir mayúsculas pero respeta guiones vs espacios", () => {
    const duplicado = validarDocumentosUnicos([
      { tipo_doc: "OTRO", documento: "doc-123" },
      { tipo_doc: "OTRO", documento: "  DOC-123  " },
    ]);
    expect(duplicado.ok).toBe(false);

    // "DOC 1" y "DOC-1" son claves distintas para OTRO (el guion no se borra).
    const distintos = validarDocumentosUnicos([
      { tipo_doc: "OTRO", documento: "DOC 1" },
      { tipo_doc: "OTRO", documento: "DOC-1" },
    ]);
    expect(distintos.ok).toBe(true);
  });

  it("los espacios múltiples de OTRO se colapsan", () => {
    const resultado = validarDocumentosUnicos([
      { tipo_doc: "OTRO", documento: "DOC   123" },
      { tipo_doc: "OTRO", documento: "doc 123" },
    ]);
    expect(resultado.ok).toBe(false);
  });
});

describe("edge cases — teléfono, correo y titular", () => {
  it("teléfono en los límites exactos de dígitos", () => {
    expect(validarTelefono("1234567890").ok).toBe(true); // 10
    expect(validarTelefono("123456789012345").ok).toBe(true); // 15
    expect(validarTelefono("123456789").ok).toBe(false); // 9
    expect(validarTelefono("1234567890123456").ok).toBe(false); // 16
  });

  it("correo con TLD de un carácter se rechaza", () => {
    expect(validarCorreo("a@b.c").ok).toBe(false);
    expect(validarCorreo("a@b.co").ok).toBe(true);
  });

  it("el titular cumple 18 justo el día de la salida", () => {
    expect(esTitularMayorDeEdad("2008-12-14", "2026-12-14")).toBe(true);
    expect(esTitularMayorDeEdad("2008-12-14", "2026-12-13")).toBe(false);
  });

  it("validarEdadMinima acepta al que cumple la edad mínima ese mismo día", () => {
    expect(validarEdadMinima("2018-12-14", "2026-12-14", 8).ok).toBe(true);
    expect(validarEdadMinima("2018-12-14", "2026-12-13", 8).ok).toBe(false);
  });
});

describe("edge cases — categorías disponibles", () => {
  it("edad_max >= 120 se muestra como «desde N años»", () => {
    const texto = categoriasDisponibles([
      { categoria: "Adulto" as Categoria, edad_min: 18, edad_max: 120 },
      { categoria: "Mayor" as Categoria, edad_min: 60, edad_max: 150 },
      { categoria: "Niño" as Categoria, edad_min: 3, edad_max: 119 },
    ]);
    expect(texto).toContain("Adulto: desde 18 años");
    expect(texto).toContain("Mayor: desde 60 años");
    expect(texto).toContain("Niño: de 3 a 119 años");
  });
});
