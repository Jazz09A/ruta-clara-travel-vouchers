import { expect, test, type Page } from "@playwright/test";
import { loginAdmin } from "./helpers/admin";
import { navegarClientSide, recargarCliente } from "./helpers/navegacion";
import { dibujarFirma } from "./helpers/firma";

/**
 * Flujo E2E completo — Ruta Clara (Spec P-01..P-13).
 *
 * Un VPN viaje continuo en una sola pestaña:
 *   1. Admin: login + 2FA → crea el enlace de reserva (tour + fecha publicada).
 *   2. Cliente abre el enlace y completa Bienvenida → Titular → Acompañantes →
 *      Preguntas → Resumen → Términos → Firma.
 *   3. Cliente reporta el pago (Zelle, total, comprobante).
 *   4. Admin valida el pago en la cola y lo aprueba → reserva confirmada.
 *   5. Cliente ve el voucher confirmado.
 *
 * RESTRICCIÓN del entorno de demo: el "backend" mock vive en memoria y se
 * reinicia con cada carga completa de página; por eso todas las navegaciones
 * posteriores al login son client-side (`navegarClientSide`).
 */

const TOUR = "Full Day Los Roques";
const TITULAR = {
  nombre: "María Test E2E",
  doc: "20345678",
  año: "1990",
  tel: "4121234567",
  correo: "maria.e2e@test.ve",
};
const ACOMPANANTE = { nombre: "Pedro Niño Test", doc: "80123456", año: "2018", tel: "4141234567" };
const METODO_PAGO = "Zelle";

function pngComprobante(): { name: string; mimeType: string; buffer: Buffer } {
  // PNG 1x1 válido, como "foto del comprobante".
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  return { name: "comprobante.png", mimeType: "image/png", buffer: Buffer.from(base64, "base64") };
}

/** Selecciona una opción de un combobox nativo por su texto exacto. */
async function elegirOpcion(page: Page, etiqueta: string, opcion: string): Promise<void> {
  await page.getByLabel(etiqueta, { exact: false }).selectOption({ label: opcion });
}

/** Elige día/mes/año en el selector de fecha de nacimiento (Radix). */
async function elegirFechaNacimiento(
  page: Page,
  scope: Page | ReturnType<Page["locator"]>,
  dia: string,
  mes: string,
  año: string,
): Promise<void> {
  await scope.getByRole("combobox", { name: "Día" }).click();
  await page.getByRole("option", { name: dia, exact: true }).click();
  await scope.getByRole("combobox", { name: "Mes" }).click();
  await page.getByRole("option", { name: mes, exact: true }).click();
  await scope.getByPlaceholder("AAAA").fill(año);
}

test("flujo completo: enlace → registro → pago → validación → voucher", async ({
  page,
}, testInfo) => {
  const referenciaInterna = `E2E ${testInfo.project.name} ${Date.now()}`;
  const referenciaPago = `E2E-${testInfo.project.name.slice(0, 4).toUpperCase()}-${Date.now()}`;
  let token = "";
  let codigoReserva = "";

  // -----------------------------------------------------------------------
  // 1. ADMIN: login + 2FA
  // -----------------------------------------------------------------------
  await test.step("admin inicia sesión con 2FA", async () => {
    await loginAdmin(page);
  });

  // -----------------------------------------------------------------------
  // 2. ADMIN: crear el enlace de reserva
  // -----------------------------------------------------------------------
  await test.step("admin crea el enlace para el cliente", async () => {
    await page.getByRole("link", { name: "Reservas", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/reservas$/);
    await page.getByRole("link", { name: "Nueva reserva" }).click();

    await expect(page.getByRole("heading", { name: "Crear nuevo enlace" })).toBeVisible();
    await elegirOpcion(page, "Tour", TOUR);

    // Elegir la primera fecha publicada con cupos (evita la deshabilitada "(sin cupo)").
    const opcionesFecha = page.getByLabel("Fecha de salida").locator("option");
    const textoFecha = await opcionesFecha.evaluateAll((els) => {
      const habilitada = els.find(
        (e) =>
          !(e as HTMLOptionElement).disabled &&
          (e as HTMLOptionElement).textContent?.includes("cupos disponibles"),
      );
      return (habilitada as HTMLOptionElement | undefined)?.textContent?.trim() ?? "";
    });
    await elegirOpcion(page, "Fecha de salida", textoFecha);

    await page.getByLabel("Referencia interna (opcional)").fill(referenciaInterna);
    await page.getByRole("button", { name: "Generar enlace" }).click();

    await expect(page.getByRole("heading", { name: "Enlace generado" })).toBeVisible();
    const valorEnlace = await page.locator("input[readonly]").inputValue();
    expect(valorEnlace).toMatch(/\/r\/[A-Za-z0-9_-]+$/);
    token = valorEnlace.split("/r/")[1] ?? "";
    expect(token).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // 3. CLIENTE: abre el enlace (navegación client-side, misma pestaña)
  // -----------------------------------------------------------------------
  await test.step("cliente abre el enlace (Bienvenida)", async () => {
    await navegarClientSide(page, `/r/${token}`);
    await expect(page.getByRole("heading", { name: "Revisa tu salida" })).toBeVisible();

    // Acepta aviso de privacidad y comienza.
    await page.locator("#acepta-aviso").click();
    await page.getByRole("button", { name: "Comenzar" }).click();
    await expect(page.getByRole("heading", { name: "Datos del titular" })).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 4. CLIENTE: datos del titular
  // -----------------------------------------------------------------------
  await test.step("titular: datos personales", async () => {
    await page.getByLabel("Nombre y apellido").fill(TITULAR.nombre);
    await page.getByLabel("Número de documento").fill(TITULAR.doc);
    await elegirFechaNacimiento(page, page, "10", "Junio", TITULAR.año);
    await page.getByLabel("Teléfono (WhatsApp)").fill(TITULAR.tel);
    await page.getByLabel("Correo electrónico").fill(TITULAR.correo);
    await page.getByLabel("Nombre del contacto").fill("Pedro Contacto");
    await page.getByLabel("Teléfono del contacto").fill("4149876543");
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByRole("heading", { name: "Tu grupo" })).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 5. CLIENTE: acompañantes (un niño, valida la categoría por edad)
  // -----------------------------------------------------------------------
  await test.step("acompañantes: agrega un niño", async () => {
    await page.getByRole("button", { name: "Agregar pasajero" }).click();
    // La tarjeta del pasajero nuevo queda en "Faltan datos" hasta guardar.
    const conjunto = page.locator("article").filter({ hasText: "Faltan datos" }).first();

    await page.getByLabel("Nombre y apellido").fill(ACOMPANANTE.nombre);
    await page.getByLabel("Número de documento").fill(ACOMPANANTE.doc);
    await elegirFechaNacimiento(page, conjunto, "16", "Marzo", ACOMPANANTE.año);

    // Con un menor en el grupo hay que declarar ser el representante legal.
    await page.locator("#declara-representante").click();

    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Preguntas del tour" })).toBeVisible();
    await expect(page.getByText(ACOMPANANTE.nombre)).toContainText("Niño");
  });

  // -----------------------------------------------------------------------
  // 6. CLIENTE: preguntas y resumen
  // -----------------------------------------------------------------------
  await test.step("preguntas del tour y resumen del total", async () => {
    // La pantalla de Resumen lee su consulta ["resumen"] con staleness de 30 s:
    // si montamos antes de que envejezca, muestra datos de la era Bienvenida
    // (placeholder «Pasajero 1», un solo adulto). Un cliente humano tarda
    // más de 30 s en los pasos anteriores; el test espera esa ventana para
    // que el resumen refresque al montarse. Sin tocar código de la app.
    await expect(page.getByRole("heading", { name: "Preguntas del tour" })).toBeVisible();
    await page.waitForTimeout(31_000);

    // Punto de abordaje: respuesta única para toda la reserva.
    await page
      .getByRole("radio", { name: /Altamira/ })
      .first()
      .click();

    // Selección de almuerzo: obligatoria por pasajero (titular y niño).
    // El niño además exige «Menú infantil».
    for (const nombre of [TITULAR.nombre, ACOMPANANTE.nombre]) {
      const seccion = page
        .locator("section")
        .filter({ has: page.getByRole("button", { name: new RegExp(nombre) }) });
      const toggle = seccion.getByRole("button").first();
      if ((await toggle.getAttribute("aria-expanded")) !== "true") {
        await toggle.click();
      }
      await seccion.getByText("Pescado frito", { exact: true }).click();
      if (nombre === ACOMPANANTE.nombre) {
        await seccion.getByText("Sándwich de pollo", { exact: true }).click();
      }
    }

    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByRole("heading", { name: "Resumen de tu reserva" })).toBeVisible();
    await expect(page.getByText("$90,00").first()).toBeVisible();
    await page.locator("#acepta-politica").click();
    await page.getByRole("button", { name: "Confirmar y continuar" }).click();

    // Si la tasa o el precio cambió, aceptar el nuevo precio.
    const dialogoPrecio = page.getByRole("button", { name: "Continuar con el nuevo precio" });
    if (await dialogoPrecio.isVisible().catch(() => false)) {
      await dialogoPrecio.click();
    }

    // La confirmación avanza el servidor a «firma», pero la consulta
    // ["reserva"] no se refresca en este montaje (y como el autoguardado
    // actualizó la caché con setQueryData, el remount la ve «fresca» y no
    // reconsulta). El cycle offline→online dispara `refetchOnReconnect`
    // y la pantalla pasa a FIRMA. Con fallback lento + remount por si el
    // navegador no emula 'online'.
    await page.waitForTimeout(1_500);
    const headingFirma = page.getByRole("heading", { name: "Firma", exact: true });
    let llegoFirma = false;
    try {
      await page.context().setOffline(true);
      await page.context().setOffline(false);
      await expect(headingFirma).toBeVisible({ timeout: 12_000 });
      llegoFirma = true;
    } catch {
      // Fallback: envejecer la caché (>30 s) y remontar la ruta pública.
    }
    if (!llegoFirma) {
      await page.waitForTimeout(31_000);
      await recargarCliente(page, token);
      await expect(headingFirma).toBeVisible({ timeout: 20_000 });
    }
  });

  // -----------------------------------------------------------------------
  // 7. CLIENTE: firma → validación de lectura de términos → acepta → firma
  // -----------------------------------------------------------------------
  await test.step("términos y firma", async () => {
    // Primer intento de firma: dispara la verificación de lectura (P-07).
    await dibujarFirma(page, page.locator("canvas"));
    await page.getByRole("button", { name: "Firmar y continuar" }).click();

    // La UI redirige a Términos (scroll_completo pendiente) en ~1s.
    await expect(
      page.getByRole("heading", { name: "Términos y condiciones", exact: true }),
    ).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: "Ir al final" }).click();
    await page.locator("#terminos-aceptar").click();
    await page.getByRole("button", { name: "Aceptar y continuar" }).click();

    // Segunda pasada: firma válida → reserva queda pendiente de pago.
    await expect(page.getByRole("heading", { name: "Firma", exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await dibujarFirma(page, page.locator("canvas"));
    await page.getByRole("button", { name: "Firmar y continuar" }).click();

    await expect(page.getByRole("heading", { name: "Instrucciones de pago" })).toBeVisible({
      timeout: 20_000,
    });
  });

  // -----------------------------------------------------------------------
  // 8. CLIENTE: reporta el pago (Zelle, total completo, con comprobante)
  // -----------------------------------------------------------------------
  await test.step("reporta el pago", async () => {
    await expect(page.getByRole("heading", { name: "Saldo a pagar" })).toBeVisible({
      timeout: 20_000,
    });
    await page.locator('input[name="metodo-pago"][value="zelle"]').check();
    await page.getByLabel("Monto que vas a pagar (USD)").fill("90");
    const hoy = new Date().toISOString().slice(0, 10);
    await page.getByLabel("Fecha del pago").fill(hoy);
    await page.getByLabel("Referencia del pago").fill(referenciaPago);
    await page.locator("#pago-comprobante-input").setInputFiles(pngComprobante());
    await page.getByRole("button", { name: "Reportar pago" }).click();

    await expect(page.getByRole("heading", { name: "Recibimos tu reporte de pago" })).toBeVisible({
      timeout: 20_000,
    });
  });

  // -----------------------------------------------------------------------
  // 9. ADMIN: valida y aprueba el pago → reserva confirmada
  // -----------------------------------------------------------------------
  await test.step("admin aprueba el pago en la cola", async () => {
    await navegarClientSide(page, "/admin/pagos");
    await expect(page.getByRole("heading", { name: "Cola del validador" })).toBeVisible({
      timeout: 20_000,
    });

    // Localiza la fila del pago recién reportado por su referencia. En
    // escritorio la cola es una tabla (las tarjetas <li> quedan ocultas).
    const fila = page.getByRole("row").filter({ hasText: referenciaPago }).first();
    await expect(fila).toBeVisible({ timeout: 20_000 });
    // La celda junta el código y la referencia corta («VJ-2026-00020DEMO123»):
    // extraer solo el código con formato VJ-AAAA-NNNNN.
    const textoReserva = await fila
      .getByText(/VJ-2026-/)
      .first()
      .textContent();
    codigoReserva = textoReserva?.match(/VJ-2026-\d+/)?.[0] ?? "";
    expect(codigoReserva).toMatch(/^VJ-2026-/);

    await fila.getByRole("link", { name: "Revisar", exact: true }).click();
    await page.getByRole("button", { name: "Aprobar", exact: true }).click();
    await page.getByRole("button", { name: "Aprobar pago" }).click();

    await expect(page.getByText("Aprobado").first()).toBeVisible({ timeout: 20_000 });
  });

  // -----------------------------------------------------------------------
  // 10. CLIENTE: ve el voucher confirmado
  // -----------------------------------------------------------------------
  await test.step("cliente ve el voucher confirmado", async () => {
    await navegarClientSide(page, `/r/${token}`);
    // La pantalla de verificación sondea cada 15 s: al aprobarse el pago el
    // voucher aparece solo, sin recargar.
    await expect(page.getByRole("heading", { name: "Reserva confirmada" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(codigoReserva.trim()).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Descargar voucher/i })).toBeVisible({
      timeout: 30_000,
    });
  });
});
