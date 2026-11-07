import * as React from "react";
import { Plus, Trash2, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatUsd } from "@/lib/format";
import type { AjustePrecioAdmin, LineaPrecioAdmin, Reserva } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Panel de **precio administrado** de la reserva.
 *
 * El cliente nunca ve el desglose: solo el total. Aquí el equipo fija los
 * cargos extra (toldos y demás) y los ajustes manuales (descuentos/recargos)
 * con motivo obligatorio; el servidor recalcula el total con las tarifas
 * reales. Las promos (`origen: "promo"`) se muestran pero no se editan desde
 * este panel.
 */

export interface DatosPrecio {
  motivo: string;
  lineas: { id?: string; concepto: string; cantidad: number; precio_unit_usd: string }[];
  ajustes: { id?: string; tipo: "descuento" | "recargo"; monto_usd: string; motivo: string }[];
}

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
  className?: string | undefined;
}

interface LineaEdit {
  id?: string | undefined;
  concepto: string;
  cantidad: string;
  precio_unit_usd: string;
}

interface AjusteEdit {
  id?: string | undefined;
  tipo: "descuento" | "recargo";
  monto_usd: string;
  motivo: string;
}

export function PanelPrecio({
  reserva,
  puedeEditar,
  abierta,
  guardando,
  onGuardar,
  className,
}: PanelPrecioProps) {
  const editable = puedeEditar && abierta;
  const [editando, setEditando] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [lineas, setLineas] = React.useState<LineaEdit[]>([]);
  const [ajustes, setAjustes] = React.useState<AjusteEdit[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const lineasPrecio = reserva.precio_lineas ?? [];
  const ajustesPrecio = reserva.precio_ajustes ?? [];
  const ajustesManuales = ajustesPrecio.filter((a) => a.origen !== "promo");
  const ajustesPromo = ajustesPrecio.filter((a) => a.origen === "promo");

  // Reinicia el borrador cuando cambia la reserva (guardar o refrescar).
  React.useEffect(() => {
    setEditando(false);
    setMotivo("");
    setError(null);
    setLineas(
      lineasPrecio.map((l: LineaPrecioAdmin) => ({
        ...(l.id ? { id: l.id } : {}),
        concepto: l.concepto,
        cantidad: String(l.cantidad),
        precio_unit_usd: l.precio_unit_usd,
      })),
    );
    setAjustes(
      ajustesManuales.map((a: AjustePrecioAdmin) => ({
        ...(a.id ? { id: a.id } : {}),
        tipo: a.tipo,
        monto_usd: a.monto_usd,
        motivo: a.motivo,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reserva.version, reserva.id]);

  const empezarEdicion = () => {
    setMotivo("");
    setError(null);
    setEditando(true);
  };

  const guardar = async () => {
    setError(null);
    const lineasValidas = lineas
      .map((l) => ({
        ...(l.id ? { id: l.id } : {}),
        concepto: l.concepto.trim(),
        cantidad: Math.floor(Number(l.cantidad)),
        precio_unit_usd: l.precio_unit_usd.trim(),
      }))
      .filter((l) => l.concepto !== "" || l.cantidad > 0 || l.precio_unit_usd !== "");
    const ajustesValidos = ajustes
      .map((a) => ({
        ...(a.id ? { id: a.id } : {}),
        tipo: a.tipo,
        monto_usd: a.monto_usd.trim(),
        motivo: a.motivo.trim(),
      }))
      .filter((a) => a.monto_usd !== "" || a.motivo !== "");

    if (!motivo.trim()) {
      setError("Escribe el motivo del cambio de precio.");
      return;
    }
    try {
      await onGuardar({ motivo: motivo.trim(), lineas: lineasValidas, ajustes: ajustesValidos });
      setEditando(false);
    } catch {
      // El error ya se muestra en la página; el panel conserva el borrador.
    }
  };

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
            onClick={empezarEdicion}
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

          {lineasPrecio.map((linea) => (
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

          {ajustesManuales.map((ajuste) => (
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

          {ajustesPromo.map((ajuste) => (
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
        <div className="flex flex-col gap-4">
          {/* Líneas extra */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cargos extra (toldos, servicios)
            </p>
            {lineas.map((linea, indice) => (
              <div
                key={linea.id ?? `nueva-${indice}`}
                className="grid grid-cols-[1fr_72px_96px_40px] items-end gap-2"
              >
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`linea-concepto-${indice}`} className="text-xs">
                    Concepto
                  </Label>
                  <Input
                    id={`linea-concepto-${indice}`}
                    value={linea.concepto}
                    onChange={(e) =>
                      setLineas((prev) =>
                        prev.map((l, i) => (i === indice ? { ...l, concepto: e.target.value } : l)),
                      )
                    }
                    placeholder="Alquiler de toldo"
                    className="min-h-11"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`linea-cantidad-${indice}`} className="text-xs">
                    Cant.
                  </Label>
                  <Input
                    id={`linea-cantidad-${indice}`}
                    type="number"
                    min={1}
                    step={1}
                    value={linea.cantidad}
                    onChange={(e) =>
                      setLineas((prev) =>
                        prev.map((l, i) => (i === indice ? { ...l, cantidad: e.target.value } : l)),
                      )
                    }
                    className="min-h-11"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`linea-precio-${indice}`} className="text-xs">
                    Precio $
                  </Label>
                  <Input
                    id={`linea-precio-${indice}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={linea.precio_unit_usd}
                    onChange={(e) =>
                      setLineas((prev) =>
                        prev.map((l, i) =>
                          i === indice ? { ...l, precio_unit_usd: e.target.value } : l,
                        ),
                      )
                    }
                    className="min-h-11"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11"
                  aria-label="Quitar línea"
                  onClick={() => setLineas((prev) => prev.filter((_, i) => i !== indice))}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 self-start"
              onClick={() =>
                setLineas((prev) => [...prev, { concepto: "", cantidad: "1", precio_unit_usd: "" }])
              }
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Agregar cargo</span>
            </Button>
          </div>

          {/* Ajustes manuales */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ajustes (descuentos y recargos)
            </p>
            {ajustes.map((ajuste, indice) => (
              <div
                key={ajuste.id ?? `nuevo-${indice}`}
                className="grid grid-cols-[110px_1fr_96px_40px] items-end gap-2"
              >
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`ajuste-tipo-${indice}`} className="text-xs">
                    Tipo
                  </Label>
                  <Select
                    value={ajuste.tipo}
                    onValueChange={(valor) =>
                      setAjustes((prev) =>
                        prev.map((a, i) =>
                          i === indice ? { ...a, tipo: valor as "descuento" | "recargo" } : a,
                        ),
                      )
                    }
                  >
                    <SelectTrigger id={`ajuste-tipo-${indice}`} className="min-h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="descuento">Descuento</SelectItem>
                      <SelectItem value="recargo">Recargo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`ajuste-motivo-${indice}`} className="text-xs">
                    Motivo
                  </Label>
                  <Input
                    id={`ajuste-motivo-${indice}`}
                    value={ajuste.motivo}
                    onChange={(e) =>
                      setAjustes((prev) =>
                        prev.map((a, i) => (i === indice ? { ...a, motivo: e.target.value } : a)),
                      )
                    }
                    placeholder="Convenio con el cliente"
                    className="min-h-11"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`ajuste-monto-${indice}`} className="text-xs">
                    Monto $
                  </Label>
                  <Input
                    id={`ajuste-monto-${indice}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={ajuste.monto_usd}
                    onChange={(e) =>
                      setAjustes((prev) =>
                        prev.map((a, i) =>
                          i === indice ? { ...a, monto_usd: e.target.value } : a,
                        ),
                      )
                    }
                    className="min-h-11"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11"
                  aria-label="Quitar ajuste"
                  onClick={() => setAjustes((prev) => prev.filter((_, i) => i !== indice))}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 self-start"
              onClick={() =>
                setAjustes((prev) => [...prev, { tipo: "descuento", monto_usd: "", motivo: "" }])
              }
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Agregar ajuste</span>
            </Button>
          </div>

          {/* Motivo global obligatorio */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="precio-motivo" className="text-sm font-semibold text-foreground">
              Motivo del cambio
            </Label>
            <Input
              id="precio-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej.: se agregó toldo para 4 personas"
              className="min-h-11"
            />
            <p className="text-xs text-muted-foreground">
              Queda en la auditoría de la reserva. El cliente solo verá el nuevo total.
            </p>
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="min-h-11"
              disabled={guardando}
              aria-busy={guardando || undefined}
              onClick={() => void guardar()}
            >
              {guardando ? "Guardando…" : "Guardar precio"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11"
              disabled={guardando}
              onClick={() => setEditando(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
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
