import type { ReactNode } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export interface AccionPrincipal {
  etiqueta: string;
  onClick: () => void;
  loading?: boolean | undefined;
  disabled?: boolean | undefined;
}

export interface ActionBarProps {
  accionPrincipal?: AccionPrincipal | undefined;
  onAtras?: (() => void) | undefined;
  mostrarAtras?: boolean | undefined;
  etiquetaAtras?: string | undefined;
  /** Contenido adicional (por ejemplo, el resumen del precio). */
  children?: ReactNode | undefined;
  className?: string | undefined;
}

/**
 * Barra de acción inferior (C-08 / UX-05).
 *
 * En móvil queda fija sobre el borde inferior y respeta el *safe area* de
 * iOS; en escritorio vuelve al flujo normal del contenido.
 */
export function ActionBar({
  accionPrincipal,
  onAtras,
  mostrarAtras,
  etiquetaAtras = "Atrás",
  children,
  className,
}: ActionBarProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:static lg:border-0 lg:bg-transparent lg:backdrop-blur-none",
        className,
      )}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 pb-[env(safe-area-inset-bottom)] pt-3 lg:max-w-2xl lg:px-0 lg:pb-0 lg:pt-6">
        {mostrarAtras && onAtras ? (
          <button
            type="button"
            onClick={onAtras}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-xl border border-input bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span>{etiquetaAtras}</span>
          </button>
        ) : null}

        {children}

        {accionPrincipal ? (
          <button
            type="button"
            onClick={accionPrincipal.onClick}
            disabled={accionPrincipal.loading || accionPrincipal.disabled}
            aria-busy={accionPrincipal.loading || undefined}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {accionPrincipal.loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {accionPrincipal.loading ? "Un momento…" : accionPrincipal.etiqueta}
          </button>
        ) : null}
      </div>
    </div>
  );
}
