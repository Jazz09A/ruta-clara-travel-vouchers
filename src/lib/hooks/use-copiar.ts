import * as React from "react";

export interface OpcionesUseCopiar {
  /** Tiempo que permanece visible la confirmación «Copiado». */
  duracionMs?: number | undefined;
  /** Se dispara cuando la copia fue exitosa. */
  alCopiar?: ((valor: string) => void) | undefined;
  /** Se dispara cuando no se pudo copiar (hay que mostrar el respaldo manual). */
  alFallar?: ((valor: string) => void) | undefined;
}

export interface UseCopiarResultado {
  /** Copia `valor`. Devuelve `true` si se copió, `false` si hay que copiar a mano. */
  copiar: (valor: string) => Promise<boolean>;
  /** `true` durante los primeros milisegundos tras copiar. */
  copiado: boolean;
  /** `true` cuando la última copia falló y hay que ofrecer el respaldo manual. */
  error: boolean;
  /** Limpia los estados `copiado` / `error`. */
  reiniciar: () => void;
}

/**
 * Copia un texto al portapapeles con respaldo.
 *
 * 1. `navigator.clipboard.writeText` (requiere contexto seguro).
 * 2. `document.execCommand("copy")` sobre un área de texto oculta (navegadores
 *    antiguos o contextos no seguros).
 * 3. Si ambos fallan, el llamador debe ofrecer el texto seleccionado para
 *    copiarlo a mano (Spec C-25).
 */
export function useCopiar(opciones: OpcionesUseCopiar = {}): UseCopiarResultado {
  const { duracionMs = 2000, alCopiar, alFallar } = opciones;

  const [copiado, setCopiado] = React.useState(false);
  const [error, setError] = React.useState(false);
  const temporizador = React.useRef<number | null>(null);

  const limpiarTemporizador = React.useCallback(() => {
    if (temporizador.current !== null) {
      window.clearTimeout(temporizador.current);
      temporizador.current = null;
    }
  }, []);

  React.useEffect(() => limpiarTemporizador, [limpiarTemporizador]);

  const reiniciar = React.useCallback(() => {
    limpiarTemporizador();
    setCopiado(false);
    setError(false);
  }, [limpiarTemporizador]);

  const copiar = React.useCallback(
    async (valor: string): Promise<boolean> => {
      limpiarTemporizador();
      const ok = await copiarAlPortapapeles(valor);

      if (ok) {
        setCopiado(true);
        setError(false);
        alCopiar?.(valor);
        temporizador.current = window.setTimeout(() => {
          setCopiado(false);
          temporizador.current = null;
        }, duracionMs);
      } else {
        setCopiado(false);
        setError(true);
        alFallar?.(valor);
      }

      return ok;
    },
    [alCopiar, alFallar, duracionMs, limpiarTemporizador],
  );

  return { copiar, copiado, error, reiniciar };
}

/** Intenta copiar con la API moderna y, si falla, con el respaldo clásico. */
async function copiarAlPortapapeles(valor: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(valor);
      return true;
    } catch {
      // Se cae al respaldo manual.
    }
  }

  return copiarConAreaOculta(valor);
}

function copiarConAreaOculta(valor: string): boolean {
  if (typeof document === "undefined") return false;

  const area = document.createElement("textarea");
  area.value = valor;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.width = "1px";
  area.style.height = "1px";
  area.style.padding = "0";
  area.style.border = "none";
  area.style.outline = "none";
  area.style.boxShadow = "none";
  area.style.background = "transparent";
  area.style.opacity = "0";

  document.body.appendChild(area);

  try {
    area.focus();
    area.select();
    area.setSelectionRange(0, valor.length);
    return typeof document.execCommand === "function" ? document.execCommand("copy") : false;
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}
