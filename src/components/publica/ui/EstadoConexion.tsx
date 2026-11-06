import { Check, CloudOff, Loader2, TriangleAlert, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Estados del indicador de guardado (C-09 / UX-29). */
export type EstadoGuardado = "inactivo" | "guardando" | "guardado" | "sin_conexion" | "error";

export interface EstadoConexionProps {
  estado: EstadoGuardado;
  className?: string | undefined;
}

const TEXTO: Record<EstadoGuardado, string> = {
  inactivo: "",
  guardando: "Guardando…",
  guardado: "Guardado",
  sin_conexion: "Sin conexión — se guardará al reconectar",
  error: "No pudimos guardar. Reintenta",
};

/**
 * Indicador de guardado (C-09 / UX-29).
 *
 * Vive en la esquina de la cabecera y se anuncia con `aria-live`, para que
 * el cambio de estado de red sea audible sin mirar la pantalla.
 */
export function EstadoConexion({ estado, className }: EstadoConexionProps) {
  const texto = TEXTO[estado];
  if (!texto) return null;

  const Icono: LucideIcon =
    estado === "guardando"
      ? Loader2
      : estado === "guardado"
        ? Check
        : estado === "sin_conexion"
          ? CloudOff
          : TriangleAlert;

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        estado === "error" && "text-destructive",
        estado === "sin_conexion" && "text-chart-2",
        estado === "guardado" && "text-success",
        estado === "guardando" && "text-muted-foreground",
        className,
      )}
    >
      <Icono
        className={cn("h-3.5 w-3.5", estado === "guardando" && "animate-spin")}
        aria-hidden="true"
      />
      <span>{texto}</span>
    </p>
  );
}
