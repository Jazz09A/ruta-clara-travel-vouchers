import type { Page } from "@playwright/test";

/**
 * Navegación client-side "sin recarga".
 *
 * La BD mock y la sesión de admin viven en memoria (variables de módulo) y se
 * reinician en cada carga completa de página. Todo el flujo E2E debe convivir
 * en UNA sola página: el login de admin, la vista como cliente y el regreso al
 * panel para validar el pago.
 *
 * TanStack History escucha `popstate`, así que `history.pushState` + el
 * evento `popstate` hace que el router resuelva y renderice la nueva ruta
 * client-side, sin descartar el módulo mock ni la sesión.
 */
export async function navegarClientSide(page: Page, ruta: string): Promise<void> {
  await page.evaluate((destino) => {
    const state = window.history.state;
    window.history.pushState(state, "", destino);
    window.dispatchEvent(new PopStateEvent("popstate", { state }));
  }, ruta);
}

/**
 * Remonta la vista pública para refrescar su consulta con la versión actual de
 * la reserva (equivale a que el usuario vuelva a abrir el enlace).
 */
export async function recargarCliente(page: Page, token: string): Promise<void> {
  await navegarClientSide(page, "/");
  await page.waitForTimeout(400);
  await navegarClientSide(page, `/r/${token}`);
  await page.waitForTimeout(600);
}
