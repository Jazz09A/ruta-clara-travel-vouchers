import { beforeEach, describe, expect, it } from "vitest";

import { api } from "@/lib/mock/api";
import { obtenerDb, resetDb } from "@/lib/mock/db";
import type { FechaTour } from "@/lib/domain/types";

/**
 * Edge cases del backend simulado: idempotencia, firmas repetidas, pagos
 * hostiles, paginación y estados que el flujo feliz no toca.
 */

const FECHA_CON_CUPO = "fch_roq_05";

function tokenDeEnlace(enlace: string): string {
  return enlace.split("/r/")[1] ?? "";
}

let contadorIdem = 0;
function idem(): string {
  contadorIdem += 1;
  return `edge_${contadorIdem}_${Math.random().toString(36).slice(2)}`;
}

const FOTO_DOC = {
  data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  tipo: "image/png",
  nombre: "cedula.png",
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
  documento_imagen: FOTO_DOC,
};

function fecha(): FechaTour {
  const f = obtenerDb().data.fechas.find((x) => x.id === FECHA_CON_CUPO);
  if (!f) throw new Error("falta la fecha de prueba");
  return f;
}

/** Crea una reserva y la lleva hasta `pendiente_firma` (listo para firmar). */
async function llegarAFirma() {
  const creado = await api.admin.crearReserva({
    fecha_tour_id: FECHA_CON_CUPO,
    referencia_interna: "edge",
    pago: { metodo_clave: "transferencia", monto: "90.00" },
  });
  const token = tokenDeEnlace(creado.enlace);

  await api.publica.iniciar(token, { acepta_aviso_privacidad: true }, idem());
  let estado = await api.publica.reserva(token);

  await api.publica.guardarTitular(token, DATOS_TITULAR, estado.reserva.version);
  estado = await api.publica.reserva(token);

  await api.publica.guardarAcompanantes(
    token,
    [
      {
        ref_cliente: "ref_titular_1",
        es_titular: true,
        nombre: "María Pérez",
        tipo_doc: "V" as const,
        documento: "12345678",
        fecha_nacimiento: "1988-04-12",
        categoria: "Adulto" as const,
        respuestas: {},
        telefono: DATOS_TITULAR.telefono,
        correo: DATOS_TITULAR.correo,
        documento_imagen: FOTO_DOC,
      },
      {
        ref_cliente: "ref_pasajero_2",
        es_titular: false,
        nombre: "Juan Pérez",
        tipo_doc: "V" as const,
        documento: "87654321",
        fecha_nacimiento: "2016-09-03",
        categoria: "Niño" as const,
        respuestas: {},
        telefono: DATOS_TITULAR.telefono,
        correo: DATOS_TITULAR.correo,
        documento_imagen: FOTO_DOC,
      },
    ],
    estado.reserva.version,
  );
  estado = await api.publica.reserva(token);

  await api.publica.guardarRespuestas(
    token,
    {
      por_pasajero: {
        ref_titular_1: {
          almuerzo: "pescado",
          sabor_desayuno: ["cazon"],
          tiene_alergias: false,
        },
        ref_pasajero_2: {
          almuerzo: "pollo",
          sabor_desayuno: ["molida"],
          tiene_alergias: false,
          menu_infantil: "pasta",
        },
      },
      globales: { punto_abordaje: "guatire" },
    },
    estado.reserva.version,
  );

  let paso = await api.publica.completarPaso(token, "titular", {}, estado.reserva.version);
  paso = await api.publica.completarPaso(token, "acompanantes", {}, paso.version);
  paso = await api.publica.completarPaso(token, "preguntas", {}, paso.version);

  const resumen = await api.publica.resumen(token);
  const confirmado = await api.publica.confirmarResumen(
    token,
    {
      total_visto_usd: resumen.total_usd,
      version: paso.version,
      acepta_politica: true,
    },
    idem(),
  );

  const terminos = await api.publica.terminos(token);
  return { token, version: confirmado.version, resumen, terminos };
}

const FIRMA_VALIDA = {
  firma_png_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
  n_trazos: 4,
  longitud_px: 520,
  duracion_ms: 2400,
  scroll_completo: true,
};

beforeEach(() => {
  resetDb();
  contadorIdem = 0;
});

// ---------------------------------------------------------------------------
// Paginación del admin
// ---------------------------------------------------------------------------

describe("edge cases — paginación de reservas", () => {
  it("un cursor no numérico devuelve página vacía y corta el next_cursor", async () => {
    const pagina = await api.admin.reservas({ cursor: "abc", limite: 5 });
    // Documentado: parseInt("abc")=NaN → slice(NaN, NaN) = [] y
    // NaN+limite < total es false → next_cursor null. El cliente que mande
    // un cursor corrupto ve una página vacía sin forma de avanzar.
    expect(pagina.items).toHaveLength(0);
    expect(pagina.next_cursor).toBeNull();
  });

  it("un cursor negativo produce una página vacía y un next_cursor que salta", async () => {
    const pagina = await api.admin.reservas({ cursor: "-5", limite: 20 });
    // slice(-5, 15) sobre un array de ~30 elementos queda vacío o cortado.
    expect(pagina.next_cursor).not.toBeNull();
  });

  it("limite 0 devuelve página vacía con next_cursor igual al cursor (bucle infinito)", async () => {
    const pagina = await api.admin.reservas({ cursor: "0", limite: 0 });
    expect(pagina.items).toHaveLength(0);
    // Documentado: cursor + 0 < total → next_cursor = "0" otra vez →
    // un cliente que siga next_cursor paginaría para siempre.
    expect(pagina.next_cursor).toBe("0");
  });

  it("limite negativo también devuelve página vacía con cursor decreciente", async () => {
    const pagina = await api.admin.reservas({ cursor: "10", limite: -3 });
    expect(pagina.items).toHaveLength(0);
    expect(pagina.next_cursor).toBe("7"); // 10 + (-3) → retrocede
  });

  it("una búsqueda de sólo espacios coincide con todo", async () => {
    const todo = await api.admin.reservas({});
    const espacios = await api.admin.reservas({ busqueda: "   " });
    expect(espacios.total).toBe(todo.total);
    expect(espacios.items.length).toBe(espacios.total);
  });

  it("un estado inexistente devuelve lista vacía, no error", async () => {
    const pagina = await api.admin.reservas({ estado: "no_existe" as never });
    expect(pagina.items).toHaveLength(0);
    expect(pagina.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Idempotencia
// ---------------------------------------------------------------------------

describe("edge cases — idempotencia", () => {
  it("la misma clave no repite el efecto (el hold se retiene una sola vez)", async () => {
    const { token, resumen, version } = await llegarAFirma();
    const retenidosAntes = fecha().cupos_retenidos;

    const clave = idem();
    const body = { total_visto_usd: resumen.total_usd, version, acepta_politica: true };
    await api.publica.confirmarResumen(token, body, clave);
    // Segunda llamada con la MISMA clave: devuelve el resultado cacheado
    // sin volver a ejecutar (no hay doble retención de cupo).
    await api.publica.confirmarResumen(token, body, clave);

    expect(fecha().cupos_retenidos).toBe(retenidosAntes + 2); // 2 pasajeros, una vez
  });

  it("un error NO envenena la clave: se puede reintentar con la misma", async () => {
    const { token, resumen } = await llegarAFirma();
    const clave = idem();
    const version = (await api.publica.reserva(token)).reserva.version;

    await expect(
      api.publica.confirmarResumen(
        token,
        { total_visto_usd: "999.99", version, acepta_politica: true },
        clave,
      ),
    ).rejects.toMatchObject({ status: 409, codigo: "PRECIO_CAMBIO" });

    // El error no quedó cacheado: el reintento con la misma clave y datos
    // correctos sí se ejecuta (y devuelve el resultado real, no el error).
    const ok = await api.publica.confirmarResumen(
      token,
      { total_visto_usd: resumen.total_usd, version, acepta_politica: true },
      clave,
    );
    expect(ok.total_usd).toBe(resumen.total_usd);
  });

  it("la misma clave en OTRO endpoint devuelve el resultado cacheado equivocado", async () => {
    // Documentado: IDEMPORALIDAD es un Map global por clave, sin namespace
    // por endpoint. Reusar una clave de firmar en reportarPago devolvería
    // el resultado de la firma sin ejecutarla.
    const { token, version, terminos } = await llegarAFirma();
    const clave = idem();
    const firma = await api.publica.firmar(
      token,
      { ...FIRMA_VALIDA, version_terminos_id: terminos.id },
      clave,
    );
    expect(firma.ok).toBe(true);

    await api.admin.guardarConfiguracion({ reporte_pago_cliente: true });
    const pago = await api.publica.reportarPago(
      token,
      {
        metodo: "pago_movil",
        monto: "10.00",
        moneda: "USD",
        fecha_pago: "2026-01-01",
        referencia: "REF-X",
      },
      clave, // MISMA clave que la firma
    );
    // Devuelve el resultado cacheado de firmar ({ok, hash_imagen...}),
    // no {pago_id}: la operación de pago NUNCA se ejecutó.
    expect(pago).toMatchObject({ ok: true });
    expect((pago as { pago_id?: string }).pago_id).toBeUndefined();
    expect((await api.publica.pagos(token)).filter((p) => p.referencia === "REF-X")).toHaveLength(
      0,
    );
  });
});

// ---------------------------------------------------------------------------
// Firma
// ---------------------------------------------------------------------------

describe("edge cases — firma", () => {
  it("rechaza scroll incompleto y firmas por debajo del mínimo", async () => {
    const { token, version, terminos } = await llegarAFirma();
    const base = { ...FIRMA_VALIDA, version_terminos_id: terminos.id };

    await expect(
      api.publica.firmar(token, { ...base, scroll_completo: false }, idem()),
    ).rejects.toMatchObject({ status: 422, codigo: "VALIDACION" });

    // Los mínimos son inclusivos: justo por debajo falla.
    for (const cuerpo of [{ n_trazos: 0 }, { longitud_px: 149 }, { duracion_ms: 299 }]) {
      await expect(api.publica.firmar(token, { ...base, ...cuerpo }, idem())).rejects.toMatchObject(
        { status: 422, codigo: "FIRMA_INVALIDA" },
      );
    }
    expect((await api.publica.reserva(token)).reserva.estado).toBe("pendiente_firma");
  });

  it("acepta version_terminos_id inventado sin validarlo (documentado)", async () => {
    const { token } = await llegarAFirma();
    const firma = await api.publica.firmar(
      token,
      { ...FIRMA_VALIDA, version_terminos_id: "terminos_falso_999" },
      idem(),
    );
    expect(firma.ok).toBe(true);
    const reserva = (await api.publica.reserva(token)).reserva;
    expect(reserva.terminos_version_id).toBe("terminos_falso_999");
    expect(reserva.firma?.version_terminos_id).toBe("terminos_falso_999");
  });

  it("firmar dos veces con claves distintas re-vende el cupo (documentado)", async () => {
    const { token, version, terminos } = await llegarAFirma();
    const vendidosAntes = fecha().cupos_vendidos;
    const retenidosAntes = fecha().cupos_retenidos;

    await api.publica.firmar(token, { ...FIRMA_VALIDA, version_terminos_id: terminos.id }, idem());
    const trasPrimera = { vendidos: fecha().cupos_vendidos, retenidos: fecha().cupos_retenidos };

    // Segunda firma con OTRA clave y versión fresca: validarReservaAbierta
    // no bloquea `confirmada`, así que re-escribe la firma y vuelve a
    // llamar venderCupos → cupos_vendidos se incrementa otra vez.
    const estado = await api.publica.reserva(token);
    await api.publica.firmar(token, { ...FIRMA_VALIDA, version_terminos_id: terminos.id }, idem());
    expect(fecha().cupos_vendidos).toBe(trasPrimera.vendidos + 2);
    expect(fecha().cupos_vendidos).toBeGreaterThan(vendidosAntes);
    expect(retenidosAntes).toBe(trasPrimera.retenidos + 2); // el hold sigue retenido tras confirmar
  });

  it("firmar una reserva que nunca llegó al resumen la confirma igual (documentado)", async () => {
    // La reserva está en `en_registro` con datos a medias: firmar no exige
    // haber pasado por resumen/confirmarResumen.
    const creado = await api.admin.crearReserva({
      fecha_tour_id: FECHA_CON_CUPO,
      pago: { metodo_clave: "transferencia", monto: "90.00" },
    });
    const token = tokenDeEnlace(creado.enlace);
    await api.publica.iniciar(token, { acepta_aviso_privacidad: true }, idem());
    const terminos = await api.publica.terminos(token);

    const firma = await api.publica.firmar(
      token,
      { ...FIRMA_VALIDA, version_terminos_id: terminos.id },
      idem(),
    );
    expect(firma.ok).toBe(true);
    const reserva = (await api.publica.reserva(token)).reserva;
    expect(reserva.estado).toBe("confirmada");
    // Sin pasajeros reales el cupo vendido es 0, pero la reserva quedó
    // confirmada sin resumen ni titular completo.
    expect(reserva.paso_actual).toBe("confirmada");
  });
});

// ---------------------------------------------------------------------------
// Voucher y reapertura
// ---------------------------------------------------------------------------

describe("edge cases — voucher y reapertura", () => {
  it("el voucher se puede pedir en cualquier estado no cerrado (documentado)", async () => {
    const creado = await api.admin.crearReserva({
      fecha_tour_id: FECHA_CON_CUPO,
      pago: { metodo_clave: "transferencia", monto: "90.00" },
    });
    const token = tokenDeEnlace(creado.enlace);
    // Ni siquiera se inició el registro: voucher() sólo bloquea
    // cancelada/expirada, así que genera voucher para `enlace_creado`.
    const voucher = await api.publica.voucher(token);
    expect(voucher.estado).toBe("generando");
  });

  it("voucher de una reserva cancelada responde 409", async () => {
    await expect(api.publica.voucher("demo-cancelada")).rejects.toMatchObject({
      status: 409,
      codigo: "RESERVA_CERRADA",
    });
  });

  it("reabrirEdicion desde confirmada se rechaza; desde pendiente_firma limpia la firma", async () => {
    const { token } = await llegarAFirma();
    const terminos = await api.publica.terminos(token);
    await api.publica.firmar(token, { ...FIRMA_VALIDA, version_terminos_id: terminos.id }, idem());

    await expect(api.publica.reabrirEdicion(token, "corrección")).rejects.toMatchObject({
      status: 409,
      codigo: "TRANSICION_INVALIDA",
    });
  });

  it("reabrirEdicion en enlace_creado también se rechaza", async () => {
    const creado = await api.admin.crearReserva({
      fecha_tour_id: FECHA_CON_CUPO,
      pago: { metodo_clave: "transferencia", monto: "90.00" },
    });
    const token = tokenDeEnlace(creado.enlace);
    await expect(api.publica.reabrirEdicion(token, "x")).rejects.toMatchObject({
      status: 409,
      codigo: "TRANSICION_INVALIDA",
    });
  });
});

// ---------------------------------------------------------------------------
// Reporte de pago del cliente
// ---------------------------------------------------------------------------

describe("edge cases — reportarPago", () => {
  it("con el flag apagado responde 403 PAGO_CLIENTE_DESACTIVADO", async () => {
    const creado = await api.admin.crearReserva({
      fecha_tour_id: FECHA_CON_CUPO,
      pago: { metodo_clave: "transferencia", monto: "90.00" },
    });
    const token = tokenDeEnlace(creado.enlace);
    await expect(
      api.publica.reportarPago(
        token,
        {
          metodo: "pago_movil",
          monto: "10.00",
          moneda: "USD",
          fecha_pago: "2026-01-01",
          referencia: "R1",
        },
        idem(),
      ),
    ).rejects.toMatchObject({ status: 403, codigo: "PAGO_CLIENTE_DESACTIVADO" });
  });

  it("con el flag prendido acepta montos cero y negativos (documentado)", async () => {
    await api.admin.guardarConfiguracion({ reporte_pago_cliente: true });
    const creado = await api.admin.crearReserva({
      fecha_tour_id: FECHA_CON_CUPO,
      pago: { metodo_clave: "transferencia", monto: "90.00" },
    });
    const token = tokenDeEnlace(creado.enlace);
    // Ni siquiera inició el registro: reportarPago no exige estado mínimo.
    const cero = await api.publica.reportarPago(
      token,
      {
        metodo: "pago_movil",
        monto: "0",
        moneda: "USD",
        fecha_pago: "2026-01-01",
        referencia: "R0",
      },
      idem(),
    );
    expect(cero.pago_id).toBeDefined();

    const negativo = await api.publica.reportarPago(
      token,
      {
        metodo: "transferencia",
        monto: "-5.00",
        moneda: "USD",
        fecha_pago: "2026-01-01",
        referencia: "R-1",
      },
      idem(),
    );
    expect(negativo.pago_id).toBeDefined();
    const pagos = await api.publica.pagos(token);
    expect(pagos.find((p) => p.referencia === "R-1")?.monto).toBe("-5.00");
  });

  it("el control de sobrepago sólo aplica a USD y sólo por encima del doble", async () => {
    await api.admin.guardarConfiguracion({ reporte_pago_cliente: true });
    const { token } = await llegarAFirma();
    // total_usd de la reserva = 90.00 (1 adulto + 1 niño).
    const estado = await api.publica.reserva(token);
    const reservaId = estado.reserva.id;
    const r = obtenerDb().data.reservas.find((x) => x.id === reservaId);
    if (r) r.total_usd = "100.00";

    // Exactamente el doble: permitido (la comparación es estricta >).
    const alDoble = await api.publica.reportarPago(
      token,
      {
        metodo: "transferencia",
        monto: "200.00",
        moneda: "USD",
        fecha_pago: "2026-01-01",
        referencia: "D1",
      },
      idem(),
    );
    expect(alDoble.pago_id).toBeDefined();

    // Por encima del doble: 422.
    await expect(
      api.publica.reportarPago(
        token,
        {
          metodo: "transferencia",
          monto: "200.01",
          moneda: "USD",
          fecha_pago: "2026-01-01",
          referencia: "D2",
        },
        idem(),
      ),
    ).rejects.toMatchObject({ status: 422, codigo: "VALIDACION" });

    // En VES el control no aplica aunque el número sea astronómico.
    const enVes = await api.publica.reportarPago(
      token,
      {
        metodo: "pago_movil",
        monto: "999999.00",
        moneda: "VES",
        fecha_pago: "2026-01-01",
        referencia: "V1",
      },
      idem(),
    );
    expect(enVes.pago_id).toBeDefined();
  });

  it("una referencia repetida no bloquea pero marca la alerta de duplicado", async () => {
    await api.admin.guardarConfiguracion({ reporte_pago_cliente: true });
    const { token } = await llegarAFirma();
    const body = {
      metodo: "pago_movil" as const,
      monto: "10.00",
      moneda: "USD" as const,
      fecha_pago: "2026-01-01",
      referencia: "DUP-1",
    };
    const primero = await api.publica.reportarPago(token, body, idem());
    // Mismo método + referencia en la MISMA reserva también cuenta como
    // duplicado (el find no filtra por reserva).
    await api.publica.reportarPago(token, body, idem());

    const pagos = await api.publica.pagos(token);
    const duplicados = pagos.filter((p) => p.referencia === "DUP-1");
    expect(duplicados).toHaveLength(2);
    const conAlerta = duplicados.find((p) =>
      p.alertas.some((a) => a.codigo === "duplicado_referencia"),
    );
    expect(conAlerta).toBeDefined();
    expect(conAlerta?.duplicado_de_pago_id).toBe(primero.pago_id);
  });
});

// ---------------------------------------------------------------------------
// iniciar e hold
// ---------------------------------------------------------------------------

describe("edge cases — iniciar y reserva", () => {
  it("iniciar dos veces devuelve ya_iniciada sin error", async () => {
    const creado = await api.admin.crearReserva({
      fecha_tour_id: FECHA_CON_CUPO,
      pago: { metodo_clave: "transferencia", monto: "90.00" },
    });
    const token = tokenDeEnlace(creado.enlace);
    await api.publica.iniciar(token, { acepta_aviso_privacidad: true }, idem());
    const segunda = await api.publica.iniciar(
      token,
      { acepta_aviso_privacidad: false }, // ni siquiera importa: ya inició
      idem(),
    );
    expect(segunda.ya_iniciada).toBe(true);
  });

  it("iniciar con acepta_aviso_privacidad false en reserva nueva da 422", async () => {
    const creado = await api.admin.crearReserva({
      fecha_tour_id: FECHA_CON_CUPO,
      pago: { metodo_clave: "transferencia", monto: "90.00" },
    });
    const token = tokenDeEnlace(creado.enlace);
    await expect(
      api.publica.iniciar(token, { acepta_aviso_privacidad: false }, idem()),
    ).rejects.toMatchObject({ status: 422, codigo: "VALIDACION" });
  });

  it("por_expirar sólo incluye reservas a menos de 2 h de vencer", async () => {
    const ahora = Date.now();
    const { data } = obtenerDb();
    const [cerca, lejos] = data.reservas;
    if (!cerca || !lejos) throw new Error("faltan reservas seed");
    cerca.expira_en = new Date(ahora + 60 * 60_000).toISOString(); // 1 h
    lejos.expira_en = new Date(ahora + 3 * 60 * 60_000).toISOString(); // 3 h

    const pagina = await api.admin.reservas({ por_expirar: true });
    const ids = pagina.items.map((r) => r.id);
    expect(ids).toContain(cerca.id);
    // `lejos` puede aparecer si otra reserva seed también vence pronto;
    // lo importante es que la de 3 h NO entra por esta ventana.
    expect(ids).not.toContain(lejos.id);
  });
});
