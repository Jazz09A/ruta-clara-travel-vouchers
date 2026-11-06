import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, Clock, ShieldCheck } from "lucide-react";

import { MARCA } from "@/lib/brand";
import { formatCountdown, formatDate, formatHorasMinutos, formatTime } from "@/lib/format";
import type { EstadoPaso } from "@/lib/domain/types";

import { ActionBar, Banner, BotonWhatsApp, EstadoConexion, ProgressSteps } from "../ui";
import type { EstadoGuardado } from "../ui/EstadoConexion";

/**
 * API pública del shell de la app pública.
 *
 * La usan todas las pantallas P-01..P-13 (incluidas las que prepara otro
 * agente). Todas las propiedades son opcionales salvo `titulo` y `children`,
 * de modo que cada pantalla use sólo lo que necesita.
 */
export interface PublicShellProps {
  /** Título de la pantalla. Se renderiza como `<h1>` único de la pantalla. */
  titulo: string;
  subtitulo?: string | undefined;
  /** Id de la etapa visible: titular|acompanantes|preguntas|resumen|firma|pago. */
  pasoActual?: string | undefined;
  /** Etapas con su estado, tal como viene en `progreso.pasos`. */
  pasos?: { id: string; label: string; estado: EstadoPaso }[] | undefined;
  /** Navegar a una etapa ya completada (UX-43). */
  onNavegarPaso?: ((id: string) => void) | undefined;
  onAtras?: (() => void) | undefined;
  mostrarAtras?: boolean | undefined;
  accionPrincipal?:
    | { etiqueta: string; onClick: () => void; loading?: boolean; disabled?: boolean }
    | undefined;
  children: ReactNode;

  // --- Extensiones documentadas -------------------------------------------
  /** Contenido adicional dentro de la barra de acción inferior. */
  zonaAccion?: ReactNode | undefined;
  /** Nombre del tour, mostrado en la cabecera. */
  nombreTour?: string | undefined;
  /** Fecha de salida (`YYYY-MM-DD`) para la cabecera. */
  fechaTour?: string | undefined;
  /** Hora de salida (`HH:mm`). */
  horaTour?: string | undefined;
  /** Referencia corta de la reserva, para el mensaje de WhatsApp. */
  refCorta?: string | undefined;
  /** Vencimiento del hold (ISO). Si viene, se muestra el banner de cupo. */
  expiraEn?: string | null | undefined;
  /** Hay un pago en verificación: el vencimiento queda congelado. */
  pagoPorValidar?: boolean | undefined;
  /** Estado del autoguardado (indicador de la esquina). */
  estadoGuardado?: EstadoGuardado | undefined;
  /** Mensaje de reanudación al volver al enlace (UX-50). */
  mensajeReanudacion?: string | undefined;
  /** Acción secundaria del mensaje de reanudación. */
  onEmpezarDeCero?: (() => void) | undefined;
  /** Teléfono de WhatsApp de la agencia. */
  telefonoWhatsapp?: string | undefined;
  /** Texto prearmado de WhatsApp. */
  whatsappMensaje?: string | undefined;
  /** Versión del aviso de privacidad que se muestra en el pie. */
  versionAvisoPrivacidad?: string | undefined;
  /** Desfase entre el reloj del servidor y el del dispositivo (ms). */
  desfaseServidorMs?: number | undefined;
}

const MS_2_HORAS = 2 * 60 * 60 * 1000;
const MS_10_MIN = 10 * 60 * 1000;

/**
 * Shell de la app pública del cliente.
 *
 * Mobile-first (360 × 640). Una sola columna, barra de acción fija abajo con
 * *safe area*, cabecera compacta, progreso de 6 etapas, banner de hold,
 * ayuda de WhatsApp siempre accesible y pie con el aviso de privacidad.
 */
export function PublicShell({
  titulo,
  subtitulo,
  pasoActual,
  pasos,
  onNavegarPaso,
  onAtras,
  mostrarAtras,
  accionPrincipal,
  children,
  zonaAccion,
  nombreTour,
  fechaTour,
  horaTour,
  refCorta,
  expiraEn,
  pagoPorValidar,
  estadoGuardado,
  mensajeReanudacion,
  onEmpezarDeCero,
  telefonoWhatsapp,
  whatsappMensaje,
  versionAvisoPrivacidad,
  desfaseServidorMs = 0,
}: PublicShellProps) {
  const tituloRef = useRef<HTMLHeadingElement | null>(null);

  // Al cambiar de paso el foco va al título de la pantalla (Spec §3.9).
  useEffect(() => {
    const id = window.requestAnimationFrame(() => tituloRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [titulo]);

  const restante = useRestanteMs(expiraEn, desfaseServidorMs);

  const mensajeWhatsapp =
    whatsappMensaje ??
    `Hola, necesito ayuda con mi reserva${refCorta ? ` ${refCorta}` : ""}`;

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-28 lg:pb-0">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-2.5 lg:max-w-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {MARCA.nombre}
            </p>
            <p className="truncate text-sm font-extrabold text-foreground">
              {nombreTour ?? "Tu reserva"}
            </p>
            {fechaTour ? (
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{formatDate(fechaTour)}</span>
                {horaTour ? (
                  <>
                    <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>{formatTime(horaTour)}</span>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>

          <EstadoConexion estado={estadoGuardado ?? "inactivo"} className="shrink-0" />
        </div>
      </header>

      {pasos && pasos.length > 0 ? (
        <ProgressSteps pasos={pasos} pasoActual={pasoActual} onNavegar={onNavegarPaso} />
      ) : null}

      {expiraEn && !pagoPorValidar ? (
        <BannerHold restante={restante} />
      ) : null}

      {pagoPorValidar ? (
        <Banner variante="info" mensaje="Estamos verificando tu pago" />
      ) : null}

      {mensajeReanudacion ? (
        <div className="border-b border-border bg-secondary px-4 py-3">
          <p className="text-sm text-secondary-foreground">{mensajeReanudacion}</p>
          {onEmpezarDeCero ? (
            <button
              type="button"
              onClick={onEmpezarDeCero}
              className="mt-1.5 min-h-11 text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Empezar por el principio
            </button>
          ) : null}
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-6 pt-5 lg:max-w-2xl">
        <h1
          ref={tituloRef}
          tabIndex={-1}
          className="text-xl font-extrabold leading-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {titulo}
        </h1>
        {subtitulo ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitulo}</p>
        ) : null}
        <div className="mt-4">{children}</div>
      </main>

      <footer className="mx-auto w-full max-w-lg px-4 pt-6 text-xs leading-relaxed text-muted-foreground lg:max-w-2xl">
        <div className="flex items-start gap-2 rounded-2xl border border-border bg-card px-4 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="font-semibold text-foreground">
              {`Aviso de privacidad${versionAvisoPrivacidad ? ` (versión ${versionAvisoPrivacidad})` : ""}`}
            </p>
            <p className="mt-0.5">
              {`Usamos tus datos sólo para completar y gestionar esta reserva. ${MARCA.nombreCompleto}.`}
            </p>
            <p className="mt-0.5">
              {`${MARCA.email} · ${MARCA.direccion}`}
            </p>
          </div>
        </div>
      </footer>

      <BotonWhatsApp
        variante="flotante"
        telefono={telefonoWhatsapp ?? MARCA.whatsapp}
        mensaje={mensajeWhatsapp}
        etiqueta="¿Necesitas ayuda? Escríbenos por WhatsApp"
        className="fixed bottom-24 right-4 z-30 shadow-lg lg:bottom-6"
      />

      <ActionBar
        accionPrincipal={accionPrincipal}
        onAtras={onAtras}
        mostrarAtras={mostrarAtras}
      >
        {zonaAccion}
      </ActionBar>
    </div>
  );
}

/**
 * Banner del cupo reservado (Spec §4.6).
 * Menos de 2 h → advertencia; menos de 10 min → urgencia con `MM:SS`.
 */
function BannerHold({ restante }: { restante: number }) {
  if (restante <= 0) {
    return (
      <Banner
        variante="aviso"
        titulo="Tu cupo está por vencer"
        mensaje="Estamos revisando el estado de tu reserva."
      />
    );
  }

  if (restante < MS_10_MIN) {
    return (
      <Banner
        variante="urgencia"
        titulo={`Tu cupo vence en ${formatCountdown(restante)}`}
        mensaje="Contacta a la agencia para conservarlo."
      />
    );
  }

  if (restante < MS_2_HORAS) {
    return (
      <Banner
        variante="aviso"
        titulo="Tu cupo vence pronto"
        mensaje="Reporta tu pago para conservarlo."
      />
    );
  }

  return (
    <Banner
      variante="info"
      titulo={`Tu cupo está reservado por ${formatHorasMinutos(restante)}`}
      mensaje="Te avisamos cuando falte poco."
    />
  );
}

/** Milisegundos que faltan para `expiraEn`, corrigiendo con el reloj del servidor. */
function useRestanteMs(expiraEn: string | null | undefined, desfaseServidorMs: number): number {
  const [restante, setRestante] = useState(() => calcular(expiraEn, desfaseServidorMs));

  useEffect(() => {
    setRestante(calcular(expiraEn, desfaseServidorMs));
    if (!expiraEn) return () => {};
    const id = window.setInterval(() => {
      setRestante(calcular(expiraEn, desfaseServidorMs));
    }, 1000);
    return () => window.clearInterval(id);
  }, [expiraEn, desfaseServidorMs]);

  return restante;
}

function calcular(expiraEn: string | null | undefined, desfaseServidorMs: number): number {
  if (!expiraEn) return 0;
  const objetivo = new Date(expiraEn).getTime();
  if (Number.isNaN(objetivo)) return 0;
  return objetivo - (Date.now() + desfaseServidorMs);
}
