import * as React from "react";
import { ArrowLeft } from "lucide-react";

import { BotonCargar } from "@/components/core/BotonCargar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ActionBarProps {
  /** Accion principal. El boton **no** se deshabilita por validacion (UX-17). */
  onContinuar?: (() => void) | undefined;
  /** Accion secundaria de retroceso. */
  onAtrás?: (() => void) | undefined;
  /** Texto del boton principal. Por defecto «Continuar». */
  textoContinuar?: string | undefined;
  /** Texto del boton secundario. Por defecto «Atras». */
  textoAtrás?: string | undefined;
  /** Hay una operacion en curso: el boton principal muestra progreso. */
  cargando?: boolean | undefined;
  /** Bloquea la accion principal (por ejemplo, sin conexion). */
  bloqueado?: boolean | undefined;
  /** Explicacion del bloqueo, mostrada bajo los botones. */
  motivoBloqueo?: string | undefined;
  /** Acciones secundarias adicionales (p. ej. «Guardar y salir»). */
  children?: React.ReactNode | undefined;
  /** Oculta el boton «Atras». */
  sinAtrás?: boolean | undefined;
  /** `submit` para usar la barra dentro de un formulario. */
  type?: "button" | "submit" | undefined;
  className?: string | undefined;
}

/**
 * C-08 · Barra de accion inferior.
 *
 * En movil queda anclada abajo (UX-05), respeta el *safe area* del dispositivo
 * y el alto dinamico del viewport (UX-06). En escritorio vuelve al flujo normal
 * del contenido.
 *
 * El boton principal solo se deshabilita mientras hay una peticion en curso:
 * nunca por validacion pendiente (UX-17).
 */
export function ActionBar({
  onContinuar,
  onAtrás,
  textoContinuar = "Continuar",
  textoAtrás = "Atras",
  cargando = false,
  bloqueado = false,
  motivoBloqueo,
  children,
  sinAtrás = false,
  type = "button",
  className,
}: ActionBarProps) {
  return (
    <nav
      aria-label="Acciones del paso"
      className={cn(
        "sticky bottom-0 z-40 w-full border-t border-border bg-background/95 backdrop-blur-sm",
        "pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3",
        "lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 lg:max-w-none lg:px-0">
        {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}

        <div className="flex items-start gap-2">
          {!sinAtrás ? (
            <Button
              type="button"
              variant="outline"
              onClick={onAtrás}
              disabled={cargando}
              className="min-h-11 shrink-0"
            >
              <ArrowLeft aria-hidden="true" />
              <span>{textoAtrás}</span>
            </Button>
          ) : null}

          <BotonCargar
            type={type}
            onClick={onContinuar}
            cargando={cargando}
            bloqueado={bloqueado}
            motivoBloqueo={motivoBloqueo}
            contenedorClassName="min-w-0 flex-1"
          >
            {textoContinuar}
          </BotonCargar>
        </div>
      </div>
    </nav>
  );
}
