import { CalendarDays, Clock, Hash, MapPin, Users } from "lucide-react";

import { BadgeEstado } from "@/components/core/BadgeEstado";
import { BotonCopiar } from "@/components/core/BotonCopiar";
import { ContadorRegresivo } from "@/components/core/ContadorRegresivo";
import { ETIQUETA_ESTADO_RESERVA, formatPhoneE164, formatTime, formatUsd } from "@/lib/format";
import type { Reserva } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Cabecera del detalle de reserva (A-07).
 *
 * Responde de un vistazo: qué reserva es, en qué estado está, cuánto falta
 * por pagar y si hay algo urgente. El estado nunca se comunica solo con
 * color: siempre hay icono + texto (Spec §3.9).
 */

export interface CabeceraReservaProps {
  /** Reserva cargada. */
  reserva: Reserva;
  /** Nombre del tour. */
  tour: string | undefined;
  /** Fecha de salida (YYYY-MM-DD). */
  fechaSalida: string | undefined;
  /** Hora de salida (HH:mm). */
  horaSalida: string | undefined;
  className?: string | undefined;
}

export function CabeceraReserva({
  reserva,
  tour,
  fechaSalida,
  horaSalida,
  className,
}: CabeceraReservaProps) {
  const titular = reserva.pasajeros.find((pasajero) => pasajero.es_titular);
  const telefono = titular?.telefono ?? "";
  const saldo = Number.parseFloat(reserva.saldo_usd);
  const tieneSaldo = Number.isFinite(saldo) && saldo > 0;

  return (
    <section
      aria-label="Resumen de la reserva"
      className={cn("flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-card", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight text-foreground">
              {reserva.codigo}
            </span>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
              {reserva.ref_corta}
            </span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {tour ? (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{tour}</span>
              </span>
            ) : null}
            {fechaSalida ? (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{fechaSalida}</span>
                {horaSalida ? <span>{`· ${formatTime(horaSalida)}`}</span> : null}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {`${reserva.pasajeros.length} ${reserva.pasajeros.length === 1 ? "pasajero" : "pasajeros"}`}
              </span>
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <BadgeEstado estado={reserva.estado} tipo="reserva" tamano="md" />
          <BadgeEstado estado={reserva.estado_pago} tipo="pago" tamano="md" />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-muted/50 p-3 sm:grid-cols-4">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Total</dt>
          <dd className="text-base font-bold tabular-nums text-foreground">
            {formatUsd(reserva.total_usd)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Saldo</dt>
          <dd
            className={cn(
              "text-base font-bold tabular-nums",
              tieneSaldo ? "text-amber-800 dark:text-amber-200" : "text-emerald-700 dark:text-emerald-300",
            )}
          >
            {formatUsd(reserva.saldo_usd)}
          </dd>
          <dd className="text-xs text-muted-foreground">
            {tieneSaldo ? "Pendiente por cobrar" : "Sin saldo pendiente"}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Reserva</dt>
          <dd className="text-sm font-semibold text-foreground">
            {ETIQUETA_ESTADO_RESERVA[reserva.estado] ?? reserva.estado}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Vence</dt>
          <dd>
            {reserva.expira_en ? (
              <ContadorRegresivo expiraEn={reserva.expira_en} etiqueta="Vencimiento del cupo" />
            ) : (
              <span className="text-sm font-semibold text-muted-foreground">Sin vencimiento</span>
            )}
          </dd>
        </div>
      </dl>

      {reserva.requiere_accion ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{`Requiere acción: ${reserva.requiere_accion}`}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <BotonCopiar
          valor={reserva.codigo}
          etiqueta="Copiar código"
          contexto="código de la reserva"
          size="sm"
        />
        <BotonCopiar
          valor={reserva.ref_corta}
          etiqueta="Copiar referencia"
          contexto="referencia corta"
          size="sm"
        />
        {telefono ? (
          <BotonCopiar
            valor={formatPhoneE164(telefono)}
            etiqueta="Copiar WhatsApp del titular"
            contexto="teléfono del titular"
            size="sm"
          />
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Hash className="h-3.5 w-3.5" aria-hidden="true" />
            <span>El titular todavía no dejó un teléfono.</span>
          </span>
        )}
      </div>
    </section>
  );
}
