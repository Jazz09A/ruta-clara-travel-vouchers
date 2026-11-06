import type { Locator, Page } from "@playwright/test";

/**
 * Dibuja una firma válida en el lienzo (C-10).
 *
 * El lienzo valida (UX-57): ≥1 trazo, ancho ocupado ≥15 %, longitud ≥150 px en
 * el PNG exportado, duración ≥300 ms y tinta ≥0.5 % del área. Este helper
 * dibuja un zigzag lento y ancho que cumple todos los umbrales con margen.
 */
export async function dibujarFirma(page: Page, lienzo: Locator): Promise<void> {
  await lienzo.scrollIntoViewIfNeeded();
  const caja = await lienzo.boundingBox();
  if (!caja) throw new Error("No se obtuvo el tamaño del lienzo de firma");

  // Trazo 1: serpentín horizontal lento que ocupa casi todo el ancho.
  const x0 = caja.x + caja.width * 0.12;
  const y0 = caja.y + caja.height * 0.5;
  const amplitud = caja.height * 0.3;

  await page.mouse.move(x0, y0);
  await page.mouse.down();
  const pasos = 20;
  for (let i = 1; i <= pasos; i += 1) {
    const x = caja.x + caja.width * (0.12 + (i / pasos) * 0.72);
    const y = caja.y + caja.height * (0.5 + Math.sin(i / 2) * 0.38);
    await page.mouse.move(x, y, { steps: 2 });
    await page.waitForTimeout(45);
  }
  await page.waitForTimeout(200);
  await page.mouse.up();

  // Trazo 2: línea decorativa de cierre (aporta tinta y trazos).
  await page.waitForTimeout(250);
  await page.mouse.move(caja.x + caja.width * 0.2, caja.y + caja.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(caja.x + caja.width * 0.8, caja.y + caja.height * 0.2, { steps: 8 });
  await page.waitForTimeout(250);
  await page.mouse.up();
}
