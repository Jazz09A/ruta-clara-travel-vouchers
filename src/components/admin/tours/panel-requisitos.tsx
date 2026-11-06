import { CircleCheckBig, CircleX } from "lucide-react";

import type { Tour } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export interface Requisito {
  ok: boolean;
  titulo: string;
  detalle: string;
}

/**
 * Requisitos que faltan para activar un tour (Spec 9.9).
 *
 * El servidor es la autoridad: esta lista es la vista previa que el operador
 * ve antes de intentar la activación.
 */
export function calcularRequisitos(tour: Tour): Requisito[] {
  const terminosOk = tour.terminos_version_id.trim() !== "";

  return [
    {
      ok: tour.politica_cancelacion_id.trim() !== "",
      titulo: "Política de cancelación",
      detalle:
        tour.politica_cancelacion_id.trim() !== ""
          ? "El tour ya tiene una política asociada."
          : "Falta asociar una política de cancelación al tour.",
    },
    {
      ok: terminosOk,
      titulo: "Términos y condiciones",
      detalle: terminosOk
        ? "Los términos están publicados y se mostrarán al cliente."
        : "Falta publicar los términos y condiciones.",
    },
  ];
}

export interface PanelRequisitosProps {
  requisitos: Requisito[];
  className?: string | undefined;
}

/**
 * Lista de requisitos pendientes para activar un tour.
 *
 * El estado nunca se comunica solo con color: cada requisito lleva icono +
 * texto.
 */
export function PanelRequisitos({ requisitos, className }: PanelRequisitosProps) {
  const pendientes = requisitos.filter((requisito) => !requisito.ok).length;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-semibold text-foreground">
        {pendientes === 0
          ? "Todo listo para activar este tour"
          : `Faltan ${pendientes} ${pendientes === 1 ? "requisito" : "requisitos"} para activar`}
      </p>

      <ul className="space-y-2">
        {requisitos.map((requisito) => (
          <li
            key={requisito.titulo}
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
