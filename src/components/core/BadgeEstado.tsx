import * as React from "react";
import {
  CircleCheckBig,
  CircleDot,
  CircleHelp,
  CircleSlash,
  CircleX,
  Clock,
  CreditCard,
  FileCheck,
  Hourglass,
  Link2,
  LoaderCircle,
  PenLine,
  PencilLine,
  RotateCcw,
  Ticket,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ETIQUETA_ESTADO_PAGO, ETIQUETA_ESTADO_RESERVA } from "@/lib/format";

/** Familias de estados que reconoce la etiqueta. */
export type TipoEstado = "reserva" | "pago" | "voucher";

type Tono = "neutro" | "info" | "exito" | "aviso" | "peligro";

/**
 * Clases por tono. Los tonos usan la paleta de Tailwind con su variante
 * oscura para mantener el contraste AA (Spec 3.9) en los dos modos.
 */
const TONOS: Record<Tono, string> = {
  neutro: "border-border bg-muted text-slate-700 dark:text-slate-300",
  info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
  exito:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  aviso:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  peligro:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
};

interface EstiloEstado {
  etiqueta: string;
  icono: LucideIcon;
  tono: Tono;
}

/** Texto legible de un mapa de etiquetas (nunca el identificador interno). */
function texto(mapa: Record<string, string>, clave: string): string {
  return mapa[clave] ?? clave;
}

const ESTADOS_RESERVA: Record<string, EstiloEstado> = {
  enlace_creado: {
    etiqueta: texto(ETIQUETA_ESTADO_RESERVA, "enlace_creado"),
    icono: Link2,
    tono: "neutro",
  },
  en_registro: {
    etiqueta: texto(ETIQUETA_ESTADO_RESERVA, "en_registro"),
    icono: PencilLine,
    tono: "info",
  },
  pendiente_firma: {
    etiqueta: texto(ETIQUETA_ESTADO_RESERVA, "pendiente_firma"),
    icono: PenLine,
    tono: "aviso",
  },
  pendiente_pago: {
    etiqueta: texto(ETIQUETA_ESTADO_RESERVA, "pendiente_pago"),
    icono: CreditCard,
    tono: "aviso",
  },
  pago_en_verificacion: {
    etiqueta: texto(ETIQUETA_ESTADO_RESERVA, "pago_en_verificacion"),
    icono: Hourglass,
    tono: "info",
  },
  confirmada: {
    etiqueta: texto(ETIQUETA_ESTADO_RESERVA, "confirmada"),
    icono: CircleCheckBig,
    tono: "exito",
  },
  completada: {
    etiqueta: texto(ETIQUETA_ESTADO_RESERVA, "completada"),
    icono: Ticket,
    tono: "exito",
  },
  cancelada: {
    etiqueta: texto(ETIQUETA_ESTADO_RESERVA, "cancelada"),
    icono: CircleX,
    tono: "peligro",
  },
  expirada: {
    etiqueta: texto(ETIQUETA_ESTADO_RESERVA, "expirada"),
    icono: Clock,
    tono: "peligro",
  },
};

const ESTADOS_PAGO: Record<string, EstiloEstado> = {
  sin_pago: {
    etiqueta: texto(ETIQUETA_ESTADO_PAGO, "sin_pago"),
    icono: CircleSlash,
    tono: "neutro",
  },
  reportado: { etiqueta: texto(ETIQUETA_ESTADO_PAGO, "reportado"), icono: Wallet, tono: "info" },
  parcial: { etiqueta: texto(ETIQUETA_ESTADO_PAGO, "parcial"), icono: CircleDot, tono: "aviso" },
  pagado: {
    etiqueta: texto(ETIQUETA_ESTADO_PAGO, "pagado"),
    icono: CircleCheckBig,
    tono: "exito",
  },
  rechazado: {
    etiqueta: texto(ETIQUETA_ESTADO_PAGO, "rechazado"),
    icono: CircleX,
    tono: "peligro",
  },
  reembolsado: {
    etiqueta: texto(ETIQUETA_ESTADO_PAGO, "reembolsado"),
    icono: RotateCcw,
    tono: "neutro",
  },
};

const ESTADOS_VOUCHER: Record<string, EstiloEstado> = {
  generando: { etiqueta: "Generando", icono: LoaderCircle, tono: "info" },
  listo: { etiqueta: "Listo", icono: FileCheck, tono: "exito" },
  error: { etiqueta: "Error", icono: TriangleAlert, tono: "peligro" },
};

const DESCONOCIDO: EstiloEstado = {
  etiqueta: "Estado desconocido",
  icono: CircleHelp,
  tono: "neutro",
};

/** Resuelve el estilo de un estado a partir de su identificador interno. */
export function resolverEstado(estado: string, tipo?: TipoEstado | undefined): EstiloEstado {
  if (tipo === "reserva") return ESTADOS_RESERVA[estado] ?? DESCONOCIDO;
  if (tipo === "pago") return ESTADOS_PAGO[estado] ?? DESCONOCIDO;
  if (tipo === "voucher") return ESTADOS_VOUCHER[estado] ?? DESCONOCIDO;

  if (Object.prototype.hasOwnProperty.call(ESTADOS_RESERVA, estado)) {
    return ESTADOS_RESERVA[estado] ?? DESCONOCIDO;
  }
  if (Object.prototype.hasOwnProperty.call(ESTADOS_PAGO, estado)) {
    return ESTADOS_PAGO[estado] ?? DESCONOCIDO;
  }
  if (Object.prototype.hasOwnProperty.call(ESTADOS_VOUCHER, estado)) {
    return ESTADOS_VOUCHER[estado] ?? DESCONOCIDO;
  }
  return DESCONOCIDO;
}

export interface BadgeEstadoProps {
  /** Identificador interno del estado (p. ej. `pendiente_pago`). */
  estado: string;
  /** Fuerza la familia de estados en vez de deducirla. */
  tipo?: TipoEstado | undefined;
  /** Sobrescribe el texto de la etiqueta. */
  etiqueta?: string | undefined;
  tamano?: "sm" | "md" | undefined;
  className?: string | undefined;
}

/**
 * C-21 · Etiqueta de estado.
 *
 * El estado **nunca** se comunica solo con color: siempre hay icono + texto
 * legible en espanol (Spec 3.9 y 3.10).
 */
export function BadgeEstado({
  estado,
  tipo,
  etiqueta,
  tamano = "sm",
  className,
}: BadgeEstadoProps) {
  const estilo = resolverEstado(estado, tipo);
  const Icono = estilo.icono;
  const textoEstado = etiqueta ?? estilo.etiqueta;

  return (
    <span
      data-estado={estado}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border font-semibold",
        tamano === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        TONOS[estilo.tono],
        className,
      )}
    >
      <Icono
        aria-hidden="true"
        className={cn("shrink-0", tamano === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")}
      />
      <span className="truncate">{textoEstado}</span>
    </span>
  );
}
