import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Info, Siren } from "lucide-react";

import { cn } from "@/lib/utils";

export type VarianteBanner = "info" | "aviso" | "urgencia" | "exito";

export interface BannerProps {
  variante?: VarianteBanner | undefined;
  titulo?: string | undefined;
  mensaje: ReactNode;
  icono?: LucideIcon | undefined;
  accion?: ReactNode | undefined;
  className?: string | undefined;
}

const ESTILO: Record<VarianteBanner, string> = {
  info: "border-border bg-secondary text-secondary-foreground",
  aviso: "border-chart-2/40 bg-chart-2/10 text-foreground",
  urgencia: "border-destructive/40 bg-destructive/10 text-foreground",
  exito: "border-success/40 bg-success/10 text-foreground",
};

const ICONO_POR_VARIANTE: Record<VarianteBanner, LucideIcon> = {
  info: Info,
  aviso: AlertTriangle,
  urgencia: Siren,
  exito: CheckCircle2,
};

/**
 * Banner persistente (Spec §3.8).
 *
 * El estado nunca se comunica sólo con color: siempre hay ícono + texto.
 */
export function Banner({
  variante = "info",
  titulo,
  mensaje,
  icono,
  accion,
  className,
}: BannerProps) {
  const Icono = icono ?? ICONO_POR_VARIANTE[variante];

  return (
    <div
      className={cn(
        "flex items-start gap-3 border-b px-4 py-3 text-sm",
        ESTILO[variante],
        className,
      )}
    >
      <Icono className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {titulo ? <p className="font-semibold">{titulo}</p> : null}
        <div className={cn(titulo && "mt-0.5 text-foreground/80")}>{mensaje}</div>
      </div>
      {accion ? <div className="shrink-0">{accion}</div> : null}
    </div>
  );
}
