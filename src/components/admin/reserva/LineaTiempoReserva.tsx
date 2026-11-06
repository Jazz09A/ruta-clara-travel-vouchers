import { History } from "lucide-react";

import { formatDateTime, formatRelative } from "@/lib/format";
import type { Auditoria } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * C-22 · Línea de tiempo de la reserva (A-07).
 *
 * Cada entrada de auditoría se cuenta como un evento: quién lo hizo, cuándo,
 * qué cambió y por qué. Los valores se muestran tal como los dejó el
 * servidor (ya enmascarados cuando corresponde).
 */

/** Convierte un código de acción en texto legible. */
export function humanizarAccion(accion: string): string {
  return accion
    .split(".")
    .filter((parte) => parte.length > 0)
    .map((parte) => {
      const palabras = parte.replace(/_/g, " ");
      return palabras.charAt(0).toUpperCase() + palabras.slice(1);
    })
    .join(" · ");
}

export interface LineaTiempoReservaProps {
  /** Entradas de auditoría de la reserva. */
  auditoria: Auditoria[];
  className?: string | undefined;
}

export function LineaTiempoReserva({ auditoria, className }: LineaTiempoReservaProps) {
  return (
    <section
      aria-label="Historial de la reserva"
      className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground">Línea de tiempo</h2>
        <p className="text-xs text-muted-foreground">{`${auditoria.length} movimientos registrados`}</p>
      </header>

      {auditoria.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <History className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Aún no hay movimientos registrados en esta reserva.</span>
        </p>
      ) : (
        <ol className="flex flex-col gap-0">
          {auditoria.map((entrada, indice) => (
            <li key={entrada.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                    entrada.cadena === "ok"
                      ? "bg-primary"
                      : "border border-destructive bg-destructive/20",
                  )}
                  aria-hidden="true"
                />
                {indice < auditoria.length - 1 ? (
                  <span className="w-px flex-1 bg-border" aria-hidden="true" />
                ) : null}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-4">
                <p className="text-sm font-semibold text-foreground">
                  {humanizarAccion(entrada.accion)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {`${entrada.usuario_nombre} · ${formatRelative(entrada.fecha)}`}
                  <span className="sr-only">{` (${formatDateTime(entrada.fecha)})`}</span>
                </p>
                {entrada.valor_anterior !== "—" || entrada.valor_nuevo !== "—" ? (
                  <p className="text-xs text-muted-foreground">
                    {`${entrada.valor_anterior} → ${entrada.valor_nuevo}`}
                  </p>
                ) : null}
                {entrada.motivo ? (
                  <p className="text-xs italic text-foreground">`Motivo: ${entrada.motivo}`</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
