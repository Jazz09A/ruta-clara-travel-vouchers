import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

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
import type { AjustePrecioAdmin, LineaPrecioAdmin } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Editor de **precio administrado** (cargos extra + ajustes).
 *
 * Es el formulario compartido por el detalle de la reserva (`PanelPrecio`) y
 * por el alta de enlace (`/admin/reservas/nueva`), de modo que el operador
 * pueda fijar toldos, recargos o descuentos igual en ambos lugares.
 *
 * El cliente nunca ve el desglose: sólo el total. El servidor recalcula con
 * las tarifas reales; aquí sólo se capturan los deltas.
 */

export interface DatosPrecio {
  motivo: string;
  /** Obligatoria (mín. 10 caracteres) si la reserva tiene pagos registrados. */
  justificacion?: string | undefined;
  lineas: { id?: string; concepto: string; cantidad: number; precio_unit_usd: string }[];
  ajustes: { id?: string; tipo: "descuento" | "recargo"; monto_usd: string; motivo: string }[];
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

export interface EditorPrecioProps {
  /** Cargos extra existentes (se cargan como borrador al montar). */
  lineasIniciales?: LineaPrecioAdmin[] | undefined;
  /** Ajustes manuales existentes (los de promo no se editan). */
  ajustesIniciales?: AjustePrecioAdmin[] | undefined;
  /** Persiste los cambios; lanza error con mensaje en español si falla. */
  onGuardar: (datos: DatosPrecio) => Promise<void>;
  /** Sale del modo edición sin guardar. */
  onCancelar?: (() => void) | undefined;
  /** Guardado en curso. */
  guardando?: boolean | undefined;
  /**
   * El motivo lo fija el flujo (p. ej. el alta de la reserva) y no se pregunta.
   */
  motivoFijo?: string | undefined;
  /**
   * La reserva tiene pagos registrados: cambiar el total exige una
   * justificación explícita.
   */
  justificacionRequerida?: boolean | undefined;
  /** Explica por qué se pide la justificación. */
  avisoJustificacion?: string | undefined;
  className?: string | undefined;
}

export function EditorPrecio({
  lineasIniciales,
  ajustesIniciales,
  onGuardar,
  onCancelar,
  guardando = false,
  motivoFijo,
  justificacionRequerida = false,
  avisoJustificacion,
  className,
}: EditorPrecioProps) {
  const [lineas, setLineas] = React.useState<LineaEdit[]>(() =>
    (lineasIniciales ?? []).map((l) => ({
      ...(l.id ? { id: l.id } : {}),
      concepto: l.concepto,
      cantidad: String(l.cantidad),
      precio_unit_usd: l.precio_unit_usd,
    })),
  );
  const [ajustes, setAjustes] = React.useState<AjusteEdit[]>(() =>
    (ajustesIniciales ?? []).map((a) => ({
      ...(a.id ? { id: a.id } : {}),
      tipo: a.tipo,
      monto_usd: a.monto_usd,
      motivo: a.motivo,
    })),
  );
  const [motivo, setMotivo] = React.useState(motivoFijo ?? "");
  const [justificacion, setJustificacion] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

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
    if (justificacionRequerida && justificacion.trim().length < 10) {
      setError("Escribe una justificación (mínimo 10 caracteres) del cambio de total.");
      return;
    }
    try {
      await onGuardar({
        motivo: motivo.trim(),
        ...(justificacionRequerida ? { justificacion: justificacion.trim() } : {}),
        lineas: lineasValidas,
        ajustes: ajustesValidos,
      });
    } catch {
      // El error ya se muestra en la página; el editor conserva el borrador.
    }
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
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
                    prev.map((a, i) => (i === indice ? { ...a, monto_usd: e.target.value } : a)),
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

      {/* Motivo global obligatorio (o fijo por el flujo) */}
      {!motivoFijo ? (
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
      ) : null}

      {/* Justificación: obligatoria si la reserva ya tiene pagos registrados */}
      {justificacionRequerida ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <Label htmlFor="precio-justificacion" className="text-sm font-semibold text-foreground">
            Justificación del cambio *
          </Label>
          <Input
            id="precio-justificacion"
            value={justificacion}
            onChange={(e) => setJustificacion(e.target.value)}
            placeholder="Ej.: se cobró de más el toldo y se devuelve la diferencia"
            className="min-h-11"
          />
          <p className="text-xs text-muted-foreground">
            {avisoJustificacion ??
              "Esta reserva tiene pagos registrados: el cambio de total necesita una justificación."}{" "}
            Queda en la auditoría y el titular verá el nuevo importe.
          </p>
        </div>
      ) : null}

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
        {onCancelar ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            disabled={guardando}
            onClick={onCancelar}
          >
            Cancelar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
