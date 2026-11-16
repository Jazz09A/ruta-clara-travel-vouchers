import type { LucideIcon } from "lucide-react";
import { Ban, CircleCheckBig, CircleX, Hourglass, MessageCircleMore } from "lucide-react";

import type { EstadoPagoRegistro } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Etiqueta del **estado de un pago reportado** (distinto del estado de pago
 * de la reserva).
 *
 * El estado nunca se comunica solo con color: siempre hay icono + texto
 * legible en español (Spec §3.9).
 */

interface EstiloPago {
  etiqueta: string;
  icono: LucideIcon;
  clases: string;
}

const ESTILOS: Record<EstadoPagoRegistro, EstiloPago> = {
  reportado: {
    etiqueta: "Reportado",
    icono: Hourglass,
    clases: "border-amber-600/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  },
  aprobado: {
    etiqueta: "Aprobado",
    icono: CircleCheckBig,
    clases: "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  },
  rechazado: {
    etiqueta: "Rechazado",
    icono: CircleX,
    clases: "border-red-600/30 bg-red-500/10 text-red-800 dark:text-red-300",
  },
  correccion_solicitada: {
    etiqueta: "Corrección solicitada",
    icono: MessageCircleMore,
    clases: "border-blue-600/30 bg-blue-500/10 text-blue-800 dark:text-blue-300",
  },
  anulado: {
    etiqueta: "Anulado",
    icono: Ban,
    clases: "border-border bg-muted text-muted-foreground",
  },
};

export interface BadgePagoProps {
  /** Estado del registro de pago. */
  estado: EstadoPagoRegistro;
  /** Sobrescribe el texto (por ejemplo, «Aprobado por ti»). */
  etiqueta?: string | undefined;
  className?: string | undefined;
}

export function BadgePago({ estado, etiqueta, className }: BadgePagoProps) {
  const estilo = ESTILOS[estado] ?? ESTILOS.reportado;
  const Icono = estilo.icono;
  const texto = etiqueta ?? estilo.etiqueta;

  return (
    <span
      data-estado={estado}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        estilo.clases,
        className,
      )}
    >
      <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{texto}</span>
    </span>
  );
}
