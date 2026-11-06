import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  titulo: string;
  mensaje?: ReactNode | undefined;
  accion?: ReactNode | undefined;
  className?: string | undefined;
}

/**
 * Estado vacío (Spec §3.5).
 * Explica qué falta y ofrece la acción que lo resuelve.
 */
export function EmptyState({ titulo, mensaje, accion, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center",
        className,
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-base font-bold text-foreground">{titulo}</h2>
        {mensaje ? (
          <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {mensaje}
          </p>
        ) : null}
      </div>
      {accion}
    </div>
  );
}
