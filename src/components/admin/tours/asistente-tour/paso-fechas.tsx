import * as React from "react";
import { Plus, Repeat, Trash2 } from "lucide-react";

import { Campo } from "@/components/admin/ui/campo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import type { DocumentoTour } from "@/lib/domain/types";
import { SelectorFecha } from "./selector-fecha";

export interface RecurrenciaSalidas {
  dia_semana: number;
  desde: string;
  hasta: string;
}

export interface PropsPasoFechas {
  documento: DocumentoTour;
  onChange: (documento: DocumentoTour) => void;
  /** Salidas recurrentes (estado del asistente). */
  recurrencia: RecurrenciaSalidas | null;
  onRecurrenciaChange: (recurrencia: RecurrenciaSalidas | null) => void;
}

const DIAS_SEMANA = [
  { valor: 1, texto: "lunes" },
  { valor: 2, texto: "martes" },
  { valor: 3, texto: "miércoles" },
  { valor: 4, texto: "jueves" },
  { valor: 5, texto: "viernes" },
  { valor: 6, texto: "sábado" },
  { valor: 0, texto: "domingo" },
];

/**
 * Paso 3 · **Fechas y precio**.
 *
 * Las salidas son **obligatorias**: sin ellas el cliente no puede reservar.
 * El precio es uno solo por persona (el catálogo define una sola cifra: niño
 * y tercera edad pagan lo mismo y el infante de 0 a 4 años va gratis).
 */
export function PasoFechas({
  documento,
  onChange,
  recurrencia,
  onRecurrenciaChange,
}: PropsPasoFechas) {
  const cambiar = (cambios: Partial<DocumentoTour>) => onChange({ ...documento, ...cambios });
  const modo: "lista" | "recurrencia" = recurrencia ? "recurrencia" : "lista";
  const [nueva, setNueva] = React.useState("");

  const fechas = [...documento.fechas].sort();
  const precio = documento.precios.adulto;

  const agregarFecha = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nueva)) return;
    if (documento.fechas.includes(nueva)) {
      setNueva("");
      return;
    }
    cambiar({ fechas: [...documento.fechas, nueva].sort() });
    setNueva("");
  };

  const quitarFecha = (fecha: string) =>
    cambiar({ fechas: documento.fechas.filter((f) => f !== fecha) });

  return (
    <div className="space-y-5">
      <Campo
        id="precio-persona"
        etiqueta="Precio por persona (USD)"
        ayuda="Una sola cifra por tour: los niños (5 a 11) y la tercera edad pagan lo mismo. Los menores de 4 años viajan gratis."
        requerido
      >
        {(props) => (
          <Input
            {...props}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={precio ?? ""}
            onChange={(evento) =>
              cambiar({
                precios: {
                  ...documento.precios,
                  adulto: evento.target.value === "" ? undefined : Number(evento.target.value),
                },
              })
            }
            placeholder="48"
          />
        )}
      </Campo>

      <fieldset className="space-y-3 rounded-xl border border-border p-3">
        <legend className="px-1 text-sm font-semibold text-foreground">Fechas de salida</legend>
        <p className="text-xs text-muted-foreground">
          Obligatorio: el cliente sólo puede reservar en las salidas publicadas. Elige una por una
          con el calendario (también puedes definir todos los días de la semana).
        </p>

        <div className="flex flex-wrap gap-4">
          <Label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={modo === "lista"}
              onCheckedChange={(valor) => {
                if (valor === true) onRecurrenciaChange(null);
              }}
              aria-label="Fechas sueltas"
            />
            Fechas sueltas
          </Label>
          <Label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={modo === "recurrencia"}
              onCheckedChange={(valor) => {
                if (valor === true) {
                  onRecurrenciaChange({ dia_semana: 5, desde: "", hasta: "" });
                }
              }}
              aria-label="Fechas recurrentes"
            />
            <Repeat className="h-4 w-4" aria-hidden="true" />
            Todos los días de la semana
          </Label>
        </div>

        {modo === "lista" ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Campo id="fecha-nueva" etiqueta="Agregar salida">
                  {(props) => (
                    <SelectorFecha
                      {...props}
                      valor={nueva}
                      onChange={setNueva}
                      placeholder="Elegir fecha de salida"
                    />
                  )}
                </Campo>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={agregarFecha}
                disabled={nueva === ""}
                className="min-h-11"
              >
                <Plus aria-hidden="true" />
                Agregar
              </Button>
            </div>

            {fechas.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label="Salidas del tour">
                {fechas.map((fecha) => (
                  <li
                    key={fecha}
                    className="flex items-center gap-1 rounded-full border border-border bg-muted/50 py-1 pl-3 pr-1 text-sm"
                  >
                    <span>{format(parseISO(fecha), "d MMM yyyy")}</span>
                    <button
                      type="button"
                      onClick={() => quitarFecha(fecha)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Quitar la salida del ${format(parseISO(fecha), "d MMM yyyy")}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                Todavía no hay salidas. Agrega al menos una para poder activar el tour.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo id="fechas-dia" etiqueta="Día de la semana">
              {(props) => (
                <Select
                  value={String(recurrencia?.dia_semana ?? 5)}
                  onValueChange={(valor) =>
                    onRecurrenciaChange({
                      ...(recurrencia ?? { desde: "", hasta: "" }),
                      dia_semana: Number(valor),
                    })
                  }
                >
                  <SelectTrigger {...props} className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAS_SEMANA.map((dia) => (
                      <SelectItem key={dia.valor} value={String(dia.valor)}>
                        Todos los {dia.texto}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Campo>
            <Campo id="fechas-desde" etiqueta="Desde">
              {(props) => (
                <SelectorFecha
                  {...props}
                  valor={recurrencia?.desde ?? ""}
                  onChange={(valor) =>
                    onRecurrenciaChange({
                      ...(recurrencia ?? { dia_semana: 5, hasta: "" }),
                      desde: valor,
                    })
                  }
                  placeholder="Fecha inicial"
                />
              )}
            </Campo>
            <Campo id="fechas-hasta" etiqueta="Hasta">
              {(props) => (
                <SelectorFecha
                  {...props}
                  valor={recurrencia?.hasta ?? ""}
                  onChange={(valor) =>
                    onRecurrenciaChange({
                      ...(recurrencia ?? { dia_semana: 5, desde: "" }),
                      hasta: valor,
                    })
                  }
                  placeholder="Fecha final"
                />
              )}
            </Campo>
          </div>
        )}

        <p
          className={
            fechas.length > 0 || (recurrencia?.desde && recurrencia?.hasta)
              ? "text-xs text-muted-foreground"
              : "text-xs font-medium text-destructive"
          }
        >
          {fechas.length > 0
            ? `${fechas.length} salida(s) agregadas.`
            : modo === "recurrencia" && recurrencia?.desde && recurrencia?.hasta
              ? "Se generarán todas las salidas del período, menos el día de la semana elegido."
              : "Faltan las salidas: el tour no se podrá activar sin al menos una."}
        </p>
      </fieldset>
    </div>
  );
}
