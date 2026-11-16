import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { CampoDef, OpcionCampo, PuntoReferencia } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

import { Campo } from "../ui";

/**
 * Selector de **punto de salida agrupado por ciudad**.
 *
 * Primero se elige la ciudad (Guatire, Guarenas, Caracas) y luego el punto
 * de esa ciudad. Caracas sí es elegible: guarda la pseudo-opción `caracas`
 * y el punto exacto se confirma después por WhatsApp (los puntos reales de
 * la ciudad aparecen como referencia). La selección usa sombreado neutro
 * en lugar del azul de marca.
 */

export interface SelectorPuntoSalidaProps {
  campo: CampoDef;
  /** Opciones ya filtradas por agotadas (`opcionesDisponibles`). */
  opciones: (OpcionCampo & { agotada: boolean })[];
  seleccionado: string;
  onChange: (valor: string) => void;
  onBlur?: (() => void) | undefined;
  error?: string | undefined;
  aviso?: string | undefined;
  deshabilitado?: boolean | undefined;
}

/**
 * Ciudad de un punto por el **prefijo de su clave** (`guatire_*`,
 * `guarenas_*`, `caracas_*` o la pseudo-clave `caracas`). Se capitaliza la
 * primera letra para mostrarla («Guatire», «Caracas»).
 */
function ciudadDePunto(clave: string): string {
  const prefijo = clave.includes("_") ? (clave.split("_")[0] ?? clave) : clave;
  const limpio = prefijo.trim().toLowerCase();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

export function SelectorPuntoSalida({
  campo,
  opciones,
  seleccionado,
  onChange,
  onBlur,
  error,
  aviso,
  deshabilitado,
}: SelectorPuntoSalidaProps) {
  const id = `campo-${campo.id}`;

  const ciudades = useMemo(() => {
    const vistas = new Map<string, string>();
    for (const opcion of opciones) {
      const ciudad = ciudadDePunto(opcion.valor);
      if (!vistas.has(ciudad)) vistas.set(ciudad, ciudad);
    }
    return [...vistas.values()];
  }, [opciones]);

  const ciudadDelValor = seleccionado ? ciudadDePunto(seleccionado) : null;
  const [ciudadElegida, setCiudadElegida] = useState<string | null>(null);
  const ciudadActiva = ciudadDelValor ?? ciudadElegida ?? ciudades[0] ?? null;

  const puntosDeCiudad = opciones.filter((opcion) => ciudadDePunto(opcion.valor) === ciudadActiva);

  const referencias: PuntoReferencia[] = (campo.puntos_referencia ?? []).filter(
    (grupo) => ciudadDePunto(grupo.ciudad) === ciudadActiva,
  );

  const esCaracas = ciudadActiva === "Caracas";

  const elegirCiudad = (ciudad: string) => {
    if (ciudad === ciudadActiva) return;
    setCiudadElegida(ciudad);
    // El punto elegido pertenece a otra ciudad: se limpia para elegir otro.
    if (ciudadDelValor && ciudadDelValor !== ciudad) onChange("");
  };

  if (!ciudadActiva) return null;

  return (
    <Campo
      id={id}
      etiqueta={campo.label}
      ayuda={campo.ayuda}
      error={error}
      aviso={aviso}
      requerido={campo.obligatorio}
    >
      {() => (
        <div className="flex flex-col gap-3" onBlur={onBlur}>
          {/* 1) Ciudad de salida */}
          <div role="radiogroup" aria-label="Ciudad de salida" className="flex flex-wrap gap-2">
            {ciudades.map((ciudad) => (
              <button
                key={ciudad}
                type="button"
                role="radio"
                aria-checked={ciudadActiva === ciudad}
                disabled={deshabilitado}
                onClick={() => elegirCiudad(ciudad)}
                className={cn(
                  "min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  ciudadActiva === ciudad
                    ? "border-foreground/40 bg-muted text-foreground"
                    : "border-input bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                {ciudad}
              </button>
            ))}
          </div>

          {/* 2) Punto de esa ciudad (sombreado neutro) */}
          <RadioGroup
            value={seleccionado}
            onValueChange={(nuevo: string) => onChange(nuevo)}
            className="gap-2"
            aria-label={campo.label}
            disabled={deshabilitado}
            aria-describedby={error ? `${id}-error` : undefined}
          >
            {puntosDeCiudad.map((opcion) => (
              <RadioGroupItem
                key={opcion.valor}
                value={opcion.valor}
                disabled={opcion.agotada || deshabilitado}
                className={cn(
                  "aspect-auto h-auto min-h-11 w-full items-center justify-start gap-3 rounded-xl border border-input px-3 py-3 text-left text-sm font-medium text-foreground",
                  "data-[state=checked]:border-foreground/40 data-[state=checked]:bg-muted data-[state=checked]:text-foreground",
                )}
              >
                <span className="flex-1">{opcion.label}</span>
                {opcion.agotada ? (
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Agotado
                  </span>
                ) : null}
              </RadioGroupItem>
            ))}
          </RadioGroup>

          {/* 3) Caracas: el punto exacto se confirma por WhatsApp */}
          {esCaracas ? (
            <p className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {`El punto exacto en Caracas lo confirmamos por WhatsApp en el grupo de viaje. Elige «Caracas — punto por confirmar» y continúa.`}
              </span>
            </p>
          ) : null}

          {/* Puntos de esa ciudad como referencia (no son elegibles) */}
          {referencias.map((grupo) => (
            <div
              key={grupo.ciudad}
              className="rounded-xl border border-border bg-muted/40 px-3 py-2"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {`Puntos de referencia en ${ciudadActiva}`}
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {grupo.puntos.map((punto) => (
                  <li key={punto.clave} className="text-sm text-foreground">
                    <span className="font-semibold">{punto.nombre}</span>
                    {punto.hora ? (
                      <span className="text-muted-foreground">{` · ${punto.hora}`}</span>
                    ) : null}
                    {punto.referencia ? (
                      <span className="block text-xs text-muted-foreground">
                        {punto.referencia}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Campo>
  );
}
