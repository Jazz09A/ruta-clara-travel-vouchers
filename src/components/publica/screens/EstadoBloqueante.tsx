import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CircleAlert, Clock, Link2Off, XCircle } from "lucide-react";

import { MARCA } from "@/lib/brand";
import { cn } from "@/lib/utils";

import { BotonWhatsApp } from "../ui";

export type TonoEstadoBloqueante = "neutro" | "aviso" | "peligro";

export interface EstadoBloqueanteProps {
  titulo: string;
  mensaje: ReactNode;
  /** Motivo técnico ya traducido (por ejemplo «cancelada»). */
  motivo?: string | undefined;
  /** Texto prearmado del mensaje de WhatsApp. */
  whatsappMensaje?: string | undefined;
  /** Acción principal alternativa al WhatsApp. */
  accion?: { etiqueta: string; onClick: () => void } | undefined;
  /** Teléfono de la agencia. */
  telefonoWhatsapp?: string | undefined;
  icono?: LucideIcon | undefined;
  tono?: TonoEstadoBloqueante | undefined;
  className?: string | undefined;
}

const ICONO_POR_TONO: Record<TonoEstadoBloqueante, LucideIcon> = {
  neutro: Link2Off,
  aviso: Clock,
  peligro: XCircle,
};

const ESTILO_TONO: Record<TonoEstadoBloqueante, string> = {
  neutro: "bg-muted text-muted-foreground",
  aviso: "bg-chart-2/15 text-foreground",
  peligro: "bg-destructive/10 text-destructive",
};

/**
 * Pantalla de estado bloqueante (C-30).
 *
 * Es una plantilla única para: enlace inválido (P-11), enlace vencido (P-10),
 * corte de venta, falta de cupo y error recuperable. Ícono grande + texto
 * centrado + WhatsApp siempre disponible.
 */
export function EstadoBloqueante({
  titulo,
  mensaje,
  motivo,
  whatsappMensaje,
  accion,
  telefonoWhatsapp,
  icono,
  tono = "neutro",
  className,
}: EstadoBloqueanteProps) {
  const Icono = icono ?? ICONO_POR_TONO[tono];

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-5 py-8 text-center",
        className,
      )}
    >
      <span
        className={cn(
          "grid h-16 w-16 place-items-center rounded-full",
          ESTILO_TONO[tono],
        )}
      >
        <Icono className="h-8 w-8" aria-hidden="true" />
      </span>

      <div className="max-w-sm">
        <h2 className="text-lg font-extrabold leading-tight text-foreground">{titulo}</h2>
        <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{mensaje}</div>
        {motivo ? (
          <p className="mt-2 text-xs text-muted-foreground">
            <CircleAlert className="mr-1 inline h-3 w-3" aria-hidden="true" />
            {`Motivo: ${motivo}`}
          </p>
        ) : null}
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2">
        {accion ? (
          <button
            type="button"
            onClick={accion.onClick}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {accion.etiqueta}
          </button>
        ) : null}

        <BotonWhatsApp
          telefono={telefonoWhatsapp ?? MARCA.whatsapp}
          mensaje={whatsappMensaje}
          etiqueta="Escríbenos por WhatsApp"
          variante="contorno"
          className="w-full"
        />
      </div>
    </div>
  );
}
