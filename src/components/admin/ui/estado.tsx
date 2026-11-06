import type { LucideIcon } from "lucide-react";
import {
  Archive,
  CircleCheckBig,
  CircleDot,
  CircleSlash,
  CircleX,
  Clock,
  PencilLine,
  Ticket,
  TriangleAlert,
  UserX,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type TonoEstado = "neutro" | "info" | "exito" | "aviso" | "peligro";

const ESTILO: Record<TonoEstado, string> = {
  neutro: "border-border bg-muted text-slate-700 dark:text-slate-300",
  info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
  exito:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  aviso:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  peligro:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
};

interface EstiloAdmin {
  etiqueta: string;
  tono: TonoEstado;
  icono: LucideIcon;
}

/**
 * Estados del panel (tours, salidas, versiones, usuarios, promociones).
 *
 * El estado **nunca** se comunica solo con color: cada uno trae icono + texto
 * legible en español (Spec 3.9).
 */
const ESTADOS_ADMIN: Record<string, EstiloAdmin> = {
  // Tours
  borrador: { etiqueta: "Borrador", tono: "neutro", icono: PencilLine },
  activo: { etiqueta: "Activo", tono: "exito", icono: CircleCheckBig },
  archivado: { etiqueta: "Archivado", tono: "neutro", icono: Archive },
  // Salidas
  publicada: { etiqueta: "Publicada", tono: "exito", icono: Ticket },
  cerrada: { etiqueta: "Cerrada", tono: "aviso", icono: CircleSlash },
  cancelada: { etiqueta: "Cancelada", tono: "peligro", icono: CircleX },
  // Versiones de formulario
  retirada: { etiqueta: "Retirada", tono: "neutro", icono: Archive },
  // Usuarios
  inactivo: { etiqueta: "Inactivo", tono: "neutro", icono: UserX },
  // Promociones y métodos
  vigente: { etiqueta: "Vigente", tono: "exito", icono: CircleCheckBig },
  por_vencer: { etiqueta: "Por vencer", tono: "aviso", icono: Clock },
  // Genéricos
  pendiente: { etiqueta: "Pendiente", tono: "aviso", icono: CircleDot },
  error: { etiqueta: "Con error", tono: "peligro", icono: TriangleAlert },
};

export interface EstadoBadgeProps {
  /** Identificador interno del estado. */
  estado: string;
  /** Sobrescribe el texto legible. */
  etiqueta?: string | undefined;
  className?: string | undefined;
}

/**
 * C-21 · Etiqueta de estado del panel (icono + texto).
 */
export function EstadoBadge({ estado, etiqueta, className }: EstadoBadgeProps) {
  const estilo = ESTADOS_ADMIN[estado] ?? {
    etiqueta: "Estado desconocido",
    tono: "neutro" as TonoEstado,
    icono: CircleDot,
  };
  const Icono = estilo.icono;

  return (
    <span
      data-estado={estado}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold",
        ESTILO[estilo.tono],
        className,
      )}
    >
      <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{etiqueta ?? estilo.etiqueta}</span>
    </span>
  );
}
