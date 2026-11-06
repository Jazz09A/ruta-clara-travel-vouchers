import { useEffect, useRef, useState } from "react";

/**
 * Mantiene el `document.title` sincronizado con la pantalla visible.
 * Cada pantalla de la app pública tiene su propio título (Spec §3.9).
 */
export function useTituloPantalla(titulo: string): void {
  useEffect(() => {
    if (!titulo) return () => {};
    const anterior = document.title;
    document.title = titulo;
    return () => {
      document.title = anterior;
    };
  }, [titulo]);
}

/**
 * Mueve el foco al título de la pantalla cuando cambia de paso (Spec §3.9).
 * El título debe ser un `h1` con `tabIndex={-1}`.
 */
export function useFocoEnTitulo<T extends HTMLElement>(activo: boolean): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!activo) return;
    // Se espera al siguiente frame para que el título ya esté montado.
    const id = window.requestAnimationFrame(() => {
      ref.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [activo]);

  return ref;
}

/**
 * `true` si el usuario pidió menos movimiento (Spec §3.9).
 * Se usa para pausar la cuenta regresiva y las transiciones largas.
 */
export function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducido(consulta.matches);
    const alCambiar = (evento: MediaQueryListEvent) => setReducido(evento.matches);
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, []);

  return reducido;
}
