import * as React from "react";

import { Campo } from "@/components/admin/ui/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import type { DocumentoTour } from "@/lib/domain/types";

export interface PropsPasoContenido {
  documento: DocumentoTour;
  onChange: (documento: DocumentoTour) => void;
}

/** Convierte un texto multilínea en una lista sin líneas vacías. */
function lineasALista(texto: string): string[] {
  return texto
    .split("\n")
    .map((linea) => linea.trim())
    .filter((linea) => linea !== "");
}

/**
 * Paso 2 · **Contenido** del tour: itinerario, qué incluye / no incluye y las
 * notas internas del catálogo.
 *
 * El itinerario del catálogo transcribe la hora dentro del `detalle`
 * ("Guatire y Guarenas 5:15 a. m."), así que la hora del bloque es
 * **opcional**: si la pones, se muestra como columna; si no, el texto habla.
 */
export function PasoContenido({ documento, onChange }: PropsPasoContenido) {
  const cambiar = (cambios: Partial<DocumentoTour>) => onChange({ ...documento, ...cambios });

  const actualizarBloque = (
    indice: number,
    cambios: Partial<DocumentoTour["itinerario"][number]>,
  ) =>
    cambiar({
      itinerario: documento.itinerario.map((bloque, i) =>
        i === indice ? { ...bloque, ...cambios } : bloque,
      ),
    });

  return (
    <div className="space-y-5">
      <fieldset className="space-y-3 rounded-xl border border-border p-3">
        <legend className="px-1 text-sm font-semibold text-foreground">Itinerario</legend>
        <p className="text-xs text-muted-foreground">
          El orden de la lista es el orden del día. La hora es opcional: si el catálogo la escribe
          dentro del detalle, déjala vacía.
        </p>

        {documento.itinerario.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
            Sin bloques de itinerario. Agrega «Salida», «Día en el destino», «Retorno»…
          </p>
        ) : (
          <ul className="space-y-2">
            {documento.itinerario.map((bloque, indice) => (
              <li
                key={`${indice}-${bloque.titulo}`}
                className="grid gap-2 sm:grid-cols-[6rem_1fr_1fr_auto]"
              >
                <Input
                  aria-label={`Hora del bloque ${indice + 1}`}
                  type="time"
                  value={bloque.hora ?? ""}
                  onChange={(evento) => actualizarBloque(indice, { hora: evento.target.value })}
                />
                <Input
                  aria-label={`Título del bloque ${indice + 1}`}
                  value={bloque.titulo}
                  onChange={(evento) => actualizarBloque(indice, { titulo: evento.target.value })}
                  placeholder="Salida"
                />
                <Input
                  aria-label={`Detalle del bloque ${indice + 1}`}
                  value={bloque.detalle}
                  onChange={(evento) => actualizarBloque(indice, { detalle: evento.target.value })}
                  placeholder="Guatire y Guarenas 5:15 a. m., Caracas 6:00 a. m."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    cambiar({
                      itinerario: documento.itinerario.filter((_, i) => i !== indice),
                    })
                  }
                  className="min-h-11 min-w-11 text-destructive"
                  aria-label={`Quitar el bloque ${indice + 1}`}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            cambiar({
              itinerario: [...documento.itinerario, { hora: "", titulo: "", detalle: "" }],
            })
          }
          className="min-h-11"
        >
          <Plus aria-hidden="true" />
          Agregar bloque
        </Button>
      </fieldset>

      <Campo
        id="contenido-incluye"
        etiqueta="Qué incluye"
        ayuda="Una línea por elemento. En las estadías se escribe «Día 1: …» y el día se muestra en negrita."
      >
        {(props) => (
          <Textarea
            {...props}
            rows={5}
            value={documento.incluye.join("\n")}
            onChange={(evento) => cambiar({ incluye: lineasALista(evento.target.value) })}
          />
        )}
      </Campo>

      <Campo
        id="contenido-no-incluye"
        etiqueta="Qué no incluye"
        ayuda="Una línea por elemento (toldos, consumos personales…)."
      >
        {(props) => (
          <Textarea
            {...props}
            rows={3}
            value={documento.no_incluye.join("\n")}
            onChange={(evento) => cambiar({ no_incluye: lineasALista(evento.target.value) })}
          />
        )}
      </Campo>

      <Campo
        id="contenido-notas"
        etiqueta="Notas internas"
        ayuda="Avisos para la agencia (ajustes por edad, horarios de la noche…). El cliente nunca las ve."
      >
        {(props) => (
          <Textarea
            {...props}
            rows={3}
            value={documento.notas.join("\n")}
            onChange={(evento) => cambiar({ notas: lineasALista(evento.target.value) })}
          />
        )}
      </Campo>
    </div>
  );
}
