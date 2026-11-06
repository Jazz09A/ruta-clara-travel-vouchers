import { useState } from "react";
import { Check, ChevronDown, Lock } from "lucide-react";

import type { EstadoPaso } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export interface PasoBarra {
  id: string;
  label: string;
  estado: EstadoPaso;
}

export interface ProgressStepsProps {
  pasos: PasoBarra[];
  /** Id del paso visible; se usa para marcar "actual". */
  pasoActual?: string | undefined;
  /** Navegación a un paso ya completado (UX-43). */
  onNavegar?: ((id: string) => void) | undefined;
  className?: string | undefined;
}

const ICONO_ESTADO: Record<EstadoPaso, "check" | "actual" | "punto" | "lock"> = {
  completo: "check",
  actual: "actual",
  pendiente: "punto",
  bloqueado: "lock",
};

/**
 * Barra de progreso por pasos (C-07 / Spec §4.4).
 *
 * En móvil es compacta: «Paso 2 de 6 · Acompañantes». Al tocarla se despliega
 * el detalle de las seis etapas. Sólo se puede navegar hacia pasos completados
 * o el actual; los bloqueados explican por qué (UX-43).
 */
export function ProgressSteps({
  pasos,
  pasoActual,
  onNavegar,
  className,
}: ProgressStepsProps) {
  const [detalleAbierto, setDetalleAbierto] = useState(false);

  const total = pasos.length;
  const indice = Math.max(
    0,
    pasos.findIndex((paso) => paso.id === pasoActual),
  );
  const actual = pasos[indice];
  const completados = pasos.filter((paso) => paso.estado === "completo").length;

  return (
    <nav aria-label="Progreso de la reserva" className={cn("border-b border-border bg-card", className)}>
      <button
        type="button"
        onClick={() => setDetalleAbierto((abierto) => !abierto)}
        aria-expanded={detalleAbierto}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0">
          <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {`Paso ${indice + 1} de ${total}`}
          </span>
          <span className="block truncate text-sm font-bold text-foreground">
            {actual?.label ?? "Tu reserva"}
          </span>
        </span>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", detalleAbierto && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      <ol className="flex items-center gap-1 px-4 pb-2.5" aria-hidden="true">
        {pasos.map((paso, i) => {
          const tipo = ICONO_ESTADO[paso.estado];
          return (
            <li key={paso.id} className="flex flex-1 items-center gap-1">
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold",
                  paso.estado === "completo" && "border-success bg-success text-white",
                  paso.estado === "actual" && "border-primary bg-primary text-primary-foreground",
                  paso.estado === "pendiente" && "border-border bg-muted text-muted-foreground",
                  paso.estado === "bloqueado" && "border-border bg-muted text-muted-foreground",
                )}
              >
                {tipo === "check" ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : tipo === "lock" ? (
                  <Lock className="h-3 w-3" aria-hidden="true" />
                ) : (
                  i + 1
                )}
              </span>
              {i < pasos.length - 1 ? (
                <span
                  className={cn(
                    "h-0.5 flex-1 rounded-full",
                    paso.estado === "completo" ? "bg-success" : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {detalleAbierto ? (
        <ul className="border-t border-border px-4 py-2">
          {pasos.map((paso, i) => {
            const navegable =
              Boolean(onNavegar) && (paso.estado === "completo" || paso.id === pasoActual);
            const contenido = (
              <>
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-muted text-[11px] font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{paso.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {paso.estado === "completo"
                      ? "Completado"
                      : paso.estado === "actual"
                        ? "Estás aquí"
                        : paso.estado === "bloqueado"
                          ? "Completa el paso anterior"
                          : "Pendiente"}
                  </span>
                </span>
              </>
            );

            return (
              <li key={paso.id} className="py-0.5">
                {navegable ? (
                  <button
                    type="button"
                    onClick={() => onNavegar?.(paso.id)}
                    className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {contenido}
                  </button>
                ) : (
                  <div className="flex min-h-11 items-center gap-3 px-2">{contenido}</div>
                )}
              </li>
            );
          })}
          <li className="px-2 pb-1 pt-2 text-xs text-muted-foreground">
            {`${completados} de ${total} pasos completados.`}
          </li>
        </ul>
      ) : null}
    </nav>
  );
}
