import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Botón copiar (C-25).
 *
 * Sólo escribe en el portapapeles cuando el usuario pulsa el botón (SEG-07).
 * Si el navegador bloquea el portapapeles, muestra el valor en un campo
 * seleccionable para copiarlo a mano.
 */

export interface BotonCopiarProps extends Omit<ButtonProps, "children" | "value"> {
  /** Texto a copiar. */
  valor: string;
  /** Texto del botón. */
  children?: React.ReactNode;
  /** Mensaje del toast de confirmación. */
  mensaje?: string;
  /** Muestra el valor en un campo de solo lectura cuando la copia falla. */
  fallback?: boolean;
}

export function BotonCopiar({
  valor,
  children = "Copiar enlace",
  mensaje = "Copiado",
  fallback = true,
  className,
  ...props
}: BotonCopiarProps) {
  const [copiado, setCopiado] = React.useState(false);
  const [fallbackVisible, setFallbackVisible] = React.useState(false);

  async function copiar() {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(valor);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      // Fallback: selección manual de un campo de solo lectura.
      try {
        const area = document.createElement("textarea");
        area.value = valor;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        ok = document.execCommand("copy");
        document.body.removeChild(area);
      } catch {
        ok = false;
      }
    }

    if (ok) {
      setCopiado(true);
      toast.success(mensaje);
      window.setTimeout(() => setCopiado(false), 2000);
    } else {
      if (fallback) setFallbackVisible(true);
      toast.error("No pudimos copiar. Copia el enlace manualmente.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button {...props} onClick={() => void copiar()} className={cn(className)}>
        {copiado ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Copy className="h-4 w-4" aria-hidden="true" />
        )}
        {copiado ? "Copiado" : children}
      </Button>
      {fallbackVisible ? (
        <label className="text-xs font-medium text-muted-foreground">
          Copia el enlace manualmente:
          <input
            readOnly
            value={valor}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          />
        </label>
      ) : null}
    </div>
  );
}
