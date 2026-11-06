import type { ReactNode } from "react";
import { AlertCircle, Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Attributes ARIA que el campo debe replicar en su control.
 *
 * Se deliveran como render prop para no duplicar ids ni reglas de error en
 * cada pantalla: el control siempre queda enlazado con su etiqueta, su ayuda
 * y su error (Spec §3.9, UX-14).
 */
export interface CampoAria {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": boolean | undefined;
  "aria-required": boolean | undefined;
}

export interface CampoProps {
  id: string;
  etiqueta: string;
  /** Texto de ayuda visible bajo el campo (UX-11). */
  ayuda?: string | undefined;
  /** Error del campo. Se muestra junto al campo, nunca como aviso flotante. */
  error?: string | undefined;
  /** Aviso no bloqueante (por ejemplo, sugerencia de correo). */
  aviso?: string | undefined;
  /** `true` = obligatorio; `false` = se marca "(opcional)" (UX-12). */
  requerido?: boolean | undefined;
  className?: string | undefined;
  children: (aria: CampoAria) => ReactNode;
}

export function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  aviso,
  requerido,
  className,
  children,
}: CampoProps) {
  const descritos = [
    ayuda ? `${id}-ayuda` : null,
    aviso ? `${id}-aviso` : null,
    error ? `${id}-error` : null,
  ].filter((valor): valor is string => valor !== null);

  const aria: CampoAria = {
    id,
    "aria-describedby": descritos.length > 0 ? descritos.join(" ") : undefined,
    "aria-invalid": error ? true : undefined,
    "aria-required": requerido ? true : undefined,
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {etiqueta}
        {requerido === false ? (
          <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>
        ) : null}
      </label>

      {children(aria)}

      {ayuda ? (
        <p id={`${id}-ayuda`} className="text-xs leading-relaxed text-muted-foreground">
          {ayuda}
        </p>
      ) : null}

      {aviso ? (
        <p
          id={`${id}-aviso`}
          className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{aviso}</span>
        </p>
      ) : null}

      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-start gap-1.5 text-xs font-medium leading-relaxed text-destructive"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
