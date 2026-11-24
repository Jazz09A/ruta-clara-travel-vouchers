import { describe, expect, it } from "vitest";
import type { EstadoReserva } from "@/lib/domain/types";
import {
  esTerminal,
  etiquetaEstado,
  puedeEditar,
  puedeReportarPago,
  puedeTransicionar,
  siguientePaso,
  TRANSICIONES,
  transicionesValidas,
} from "@/lib/domain/state-machine";

const ESTADOS: EstadoReserva[] = [
  "enlace_creado",
  "en_registro",
  "pendiente_firma",
  "pendiente_pago",
  "pago_en_verificacion",
  "confirmada",
  "completada",
  "cancelada",
  "expirada",
];

describe("máquina de estados — transiciones", () => {
  it("define exactamente las transiciones del PRD §6", () => {
    expect(TRANSICIONES).toEqual({
      enlace_creado: ["en_registro", "expirada", "cancelada"],
      en_registro: ["pendiente_firma", "expirada", "cancelada"],
      pendiente_firma: ["confirmada", "pendiente_pago", "cancelada"],
      pendiente_pago: ["pago_en_verificacion", "confirmada", "expirada", "cancelada"],
      pago_en_verificacion: ["confirmada", "pendiente_pago", "cancelada"],
      confirmada: ["cancelada", "completada"],
      completada: [],
      cancelada: [],
      expirada: ["enlace_creado"],
    });
  });

  it("cubre todos los estados de la reserva", () => {
    expect(Object.keys(TRANSICIONES).sort()).toEqual([...ESTADOS].sort());
  });

  it("permite las transiciones declaradas", () => {
    expect(puedeTransicionar("enlace_creado", "en_registro")).toBe(true);
    expect(puedeTransicionar("en_registro", "pendiente_firma")).toBe(true);
    expect(puedeTransicionar("pendiente_firma", "pendiente_pago")).toBe(true);
    expect(puedeTransicionar("pendiente_firma", "confirmada")).toBe(true);
    expect(puedeTransicionar("pendiente_pago", "pago_en_verificacion")).toBe(true);
    expect(puedeTransicionar("pendiente_pago", "confirmada")).toBe(true);
    expect(puedeTransicionar("pago_en_verificacion", "confirmada")).toBe(true);
    expect(puedeTransicionar("confirmada", "completada")).toBe(true);
    expect(puedeTransicionar("expirada", "enlace_creado")).toBe(true);
  });

  it("rechaza las transiciones inválidas", () => {
    expect(puedeTransicionar("enlace_creado", "confirmada")).toBe(false);
    expect(puedeTransicionar("en_registro", "pendiente_pago")).toBe(false);
    expect(puedeTransicionar("completada", "confirmada")).toBe(false);
    expect(puedeTransicionar("cancelada", "en_registro")).toBe(false);
    expect(puedeTransicionar("pendiente_firma", "pago_en_verificacion")).toBe(false);
  });

  it("devuelve una copia de las transiciones válidas", () => {
    const transiciones = transicionesValidas("confirmada");
    expect(transiciones).toEqual(["cancelada", "completada"]);
    transiciones.push("en_registro");
    expect(transicionesValidas("confirmada")).toEqual(["cancelada", "completada"]);
  });

  it("los estados finales no tienen transiciones de salida", () => {
    expect(transicionesValidas("completada")).toEqual([]);
    expect(transicionesValidas("cancelada")).toEqual([]);
  });
});

describe("máquina de estados — flujo de pasos", () => {
  it("avanza paso a paso", () => {
    expect(siguientePaso("paso_registro")).toBe("titular");
    expect(siguientePaso("titular")).toBe("acompanantes");
    expect(siguientePaso("acompanantes")).toBe("preguntas");
    expect(siguientePaso("preguntas")).toBe("resumen");
    expect(siguientePaso("resumen")).toBe("firma");
    expect(siguientePaso("firma")).toBe("confirmada");
    expect(siguientePaso("confirmada")).toBe("cerrada");
  });

  it("no hay siguiente paso al final del flujo", () => {
    expect(siguientePaso("cerrada")).toBeNull();
  });
});

describe("máquina de estados — etiquetas y estado final", () => {
  it("muestra el texto legible del estado", () => {
    expect(etiquetaEstado("enlace_creado")).toBe("Enlace creado");
    expect(etiquetaEstado("pendiente_firma")).toBe("Pendiente de firma");
    expect(etiquetaEstado("pago_en_verificacion")).toBe("Pago en verificación");
    expect(etiquetaEstado("completada")).toBe("Completada");
  });

  it("marca como terminales sólo los estados sin salida", () => {
    expect(esTerminal("completada")).toBe(true);
    expect(esTerminal("cancelada")).toBe(true);
    expect(esTerminal("expirada")).toBe(false);
    expect(esTerminal("confirmada")).toBe(false);
  });
});

describe("máquina de estados — edición y pago", () => {
  it("permite editar mientras la reserva no esté cerrada", () => {
    expect(puedeEditar("enlace_creado")).toBe(true);
    expect(puedeEditar("en_registro")).toBe(true);
    expect(puedeEditar("pendiente_firma")).toBe(true);
    expect(puedeEditar("pendiente_pago")).toBe(true);
    expect(puedeEditar("pago_en_verificacion")).toBe(true);
    expect(puedeEditar("confirmada")).toBe(false);
    expect(puedeEditar("completada")).toBe(false);
    expect(puedeEditar("cancelada")).toBe(false);
    expect(puedeEditar("expirada")).toBe(false);
  });

  it("permite reportar pago sólo cuando la reserva está pendiente de pago", () => {
    expect(puedeReportarPago("pendiente_pago", "sin_pago")).toBe(true);
    expect(puedeReportarPago("pendiente_pago", "parcial")).toBe(true);
    expect(puedeReportarPago("pendiente_pago", "rechazado")).toBe(true);
    expect(puedeReportarPago("pendiente_pago", "reportado")).toBe(false);
    expect(puedeReportarPago("pendiente_pago", "pagado")).toBe(false);
    expect(puedeReportarPago("pendiente_pago", "reembolsado")).toBe(false);
    expect(puedeReportarPago("confirmada", "sin_pago")).toBe(false);
    expect(puedeReportarPago("pendiente_firma", "sin_pago")).toBe(false);
    // Todos los estados no editables bloquean el reporte.
    for (const estado of [
      "enlace_creado",
      "en_registro",
      "pendiente_firma",
      "pago_en_verificacion",
      "confirmada",
      "completada",
      "cancelada",
      "expirada",
    ] as const) {
      expect(puedeReportarPago(estado, "sin_pago")).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases: estados desconocidos, auto-transiciones y pasos huérfanos.
// ---------------------------------------------------------------------------

describe("edge cases — estados desconocidos", () => {
  it("etiquetaEstado devuelve «Estado desconocido» sin lanzar", () => {
    expect(etiquetaEstado("estado_raro" as EstadoReserva)).toBe("Estado desconocido");
  });

  it("puedeEditar devuelve false para un estado desconocido", () => {
    expect(puedeEditar("estado_raro" as EstadoReserva)).toBe(false);
  });

  it("puedeTransicionar/transicionesValidas/esTerminal LANZAN TypeError con estado desconocido", () => {
    // Documentado: TRANSICIONES[desde] es undefined → .includes/.length
    // sobre undefined → TypeError. El tipo lo impide en compilación;
    // en runtime un estado corrupto del servidor rompería la pantalla.
    const raro = "estado_raro" as EstadoReserva;
    expect(() => puedeTransicionar(raro, "cancelada")).toThrow(TypeError);
    expect(() => transicionesValidas(raro)).toThrow(TypeError);
    expect(() => esTerminal(raro)).toThrow(TypeError);
  });

  it("puedeTransicionar con destino desconocido devuelve false sin lanzar", () => {
    expect(puedeTransicionar("confirmada", "estado_raro" as EstadoReserva)).toBe(false);
    expect(puedeTransicionar("cancelada", "enlace_creado")).toBe(false);
  });

  it("ningún estado puede transicionar a sí mismo", () => {
    for (const estado of ESTADOS) {
      expect(puedeTransicionar(estado, estado)).toBe(false);
    }
  });

  it("los estados terminales no aceptan NINGUNA transición de salida", () => {
    for (const destino of ESTADOS) {
      expect(puedeTransicionar("completada", destino)).toBe(false);
      expect(puedeTransicionar("cancelada", destino)).toBe(false);
    }
  });
});

describe("edge cases — flujo de pasos", () => {
  it("siguientePaso devuelve null para un paso desconocido", () => {
    expect(siguientePaso("paso_raro" as never)).toBeNull();
  });

  it("«terminos» es un PasoActual válido que NO está en la lista PASOS", () => {
    // Documentado: types.ts incluye "terminos" en PasoActual pero el array
    // PASOS salta de «preguntas» a «resumen». siguientePaso("terminos")
    // devuelve null (indexOf -1).
    expect(siguientePaso("terminos")).toBeNull();
    expect(siguientePaso("preguntas")).toBe("resumen");
    expect(siguientePaso("resumen")).toBe("firma");
  });
});
