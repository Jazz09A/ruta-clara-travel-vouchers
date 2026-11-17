import { useState, type ReactNode } from "react";
import {
  CalendarDays,
  CalendarRange,
  ChevronDown,
  CircleCheck,
  Clock,
  ListOrdered,
  MapPin,
  Sparkles,
} from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate, formatTime } from "@/lib/format";
import { ETAPAS_RESERVA } from "@/lib/brand";
import type { Categoria } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

import { BotonCargar, BotonWhatsApp, SheetBottom } from "../ui";
import type { ContextoReserva } from "../use-reserva";

export interface CategoriaConEdad {
  categoria: Categoria;
  edad_min: number;
  edad_max: number;
  /** El precio ya no viaja al cliente; se conserva opcional por compatibilidad. */
  precio_usd?: string | undefined;
}

export interface BienvenidaProps {
  reserva: ContextoReserva;
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
 * Separa el desglose «Día N …» de las inclusiones de las estadías para
 * mostrar el día en negrita (p. ej. «Día 2 (retorno 4:00 p. m.) — …»).
 * El corte es en los dos puntos que SIGUEN al rótulo (`": "`): el de la
 * hora dentro del rótulo («4:00 p. m.») va pegado al dígito y no cuenta.
 * El resto de inclusiones se lista igual que siempre.
 */
function agruparDias(incluye: string[]): { dia: string | null; texto: string }[] {
  return incluye.map((item) => {
    if (!/^Día\s*\d/i.test(item)) return { dia: null, texto: item };
    const corte = item.indexOf(": ");
    if (corte < 0) return { dia: null, texto: item };
    return { dia: item.slice(0, corte), texto: item.slice(corte + 2) };
  });
}

/**
 * P-01 — Bienvenida.
 *
 * Objetivo: que el cliente confirme que es el tour correcto y acepte el
 * aviso de privacidad antes de escribir ningún dato (Spec §5, P-01).
 */ export function Bienvenida({
  reserva,
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
  /** "3 días / 2 noches" (la duración es dato del tour). */
  const duracionTexto =
    tour?.duracion_dias || tour?.duracion_noches
      ? [
          tour.duracion_dias
            ? `${tour.duracion_dias} día${tour.duracion_dias === 1 ? "" : "s"}`
            : null,
          tour.duracion_noches
            ? `${tour.duracion_noches} noche${tour.duracion_noches === 1 ? "" : "s"}`
            : null,
        ]
          .filter(Boolean)
          .join(" / ")
      : null;

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
              <dd className="font-semibold text-foreground">
                {puntoAbordaje.nombre}
                {puntoAbordaje.confirmar_hora ? (
                  <span className="font-normal text-muted-foreground"> (por confirmar)</span>
                ) : null}
              </dd>
            </div>
          ) : null}
          {duracionTexto ? (
            <div className="flex items-center gap-2">
              <CalendarRange
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <dt className="sr-only">Duración del viaje</dt>
              <dd className="font-semibold text-foreground">{duracionTexto}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {/* Itinerario */}
      {tour && tour.itinerario.length > 0 ? (
        <SeccionDesplegable titulo="Itinerario del día" icono={<ListOrdered className="h-4 w-4" />}>
          <ol className="flex flex-col gap-3">
            {tour.itinerario.map((bloque, indice) => (
              <li key={`${bloque.hora ?? ""}-${bloque.titulo}-${indice}`} className="flex gap-3">
                {bloque.hora ? (
                  <span className="w-14 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                    {bloque.hora}
                  </span>
                ) : null}
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
        <SeccionDesplegable titulo="Qué incluye y qué no" icono={<Sparkles className="h-4 w-4" />}>
          {tour.incluye.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {agruparDias(tour.incluye).map((linea, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <CircleCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-success"
                    aria-hidden="true"
                  />
                  <span>
                    {linea.dia ? <span className="font-semibold">{`${linea.dia} — `}</span> : null}
                    {linea.texto}
                  </span>
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

      {/* Aceptación del aviso de privacidad (tarjeta integrada) */}
      <section
        aria-label="Aviso de privacidad"
        className="rounded-2xl border border-border bg-card p-4"
      >
        <p className="text-base font-bold text-foreground">Aviso de privacidad</p>
        <div
          className={cn(
            "mt-3 flex items-center gap-3 rounded-xl border px-3 py-1.5 transition-colors",
            tocado && faltaAceptar
              ? "border-destructive/60 bg-destructive/5"
              : aceptado
                ? "border-success/50 bg-success/10"
                : "border-input bg-background",
          )}
        >
          <Checkbox
            id="acepta-aviso"
            checked={aceptado}
            onCheckedChange={(estado) => {
              setAceptado(estado === true);
              setTocado(true);
            }}
            className="h-5 w-5"
            aria-invalid={tocado && faltaAceptar ? true : undefined}
            aria-describedby={tocado && faltaAceptar ? "acepta-aviso-error" : undefined}
          />
          <label
            htmlFor="acepta-aviso"
            className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 text-sm font-medium text-foreground"
          >
            {aceptado ? (
              <CircleCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            ) : null}
            <span>Acepto el aviso de privacidad</span>
          </label>
          <button
            type="button"
            onClick={() => setAvisoAbierto(true)}
            className="shrink-0 text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Leer aviso
          </button>
        </div>

        {tocado && faltaAceptar ? (
          <p
            id="acepta-aviso-error"
            role="alert"
            className="mt-2 text-xs font-medium text-destructive"
          >
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
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            abierto && "rotate-180",
          )}
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border px-4 py-3 text-sm">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
