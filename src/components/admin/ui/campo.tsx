import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Propiedades de accesibilidad que el campo debe pasar a su control.
 *
 * Se entregan por *render prop* para que cada control reciba exactamente los
 * mismos `aria-describedby` / `aria-invalid` / `aria-errormessage` sin
 * repetir el cableado en cada pantalla (Spec 3.9).
 */
export interface PropsCampoControl {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
  "aria-required": true | undefined;
  "aria-errormessage": string | undefined;
}

export interface CampoProps {
  /** Identificador del control; se usa también para los ids de ayuda/error. */
  id: string;
  /** Etiqueta siempre visible (UX-11). */
  etiqueta: string;
  /** Texto de ayuda visible bajo la etiqueta (UX-11). */
  ayuda?: string | undefined;
  /** Mensaje de error; si existe, el control queda marcado como inválido. */
  error?: string | undefined;
  /** `true` cuando el campo es obligatorio (se marca con «*»). */
  requerido?: boolean | undefined;
  className?: string | undefined;
  children: (props: PropsCampoControl) => React.ReactNode;
}

/**
 * C-02 · Campo de formulario del panel.
 *
 * Unifica etiqueta, ayuda y error para que el mensaje de error siempre quede
 * **junto al campo que falla** y asociado por `aria-describedby`.
 */
export function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  requerido = false,
  className,
  children,
}: CampoProps) {
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const descritos = [ayuda ? idAyuda : null, error ? idError : null].filter(
    (valor): valor is string => valor !== null,
  );
  const descritoPor = descritos.length > 0 ? descritos.join(" ") : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {etiqueta}
        {requerido ? (
          <span className="text-destructive" aria-hidden="true">
            {" "}
            *
          </span>
        ) : (
          <span className="font-normal text-muted-foreground"> (opcional)</span>
        )}
      </label>

      {ayuda ? (
        <p id={idAyuda} className="text-xs leading-snug text-muted-foreground">
          {ayuda}
        </p>
      ) : null}

      {children({
        id,
        "aria-describedby": descritoPor,
        "aria-invalid": error ? true : undefined,
        "aria-required": requerido ? true : undefined,
        "aria-errormessage": error ? idError : undefined,
      })}

      {error ? (
        <p id={idError} className="text-xs font-medium leading-snug text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
