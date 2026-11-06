import { beforeEach, describe, expect, it } from "vitest";

import { addDecimals } from "@/lib/format";
import type {
  Categoria,
  EstadoReserva,
  FormVersion,
  PasoActual,
  Reserva,
  Tarifa,
} from "@/lib/domain/types";

import { CREDENCIALES_DEMO, crearSeed, type SeedData } from "@/lib/mock/seed";
import {
  actualizar,
  buscarPorId,
  crearNotificacion,
  eliminar,
  insertar,
  listar,
  obtenerDb,
  registrarAuditoria,
  resetDb,
  siguienteCodigoReserva,
  siguienteRefCorta,
} from "@/lib/mock/db";

const seed: SeedData = crearSeed();

const CATEGORIAS_ESPERADAS: Categoria[] = ["Adulto", "Niño", "Tercera Edad", "Infante"];

/** `paso_actual` esperado para cada estado (Spec Frontend §4.2). */
const PASO_POR_ESTADO: Record<EstadoReserva, PasoActual> = {
  enlace_creado: "paso_registro",
  en_registro: "titular",
  pendiente_firma: "firma",
  pendiente_pago: "pago",
  pago_en_verificacion: "verificacion",
  confirmada: "confirmada",
  completada: "cerrada",
  cancelada: "cerrada",
  expirada: "cerrada",
};

function formDeReserva(reserva: Reserva): FormVersion {
  const version = seed.form_versiones.find((item) => item.id === reserva.form_version_id);
  if (!version) throw new Error(`Falta la versión de formulario ${reserva.form_version_id}`);
  return version;
}

function tarifaDe(fechaId: string, categoria: Categoria): Tarifa {
  const tarifa = seed.tarifas.find(
    (item) => item.fecha_tour_id === fechaId && item.categoria === categoria,
  );
  if (!tarifa) throw new Error(`Falta la tarifa de ${categoria} para ${fechaId}`);
  return tarifa;
}

describe("seed — catálogo", () => {
  it("los tours activos apuntan a una versión de formulario publicada", () => {
    const activos = seed.tours.filter((tour) => tour.estado === "activo");
    expect(activos.length).toBeGreaterThan(0);

    for (const tour of activos) {
      const version = seed.form_versiones.find((item) => item.id === tour.form_version_actual_id);
      expect(version, `El tour ${tour.nombre} no tiene versión de formulario actual`).toBeDefined();
      expect(version?.tour_id).toBe(tour.id);
      expect(version?.estado).toBe("publicada");
    }
  });

  it("el tour en borrador conserva una versión de formulario sin publicar (requisitos pendientes)", () => {
    const borrador = seed.tours.find((tour) => tour.estado === "borrador");
    expect(borrador).toBeDefined();

    const version = seed.form_versiones.find(
      (item) => item.id === borrador?.form_version_actual_id,
    );
    expect(version?.estado).toBe("borrador");
  });

  it("cada fecha tiene exactamente una tarifa por categoría y todas apuntan a fechas existentes", () => {
    const idsFechas = new Set(seed.fechas.map((fecha) => fecha.id));

    for (const tarifa of seed.tarifas) {
      expect(idsFechas.has(tarifa.fecha_tour_id)).toBe(true);
    }

    for (const fecha of seed.fechas) {
      const tarifas = seed.tarifas.filter((tarifa) => tarifa.fecha_tour_id === fecha.id);
      expect(tarifas, `La fecha ${fecha.id} no tiene 4 tarifas`).toHaveLength(4);
      expect(tarifas.map((tarifa) => tarifa.categoria).sort()).toEqual(
        [...CATEGORIAS_ESPERADAS].sort(),
      );
    }
  });

  it("la configuración apunta a un tour activo existente", () => {
    const tour = seed.tours.find((item) => item.id === seed.config.tour_activo_default);
    expect(tour).toBeDefined();
    expect(tour?.estado).toBe("activo");
  });

  it("las credenciales de la demo apuntan a usuarios activos", () => {
    expect(CREDENCIALES_DEMO).toHaveLength(4);

    for (const credencial of CREDENCIALES_DEMO) {
      const usuario = seed.usuarios.find((item) => item.correo === credencial.correo);
      expect(usuario, `No existe el usuario ${credencial.correo}`).toBeDefined();
      expect(usuario?.activo).toBe(true);
      expect(usuario?.rol).toBe(credencial.rol);
      expect(credencial.password).toBe("demo1234");
    }
  });
});

describe("seed — reservas", () => {
  it("toda reserva referencia una fecha y una versión de formulario existentes", () => {
    const idsFechas = new Set(seed.fechas.map((fecha) => fecha.id));
    const idsFormularios = new Set(seed.form_versiones.map((version) => version.id));

    for (const reserva of seed.reservas) {
      expect(idsFechas.has(reserva.fecha_tour_id), `Fecha inválida en ${reserva.codigo}`).toBe(
        true,
      );
      expect(
        idsFormularios.has(reserva.form_version_id),
        `Formulario inválido en ${reserva.codigo}`,
      ).toBe(true);
    }
  });

  it("cada reserva con pasajeros tiene exactamente un titular y ningún pasajero duplicado", () => {
    for (const reserva of seed.reservas) {
      // Una reserva sin datos del cliente todavía es válida: el enlace puede
      // estar creado (`enlace_creado`) o el cliente puede haber pulsado el botón
      // «Comenzar» sin llenar el formulario del titular (`en_registro`).
      if (reserva.pasajeros.length === 0) {
        expect(["enlace_creado", "en_registro"]).toContain(reserva.estado);
        continue;
      }

      const titulares = reserva.pasajeros.filter((pasajero) => pasajero.es_titular);
      expect(titulares.length, `La reserva ${reserva.codigo} debe tener un titular`).toBe(1);

      if (titulares[0]) {
        expect(titulares[0].nombre.length).toBeGreaterThan(0);
        expect(titulares[0].documento.length).toBeGreaterThan(0);
      }

      const documentos = reserva.pasajeros.map((pasajero) => pasajero.documento);
      expect(new Set(documentos).size).toBe(documentos.length);
    }
  });

  it("las respuestas solo usan campos existentes en el snapshot del formulario de la reserva", () => {
    for (const reserva of seed.reservas) {
      const version = formDeReserva(reserva);
      const campos = new Set(version.definicion.campos.map((campo) => campo.id));

      for (const pasajero of reserva.pasajeros) {
        for (const campo of Object.keys(pasajero.respuestas)) {
          expect(
            campos.has(campo),
            `El pasajero de ${reserva.codigo} responde un campo inexistente: ${campo}`,
          ).toBe(true);
        }
      }

      for (const campo of Object.keys(reserva.respuestas_globales)) {
        expect(
          campos.has(campo),
          `La reserva ${reserva.codigo} responde un campo global inexistente: ${campo}`,
        ).toBe(true);
      }
    }
  });

  it("el total coincide con la suma de tarifas por pasajero más los adicionales", () => {
    for (const reserva of seed.reservas) {
      let total = "0.00";

      for (const pasajero of reserva.pasajeros) {
        total = addDecimals(total, tarifaDe(reserva.fecha_tour_id, pasajero.categoria).precio_usd);
      }

      const cantidadToldo = reserva.respuestas_globales["toldo"];
      if (typeof cantidadToldo === "number") {
        const campoToldo = formDeReserva(reserva).definicion.campos.find(
          (campo) => campo.id === "toldo",
        );
        const precioToldo = campoToldo?.precio_usd ?? "0.00";
        total = addDecimals(total, (Number.parseFloat(precioToldo) * cantidadToldo).toFixed(2));
      }

      const descuento = reserva.promocion?.descuento_usd;
      if (descuento !== undefined) {
        total = addDecimals(total, `-${descuento}`);
      }

      expect(reserva.total_usd, `Total incorrecto en ${reserva.codigo}`).toBe(total);
    }
  });

  it("saldo y total son consistentes entre sí", () => {
    for (const reserva of seed.reservas) {
      const total = Number.parseFloat(reserva.total_usd);
      const saldo = Number.parseFloat(reserva.saldo_usd);

      expect(Number.isFinite(total), `Total inválido en ${reserva.codigo}`).toBe(true);
      expect(Number.isFinite(saldo), `Saldo inválido en ${reserva.codigo}`).toBe(true);
      expect(total).toBeGreaterThanOrEqual(0);
      expect(saldo).toBeGreaterThanOrEqual(0);
      expect(saldo).toBeLessThanOrEqual(total);
    }
  });

  it("el paso actual es coherente con el estado de la reserva", () => {
    for (const reserva of seed.reservas) {
      // En `en_registro` el cliente puede estar en cualquiera de sus tres pasos.
      if (reserva.estado === "en_registro") {
        expect(["titular", "acompanantes", "preguntas"]).toContain(reserva.paso_actual);
        continue;
      }
      const esperado = PASO_POR_ESTADO[reserva.estado];
      expect(reserva.paso_actual, `Paso incoherente en ${reserva.codigo}`).toBe(esperado);
    }

    // Los estados "en_registro" pueden estar en cualquiera de sus tres pasos.
    const pasosEnRegistro = seed.reservas
      .filter((reserva) => reserva.estado === "en_registro")
      .map((reserva) => reserva.paso_actual);
    expect(pasosEnRegistro).toEqual(
      expect.arrayContaining(["titular", "acompanantes", "preguntas"]),
    );
  });

  it("cubre todos los estados de reserva y tiene códigos y referencias únicos", () => {
    const estados = new Set(seed.reservas.map((reserva) => reserva.estado));
    for (const estado of Object.keys(PASO_POR_ESTADO) as EstadoReserva[]) {
      expect(estados.has(estado), `Faltan reservas en estado ${estado}`).toBe(true);
    }

    const codigos = seed.reservas.map((reserva) => reserva.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    for (const codigo of codigos) {
      expect(codigo).toMatch(/^VJ-2026-\d{5}$/);
    }

    const refs = seed.reservas.map((reserva) => reserva.ref_corta);
    expect(new Set(refs).size).toBe(refs.length);
    for (const ref of refs) {
      // Longitud fijada por el Spec Backend D-01 (`ref_corta char(8)`).
      expect(ref).toMatch(/^[A-Z0-9]{8}$/);
    }
  });

  it("las reservas con pago aplicado tienen la tasa congelada", () => {
    for (const reserva of seed.reservas) {
      if (reserva.estado_pago === "pagado" || reserva.estado_pago === "reembolsado") {
        expect(reserva.tasa_aplicada, `La reserva ${reserva.codigo} debe tener tasa`).toBe("36.50");
      }
    }
  });
});

describe("seed — enlaces, pagos y verificaciones", () => {
  it("los tokens de enlace apuntan a reservas existentes y no se repiten", () => {
    const idsReservas = new Set(seed.reservas.map((reserva) => reserva.id));
    const destinos = Object.values(seed.enlaces);

    expect(destinos.length).toBeGreaterThan(0);
    expect(new Set(destinos).size).toBe(destinos.length);

    for (const [token, reservaId] of Object.entries(seed.enlaces)) {
      expect(token.length).toBeGreaterThan(0);
      expect(idsReservas.has(reservaId), `El token ${token} apunta a una reserva inexistente`).toBe(
        true,
      );
    }
  });

  it("expone los tokens de demo acordados y no expone un token inválido", () => {
    const tokens = [
      "demo1",
      "demo-firma",
      "demo-pago",
      "demo-pago-urgente",
      "demo-ventana",
      "demo-verif",
      "demo-confirmada",
      "demo-cancelada",
      "demo-expirada",
      "demo-completada",
      "demo-enregistro",
    ];

    for (const token of tokens) {
      expect(seed.enlaces[token], `Falta el token ${token}`).toBeDefined();
    }
    expect(seed.enlaces["demo-invalido"]).toBeUndefined();
  });

  it("los tokens de verificación QR apuntan a reservas existentes", () => {
    const idsReservas = new Set(seed.reservas.map((reserva) => reserva.id));

    for (const [token, reservaId] of Object.entries(seed.verificaciones)) {
      expect(idsReservas.has(reservaId)).toBe(true);
    }
    expect(Object.keys(seed.verificaciones)).toEqual(
      expect.arrayContaining(["qr-confirmada", "qr-cancelada", "qr-completada", "qr-reprogramada"]),
    );
  });

  it("los importes de los pagos son cadenas numéricas válidas", () => {
    for (const pago of seed.pagos) {
      expect(pago.monto).toMatch(/^\d+(\.\d{1,2})?$/);
      expect(Number.isFinite(Number.parseFloat(pago.monto))).toBe(true);
      expect(Number.parseFloat(pago.monto)).toBeGreaterThan(0);
      expect(pago.referencia.length).toBeGreaterThan(0);
    }
  });

  it("incluye el caso de pago duplicado, el rechazo y la diferencia de monto", () => {
    const duplicado = seed.pagos.find((pago) => pago.duplicado_de_pago_id !== undefined);
    expect(duplicado).toBeDefined();
    expect(duplicado?.alertas.some((alerta) => alerta.codigo === "duplicado_referencia")).toBe(
      true,
    );
    expect(buscarPorId("pagos", duplicado?.duplicado_de_pago_id ?? "")).toBeDefined();

    const rechazado = seed.pagos.find((pago) => pago.estado === "rechazado");
    expect(rechazado?.motivo_rechazo).toBe("comprobante_ilegible");

    const correccion = seed.pagos.find((pago) => pago.estado === "correccion_solicitada");
    expect(correccion?.comentario_validador?.length).toBeGreaterThan(0);

    // El pago móvil reportado no coincide con el total de su reserva (diferencia).
    const conDiferencia = seed.pagos.find(
      (pago) => pago.moneda === "VES" && pago.estado === "reportado",
    );
    expect(conDiferencia).toBeDefined();
  });

  it("todos los pagos pertenecen a reservas existentes", () => {
    const idsReservas = new Set(seed.reservas.map((reserva) => reserva.id));

    for (const pago of seed.pagos) {
      expect(idsReservas.has(pago.reserva_id)).toBe(true);
    }
  });
});

describe("seed — determinismo", () => {
  it("dos semillas producen los mismos identificadores", () => {
    const otra = crearSeed();

    expect(otra.reservas.map((reserva) => reserva.codigo)).toEqual(
      seed.reservas.map((reserva) => reserva.codigo),
    );
    expect(otra.reservas.map((reserva) => reserva.ref_corta)).toEqual(
      seed.reservas.map((reserva) => reserva.ref_corta),
    );
    expect(otra.reservas.map((reserva) => reserva.pasajeros.map((p) => p.ref_cliente))).toEqual(
      seed.reservas.map((reserva) => reserva.pasajeros.map((p) => p.ref_cliente)),
    );
    expect(otra.terminos.map((termino) => termino.hash)).toEqual(
      seed.terminos.map((termino) => termino.hash),
    );
  });
});

describe("db — estado en memoria", () => {
  beforeEach(() => {
    resetDb();
  });

  it("resetDb restaura el dataset inicial", () => {
    const db = obtenerDb();
    expect(db.data.reservas.length).toBeGreaterThan(0);
    expect(Object.keys(db.indices.reservas)).toHaveLength(db.data.reservas.length);
  });

  it("insertar, actualizar y eliminar mantienen el índice sincronizado", () => {
    const antes = listar<Reserva>("reservas").length;

    insertar("reservas", {
      id: "res_test",
      codigo: "VJ-2026-99999",
      ref_corta: "TEST0001",
      fecha_tour_id: "fch_roq_01",
      form_version_id: "form_roques_v1",
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
      creado_en: new Date().toISOString(),
      ultima_actividad_en: new Date().toISOString(),
    });

    expect(listar<Reserva>("reservas").length).toBe(antes + 1);
    expect(buscarPorId<Reserva>("reservas", "res_test")).toBeDefined();

    actualizar<Reserva>("reservas", "res_test", { estado: "en_registro", paso_actual: "titular" });
    expect(buscarPorId<Reserva>("reservas", "res_test")?.paso_actual).toBe("titular");

    eliminar("reservas", "res_test");
    expect(listar<Reserva>("reservas").length).toBe(antes);
    expect(buscarPorId<Reserva>("reservas", "res_test")).toBeUndefined();
  });

  it("siguienteCodigoReserva y siguienteRefCorta no repiten valores existentes", () => {
    const codigo = siguienteCodigoReserva();
    expect(codigo).toMatch(/^VJ-2026-\d{5}$/);
    expect(listar<Reserva>("reservas").map((reserva) => reserva.codigo)).not.toContain(codigo);

    const ref = siguienteRefCorta();
    expect(ref).toMatch(/^[A-Z0-9]{8}$/);
    expect(listar<Reserva>("reservas").map((reserva) => reserva.ref_corta)).not.toContain(ref);
  });

  it("registrarAuditoria y crearNotificacion escriben en el estado", () => {
    const auditoria = registrarAuditoria({
      usuario_id: "usr_sa_1",
      usuario_nombre: "Manuel Rodríguez",
      entidad: "reserva",
      entidad_id: "res_001",
      accion: "enlace.regenerado",
      valor_anterior: "enlace-oculto",
      valor_nuevo: "enlace-nuevo",
    });

    expect(auditoria.cadena).toBe("ok");
    expect(buscarPorId("auditoria", auditoria.id)).toBeDefined();

    const notificacion = crearNotificacion({
      tipo: "pago",
      titulo: "Pago reportado",
      detalle: "Hay un pago por validar.",
    });

    expect(notificacion.leida).toBe(false);
    expect(buscarPorId("notificaciones", notificacion.id)).toBeDefined();
  });
});
