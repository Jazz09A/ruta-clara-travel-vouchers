import { expect, test, type Page } from "@playwright/test";
import { loginAdmin } from "./helpers/admin";
import { navegarClientSide, recargarCliente } from "./helpers/navegacion";
import { dibujarFirma } from "./helpers/firma";

/**
 * Flujo E2E completo — Ruta Clara (Spec P-01..P-13).
 *
 * Un viaje continuo en una sola pestaña:
 *   1. Admin: login + 2FA → crea el enlace de reserva (tour + fecha publicada).
 *   2. Cliente abre el enlace y completa Bienvenida → Titular → Acompañantes →
 *      Preguntas → Confirmación (total administrado) → Términos → Firma.
 *   3. La agencia confirma la reserva primero (CTA en el detalle) y luego
 *      anota los datos del pago desde la reserva: el pago nace aprobado
 *      (ya no hay cola de validación).
 *   4. Cliente ve el voucher confirmado.
 *
 * RESTRICCIÓN del entorno: el backend real vive en `localhost:3001` con su
 * SQLite; por eso todas las navegaciones posteriores al login son
 * client-side (`navegarClientSide`) para no recargar la sesión.
 */

// Tour de la seed demo: tiene el campo `almuerzo` («Pescado frito») y tarifas
// Adulto 90 / Niño 60 / Infante 0. Los puntos de salida NO salen de la seed:
// el servidor los toma del catálogo global que carga `importar-escapate`
// (Emporium y Kiosco en Guatire, los de Caracas sólo como referencia).
const TOUR = "Fin de Semana Mérida";
const TITULAR = {
  nombre: "María Test E2E",
  doc: "20345678",
  año: "1990",
  tel: "4121234567",
  correo: "maria.e2e@test.ve",
};
const ACOMPANANTE = { nombre: "Pedro Niño Test", doc: "80123456", año: "2018", tel: "4141234567" };
/** Menor de 5 años: viaja gratis (sin costo, en piernas de su representante). */
const INFANTE = { nombre: "Lucía Bebé Test", doc: "99123456", año: "2023" };

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

    // Elegir la fecha publicada con MÁS cupos para todo el grupo del E2E
    // (3 pasajeros: titular, niño e infante); evita agotados y retenidos.
    const opcionesFecha = page.getByLabel("Fecha de salida").locator("option");
    const textoFecha = await opcionesFecha.evaluateAll((els) => {
      let mejor = "";
      let mejorCupos = -1;
      for (const el of els) {
        const opcion = el as HTMLOptionElement;
        if (opcion.disabled) continue;
        const coincidencia = /(\d+)\s+cupos disponibles/.exec(opcion.textContent ?? "");
        if (!coincidencia) continue;
        const cupos = Number(coincidencia[1]);
        if (cupos > mejorCupos) {
          mejorCupos = cupos;
          mejor = opcion.textContent?.trim() ?? "";
        }
      }
      return mejor;
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

    // Política: sin la foto del documento no se avanza.
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Sube la foto del documento de identidad").first()).toBeVisible();

    await page.setInputFiles("#titular-foto-documento", "e2e/fixtures/cedula.png");
    await expect(page.getByText("Foto del documento lista ✓")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByRole("heading", { name: "Tu grupo" })).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 5. CLIENTE: acompañantes (un niño y un infante ≤4: gratis)
  // -----------------------------------------------------------------------
  await test.step("acompañantes: agrega un niño y un infante (sin costo)", async () => {
    await page.getByRole("button", { name: "Agregar pasajero" }).click();
    // La tarjeta del pasajero nuevo queda en "Faltan datos" hasta guardar.
    const conjunto = page.locator("article").filter({ hasText: "Faltan datos" }).first();

    await page.getByLabel("Nombre y apellido").fill(ACOMPANANTE.nombre);
    await page.getByLabel("Número de documento").fill(ACOMPANANTE.doc);
    await elegirFechaNacimiento(page, conjunto, "16", "Marzo", ACOMPANANTE.año);

    // Con un menor en el grupo hay que declarar ser el representante legal.
    await page.locator("#declara-representante").click();

    // Cada pasajero sube la foto de su documento (la del titular ya está).
    // Se busca la tarjeta por nombre: al completarse cambia a «Completo».
    const tarjetaNino = page.locator("article").filter({ hasText: ACOMPANANTE.nombre });
    await tarjetaNino
      .locator('input[type="file"]')
      .first()
      .setInputFiles("e2e/fixtures/cedula.png");
    await expect(tarjetaNino.getByText("Foto del documento lista ✓")).toBeVisible({
      timeout: 20_000,
    });

    // Infante (menor de 5): la tarjeta resalta «Sin costo» y no muestra
    // etiquetas de categoría. Se toma por su nombre: al completarse deja
    // de decir «Faltan datos».
    await page.getByRole("button", { name: "Agregar pasajero" }).click();
    const tarjetaNueva = page.locator("article").filter({ hasText: "Faltan datos" }).first();
    await tarjetaNueva.getByLabel("Nombre y apellido").fill(INFANTE.nombre);
    const tarjetaInfante = page.locator("article").filter({ hasText: INFANTE.nombre }).first();
    await tarjetaInfante.getByLabel("Número de documento").fill(INFANTE.doc);
    await elegirFechaNacimiento(page, tarjetaInfante, "05", "Enero", INFANTE.año);
    await tarjetaInfante
      .locator('input[type="file"]')
      .first()
      .setInputFiles("e2e/fixtures/cedula.png");
    await expect(tarjetaInfante.getByText("Foto del documento lista ✓")).toBeVisible({
      timeout: 20_000,
    });
    await expect(tarjetaInfante).toContainText("Sin costo · viaja en piernas de su representante");

    // Sin etiquetas de categoría en las tarjetas: sólo el estado de completitud.
    await expect(page.locator("article").filter({ hasText: ACOMPANANTE.nombre })).toContainText(
      "Completo",
    );

    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Preguntas del tour" })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(ACOMPANANTE.nombre) })).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 6. CLIENTE: preguntas y confirmación
  // -----------------------------------------------------------------------
  await test.step("preguntas del tour y confirmación del total", async () => {
    // La consulta ["resumen"] solo se monta en la pantalla de confirmación,
    // así que llega fresca del "servidor" (mock) al aparecer el total.
    await expect(page.getByRole("heading", { name: "Preguntas del tour" })).toBeVisible();

    // Punto de salida agrupado por ciudad: primero la ciudad (Guatire,
    // Guarenas, Caracas) y luego el punto de esa ciudad. Caracas sí es
    // elegible: guarda la pseudo-opción y explica la confirmación por
    // WhatsApp con los puntos reales como referencia.
    const ciudades = page.getByRole("radiogroup", { name: "Ciudad de salida" });
    await expect(ciudades.getByRole("radio")).toHaveCount(3);
    const puntos = page.getByRole("radiogroup", { name: "Punto de salida" });
    await expect(puntos.getByRole("radio")).toHaveCount(2); // Guatire por defecto

    await ciudades.getByRole("radio", { name: "Caracas" }).click();
    await expect(
      page.getByText(/El punto exacto en Caracas lo confirmamos por WhatsApp/),
    ).toBeVisible();
    await expect(page.getByText("Puntos de referencia en Caracas")).toBeVisible();
    await puntos.getByRole("radio", { name: /Caracas — punto por confirmar/ }).click();

    // Elige Guatire para el resto del flujo (al cambiar de ciudad se
    // limpia el punto anterior).
    await ciudades.getByRole("radio", { name: "Guatire" }).click();
    await puntos.getByRole("radio", { name: /Emporium/ }).click();

    // La selección de comida está habilitada para los tours con comidas:
    // cada pasajero elige su almuerzo (obligatorio para Adulto y Niño).
    // El radio se acota a la sección del acordeón: con varios abiertos, el
    // primero de la página sería el de otro pasajero.
    const elegirAlmuerzo = async (nombre: string) => {
      const acordeon = page.getByRole("button", { name: new RegExp(nombre) });
      if ((await acordeon.getAttribute("aria-expanded")) !== "true") await acordeon.click();
      const seccion = acordeon.locator("xpath=..");
      await seccion.getByRole("radio", { name: "Pescado frito" }).click();
    };
    await elegirAlmuerzo(TITULAR.nombre);
    await elegirAlmuerzo(ACOMPANANTE.nombre);

    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page.getByRole("heading", { name: "Revisa y confirma tu reserva" })).toBeVisible();
    // El cliente solo ve el total administrado: sin desglose ni promo.
    // Total del grupo (Mérida): Adulto 90 + Niño 60 + Infante 0 = 150.
    await expect(page.getByText("$150,00").first()).toBeVisible();
    await expect(page.getByLabel("Código promocional")).toHaveCount(0);
    await page.locator("#acepta-politica").click();

    // Se espera la respuesta real de la confirmación: así no se manipula la
    // red con una petición en vuelo y un fallo del servidor queda visible.
    const respuestaConfirmacion = page
      .waitForResponse((r) => r.url().includes("/public/reserva/resumen/confirmar"), {
        timeout: 20_000,
      })
      .catch(() => null);
    await page.getByRole("button", { name: "Confirmar y continuar" }).click();
    const respuesta = await respuestaConfirmacion;
    if (respuesta) {
      expect(respuesta.ok(), `confirmar resumen falló: ${respuesta.status()}`).toBe(true);
    }

    // Si la tasa o el precio cambió, aceptar el nuevo precio.
    const dialogoPrecio = page.getByRole("button", { name: "Continuar con el nuevo precio" });
    const hayDialogoPrecio = await dialogoPrecio
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (hayDialogoPrecio) await dialogoPrecio.click();

    // La confirmación avanza el servidor al paso «términos». La consulta
    // ["reserva"] del montaje puede quedar desactualizada: se fuerza un
    // refetch con el ciclo offline→online y, si hace falta, una recarga.
    await page.waitForTimeout(1_500);
    const headingTerminos = page.getByRole("heading", {
      name: "Términos y condiciones",
      exact: true,
    });
    let llegoTerminos = false;
    try {
      await page.context().setOffline(true);
      await page.context().setOffline(false);
      await expect(headingTerminos).toBeVisible({ timeout: 12_000 });
      llegoTerminos = true;
    } catch {
      // Fallback: envejecer la caché (>30 s) y remontar la ruta pública.
    }
    if (!llegoTerminos) {
      await page.waitForTimeout(31_000);
      await recargarCliente(page, token);
      await expect(headingTerminos).toBeVisible({ timeout: 20_000 });
    }
  });

  // -----------------------------------------------------------------------
  // 7. CLIENTE: firma → validación de lectura de términos → acepta → firma
  // -----------------------------------------------------------------------
  await test.step("términos y firma", async () => {
    // Términos: leer hasta el final habilita el checkbox (P-06) y aceptar
    // deja la reserva lista para la firma.
    await expect(
      page.getByRole("heading", { name: "Términos y condiciones", exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Ir al final" }).click();
    await page.locator("#terminos-aceptar").click();
    await page.getByRole("button", { name: "Aceptar y continuar" }).click();

    // Firma del titular (P-07).
    await expect(page.getByRole("heading", { name: "Firma", exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await dibujarFirma(page, page.locator("canvas"));
    await page.getByRole("button", { name: "Firmar y continuar" }).click();

    // Con el reporte de pago del cliente desactivado, el paso «pago» es
    // informativo: la agencia coordina el pago fuera del formulario.
    await expect(page.getByRole("heading", { name: "Registro completo" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/La agencia se pondrá en contacto contigo/).first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 8. AGENCIA: confirma la reserva (CTA primero) y anota el pago
  // -----------------------------------------------------------------------
  await test.step("la agencia confirma la reserva y anota el pago", async () => {
    await navegarClientSide(page, "/admin/reservas");
    const buscador = page.getByPlaceholder(/Buscar por referencia/);
    await expect(buscador).toBeVisible({ timeout: 20_000 });
    await buscador.fill(referenciaInterna);

    // La búsqueda se resuelve en el servidor (ref_corta, código o
    // referencia interna): al reducir el listado a una sola reserva, se
    // abre su detalle.
    await expect(page.getByText(/1 reservas en total/)).toBeVisible({ timeout: 20_000 });
    const tarjeta = page.locator('a[href^="/admin/reservas/"]:not([href*="nueva"])').first();
    await expect(tarjeta).toBeVisible({ timeout: 20_000 });
    await tarjeta.click();
    await expect(page.getByRole("heading", { name: "Detalle de reserva" })).toBeVisible({
      timeout: 20_000,
    });

    // El menú lateral ya no muestra «Pagos»: se gestiona desde la reserva.
    await expect(page.getByRole("link", { name: "Pagos", exact: true })).toHaveCount(0);

    // «Confirmar reserva» es el PRIMER elemento del detalle (CTA) y no
    // depende del pago: la reserva se confirma primero.
    const ctaConfirmar = page.getByRole("region", { name: "Confirmar reserva" });
    await expect(ctaConfirmar).toBeVisible();
    await ctaConfirmar.getByRole("button", { name: "Confirmar reserva" }).click();

    // Radix usa `alertdialog` (AlertDialog) para los diálogos de confirmación.
    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toBeVisible();
    // El motivo es obligatorio (mínimo 5 caracteres).
    await dialogo.getByLabel("Motivo").fill("Confirmación manual de la agencia (e2e)");
    await dialogo.getByRole("button", { name: "Confirmar reserva" }).click();

    // La reserva queda confirmada: se asigna el código VJ-AAAA-NNNNN
    // (el texto aparece en el toast, el banner y el aviso sr-only).
    const toastConfirmada = page.getByText(/Reserva confirmada \(VJ-\d{4}-\d+\)/).first();
    await expect(toastConfirmada).toBeVisible({ timeout: 20_000 });
    codigoReserva = (await toastConfirmada.textContent())?.match(/VJ-\d{4}-\d+/)?.[0] ?? "";
    expect(codigoReserva).toMatch(/^VJ-\d{4}-\d+$/);

    // Anota los datos del pago desde la reserva: el pago nace aprobado
    // (sin cola de validación).
    const tabPagos = page.getByRole("tab", { name: "Pagos" });
    if (await tabPagos.isVisible().catch(() => false)) await tabPagos.click();
    await page.getByRole("button", { name: "Registrar datos de pago" }).click();

    const metodo = page.getByRole("combobox", { name: "Método de pago" });
    await metodo.click();
    await page.getByRole("option", { name: /Zelle/ }).click();
    await page.getByLabel("Referencia (opcional)").fill(referenciaPago);
    await page.getByRole("button", { name: "Registrar pago", exact: true }).click();

    await expect(page.getByText("Pago anotado. Queda aprobado en la reserva.").first()).toBeVisible(
      { timeout: 20_000 },
    );
    // Sin cola: el pago aparece aprobado en el panel de la reserva.
    await expect(page.getByText("Aprobado").first()).toBeVisible({ timeout: 20_000 });
  });

  // -----------------------------------------------------------------------
  // 9. CLIENTE: ve el voucher confirmado
  // -----------------------------------------------------------------------
  await test.step("cliente ve el voucher confirmado", async () => {
    await navegarClientSide(page, `/r/${token}`);
    // La reserva ya está confirmada: al abrir el enlace el voucher aparece
    // con el código recién asignado.
    await expect(page.getByRole("heading", { name: /Reserva confirmada/ })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(codigoReserva.trim()).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Descargar voucher/i })).toBeVisible({
      timeout: 30_000,
    });
    // Los menores de 4 años viajan gratis: el voucher resalta el sin costo.
    await expect(page.getByText("Sin costo · viaja en piernas de su representante")).toBeVisible();
    // Voucher con el nombre real del tour (no «Tu tour») y el punto de
    // cada pasajero en la fila («Sale desde»).
    await expect(page.getByText(TOUR).first()).toBeVisible();
    await expect(page.getByText(/Sale desde: Emporium/).first()).toBeVisible();
  });
});
