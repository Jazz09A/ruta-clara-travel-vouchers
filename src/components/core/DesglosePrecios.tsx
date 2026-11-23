import * as React from "react";

import type { LineaPrecio } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { formatBs, formatUsd, toDecimalString } from "@/lib/format";

export interface DesglosePreciosProps {
  /** Lineas del servidor (FD-06: el cliente no calcula precios). */
  lineas: LineaPrecio[];
  subtotal_usd: string;
  adicionales_usd: string;
  descuento_usd: string;
  total_usd: string;
  /** Total estimado en bolivares, si el servidor lo calculo. */
  total_bs_estimado?: string | null | undefined;
  /** Tasa vigente usada para el estimado. */
  tasa_vigente?: string | null | undefined;
  className?: string | undefined;
}

/**
 * C-24 · Desglose de precios.
 *
 * Muestra **USD primero** y despues el equivalente en bolivares (Spec 3.10).
 * Todos los montos llegan como string decimal: nunca se recalculan en el
 * cliente (FD-06, FD-09).
 */
export function DesglosePrecios({
  lineas,
  subtotal_usd,
  adicionales_usd,
  descuento_usd,
  total_usd,
  total_bs_estimado,
  tasa_vigente,
  className,
}: DesglosePreciosProps) {
  const hayDescuento = Number.parseFloat(toDecimalString(descuento_usd)) > 0;
  const hayAdicionales = Number.parseFloat(toDecimalString(adicionales_usd)) > 0;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {lineas.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border">
          {lineas.map((linea, indice) => (
            <li
              key={`${linea.concepto}-${indice}`}
              className="flex items-start justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{linea.concepto}</p>
                {linea.detalle ? (
                  <p className="text-xs text-muted-foreground">{linea.detalle}</p>
                ) : null}
                {typeof linea.cantidad === "number" && linea.cantidad > 1 ? (
                  <p className="text-xs text-muted-foreground">
                    {linea.cantidad} x {formatUsd(linea.precio_usd)}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                {formatUsd(linea.total_usd)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="flex flex-col gap-2 border-t border-border pt-3">
        <Fila etiqueta="Subtotal" valor={formatUsd(subtotal_usd)} />

        {hayAdicionales ? <Fila etiqueta="Adicionales" valor={formatUsd(adicionales_usd)} /> : null}

        {hayDescuento ? (
          <Fila
            etiqueta="Descuento"
            valor={`- ${formatUsd(descuento_usd)}`}
            valorClassName="text-emerald-700 dark:text-emerald-300"
          />
        ) : null}

        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-3">
          <dt className="text-base font-semibold text-foreground">Total</dt>
          <dd className="text-right">
            <span className="block text-lg font-bold tabular-nums text-foreground">
              {formatUsd(total_usd)}
            </span>
            {total_bs_estimado ? (
              <span className="mt-0.5 block text-sm tabular-nums text-muted-foreground">
                {formatBs(total_bs_estimado)}
                <span className="ml-1">estimado</span>
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      {tasa_vigente ? (
        <p className="text-xs leading-snug text-muted-foreground">
          Tasa de hoy: {formatBs(tasa_vigente)} por USD. El monto exacto en bolivares se fija al
          reportar tu pago.
        </p>
      ) : null}
    </div>
  );
}

function Fila({
  etiqueta,
  valor,
  valorClassName,
}: {
  etiqueta: string;
  valor: string;
  valorClassName?: string | undefined;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
      <dd className={cn("text-sm font-medium tabular-nums text-foreground", valorClassName)}>
        {valor}
      </dd>
    </div>
  );
}
