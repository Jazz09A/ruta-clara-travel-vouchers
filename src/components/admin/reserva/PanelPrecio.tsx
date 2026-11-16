import * as React from "react";
import { Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/format";
import type { AjustePrecioAdmin, LineaPrecioAdmin, Reserva } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { EditorPrecio, type DatosPrecio } from "./EditorPrecio";

export type { DatosPrecio };

/**
 * Panel de **precio administrado** de la reserva.
 *
 * El cliente nunca ve el desglose: solo el total. Aquí el equipo fija los
 * cargos extra (toldos y demás) y los ajustes manuales (descuentos/recargos)
 * con motivo obligatorio; el servidor recalcula el total con las tarifas
 * reales. Las promos (`origen: "promo"`) se muestran pero no se editan desde
 * este panel.
 *
 * El formulario en sí vive en `EditorPrecio`, compartido con el alta de
 * reserva.
 */

export interface PanelPrecioProps {
  reserva: Reserva;
  /** El usuario puede modificar el precio (permiso `reservas.editar`). */
  puedeEditar: boolean;
  /** La reserva está abierta (no cancelada/expirada/completada). */
  abierta: boolean;
  /** Guardado en curso. */
  guardando: boolean;
  /** Persiste el precio; lanza error con mensaje en español si falla. */
  onGuardar: (datos: DatosPrecio) => Promise<void>;
  /** Explica por qué el precio no se puede editar (si aplica). */
  motivoBloqueo?: string | undefined;
  /** La reserva tiene pagos registrados: cambiar el total exige justificación. */
  justificacionRequerida?: boolean | undefined;
  /** Explica por qué se pide la justificación. */
  avisoJustificacion?: string | undefined;
  className?: string | undefined;
}

export function PanelPrecio({
  reserva,
  puedeEditar,
  abierta,
  guardando,
  onGuardar,
  motivoBloqueo,
  justificacionRequerida = false,
  avisoJustificacion,
  className,
}: PanelPrecioProps) {
  const editable = puedeEditar && abierta;
  const [editando, setEditando] = React.useState(false);

  const lineasPrecio = reserva.precio_lineas ?? [];
  const ajustesPrecio = reserva.precio_ajustes ?? [];
  const ajustesManuales = ajustesPrecio.filter((a) => a.origen !== "promo");
  const ajustesPromo = ajustesPrecio.filter((a) => a.origen === "promo");

  const descuentos = Number.parseFloat(reserva.descuentos_usd ?? "0");
  const total = Number.parseFloat(reserva.total_usd);
  const saldo = Number.parseFloat(reserva.saldo_usd);
  const netoPagado = Math.max(0, total - saldo);

  return (
    <section
      aria-label="Precio de la reserva"
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-bold text-foreground">Precio</h2>
        </div>
        {editable && !editando ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => setEditando(true)}
          >
            Editar precio
          </Button>
        ) : null}
      </header>

      {!editando ? (
        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Subtotal (tarifas)</dt>
            <dd className="font-semibold tabular-nums text-foreground">
              {formatUsd(reserva.subtotal_usd ?? "0.00")}
            </dd>
          </div>

          {lineasPrecio.map((linea: LineaPrecioAdmin) => (
            <div
              key={linea.id ?? linea.concepto}
              className="flex items-center justify-between gap-3"
            >
              <dt className="text-muted-foreground">
                {linea.concepto}
                <span className="text-xs">{` · ${linea.cantidad} × ${formatUsd(linea.precio_unit_usd)}`}</span>
              </dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {formatUsd(linea.subtotal_usd ?? "0.00")}
              </dd>
            </div>
          ))}

          {ajustesManuales.map((ajuste: AjustePrecioAdmin) => (
            <div
              key={ajuste.id ?? ajuste.motivo}
              className="flex items-center justify-between gap-3"
            >
              <dt className="text-muted-foreground">
                {ajuste.motivo || (ajuste.tipo === "descuento" ? "Descuento" : "Recargo")}
                <Badge variant="outline" className="ml-1.5 text-[10px]">
                  {ajuste.tipo === "descuento" ? "descuento" : "recargo"}
                </Badge>
              </dt>
              <dd
                className={cn(
                  "font-semibold tabular-nums",
                  ajuste.tipo === "descuento"
                    ? "text-green-700 dark:text-green-300"
                    : "text-foreground",
                )}
              >
                {ajuste.tipo === "descuento" ? "-" : "+"}
                {formatUsd(ajuste.monto_usd)}
              </dd>
            </div>
          ))}

          {ajustesPromo.map((ajuste: AjustePrecioAdmin) => (
            <div
              key={ajuste.id ?? ajuste.motivo}
              className="flex items-center justify-between gap-3"
            >
              <dt className="text-muted-foreground">
                {ajuste.motivo || "Promoción"}
                <Badge variant="secondary" className="ml-1.5 text-[10px]">
                  promo
                </Badge>
              </dt>
              <dd className="font-semibold tabular-nums text-green-700 dark:text-green-300">
                -{formatUsd(ajuste.monto_usd)}
              </dd>
            </div>
          ))}

          <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-2">
            <dt className="font-bold text-foreground">Total</dt>
            <dd className="text-base font-extrabold tabular-nums text-foreground">
              {formatUsd(reserva.total_usd)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Pagado (neto)</dt>
            <dd className="font-semibold tabular-nums text-foreground">
              {formatUsd(netoPagado.toFixed(2))}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Saldo</dt>
            <dd
              className={cn(
                "font-semibold tabular-nums",
                saldo > 0 ? "text-amber-700 dark:text-amber-300" : "text-foreground",
              )}
            >
              {formatUsd(saldo.toFixed(2))}
            </dd>
          </div>
        </dl>
      ) : (
        <EditorPrecio
          lineasIniciales={lineasPrecio}
          ajustesIniciales={ajustesManuales}
          guardando={guardando}
          justificacionRequerida={justificacionRequerida}
          avisoJustificacion={avisoJustificacion}
          onGuardar={async (datos) => {
            await onGuardar(datos);
            setEditando(false);
          }}
          onCancelar={() => setEditando(false)}
        />
      )}

      {netoPagado > 0 && !editando ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          La reserva ya tiene pagos aprobados. Si el total cambia, revisa el saldo antes de
          continuar.
        </p>
      ) : null}

      {/* Referencias para depuración del desglose (solo admin). */}
      <p className="text-[11px] text-muted-foreground">
        {`Subtotal ${formatUsd(reserva.subtotal_usd ?? "0.00")} · Adicionales ${formatUsd(reserva.adicionales_usd ?? "0.00")} · Descuentos ${formatUsd(descuentos > 0 ? `-${descuentos.toFixed(2)}` : "0.00")}`}
      </p>
    </section>
  );
}
