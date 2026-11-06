import * as React from "react";

import {
  InputOTP as InputOTPBase,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

/**
 * Entrada TOTP / código de 6 dígitos (C-23).
 *
 * `inputMode="numeric"` y `autoComplete="one-time-code"` para que el
 * sistema complete el código automáticamente.
 */

export interface InputOTPProps {
  /** Valor actual (sólo dígitos). */
  valor: string;
  /** Se dispara en cada cambio del valor. */
  onValorCambia: (valor: string) => void;
  /** Se dispara cuando se completa el código. */
  onCompleto?: (valor: string) => void;
  /** Número de dígitos (por defecto 6). */
  largo?: number;
  disabled?: boolean;
  id?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  "aria-describedby"?: string;
  "aria-label"?: string;
  className?: string;
}

export function InputOTP({
  valor,
  onValorCambia,
  onCompleto,
  largo = 6,
  disabled = false,
  id,
  autoComplete = "one-time-code",
  inputMode = "numeric",
  className,
  ...aria
}: InputOTPProps) {
  const previo = React.useRef<string>(valor);

  function manejarCambio(nuevo: string) {
    const limpio = nuevo.replace(/\D/g, "").slice(0, largo);
    onValorCambia(limpio);
    if (limpio.length === largo && previo.current.length !== largo) {
      onCompleto?.(limpio);
    }
    previo.current = limpio;
  }

  return (
    <InputOTPBase
      value={valor}
      onChange={manejarCambio}
      maxLength={largo}
      disabled={disabled}
      id={id}
      inputMode={inputMode}
      autoComplete={autoComplete}
      containerClassName={cn("justify-center gap-2", className)}
      {...aria}
    >
      <InputOTPGroup>
        {Array.from({ length: largo }, (_v, i) => (
          <InputOTPSlot
            key={i}
            index={i}
            className="h-12 w-11 rounded-lg border-input text-lg font-bold sm:h-14 sm:w-12"
          />
        ))}
      </InputOTPGroup>
    </InputOTPBase>
  );
}
