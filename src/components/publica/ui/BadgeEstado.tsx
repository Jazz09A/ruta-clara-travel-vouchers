import type { ReactNode } from "react";
import { Check, CircleAlert, CircleDot, Clock } from "lucide-react";

import { cn } from "@/lib/utils";

export type TonoEstado = "neutro" | "activo" | "exito" | "aviso" | "peligro";

export interface BadgeEstadoProps {
  etiqueta: string;
  tono?: TonoEstado | undefined;
  /** Ícono a la izquierda; siempre hay ícono + texto (Spec §3.9). */
  icono?: ReactNode | undefined;
  className?: string | undefined;
}

const ESTILO: Record<TonoEstado, string> = {
  neutro: "border-border bg-muted text-muted-foreground",
  activo: "border-primary/30 bg-primary/10 text-primary",
  exito: "border-success/40 bg-success/10 text-success",
  aviso: "border-chart-2/40 bg-chart-2/10 text-foreground",
  peligro: "border-destructive/40 bg-destructive/10 text-destructive",
};

const ICONO_POR_TONO: Record<TonoEstado, ReactNode> = {
  neutro: <Clock className="h-3 w-3" aria-hidden="true" />,
  activo: <CircleDot className="h-3 w-3" aria-hidden="true" />,
  exito: <Check className="h-3 w-3" aria-hidden="true" />,
  aviso: <CircleAlert className="h-3 w-3" aria-hidden="true" />,
  peligro: <CircleAlert className="h-3 w-3" aria-hidden="true" />,
};

/** Etiqueta de estado (C-21): texto legible + ícono, nunca sólo color. */
export function BadgeEstado({
  etiqueta,
  tono = "neutro",
  icono,
  className,
}: BadgeEstadoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        ESTILO[tono],
        className,
      )}
    >
      {icono ?? ICONO_POR_TONO[tono]}
      <span>{etiqueta}</span>
    </span>
  );
}
