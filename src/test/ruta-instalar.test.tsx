import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

/**
 * El onboarding tiene su propia ruta pública (`/instalar`): sin ella, una
 * instalación nueva no tiene por dónde entrar.
 */
describe("Rutas del panel", () => {
  it("resuelve /instalar a una página propia (no al 404)", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/instalar");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    expect(matches.at(-1)?.routeId).toContain("instalar");
  });
});
