import { defineConfig, devices } from "@playwright/test";

/**
 * E2E — Ruta Clara (flujo completo: crear enlace → registro → pago → confirmación).
 *
 * Detalles del entorno que condicionan este config:
 * - La app es TanStack Start con Vite; `pnpm dev` sirve en el puerto 8080.
 * - El "backend" es un mock que vive en memoria por pestaña: cada carga
 *   completa de página reinicia la BD y la sesión de admin. Por eso el flujo
 *   E2E se ejecuta en UNA sola página y todas las navegaciones después del
 *   login son client-side (ver `e2e/helpers/navegacion.ts`).
 * - Los workers van en 1: el mock no comparte estado entre pestañas y este
 *   suite es un único viaje continuo (un test por navegador).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:8080",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "on",
    actionTimeout: 10_000,
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:8080",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});
