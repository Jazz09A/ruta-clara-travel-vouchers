import * as React from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCopiar } from "@/lib/hooks/use-copiar";
import { cn } from "@/lib/utils";

export interface BotonCopiarProps {
  /** Texto que se copia al portapapeles. */
  valor: string;
  /** Texto visible del boton. Por defecto «Copiar». */
  etiqueta?: string | undefined;
  /** Que se copia, para el nombre accesible. Ej.: «numero de cuenta». */
  contexto?: string | undefined;
  variant?: ButtonProps["variant"] | undefined;
  size?: ButtonProps["size"] | undefined;
  className?: string | undefined;
  /** Se dispara cuando la copia fue exitosa. */
  onCopiado?: ((valor: string) => void) | undefined;
  /** Se dispara cuando no se pudo copiar y se muestra el respaldo manual. */
  onError?: (() => void) | undefined;
}

/**
 * C-25 · Boton copiar al portapapeles.
 *
 * Confirma con «Copiado» y, si el navegador bloquea el portapapeles
 * (contexto no seguro, permiso denegado), muestra un campo de texto con el
 * valor ya seleccionado para copiarlo a mano.
 */
export function BotonCopiar({
  valor,
  etiqueta = "Copiar",
  contexto,
  variant = "outline",
  size = "sm",
  className,
  onCopiado,
  onError,
}: BotonCopiarProps) {
  const { copiar, copiado, error } = useCopiar({
    alCopiar: (valorCopiado) => onCopiado?.(valorCopiado),
    alFallar: () => onError?.(),
  });
  const refCampoManual = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (error) refCampoManual.current?.select();
  }, [error]);

  const nombreAccesible = copiado ? "Copiado" : contexto ? `${etiqueta} ${contexto}` : undefined;

  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <Button
        type="button"
        variant={variant}
        size={size}
        aria-label={nombreAccesible}
        onClick={() => {
          void copiar(valor);
        }}
        className="min-h-11"
      >
        {copiado ? (
          <Check className="text-success" aria-hidden="true" />
        ) : (
          <Copy aria-hidden="true" />
        )}
        <span>{copiado ? "Copiado" : etiqueta}</span>
      </Button>

      <span role="status" aria-live="polite" className="sr-only">
        {copiado ? `${etiqueta}: copiado` : ""}
      </span>

      {error ? (
        <div className="w-full rounded-2xl border border-border bg-muted/60 p-3">
          <p className="mb-2 flex items-start gap-1.5 text-xs leading-snug text-foreground">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              No pudimos copiar automaticamente. Selecciona el texto y copialo con tu dispositivo.
            </span>
          </p>
          <Input
            ref={refCampoManual}
            readOnly
            value={valor}
            aria-label="Texto para copiar manualmente"
            onFocus={(evento) => evento.currentTarget.select()}
            onClick={(evento) => evento.currentTarget.select()}
            className="font-mono text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 min-h-11"
            onClick={() => {
              void copiar(valor);
            }}
          >
            Reintentar copia
          </Button>
        </div>
      ) : null}
    </div>
  );
}
