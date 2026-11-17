import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OpcionCampo } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export interface EditorOpcionesProps {
  opciones: OpcionCampo[];
  onChange: (opciones: OpcionCampo[]) => void;
  /** `true` cuando el campo es de tipo «extra»: muestra el precio por opción. */
  conPrecio?: boolean | undefined;
  className?: string | undefined;
}

/** Convierte una etiqueta en un valor técnico estable. */
function valorDesdeEtiqueta(etiqueta: string): string {
  return etiqueta
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/**
 * Editor de opciones de un campo.
 *
 * Cada opción puede llevar un **cupo propio** (RF-3.5): el cliente solo ve
 * «Agotado», el admin ve el número.
 */
export function EditorOpciones({
  opciones,
  onChange,
  conPrecio = false,
  className,
}: EditorOpcionesProps) {
  const actualizar = (indice: number, cambios: Partial<OpcionCampo>) => {
    onChange(opciones.map((opcion, i) => (i === indice ? { ...opcion, ...cambios } : opcion)));
  };

  const mover = (indice: number, delta: number) => {
    const destino = indice + delta;
    if (destino < 0 || destino >= opciones.length) return;
    const copia = [...opciones];
    const actual = copia[indice];
    const swap = copia[destino];
    if (!actual || !swap) return;
    copia[indice] = swap;
    copia[destino] = actual;
    onChange(copia);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-xs text-muted-foreground">
        El cliente ve la lista con el nombre; el cupo solo lo ve el panel.
      </p>

      <ul className="space-y-2">
        {opciones.map((opcion, indice) => (
          <li key={`${opcion.valor}-${indice}`} className="rounded-xl border border-border p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`opcion-etiqueta-${indice}`} className="text-xs">
                  Texto que ve el cliente
                </Label>
                <Input
                  id={`opcion-etiqueta-${indice}`}
                  value={opcion.label}
                  onChange={(evento) => {
                    const label = evento.target.value;
                    const valor = valorDesdeEtiqueta(label);
                    actualizar(indice, { label, valor: valor || opcion.valor });
                  }}
                  placeholder="Pescado frito"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor={`opcion-valor-${indice}`} className="text-xs">
                  Valor interno
                </Label>
                <Input
                  id={`opcion-valor-${indice}`}
                  value={opcion.valor}
                  onChange={(evento) => actualizar(indice, { valor: evento.target.value })}
                  placeholder="pescado"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor={`opcion-cupo-${indice}`} className="text-xs">
                  Cupo (opcional)
                </Label>
                <Input
                  id={`opcion-cupo-${indice}`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={opcion.cupo ?? ""}
                  onChange={(evento) => {
                    const texto = evento.target.value;
                    actualizar(indice, { cupo: texto === "" ? undefined : Number(texto) });
                  }}
                  placeholder="Sin límite"
                />
              </div>

              {conPrecio ? (
                <div className="space-y-1">
                  <Label htmlFor={`opcion-precio-${indice}`} className="text-xs">
                    Precio en USD (opcional)
                  </Label>
                  <Input
                    id={`opcion-precio-${indice}`}
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={opcion.extra_usd ?? ""}
                    onChange={(evento) => {
                      const texto = evento.target.value;
                      actualizar(indice, { extra_usd: texto === "" ? undefined : texto });
                    }}
                    placeholder="0.00"
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => mover(indice, -1)}
                disabled={indice === 0}
                className="min-h-11"
              >
                <ArrowUp aria-hidden="true" />
                Subir
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => mover(indice, 1)}
                disabled={indice === opciones.length - 1}
                className="min-h-11"
              >
                <ArrowDown aria-hidden="true" />
                Bajar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(opciones.filter((_, i) => i !== indice))}
                className="min-h-11 text-destructive"
              >
                <Trash2 aria-hidden="true" />
                Quitar opción
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange([
            ...opciones,
            { valor: `opcion_${opciones.length + 1}`, label: `Opción ${opciones.length + 1}` },
          ])
        }
        className="min-h-11"
      >
        <Plus aria-hidden="true" />
        Agregar opción
      </Button>
    </div>
  );
}
