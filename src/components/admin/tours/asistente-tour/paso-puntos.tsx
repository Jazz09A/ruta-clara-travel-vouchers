import * as React from "react";

import { Campo } from "@/components/admin/ui/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { DocumentoTour, PuntoSalida } from "@/lib/domain/types";

export interface PropsPasoPuntos {
  documento: DocumentoTour;
  onChange: (documento: DocumentoTour) => void;
  /** Catálogo global de puntos de salida (Configuración). */
  puntos: PuntoSalida[];
}

/**
 * Paso 3 · **Puntos y horarios** de recogida.
 *
 * La hora es **de este tour**: el mismo punto se recoge a distinta hora
 * según el viaje (Guatire 05:15 en un tour, 06:30 en otro). En Caracas la
 * hora se confirma después por el grupo de viaje.
 */
export function PasoPuntos({ documento, onChange, puntos }: PropsPasoPuntos) {
  const cambiar = (cambios: Partial<DocumentoTour>) => onChange({ ...documento, ...cambios });

  const porClave = new Map(puntos.map((p) => [p.clave, p]));
  const usados = documento.puntos
    .map((p) => porClave.get(p.clave))
    .filter(Boolean) as PuntoSalida[];
  const disponibles = puntos.filter(
    (p) => p.activo && !documento.puntos.some((usado) => usado.clave === p.clave),
  );

  const agregar = (clave: string) => {
    const ref = porClave.get(clave);
    if (!ref) return;
    const esCaracas = (ref.ciudad ?? "").toLowerCase().includes("caracas");
    cambiar({
      puntos: [
        ...documento.puntos,
        {
          clave,
          hora: ref.hora,
          confirmar_hora: esCaracas,
        },
      ],
    });
  };

  const quitar = (clave: string) =>
    cambiar({ puntos: documento.puntos.filter((p) => p.clave !== clave) });

  const cambiarHora = (clave: string, hora: string) =>
    cambiar({
      puntos: documento.puntos.map((p) => (p.clave === clave ? { ...p, hora } : p)),
    });

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Los puntos salen del catálogo global (Configuración → Puntos de salida). Aquí eliges los de
        este tour y la <strong>hora de recogida</strong>, que cambia según el viaje.
      </p>

      <fieldset className="space-y-3 rounded-xl border border-border p-3">
        <legend className="px-1 text-sm font-semibold text-foreground">
          Puntos de este tour ({documento.puntos.length})
        </legend>

        {documento.puntos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
            Agrega al menos un punto de salida: sin él el cliente no puede elegir dónde sube.
          </p>
        ) : (
          <ul className="space-y-2">
            {documento.puntos.map((punto) => {
              const ref = porClave.get(punto.clave);
              const esCaracas =
                punto.confirmar_hora === true ||
                (ref?.ciudad ?? "").toLowerCase().includes("caracas");
              return (
                <li
                  key={punto.clave}
                  className="grid gap-2 rounded-xl border border-border bg-background px-3 py-2 sm:grid-cols-[1fr_8rem_auto]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {ref?.nombre ?? punto.clave}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ref?.ciudad ? `${ref.ciudad} · ` : ""}
                      {ref?.referencia ?? "Sin referencia"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`Hora de recogida en ${ref?.nombre ?? punto.clave}`}
                      type="time"
                      value={punto.hora}
                      disabled={esCaracas}
                      onChange={(evento) => cambiarHora(punto.clave, evento.target.value)}
                    />
                    {esCaracas ? (
                      <span className="text-xs text-muted-foreground">por confirmar</span>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => quitar(punto.clave)}
                    className="min-h-11 min-w-11 text-destructive"
                    aria-label={`Quitar ${ref?.nombre ?? punto.clave}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {disponibles.length > 0 ? (
        <Campo id="puntos-agregar" etiqueta="Agregar punto de salida">
          {(props) => (
            <div className="flex flex-wrap gap-2">
              {disponibles.map((punto) => (
                <Button
                  key={punto.clave}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => agregar(punto.clave)}
                  className="min-h-11"
                >
                  <Plus aria-hidden="true" />
                  {punto.nombre}
                  {punto.ciudad ? ` · ${punto.ciudad}` : ""}
                </Button>
              ))}
            </div>
          )}
        </Campo>
      ) : (
        <p className="text-xs text-muted-foreground">
          Ya usaste todos los puntos activos del catálogo. Crea más en Configuración → Puntos de
          salida.
        </p>
      )}

      {usados.some((p) => (p.ciudad ?? "").toLowerCase().includes("caracas")) ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          En Caracas el cliente elige «Caracas — punto por confirmar»: el punto exacto y su hora se
          confirman después por el grupo de viaje.
        </p>
      ) : null}

      <Label className="text-xs text-muted-foreground">
        La fecha que se guarda es el día en que <strong>sale el bus</strong>. En los viajes con
        «salida la noche anterior», el día de actividad queda en las notas del tour.
      </Label>
    </div>
  );
}
