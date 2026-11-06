import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Ban,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  FileClock,
  TimerOff,
  Wallet,
} from "lucide-react";
import { ETIQUETA_ESTADO_PAGO, ETIQUETA_ESTADO_RESERVA } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Etiqueta de estado (C-21).
 *
 * Regla dura: el estado NUNCA se comunica solo con color. Cada badge lleva
 * siempre un icono **y** un texto legible en español.
 */

export type TonoEstado = "neutro" | "info" | "exito" | "aviso" | "peligro";

export interface BadgeEstadoProps {
  /** Identificador interno del estado (p. ej. `pendiente_pago`). */
  estado?: string;
  /** Texto legible. Si se omite se deriva de `estado`. */
  etiqueta?: string;
  /** Fuerza el tono (por defecto se deduce del estado). */
  tono?: TonoEstado;
  /** Fuerza el icono (por defecto se deduce del estado). */
  icono?: LucideIcon;
  /** Oculta el texto y lo deja sólo para lectores de pantalla. */
  soloIcono?: boolean;
  className?: string;
}

const TONOS: Record<string, TonoEstado> = {
  enlace_creado: "info",
  en_registro: "info",
  pendiente_firma: "aviso",
  pendiente_pago: "aviso",
  pago_en_verificacion: "aviso",
  confirmada: "exito",
  completada: "exito",
  cancelada: "peligro",
  expirada: "neutro",
  sin_pago: "neutro",
  reportado: "aviso",
  parcial: "aviso",
  pagado: "exito",
  rechazado: "peligro",
  reembolsado: "info",
};

const ICONOS: Record<string, LucideIcon> = {
  enlace_creado: FileClock,
  en_registro: CircleDashed,
  pendiente_firma: Clock,
  pendiente_pago: Clock,
  pago_en_verificacion: Clock,
  confirmada: CircleCheck,
  completada: CircleCheck,
  cancelada: CircleX,
  expirada: TimerOff,
  sin_pago: Wallet,
  reportado: Clock,
  parcial: Clock,
  pagado: BadgeCheck,
  rechazado: Ban,
  reembolsado: Wallet,
};

const ESTILOS: Record<TonoEstado, string> = {
  neutro: "border-border bg-muted text-muted-foreground",
  info: "border-primary/25 bg-secondary text-secondary-foreground",
  exito: "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  aviso: "border-amber-600/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  peligro: "border-red-600/30 bg-red-500/10 text-red-800 dark:text-red-300",
};

export function BadgeEstado({
  estado,
  etiqueta,
  tono,
  icono,
  soloIcono = false,
  className,
}: BadgeEstadoProps) {
  const clave = estado ?? "";
  const texto =
    etiqueta ??
    ETIQUETA_ESTADO_RESERVA[clave] ??
    ETIQUETA_ESTADO_PAGO[clave] ??
    (clave ? clave.replace(/_/g, " ") : "");
  const Icono = icono ?? ICONOS[clave] ?? CircleDashed;
  const estilo = ESTILOS[tono ?? TONOS[clave] ?? "neutro"];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5",
        estilo,
        className,
      )}
    >
      <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {soloIcono ? <span className="sr-only">{texto}</span> : <span>{texto}</span>}
    </span>
  );
}
