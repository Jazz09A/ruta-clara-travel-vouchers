import { expect, type Locator, type Page } from "@playwright/test";

/** Credenciales de la demo local (seed en `src/lib/mock/seed.ts`). */
export const ADMIN_EMAIL = "admin@rutaclara.ve";
export const ADMIN_PASSWORD = "demo1234";

/**
 * La app es TanStack Start con SSR: tras un `page.goto` el HTML llega antes de
 * que React hidrate. Un `fill()`/`click()` en esa ventana muere en silencio (el
 * input controlado se limpia al hidratar o el click no encuentra listener).
 * Este helper rellena comprobando que el valor *persista* después de un margen
 * y reintenta hasta que lo haga.
 */
export async function rellenarPersistente(
  page: Page,
  control: Locator,
  valor: string,
): Promise<void> {
  await expect(async () => {
    await control.fill(valor);
    await page.waitForTimeout(350);
    expect(await control.inputValue()).toBe(valor);
  }).toPass({ timeout: 30_000 });
}

/**
 * Inicia sesión en el panel admin y queda en el Dashboard.
 * Debe llamarse tras una carga completa (`page.goto`): es el único punto del
 * flujo donde se descarta la BD mock; después todo es navegación client-side.
 */
export async function loginAdmin(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await expect(page.getByRole("heading", { name: "Entrar al panel" })).toBeVisible();
  await page.waitForLoadState("load");

  // Login: rellenar y enviar dentro del mismo reintento. Si el click cae
  // antes de hidratar, React reenvía el estado vacío y la cuenta de
  // intentos fallidos puede bloquear el botón; reintentar con relleno nuevo.
  const correo = page.getByLabel(/Correo electrónico/);
  const password = page.getByLabel(/Contraseña/);
  await expect(async () => {
    if (await correo.isVisible().catch(() => false)) {
      await correo.fill(ADMIN_EMAIL);
      await password.fill(ADMIN_PASSWORD);
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
    }
    await page.waitForTimeout(800);
    expect(new URL(page.url()).pathname).toMatch(/^\/admin\/?$/);
  }).toPass({ timeout: 45_000 });

  await expect(page.getByRole("heading", { name: "Inicio", exact: true })).toBeVisible();
}
