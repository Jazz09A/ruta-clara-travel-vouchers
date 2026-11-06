import * as React from "react";

/**
 * Suscripción a una media query de CSS.
 *
 * Se implementa con `useSyncExternalStore` para que el valor sea consistente
 * entre el servidor y el cliente (evita el "hydration mismatch" de React 19) y
 * para que la suscripción se libere sola al desmontar.
 *
 * @param query Media query CSS, p. ej. `"(min-width: 1024px)"`.
 * @returns `true` si la media query se cumple en este momento.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (alCambiar: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => {};
      }
      const mql = window.matchMedia(query);
      mql.addEventListener("change", alCambiar);
      return () => mql.removeEventListener("change", alCambiar);
    },
    [query],
  );

  const getSnapshot = React.useCallback(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(query).matches;
  }, [query]);

  // En el servidor no hay viewport: se asume la vista más estrecha (móvil).
  const getServerSnapshot = React.useCallback(() => false, []);

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** `true` a partir del breakpoint `lg` (1024 px) — escritorio. */
export function useEsEscritorio(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}

/** `true` cuando el usuario pidió menos movimiento en el sistema operativo. */
export function useMovimientoReducido(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
