import * as React from "react";
import { Pause, Timer } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCuentaRegresiva } from "@/lib/hooks/use-cuenta-regresiva";
import { useMovimientoReducido } from "@/lib/hooks/use-media-query";

/** Umbral de aviso: el cupo vence pronto (Spec 4.6). */
const UMBRAL_AVISO = 2 * 60 * 60 * 1000;
/** Umbral de urgencia: quedan menos de 10 minutos. */
const UMBRAL_URGENTE = 10 * 60 * 1000;

export interface ContadorRegresivoProps {
  /** Instante ISO de expiracion del hold. */
  expiraEn: string;
  /** Instante actual del servidor en epoch (ms) para alinear el reloj. */
  servidorAhora?: number | undefined;
  /** `true` cuando hay un pago por verificar: el tiempo queda congelado. */
  congelado?: boolean | undefined;
  /** Muestra el texto largo ("23 h 40 min") junto al reloj. */
  conTextoLargo?: boolean | undefined;
  /** Prefijo del texto para lectores de pantalla. */
  etiqueta?: string | undefined;
  className?: string | undefined;
}

/**
 * C-11 · Cuenta regresiva del hold.
 *
 * - Se alinea con el reloj del **servidor**, no con el del dispositivo (EC-13).
 * - Formato `Hh MMm` bajo 24 h y `MM:SS` bajo 10 min.
 * - Con `prefers-reduced-motion` deja de actualizarse visualmente, pero el
 *   valor sigue siendo exacto al enfocar el contador.
 * - No anuncia cada segundo: solo avisa al cruzar los umbrales de aviso y
 *   urgencia (Spec 4.6).
 */
export function ContadorRegresivo({
  expiraEn,
  servidorAhora,
  congelado = false,
  conTextoLargo = false,
  etiqueta = "Tiempo restante",
  className,
}: ContadorRegresivoProps) {
  const movimientoReducido = useMovimientoReducido();
  const [enfocado, setEnfocado] = React.useState(false);
  const pausado = movimientoReducido && !enfocado;

  const { msRestantes, expirado, formateado, formateadoLargo, refrescar } = useCuentaRegresiva(
    expiraEn,
    { servidorAhora, congelado, pausado },
  );

  const [anuncio, setAnuncio] = React.useState("");

  // La ventana puede ser corta (inactividad al iniciar el registro) o larga
  // (hold tras confirmar): el aviso se dispara a mitad de la ventana
  // observada y nunca más tarde de las 2 h (Spec 4.6).
  const ventanaRef = React.useRef(0);
  if (msRestantes > ventanaRef.current) ventanaRef.current = msRestantes;
  const umbralAviso = Math.min(UMBRAL_AVISO, ventanaRef.current / 2);

  React.useEffect(() => {
    if (expirado) {
      setAnuncio("El tiempo para completar la reserva vencio");
      return;
    }
    if (msRestantes <= UMBRAL_URGENTE) {
      setAnuncio("Quedan menos de 10 minutos");
      return;
    }
    if (msRestantes <= umbralAviso) {
      setAnuncio("El tiempo del cupo está por vencer");
      return;
    }
    setAnuncio("");
  }, [msRestantes, expirado, umbralAviso]);

  if (!expiraEn) return null;

  const urgente = expirado || msRestantes <= UMBRAL_URGENTE;
  const aviso = !urgente && msRestantes <= umbralAviso;

  const tono = urgente
    ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
    : aviso
      ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
      : "border-border bg-muted text-slate-700 dark:text-slate-300";

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        role="timer"
        onFocus={() => {
          setEnfocado(true);
          refrescar();
        }}
        onBlur={() => setEnfocado(false)}
        tabIndex={0}
        aria-label={`${etiqueta}: ${expirado ? "vencido" : formateado}`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold tabular-nums",
          tono,
        )}
      >
        {congelado ? (
          <Pause className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Timer className="h-4 w-4" aria-hidden="true" />
        )}
        <span>{expirado ? "Vencio" : formateado}</span>
        {conTextoLargo && !expirado ? (
          <span className="hidden font-normal opacity-80 sm:inline">({formateadoLargo})</span>
        ) : null}
      </span>

      {/* Aviso de estado: solo cambia al cruzar umbrales, no cada segundo. */}
      <span role="status" aria-live="polite" className="sr-only">
        {anuncio}
      </span>
    </span>
  );
}
