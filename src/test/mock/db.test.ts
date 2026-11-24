import { beforeEach, describe, expect, it } from "vitest";

import type { Reserva } from "@/lib/domain/types";
import {
  actualizar,
  buscarPorId,
  crearNotificacion,
  eliminar,
  insertar,
  listar,
  obtenerDb,
  persistenciaActiva,
  registrarAuditoria,
  resetDb,
  siguienteCodigoReserva,
  siguienteRefCorta,
} from "@/lib/mock/db";

/** Reserva mínima para probar la db sin armar el seed completo. */
function reservaFake(id: string, codigo: string): Reserva {
  return {
    id,
    codigo,
    ref_corta: "REF00001",
    tour_id: "tour_x",
    fecha_tour_id: "fch_x",
    formulario_id: "form_x",
    estado: "enlace_creado",
    estado_pago: "sin_pago",
    pasajeros: [],
    respuestas_globales: {},
    total_usd: "0.00",
    saldo_usd: "0.00",
    tasa_aplicada: null,
    expira_en: null,
    version: 1,
    paso_actual: "paso_registro",
    creado_en: "2026-01-01T00:00:00.000Z",
    ultima_actividad_en: "2026-01-01T00:00:00.000Z",
  } as unknown as Reserva;
}

describe("db — persistencia", () => {
  it("la persistencia en localStorage está desactivada a propósito", () => {
    expect(persistenciaActiva).toBe(false);
  });
});

describe("db — lecturas hostiles", () => {
  beforeEach(() => resetDb());

  it("buscarPorId devuelve undefined para ids inexistentes", () => {
    expect(buscarPorId("reservas", "no_existe")).toBeUndefined();
    expect(buscarPorId("reservas", "")).toBeUndefined();
  });

  it("buscarPorId con claves mágicas devuelve el prototipo (documentado)", () => {
    // BUG/quirk documentado: el índice es un objeto plano, así que
    // "__proto__" resuelve a Object.prototype y "constructor" a la función
    // Object — ambos truthy. Un id así jamás existe en la db real, pero un
    // caller que confíe en `!== undefined` se llevaría un objeto basura.
    expect(buscarPorId("reservas", "__proto__")).toBeDefined();
    expect(buscarPorId("reservas", "constructor")).toBeDefined();
  });

  it("listar devuelve una copia: mutarla no corrompe la db", () => {
    const reservas = listar<Reserva>("reservas");
    const antes = reservas.length;
    reservas.length = 0; // vaciar la copia
    reservas.push(reservaFake("fake", "VJ-2026-99999"));

    expect(listar<Reserva>("reservas")).toHaveLength(antes);
    expect(buscarPorId<Reserva>("reservas", "fake")).toBeUndefined();
  });
});

describe("db — escrituras hostiles", () => {
  beforeEach(() => resetDb());

  it("actualizar un id inexistente lanza un error descriptivo", () => {
    expect(() => actualizar<Reserva>("reservas", "no_existe", { estado: "cancelada" })).toThrow(
      'No existe el elemento "no_existe" en la colección "reservas"',
    );
  });

  it("eliminar un id inexistente es un no-op silencioso", () => {
    const antes = listar<Reserva>("reservas").length;
    eliminar("reservas", "no_existe");
    expect(listar<Reserva>("reservas")).toHaveLength(antes);
    // Y eliminar dos veces el mismo id tampoco falla.
    eliminar("reservas", "no_existe");
    expect(listar<Reserva>("reservas")).toHaveLength(antes);
  });

  it("insertar con id duplicado deja el índice apuntando al último", () => {
    insertar("reservas", reservaFake("dup", "VJ-2026-00001"));
    const segundo = reservaFake("dup", "VJ-2026-00002");
    insertar("reservas", segundo);

    // La colección tiene ambos; el índice resuelve al último insertado.
    const todas = listar<Reserva>("reservas").filter((r) => r.id === "dup");
    expect(todas).toHaveLength(2);
    expect(buscarPorId<Reserva>("reservas", "dup")?.codigo).toBe("VJ-2026-00002");
  });
});

describe("db — siguienteCodigoReserva con códigos hostiles", () => {
  beforeEach(() => resetDb());

  it("ignora códigos de otros años y otros formatos", () => {
    insertar("reservas", reservaFake("r1", "VJ-2027-99999")); // otro prefijo
    insertar("reservas", reservaFake("r2", "XXXX-2026-99999"));
    insertar("reservas", reservaFake("r3", "VJ-2026-ABC")); // sufijo no numérico
    insertar("reservas", reservaFake("r4", "VJ-2026-12345-extra")); // parseInt se detiene
    insertar("reservas", reservaFake("r5", "VJ-2026-00007"));

    // El mayor correlativo válido es 12345 (parseInt("12345-extra")=12345).
    expect(siguienteCodigoReserva()).toBe("VJ-2026-12346");
  });

  it("el correlativo no tiene que ser contiguo: toma el máximo", () => {
    resetDb();
    insertar("reservas", reservaFake("r1", "VJ-2026-00001"));
    insertar("reservas", reservaFake("r2", "VJ-2026-00999")); // salto grande
    expect(siguienteCodigoReserva()).toBe("VJ-2026-01000");
  });

  it("sin reservas con el prefijo arranca en 00001", () => {
    // Forzamos un estado donde ninguna reserva usa el prefijo VJ-2026-.
    resetDb();
    const db = obtenerDbReservas();
    db.length = 0;
    expect(siguienteCodigoReserva()).toBe("VJ-2026-00001");
  });
});

function obtenerDbReservas(): Reserva[] {
  return obtenerDb().data.reservas;
}

describe("db — contadores que sobreviven al reset", () => {
  it("resetDb NO reinicia los contadores de auditoría y notificaciones", () => {
    resetDb();
    const aud1 = registrarAuditoria({
      usuario_id: "u1",
      usuario_nombre: "Test",
      entidad: "reserva",
      entidad_id: "r1",
      accion: "prueba",
      valor_anterior: "{}",
      valor_nuevo: "{}",
    });
    const aud2 = registrarAuditoria({
      usuario_id: "u1",
      usuario_nombre: "Test",
      entidad: "reserva",
      entidad_id: "r1",
      accion: "prueba",
      valor_anterior: "{}",
      valor_nuevo: "{}",
    });
    // Los ids nunca se repiten aunque se haya hecho reset.
    expect(aud1.id).not.toBe(aud2.id);
    expect(aud1.cadena).toBe("ok");
    expect(aud1.fecha).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    resetDb();
    const aud3 = registrarAuditoria({
      usuario_id: "u1",
      usuario_nombre: "Test",
      entidad: "reserva",
      entidad_id: "r1",
      accion: "prueba",
      valor_anterior: "{}",
      valor_nuevo: "{}",
    });
    expect(aud3.id).not.toBe(aud1.id);
    expect(aud3.id).not.toBe(aud2.id);
    // Y ya no está en la db (el reset borró las anteriores).
    expect(buscarPorId("auditoria", aud1.id)).toBeUndefined();
  });

  it("crearNotificacion siempre nace sin leer y con id único", () => {
    resetDb();
    const n1 = crearNotificacion({ tipo: "pago", titulo: "t", detalle: "d" });
    const n2 = crearNotificacion({ tipo: "pago", titulo: "t", detalle: "d" });
    expect(n1.leida).toBe(false);
    expect(n2.leida).toBe(false);
    expect(n1.id).not.toBe(n2.id);
    expect(n1.id).toMatch(/^not_/);
    expect(n1.fecha).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("db — siguienteRefCorta", () => {
  it("genera refs únicas aunque se llamen muchas veces seguidas", () => {
    resetDb();
    const refs = new Set<string>();
    for (let i = 0; i < 50; i++) {
      refs.add(siguienteRefCorta());
    }
    expect(refs.size).toBe(50);
    for (const ref of refs) {
      expect(ref).toMatch(/^[A-Z0-9]{8}$/);
    }
  });
});
