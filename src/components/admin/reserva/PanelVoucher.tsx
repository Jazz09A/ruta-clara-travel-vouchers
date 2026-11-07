import { Download, FileCheck, RefreshCw } from "lucide-react";

import { BadgeEstado } from "@/components/core/BadgeEstado";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import type { Voucher } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Panel de **voucher** de la reserva (A-07).
 *
 * Muestra la versión vigente, su estado (`generando`, `listo`, `error`) y el
 * enlace de descarga. Cuando el voucher falla, ofrece reintentar la
 * generación.
 */

export interface PanelVoucherProps {
  /** Voucher de la reserva, si existe. */
  voucher: Voucher | undefined;
  /** La acción está en curso. */
  regenerando: boolean;
  /** Pide regenerar o reintentar el voucher. */
  onRegenerar: () => void;
  /** El botón de reintento está disponible (hay token del enlace). */
  puedeRegenerar: boolean;
  /** Motivo por el que no se puede regenerar. */
  motivoBloqueo: string | undefined;
  /** Descarga admin (endpoint con URL firmada). Si falta, usa `url_descarga`. */
  onDescargar?: (() => void) | undefined;
  descargando?: boolean | undefined;
  className?: string | undefined;
}

export function PanelVoucher({
  voucher,
  regenerando,
  onRegenerar,
  puedeRegenerar,
  motivoBloqueo,
  onDescargar,
  descargando = false,
  className,
}: PanelVoucherProps) {
  if (!voucher) {
    return (
      <section
        aria-label="Voucher de la reserva"
        className={cn(
          "flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-card",
          className,
        )}
      >
        <h2 className="text-sm font-bold text-foreground">Voucher</h2>
        <p className="text-sm text-muted-foreground">
          El voucher se genera cuando el pago queda aprobado y el saldo llega a cero.
        </p>
      </section>
    );
  }

  const error = voucher.estado === "error";

  return (
    <section
      aria-label="Voucher de la reserva"
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground">Voucher</h2>
        <BadgeEstado estado={voucher.estado} tipo="voucher" tamano="md" />
      </header>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Versión</dt>
          <dd className="text-sm font-medium tabular-nums text-foreground">
            {String(voucher.version)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Generado</dt>
          <dd className="text-sm font-medium text-foreground">
            {formatDateTime(voucher.generado_en)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Vigencia</dt>
          <dd className="text-sm font-medium text-foreground">
            {voucher.vigente ? "Vigente" : "Reemplazado"}
          </dd>
        </div>
      </dl>

      {error ? (
        <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
          El voucher no se pudo generar. Puedes pedir que se genere de nuevo.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {onDescargar ? (
          <Button
            type="button"
            variant="default"
            size="sm"
            className="min-h-11"
            onClick={onDescargar}
            disabled={descargando || voucher.estado !== "listo"}
            aria-busy={descargando || undefined}
          >
            {descargando ? (
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{descargando ? "Preparando…" : "Descargar voucher"}</span>
          </Button>
        ) : voucher.url_descarga ? (
          <a
            href={voucher.url_descarga}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Descargar voucher</span>
          </a>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={onRegenerar}
          disabled={!puedeRegenerar || regenerando}
          aria-busy={regenerando || undefined}
        >
          {regenerando ? (
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileCheck className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{regenerando ? "Generando…" : "Regenerar voucher"}</span>
        </Button>
      </div>

      {motivoBloqueo ? <p className="text-xs text-muted-foreground">{motivoBloqueo}</p> : null}

      <p className="font-mono text-[11px] text-muted-foreground">
        {`token de verificación ${voucher.verif_token}`}
      </p>
    </section>
  );
}
