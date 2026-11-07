import { Check, CircleDashed, Lock, PlayCircle } from "lucide-react";

import { ETIQUETA_ESTADO_RESERVA, formatRelative } from "@/lib/format";
import type { EstadoReserva, PasoActual } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Panel de progreso de la reserva (A-07).
 *
 * Muestra los pasos del flujo del cliente, en qué punto está, cuándo fue la
 * última actividad y qué falta por completar. Los pasos se derivan del
 * estado que devuelve el servidor; el cliente no decide transiciones.
 */

interface Paso {
  id: string;
  etiqueta: string;
  estado: "completo" | "actual" | "pendiente" | "bloqueado";
}

const FLUJO: { id: string; etiqueta: string }[] = [
  { id: "titular", etiqueta: "Titular" },
  { id: "acompanantes", etiqueta: "Acompañantes" },
  { id: "preguntas", etiqueta: "Preguntas" },
  { id: "resumen", etiqueta: "Resumen" },
  { id: "terminos", etiqueta: "Términos" },
  { id: "firma", etiqueta: "Firma" },
  { id: "pago", etiqueta: "Pago" },
  { id: "verificacion", etiqueta: "Verificación" },
];

const INDICE_POR_PASO: Record<PasoActual, number> = {
  paso_registro: -1,
  titular: 0,
  acompanantes: 1,
  preguntas: 2,
  resumen: 3,
  terminos: 4,
  firma: 5,
  pago: 6,
  verificacion: 7,
  confirmada: 8,
  cerrada: -1,
};

const ESTADOS_CERRADOS: EstadoReserva[] = ["cancelada", "expirada", "completada"];

/** Calcula el estado de cada paso del flujo a partir del estado de la reserva. */
export function calcularPasos(estado: EstadoReserva, pasoActual: PasoActual): Paso[] {
  const indice = INDICE_POR_PASO[pasoActual];
  const cerrada = ESTADOS_CERRADOS.includes(estado);
  const completada = estado === "confirmada" || estado === "completada";

  return FLUJO.map((paso, i) => {
    let estadoPaso: Paso["estado"];
    if (completada) {
      estadoPaso = "completo";
    } else if (cerrada) {
      estadoPaso = i <= Math.max(indice, -1) ? "completo" : "bloqueado";
    } else if (indice < 0) {
      estadoPaso = "pendiente";
    } else if (i < indice) {
      estadoPaso = "completo";
    } else if (i === indice) {
      estadoPaso = "actual";
    } else {
      estadoPaso = "bloqueado";
    }
    return { id: paso.id, etiqueta: paso.etiqueta, estado: estadoPaso };
  });
}

/** Texto del estado de un paso (nunca solo color). */
export const TEXTO_ESTADO_PASO: Record<Paso["estado"], string> = {
  completo: "Completado",
  actual: "En curso",
  pendiente: "Pendiente",
  bloqueado: "Bloqueado",
};

export interface ProgresoReservaProps {
  /** Estado actual de la reserva. */
  estado: EstadoReserva;
  /** Paso en el que está el cliente. */
  pasoActual: PasoActual;
  /** Última actividad registrada. */
  ultimaActividadEn: string;
  /** Datos que aún faltan por completar (texto legible). */
  camposFaltantes: string[];
  className?: string | undefined;
}

export function ProgresoReserva({
  estado,
  pasoActual,
  ultimaActividadEn,
  camposFaltantes,
  className,
}: ProgresoReservaProps) {
  const pasos = calcularPasos(estado, pasoActual);
  const completados = pasos.filter((paso) => paso.estado === "completo").length;
  const indiceActual = pasos.findIndex((paso) => paso.estado === "actual");

  return (
    <section
      aria-label="Progreso de la reserva"
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-card",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground">Progreso</h2>
        <p className="text-xs text-muted-foreground">
          {`${completados} de ${pasos.length} pasos completados · última actividad ${formatRelative(ultimaActividadEn)}`}
        </p>
      </header>

      <ol className="flex flex-col gap-2">
        {pasos.map((paso) => {
          const Icono =
            paso.estado === "completo"
              ? Check
              : paso.estado === "actual"
                ? PlayCircle
                : paso.estado === "bloqueado"
                  ? Lock
                  : CircleDashed;
          return (
            <li key={paso.id} className="flex items-center gap-3">
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold",
                  paso.estado === "completo" &&
                    "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  paso.estado === "actual" && "border-primary bg-primary text-primary-foreground",
                  paso.estado === "pendiente" && "border-border bg-muted text-muted-foreground",
                  paso.estado === "bloqueado" && "border-border bg-muted text-muted-foreground",
                )}
              >
                <Icono className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {paso.etiqueta}
              </span>
              <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                {TEXTO_ESTADO_PASO[paso.estado]}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-muted-foreground">
        {`Estado de la reserva: ${ETIQUETA_ESTADO_RESERVA[estado] ?? estado}.`}
      </p>

      {camposFaltantes.length > 0 ? (
        <div className="rounded-xl border border-border bg-muted/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Falta completar
          </p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {camposFaltantes.map((campo) => (
              <li
                key={campo}
                className="rounded-lg bg-card px-2.5 py-1 text-xs font-medium text-foreground"
              >
                {campo}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
