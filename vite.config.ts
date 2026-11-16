// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
//
// NOTA: nitro escribe en `node_modules/.nitro` al cerrar el build y aquí ese
// directorio no es escribible (ACL de otro usuario). El preload
// `scripts/nitro-wellknown.mjs` (vía NODE_OPTIONS en los scripts de npm)
// redirige esas escrituras antes de que Vite arranque.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // El node_modules local tiene ACLs que impiden crear node_modules/.nitro;
  // se redirige el buildDir de nitro a un directorio escribible del repo.
  // @ts-expect-error nitro buildDir no está en los tipos del wrapper
  nitro: { buildDir: ".nitro-build" },
});
