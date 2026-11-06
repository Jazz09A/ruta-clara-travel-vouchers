import * as React from "react";
import { TriangleAlert } from "lucide-react";

import { BotonWhatsApp } from "@/components/core/BotonWhatsApp";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  /** Causa del error en lenguaje de persona (UX-14). */
  mensaje: string;
  /**
   * Codigo de soporte (`request_id` abreviado). Solo se muestra si se pasa
   * explicitamente: el usuario nunca ve codigos tecnicos.
   */
  codigo?: string | undefined;
  /** Titulo del error. Por defecto «Algo no salio bien». */
  titulo?: string | undefined;
  /** Reintenta la operacion que fallo. */
  onReintentar?: (() => void) | undefined;
  /** Escape: hablar con la agencia por WhatsApp. */
  whatsapp?: { telefono: string; mensaje: string } | undefined;
  /** Suprime el codigo de soporte aunque se haya pasado. */
  noTecnico?: boolean | undefined;
  className?: string | undefined;
}

/**
 * C-30 · Pantalla de error recuperable.
 *
 * Nunca muestra codigos tecnicos al usuario final: el `request_id` aparece
 * unicamente como «Codigo de soporte» cuando se pasa de forma explicita
 * (Spec 3.5 y 11).
 */
export function ErrorState({
  mensaje,
  codigo,
  titulo = "Algo no salio bien",
  onReintentar,
  whatsapp,
  noTecnico = false,
  className,
}: ErrorStateProps) {
  const mostrarCodigo = !noTecnico && typeof codigo === "string" && codigo.trim().length > 0;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-5 py-10 text-center",
        className,
      )}
    >
      <TriangleAlert className="h-8 w-8 text-destructive" aria-hidden="true" />

      <h2 className="text-base font-semibold text-foreground">{titulo}</h2>

      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{mensaje}</p>

      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        {onReintentar ? (
          <Button type="button" onClick={onReintentar} className="min-h-11">
            Reintentar
          </Button>
        ) : null}

        {whatsapp ? (
          <BotonWhatsApp
            telefono={whatsapp.telefono}
            mensaje={whatsapp.mensaje}
            etiqueta="Contactar por WhatsApp"
            variant={onReintentar ? "outline" : "default"}
          />
        ) : null}
      </div>

      {mostrarCodigo ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Codigo de soporte: <span className="font-mono">{codigo}</span>
        </p>
      ) : null}
    </div>
  );
}
