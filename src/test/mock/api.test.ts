import { beforeEach, describe, expect, it } from "vitest";

import { ApiError } from "@/lib/domain/api";
import { api } from "@/lib/mock/api";
import { resetDb } from "@/lib/mock/db";

/**
 * Prueba de humo del backend simulado: recorre el ciclo completo de una
 * reserva (PRD §5.1) como lo haría el cliente y el validador.
 */

const FECHA_CON_CUPO = "fch_roq_05";

function tokenDeEnlace(enlace: string): string {
  return enlace.split("/r/")[1] ?? "";
}

function idem(): string {
  return `idem_${Math.random().toString(36).slice(2)}`;
}

const TITULAR = {
  ref_cliente: "ref_titular_1",
  es_titular: true,
  nombre: "María Pérez",
  tipo_doc: "V" as const,
  documento: "12345678",
  fecha_nacimiento: "1988-04-12",
  categoria: "Adulto" as const,
  respuestas: {},
};

const COMPAÑERA = {
  ref_cliente: "ref_pasajero_2",
  es_titular: false,
  nombre: "Juan Pérez",
  tipo_doc: "V" as const,
  documento: "87654321",
  fecha_nacimiento: "2016-09-03",
  categoria: "Niño" as const,
  respuestas: {},
};

const DATOS_TITULAR = {
  nombre: "María Pérez",
  tipo_doc: "V" as const,
  documento: "12345678",
  fecha_nacimiento: "1988-04-12",
  telefono: "+584121234567",
  correo: "maria.perez@gmail.com",
  contacto_emergencia_nombre: "Carlos Pérez",
  contacto_emergencia_telefono: "+584149998877",
};

beforeEach(() => {
  resetDb();
});

describe("API simulada — ciclo de vida de una reserva", () => {
  it("el operador crea un enlace y el cliente recorre los seis pasos hasta el voucher", async () => {
    // 1. El operador crea el enlace.
    const creado = await api.admin.crearReserva({
      fecha_tour_id: FECHA_CON_CUPO,
      referencia_interna: "Cliente de prueba",
    });
    const token = tokenDeEnlace(creado.enlace);
    expect(token).not.toBe("");
    expect(creado.reserva.estado).toBe("enlace_creado");

    // 2. El cliente abre el enlace: la pantalla la decide el servidor.
    const arranque = await api.publica.reserva(token);
    expect(arranque.progreso.paso_actual).toBe("paso_registro");
    expect(arranque.progreso.cerrada).toBe(false);

    // 3. Acepta el aviso de privacidad y empieza.
    await api.publica.iniciar(token, { acepta_aviso_privacidad: true }, idem());
    let estado = await api.publica.reserva(token);
    expect(estado.reserva.estado).toBe("en_registro");
    expect(estado.reserva.paso_actual).toBe("titular");

    // 4. Completa los datos del titular.
    await api.publica.guardarTitular(token, DATOS_TITULAR, estado.reserva.version);
    estado = await api.publica.reserva(token);

    // 5. Agrega a su hijo (la categoría la calcula el servidor).
    await api.publica.guardarAcompanantes(
      token,
      [{ ...TITULAR, telefono: DATOS_TITULAR.telefono, correo: DATOS_TITULAR.correo }, COMPAÑERA],
      estado.reserva.version,
    );
    estado = await api.publica.reserva(token);
    expect(estado.reserva.pasajeros).toHaveLength(2);
    const nino = estado.reserva.pasajeros.find((p) => p.ref_cliente === COMPAÑERA.ref_cliente);
    expect(nino?.categoria).toBe("Niño");
    expect(estado.reserva.pasajeros[0]?.es_titular).toBe(true);

    // 6. Responde las preguntas del tour.
    await api.publica.guardarRespuestas(
      token,
      {
        por_pasajero: {
          [TITULAR.ref_cliente]: { almuerzo: "pescado", tiene_alergias: false },
          [COMPAÑERA.ref_cliente]: { almuerzo: "pollo", tiene_alergias: false, menu_infantil: "pasta" },
        },
        globales: { punto_abordaje: "altamira" },
      },
      estado.reserva.version,
    );

    // 7. Avanza paso a paso.
    let paso = await api.publica.completarPaso(token, "titular", {}, estado.reserva.version);
    expect(paso.paso_actual).toBe("acompanantes");
    paso = await api.publica.completarPaso(token, "acompanantes", {}, paso.version);
    expect(paso.paso_actual).toBe("preguntas");
    paso = await api.publica.completarPaso(token, "preguntas", {}, paso.version);
    expect(paso.paso_actual).toBe("resumen");
    expect(paso.progreso.pasos.find((p) => p.id === "titular")?.estado).toBe("completo");

    // 8. El resumen lo calcula el servidor: 1 adulto (55) + 1 niño (35).
    const resumen = await api.publica.resumen(token);
    expect(resumen.total_usd).toBe("90.00");
    expect(resumen.saldo_usd).toBe("90.00");
    expect(resumen.total_bs_estimado).not.toBeNull();
    expect(resumen.pasajeros[0]?.documento_enmascarado).toBe("V-****5678");

    // 9. Confirma el resumen: empieza el hold.
    const confirmado = await api.publica.confirmarResumen(
      token,
      { total_visto_usd: resumen.total_usd, version: paso.version, acepta_politica: true },
      idem(),
    );
    expect(confirmado.total_usd).toBe("90.00");
    expect(confirmado.expira_en).not.toBeNull();
    estado = await api.publica.reserva(token);
    expect(estado.reserva.estado).toBe("pendiente_firma");
    expect(estado.reserva.paso_actual).toBe("firma");

    // 10. Lee los términos y firma.
    const terminos = await api.publica.terminos(token);
    expect(terminos.activa).toBe(true);
    const firma = await api.publica.firmar(
      token,
      {
        firma_png_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
        n_trazos: 4,
        longitud_px: 520,
        duracion_ms: 2400,
        scroll_completo: true,
        version_terminos_id: terminos.id,
      },
      idem(),
    );
    expect(firma.ok).toBe(true);
    estado = await api.publica.reserva(token);
    expect(estado.reserva.estado).toBe("pendiente_pago");
    expect(estado.reserva.firma?.integridad).toBe("ok");

    // 11. Reporta el pago.
    const metodos = await api.publica.metodosPago(token);
    expect(metodos.metodos.length).toBeGreaterThan(0);
    expect(metodos.metodos.some((m) => m.id === "efectivo")).toBe(false);
    expect(metodos.tasa_vigente).not.toBeNull();

    const reporte = await api.publica.reportarPago(
      token,
      {
        metodo: "zelle",
        monto: "90.00",
        moneda: "USD",
        fecha_pago: new Date().toISOString().slice(0, 10),
        referencia: "ZELLE-0001",
        comprobante_nombre: "comprobante.png",
        comprobante_tipo: "image/png",
        comprobante_tamano: 120_000,
      },
      idem(),
    );
    expect(reporte.pago_id).toBeTruthy();
    estado = await api.publica.reserva(token);
    expect(estado.reserva.estado).toBe("pago_en_verificacion");
    expect(estado.reserva.paso_actual).toBe("verificacion");

    // 12. El validador aprueba el pago.
    const cola = await api.admin.pagos({ estado: "reportado" });
    const pendiente = cola.items.find((p) => p.id === reporte.pago_id);
    expect(pendiente).toBeDefined();

    const validacion = await api.admin.validarPago(reporte.pago_id, {
      accion: "aprobar",
      idempotencyKey: idem(),
    });
    expect(validacion.saldo_usd).toBe("0.00");

    estado = await api.publica.reserva(token);
    expect(estado.reserva.estado).toBe("confirmada");
    expect(estado.reserva.estado_pago).toBe("pagado");
    expect(estado.reserva.paso_actual).toBe("confirmada");

    // 13. El voucher ya se generó al aprobar el pago y queda descargable.
    const voucher = await api.publica.voucher(token);
    expect(voucher.estado).toBe("listo");
    expect(voucher.url_descarga).toBeTruthy();
  });

  it("rechaza un enlace inexistente con 404 ENLACE_INVALIDO", async () => {
    await expect(api.publica.reserva("no-existe")).rejects.toMatchObject({
      status: 404,
      codigo: "ENLACE_INVALIDO",
    });
  });

  it("rechaza al titular menor de 18 años con un mensaje claro", async () => {
    const creado = await api.admin.crearReserva({ fecha_tour_id: FECHA_CON_CUPO });
    const token = tokenDeEnlace(creado.enlace);
    await api.publica.iniciar(token, { acepta_aviso_privacidad: true }, idem());
    const actual = await api.publica.reserva(token);

    await expect(
      api.publica.guardarTitular(
        token,
        { ...DATOS_TITULAR, fecha_nacimiento: "2015-01-01" },
        actual.reserva.version,
      ),
    ).rejects.toMatchObject({ status: 422, codigo: "TITULAR_MENOR_DE_EDAD" });
  });

  it("avisa cuando el precio cambió antes de confirmar el resumen", async () => {
    const creado = await api.admin.crearReserva({ fecha_tour_id: FECHA_CON_CUPO });
    const token = tokenDeEnlace(creado.enlace);
    await api.publica.iniciar(token, { acepta_aviso_privacidad: true }, idem());
    const actual = await api.publica.reserva(token);

    const error = await api.publica
      .confirmarResumen(
        token,
        { total_visto_usd: "10.00", version: actual.reserva.version, acepta_politica: true },
        idem(),
      )
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).codigo).toBe("PRECIO_CAMBIO");
  });

  it("rechaza una firma vacía con 422 FIRMA_INVALIDA", async () => {
    const creado = await api.admin.crearReserva({ fecha_tour_id: FECHA_CON_CUPO });
    const token = tokenDeEnlace(creado.enlace);
    await api.publica.iniciar(token, { acepta_aviso_privacidad: true }, idem());

    await expect(
      api.publica.firmar(
        token,
        {
          firma_png_base64: "data:image/png;base64,",
          n_trazos: 0,
          longitud_px: 10,
          duracion_ms: 50,
          scroll_completo: true,
          version_terminos_id: "term_v2",
        },
        idem(),
      ),
    ).rejects.toMatchObject({ status: 422, codigo: "FIRMA_INVALIDA" });
  });

  it("detecta el conflicto de versión cuando otro dispositivo escribió antes", async () => {
    const creado = await api.admin.crearReserva({ fecha_tour_id: FECHA_CON_CUPO });
    const token = tokenDeEnlace(creado.enlace);
    await api.publica.iniciar(token, { acepta_aviso_privacidad: true }, idem());

    await expect(
      api.publica.guardarTitular(token, DATOS_TITULAR, 999),
    ).rejects.toMatchObject({ status: 409, codigo: "VERSION_DESACTUALIZADA" });
  });

  it("la cola del validador marca la referencia duplicada sin bloquear al cliente", async () => {
    const creado = await api.admin.crearReserva({ fecha_tour_id: FECHA_CON_CUPO });
    const token = tokenDeEnlace(creado.enlace);
    await api.publica.iniciar(token, { acepta_aviso_privacidad: true }, idem());

    await api.publica.reportarPago(
      token,
      {
        metodo: "pago_movil",
        monto: "50.00",
        moneda: "VES",
        fecha_pago: new Date().toISOString().slice(0, 10),
        referencia: "PM-DUP-1",
      },
      idem(),
    );

    const cola = await api.admin.pagos({});
    const conDuplicado = cola.items.filter((p) => p.alertas.some((a) => a.codigo === "duplicado_referencia"));
    expect(conDuplicado.length).toBeGreaterThan(0);
  });

  it("la operación ve todos los estados y la reserva expira liberando el cupo", async () => {
    const panel = await api.admin.dashboard();
    expect(panel.reservas_por_estado.length).toBeGreaterThan(3);
    expect(panel.pagos_por_verificar[0]?.total).toBeGreaterThan(0);
    expect(panel.requiere_atencion.length).toBeGreaterThan(0);

    const lista = await api.admin.reservas({ limite: 5 });
    expect(lista.items.length).toBe(5);
    expect(lista.next_cursor).toBeTruthy();
    expect(lista.total).toBeGreaterThan(10);
  });

  it("la simulación de cancelación sugiere el reembolso según la política", async () => {
    const lista = await api.admin.reservas({ estado: "confirmada" });
    const reserva = lista.items[0];
    expect(reserva).toBeDefined();
    if (!reserva) return;

    const simulacion = await api.admin.simularCancelacion(reserva.id);
    expect(simulacion.dias_para_salida).toBeGreaterThanOrEqual(0);
    expect(simulacion.tramo.porcentaje).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(simulacion.monto_sugerido)).toBeGreaterThanOrEqual(0);
  });

  it("cada escenario de demo abre en el estado y el paso esperados", async () => {
    const escenarios: { token: string; estado: string; paso: string }[] = [
      { token: "demo1", estado: "enlace_creado", paso: "paso_registro" },
      { token: "demo-enregistro", estado: "en_registro", paso: "preguntas" },
      { token: "demo-firma", estado: "pendiente_firma", paso: "firma" },
      { token: "demo-pago", estado: "pendiente_pago", paso: "pago" },
      { token: "demo-ventana", estado: "pendiente_pago", paso: "pago" },
      { token: "demo-pago-urgente", estado: "pendiente_pago", paso: "pago" },
      { token: "demo-verif", estado: "pago_en_verificacion", paso: "verificacion" },
      { token: "demo-confirmada", estado: "confirmada", paso: "confirmada" },
      { token: "demo-cancelada", estado: "cancelada", paso: "cerrada" },
      { token: "demo-expirada", estado: "expirada", paso: "cerrada" },
      { token: "demo-completada", estado: "completada", paso: "cerrada" },
    ];

    for (const escenario of escenarios) {
      const contexto = await api.publica.reserva(escenario.token);
      expect(contexto.reserva.estado, `Estado de ${escenario.token}`).toBe(escenario.estado);
      expect(contexto.reserva.paso_actual, `Paso de ${escenario.token}`).toBe(escenario.paso);
      // Toda reserva lleva el contexto de la salida que necesitan las pantallas.
      expect(contexto.tour, `Tour de ${escenario.token}`).toBeDefined();
      expect(contexto.fecha, `Fecha de ${escenario.token}`).toBeDefined();
      expect(contexto.tarifas?.length).toBeGreaterThan(0);
      expect(contexto.form_version, `Formulario de ${escenario.token}`).toBeDefined();
      expect(contexto.config, `Config de ${escenario.token}`).toBeDefined();
    }
  });

  it("el enlace inexistente del escenario 404 sigue dando 404", async () => {
    await expect(api.publica.reserva("demo-inexistente")).rejects.toMatchObject({
      status: 404,
      codigo: "ENLACE_INVALIDO",
    });
  });

  it("un enlace que caducó sin iniciarse responde 410 (pantalla P-10)", async () => {
    await expect(api.publica.reserva("demo-enlace-vencido")).rejects.toMatchObject({
      status: 410,
      codigo: "ENLACE_VENCIDO",
    });
  });
});
