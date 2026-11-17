import { CircleCheckBig, CircleX } from "lucide-react";

import type { RequisitoTour } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export interface PanelRequisitosProps {
  requisitos: RequisitoTour[];
  className?: string | undefined;
  /** `true` mientras se consultan los requisitos. */
  cargando?: boolean | undefined;
}

/**
 * Lista de requisitos pendientes para activar un tour (Spec 9.9).
 *
 * El estado nunca se comunica solo con color: cada requisito lleva icono +
 * texto.
 */
export function PanelRequisitos({ requisitos, className, cargando }: PanelRequisitosProps) {
  const pendientes = requisitos.filter((requisito) => !requisito.ok).length;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-semibold text-foreground">
        {cargando
          ? "Comprobando los requisitos…"
          : pendientes === 0
            ? "Todo listo para activar este tour"
            : `Faltan ${pendientes} ${pendientes === 1 ? "requisito" : "requisitos"} para activar`}
      </p>

      <ul className="space-y-2">
        {requisitos.map((requisito) => (
          <li
            key={requisito.clave}
            className={cn(
              "flex items-start gap-2 rounded-xl border px-3 py-2 text-sm",
              requisito.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200",
            )}
          >
            {requisito.ok ? (
              <CircleCheckBig className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <CircleX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>
              <span className="font-semibold">{requisito.titulo}:</span> {requisito.detalle}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
