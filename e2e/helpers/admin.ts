import { createHmac } from "node:crypto";
import { expect, type Locator, type Page } from "@playwright/test";

/** Credenciales de la demo local (seed en `src/lib/mock/seed.ts`). */
export const ADMIN_EMAIL = "admin@rutaclara.ve";
export const ADMIN_PASSWORD = "demo1234";
/** Secreto TOTP del seed demo del backend (`src/database/seed-demo.ts`). */
const TOTP_SECRETO = "JBSWY3DPEHPK3PXP";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Bytes(secreto: string): Buffer {
  let bits = 0;
  let valor = 0;
  const out: number[] = [];
  for (const c of secreto.toUpperCase().replace(/=+$/, "")) {
    const idx = B32.indexOf(c);
    if (idx < 0) continue;
    valor = (valor << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((valor >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** TOTP RFC 6238 (SHA-1, 30 s, 6 dígitos) — igual que `src/common/totp.util.ts`. */
function totp(secreto: string, paso?: number): string {
  const contador = BigInt(paso ?? Math.floor(Date.now() / 1000 / 30));
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(contador);
  const hmac = createHmac("sha1", base32Bytes(secreto)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codigo =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1_000_000;
  return String(codigo).padStart(6, "0");
}

/** Código 2FA vigente; acepta un margen de un paso por desfase de reloj. */
export function codigo2fa(): string {
  return totp(TOTP_SECRETO);
}

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
    await correo.fill(ADMIN_EMAIL);
    await password.fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForTimeout(800);
    expect(page.url()).toContain("/admin/2fa");
  }).toPass({ timeout: 45_000 });

  // Dos pasos (2FA): el código demo está en el propio mensaje de la pantalla.
  await expect(page.getByRole("heading", { name: "Verifica tu identidad" })).toBeVisible();
  const codigo = page.getByLabel(/Código de verificación/);
  await expect(async () => {
    await codigo.fill(codigo2fa());
    await page.getByRole("button", { name: "Verificar código" }).click();
    await page.waitForTimeout(800);
    expect(new URL(page.url()).pathname).toMatch(/^\/admin\/?$/);
  }).toPass({ timeout: 45_000 });

  await expect(page.getByRole("heading", { name: "Inicio", exact: true })).toBeVisible();
}
