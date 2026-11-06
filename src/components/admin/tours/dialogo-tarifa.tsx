import * as React from "react";

import { Campo } from "@/components/admin/ui/campo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Categoria, Tarifa } from "@/lib/domain/types";

export interface DialogoTarifaProps {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  /** Tarifa a editar (`null` = crear una nueva). */
  tarifa: Tarifa | null;
  /** Salidas disponibles para asociar una tarifa nueva. */
  fechas?: { id: string; etiqueta: string }[];
  /** ID de la fecha de salida (valor inicial al crear). */
  fechaTourId?: string;
  onGuardar: (datos: {
    id?: string;
    fecha_tour_id: string;
    categoria: Categoria;
    edad_min: number;
    edad_max: number;
    precio_usd: string;
  }) => void;
  guardando: boolean;
  /** Error devuelto por el servidor (se muestra junto al campo). */
  error?: string | undefined;
}

const CATEGORIAS: { valor: Categoria; etiqueta: string }[] = [
  { valor: "Adulto", etiqueta: "Adulto" },
  { valor: "Niño", etiqueta: "Niño" },
  { valor: "Tercera Edad", etiqueta: "Tercera Edad" },
  { valor: "Infante", etiqueta: "Infante" },
];

/**
 * Diálogo de creación y edición de una **tarifa**.
 *
 * Define el precio por categoría y rango de edad para una fecha de salida.
 */
export function DialogoTarifa({
  abierto,
  onAbiertoChange,
  tarifa,
  fechas,
  fechaTourId,
  onGuardar,
  guardando,
  error,
}: DialogoTarifaProps) {
  const [categoria, setCategoria] = React.useState<Categoria>("Adulto");
  const [fechaId, setFechaId] = React.useState("");
  const [edadMin, setEdadMin] = React.useState("18");
  const [edadMax, setEdadMax] = React.useState("120");
  const [precio, setPrecio] = React.useState("0.00");

  React.useEffect(() => {
    if (!abierto) return;
    setCategoria(tarifa?.categoria ?? "Adulto");
    setFechaId(tarifa?.fecha_tour_id ?? fechaTourId ?? fechas?.[0]?.id ?? "");
    setEdadMin(String(tarifa?.edad_min ?? 18));
    setEdadMax(String(tarifa?.edad_max ?? 120));
    setPrecio(tarifa?.precio_usd ?? "0.00");
  }, [abierto, tarifa, fechaTourId, fechas]);

  const edadMinNumero = Number.parseInt(edadMin, 10);
  const edadMaxNumero = Number.parseInt(edadMax, 10);
  const precioNumero = Number.parseFloat(precio);
  const datosValidos =
    Number.isFinite(edadMinNumero) &&
    Number.isFinite(edadMaxNumero) &&
    Number.isFinite(precioNumero) &&
    edadMinNumero >= 0 &&
    edadMaxNumero > edadMinNumero &&
    precioNumero >= 0 &&
    (tarifa !== null || Boolean(fechaId));

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            {tarifa ? "Editar tarifa" : "Nueva tarifa"}
          </DialogTitle>
          <DialogDescription>
            Define el precio según la categoría y el rango de edad de los pasajeros.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!tarifa ? (
            fechas && fechas.length > 0 ? (
              <Campo id="fecha-salida" etiqueta="Fecha de salida" requerido>
                {(props) => (
                  <Select value={fechaId} onValueChange={setFechaId}>
                    <SelectTrigger {...props} className="min-h-11">
                      <SelectValue placeholder="Elige la salida" />
                    </SelectTrigger>
                    <SelectContent>
                      {fechas.map((fecha) => (
                        <SelectItem key={fecha.id} value={fecha.id}>
                          {fecha.etiqueta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Campo>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                Este tour no tiene salidas programadas. Crea una salida primero.
              </p>
            )
          ) : null}

          <Campo id="categoria" etiqueta="Categoría" requerido>
            {(props) => (
              <Select value={categoria} onValueChange={(valor) => setCategoria(valor as Categoria)}>
                <SelectTrigger {...props} className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((cat) => (
                    <SelectItem key={cat.valor} value={cat.valor}>
                      {cat.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              id="edad-min"
              etiqueta="Edad mínima"
              ayuda="Edad mínima para esta categoría (años cumplidos)."
              requerido
            >
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={edadMin}
                  onChange={(evento) => setEdadMin(evento.target.value)}
                />
              )}
            </Campo>

            <Campo
              id="edad-max"
              etiqueta="Edad máxima"
              ayuda="Edad máxima para esta categoría (años cumplidos)."
              requerido
            >
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={edadMax}
                  onChange={(evento) => setEdadMax(evento.target.value)}
                />
              )}
            </Campo>
          </div>

          <Campo
            id="precio"
            etiqueta="Precio (USD)"
            ayuda="Precio que se cobrará a los pasajeros en esta categoría."
            error={error}
            requerido
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={precio}
                onChange={(evento) => setPrecio(evento.target.value)}
              />
            )}
          </Campo>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onAbiertoChange(false)}
            disabled={guardando}
            className="min-h-11"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() =>
              onGuardar({
                ...(tarifa ? { id: tarifa.id } : {}),
                fecha_tour_id: tarifa?.fecha_tour_id ?? fechaId,
                categoria,
                edad_min: edadMinNumero,
                edad_max: edadMaxNumero,
                precio_usd: precioNumero.toFixed(2),
              })
            }
            disabled={guardando || !datosValidos}
            aria-busy={guardando || undefined}
            className="min-h-11"
          >
            {guardando ? "Guardando…" : tarifa ? "Guardar cambios" : "Crear tarifa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
