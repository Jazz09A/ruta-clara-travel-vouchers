import { useEffect, useState } from "react";

import { formatCountdown, formatHorasMinutos } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMovimientoReducido } from "./hooks";

export interface ContadorRegresivoProps {
  /** Instante ISO de vencimiento del hold. */
  expiraEn: string;
  /**
   * Desfase entre el reloj del servidor y el del dispositivo, en ms.
   * `servidor - dispositivo`. Se calcula una vez al arrancar (Spec §4.6).
   */
  desfaseServidorMs?: number | undefined;
  /** Se dispara cuando el contador llega a cero (la app refresca el estado). */
  onVencer?: (() => void) | undefined;
  /** `horas` siempre; `auto` cambia a `MM:SS` bajo 10 minutos. */
  formato?: "auto" | "horas" | "mm:ss" | undefined;
  className?: string | undefined;
}

/**
 * Cuenta regresiva del hold (C-11 / Spec §4.6).
 *
 * Se alinea con el reloj del servidor, no con el del dispositivo. Con
 * `prefers-reduced-motion` la cuenta se congela visualmente (no parpadea ni
 * se actualiza) pero sigue siendo exacta al leerla.
 */
export function ContadorRegresivo({
  expiraEn,
  desfaseServidorMs = 0,
  onVencer,
  formato = "auto",
  className,
}: ContadorRegresivoProps) {
  const reducido = useMovimientoReducido();
  const [restante, setRestante] = useState<number>(() => calcular(expiraEn, desfaseServidorMs));

  useEffect(() => {
    setRestante(calcular(expiraEn, desfaseServidorMs));
  }, [expiraEn, desfaseServidorMs]);

  useEffect(() => {
    if (reducido) return;
    const id = window.setInterval(() => {
      setRestante(calcular(expiraEn, desfaseServidorMs));
    }, 1000);
    return () => window.clearInterval(id);
  }, [expiraEn, desfaseServidorMs, reducido]);

  useEffect(() => {
    if (restante <= 0) onVencer?.();
  }, [restante, onVencer]);

  if (restante <= 0) {
    return <span className={cn("font-semibold tabular-nums", className)}>00:00</span>;
  }

  const texto =
    formato === "mm:ss"
      ? formatCountdown(restante)
      : formato === "horas"
        ? formatHorasMinutos(restante)
        : restante < 10 * 60 * 1000
          ? formatCountdown(restante)
          : formatHorasMinutos(restante);

  return (
    <span className={cn("font-semibold tabular-nums", className)} aria-live="off">
      {texto}
    </span>
  );
}

function calcular(expiraEn: string, desfaseServidorMs: number): number {
  const objetivo = new Date(expiraEn).getTime();
  if (Number.isNaN(objetivo)) return 0;
  // El reloj del dispositivo se corrige con el desfase del servidor.
  return objetivo - (Date.now() + desfaseServidorMs);
}
