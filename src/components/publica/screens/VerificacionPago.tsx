import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, MessageCircle, RefreshCw, TriangleAlert } from "lucide-react";

import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { esApiError, type ApiPublica } from "@/lib/domain/api";
import type { Pago, Progreso } from "@/lib/domain/types";
import { ETIQUETA_METODO_PAGO, ETIQUETA_MOTIVO_RECHAZO, formatDate, formatUsd } from "@/lib/format";
import { MARCA } from "@/lib/brand";

import { PublicShell } from "../layout/PublicShell";
import {
  BadgeEstado,
  Banner,
  BotonWhatsApp,
  Campo,
  UploadArchivo,
  useMovimientoReducido,
  useTituloPantalla,
} from "../ui";
import type { ContextoReserva } from "../use-reserva";

/**
 * P-09 — Pago en verificación (Spec §5, P-09).
 *
 * Mientras hay pagos por validar **no hay cuenta regresiva** (Spec §4.6): el
 * cupo está congelado. El estado se consulta cada 15 s (30 s en segundo plano).
 */

/** Tiempo típico de respuesta: texto configurable por la agencia. */
const TIEMPO_RESPUESTA = "normalmente respondemos en menos de 24 horas";

export interface VerificacionPagoProps {
  token: string;
  /** El pago fue aprobado: se pasa a P-13. */
  onConfirmada: () => void;
  /** El pago fue rechazado o se pidió corrección: se vuelve a P-08. */
  onVolverAPago: () => void;
  /** La reserva se cerró: se pasa a P-12. */
  onReservaCerrada: () => void;
  /**
   * `false` cuando el reporte de pago del cliente está desactivado (flag
   * `reporte_pago_cliente`): no se ofrecen botones de reporte ni corrección,
   * la agencia gestiona el pago desde el panel.
   */
  permiteReportar?: boolean | undefined;
  refCorta?: string | undefined;
  nombreTour?: string | undefined;
}

export function VerificacionPago({
  token,
  onConfirmada,
  onVolverAPago,
  onReservaCerrada,
  permiteReportar = true,
  refCorta,
  nombreTour,
}: VerificacionPagoProps) {
  useTituloPantalla("Pago en verificación · Ruta Clara");
  const reducido = useMovimientoReducido();

  const consultaReserva = useQuery<{ reserva: ContextoReserva; progreso: Progreso }>({
    queryKey: ["reserva", token],
    queryFn: () => api.publica.reserva(token),
    staleTime: 10_000,
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? 30_000 : 15_000),
  });
  const consultaPagos = useQuery({
    queryKey: ["pagos", token],
    queryFn: () => api.publica.pagos(token),
    staleTime: 10_000,
    refetchInterval: () => (typeof document !== "undefined" && document.hidden ? 30_000 : 15_000),
  });
  const consultaResumen = useQuery({
    queryKey: ["resumen", token],
    queryFn: () => api.publica.resumen(token),
    staleTime: 30_000,
  });

  const reserva = consultaReserva.data?.reserva ?? null;
  const pagos = consultaPagos.data ?? [];
  const saldoUsd = consultaResumen.data?.saldo_usd ?? reserva?.saldo_usd ?? "0.00";

  const estado = reserva?.estado ?? null;
  const estadoAnteriorRef = useRef<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [rechazado, setRechazado] = useState(false);

  // Detecta los cambios de estado entre sondeos.
  useEffect(() => {
    if (!estado) return;
    const anterior = estadoAnteriorRef.current;
    estadoAnteriorRef.current = estado;

    if (estado === "confirmada") {
      setConfirmado(true);
    } else if (estado === "pendiente_pago" && anterior === "pago_en_verificacion") {
      setRechazado(true);
    } else if (estado === "cancelada" || estado === "expirada") {
      onReservaCerrada();
    }
  }, [estado, onReservaCerrada]);

  // Avance a P-13 con una animación breve de confirmación.
  useEffect(() => {
    if (!confirmado) return;
    const id = window.setTimeout(() => onConfirmada(), reducido ? 200 : 1400);
    return () => window.clearTimeout(id);
  }, [confirmado, onConfirmada, reducido]);

  // El rechazo devuelve al cliente a P-08 con un mensaje (sólo si él reporta).
  useEffect(() => {
    if (!rechazado || !permiteReportar) return;
    const id = window.setTimeout(() => onVolverAPago(), reducido ? 200 : 2600);
    return () => window.clearTimeout(id);
  }, [onVolverAPago, permiteReportar, rechazado, reducido]);

  const pago = useMemo(() => ordenarPorFecha(pagos)[0] ?? null, [pagos]);
  const aprobado = useMemo(
    () =>
      pagos
        .filter((item) => item.estado === "aprobado")
        .reduce((suma, item) => suma + Number.parseFloat(item.monto || "0"), 0),
    [pagos],
  );
  const recibido = Number.parseFloat(saldoUsd) + aprobado;

  const pideCorreccion = pago?.estado === "correccion_solicitada";
  const fueRechazado = pago?.estado === "rechazado";

  if (confirmado) {
    return (
      <PublicShell titulo="¡Pago confirmado!" nombreTour={nombreTour} refCorta={refCorta}>
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-4 rounded-2xl border border-success/40 bg-success/10 px-5 py-8 text-center"
        >
          <CheckCircle2 className="h-14 w-14 text-success" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-extrabold text-foreground">Tu reserva está confirmada</h2>
            <p className="mt-1 text-sm leading-relaxed text-foreground/80">
              Ya te enviamos el voucher por correo y te lo mostramos aquí mismo.
            </p>
          </div>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      titulo={permiteReportar ? "Recibimos tu reporte de pago" : "Estamos verificando tu pago"}
      subtitulo={
        permiteReportar
          ? "Estamos verificando tu pago con la agencia. Te avisamos en cuanto esté listo."
          : "La agencia registró tu pago y lo está verificando. Te avisamos en cuanto esté listo."
      }
      pasoActual="pago"
      nombreTour={nombreTour}
      refCorta={refCorta}
      pagoPorValidar
    >
      <div className="flex flex-col gap-5">
        {rechazado ? (
          <Banner
            variante="urgencia"
            titulo="No pudimos validar tu pago"
            mensaje={
              permiteReportar
                ? "Te llevamos al formulario de pago para que puedas reportarlo de nuevo."
                : "Escríbenos por WhatsApp y lo resolvemos contigo."
            }
          />
        ) : null}

        {fueRechazado ? (
          <section className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <TriangleAlert className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
              <span>No pudimos validar tu pago</span>
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-foreground/80">
              {pago?.motivo_rechazo
                ? (ETIQUETA_MOTIVO_RECHAZO[pago.motivo_rechazo] ??
                  (permiteReportar
                    ? "Revisa los datos y vuelve a reportar el pago"
                    : "Escríbenos por WhatsApp y te ayudamos"))
                : permiteReportar
                  ? "Revisa los datos y vuelve a reportar el pago."
                  : "Escríbenos por WhatsApp y te ayudamos a resolverlo."}
            </p>
            {permiteReportar ? (
              <button
                type="button"
                onClick={onVolverAPago}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Reportar de nuevo</span>
              </button>
            ) : null}
          </section>
        ) : null}

        {pideCorreccion && pago ? (
          permiteReportar ? (
            <CorreccionPago
              token={token}
              pago={pago}
              onEnviada={() => void consultaPagos.refetch()}
            />
          ) : (
            <Banner
              variante="aviso"
              titulo="Necesitamos un ajuste"
              mensaje={
                pago.comentario_validador ??
                "Revisa el monto o la referencia con la agencia por WhatsApp."
              }
            />
          )
        ) : null}

        {/* Resumen del reporte ------------------------------------------ */}
        {pago ? (
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-foreground">Tu reporte</h2>
              <BadgeEstado
                etiqueta={pago.estado === "reportado" ? "En verificación" : "Recibido"}
                tono="activo"
                icono={<Clock3 className="h-3 w-3" aria-hidden="true" />}
              />
            </div>
            <dl className="mt-3 divide-y divide-border text-sm">
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-muted-foreground">Método</dt>
                <dd className="font-semibold text-foreground">
                  {ETIQUETA_METODO_PAGO[pago.metodo] ?? "Pago"}
                </dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-muted-foreground">Monto</dt>
                <dd className="font-semibold text-foreground">{formatUsd(pago.monto)}</dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-muted-foreground">Fecha</dt>
                <dd className="font-semibold text-foreground">{formatDate(pago.fecha_pago)}</dd>
              </div>
              {pago.referencia ? (
                <div className="flex justify-between gap-3 py-2">
                  <dt className="text-muted-foreground">Referencia</dt>
                  <dd className="break-all text-right font-semibold text-foreground">
                    {pago.referencia}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
        ) : (
          <p className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            Todavía no vemos tu reporte. Si acabas de enviarlo, espera unos segundos.
          </p>
        )}

        {/* Abono parcial aprobado --------------------------------------- */}
        {aprobado > 0 && Number.parseFloat(saldoUsd) > 0 ? (
          <Banner
            variante="aviso"
            titulo={`Recibimos ${formatUsd(recibido.toFixed(2))}`}
            mensaje={
              permiteReportar
                ? `Falta ${formatUsd(saldoUsd)} para confirmar tu reserva. Puedes reportar el resto cuando quieras.`
                : `Falta ${formatUsd(saldoUsd)} para confirmar tu reserva. La agencia te contactará para coordinar el resto.`
            }
            accion={
              permiteReportar ? (
                <button
                  type="button"
                  onClick={onVolverAPago}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-input bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Reportar el resto
                </button>
              ) : undefined
            }
          />
        ) : null}

        {/* Tiempo de respuesta ------------------------------------------ */}
        <section className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
            <Clock3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-foreground">¿Cuánto tarda?</h2>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              {TIEMPO_RESPUESTA}.
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Puedes cerrar esta página: tu reserva sigue guardada y aquí vuelves a ver el estado.
            </p>
          </div>
        </section>

        <BotonWhatsApp
          telefono={MARCA.whatsapp}
          mensaje={`Hola, estoy esperando la verificación de mi pago${refCorta ? ` (reserva ${refCorta})` : ""}.`}
          etiqueta="Consultar por WhatsApp"
          variante="solido"
          className="w-full"
        />
      </div>
    </PublicShell>
  );
}

/** Cuerpo de la corrección solicitada por el validador. */
type CuerpoCorreccion = Parameters<ApiPublica["solicitarCorreccion"]>[2];

/**
 * Corrección solicitada por el validador: sólo se puede reenviar referencia,
 * monto o comprobante (Spec §5, P-09).
 */
function CorreccionPago({
  token,
  pago,
  onEnviada,
}: {
  token: string;
  pago: Pago;
  onEnviada: () => void;
}) {
  const [referencia, setReferencia] = useState(pago.referencia);
  const [monto, setMonto] = useState(pago.monto);
  const [comprobante, setComprobante] = useState<{
    nombre: string;
    tipo: string;
    tamano: number;
  } | null>(
    pago.comprobante
      ? {
          nombre: pago.comprobante.nombre,
          tipo: pago.comprobante.tipo,
          tamano: pago.comprobante.tamano,
        }
      : null,
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);

  const enviar = async () => {
    if (enviando) return;
    setEnviando(true);
    setError("");
    try {
      const cuerpo: CuerpoCorreccion = {};
      if (referencia.trim()) cuerpo.referencia = referencia.trim();
      if (monto.trim()) cuerpo.monto = monto.trim();
      if (comprobante) {
        cuerpo.comprobante = {
          nombre: comprobante.nombre,
          tipo: comprobante.tipo,
          tamano: comprobante.tamano,
        };
      }
      await api.publica.solicitarCorreccion(token, pago.id, cuerpo);
      setListo(true);
      onEnviada();
    } catch (e) {
      setError(
        esApiError(e)
          ? e.mensajeMostrable
          : "No pudimos enviar la corrección. Revisa tu conexión e inténtalo de nuevo.",
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-chart-2/40 bg-chart-2/10 p-4">
      <h2 className="text-base font-bold text-foreground">Necesitamos un ajuste</h2>
      {pago.comentario_validador ? (
        <p className="text-sm leading-relaxed text-foreground/85">{pago.comentario_validador}</p>
      ) : (
        <p className="text-sm leading-relaxed text-foreground/85">
          Revisa el monto o la referencia de tu pago y vuelve a enviarnos los datos.
        </p>
      )}

      {listo ? (
        <p
          role="status"
          className="rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm font-semibold text-foreground"
        >
          Enviamos tu corrección. Volvemos a verificarla.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}

      <Campo id="correccion-referencia" etiqueta="Referencia del pago">
        {(aria) => (
          <Input
            {...aria}
            type="text"
            autoComplete="off"
            className="h-11 text-base uppercase"
            value={referencia}
            onChange={(evento) => setReferencia(evento.target.value)}
          />
        )}
      </Campo>

      <Campo id="correccion-monto" etiqueta="Monto (USD)">
        {(aria) => (
          <Input
            {...aria}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className="h-11 text-base"
            value={monto}
            onChange={(evento) => setMonto(evento.target.value)}
          />
        )}
      </Campo>

      <div>
        <UploadArchivo
          id="correccion-comprobante"
          nombreArchivo={comprobante?.nombre}
          etiqueta="Comprobante del pago"
          ayuda="Adjunta el comprobante corregido (opcional)."
          onSeleccionar={(archivo) =>
            setComprobante({ nombre: archivo.name, tipo: archivo.type, tamano: archivo.size })
          }
          onQuitar={() => setComprobante(null)}
        />
      </div>

      <button
        type="button"
        onClick={() => void enviar()}
        disabled={enviando}
        aria-busy={enviando || undefined}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        <span>{enviando ? "Enviando…" : "Enviar la corrección"}</span>
      </button>
    </section>
  );
}

/** El pago más reciente primero. */
function ordenarPorFecha(pagos: Pago[]): Pago[] {
  return [...pagos].sort(
    (a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime(),
  );
}
