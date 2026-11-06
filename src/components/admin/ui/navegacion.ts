import * as React from "react";
import { useNavigate } from "@tanstack/react-router";

/**
 * Navegación a rutas del panel que todavía no están en el árbol generado.
 *
 * El árbol de rutas se autogenera al compilar; mientras tanto, pasar la ruta
 * como texto plano evita que el tipado del router bloquee la navegación.
 */
export function useIrA(): (ruta: string, opciones?: { reemplazar?: boolean }) => void {
  const navegar = useNavigate();

  return React.useCallback(
    (ruta: string, opciones?: { reemplazar?: boolean }) => {
      void navegar({
        to: ruta,
        ...(opciones?.reemplazar ? { replace: true } : {}),
      });
    },
    [navegar],
  );
}
