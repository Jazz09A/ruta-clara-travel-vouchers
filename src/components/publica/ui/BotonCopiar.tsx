import { Copy } from "lucide-react";

import { cn } from "@/lib/utils";

export interface BotonCopiarProps {
  /** Texto a copiar. */
  valor: string;
  etiqueta?: string | undefined;
  /** Se llama tras copiar con éxito (para el toast). */
  onCopiado?: (() => void) | undefined;
  onError?: (() => void) | undefined;
  className?: string | undefined;
}

/**
 * Botón copiar (C-25 / SEG-07).
 *
 * Sólo escribe en el portapapeles al pulsar un botón explícito. Si el
 * navegador bloquea el portapapeles, se avisa para que el usuario copie a
 * mano.
 */
export function BotonCopiar({
  valor,
  etiqueta = "Copiar",
  onCopiado,
  onError,
  className,
}: BotonCopiarProps) {
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(valor);
            onCopiado?.();
            return;
          }
          throw new Error("El navegador no permite copiar automáticamente");
        } catch {
          onError?.();
        }
      }}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Copy className="h-4 w-4" aria-hidden="true" />
      <span>{etiqueta}</span>
    </button>
  );
}
