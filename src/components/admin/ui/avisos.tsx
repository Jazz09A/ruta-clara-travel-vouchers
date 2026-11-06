import * as React from "react";
import { CircleCheckBig, CircleHelp, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export type TonoAviso = "info" | "exito" | "aviso" | "peligro";

const ESTILO: Record<TonoAviso, string> = {
  info: "border-border bg-muted/40 text-foreground",
  exito: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  aviso: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  peligro: "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
};

const ICONO: Record<TonoAviso, React.ComponentType<{ className?: string }>> = {
  info: CircleHelp,
  exito: CircleCheckBig,
  aviso: TriangleAlert,
  peligro: TriangleAlert,
};

export interface AvisoProps {
  tono?: TonoAviso | undefined;
  titulo: string;
  children?: React.ReactNode;
  /** Acciones (botones) a la derecha del mensaje. */
  acciones?: React.ReactNode;
  className?: string | undefined;
}

/**
 * Banner en línea (Spec 3.8).
 *
 * El estado nunca se comunica solo con color: siempre hay icono + texto.
 */
export function Aviso({ tono = "info", titulo, children, acciones, className }: AvisoProps) {
  const Icono = ICONO[tono];
  return (
    <div
      className={cn("flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3", ESTILO[tono], className)}
    >
      <Icono className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold">{titulo}</p>
        {children ? <div className="text-sm leading-relaxed">{children}</div> : null}
      </div>
      {acciones ? <div className="flex flex-wrap gap-2">{acciones}</div> : null}
    </div>
  );
}

export interface RegionEstadoProps {
  /** Mensaje que se anuncia (vacío = no se anuncia nada). */
  mensaje: string;
  /** `assertive` para errores; `polite` para el resto. */
  tono?: "polite" | "assertive" | undefined;
  className?: string | undefined;
}

/**
 * Región `aria-live` para anunciar cambios de estado (Spec 3.9).
 *
 * El texto está siempre en el DOM (aunque sea invisible) para que los lectores
 * de pantalla detecten el cambio.
 */
export function RegionEstado({ mensaje, tono = "polite", className }: RegionEstadoProps) {
  return (
    <p
      role="status"
      aria-live={tono}
      className={cn(mensaje ? "text-sm text-muted-foreground" : "sr-only", className)}
    >
      {mensaje}
    </p>
  );
}
