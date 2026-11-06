import { useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Clock,
  ListOrdered,
  MapPin,
  Sparkles,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate, formatTime, formatUsd } from "@/lib/format";
import { ETAPAS_RESERVA } from "@/lib/brand";
import type { Categoria } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

import { BotonCargar, BotonWhatsApp, SheetBottom } from "../ui";
import type { ContextoReserva } from "../use-reserva";

export interface CategoriaConEdad {
  categoria: Categoria;
  edad_min: number;
  edad_max: number;
  precio_usd: string;
}

export interface BienvenidaProps {
  reserva: ContextoReserva;
  /** Tarifas por categoría con su rango de edad (RF-2.5). */
  categorias: CategoriaConEdad[];
  /** Ejecuta `iniciar`; es idempotente. */
  onComenzar: () => void;
  iniciando: boolean;
  /** Mensaje de error al iniciar (por ejemplo, CAPTCHA). */
  errorInicio?: string | null | undefined;
  /** Número de intentos fallidos de verificación humana. */
  intentosCaptcha?: number | undefined;
  /** Teléfono de WhatsApp de la agencia. */
  telefonoWhatsapp?: string | undefined;
}

/**
 * P-01 — Bienvenida.
 *
 * Objetivo: que el cliente confirme que es el tour correcto y acepte el
 * aviso de privacidad antes de escribir ningún dato (Spec §5, P-01).
 */
export function Bienvenida({
  reserva,
  categorias,
  onComenzar,
  iniciando,
  errorInicio,
  intentosCaptcha = 0,
  telefonoWhatsapp,
}: BienvenidaProps) {
  const [aceptado, setAceptado] = useState(false);
  const [tocado, setTocado] = useState(false);
  const [avisoAbierto, setAvisoAbierto] = useState(false);

  const tour = reserva.tour;
  const fecha = reserva.fecha;
  const nombreTour = tour?.nombre ?? "Tu salida";
  const fechaSalida = fecha?.fecha_salida;
  const horaSalida = fecha?.hora_salida;
  const puntoAbordaje = tour?.puntos_abordaje?.[0];

  const faltaAceptar = !aceptado;

  // El botón principal nunca se deshabilita por validación (UX-17): al
  // pulsarlo se explica qué falta.
  const manejarComenzar = () => {
    if (!aceptado) {
      setTocado(true);
      return;
    }
    onComenzar();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Identificación de la salida */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tu reserva
        </p>
        <p className="mt-0.5 text-lg font-extrabold leading-tight text-foreground">{nombreTour}</p>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {fechaSalida ? (
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <dt className="sr-only">Fecha de salida</dt>
              <dd className="font-semibold text-foreground">{formatDate(fechaSalida)}</dd>
            </div>
          ) : null}
          {horaSalida ? (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <dt className="sr-only">Hora de salida</dt>
              <dd className="font-semibold text-foreground">{formatTime(horaSalida)}</dd>
            </div>
          ) : null}
          {puntoAbordaje ? (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <dt className="sr-only">Punto de abordaje</dt>
              <dd className="font-semibold text-foreground">{puntoAbordaje.nombre}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {/* Itinerario */}
      {tour && tour.itinerario.length > 0 ? (
        <SeccionDesplegable titulo="Itinerario del día" icono={<ListOrdered className="h-4 w-4" />}>
          <ol className="flex flex-col gap-3">
            {tour.itinerario.map((bloque) => (
              <li key={`${bloque.hora}-${bloque.titulo}`} className="flex gap-3">
                <span className="w-14 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                  {bloque.hora}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    {bloque.titulo}
                  </span>
                  {bloque.detalle ? (
                    <span className="block text-sm text-muted-foreground">{bloque.detalle}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </SeccionDesplegable>
      ) : null}

      {/* Incluye / no incluye */}
      {tour && (tour.incluye.length > 0 || tour.no_incluye.length > 0) ? (
        <SeccionDesplegable
          titulo="Qué incluye y qué no"
          icono={<Sparkles className="h-4 w-4" />}
        >
          {tour.incluye.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {tour.incluye.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <CircleCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-success"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {tour.no_incluye.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5">
              {tour.no_incluye.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </SeccionDesplegable>
      ) : null}

      {/* Tarifas por categoría con rango de edad */}
      {categorias.length > 0 ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-base font-bold text-foreground">Precios por persona</h2>
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {categorias.map((categoria) => (
              <li key={categoria.categoria} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    {categoria.categoria}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {`De ${categoria.edad_min} a ${categoria.edad_max} años`}
                  </span>
                </span>
                <span className="shrink-0 text-base font-extrabold tabular-nums text-foreground">
                  {formatUsd(categoria.precio_usd)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            La categoría de cada pasajero se calcula con su fecha de nacimiento al día de la salida.
          </p>
        </section>
      ) : null}

      {/* Política de cancelación resumida */}
      {reserva.politica_cancelacion && reserva.politica_cancelacion.tramos.length > 0 ? (
        <SeccionDesplegable titulo="Política de cancelación" icono={<Clock className="h-4 w-4" />}>
          <ul className="flex flex-col gap-2">
            {reserva.politica_cancelacion.tramos.map((tramo) => (
              <li key={tramo.dias_desde_salida} className="text-sm">
                <span className="font-semibold text-foreground">
                  {tramo.dias_desde_salida === 0
                    ? "Con menos de 24 h"
                    : `Hasta ${tramo.dias_desde_salida} días antes`}
                </span>
                <span className="block text-muted-foreground">
                  {`${tramo.descripcion} (${tramo.porcentaje_reembolso} % de reembolso)`}
                </span>
              </li>
            ))}
          </ul>
        </SeccionDesplegable>
      ) : null}

      {/* Pasos y tiempo estimado */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-base font-bold text-foreground">Lo que vamos a pedirte</h2>
        <ol className="mt-3 flex flex-col gap-2">
          {ETAPAS_RESERVA.map((etapa, indice) => (
            <li key={etapa.id} className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                {indice + 1}
              </span>
              <span className="text-sm font-medium text-foreground">{etapa.label}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Tarda unos 5 minutos. Puedes dejarlo a medias y continuar más tarde con el mismo enlace.
        </p>
      </section>

      {/* Aceptación del aviso de privacidad */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <Checkbox
          id="acepta-aviso"
          checked={aceptado}
          onCheckedChange={(estado) => {
            setAceptado(estado === true);
            setTocado(true);
          }}
          className="aspect-auto h-auto min-h-11 w-full grid-cols-[auto_1fr] items-center gap-3 rounded-xl border border-input px-3 py-3 text-left text-sm font-medium text-foreground data-[state=checked]:border-primary data-[state=checked]:bg-primary/5"
        >
          <span className="flex-1">Acepto el aviso de privacidad</span>
        </Checkbox>

        <button
          type="button"
          onClick={() => setAvisoAbierto(true)}
          className="mt-1 min-h-11 text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver el aviso de privacidad
        </button>

        {tocado && faltaAceptar ? (
          <p className="mt-1 text-xs font-medium text-destructive">
            Marca la casilla para continuar con tu reserva.
          </p>
        ) : null}

        {errorInicio ? (
          <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {errorInicio}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          <BotonCargar cargando={iniciando} onClick={manejarComenzar}>
            Comenzar
          </BotonCargar>

          {intentosCaptcha >= 2 ? (
            <BotonWhatsApp
              telefono={telefonoWhatsapp}
              mensaje="Hola, no pude completar la verificación de mi reserva. ¿Me pueden ayudar?"
              etiqueta="Prefiero que me ayudes por WhatsApp"
              variante="contorno"
            />
          ) : null}
        </div>
      </section>

      <SheetBottom
        abierto={avisoAbierto}
        onAbiertoChange={setAvisoAbierto}
        titulo="Aviso de privacidad"
        descripcion="Antes de usar tus datos, necesitas saber esto:"
      >
        <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            Usamos los datos que noscribes (nombre, documento, fecha de nacimiento, teléfono, correo
            y las respuestas del tour) únicamente para gestionar tu reserva, emitir tu voucher y
            contactarte si algo cambia en tu salida.
          </p>
          <p>
            No vendemos ni cedemos tus datos a terceros. Sólo se los entregamos a la persona que
            coordina la salida y a los proveedores que necesitan datos de la reserva para prestarte
            el servicio (por ejemplo, el traslado), y sólo en la medida necesaria.
          </p>
          <p>
            Puedes pedir que eliminemos tus datos cuando la reserva esté cancelada o vencida.
            Escríbenos por WhatsApp y lo gestionamos.
          </p>
        </div>
      </SheetBottom>
    </div>
  );
}

/** Sección de la pantalla que se abre y cierra (UX-35, hoja o acordeón). */
function SeccionDesplegable({
  titulo,
  icono,
  children,
}: {
  titulo: string;
  icono: ReactNode;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <Collapsible
      open={abierto}
      onOpenChange={setAbierto}
      className="rounded-2xl border border-border bg-card"
    >
      <CollapsibleTrigger className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="text-muted-foreground">{icono}</span>
        <span className="flex-1">{titulo}</span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", abierto && "rotate-180")}
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border px-4 py-3 text-sm">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
