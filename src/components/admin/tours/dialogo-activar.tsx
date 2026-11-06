import { CircleCheckBig, TriangleAlert } from "lucide-react";

import { PanelRequisitos, calcularRequisitos } from "@/components/admin/tours/panel-requisitos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Tour } from "@/lib/domain/types";

export interface DialogoActivarProps {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  /** Tour que se quiere activar (null si no hay ninguno). */
  tour: Tour | null;
  /** Bloqueos devueltos por el servidor (explican por qué no se pudo activar). */
  bloqueos: string[];
  /** `true` mientras se ejecuta la activación. */
  activando: boolean;
  onConfirmar: () => void;
}

/**
 * Diálogo de activación de un tour (Spec 9.9).
 *
 * Muestra la **lista de requisitos** pendientes (política de cancelación,
 * términos publicados). Si el servidor devuelve bloqueos, se explican aquí
 * y la activación no se da por hecha.
 */
export function DialogoActivar({
  abierto,
  onAbiertoChange,
  tour,
  bloqueos,
  activando,
  onConfirmar,
}: DialogoActivarProps) {
  const requisitos = tour ? calcularRequisitos(tour) : [];
  const pendientes = requisitos.filter((requisito) => !requisito.ok);
  const listo = requisitos.length > 0 && pendientes.length === 0;

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Activar {tour?.nombre ?? "tour"}</DialogTitle>
          <DialogDescription>
            Un tour activo aparece en el catálogo público y puede recibir reservas. Revisa los
            requisitos antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <PanelRequisitos requisitos={requisitos} />

        {bloqueos.length > 0 ? (
          <ul className="space-y-2" aria-live="assertive">
            {bloqueos.map((bloqueo) => (
              <li
                key={bloqueo}
                className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{bloqueo}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {listo && bloqueos.length === 0 ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <CircleCheckBig className="h-4 w-4" aria-hidden="true" />
            Cumple todos los requisitos.
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onAbiertoChange(false)}
            disabled={activando}
            className="min-h-11"
          >
            Cerrar
          </Button>
          <Button
            type="button"
            onClick={onConfirmar}
            disabled={!listo || bloqueos.length > 0 || activando}
            aria-busy={activando || undefined}
            className="min-h-11"
          >
            {activando ? "Activando…" : "Activar tour"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
