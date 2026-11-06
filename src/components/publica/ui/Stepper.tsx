import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

export interface StepperProps {
  id?: string | undefined;
  valor: number;
  min?: number | undefined;
  max?: number | undefined;
  onChange: (valor: number) => void;
  /** Texto accesible del control (por ejemplo "Toldo"). */
  etiqueta: string;
  deshabilitado?: boolean | undefined;
  className?: string | undefined;
}

/**
 * Stepper de cantidad (C-06 / Spec §6.2).
 *
 * Los botones son de 44 px, operables con teclado y anuncian el valor
 * actual a los lectores de pantalla.
 */
export function Stepper({
  id,
  valor,
  min = 0,
  max = 99,
  onChange,
  etiqueta,
  deshabilitado,
  className,
}: StepperProps) {
  const idFinal = id ?? "stepper";
  const puedeRestar = !deshabilitado && valor > min;
  const puedeSumar = !deshabilitado && valor < max;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, valor - 1))}
        disabled={!puedeRestar}
        aria-label={`Quitar una unidad de ${etiqueta}`}
        className="grid h-11 w-11 place-items-center rounded-xl border border-input bg-card text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>

      <output
        id={idFinal}
        aria-label={`${etiqueta}: ${valor}`}
        className="min-w-10 text-center text-base font-bold tabular-nums text-foreground"
      >
        {valor}
      </output>

      <button
        type="button"
        onClick={() => onChange(Math.min(max, valor + 1))}
        disabled={!puedeSumar}
        aria-label={`Agregar una unidad de ${etiqueta}`}
        className="grid h-11 w-11 place-items-center rounded-xl border border-input bg-card text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
