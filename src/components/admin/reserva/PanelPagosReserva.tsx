import { Link } from "@tanstack/react-router";
import { FileText, TriangleAlert } from "lucide-react";

import { BadgePago } from "@/components/admin/pagos/BadgePago";
import { Button } from "@/components/ui/button";
import { ETIQUETA_METODO_PAGO, formatUsd, formatRelative } from "@/lib/format";
import type { Pago } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Panel de **pagos** de la reserva (A-07).
 *
 * Cada pago muestra estado, monto, referencia y la alerta de duplicado. Las
 * acciones dependen del rol: registrar efectivo (operación), revisar
 * (validación) y reembolsar (superadministración).
 */

export interface PanelPagosReservaProps {
  /** Pagos de la reserva. */
  pagos: Pago[];
  /** El rol puede registrar un pago en efectivo. */
  puedeRegistrarEfectivo: boolean;
  /** El rol puede validar pagos. */
  puedeValidar: boolean;
  /** El rol puede reembolsar. */
  puedeReembolsar: boolean;
  /** Abre el formulario de pago en efectivo. */
  onRegistrarEfectivo: () => void;
  /** Abre el reembolso de un pago. */
  onReembolsar: (pago: Pago) => void;
  className?: string | undefined;
}

export function PanelPagosReserva({
  pagos,
  puedeRegistrarEfectivo,
  puedeValidar,
  puedeReembolsar,
  onRegistrarEfectivo,
  onReembolsar,
  className,
}: PanelPagosReservaProps) {
  return (
    <section
      aria-label="Pagos de la reserva"
      className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground">
          {`Pagos (${pagos.length})`}
        </h2>
        {puedeRegistrarEfectivo ? (
          <Button type="button" size="sm" className="min-h-11" onClick={onRegistrarEfectivo}>
            Registrar pago en efectivo
          </Button>
        ) : null}
      </header>

      {pagos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Todavía no hay pagos reportados para esta reserva.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pagos.map((pago) => (
            <li
              key={pago.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {formatUsd(pago.monto)}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {pago.moneda}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {`${ETIQUETA_METODO_PAGO[pago.metodo] ?? pago.metodo} · ref. ${pago.referencia} · ${formatRelative(pago.creado_en)}`}
                  </p>
                </div>
                <BadgePago estado={pago.estado} />
              </div>

              {pago.comprobante ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{pago.comprobante.nombre}</span>
                </p>
              ) : null}

              {pago.alertas.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {pago.alertas.map((alerta) => (
                    <li
                      key={`${alerta.codigo}-${alerta.mensaje}`}
                      className="flex items-start gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200"
                    >
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{alerta.mensaje}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {pago.duplicado_de_pago_id ? (
                <p className="text-xs font-medium text-red-800 dark:text-red-300">
                  {`Referencia repetida: coincide con el pago ${pago.duplicado_de_pago_id}.`}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                {puedeValidar && pago.estado === "reportado" ? (
                  <Link
                    to="/admin/pagos/$id"
                    params={{ id: pago.id }}
                    className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Ir a revisar
                  </Link>
                ) : null}

                {puedeReembolsar && pago.estado === "aprobado" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => onReembolsar(pago)}
                  >
                    Reembolsar
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
