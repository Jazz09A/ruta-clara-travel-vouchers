import { useState } from "react";
import {
  Cake,
  Eye,
  EyeOff,
  IdCard,
  Image as ImageIcon,
  Mail,
  Phone,
  ShieldAlert,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatFechaNacimiento, formatPhoneE164, maskDocumento } from "@/lib/format";
import type { Pasajero } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * C-17 · Tarjeta de un pasajero (A-07).
 *
 * Los datos sensibles (documento y fecha de nacimiento) están **enmascarados
 * por defecto**. El revelado es temporal (30 s), exige motivo y queda
 * auditado (SEG-05). Nunca se copian solos al portapapeles (SEG-07).
 */

/** Selección de un campo del formulario, ya traducida a texto legible. */
export interface SeleccionMostrada {
  /** Identificador del campo. */
  campo: string;
  /** Etiqueta del campo. */
  etiqueta: string;
  /** Valor legible de la selección. */
  valor: string;
}

export type CampoRevelable = "documento" | "fecha_nacimiento";

export interface TarjetaPasajeroProps {
  /** Datos del pasajero. */
  pasajero: Pasajero;
  /** `true` si es el titular de la reserva. */
  esTitular: boolean;
  /** Selecciones del formulario ya traducidas. */
  selecciones: SeleccionMostrada[];
  /** Documento en claro, si está revelado. */
  documentoRevelado: string | undefined;
  /** Fecha de nacimiento en claro, si está revelada. */
  nacimientoRevelado: string | undefined;
  /** Segundos que faltan para volver a enmascarar. */
  segundosRevelado: number | null;
  /** El rol puede revelar datos sensibles. */
  puedeRevelar: boolean;
  /** Pide revelar un campo. */
  onRevelar: (campo: CampoRevelable) => void;
  /** Vuelve a enmascarar un campo. */
  onOcultar: (campo: CampoRevelable) => void;
}

function FilaDato({
  icono: Icono,
  etiqueta,
  valor,
}: {
  icono: typeof IdCard;
  etiqueta: string;
  valor: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{etiqueta}</span>
      </dt>
      <dd className="truncate text-sm font-medium text-foreground">{valor}</dd>
    </div>
  );
}

export function TarjetaPasajero({
  pasajero,
  esTitular,
  selecciones,
  documentoRevelado,
  nacimientoRevelado,
  segundosRevelado,
  puedeRevelar,
  onRevelar,
  onOcultar,
}: TarjetaPasajeroProps) {
  const documento = documentoRevelado ?? maskDocumento(pasajero.tipo_doc, pasajero.documento);
  const enmascarado = !documentoRevelado;

  const nacimiento = nacimientoRevelado
    ? formatFechaNacimiento(nacimientoRevelado)
    : pasajero.fecha_nacimiento
      ? "••/••/••••"
      : "Sin completar";

  const tieneAlergia =
    pasajero.respuestas["tiene_alergias"] === true ||
    typeof pasajero.respuestas["detalle_alergias"] === "string";

  const detalleAlergia =
    typeof pasajero.respuestas["detalle_alergias"] === "string"
      ? pasajero.respuestas["detalle_alergias"]
      : "";

  // Foto del documento: se abre con una URL firmada de corta vigencia y
  // la consulta queda registrada en la auditoría del servidor.
  const [cargandoFoto, setCargandoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const verFotoDocumento = async () => {
    if (!pasajero.documento_imagen_id || cargandoFoto) return;
    setCargandoFoto(true);
    setErrorFoto(null);
    try {
      const { url } = await api.admin.urlArchivo(pasajero.documento_imagen_id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setErrorFoto("No pudimos abrir la foto del documento. Reintenta.");
    } finally {
      setCargandoFoto(false);
    }
  };

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{pasajero.nombre || "Pasajero sin nombre"}</span>
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {`${pasajero.categoria}${esTitular ? " · Titular de la reserva" : ""}`}
          </p>
          {pasajero.categoria === "Infante" ? (
            <p className="mt-0.5 text-xs font-semibold text-success">
              Sin costo · viaja en piernas de su representante
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {esTitular ? (
            <span className="rounded-full border border-primary/30 bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
              Titular
            </span>
          ) : null}
          {!pasajero.documento_imagen_id ? (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              Sin foto del documento
            </span>
          ) : null}
        </div>
      </header>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FilaDato icono={IdCard} etiqueta="Documento" valor={documento || "Sin completar"} />
        <FilaDato icono={Cake} etiqueta="Fecha de nacimiento" valor={nacimiento} />
        {esTitular && pasajero.telefono ? (
          <FilaDato icono={Phone} etiqueta="Teléfono" valor={formatPhoneE164(pasajero.telefono)} />
        ) : null}
        {esTitular && pasajero.correo ? (
          <FilaDato icono={Mail} etiqueta="Correo" valor={pasajero.correo} />
        ) : null}
        {esTitular && pasajero.contacto_emergencia_nombre ? (
          <FilaDato
            icono={Phone}
            etiqueta="Contacto de emergencia"
            valor={`${pasajero.contacto_emergencia_nombre}${
              pasajero.contacto_emergencia_telefono
                ? ` · ${formatPhoneE164(pasajero.contacto_emergencia_telefono)}`
                : ""
            }`}
          />
        ) : null}
      </dl>

      {selecciones.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Selecciones
          </p>
          <ul className="flex flex-wrap gap-2">
            {selecciones.map((seleccion) => (
              <li
                key={seleccion.campo}
                className="rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
              >
                {`${seleccion.etiqueta}: ${seleccion.valor}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tieneAlergia ? (
        <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {`Alergia o condición médica reportada${detalleAlergia ? `: ${detalleAlergia}` : ""}.`}
          </span>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {puedeRevelar ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => onRevelar("documento")}
              disabled={Boolean(documentoRevelado)}
            >
              {enmascarado ? (
                <Eye className="h-4 w-4" aria-hidden="true" />
              ) : (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{enmascarado ? "Ver documento" : "Documento visible"}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => onRevelar("fecha_nacimiento")}
              disabled={Boolean(nacimientoRevelado)}
            >
              {nacimientoRevelado ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{nacimientoRevelado ? "Fecha visible" : "Ver fecha de nacimiento"}</span>
            </Button>

            {pasajero.documento_imagen_id ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={() => void verFotoDocumento()}
                disabled={cargandoFoto}
              >
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
                <span>{cargandoFoto ? "Abriendo…" : "Ver foto del documento"}</span>
              </Button>
            ) : null}

            {documentoRevelado || nacimientoRevelado ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11"
                onClick={() => {
                  onOcultar("documento");
                  onOcultar("fecha_nacimiento");
                }}
              >
                Volver a enmascarar
              </Button>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Tu rol no puede revelar datos sensibles de esta reserva.
          </p>
        )}
        {errorFoto ? (
          <p className="w-full text-xs font-medium text-destructive">{errorFoto}</p>
        ) : null}
      </div>

      {segundosRevelado !== null ? (
        <p
          role="status"
          aria-live="polite"
          className={cn("text-xs font-medium text-muted-foreground")}
        >
          {`Información sensible: se vuelve a enmascarar en ${segundosRevelado} s.`}
        </p>
      ) : null}
    </article>
  );
}
