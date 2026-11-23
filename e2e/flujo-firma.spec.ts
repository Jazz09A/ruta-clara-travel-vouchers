import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
import { dibujarFirma } from "./helpers/firma";

/**
 * Regresión: la firma del cliente se guarda AL PRIMER INTENTO.
 *
 * El bug (reproducido a mano): el servidor pasa directo de «resumen» a
 * «firma», así que la pantalla de términos (P-07) nunca se mostraba. El lienzo
 * se enviaba con `scroll_completo=false` y el backend respondía
 * `422 VALIDACION «Desplázate hasta el final de los términos»`, devolviendo al
 * cliente a los términos y perdiendo el dibujo.
 *
 * Este spec monta la reserva hasta `pendiente_firma` por API (lo que el
 * navegador hace en el flujo real, sin rellenar formularios) y comprueba en el
 * navegador que:
 *   1. lo primero que ve el cliente son los términos, no el lienzo;
 *   2. tras aceptarlos aparece el lienzo;
 *   3. el `POST /public/reserva/firma` responde 201 a la PRIMERA petición.
 *
 * El setup va por API porque el objetivo del test es la pantalla de firma, no
 * el alta del titular (cubierto por `flujo-reserva.spec.ts`).
 */

const API = process.env["VITE_API_URL"] ?? "http://localhost:3001/api/v1";
const TOKEN_DEMO = { correo: "admin@escapetour.app", password: "demo1234" };

/** PNG de 1×1 px: cumple la política de foto del documento para el setup. */
const CEDULA_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** JSON devuelto por la API: se lee con las funciones de abajo, sin `any`. */
type Json = string | number | boolean | null | Json[] | { [clave: string]: Json };

function objeto(json: Json): Record<string, Json> {
  return typeof json === "object" && json !== null && !Array.isArray(json)
    ? (json as Record<string, Json>)
    : {};
}
function lista(json: Json): Json[] {
  return Array.isArray(json) ? json : [];
}
function texto(json: Json): string {
  return typeof json === "string" ? json : "";
}
function numero(json: Json): number {
  return typeof json === "number" ? json : 0;
}

async function api(
  request: APIRequestContext,
  metodo: "get" | "post" | "put",
  ruta: string,
  opciones: { token?: string; body?: Record<string, Json> } = {},
): Promise<Json> {
  const cabeceras: Record<string, string> = { "Content-Type": "application/json" };
  if (opciones.token) cabeceras["x-enlace-token"] = opciones.token;
  const res = await request[metodo](API + ruta, { headers: cabeceras, data: opciones.body });
  const json = (await res.json().catch(() => null)) as Json;
  if (res.status() >= 400) {
    throw new Error(`${metodo.toUpperCase()} ${ruta} → ${res.status()} ${JSON.stringify(json)}`);
  }
  return json;
}

/** Deja la reserva en `pendiente_firma` usando la API pública. */
async function prepararHastaFirma(request: APIRequestContext): Promise<string> {
  const login = objeto(await api(request, "post", "/auth/login", { body: TOKEN_DEMO }));
  const admin = { Authorization: `Bearer ${texto(login["access_token"])}` };

  const fechasCrudas = await request
    .get(API + "/adminfx/fechas", { headers: admin })
    .then((r) => r.json() as Promise<Json>);
  const listaFechas = Array.isArray(fechasCrudas)
    ? lista(fechasCrudas)
    : lista(objeto(fechasCrudas)["fechas"]);
  // Fecha publicada y todavía vendible: hoy o posterior y con el corte de
  // venta (corte_venta_horas antes de la salida) aún no superado.
  const hoy = new Date().toISOString().slice(0, 10);
  const ahora = Date.now();
  const fecha = listaFechas.map(objeto).find((f) => {
    if (texto(f["estado"]) !== "publicada") return false;
    const salida = texto(f["fecha_salida"]);
    if (!salida || salida < hoy) return false;
    const hora = texto(f["hora_salida"]) || "00:00";
    const corteHoras = typeof f["corte_venta_horas"] === "number" ? f["corte_venta_horas"] : 0;
    const cierre = new Date(`${salida}T${hora}:00`).getTime() - corteHoras * 3_600_000;
    return cierre > ahora;
  });
  expect(fecha, "hay una fecha publicada y vendible para crear la reserva").toBeTruthy();
  if (!fecha) return "";

  const respuestaCreacion = await request.post(API + "/adminfx/reservas", {
    headers: admin,
    data: {
      fecha_tour_id: texto(fecha["id"]),
      referencia_interna: `E2E-FIRMA-${Date.now()}`,
      // La reserva «nace pagada»: el alta exige el pago (422 sin él). El
      // total todavía es 0 al crear (sin pasajeros), así que basta con un
      // monto positivo que cubra lo que después se registre.
      pago: { metodo_clave: "transferencia", monto: "100.00" },
    },
  });
  const jsonCreacion = (await respuestaCreacion.json().catch(() => null)) as Json;
  // Sin este corte, un422 (fecha cerrada, sin cupo…) se disfraza de token
  // vacío y el fallo real aparece después como ENLACE_INVALIDO.
  expect(
    respuestaCreacion.status(),
    `crear la reserva: ${JSON.stringify(jsonCreacion)}`,
  ).toBeLessThan(400);
  const creada = objeto(jsonCreacion);
  const token = texto(creada["enlace"]).replace("/r/", "");
  expect(token, "el alta devolvió un enlace usable").toBeTruthy();

  const version = async () =>
    numero(
      objeto(objeto(await api(request, "get", "/public/reserva", { token }))["reserva"])["version"],
    );

  await api(request, "put", "/public/reserva/titular", {
    token,
    body: {
      nombre: "Cliente Firma E2E",
      tipo_doc: "V",
      documento: "12345678",
      fecha_nacimiento: "1990-01-15",
      correo: "firma.e2e@test.ve",
      telefono: "4121234567",
      // Política: el paso no avanza sin la foto del documento (PNG de 1×1).
      documento_imagen: {
        data: CEDULA_PNG,
        tipo: "image/png",
        nombre: "cedula.png",
      },
      version: await version(),
    },
  });
  await api(request, "post", "/public/reserva/pasos/titular/completar", {
    token,
    body: { version: await version() },
  });
  await api(request, "post", "/public/reserva/pasos/acompanantes/completar", {
    token,
    body: { version: await version() },
  });

  // Preguntas: responde lo obligatorio del formulario dinámico de ese tour.
  // Las opciones agotadas devuelven 422, así que se elige una con cupo.
  for (let intento = 0; intento < 5; intento += 1) {
    const estado = objeto(await api(request, "get", "/public/reserva", { token }));
    const reserva = objeto(estado["reserva"]);
    const titular = objeto(reserva["titular"]);
    const ref = texto(titular["ref_cliente"]);
    const respuestas = objeto(titular["respuestas"]);
    const globales = objeto(reserva["respuestas_globales"]);
    const agotadas = objeto(estado["opciones_agotadas"]);
    const definicion = objeto(objeto(estado["formulario"])["definicion"]);
    const campos = lista(definicion["campos"]);

    const primeraDisponible = (campo: Record<string, Json>): string | null => {
      const opciones = lista(campo["opciones"]).map(objeto);
      const libre = opciones.find((o) => !agotadas[`${texto(campo["id"])}:${texto(o["valor"])}`]);
      return libre ? texto(libre["valor"]) : null;
    };

    const porPasajero: Record<string, Record<string, Json>> = {};
    const nuevasGlobales: Record<string, Json> = {};
    for (const cruda of campos) {
      const campo = objeto(cruda);
      if (!campo["obligatorio"]) continue;
      const valor = primeraDisponible(campo);
      if (!valor) continue;
      const alcance = texto(campo["alcance"]);
      const id = texto(campo["id"]);
      if (alcance === "por_pasajero") {
        if (respuestas[id] !== undefined) continue;
        porPasajero[ref] = { ...porPasajero[ref], [id]: valor };
      } else if (alcance === "por_reserva") {
        if (globales[id] !== undefined) continue;
        nuevasGlobales[id] = valor;
      }
    }
    if (Object.keys(porPasajero).length || Object.keys(nuevasGlobales).length) {
      await api(request, "put", "/public/reserva/respuestas", {
        token,
        body: { version: await version(), por_pasajero: porPasajero, globales: nuevasGlobales },
      });
    }
    try {
      await api(request, "post", "/public/reserva/pasos/preguntas/completar", {
        token,
        body: { version: await version() },
      });
      break;
    } catch (e) {
      if (intento === 4) throw e;
    }
  }

  const resumen = objeto(await api(request, "get", "/public/reserva/resumen", { token }));
  await api(request, "post", "/public/reserva/resumen/confirmar", {
    token,
    body: {
      version: await version(),
      total_visto_usd: texto(resumen["total_usd"]),
      acepta_politica: true,
    },
  });

  const final = objeto(await api(request, "get", "/public/reserva", { token }));
  const finalReserva = objeto(final["reserva"]);
  expect(texto(finalReserva["estado"]), "la reserva quedó esperando firma").toBe("pendiente_firma");
  expect(
    finalReserva["terminos_version_id"] ?? null,
    "los términos aún no se aceptaron",
  ).toBeNull();
  return token;
}

/** Desplaza el contenedor de términos hasta el final (RF-6.2). */
async function leerHastaElFinal(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.evaluate(() => {
          const candidatos = [...document.querySelectorAll("div")].filter(
            (d) => d.scrollHeight > d.clientHeight + 20 && d.clientHeight > 150,
          );
          const c = candidatos.sort((a, b) => b.clientHeight - a.clientHeight)[0];
          if (!c) throw new Error("sin contenedor de términos");
          c.scrollTop = c.scrollHeight;
          c.dispatchEvent(new Event("scroll"));
        });
        return page
          .getByRole("checkbox")
          .first()
          .isEnabled()
          .catch(() => false);
      },
      { timeout: 15_000, intervals: [400] },
    )
    .toBe(true);
}

test("la firma se guarda al primer intento (términos antes de firmar)", async ({
  page,
  request,
}) => {
  const token = await prepararHastaFirma(request);

  const respuestasFirma: number[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/public/reserva/firma")) respuestasFirma.push(r.status());
  });

  await test.step("lo primero que ve el cliente son los términos (no el lienzo)", async () => {
    await page.goto(`/r/${token}`);
    await expect(
      page.getByRole("heading", { name: "Términos y condiciones", exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("canvas"), "el lienzo no aparece antes de leer").toHaveCount(0);
  });

  await test.step("aceptar los términos habilita el lienzo de firma", async () => {
    await leerHastaElFinal(page);
    await page.getByRole("checkbox").first().click();
    await page.getByRole("button", { name: "Aceptar y continuar" }).click();

    await expect(page.getByRole("heading", { name: "Firma", exact: true })).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();
  });

  await test.step("el primer envío de la firma responde 201", async () => {
    await dibujarFirma(page, page.locator("canvas"));
    await page.getByRole("button", { name: "Firmar y continuar" }).click();

    // Con el reporte de pago del cliente desactivado, el paso «pago» es
    // informativo: la agencia coordina el pago fuera del formulario.
    await expect(page.getByRole("heading", { name: "Registro completo", exact: true })).toBeVisible(
      { timeout: 30_000 },
    );
    expect(respuestasFirma, "sólo se intentó firmar una vez").toEqual([201]);
  });
});

test("si los términos ya se aceptaron en otra sesión, firma directo y guarda (201)", async ({
  page,
  request,
}) => {
  const token = await prepararHastaFirma(request);

  // Aceptación registrada en el servidor: lo que sucede cuando el cliente
  // acepta los términos y recarga el enlace o regresa en otro dispositivo.
  const terminos = objeto(await api(request, "get", "/public/terminos", { token }));
  expect(texto(terminos["id"]), "la versión de términos tiene id").toBeTruthy();
  const versionActual = async () =>
    numero(
      objeto(objeto(await api(request, "get", "/public/reserva", { token }))["reserva"])["version"],
    );
  await api(request, "post", "/public/reserva/pasos/terminos/completar", {
    token,
    body: {
      scroll_completo: true,
      versionTerminosId: texto(terminos["id"]),
      version: await versionActual(),
    },
  });

  const respuestasFirma: number[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/public/reserva/firma")) respuestasFirma.push(r.status());
  });

  await test.step("el enlace abierto de nuevo va directo al lienzo", async () => {
    await page.goto(`/r/${token}`);
    await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  });

  await test.step("el primer envío de la firma responde 201", async () => {
    await dibujarFirma(page, page.locator("canvas"));
    await page.getByRole("button", { name: "Firmar y continuar" }).click();

    // El enlace va directo a la pantalla informativa de pago (el reporte del
    // cliente está desactivado): no hubo rebote a los términos.
    await expect(page.getByRole("heading", { name: "Registro completo", exact: true })).toBeVisible(
      { timeout: 30_000 },
    );
    expect(respuestasFirma, "sólo se intentó firmar una vez").toEqual([201]);
  });
});
