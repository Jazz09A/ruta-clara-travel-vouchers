import * as React from "react";

import { formatCountdown, formatHorasMinutos } from "@/lib/format";

export interface OpcionesCuentaRegresiva {
  /**
   * Instante actual del servidor en epoch (ms), tomado de la cabecera `Date`
   * (EC-13). Si se pasa, la cuenta se alinea con el reloj de la agencia y no
   * con el del dispositivo.
   */
  servidorAhora?: number | undefined;
  /**
   * `true` cuando hay un pago por verificar: el vencimiento queda congelado
   * y no hay cuenta regresiva (Spec 4.6).
   */
  congelado?: boolean | undefined;
  /**
   * `true` para no re-renderizar cada segundo (movimiento reducido). El valor
   * exacto se puede recuperar con `refrescar()`.
   */
  pausado?: boolean | undefined;
}

export interface ResultadoCuentaRegresiva {
  /** Milisegundos que faltan (0 si ya expiró o no hay fecha). */
  msRestantes: number;
  /** `true` cuando el tiempo se agotó. */
  expirado: boolean;
  /** `Hh MMm` bajo 24 h y `MM:SS` bajo 10 min. */
  formateado: string;
  /** `23 h 40 min` — texto largo para banners. */
  formateadoLargo: string;
  /** Instante actual ya corregido con el reloj del servidor. */
  ahoraServidor: number;
  /** Fuerza el recálculo exacto del valor (p. ej. al enfocar el contador). */
  refrescar: () => void;
}

/**
 * Cuenta regresiva alineada con el reloj del servidor.
 *
 * Re-renderiza una vez por segundo mientras el tiempo corre. Si `congelado`
 * o `pausado` están activos, el valor se congela y solo cambia cuando se
 * llama a `refrescar()`.
 */
export function useCuentaRegresiva(
  expiraEn: string | null | undefined,
  opciones: OpcionesCuentaRegresiva = {},
): ResultadoCuentaRegresiva {
  const { servidorAhora, congelado = false, pausado = false } = opciones;

  // Reloj del servidor: desfase constante respecto al del dispositivo.
  const [desfase, setDesfase] = React.useState(0);
  React.useEffect(() => {
    if (typeof servidorAhora === "number" && Number.isFinite(servidorAhora)) {
      setDesfase(servidorAhora - Date.now());
    }
  }, [servidorAhora]);

  // Fuerza el re-render periódico.
  const [, setTick] = React.useState(0);

  const expiraMs = expiraEn ? new Date(expiraEn).getTime() : Number.NaN;
  const hayFecha = Number.isFinite(expiraMs);

  // Valor congelado (sin pago por validar o con movimiento reducido).
  const [valorCongelado, setValorCongelado] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!hayFecha) {
      setValorCongelado(null);
      return;
    }
    if (!congelado && !pausado) {
      setValorCongelado(null);
      return;
    }
    // Congela el valor del momento en que se activa el estado.
    setValorCongelado((previo) =>
      previo ?? Math.max(0, expiraMs - (Date.now() + desfase)),
    );
  }, [hayFecha, congelado, pausado, expiraMs, desfase]);

  React.useEffect(() => {
    if (!hayFecha || congelado || pausado) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [hayFecha, congelado, pausado]);

  const ahoraServidor = Date.now() + desfase;

  const msRestantes = !hayFecha
    ? 0
    : (valorCongelado ?? Math.max(0, expiraMs - ahoraServidor));

  const refrescar = React.useCallback(() => {
    if (!hayFecha) return;
    const restante = Math.max(0, expiraMs - (Date.now() + desfase));
    setValorCongelado(congelado || pausado ? restante : null);
    setTick((t) => t + 1);
  }, [hayFecha, expiraMs, desfase, congelado, pausado]);

  return {
    msRestantes,
    expirado: hayFecha && msRestantes <= 0,
    formateado: formatCountdown(msRestantes),
    formateadoLargo: formatHorasMinutos(msRestantes),
    ahoraServidor,
    refrescar,
  };
}
