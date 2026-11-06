import * as React from "react";
import { Inbox, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Icono decorativo: acepta `className` y `aria-hidden` para poder marcarlo
 * como tal sin depender de la libreria de iconos.
 */
export type IconoUI = React.ComponentType<{
  className?: string | undefined;
  "aria-hidden"?: boolean | "true" | "false" | undefined;
}>;

export interface EmptyStateProps {
  /** Titulo del estado. */
  titulo: string;
  /** Explicacion en lenguaje de persona (UX-14). */
  descripcion: string;
  /** Icono ilustrativo. Por defecto se usa uno segun la variante. */
  icono?: IconoUI | undefined;
  /** Accion principal que resuelve el estado. */
  accion?: { etiqueta: string; onClick: () => void } | undefined;
  /**
   * `vacio` = todavia no hay nada (ofrece crear).
   * `sin-resultados` = hay datos pero los filtros no coinciden (ofrece limpiar).
   */
  variante?: "vacio" | "sin-resultados" | undefined;
  /** Nivel del encabezado (por defecto 2). */
  nivelEncabezado?: 2 | 3 | undefined;
  className?: string | undefined;
}

/**
 * Estado vacio de una lista o seccion.
 *
 * Distingue entre «todavia no hay nada» y «no encontramos resultados con
 * estos filtros» (UX-27): son dos mensajes y dos acciones distintas.
 */
export function EmptyState({
  titulo,
  descripcion,
  icono,
  accion,
  variante = "vacio",
  nivelEncabezado = 2,
  className,
}: EmptyStateProps) {
  const Icono = icono ?? (variante === "sin-resultados" ? SearchX : Inbox);
  const Titulo = nivelEncabezado === 3 ? "h3" : "h2";

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center",
        className,
      )}
    >
      <Icono className="h-8 w-8 text-muted-foreground" aria-hidden="true" />

      <Titulo className="text-base font-semibold text-foreground">{titulo}</Titulo>

      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{descripcion}</p>

      {accion ? (
        <Button type="button" onClick={accion.onClick} className="mt-1 min-h-11">
          {accion.etiqueta}
        </Button>
      ) : null}
    </div>
  );
}
