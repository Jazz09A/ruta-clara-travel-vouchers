import * as React from "react";
import { CircleCheckBig, LoaderCircle, TriangleAlert, WifiOff } from "lucide-react";

import { cn } from "@/lib/utils";
import type { IconoUI } from "@/components/core/EmptyState";
import { MENSAJE_ESTADO_GUARDADO, type EstadoGuardado } from "@/lib/hooks/use-conexion";

export interface EstadoConexionProps {
  /** Estado del guardado automatico. */
  estado: EstadoGuardado;
  /** Muestra solo el icono (el texto queda para lectores de pantalla). */
  soloIcono?: boolean | undefined;
  className?: string | undefined;
}

const ESTILOS: Record<EstadoGuardado, { clase: string; icono: IconoUI }> = {
  guardando: {
    clase: "text-muted-foreground",
    icono: LoaderCircle,
  },
  guardado: {
    clase: "text-emerald-700 dark:text-emerald-300",
    icono: CircleCheckBig,
  },
  "sin-conexion": {
    clase: "text-amber-800 dark:text-amber-200",
    icono: WifiOff,
  },
  error: {
    clase: "text-red-700 dark:text-red-300",
    icono: TriangleAlert,
  },
};

/**
 * C-09 · Indicador del estado de guardado (UX-29) y aviso de falta de
 * conexion (UX-33).
 *
 * El estado se anuncia con `aria-live="polite"` y nunca se comunica solo con
 * color: siempre hay icono + texto.
 */
export function EstadoConexion({ estado, soloIcono = false, className }: EstadoConexionProps) {
  const estilo = ESTILOS[estado];
  const Icono = estilo.icono;
  const mensaje = MENSAJE_ESTADO_GUARDADO[estado];

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        estilo.clase,
        className,
      )}
    >
      <Icono
        aria-hidden="true"
        className={cn("h-3.5 w-3.5 shrink-0", estado === "guardando" && "animate-spin")}
      />
      {soloIcono ? <span className="sr-only">{mensaje}</span> : <span>{mensaje}</span>}
    </span>
  );
}
