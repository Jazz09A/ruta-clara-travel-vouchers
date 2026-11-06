import { Link } from "@tanstack/react-router";
import { Clock3, TriangleAlert, User } from "lucide-react";

import { BadgePago } from "./BadgePago";
import { calcularDiferencia, formatearMonto } from "./DiferenciaMonto";
import { ETIQUETA_METODO_PAGO, formatRelative, maskDocumento } from "@/lib/format";
import type { Pago, Reserva } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Tarjeta de un pago en la **cola del validador** (A-08).
 *
 * En móvil la tabla se convierte en lista de tarjetas (UX-21): aquí se
 * concentran los 5 datos que el validador necesita para priorizar —reserva,
 * método, monto esperado, monto reportado y antigüedad— más las alertas.
 */

export interface FilaPagoColaProps {
  /** Pago con su reserva. */
  pago: Pago & { reserva: Reserva };
  /** Minutos transcurridos desde que se reportó. */
  antiguedadMin: number;
  /** `true` cuando es el pago más antiguo y supera el umbral de atención. */
  destacado: boolean;
}

export function FilaPagoCola({
  pago,
  antiguedadMin,
  destacado,
}: FilaPagoColaProps) {
  const titular = pago.reserva.pasajeros.find((pasajero) => pasajero.es_titular);
  const diferencia = calcularDiferencia({
    esperadoUsd: pago.reserva.saldo_usd,
    reportado: pago.monto,
    moneda: pago.moneda,
    tasa: pago.tasa,
  });

  const documentoEnmascarado = titular
    ? maskDocumento(titular.tipo_doc, titular.documento)
    : "Sin titular";

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-card",
        destacado ? "border-amber-400 ring-1 ring-amber-300" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{pago.reserva.codigo}</p>
          <p className="text-xs text-muted-foreground">{`Ref. ${pago.reserva.ref_corta}`}</p>
        </div>
        <BadgePago estado={pago.estado} />
      </div>

      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{titular?.nombre || "Sin titular"}</span>
        </p>
        <p className="text-xs text-muted-foreground">{documentoEnmascarado}</p>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Esperado</dt>
          <dd className="font-semibold tabular-nums text-foreground">
            {formatearMonto(pago.reserva.saldo_usd, "USD")}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Reportado</dt>
          <dd className="font-semibold tabular-nums text-foreground">
            {formatearMonto(pago.monto, pago.moneda)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Diferencia</dt>
          <dd
            className={cn(
              "font-semibold tabular-nums",
              !diferencia.hayDiferencia
                ? "text-emerald-700 dark:text-emerald-300"
                : diferencia.esSignificativa
                  ? "text-amber-800 dark:text-amber-200"
                  : "text-foreground",
            )}
          >
            {diferencia.diferencia !== null ? formatearMonto(diferencia.diferencia, pago.moneda) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Antigüedad</dt>
          <dd className="flex items-center gap-1 font-semibold text-foreground">
            <Clock3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>{formatRelative(pago.creado_en)}</span>
          </dd>
        </div>
      </dl>

      <p className="text-xs text-muted-foreground">
        {`${ETIQUETA_METODO_PAGO[pago.metodo] ?? pago.metodo} · referencia ${pago.referencia}`}
      </p>

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

      {destacado ? (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
          <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{`Es el más antiguo de la cola (${antiguedadMin} min sin resolver).`}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/admin/pagos/$id"
          params={{ id: pago.id }}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Revisar pago
        </Link>
      </div>
    </li>
  );
}
