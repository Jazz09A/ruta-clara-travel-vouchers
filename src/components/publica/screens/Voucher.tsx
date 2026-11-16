import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  Users,
} from "lucide-react";

import { api, apiAbsUrl } from "@/lib/api";
import type {
  FechaTour,
  Formulario,
  PuntoAbordaje,
  Progreso,
  Respuesta,
  Tour,
} from "@/lib/domain/types";
import { formatDate, formatTime, formatUsd, plural } from "@/lib/format";
import { MARCA } from "@/lib/brand";

import { PublicShell } from "../layout/PublicShell";
import { BadgeEstado, Banner, BotonWhatsApp, useTituloPantalla } from "../ui";
import type { ContextoReserva } from "../use-reserva";

/**
 * P-13 — Reserva confirmada y voucher (Spec §5, P-13 / RF-8.6).
 *
 * El voucher se pide **al pulsar** (la URL firmada dura 5 minutos y no se
 * cachea). Si el servidor lo está generando, se muestra el estado y se
 * consulta cada 3 s hasta 60 s.
 */

type EstadoVoucher = "inactivo" | "preparando" | "generando" | "listo" | "error" | "por_correo";

/** Texto de la plantilla de WhatsApp de la agencia. */
const PLANTILLA_VOUCHER =
  "¡Hola {nombre}! Te enviamos tu voucher de {tour} (salida {fecha}). Referencia {ref_corta}. Muéstralo en el punto de abordaje.";

export interface VoucherProps {
  token: string;
  /** Hay saldo pendiente: se ofrece reportar el pago. */
  onReportarPago?: (() => void) | undefined;
  /**
   * Texto propio para el aviso de saldo pendiente. Se usa cuando el reporte
   * de pago del cliente está desactivado y la agencia coordina el pago.
   */
  textoSaldo?: string | undefined;
  /** La reserva se cerró: se pasa a P-12. */
  onReservaCerrada?: (() => void) | undefined;
  refCorta?: string | undefined;
  nombreTour?: string | undefined;
}

export function Voucher({
  token,
  onReportarPago,
  textoSaldo,
  onReservaCerrada,
  refCorta,
  nombreTour,
}: VoucherProps) {
  useTituloPantalla("Reserva confirmada · Ruta Clara");

  // El servidor devuelve `{ reserva, progreso, tour, fecha, formulario }` como
  // hermanos: se combina en un solo objeto para que el voucher muestre el
  // nombre real del tour, la fecha y el catálogo de puntos («Sale desde»).
  const consultaReserva = useQuery<{
    reserva: ContextoReserva;
    progreso: Progreso;
    tour?: Tour | undefined;
    fecha?: FechaTour | undefined;
    formulario?: Formulario | undefined;
  }>({
    queryKey: ["reserva", token],
    queryFn: () => api.publica.reserva(token),
    staleTime: 30_000,
  });
  const consultaResumen = useQuery({
    queryKey: ["resumen", token],
    queryFn: () => api.publica.resumen(token),
    staleTime: 30_000,
  });

  const reserva = useMemo(() => {
    const data = consultaReserva.data;
    if (!data) return null;
    return {
      ...data.reserva,
      tour: data.reserva.tour ?? data.tour,
      fecha: data.reserva.fecha ?? data.fecha,
      formulario: data.reserva.formulario ?? data.formulario,
    };
  }, [consultaReserva.data]);
  const saldoUsd = consultaResumen.data?.saldo_usd ?? reserva?.saldo_usd ?? "0.00";

  const [estadoVoucher, setEstadoVoucher] = useState<EstadoVoucher>("inactivo");
  const [urlVoucher, setUrlVoucher] = useState("");
  const [errorVoucher, setErrorVoucher] = useState("");
  const intentosRef = useRef(0);

  const salida = resolverSalida(reserva);
  const puntosDelVoucher = useMemo(() => mapaPuntos(reserva), [reserva]);
  const titular = reserva?.pasajeros.find((pasajero) => pasajero.es_titular) ?? null;
  const correoTitular = titular?.correo ?? "";

  // Generación del voucher: se consulta cada 3 s hasta 60 s (Spec §5, P-13).
  useEffect(() => {
    if (estadoVoucher !== "generando") return;
    if (intentosRef.current >= 20) {
      setEstadoVoucher("error");
      setErrorVoucher("Te lo enviaremos por correo en unos minutos");
      return;
    }
    const id = window.setTimeout(() => {
      intentosRef.current += 1;
      void api.publica
        .voucher(token)
        .then((resultado) => {
          if (resultado.estado === "listo" && resultado.url_descarga) {
            setUrlVoucher(resultado.url_descarga);
            setEstadoVoucher("listo");
            return;
          }
          if (resultado.estado === "error") {
            setEstadoVoucher("error");
            setErrorVoucher(
              "No pudimos generar el voucher. Te lo enviamos por correo en unos minutos.",
            );
            return;
          }
          setEstadoVoucher("generando");
        })
        .catch(() => {
          setEstadoVoucher("error");
          setErrorVoucher(
            "No pudimos generar el voucher. Te lo enviamos por correo en unos minutos.",
          );
        });
    }, 3000);
    return () => window.clearTimeout(id);
  }, [estadoVoucher, token]);

  /** Pide el voucher al servidor (la URL firmada no se cachea). */
  const prepararVoucher = async (): Promise<string> => {
    if (urlVoucher) return urlVoucher;
    setEstadoVoucher("preparando");
    setErrorVoucher("");
    try {
      const resultado = await api.publica.voucher(token);
      if (resultado.estado === "listo" && resultado.url_descarga) {
        setUrlVoucher(resultado.url_descarga);
        setEstadoVoucher("listo");
        return resultado.url_descarga;
      }
      if (resultado.estado === "error") {
        setEstadoVoucher("error");
        setErrorVoucher(
          "No pudimos generar el voucher. Te lo enviamos por correo en unos minutos.",
        );
        return "";
      }
      intentosRef.current = 0;
      setEstadoVoucher("generando");
      return "";
    } catch (error) {
      setEstadoVoucher("error");
      setErrorVoucher(
        error instanceof Error && error.message
          ? error.message
          : "No pudimos generar el voucher. Te lo enviamos por correo en unos minutos.",
      );
      onReservaCerrada?.();
      return "";
    }
  };

  const descargar = async () => {
    const url = await prepararVoucher();
    if (!url) return;
    // Descarga directa: el navegador abre el visor del sistema (iOS) o el PDF.
    window.location.assign(apiAbsUrl(url));
  };

  const compartirPorWhatsApp = async () => {
    const url = await prepararVoucher();
    if (!url) return;
    const absoluta = apiAbsUrl(url);
    const mensaje = PLANTILLA_VOUCHER.replace("{nombre}", titular?.nombre ?? "")
      .replace("{tour}", salida.tour)
      .replace("{fecha}", salida.fecha ? formatDate(salida.fecha) : "")
      .replace("{ref_corta}", refCorta ?? reserva?.ref_corta ?? "");
    window.open(
      `https://wa.me/${MARCA.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`${mensaje}\n${absoluta}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  if (consultaReserva.isPending) {
    return (
      <PublicShell titulo="Reserva confirmada" nombreTour={nombreTour} refCorta={refCorta}>
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Cargando tu reserva…
        </p>
      </PublicShell>
    );
  }

  const haySaldo = Number.parseFloat(saldoUsd) > 0;

  return (
    <PublicShell
      titulo="¡Reserva confirmada!"
      subtitulo="Aquí tienes tu voucher. Guárdalo en tu teléfono o envíatelo por WhatsApp."
      nombreTour={salida.tour !== "Tu tour" ? salida.tour : nombreTour}
      refCorta={refCorta ?? reserva?.ref_corta}
    >
      <div className="flex flex-col gap-5">
        {/* Estado + código --------------------------------------------- */}
        <section className="rounded-2xl border border-success/40 bg-success/10 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <BadgeEstado
              etiqueta="Confirmado"
              tono="exito"
              icono={<BadgeCheck className="h-3 w-3" aria-hidden="true" />}
            />
            <span className="text-sm font-semibold text-foreground">
              {`Código ${reserva?.codigo ?? ""}`}
            </span>
          </div>
          {reserva?.ref_corta ? (
            <p className="mt-1 text-xs text-foreground/80">
              {`Referencia corta: ${reserva.ref_corta}`}
            </p>
          ) : null}
        </section>

        {/* Resumen de salida -------------------------------------------- */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-base font-bold text-foreground">Tu salida</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <CalendarDays
                className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div>
                <dt className="text-xs text-muted-foreground">Tour</dt>
                <dd className="font-semibold text-foreground">{salida.tour}</dd>
              </div>
            </div>
            {salida.fecha ? (
              <div className="flex items-start gap-3">
                <Clock
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-xs text-muted-foreground">Fecha y hora</dt>
                  <dd className="font-semibold text-foreground">
                    {`${formatDate(salida.fecha)}${salida.hora ? ` · ${formatTime(salida.hora)}` : ""}`}
                  </dd>
                </div>
              </div>
            ) : null}
            {salida.punto ? (
              <div className="flex items-start gap-3">
                <MapPin
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-xs text-muted-foreground">Punto de abordaje</dt>
                  <dd className="font-semibold text-foreground">
                    {salida.punto.nombre}
                    {salida.punto.hora ? ` · ${formatTime(salida.punto.hora)}` : ""}
                  </dd>
                  {salida.punto.referenciaUbicacion ? (
                    <dd className="mt-0.5 text-xs text-muted-foreground">
                      {salida.punto.referenciaUbicacion}
                    </dd>
                  ) : null}
                  {salida.punto.mapaUrl ? (
                    <a
                      href={salida.punto.mapaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Cómo llegar
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <dt className="text-xs text-muted-foreground">Pasajeros</dt>
                <dd className="font-semibold text-foreground">
                  {plural(reserva?.pasajeros.length ?? 0, "pasajero", "pasajeros")}
                </dd>
              </div>
            </div>
          </dl>
        </section>

        {/* Pasajeros ---------------------------------------------------- */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-base font-bold text-foreground">Quiénes viajan</h2>
          <ul className="mt-3 divide-y divide-border">
            {(reserva?.pasajeros ?? []).map((pasajero) => {
              // Punto efectivo de cada pasajero: el suyo (salida
              // personalizada) o el global de la reserva.
              const clave = clavePuntoDe(
                pasajero.respuestas,
                reserva?.respuestas_globales?.["punto_abordaje"],
              );
              const etiquetaPunto = clave ? (puntosDelVoucher.get(clave) ?? null) : null;
              const esInfante = pasajero.categoria === "Infante";
              return (
                <li key={pasajero.ref_cliente} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                    {iniciales(pasajero.nombre)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {pasajero.nombre || "Pasajero"}
                      {pasajero.es_titular ? (
                        <span className="font-normal text-muted-foreground"> · titular</span>
                      ) : null}
                    </p>
                    {esInfante ? (
                      <p className="text-xs font-semibold text-success">
                        Sin costo · viaja en piernas de su representante
                      </p>
                    ) : null}
                    {etiquetaPunto ? (
                      <p className="truncate text-xs font-semibold text-primary">{`Sale desde: ${etiquetaPunto}`}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Qué llevar --------------------------------------------------- */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-base font-bold text-foreground">Qué llevar</h2>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
            <li>· Documento de identidad de cada pasajero.</li>
            <li>· Ropa cómoda y liviana para el clima del día.</li>
            <li>· La medicación que uses y efectivo para gastos menores.</li>
          </ul>
        </section>

        {/* Saldo pendiente ---------------------------------------------- */}
        {haySaldo ? (
          <Banner
            variante="aviso"
            titulo={`Te falta ${formatUsd(saldoUsd)}`}
            mensaje={
              textoSaldo ??
              "Tu reserva está confirmada. Te falta el saldo; te lo pediremos por WhatsApp antes de la salida."
            }
            accion={
              onReportarPago ? (
                <button
                  type="button"
                  onClick={onReportarPago}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-input bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Reportar pago
                </button>
              ) : undefined
            }
          />
        ) : null}

        {/* Voucher ------------------------------------------------------ */}
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-base font-bold text-foreground">Tu voucher</h2>

          {estadoVoucher === "generando" ? (
            <p
              role="status"
              aria-live="polite"
              className="text-sm leading-relaxed text-muted-foreground"
            >
              Estamos generando tu voucher. Esto toma sólo unos segundos.
            </p>
          ) : null}

          {estadoVoucher === "error" ? (
            <Banner variante="aviso" titulo="Aún no está listo" mensaje={errorVoucher} />
          ) : null}

          {estadoVoucher === "por_correo" ? (
            <p
              role="status"
              aria-live="polite"
              className="flex items-start gap-2 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm font-semibold text-foreground"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              <span>{`Te enviamos el voucher a ${correoTitular || "tu correo"}.`}</span>
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void descargar()}
            disabled={estadoVoucher === "preparando" || estadoVoucher === "generando"}
            aria-busy={estadoVoucher === "preparando" || undefined}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>{estadoVoucher === "preparando" ? "Preparando…" : "Descargar voucher PDF"}</span>
          </button>

          <p className="text-xs leading-relaxed text-muted-foreground">
            En el celular el archivo se abre con el visor del sistema para que puedas guardarlo.
          </p>

          <button
            type="button"
            onClick={() => void compartirPorWhatsApp()}
            disabled={estadoVoucher === "preparando" || estadoVoucher === "generando"}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-input bg-card px-4 text-sm font-bold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            <span>Enviar por WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => setEstadoVoucher("por_correo")}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-input bg-card px-4 text-sm font-bold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span>Recibir por correo</span>
          </button>
        </section>

        {/* Cambios ------------------------------------------------------ */}
        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-base font-bold text-foreground">¿Necesitas un cambio?</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Una vez confirmada, la reserva no se edita desde aquí. Escríbenos y lo ajustamos
            contigo.
          </p>
          <BotonWhatsApp
            telefono={MARCA.whatsapp}
            mensaje={`Hola, necesito un cambio en mi reserva${(refCorta ?? reserva?.ref_corta) ? ` ${refCorta ?? reserva?.ref_corta}` : ""}.`}
            etiqueta="Escríbenos por WhatsApp"
            className="w-full"
          />
        </section>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <FileText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>El voucher es un comprobante de reserva y no sustituye la factura fiscal.</span>
        </p>
      </div>
    </PublicShell>
  );
}

// ---------------------------------------------------------------------------
// Datos de salida
// ---------------------------------------------------------------------------

interface PuntoSalida {
  nombre: string;
  hora: string;
  referenciaUbicacion?: string | undefined;
  mapaUrl?: string | undefined;
}

interface DatosSalida {
  tour: string;
  fecha: string;
  hora: string;
  punto: PuntoSalida | null;
}

const SALIDA_VACIA: DatosSalida = { tour: "Tu tour", fecha: "", hora: "", punto: null };

/**
 * Mapa `clave → etiqueta visible` de los puntos de salida, tomado del
 * formulario público (opciones seleccionables + puntos de referencia).
 *
 * Permite resolver el punto que eligió la reserva y el de cada pasajero
 * (salidas personalizadas por miembro del grupo).
 */
function mapaPuntos(reserva: ContextoReserva | null): Map<string, string> {
  const mapa = new Map<string, string>();
  const campo = reserva?.formulario?.definicion.campos.find(
    (c) => c.fuente === "puntos_salida" || c.id === "punto_abordaje",
  );
  if (!campo) return mapa;
  for (const opcion of campo.opciones ?? []) mapa.set(opcion.valor, opcion.label);
  for (const grupo of campo.puntos_referencia ?? []) {
    for (const punto of grupo.puntos) mapa.set(punto.clave, `${punto.nombre}, ${punto.hora}`);
  }
  // Pseudo-clave del selector de ciudades: el punto exacto de Caracas se
  // confirma después por WhatsApp.
  if (!mapa.has("caracas")) mapa.set("caracas", "Caracas — punto por confirmar");
  return mapa;
}

/** Clave del punto de salida de un registro (respuesta propia o global). */
function clavePuntoDe(
  respuestas: Record<string, Respuesta> | undefined,
  global: Respuesta | undefined,
): string {
  const valor = respuestas?.["punto_abordaje"] ?? global;
  return typeof valor === "string" ? valor : "";
}

/**
 * Datos del tour y de la salida.
 *
 * 1. Si el servidor adjunta el contexto (`ContextoReserva`), se usa.
 * 2. El punto mostrado es el que se registró en la reserva (titular); si no
 *    hay respuesta, se usa el primer punto del catálogo.
 * 3. En la demo la API simulada no lo adjunta: se resuelve desde la base en
 *    que ya viene serializado desde el backend.
 */
function resolverSalida(reserva: ContextoReserva | null): DatosSalida {
  if (!reserva) return SALIDA_VACIA;

  const tour: Tour | undefined = reserva.tour;
  const fecha = reserva.fecha;
  if (tour && fecha) {
    const puntos = mapaPuntos(reserva);
    const clave = clavePuntoDe(
      reserva.titular?.respuestas,
      reserva.respuestas_globales?.["punto_abordaje"],
    );
    const elegido = clave ? puntos.get(clave) : undefined;
    return {
      tour: tour.nombre,
      fecha: fecha.fecha_salida,
      hora: fecha.hora_salida,
      punto: elegido ? { nombre: elegido, hora: "" } : aPuntoSalida(tour.puntos_abordaje[0]),
    };
  }

  return SALIDA_VACIA;
}

function aPuntoSalida(punto: PuntoAbordaje | undefined): PuntoSalida | null {
  if (!punto) return null;
  return {
    nombre: punto.nombre,
    hora: punto.hora,
    ...(punto.referencia_ubicacion ? { referenciaUbicacion: punto.referencia_ubicacion } : {}),
    ...(punto.mapa_url ? { mapaUrl: punto.mapa_url } : {}),
  };
}

/** Iniciales para el avatar del pasajero. */
function iniciales(nombre: string): string {
  const partes = (nombre || "").trim().split(/\s+/).filter(Boolean);
  const primera = partes[0]?.charAt(0) ?? "";
  const segunda = partes[1]?.charAt(0) ?? "";
  return `${primera}${segunda}`.toUpperCase() || "?";
}
