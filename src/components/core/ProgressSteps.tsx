import * as React from "react";
import { Check, ChevronDown, CircleDashed, Lock } from "lucide-react";

import type { EstadoPaso } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export interface PasoBarra {
  id: string;
  label: string;
  estado: EstadoPaso;
}

export interface ProgressStepsProps {
  /** Pasos del flujo con su estado (`completo`, `actual`, `pendiente`, `bloqueado`). */
  pasos: PasoBarra[];
  /** Se llama al elegir un paso **completo** (unico paso navegable). */
  onSelect?: ((id: string) => void) | undefined;
  className?: string | undefined;
}

/**
 * C-07 · Barra de progreso por pasos.
 *
 * - En movil se compacta: «Paso 2 de 6 · Acompanantes» con el detalle
 *   desplegable al tocar (Spec 4.4).
 * - Solo los pasos `completo` son navegables (UX-43); los `bloqueado`
 *   explican que hay que terminar el paso anterior.
 */
export function ProgressSteps({ pasos, onSelect, className }: ProgressStepsProps) {
  const [detalleAbierto, setDetalleAbierto] = React.useState(false);

  const indiceActual = pasos.findIndex((paso) => paso.estado === "actual");
  const posicionActual = indiceActual >= 0 ? indiceActual : 0;
  const pasoActual = pasos[posicionActual];
  const completados = pasos.filter((paso) => paso.estado === "completo").length;
  const porcentaje = pasos.length > 0 ? Math.round((completados / pasos.length) * 100) : 0;

  return (
    <div className={cn("w-full", className)}>
      {/* Version compacta (movil). */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setDetalleAbierto((abierto) => !abierto)}
          aria-expanded={detalleAbierto}
          className="flex w-full items-center justify-between gap-2 rounded-2xl px-1 py-2 text-left"
        >
          <span className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Paso {posicionActual + 1} de {pasos.length}
            </span>
            <span className="ml-1.5 truncate text-sm font-semibold text-foreground">
              {pasoActual?.label ?? ""}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              detalleAbierto && "rotate-180",
            )}
          />
        </button>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={porcentaje}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avance del registro"
        >
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-300"
            style={{ width: `${porcentaje}%` }}
          />
        </div>

        {detalleAbierto ? (
          <ol className="mt-3 flex flex-col gap-1">
            {pasos.map((paso, indice) => (
              <li key={paso.id}>
                <FilaPaso
                  paso={paso}
                  indice={indice}
                  total={pasos.length}
                  onSelect={onSelect}
                  compacto
                />
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      {/* Version completa (escritorio). */}
      <ol className="hidden md:flex md:items-start md:gap-2">
        {pasos.map((paso, indice) => (
          <li key={paso.id} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <FilaPaso
              paso={paso}
              indice={indice}
              total={pasos.length}
              onSelect={onSelect}
              escritorio
            />
            {indice < pasos.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "-mt-4 hidden h-0.5 w-full rounded-full lg:block",
                  paso.estado === "completo" ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function FilaPaso({
  paso,
  indice,
  total,
  onSelect,
  compacto = false,
  escritorio = false,
}: {
  paso: PasoBarra;
  indice: number;
  total: number;
  onSelect?: ((id: string) => void) | undefined;
  compacto?: boolean;
  escritorio?: boolean;
}) {
  const nombre = `Paso ${indice + 1} de ${total}: ${paso.label}`;
  const navegable = paso.estado === "completo" && Boolean(onSelect);

  const icono = (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
        paso.estado === "completo" && "border-primary bg-primary text-primary-foreground",
        paso.estado === "actual" && "border-primary bg-brand text-primary-foreground",
        paso.estado === "pendiente" && "border-border bg-background text-muted-foreground",
        paso.estado === "bloqueado" && "border-border bg-muted text-muted-foreground",
      )}
    >
      {paso.estado === "completo" ? (
        <Check className="h-4 w-4" />
      ) : paso.estado === "bloqueado" ? (
        <Lock className="h-3.5 w-3.5" />
      ) : paso.estado === "pendiente" ? (
        <CircleDashed className="h-4 w-4" />
      ) : (
        indice + 1
      )}
    </span>
  );

  const texto = (
    <span
      className={cn(
        "truncate text-xs",
        paso.estado === "actual" && "font-semibold text-foreground",
        paso.estado === "pendiente" && "text-muted-foreground",
        paso.estado === "bloqueado" && "text-muted-foreground",
        paso.estado === "completo" && "text-foreground",
      )}
    >
      {paso.label}
    </span>
  );

  if (navegable) {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(paso.id)}
        aria-label={`Ir a ${nombre}`}
        className={cn(
          "flex min-h-11 w-full items-center gap-2 rounded-2xl px-1 py-1 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          compacto ? "w-full" : "flex-col items-center gap-1.5 text-center",
        )}
      >
        {icono}
        {texto}
      </button>
    );
  }

  return (
    <span
      className={cn(
        "flex min-h-11 items-center gap-2 px-1 py-1",
        escritorio ? "flex-col items-center gap-1.5 text-center" : "w-full",
      )}
      title={paso.estado === "bloqueado" ? "Completa el paso anterior" : undefined}
    >
      {icono}
      {texto}
    </span>
  );
}
