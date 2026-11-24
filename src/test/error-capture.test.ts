import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { consumeLastCapturedError, describeError } from "@/lib/error-capture";

/**
 * `error-capture.ts`: expansión de errores para logging del servidor.
 * Ojo: importar el módulo envuelve `console.error` globalmente (es su
 * propósito); en este archivo aislado eso es aceptable.
 */

describe("describeError", () => {
  it("un Error simple incluye nombre, mensaje y stack", () => {
    const texto = describeError(new Error("algo falló"));
    expect(texto).toContain("algo falló");
    expect(texto).toContain("Error");
  });

  it("recorre la cadena de causes con «caused by:»", () => {
    const interno = new Error("causa raíz");
    const externo = new Error("envoltorio", { cause: interno });
    const texto = describeError(externo);
    expect(texto).toContain("envoltorio");
    expect(texto).toContain("caused by:");
    expect(texto).toContain("causa raíz");
  });

  it("limita la cadena a 5 niveles aunque haya más", () => {
    let error: Error = new Error("nivel-0");
    for (let i = 1; i <= 9; i++) {
      error = new Error(`nivel-${i}`, { cause: error });
    }
    const texto = describeError(error);
    // La causa más profunda (nivel-0) queda fuera del límite de 5.
    expect(texto).not.toContain("nivel-0");
    expect(texto).toContain("nivel-9");
    expect(texto).toContain("nivel-5");
  });

  it("un cause no-Error se serializa o se imprime como string", () => {
    const conObjeto = new Error("wrap", { cause: { codigo: 42 } });
    expect(describeError(conObjeto)).toContain('"codigo":42');

    const conString = new Error("wrap", { cause: "texto plano" });
    expect(describeError(conString)).toContain("texto plano");
  });

  it("un objeto circular no rompe safeStringify", () => {
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;
    const error = new Error("wrap", { cause: circular });
    expect(() => describeError(error)).not.toThrow();
    expect(describeError(error)).toContain("wrap");
  });

  it("añade «(status N)» cuando el error trae status o statusCode", () => {
    const conStatus = Object.assign(new Error("http"), { status: 422 });
    expect(describeError(conStatus)).toContain("(status 422)");

    const conStatusCode = Object.assign(new Error("http"), { statusCode: 500 });
    expect(describeError(conStatusCode)).toContain("(status 500)");

    const sinStatus = new Error("http");
    expect(describeError(sinStatus)).not.toContain("(status");
  });

  it("un valor que no es Error entra directo como texto", () => {
    expect(describeError("fallo simple")).toBe("fallo simple");
    expect(describeError(42)).toBe("42");
    expect(describeError(null)).toBe("");
    expect(describeError(undefined)).toBe("");
  });

  it("trunca la salida a 8000 caracteres", () => {
    const gigante = new Error("x".repeat(20_000));
    expect(describeError(gigante).length).toBeLessThanOrEqual(8_000);
  });
});

describe("consumeLastCapturedError", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    // Drena lo capturado para no filtrar estado entre tests.
    consumeLastCapturedError();
    vi.useRealTimers();
  });

  it("devuelve undefined cuando no hay nada capturado", () => {
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("console.error con un Error lo registra y consume lo devuelve una sola vez", () => {
    const error = new Error("boom");
    console.error(error);
    expect(consumeLastCapturedError()).toBe(error);
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("console.error con valores no-Error no registra nada", () => {
    console.error("texto", 42, { a: 1 });
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("un error capturado expira pasado el TTL de 5 segundos", () => {
    console.error(new Error("viejo"));
    vi.setSystemTime(new Date("2026-01-01T00:00:06Z")); // +6 s > TTL 5 s
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("dentro del TTL el error sigue disponible", () => {
    const error = new Error("fresco");
    console.error(error);
    vi.setSystemTime(new Date("2026-01-01T00:00:04Z")); // +4 s < TTL
    expect(consumeLastCapturedError()).toBe(error);
  });
});
