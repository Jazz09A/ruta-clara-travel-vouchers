import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SelectorFechaProps {
  /** Fecha seleccionada en formato YYYY-MM-DD. */
  valor: string;
  onChange: (valor: string) => void;
  /** Texto del botón cuando no hay fecha. */
  placeholder?: string;
  /** No permite fechas anteriores a hoy (por defecto `true`). */
  soloFuturas?: boolean;
  className?: string | undefined;
  id?: string | undefined;
  disabled?: boolean | undefined;
}

/** Convierte `YYYY-MM-DD` a Date local (sin desfase de zona horaria). */
function aFecha(iso: string): Date | undefined {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!partes) return undefined;
  const fecha = new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
}

/** Convierte un Date local a `YYYY-MM-DD`. */
function aIso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/**
 * Selector de fecha con calendario (Popover + Calendar).
 *
 * El panel usa `input type="date"` en otros sitios, pero para elegir varias
 * salidas de un tour el calendario es mucho más rápido.
 */
export function SelectorFecha({
  valor,
  onChange,
  placeholder = "Elegir fecha",
  soloFuturas = true,
  className,
  id,
  disabled,
}: SelectorFechaProps) {
  const [abierto, setAbierto] = React.useState(false);
  const seleccionada = aFecha(valor);

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "min-h-11 w-full justify-start px-3 font-normal",
            !seleccionada && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {seleccionada ? format(seleccionada, "d MMM yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={seleccionada}
          onSelect={(fecha) => {
            if (fecha) onChange(aIso(fecha));
            setAbierto(false);
          }}
          disabled={soloFuturas ? { before: new Date() } : undefined}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
