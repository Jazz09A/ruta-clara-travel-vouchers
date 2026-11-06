import * as React from "react";
import { LoaderCircle, Lock } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BotonCargarProps extends Omit<ButtonProps, "disabled"> {
  /** Hay una operación en curso: muestra spinner e ignora los clics. */
  cargando?: boolean | undefined;
  /** Acción no disponible: se deshabilita y se explica el motivo debajo. */
  bloqueado?: boolean | undefined;
  /** Texto explicativo que se muestra bajo el button cuando esta bloqueado. */
  motivoBloqueo?: string | undefined;
  /** Texto del boton mientras carga. Por defecto conserva el texto original. */
  textoCargando?: string | undefined;
  /** Clases del contenedor (boton + texto de bloqueo). */
  contenedorClassName?: string | undefined;
}

/**
 * C-01 · Boton con estados de carga y bloqueo.
 *
 * Reglas que aplica:
 * - `cargando`: muestra un spinner, marca `aria-busy` e ignora los clics
 *   (UX-18, doble envio imposible).
 * - `bloqueado`: el boton queda deshabilitado **de forma accesible**
 *   (`aria-disabled`, sigue siendo enfocable para que el usuario pueda leer
 *   la explicacion) y muestra el motivo debajo.
 *
 * El boton **nunca** se deshabilita por validacion: eso lo decide la pantalla
 * (UX-17). Aqui solo el estado `cargando` y el `bloqueado` explicito.
 */
export function BotonCargar({
  cargando = false,
  bloqueado = false,
  motivoBloqueo,
  textoCargando,
  className,
  contenedorClassName,
  children,
  onClick,
  type = "button",
  ...props
}: BotonCargarProps) {
  const inactivo = cargando || bloqueado;
  const idMotivo = React.useId();

  const manejarClick = React.useCallback(
    (evento: React.MouseEvent<HTMLButtonElement>) => {
      if (inactivo) {
        evento.preventDefault();
        evento.stopPropagation();
        return;
      }
      onClick?.(evento);
    },
    [inactivo, onClick],
  );

  return (
    <div className={cn("flex flex-col gap-1", contenedorClassName)}>
      <Button
        {...props}
        type={type}
        onClick={manejarClick}
        aria-busy={cargando || undefined}
        aria-disabled={inactivo || undefined}
        aria-describedby={bloqueado && motivoBloqueo ? idMotivo : undefined}
        className={cn(
          "min-h-11 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
          className,
        )}
      >
        {cargando ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden="true" />
            <span>{textoCargando ?? children}</span>
          </>
        ) : (
          children
        )}
      </Button>

      {bloqueado && motivoBloqueo ? (
        <p
          id={idMotivo}
          className="flex items-start gap-1.5 text-xs leading-snug text-muted-foreground"
        >
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{motivoBloqueo}</span>
        </p>
      ) : null}
    </div>
  );
}
