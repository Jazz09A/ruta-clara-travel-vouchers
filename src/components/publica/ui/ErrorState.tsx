import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  titulo: string;
  mensaje?: ReactNode | undefined;
  /** Código de soporte abreviado para que el cliente lo dicte (Spec §3.5). */
  codigoSoporte?: string | undefined;
  accion?: ReactNode | undefined;
  className?: string | undefined;
}

/**
 * Estado de error recuperable (C-30).
 * Ícono + texto: el estado nunca se comunica sólo con color.
 */
export function ErrorState({ titulo, mensaje, codigoSoporte, accion, className }: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-5 py-8 text-center",
        className,
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-base font-bold text-foreground">{titulo}</h2>
        {mensaje ? (
          <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {mensaje}
          </p>
        ) : null}
      </div>
      {codigoSoporte ? (
        <p className="text-xs text-muted-foreground">{`Código de soporte: ${codigoSoporte}`}</p>
      ) : null}
      {accion}
    </div>
  );
}
