import { RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { mensajeError } from "./error";

export interface EstadoErrorProps {
  /** Título del error (por defecto: «No pudimos cargar esto»). */
  titulo?: string | undefined;
  /** Error original (de `useQuery` o de una mutación). */
  error?: unknown;
  /** Acción para reintentar (Spec 3.5: botón «Reintentar»). */
  onReintentar?: (() => void) | undefined;
  className?: string | undefined;
}

/**
 * C-30 · Estado de error recuperable.
 *
 * Mensaje claro + causa en una frase + botón «Reintentar» (Spec 3.5).
 * El estado nunca se comunica solo con color: lleva icono + texto.
 */
export function EstadoError({ titulo, error, onReintentar, className }: EstadoErrorProps) {
  const causa = error === undefined ? null : mensajeError(error);

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">{titulo ?? "No pudimos cargar esto"}</p>
          {causa ? <p className="text-sm leading-relaxed text-muted-foreground">{causa}</p> : null}
        </div>
      </div>

      {onReintentar ? (
        <Button type="button" variant="outline" onClick={onReintentar} className="min-h-11">
          <RefreshCw aria-hidden="true" />
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}
