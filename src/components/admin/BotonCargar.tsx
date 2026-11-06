import * as React from "react";
import { LoaderCircle } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Botón con estado de carga (C-01).
 *
 * Mientras carga: muestra spinner, marca `aria-busy` y bloquea los clics
 * (UX-18). Nunca se deshabilita por validación, sólo por petición en curso.
 */

export interface BotonCargarProps extends Omit<ButtonProps, "children"> {
  cargando?: boolean;
  /** Texto visible mientras carga. Si se omite, se conserva el del botón. */
  textoCargando?: string;
  /** Contenido del botón. */
  children: React.ReactNode;
}

export function BotonCargar({
  cargando = false,
  textoCargando,
  children,
  className,
  disabled,
  ...props
}: BotonCargarProps) {
  return (
    <Button
      {...props}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={cn(className)}
    >
      {cargando ? (
        <>
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          {textoCargando ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
