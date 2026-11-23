import * as React from "react";
import { TriangleAlert } from "lucide-react";

import { InputOTP as InputOTPRaiz, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface InputOTPProps {
  /** Se dispara automaticamente al completar el ultimo digito. */
  onComplete?: ((codigo: string) => void) | undefined;
  /** Numero de digitos. Por defecto 6. */
  length?: number | undefined;
  /** Valor controlado. Si se omite, el componente guarda el estado internamente. */
  value?: string | undefined;
  /** Notifica cada cambio del valor. */
  onChange?: ((valor: string) => void) | undefined;
  disabled?: boolean | undefined;
  autoFocus?: boolean | undefined;
  /** Etiqueta del campo. */
  label?: string | undefined;
  /** Error en lenguaje de persona. */
  error?: string | undefined;
  /** `id` del input oculto que recibe los digitos. */
  id?: string | undefined;
  /** Texto de ayuda bajo el campo. */
  ayuda?: string | undefined;
  className?: string | undefined;
}

/**
 * C-23 · Entrada de codigo TOTP.
 *
 * Seis digitos numericos con `inputMode="numeric"` y
 * `autoComplete="one-time-code"`; el envio es automatico al completar el
 * ultimo digito (Spec UX-62).
 */
export function InputOTP({
  onComplete,
  length = 6,
  value,
  onChange,
  disabled = false,
  autoFocus = false,
  label = "Codigo de verificacion",
  error,
  id = "codigo-otp",
  ayuda,
  className,
}: InputOTPProps) {
  const [valorInterno, setValorInterno] = React.useState("");
  const valor = value ?? valorInterno;

  const idAyuda = React.useId();
  const idError = React.useId();
  const descritos = [ayuda ? idAyuda : null, error ? idError : null]
    .filter((item): item is string => item !== null)
    .join(" ");

  const manejarCambio = React.useCallback(
    (nuevo: string) => {
      const soloDigitos = nuevo.replace(/\D/g, "").slice(0, length);
      if (value === undefined) setValorInterno(soloDigitos);
      onChange?.(soloDigitos);
    },
    [length, onChange, value],
  );

  // Envio automatico al completar el ultimo digito.
  const ultimoEnviado = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (valor.length === length && ultimoEnviado.current !== valor) {
      ultimoEnviado.current = valor;
      onComplete?.(valor);
      return;
    }
    if (valor.length < length) {
      ultimoEnviado.current = null;
    }
  }, [valor, length, onComplete]);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>

      <InputOTPRaiz
        id={id}
        maxLength={length}
        value={valor}
        onChange={manejarCambio}
        disabled={disabled}
        autoFocus={autoFocus}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        aria-invalid={error ? true : undefined}
        aria-describedby={descritos || undefined}
        containerClassName="justify-start gap-2"
        className="disabled:cursor-not-allowed"
      >
        <InputOTPGroup>
          {Array.from({ length }, (_, indice) => (
            <InputOTPSlot
              key={indice}
              index={indice}
              className="h-12 w-10 rounded-xl text-base sm:w-12"
            />
          ))}
        </InputOTPGroup>
      </InputOTPRaiz>

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
    </div>
  );
}
