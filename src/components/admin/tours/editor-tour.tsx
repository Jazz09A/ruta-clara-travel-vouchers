import { Link } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";

import { Campo } from "@/components/admin/ui/campo";
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
import { Textarea } from "@/components/ui/textarea";
import { ETIQUETA_TIPO_TOUR } from "@/lib/format";
import type { PoliticaCancelacion, Tour, VersionTerminos } from "@/lib/domain/types";

export interface EditorTourProps {
  tour: Tour;
  onChange: (tour: Tour) => void;
  politicas: PoliticaCancelacion[];
  terminos: VersionTerminos[];
  /** `false` deja los campos en solo lectura (rol sin permiso de edición). */
  puedeEditar: boolean;
}

/** Convierte un texto multilínea en una lista de elementos sin vacíos. */
function lineasALista(texto: string): string[] {
  return texto
    .split("\n")
    .map((linea) => linea.trim())
    .filter((linea) => linea !== "");
}

/**
 * Editor de los datos del tour (RF-1.1).
 *
 * Nombre, tipo, descripción, itinerario, incluye / no incluye, imágenes,
 * puntos de abordaje, política de cancelación y versión de términos.
 */
export function EditorTour({ tour, onChange, politicas, terminos, puedeEditar }: EditorTourProps) {
  const deshabilitado = !puedeEditar;

  return (
    <div className="space-y-6">
      <Campo id="tour-nombre" etiqueta="Nombre del tour" requerido>
        {(props) => (
          <Input
            {...props}
            value={tour.nombre}
            readOnly={deshabilitado}
            onChange={(evento) => onChange({ ...tour, nombre: evento.target.value })}
          />
        )}
      </Campo>

      <fieldset className="space-y-3 rounded-xl border border-border p-3">
        <legend className="px-1 text-sm font-semibold text-foreground">Itinerario</legend>
        <p className="text-xs text-muted-foreground">
          El orden de la lista es el orden del día. Escribe la hora en formato 24 h.
        </p>

        <ul className="space-y-2">
          {tour.itinerario.map((bloque, indice) => (
            <li
              key={`${bloque.hora}-${indice}`}
              className="grid gap-2 sm:grid-cols-[6rem_1fr_1fr_auto]"
            >
              <Input
                aria-label={`Hora del bloque ${indice + 1}`}
                type="time"
                value={bloque.hora}
                readOnly={deshabilitado}
                onChange={(evento) =>
                  onChange({
                    ...tour,
                    itinerario: tour.itinerario.map((b, i) =>
                      i === indice ? { ...b, hora: evento.target.value } : b,
                    ),
                  })
                }
              />
              <Input
                aria-label={`Título del bloque ${indice + 1}`}
                value={bloque.titulo}
                readOnly={deshabilitado}
                onChange={(evento) =>
                  onChange({
                    ...tour,
                    itinerario: tour.itinerario.map((b, i) =>
                      i === indice ? { ...b, titulo: evento.target.value } : b,
                    ),
                  })
                }
                placeholder="Salida hacia el destino"
              />
              <Input
                aria-label={`Detalle del bloque ${indice + 1}`}
                value={bloque.detalle}
                readOnly={deshabilitado}
                onChange={(evento) =>
                  onChange({
                    ...tour,
                    itinerario: tour.itinerario.map((b, i) =>
                      i === indice ? { ...b, detalle: evento.target.value } : b,
                    ),
                  })
                }
                placeholder="Detalle del bloque"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={deshabilitado}
                onClick={() =>
                  onChange({
                    ...tour,
                    itinerario: tour.itinerario.filter((_, i) => i !== indice),
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

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={deshabilitado}
          onClick={() =>
            onChange({
              ...tour,
              itinerario: [...tour.itinerario, { hora: "08:00", titulo: "", detalle: "" }],
            })
          }
          className="min-h-11"
        >
          <Plus aria-hidden="true" />
          Agregar bloque
        </Button>
      </fieldset>

      <Campo
        id="tour-imagenes"
        etiqueta="Imágenes"
        ayuda="Una dirección de imagen por línea. La primera es la portada."
      >
        {(props) => (
          <Textarea
            {...props}
            rows={3}
            value={tour.imagenes.join("\n")}
            readOnly={deshabilitado}
            onChange={(evento) =>
              onChange({ ...tour, imagenes: lineasALista(evento.target.value) })
            }
          />
        )}
      </Campo>

      <fieldset className="space-y-3 rounded-xl border border-border p-3">
        <legend className="px-1 text-sm font-semibold text-foreground">Puntos de salida</legend>
        <p className="text-xs text-muted-foreground">
          Este tour usa el catálogo global de puntos de salida de la agencia. Para crear, editar o
          eliminar puntos se hace en{" "}
          <Link
            to="/admin/configuracion/puntos"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Configuración → Puntos de salida
          </Link>
          .
        </p>
        <ul className="space-y-2">
          {tour.puntos_abordaje.length === 0 ? (
            <li className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
              No hay puntos de salida activos. Créalos en la configuración.
            </li>
          ) : (
            tour.puntos_abordaje.map((punto, indice) => (
              <li
                key={punto.id || `punto-${indice}`}
                className="grid gap-1 rounded-xl border border-border bg-background px-3 py-2 sm:grid-cols-[1fr_auto]"
              >
                <span className="text-sm font-semibold text-foreground">{punto.nombre}</span>
                <span className="text-xs text-muted-foreground">{`Recogida ${punto.hora}`}</span>
              </li>
            ))
          )}
        </ul>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="tour-politica"
          etiqueta="Política de cancelación"
          ayuda="Es un requisito para activar el tour."
        >
          {(props) => (
            <Select
              value={tour.politica_cancelacion_id === "" ? "ninguna" : tour.politica_cancelacion_id}
              disabled={deshabilitado}
              onValueChange={(valor) =>
                onChange({
                  ...tour,
                  politica_cancelacion_id: valor === "ninguna" ? "" : valor,
                })
              }
            >
              <SelectTrigger {...props} className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguna">Sin política asociada</SelectItem>
                {politicas.map((politica) => (
                  <SelectItem key={politica.id} value={politica.id}>
                    {politica.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Campo>

        <Campo
          id="tour-terminos"
          etiqueta="Términos y condiciones"
          ayuda="El cliente firma la versión publicada que elijas."
        >
          {(props) => (
            <Select
              value={tour.terminos_version_id === "" ? "ninguna" : tour.terminos_version_id}
              disabled={deshabilitado}
              onValueChange={(valor) =>
                onChange({
                  ...tour,
                  terminos_version_id: valor === "ninguna" ? "" : valor,
                })
              }
            >
              <SelectTrigger {...props} className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguna">Sin términos asociados</SelectItem>
                {terminos.map((version) => (
                  <SelectItem key={version.id} value={version.id}>
                    Versión {version.version}
                    {version.activa ? " (activa)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Campo>
      </div>
    </div>
  );
}
