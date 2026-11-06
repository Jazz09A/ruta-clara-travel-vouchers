import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Estado vacío (C-30).
 *
 * Distingue «no hay nada todavía» de «no hay resultados con estos filtros»:
 * el texto y la acción cambian según el caso (UX-27).
 */

export interface EmptyStateProps {
  titulo: string;
  descripcion?: string;
  icono?: LucideIcon;
  /** Acción principal para salir del estado vacío. */
  accion?: ReactNode;
  className?: string;
}

export function EmptyState({
  titulo,
  descripcion,
  icono: Icono = Inbox,
  accion,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center",
        className,
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-muted">
        <Icono className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-bold text-foreground">{titulo}</p>
        {descripcion ? (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{descripcion}</p>
        ) : null}
      </div>
      {accion ? <div className="pt-1">{accion}</div> : null}
    </div>
  );
}
