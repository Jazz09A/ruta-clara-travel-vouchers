import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Campo de formulario (C-02).
 *
 * La etiqueta siempre está visible, el texto de ayuda va debajo y no
 * desaparece, y el error se conecta al campo con `aria-invalid` +
 * `aria-describedby` (UX-11, UX-14).
 */

export interface FieldProps {
  /** Identificador del control (se usa para `htmlFor` y para los `aria-*`). */
  id: string;
  etiqueta: string;
  /** Texto de ayuda, debajo del campo. */
  ayuda?: string;
  /** Mensaje de error; si existe, el campo queda `aria-invalid`. */
  error?: string;
  /** Marca el campo como obligatorio. */
  obligatorio?: boolean;
  /** El control. Se le inyectan `id`, `aria-invalid` y `aria-describedby`. */
  children: React.ReactElement;
  /** Contenido alineado a la derecha dentro del campo (p. ej. ver contraseña). */
  trailing?: React.ReactNode;
  className?: string;
}

type PropsDescendientes = {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export function Field({
  id,
  etiqueta,
  ayuda,
  error,
  obligatorio = false,
  children,
  trailing,
  className,
}: FieldProps) {
  const idAyuda = ayuda ? `${id}-ayuda` : null;
  const idError = error ? `${id}-error` : null;
  const descritos = [idAyuda, idError].filter((v): v is string => v !== null).join(" ");

  const hijo = React.isValidElement<PropsDescendientes>(children)
    ? React.cloneElement(children, {
        id,
        ...(error ? { "aria-invalid": true } : {}),
        ...(descritos ? { "aria-describedby": descritos } : {}),
      })
    : children;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">
        {etiqueta}
        {obligatorio ? (
          <span className="ml-1 font-normal text-muted-foreground">(obligatorio)</span>
        ) : (
          <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>
        )}
      </label>
      <div className="relative">
        {hijo}
        {trailing ? (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1">{trailing}</div>
        ) : null}
      </div>
      {ayuda ? (
        <p id={idAyuda ?? undefined} className="text-xs text-muted-foreground">
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p id={idError ?? undefined} role="alert" className="text-xs font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
