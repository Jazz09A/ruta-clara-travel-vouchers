import { RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Estado de error recuperable (C-30).
 *
 * Muestra un mensaje claro y la causa en una frase, más un botón
 * «Reintentar». Nunca se muestra el error crudo ni un código técnico.
 */

export interface ErrorStateProps {
  /** Mensaje principal. */
  mensaje: string;
  /** Título corto (por defecto «No pudimos cargar esto»). */
  titulo?: string;
  /** Acción de reintento. Si no se pasa, no se muestra el botón. */
  onReintentar?: () => void;
  textoReintentar?: string;
  icono?: LucideIcon;
  className?: string;
}

export function ErrorState({
  mensaje,
  titulo = "No pudimos cargar esto",
  onReintentar,
  textoReintentar = "Reintentar",
  icono: Icono = TriangleAlert,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-red-600/30 bg-red-500/5 px-6 py-10 text-center",
        className,
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-red-500/10">
        <Icono className="h-6 w-6 text-red-700 dark:text-red-300" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-bold text-foreground">{titulo}</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{mensaje}</p>
      </div>
      {onReintentar ? (
        <Button variant="outline" onClick={onReintentar} className="min-h-11">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {textoReintentar}
        </Button>
      ) : null}
    </div>
  );
}
