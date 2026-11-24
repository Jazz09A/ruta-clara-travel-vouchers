import { ClipboardList, ShieldAlert } from "lucide-react";

import { TarjetaPasajero, type CampoRevelable, type SeleccionMostrada } from "./TarjetaPasajero";
import type { DatoRevelado } from "./use-revelo-temporal";
import type { Pasajero, PuntoSalida, Respuesta } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Panel de **pasajeros y respuestas** de la reserva (A-07).
 *
 * Los datos sensibles van enmascarados. El revelado es temporal, pide
 * motivo y queda auditado (SEG-05).
 */

/**
 * Lo mínimo que el panel necesita de un campo del formulario: etiqueta y,
 * si el control tiene opciones, sus etiquetas legibles. No se limita a los
 * campos editables (p. ej. el multiselect de sabores de desayuno sólo se
 * lee).
 */
export interface CampoReferencia {
  id: string;
  label: string;
  tipo?: string | undefined;
  opciones?: { valor: string; label: string }[] | undefined;
}

export interface PanelPasajerosProps {
  /** Pasajeros de la reserva. */
  pasajeros: Pasajero[];
  /** Respuestas globales del formulario. */
  respuestasGlobales: Record<string, Respuesta>;
  /** Campos del formulario, para poner etiqueta a las selecciones. */
  campos: CampoReferencia[];
  /**
   * Catálogo de puntos de salida: traduce la clave guardada en
   * `punto_abordaje` a su nombre legible (el snapshot del formulario no
   * siempre trae las opciones actualizadas).
   */
  puntos?: PuntoSalida[] | undefined;
  /** El rol puede revelar datos sensibles. */
  puedeRevelar: boolean;
  /** Valores revelados, por clave `${ref_cliente}:${campo}`. */
  revelados: Record<string, DatoRevelado>;
  /** Segundos restantes de un dato revelado. */
  segundosRestantes: (clave: string) => number | null;
  /** Pide revelar un campo de un pasajero. */
  onRevelar: (campo: CampoRevelable, refPasajero: string) => void;
  /** Vuelve a enmascarar un campo. */
  onOcultar: (campo: CampoRevelable, refPasajero: string) => void;
  className?: string | undefined;
}

/** Traduce el valor crudo de una respuesta a texto legible. */
function valorLegible(valor: Respuesta): string {
  if (valor === null || valor === undefined) return "Sin responder";
  if (Array.isArray(valor)) return valor.length > 0 ? valor.join(", ") : "Sin responder";
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  return String(valor);
}

export function PanelPasajeros({
  pasajeros,
  respuestasGlobales,
  campos,
  puntos,
  puedeRevelar,
  revelados,
  segundosRestantes,
  onRevelar,
  onOcultar,
  className,
}: PanelPasajerosProps) {
  const etiquetaDeCampo = (campo: string): string =>
    campos.find((definicion) => definicion.id === campo)?.label ?? campo;

  const valorDeCampo = (campo: string, valor: Respuesta): string => {
    // Pseudo-clave del selector de ciudades: el punto exacto de Caracas se
    // confirma después por WhatsApp (no está en el snapshot del formulario).
    if (campo === "punto_abordaje" && valor === "caracas") {
      return "Caracas — punto por confirmar";
    }
    const definicion = campos.find((c) => c.id === campo);
    if (definicion && definicion.tipo === "select" && typeof valor === "string") {
      // Punto de salida por clave del catálogo global: el nombre actual del
      // punto manda sobre el snapshot del formulario (p. ej. el punto único
      // de una ciudad, como el kiosco de Guatire).
      if (campo === "punto_abordaje" && puntos) {
        const punto = puntos.find((p) => p.clave === valor);
        if (punto) return punto.nombre;
      }
      return definicion.opciones?.find((opcion) => opcion.valor === valor)?.label ?? valor;
    }
    // Multiselect (p. ej. sabor del desayuno): traduce cada valor elegido.
    if (definicion && definicion.tipo === "multiselect" && Array.isArray(valor)) {
      if (valor.length === 0) return "Sin responder";
      return valor
        .map(
          (elegido) =>
            definicion.opciones?.find((opcion) => opcion.valor === elegido)?.label ?? elegido,
        )
        .join(", ");
    }
    return valorLegible(valor);
  };

  const clavesGlobales = Object.keys(respuestasGlobales);

  return (
    <section
      aria-label="Pasajeros y respuestas"
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-card",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground">
          {`Pasajeros y respuestas (${pasajeros.length})`}
        </h2>
        <p className="text-xs text-muted-foreground">
          Los documentos y fechas de nacimiento están enmascarados.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {pasajeros.map((pasajero) => {
          const selecciones: SeleccionMostrada[] = Object.entries(pasajero.respuestas)
            .filter(
              ([campo, valor]) =>
                campo !== "punto_abordaje" && valor !== null && valor !== undefined && valor !== "",
            )
            .map(([campo, valor]) => ({
              campo,
              etiqueta: etiquetaDeCampo(campo),
              valor: valorDeCampo(campo, valor),
            }));

          // Punto de salida por pasajero (salidas personalizadas): el propio
          // o, si no lo definió, el de la reserva. Se muestra como dato
          // propio de la tarjeta para identificar la parada de cada uno.
          const puntoPropio = pasajero.respuestas["punto_abordaje"];
          const puntoEfectivo = puntoPropio ?? respuestasGlobales["punto_abordaje"];
          const puntoSalida =
            puntoEfectivo !== null && puntoEfectivo !== undefined && puntoEfectivo !== ""
              ? valorDeCampo("punto_abordaje", puntoEfectivo)
              : undefined;

          const claveDocumento = `${pasajero.ref_cliente}:documento`;
          const claveNacimiento = `${pasajero.ref_cliente}:fecha_nacimiento`;

          return (
            <TarjetaPasajero
              key={pasajero.ref_cliente}
              pasajero={pasajero}
              esTitular={pasajero.es_titular}
              selecciones={selecciones}
              puntoSalida={puntoSalida}
              documentoRevelado={revelados[claveDocumento]?.valor}
              nacimientoRevelado={revelados[claveNacimiento]?.valor}
              segundosRevelado={
                segundosRestantes(claveDocumento) ?? segundosRestantes(claveNacimiento)
              }
              puedeRevelar={puedeRevelar}
              onRevelar={(campo) => onRevelar(campo, pasajero.ref_cliente)}
              onOcultar={(campo) => onOcultar(campo, pasajero.ref_cliente)}
            />
          );
        })}
      </div>

      {clavesGlobales.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
            Respuestas de la reserva
          </p>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {clavesGlobales.map((campo) => (
              <div key={campo} className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{etiquetaDeCampo(campo)}</dt>
                <dd className="text-sm font-medium text-foreground">
                  {valorDeCampo(campo, respuestasGlobales[campo] ?? null)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {pasajeros.some((pasajero) => pasajero.respuestas["tiene_alergias"] === true) ? (
        <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Hay pasajeros con alergias o condiciones médicas. Revísalas antes de la salida.
          </span>
        </p>
      ) : null}
    </section>
  );
}
