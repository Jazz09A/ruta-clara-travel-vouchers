import { describe, expect, it } from "vitest";

import { rutaNotificacion } from "@/lib/domain/notificaciones";

describe("rutaNotificacion — la campana lleva directo a la entidad", () => {
  it("una reserva lleva a su detalle, no a la lista con ?id=", () => {
    const ruta = rutaNotificacion({
      tipo: "reserva",
      titulo: "Voucher generado",
      detalle: "El voucher de la reserva VJ-2026-00012 está listo.",
      entidad_id: "res_012",
    });
    expect(ruta).toBe("/admin/reservas/res_012");
    expect(ruta).not.toContain("?id=");
  });

  it("un pago lleva al detalle del pago", () => {
    const ruta = rutaNotificacion({
      tipo: "pago",
      titulo: "Pago reportado",
      detalle: "Andrea Ríos reportó un pago de $55.00.",
      entidad_id: "pag_001",
    });
    expect(ruta).toBe("/admin/pagos/pag_001");
  });

  it("una salida lleva al detalle de la fecha de tour", () => {
    const ruta = rutaNotificacion({
      tipo: "salida",
      titulo: "Salida casi llena",
      detalle: "Full Day Los Roques tiene 2 cupos libres.",
      entidad_id: "fch_roq_02",
    });
    expect(ruta).toBe("/admin/salidas/fch_roq_02");
  });

  it("una exportación lleva a reportes (no existe detalle de exportación)", () => {
    const ruta = rutaNotificacion({
      tipo: "sistema",
      titulo: "Exportación lista",
      detalle: "Tu reporte de reservas está listo para descargar.",
      entidad_id: "exp_009",
    });
    expect(ruta).toBe("/admin/reportes");
  });

  it("sin entidad cae a la lista del tipo", () => {
    expect(rutaNotificacion({ tipo: "pago", titulo: "Aviso", detalle: "Sin entidad" })).toBe(
      "/admin/pagos",
    );
    expect(rutaNotificacion({ tipo: "sistema", titulo: "Mantenimiento", detalle: "..." })).toBe(
      "/admin",
    );
  });
});
