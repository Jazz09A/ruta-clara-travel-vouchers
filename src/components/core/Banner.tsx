import * as React from "react";
import { CircleCheckBig, CircleX, Clock, Info, TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { IconoUI } from "@/components/core/EmptyState";
import { cn } from "@/lib/utils";

export type VarianteBanner = "info" | "warning" | "urgente" | "success" | "error";

export interface BannerProps {
  /** Tono del aviso. */
  variante: VarianteBanner;
  /** Titulo opcional (una frase). */
  titulo?: string | undefined;
  /** Contenido del aviso. */
  children: React.ReactNode;
  /** Accion secundaria dentro del aviso. */
  accion?: { etiqueta: string; onClick: () => void } | undefined;
  /** Permite cerrar el aviso. */
  onCerrar?: (() => void) | undefined;
  className?: string | undefined;
}

const VARIANTES: Record<
  VarianteBanner,
  {
    contenedor: string;
    icono: IconoUI;
    assertive: boolean;
  }
> = {
  info: {
    contenedor:
      "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100",
    icono: Info,
    assertive: false,
  },
  warning: {
    contenedor:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
    icono: TriangleAlert,
    assertive: false,
  },
  urgente: {
    contenedor:
      "border-red-300 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100",
    icono: Clock,
    assertive: true,
  },
  success: {
    contenedor:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
    icono: CircleCheckBig,
    assertive: false,
  },
  error: {
    contenedor:
      "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100",
    icono: CircleX,
    assertive: true,
  },
};

/**
 * C-16 · Banner persistente.
 *
 * Se usa para hitos que no se pueden resolver con un toast: hold por vencer,
 * falta de conexion, tasa desactualizada, accion requerida (Spec 3.8).
 * Siempre icono + texto: el estado nunca depende solo del color.
 */
export function Banner({ variante, titulo, children, accion, onCerrar, className }: BannerProps) {
  const estilo = VARIANTES[variante];
  const Icono = estilo.icono;

  return (
    <div
      role={estilo.assertive ? "alert" : "status"}
      aria-live={estilo.assertive ? "assertive" : "polite"}
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3",
        estilo.contenedor,
        className,
      )}
    >
      <Icono className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />

      <div className="min-w-0 flex-1">
        {titulo ? <p className="text-sm font-semibold">{titulo}</p> : null}
        <div className={cn("text-sm leading-relaxed", titulo && "mt-0.5")}>{children}</div>

        {accion ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={accion.onClick}
            className="mt-2 min-h-11 bg-background/80"
          >
            {accion.etiqueta}
          </Button>
        ) : null}
      </div>

      {onCerrar ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCerrar}
          aria-label="Cerrar aviso"
          className="-mr-2 h-11 w-11 shrink-0"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
