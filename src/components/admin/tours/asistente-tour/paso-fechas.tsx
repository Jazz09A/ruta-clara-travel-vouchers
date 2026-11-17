import * as React from "react";

import { Campo } from "@/components/admin/ui/campo";
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
import { Textarea } from "@/components/ui/textarea";
import type { CategoriasPrecio, DocumentoTour } from "@/lib/domain/types";

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
  { valor: 1, texto: "Lunes" },
  { valor: 2, texto: "Martes" },
  { valor: 3, texto: "Miércoles" },
  { valor: 4, texto: "Jueves" },
  { valor: 5, texto: "Viernes" },
  { valor: 6, texto: "Sábado" },
  { valor: 0, texto: "Domingo" },
];

const CATEGORIAS: { clave: CategoriasPrecio; texto: string; ayuda: string }[] = [
  { clave: "adulto", texto: "Adulto", ayuda: "18 años o más" },
  { clave: "nino", texto: "Niño", ayuda: "5 a 11 años" },
  { clave: "tercera_edad", texto: "Tercera edad", ayuda: "61 años o más" },
  { clave: "infante", texto: "Infante", ayuda: "0 a 4 años · gratis" },
];

/**
 * Paso 4 · **Fechas y precios**.
 *
 * Los precios del catálogo son **del tour** (4 categorías) y se copian a cada
 * salida; las fechas se cargan de una vez, explícitas o por día de semana
 * (así se generaron las 10 salidas de Choroní).
 */
export function PasoFechas({
  documento,
  onChange,
  recurrencia,
  onRecurrenciaChange,
}: PropsPasoFechas) {
  const cambiar = (cambios: Partial<DocumentoTour>) => onChange({ ...documento, ...cambios });
  const modo: "lista" | "recurrencia" = recurrencia ? "recurrencia" : "lista";

  const fechas = documento.fechas;
  const tienePrecios = Object.values(documento.precios).some(
    (precio) => precio !== undefined && precio !== null,
  );

  const cambiarPrecio = (categoria: CategoriasPrecio, valor: string) =>
    cambiar({
      precios: {
        ...documento.precios,
        [categoria]: valor === "" ? undefined : Number(valor),
      },
    });

  return (
    <div className="space-y-5">
      <fieldset className="space-y-3 rounded-xl border border-border p-3">
        <legend className="px-1 text-sm font-semibold text-foreground">
          Precios por categoría (USD)
        </legend>
        <p className="text-xs text-muted-foreground">
          El catálogo los define por tour y se copian a cada salida. El infante (0-4 años) siempre
          va en 0.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {CATEGORIAS.map((categoria) => (
            <Campo
              key={categoria.clave}
              id={`precio-${categoria.clave}`}
              etiqueta={categoria.texto}
              ayuda={categoria.ayuda}
            >
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  disabled={categoria.clave === "infante"}
                  value={
                    categoria.clave === "infante" ? "0" : (documento.precios[categoria.clave] ?? "")
                  }
                  onChange={(evento) => cambiarPrecio(categoria.clave, evento.target.value)}
                  placeholder="0.00"
                />
              )}
            </Campo>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-border p-3">
        <legend className="px-1 text-sm font-semibold text-foreground">Fechas de salida</legend>

        <div className="flex flex-wrap gap-4">
          <Label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={modo === "lista"}
              onCheckedChange={(valor) => {
                if (valor === true) onRecurrenciaChange(null);
              }}
              aria-label="Fechas explícitas"
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
            Todos los días de la semana
          </Label>
        </div>

        {modo === "lista" ? (
          <Campo
            id="fechas-lista"
            etiqueta="Salidas"
            ayuda="Una fecha por línea (YYYY-MM-DD). Ejemplo: 2026-12-20"
          >
            {(props) => (
              <Textarea
                {...props}
                rows={4}
                value={fechas.join("\n")}
                onChange={(evento) =>
                  cambiar({
                    fechas: evento.target.value
                      .split(/[\s,;]+/)
                      .map((f) => f.trim())
                      .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f)),
                  })
                }
              />
            )}
          </Campo>
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
                        {dia.texto}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Campo>
            <Campo id="fechas-desde" etiqueta="Desde">
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={recurrencia?.desde ?? ""}
                  onChange={(evento) =>
                    onRecurrenciaChange({
                      ...(recurrencia ?? { dia_semana: 5, hasta: "" }),
                      desde: evento.target.value,
                    })
                  }
                />
              )}
            </Campo>
            <Campo id="fechas-hasta" etiqueta="Hasta">
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={recurrencia?.hasta ?? ""}
                  onChange={(evento) =>
                    onRecurrenciaChange({
                      ...(recurrencia ?? { dia_semana: 5, desde: "" }),
                      hasta: evento.target.value,
                    })
                  }
                />
              )}
            </Campo>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {fechas.length > 0
            ? `${fechas.length} salida(s) escritas.`
            : "Todavía no hay fechas: el tour se podrá activar cuando tenga al menos una salida publicada."}
          {!tienePrecios
            ? " Faltan los precios: sin tarifas el cliente no puede confirmar su reserva."
            : ""}
        </p>
      </fieldset>
    </div>
  );
}
