import { ArrowDownRight, ArrowUpRight, CircleCheck } from "lucide-react";

import { formatBs, formatUsd, multiplyDecimal, subtractDecimals } from "@/lib/format";
import type { Moneda } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Contraste entre el **monto esperado** y el **monto reportado** (RF-7.7).
 *
 * El monto esperado siempre vive en USD (es el saldo de la reserva). El
 * reportado llega en la moneda del pago, así que se convierte con la **tasa
 * congelada** del propio pago: nunca con la tasa de hoy (Spec §9.11).
 */

export interface ResultadoDiferencia {
  /** Monto esperado expresado en la moneda del pago (`null` si falta la tasa). */
  esperadoEnMoneda: string | null;
  /** Reportado − esperado, en la moneda del pago (`null` si falta la tasa). */
  diferencia: string | null;
  /** Hay diferencia (aunque sea de un céntimo). */
  hayDiferencia: boolean;
  /** La diferencia supera la tolerancia: exige justification al aprobar. */
  esSignificativa: boolean;
  /** Tolerancia aplicada, en la moneda del pago. */
  tolerancia: string;
}

export interface OpcionesDiferencia {
  /** Saldo pendiente de la reserva, en USD. */
  esperadoUsd: string;
  /** Monto que reportó el cliente, en la moneda del pago. */
  reportado: string;
  /** Moneda del pago. */
  moneda: Moneda;
  /** Tasa congelada del pago (VES por USD). `null` si el pago es en USD. */
  tasa: string | null;
  /** Tolerancia en USD. Por defecto 5 céntimos. */
  toleranciaUsd?: string | undefined;
}

/**
 * Calcula la diferencia entre lo esperado y lo reportado.
 *
 * Toda la aritmética se hace con cadenas decimales (`addDecimals`,
 * `subtractDecimals`, `multiplyDecimal`): nunca con `float` para dinero.
 */
export function calcularDiferencia({
  esperadoUsd,
  reportado,
  moneda,
  tasa,
  toleranciaUsd = "0.05",
}: OpcionesDiferencia): ResultadoDiferencia {
  if (moneda === "USD") {
    const diferencia = subtractDecimals(reportado, esperadoUsd);
    const tolerancia = toleranciaUsd;
    return {
      esperadoEnMoneda: esperadoUsd,
      diferencia,
      hayDiferencia: diferencia !== "0.00",
      esSignificativa: Math.abs(Number.parseFloat(diferencia)) > Number.parseFloat(tolerancia),
      tolerancia,
    };
  }

  if (!tasa) {
    return {
      esperadoEnMoneda: null,
      diferencia: null,
      hayDiferencia: false,
      esSignificativa: false,
      tolerancia: "0.00",
    };
  }

  const factor = Number.parseFloat(tasa);
  if (!Number.isFinite(factor)) {
    return {
      esperadoEnMoneda: null,
      diferencia: null,
      hayDiferencia: false,
      esSignificativa: false,
      tolerancia: "0.00",
    };
  }

  const esperadoEnMoneda = multiplyDecimal(esperadoUsd, factor);
  const diferencia = subtractDecimals(reportado, esperadoEnMoneda);
  const tolerancia = multiplyDecimal(toleranciaUsd, factor);

  return {
    esperadoEnMoneda,
    diferencia,
    hayDiferencia: diferencia !== "0.00",
    esSignificativa: Math.abs(Number.parseFloat(diferencia)) > Number.parseFloat(tolerancia),
    tolerancia,
  };
}

/** Formatea un monto en la moneda indicada. */
export function formatearMonto(monto: string, moneda: Moneda): string {
  return moneda === "USD" ? formatUsd(monto) : formatBs(monto);
}

export interface DiferenciaMontoProps extends OpcionesDiferencia {
  className?: string | undefined;
}

/**
 * Bloque visual con el desglose esperado / reportado / diferencia.
 *
 * Cuando la diferencia no se puede calcular (pago en bolívares sin tasa)
 * se dice explícitamente, en lugar de mostrar un cero engañoso.
 */
export function DiferenciaMonto({
  esperadoUsd,
  reportado,
  moneda,
  tasa,
  toleranciaUsd,
  className,
}: DiferenciaMontoProps) {
  const resultado = calcularDiferencia({
    esperadoUsd,
    reportado,
    moneda,
    tasa,
    ...(toleranciaUsd !== undefined ? { toleranciaUsd } : {}),
  });

  const esperado = resultado.esperadoEnMoneda;

  const IconoDiferencia = !resultado.hayDiferencia
    ? CircleCheck
    : (resultado.diferencia ?? "0.00").startsWith("-")
      ? ArrowDownRight
      : ArrowUpRight;

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Monto esperado
          </dt>
          <dd className="text-lg font-bold tabular-nums text-foreground">
            {esperado !== null ? formatearMonto(esperado, moneda) : "—"}
          </dd>
          {moneda !== "USD" ? (
            <dd className="text-xs text-muted-foreground">
              {`${formatUsd(esperadoUsd)} a tasa congelada${tasa ? ` de ${tasa}` : ""}`}
            </dd>
          ) : null}
        </div>

        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Monto reportado
          </dt>
          <dd className="text-lg font-bold tabular-nums text-foreground">
            {formatearMonto(reportado, moneda)}
          </dd>
          <dd className="text-xs text-muted-foreground">{moneda}</dd>
        </div>

        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Diferencia
          </dt>
          <dd
            className={cn(
              "flex items-center gap-1.5 text-lg font-bold tabular-nums",
              !resultado.hayDiferencia
                ? "text-emerald-700 dark:text-emerald-300"
                : resultado.esSignificativa
                  ? "text-amber-800 dark:text-amber-200"
                  : "text-foreground",
            )}
          >
            <IconoDiferencia className="h-4 w-4" aria-hidden="true" />
            {resultado.diferencia !== null ? formatearMonto(resultado.diferencia, moneda) : "—"}
          </dd>
          <dd className="text-xs text-muted-foreground">
            {esperado === null
              ? "No hay tasa congelada para comparar el monto."
              : resultado.hayDiferencia
                ? `Tolerancia: ${formatearMonto(resultado.tolerancia, moneda)}.`
                : "El monto coincide con lo esperado."}
          </dd>
        </div>
      </dl>
    </div>
  );
}
