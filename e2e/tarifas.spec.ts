import { expect, test } from "@playwright/test";
import { loginAdmin } from "./helpers/admin";
import { navegarClientSide } from "./helpers/navegacion";

/**
 * E2E del CRUD de tarifas en la ficha del tour (pestaña «Tarifas»).
 *
 * Cubre la verificación pendiente del plan: crear, editar y eliminar una
 * tarifa por categoría/edad sobre una fecha de salida concreta, y que los
 * cambios se reflejen en la tabla.
 *
 * Misma restricción que el resto del suite: el mock vive en memoria, así que
 * todo ocurre en una sola pestaña con navegación client-side tras el login.
 */

const TOUR_NOMBRE = "Full Day Los Roques";

test("CRUD de tarifas: crear, editar precio y eliminar", async ({ page }) => {
  await test.step("admin inicia sesión", async () => {
    await loginAdmin(page);
  });

  await test.step("abre la ficha del tour y la pestaña Tarifas", async () => {
    // Con el backend real los ids de tour son UUID: se entra por el listado.
    await navegarClientSide(page, "/admin/tours");
    await page.getByRole("link", { name: TOUR_NOMBRE }).first().click();
    await expect(page.getByRole("heading", { name: TOUR_NOMBRE })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("tab", { name: "Tarifas" }).click();
    await expect(page.getByRole("heading", { name: "Tarifas por categoría" })).toBeVisible();
  });

  await test.step("crea una tarifa de Infante para una salida", async () => {
    await page.getByRole("button", { name: "Nueva tarifa" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByRole("heading", { name: "Nueva tarifa" })).toBeVisible();
    // Fecha de salida (Radix Select): elegir la primera opción real.
    await dialogo.locator("#fecha-salida").click();
    await page.getByRole("option").first().click();

    // Categoría: Infante (evita solapar con las tarifas Adulto/Niño del seed).
    await dialogo.locator("#categoria").click();
    await page.getByRole("option", { name: "Infante", exact: true }).click();

    await dialogo.locator("#edad-min").fill("0");
    await dialogo.locator("#edad-max").fill("2");
    await dialogo.locator("#precio").fill("25");
    await dialogo.getByRole("button", { name: "Crear tarifa" }).click();

    await expect(page.getByText("Guardamos la tarifa.")).toBeVisible({ timeout: 15_000 });
    // El seed ya trae tarifas de Infante en varias salidas: la nuestra se
    // identifica por el precio recién creado.
    const fila = page.getByRole("row").filter({ hasText: "Infante" }).filter({ hasText: "$25,00" });
    await expect(fila).toBeVisible({ timeout: 15_000 });
    await expect(fila.getByText("0 a 2 años")).toBeVisible();
  });

  await test.step("edita el precio de la tarifa", async () => {
    const fila = page.getByRole("row").filter({ hasText: "Infante" }).filter({ hasText: "$25,00" });
    await fila.getByRole("button").first().click(); // Editar (lápiz)

    const dialogoEdicion = page.getByRole("dialog");
    await expect(dialogoEdicion.getByRole("heading", { name: "Editar tarifa" })).toBeVisible();
    await expect(dialogoEdicion.locator("#fecha-salida")).toHaveCount(0);
    await expect(dialogoEdicion.locator("#categoria")).toContainText("Infante");

    await dialogoEdicion.locator("#precio").fill("30");
    await dialogoEdicion.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByText("Guardamos la tarifa.")).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("row").filter({ hasText: "Infante" }).filter({ hasText: "$30,00" }),
    ).toBeVisible({ timeout: 15_000 });
  });

  await test.step("elimina la tarifa", async () => {
    const fila = page.getByRole("row").filter({ hasText: "Infante" }).filter({ hasText: "$30,00" });
    await fila.getByRole("button").last().click(); // Papelera

    await expect(page.getByText("Eliminamos la tarifa.")).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("row").filter({ hasText: "Infante" }).filter({ hasText: "$30,00" }),
    ).toHaveCount(0, { timeout: 15_000 });
  });
});
