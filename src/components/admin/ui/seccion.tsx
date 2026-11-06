import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface SeccionProps {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
}

/**
 * Bloque de contenido del panel (misma convención en todas las pantallas:
 * lista + edición + historial donde aplique).
 */
export function Seccion({ titulo, descripcion, acciones, children, className }: SeccionProps) {
  return (
    <section
      className={cn("rounded-2xl border border-border bg-card p-4 shadow-card md:p-5", className)}
      aria-label={titulo}
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-foreground md:text-lg">{titulo}</h2>
          {descripcion ? (
            <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{descripcion}</div>
          ) : null}
        </div>
        {acciones ? <div className="flex flex-wrap gap-2">{acciones}</div> : null}
      </div>
      {children}
    </section>
  );
}
