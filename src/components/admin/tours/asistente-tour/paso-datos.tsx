import * as React from "react";

import { Campo } from "@/components/admin/ui/campo";
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
import type { DocumentoTour, PoliticaCancelacion, VersionTerminos } from "@/lib/domain/types";

export interface PropsPasoDatos {
  documento: DocumentoTour;
  onChange: (documento: DocumentoTour) => void;
  /** Políticas de Configuración (se referencian por clave). */
  politicas: PoliticaCancelacion[];
  /** Versiones de términos publicadas (se referencian por clave). */
  terminos: VersionTerminos[];
  /** Regiones ya usadas en el catálogo (sugerencias). */
  familias: string[];
}

/** Duración sugerida por tipo de tour. */
const DURACION_SUGERIDA: Record<string, { dias: number; noches: number }> = {
  full_day: { dias: 1, noches: 0 },
  fin_de_semana: { dias: 2, noches: 1 },
  multi_dia: { dias: 3, noches: 2 },
};

/**
 * Paso 1 · **Datos** del tour.
 *
 * Es el formulario que da forma al documento del catálogo: nombre, tipo,
 * duración, familia, descripción, política, términos, hora, cupos y reserva.
 */
export function PasoDatos({ documento, onChange, politicas, terminos, familias }: PropsPasoDatos) {
  const cambiar = (cambios: Partial<DocumentoTour>) => onChange({ ...documento, ...cambios });

  const cambiarTipo = (tipo: DocumentoTour["tipo"]) => {
    const sugerida = DURACION_SUGERIDA[tipo];
    const duracion = documento.duracion ?? {};
    onChange({
      ...documento,
      tipo,
      duracion: {
        dias: duracion.dias ?? sugerida?.dias ?? 1,
        noches: duracion.noches ?? sugerida?.noches ?? 0,
      },
      // Los cupos del catálogo: 40 en full day, 24 en hospedaje.
      cupos: documento.cupos ?? (tipo === "full_day" ? 40 : 24),
    });
  };

  const politicasSinClave = politicas.filter((p) => !p.clave);
  const terminosSinClave = terminos.filter((t) => !t.clave);

  return (
    <div className="space-y-4">
      <Campo id="datos-nombre" etiqueta="Nombre del tour" requerido>
        {(props) => (
          <Input
            {...props}
            value={documento.nombre}
            onChange={(evento) => cambiar({ nombre: evento.target.value })}
            placeholder="Playa Caribe · Chuspa"
          />
        )}
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="datos-tipo" etiqueta="Tipo de tour" requerido>
          {(props) => (
            <Select value={documento.tipo} onValueChange={(valor) => cambiarTipo(valor as never)}>
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
          id="datos-familia"
          etiqueta="Familia o destino"
          ayuda="Agrupa el tour en el catálogo (Morrocoy, Chuspa, Mérida…)."
        >
          {(props) => (
            <>
              <Input
                {...props}
                list="familias-catalogo"
                value={documento.familia ?? ""}
                onChange={(evento) => cambiar({ familia: evento.target.value })}
                placeholder="Chuspa"
              />
              <datalist id="familias-catalogo">
                {familias.map((familia) => (
                  <option key={familia} value={familia} />
                ))}
              </datalist>
            </>
          )}
        </Campo>
      </div>

      <fieldset className="rounded-xl border border-border p-3">
        <legend className="px-1 text-sm font-semibold text-foreground">Duración del viaje</legend>
        <p className="text-xs text-muted-foreground">
          Cuántos días dura el viaje y cuántas noches incluye. Se muestra al cliente junto al nombre
          del tour.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Campo id="datos-dias" etiqueta="Días">
            {(props) => (
              <Input
                {...props}
                type="number"
                min={0}
                max={30}
                inputMode="numeric"
                value={documento.duracion?.dias ?? 1}
                onChange={(evento) =>
                  cambiar({
                    duracion: {
                      ...documento.duracion,
                      dias: Number.parseInt(evento.target.value, 10) || 0,
                    },
                  })
                }
              />
            )}
          </Campo>
          <Campo id="datos-noches" etiqueta="Noches">
            {(props) => (
              <Input
                {...props}
                type="number"
                min={0}
                max={30}
                inputMode="numeric"
                value={documento.duracion?.noches ?? 0}
                onChange={(evento) =>
                  cambiar({
                    duracion: {
                      ...documento.duracion,
                      noches: Number.parseInt(evento.target.value, 10) || 0,
                    },
                  })
                }
              />
            )}
          </Campo>
        </div>
      </fieldset>

      <Campo
        id="datos-descripcion"
        etiqueta="Descripción"
        ayuda="El párrafo que ve el cliente en la ficha pública."
      >
        {(props) => (
          <Textarea
            {...props}
            rows={3}
            value={documento.descripcion ?? ""}
            onChange={(evento) => cambiar({ descripcion: evento.target.value })}
            placeholder="Full day a Playa Caribe en Chuspa con transporte, lancha, comidas y actividades recreativas."
          />
        )}
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="datos-politica"
          etiqueta="Política de cancelación"
          ayuda="Se administra en Configuración → Políticas."
        >
          {(props) => (
            <Select
              value={documento.politica ?? "ninguna"}
              onValueChange={(valor) => cambiar({ politica: valor === "ninguna" ? null : valor })}
            >
              <SelectTrigger {...props} className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguna">Sin política asociada</SelectItem>
                {politicas.map((politica) => (
                  <SelectItem key={politica.id} value={politica.clave ?? politica.id}>
                    {politica.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Campo>

        <Campo
          id="datos-terminos"
          etiqueta="Términos y condiciones"
          ayuda="Se administran en Configuración → Términos."
        >
          {(props) => (
            <Select
              value={documento.terminos ?? "ninguno"}
              onValueChange={(valor) => cambiar({ terminos: valor === "ninguno" ? null : valor })}
            >
              <SelectTrigger {...props} className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguno">Sin términos asociados</SelectItem>
                {terminos.map((termino) => (
                  <SelectItem key={termino.id} value={termino.clave ?? termino.id}>
                    {termino.titulo} · v{termino.version}
                    {termino.activa ? " (publicada)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Campo>
      </div>

      {politicasSinClave.length > 0 || terminosSinClave.length > 0 ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Hay {politicasSinClave.length > 0 && "políticas "}
          {politicasSinClave.length > 0 && terminosSinClave.length > 0 && "y "}
          {terminosSinClave.length > 0 && "términos "}
          sin clave. Asigna la clave en Configuración para poder referenciarlos desde el catálogo.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo
          id="datos-hora"
          etiqueta="Hora de salida"
          ayuda="La salida la hereda si no se indica otra."
        >
          {(props) => (
            <Input
              {...props}
              type="time"
              value={documento.hora_salida ?? ""}
              onChange={(evento) => cambiar({ hora_salida: evento.target.value })}
            />
          )}
        </Campo>

        <Campo id="datos-cupos" etiqueta="Cupos por salida" ayuda="40 full day · 24 hospedaje.">
          {(props) => (
            <Input
              {...props}
              type="number"
              min={1}
              max={200}
              inputMode="numeric"
              value={documento.cupos ?? 40}
              onChange={(evento) =>
                cambiar({ cupos: Number.parseInt(evento.target.value, 10) || 0 })
              }
            />
          )}
        </Campo>

        <Campo
          id="datos-reserva"
          etiqueta="Reserva por persona (USD)"
          ayuda="Monto de la reserva que fija el catálogo (20, 50, 75, 100)."
        >
          {(props) => (
            <Input
              {...props}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={documento.reserva_usd ?? ""}
              onChange={(evento) =>
                cambiar({
                  reserva_usd: evento.target.value === "" ? null : Number(evento.target.value),
                })
              }
              placeholder="20"
            />
          )}
        </Campo>
      </div>
    </div>
  );
}

export { DURACION_SUGERIDA };
