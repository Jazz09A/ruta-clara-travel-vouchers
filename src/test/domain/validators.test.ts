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
