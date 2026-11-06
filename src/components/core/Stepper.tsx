import * as React from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface StepperProps {
  /** Cantidad actual. */
  value: number;
  /** Se llama con la nueva cantidad (ya limitada al rango). */
  onChange: (valor: number) => void;
  /** Cantidad minima. Por defecto 0. */
  min?: number | undefined;
  /** Cantidad maxima. Por defecto 99. */
  max?: number | undefined;
  /** Incremento por pulsacion. Por defecto 1. */
  paso?: number | undefined;
  disabled?: boolean | undefined;
  /** Nombre del elemento («Adultos», «Toldo»). */
  etiqueta?: string | undefined;
  /** Precio unitario ya formateado («$10,00 c/u»). */
  precioUnitario?: string | undefined;
  /** Texto que se muestra cuando se alcanza el maximo. */
  mensajeMaximo?: string | undefined;
  className?: string | undefined;
}

/**
 * C-06 · Control de cantidad.
 *
 * Botones `-` / `+` accesibles por teclado con nombre explicito, campo de
 * cantidad editable y limites min/max (Spec 6.2, tipo `extra`).
 */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  paso = 1,
  disabled = false,
  etiqueta,
  precioUnitario,
  mensajeMaximo,
  className,
}: StepperProps) {
  const sufijo = etiqueta ? ` de ${etiqueta}` : "";

  const ajustar = React.useCallback(
    (nuevo: number) => {
      if (!Number.isFinite(nuevo)) return;
      const limitado = Math.min(max, Math.max(min, nuevo));
      if (limitado !== value) onChange(limitado);
    },
    [max, min, onChange, value],
  );

  const alEscribir = React.useCallback(
    (evento: React.ChangeEvent<HTMLInputElement>) => {
      const bruto = evento.target.value;
      if (bruto.trim() === "") return;
      const numero = Number.parseInt(bruto, 10);
      if (Number.isNaN(numero)) return;
      ajustar(numero);
    },
    [ajustar],
  );

  const enMinimo = value <= min;
  const enMaximo = value >= max;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => ajustar(value - paso)}
          disabled={disabled || enMinimo}
          aria-label={`Quitar${sufijo}`}
          className="h-11 w-11"
        >
          <Minus aria-hidden="true" />
        </Button>

        <div className="flex flex-col items-center">
          <Input
            type="number"
            inputMode="numeric"
            value={value}
            onChange={alEscribir}
            onBlur={() => ajustar(value)}
            min={min}
            max={max}
            step={paso}
            disabled={disabled}
            aria-label={`Cantidad${sufijo}`}
            className="h-11 w-16 px-1 text-center tabular-nums"
          />
          {precioUnitario ? (
            <span className="mt-1 text-xs leading-none text-muted-foreground">
              {precioUnitario}
            </span>
          ) : null}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => ajustar(value + paso)}
          disabled={disabled || enMaximo}
          aria-label={`Agregar${sufijo}`}
          className="h-11 w-11"
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>

      {enMaximo && mensajeMaximo ? (
        <p className="text-xs leading-snug text-muted-foreground">{mensajeMaximo}</p>
      ) : null}
    </div>
  );
}
