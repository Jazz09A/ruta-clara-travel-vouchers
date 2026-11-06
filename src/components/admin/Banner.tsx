import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Banner persistente (C-16).
 *
 * Se usa para avisos que deben permanecer hasta resolverse: sesión cerrada
 * por seguridad, tasa desactualizada, acciones requeridas, avisos de demo.
 */

export type TonoBanner = "info" | "aviso" | "peligro" | "exito";

export interface BannerProps {
  tono?: TonoBanner;
  titulo?: string;
  children?: ReactNode;
  icono?: LucideIcon;
  /** Acción a la derecha (botón o enlace). */
  accion?: ReactNode;
  className?: string;
}

const ESTILOS: Record<TonoBanner, string> = {
  info: "border-primary/30 bg-secondary text-secondary-foreground",
  aviso: "border-amber-600/35 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  peligro: "border-red-600/35 bg-red-500/10 text-red-900 dark:text-red-100",
  exito: "border-emerald-600/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
};

const ICONOS: Record<TonoBanner, LucideIcon> = {
  info: Info,
  aviso: TriangleAlert,
  peligro: CircleAlert,
  exito: CircleCheck,
};

export function Banner({
  tono = "info",
  titulo,
  children,
  icono,
  accion,
  className,
}: BannerProps) {
  const Icono = icono ?? ICONOS[tono];
  return (
    <div
      role={tono === "peligro" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        ESTILOS[tono],
        className,
      )}
    >
      <Icono className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {titulo ? <p className="font-bold">{titulo}</p> : null}
        {children ? <div className={titulo ? "mt-0.5" : ""}>{children}</div> : null}
      </div>
      {accion ? <div className="shrink-0">{accion}</div> : null}
    </div>
  );
}
