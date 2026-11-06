import type { ComponentType } from "react";
import { CircleCheckBig, CircleOff, LoaderCircle, TriangleAlert } from "lucide-react";

import { useEstadoGuardado, type EstadoGuardado } from "@/lib/hooks/use-conexion";
import { cn } from "@/lib/utils";

const ICONO: Record<EstadoGuardado, ComponentType<{ className?: string }>> = {
  guardando: LoaderCircle,
  guardado: CircleCheckBig,
  "sin-conexion": CircleOff,
  error: TriangleAlert,
};

const ESTILO: Record<EstadoGuardado, string> = {
  guardando: "text-muted-foreground",
  guardado: "text-emerald-700 dark:text-emerald-300",
  "sin-conexion": "text-amber-700 dark:text-amber-300",
  error: "text-destructive",
};

export interface IndicadorGuardadoProps {
  className?: string | undefined;
}

/**
 * C-09 · Indicador del guardado automático.
 *
 * Muestra el estado real de la escritura («Guardando…», «Guardado», «Sin
 * conexión…») y lo anuncia a lectores de pantalla con `aria-live` (UX-29).
 */
export function IndicadorGuardado({ className }: IndicadorGuardadoProps) {
  const { estado, mensaje } = useEstadoGuardado();
  const Icono = ICONO[estado];

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", ESTILO[estado], className)}
    >
      <Icono
        className={cn("h-3.5 w-3.5", estado === "guardando" ? "animate-spin" : undefined)}
        aria-hidden="true"
      />
      <span>{mensaje}</span>
    </p>
  );
}
