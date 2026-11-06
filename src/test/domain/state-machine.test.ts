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
      pendiente_firma: ["pendiente_pago", "cancelada"],
      pendiente_pago: ["pago_en_verificacion", "expirada", "cancelada"],
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
    expect(puedeTransicionar("pendiente_pago", "pago_en_verificacion")).toBe(true);
    expect(puedeTransicionar("pago_en_verificacion", "confirmada")).toBe(true);
    expect(puedeTransicionar("confirmada", "completada")).toBe(true);
    expect(puedeTransicionar("expirada", "enlace_creado")).toBe(true);
  });

  it("rechaza las transiciones inválidas", () => {
    expect(puedeTransicionar("enlace_creado", "confirmada")).toBe(false);
    expect(puedeTransicionar("en_registro", "pendiente_pago")).toBe(false);
    expect(puedeTransicionar("completada", "confirmada")).toBe(false);
    expect(puedeTransicionar("cancelada", "en_registro")).toBe(false);
    expect(puedeTransicionar("pendiente_firma", "pendiente_pago")).toBe(true);
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
    expect(siguientePaso("firma")).toBe("pago");
    expect(siguientePaso("pago")).toBe("verificacion");
    expect(siguientePaso("verificacion")).toBe("confirmada");
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
    expect(puedeReportarPago("confirmada", "sin_pago")).toBe(false);
    expect(puedeReportarPago("pendiente_firma", "sin_pago")).toBe(false);
  });
});
