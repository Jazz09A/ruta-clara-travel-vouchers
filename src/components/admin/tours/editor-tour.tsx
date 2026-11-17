import { Link } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";

import { Campo } from "@/components/admin/ui/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ETIQUETA_TIPO_TOUR } from "@/lib/format";
import type {
  DocumentoPunto,
  PoliticaCancelacion,
  Tour,
  VersionTerminos,
} from "@/lib/domain/types";

export interface EditorTourProps {
  tour: Tour;
  onChange: (tour: Tour) => void;
  politicas: PoliticaCancelacion[];
  terminos: VersionTerminos[];
  /** `false` deja los campos en solo lectura (rol sin permiso de edición). */
  puedeEditar: boolean;
  /** Guarda el horario de recogida de cada punto (hora **de este tour**). */
  onGuardarPuntos?: (puntos: DocumentoPunto[]) => void;
  /** `true` mientras se guardan los puntos. */
  guardandoPuntos?: boolean;
  /** Familias ya usadas en el catálogo (sugerencias). */
  familias?: string[];
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
 * Nombre, tipo, duración, familia, descripción, itinerario, incluye / no
 * incluye, imágenes, puntos de abordaje (con su hora), política de
 * cancelación, versión de términos, cupos, hora de salida, reserva y notas.
 */
export function EditorTour({
  tour,
  onChange,
  politicas,
  terminos,
  puedeEditar,
  onGuardarPuntos,
  guardandoPuntos,
  familias = [],
}: EditorTourProps) {
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="tour-tipo" etiqueta="Tipo de tour" requerido>
          {(props) => (
            <Select
              value={tour.tipo}
              disabled={deshabilitado}
              onValueChange={(valor) => onChange({ ...tour, tipo: valor as Tour["tipo"] })}
            >
              <SelectTrigger {...props} className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["full_day", "fin_de_semana", "multi_dia"] as const).map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {ETIQUETA_TIPO_TOUR[tipo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Campo>

        <Campo
          id="tour-familia"
          etiqueta="Familia o destino"
          ayuda="Agrupa el tour en el catálogo (Morrocoy, Chuspa, Mérida…)."
        >
          {(props) => (
            <>
              <Input
                {...props}
                list="familias-tour"
                value={tour.familia ?? ""}
                readOnly={deshabilitado}
                onChange={(evento) => onChange({ ...tour, familia: evento.target.value })}
              />
              <datalist id="familias-tour">
                {familias.map((familia) => (
                  <option key={familia} value={familia} />
                ))}
              </datalist>
            </>
          )}
        </Campo>
      </div>

      <fieldset className="space-y-3 rounded-xl border border-border p-3">
        <legend className="px-1 text-sm font-semibold text-foreground">Duración y operación</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo id="tour-dias" etiqueta="Días">
            {(props) => (
              <Input
                {...props}
                type="number"
                min={0}
                max={30}
                inputMode="numeric"
                value={tour.duracion_dias ?? 0}
                readOnly={deshabilitado}
                onChange={(evento) =>
                  onChange({
                    ...tour,
                    duracion_dias: Number.parseInt(evento.target.value, 10) || 0,
                  })
                }
              />
            )}
          </Campo>

          <Campo id="tour-noches" etiqueta="Noches">
            {(props) => (
              <Input
                {...props}
                type="number"
                min={0}
                max={30}
                inputMode="numeric"
                value={tour.duracion_noches ?? 0}
                readOnly={deshabilitado}
                onChange={(evento) =>
                  onChange({
                    ...tour,
                    duracion_noches: Number.parseInt(evento.target.value, 10) || 0,
                  })
                }
              />
            )}
          </Campo>

          <Campo id="tour-hora" etiqueta="Hora de salida">
            {(props) => (
              <Input
                {...props}
                type="time"
                value={tour.hora_salida ?? ""}
                readOnly={deshabilitado}
                onChange={(evento) => onChange({ ...tour, hora_salida: evento.target.value })}
              />
            )}
          </Campo>

          <Campo id="tour-cupos" etiqueta="Cupos por salida">
            {(props) => (
              <Input
                {...props}
                type="number"
                min={1}
                max={200}
                inputMode="numeric"
                value={tour.cupos ?? ""}
                readOnly={deshabilitado}
                onChange={(evento) =>
                  onChange({ ...tour, cupos: Number.parseInt(evento.target.value, 10) || 0 })
                }
              />
            )}
          </Campo>
        </div>

        <Campo
          id="tour-reserva"
          etiqueta="Reserva por persona (USD)"
          ayuda="Monto de la reserva que fija el catálogo (20, 50, 75, 100). Es informativo."
        >
          {(props) => (
            <Input
              {...props}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={tour.reserva_usd ?? ""}
              readOnly={deshabilitado}
              onChange={(evento) =>
                onChange({
                  ...tour,
                  reserva_usd: evento.target.value === "" ? null : Number(evento.target.value),
                })
              }
            />
          )}
        </Campo>
      </fieldset>

      <Campo id="tour-descripcion" etiqueta="Descripción">
        {(props) => (
          <Textarea
            {...props}
            rows={3}
            value={tour.descripcion ?? ""}
            readOnly={deshabilitado}
            onChange={(evento) => onChange({ ...tour, descripcion: evento.target.value })}
          />
        )}
      </Campo>

      <fieldset className="space-y-3 rounded-xl border border-border p-3">
        <legend className="px-1 text-sm font-semibold text-foreground">Itinerario</legend>
        <p className="text-xs text-muted-foreground">
          El orden de la lista es el orden del día. La hora es opcional (en el catálogo suele ir
          dentro del detalle).
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
                value={bloque.hora ?? ""}
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
              itinerario: [...tour.itinerario, { hora: "", titulo: "", detalle: "" }],
            })
          }
          className="min-h-11"
        >
          <Plus aria-hidden="true" />
          Agregar bloque
        </Button>
      </fieldset>

      <Campo
        id="tour-incluye"
        etiqueta="Qué incluye"
        ayuda="Una línea por elemento. En las estadías se escribe «Día 1: …»."
      >
        {(props) => (
          <Textarea
            {...props}
            rows={4}
            value={tour.incluye.join("\n")}
            readOnly={deshabilitado}
            onChange={(evento) => onChange({ ...tour, incluye: lineasALista(evento.target.value) })}
          />
        )}
      </Campo>

      <Campo
        id="tour-no-incluye"
        etiqueta="Qué no incluye"
        ayuda="Una línea por elemento (toldos, consumos personales…)."
      >
        {(props) => (
          <Textarea
            {...props}
            rows={3}
            value={tour.no_incluye.join("\n")}
            readOnly={deshabilitado}
            onChange={(evento) =>
              onChange({ ...tour, no_incluye: lineasALista(evento.target.value) })
            }
          />
        )}
      </Campo>

      <Campo
        id="tour-notas"
        etiqueta="Notas internas"
        ayuda="Avisos para la agencia (ajustes por edad, horarios de la noche…). El cliente nunca las ve."
      >
        {(props) => (
          <Textarea
            {...props}
            rows={3}
            value={(tour.notas ?? []).join("\n")}
            readOnly={deshabilitado}
            onChange={(evento) => onChange({ ...tour, notas: lineasALista(evento.target.value) })}
          />
        )}
      </Campo>

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
          . La <strong>hora de recogida es de este tour</strong>: el mismo punto se recoge a
          distinta hora según el viaje.
        </p>
        <ul className="space-y-2">
          {tour.puntos_abordaje.length === 0 ? (
            <li className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
              No hay puntos de salida activos. Créalos en la configuración.
            </li>
          ) : (
            tour.puntos_abordaje.map((punto, indice) => {
              const esCaracas =
                punto.confirmar_hora === true ||
                (punto.nombre ?? "").toLowerCase().includes("caracas");
              return (
                <li
                  key={punto.id || `punto-${indice}`}
                  className="grid gap-2 rounded-xl border border-border bg-background px-3 py-2 sm:grid-cols-[1fr_8rem]"
                >
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-foreground">{punto.nombre}</span>
                    {punto.referencia_ubicacion ? (
                      <span className="block text-xs text-muted-foreground">
                        {punto.referencia_ubicacion}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`Hora de recogida en ${punto.nombre}`}
                      type="time"
                      value={punto.hora ?? ""}
                      disabled={deshabilitado || esCaracas}
                      onChange={(evento) => {
                        const puntos = tour.puntos_abordaje.map((p, i) =>
                          i === indice ? { ...p, hora: evento.target.value } : p,
                        );
                        onChange({ ...tour, puntos_abordaje: puntos });
                        onGuardarPuntos?.(
                          puntos.map((p) => ({
                            clave: p.clave ?? p.id,
                            hora: p.hora ?? "",
                            confirmar_hora: p.confirmar_hora,
                          })),
                        );
                      }}
                    />
                    {esCaracas ? (
                      <span className="text-xs text-muted-foreground">por confirmar</span>
                    ) : null}
                  </div>
                </li>
              );
            })
          )}
        </ul>
        {guardandoPuntos ? (
          <p className="text-xs text-muted-foreground">Guardando el horario de recogida…</p>
        ) : null}
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
