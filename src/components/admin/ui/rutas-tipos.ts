import type { AnyRoute } from "@tanstack/react-router";

/**
 * Puente de tipos para las rutas del panel.
 *
 * `createFileRoute` exige que la ruta ya exista en `FileRoutesByPath`, que es
 * la tabla que genera el plugin de TanStack Router (`routeTree.gen.ts`) al
 * compilar. Mientras esa tabla no incluye todavía las pantallas del panel, el
 * tipo rechaza rutas válidas.
 *
 * Este archivo **no** cambia el comportamiento del router: sólo permite
 * declarar las rutas del panel. En cuanto el árbol se regenera, las rutas
 * concretas siguen teniendo su tipo exacto (una propiedad declarada siempre
 * gana sobre el índice).
 */
declare module "@tanstack/react-router" {
  interface FileRoutesByPath {
    [ruta: string]: {
      id: string;
      path: string;
      fullPath: string;
      preLoaderRoute: unknown;
      parentRoute: AnyRoute;
    };
  }
}

export {};
