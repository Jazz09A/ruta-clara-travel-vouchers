import * as React from "react";
import { TriangleAlert } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> {
  /** Etiqueta siempre visible sobre el campo (UX-11). */
  label: string;
  /** `id` del input y destino de la etiqueta. */
  htmlFor: string;
  /** Texto de ayuda que **no desaparece** al escribir. */
  ayuda?: string | undefined;
  /** Error en lenguaje de persona, mostrado junto al campo (UX-14). */
  error?: string | undefined;
  /** Contador de caracteres. */
  contador?: { actual: number; max: number } | undefined;
  /**
   * `false` marca el campo como opcional (UX-12). Si no se pasa, se deduce
   * del atributo `required`.
   */
  obligatorio?: boolean | undefined;
  /** `id` del input. Por defecto se usa `htmlFor`. */
  id?: string | undefined;
  /** Classes del contenedor (etiqueta + input + textos). */
  className?: string | undefined;
}

/**
 * C-02 · Campo de texto.
 *
 * - Etiqueta siempre visible, texto de ayuda siempre visible debajo.
 * - El error aparece junto al campo, con `aria-invalid` y `aria-describedby`.
 * - La convencion de obligatoriedad es una sola por formulario: se marca
 *   «(opcional)» en los campos que no son obligatorios (UX-12).
 */
export function Field({
  label,
  htmlFor,
  ayuda,
  error,
  contador,
  obligatorio,
  id,
  className,
  required,
  ...props
}: FieldProps) {
  const idInput = id ?? htmlFor;
  const idAyuda = React.useId();
  const idError = React.useId();
  const idContador = React.useId();

  const esObligatorio = obligatorio ?? required ?? true;

  const descritos = [ayuda ? idAyuda : null, error ? idError : null, contador ? idContador : null]
    .filter((valor): valor is string => valor !== null)
    .join(" ");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={idInput} className="text-sm font-medium text-foreground">
        {label}
        {!esObligatorio ? (
          <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>
        ) : null}
      </Label>

      <Input
        {...props}
        id={idInput}
        required={required}
        aria-required={esObligatorio || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritos || undefined}
        className={cn("h-11", error && "border-red-500 focus-visible:ring-red-500")}
      />

      {ayuda ? (
        <p id={idAyuda} className="text-xs leading-snug text-muted-foreground">
          {ayuda}
        </p>
      ) : null}

      {error ? (
        <p
          id={idError}
          className="flex items-start gap-1.5 text-xs leading-snug text-red-700 dark:text-red-300"
        >
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}

      {contador ? (
        <p id={idContador} className="text-right text-xs tabular-nums text-muted-foreground">
          {contador.actual} / {contador.max}
        </p>
      ) : null}
    </div>
  );
}
