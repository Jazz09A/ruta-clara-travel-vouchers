import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eraser, ShieldCheck } from "lucide-react";

import { api } from "@/lib/api";
import { esApiError } from "@/lib/domain/api";
import { MARCA } from "@/lib/brand";
import { t } from "@/lib/i18n/es";
import { nuevaClaveIdempotencia } from "../use-reserva";

import { PublicShell } from "../layout/PublicShell";
import { Banner, BotonWhatsApp, useTituloPantalla } from "../ui";
import { LienzoFirma, type LienzoFirmaRef } from "../firma/LienzoFirma";

/**
 * P-06 — Firma (Spec §5, P-06 y §7).
 *
 * Es la segunda mitad de la experiencia «leer → firmar»: P-07 deja al
 * cliente leyendo los términos y esta pantalla recoge la firma manuscrita.
 */

export interface FirmaProps {
  token: string;
  /** Versión de los términos aceptados (RF-6.1). */
  versionTerminosId: string;
  /** `true` si el cliente llegó al final del texto de los términos (RF-6.2). */
  scrollCompleto: boolean;
  /** La firma se registró: se avanza a P-08. */
  onFirmado: () => void;
  /** La respuesta del servidor trae la versión nueva: hay que adoptarla. */
  onVersionServidor?: ((version: number) => void) | undefined;
  /** Los términos cambiaron: se vuelve a P-07. */
  onVolverATerminos: () => void;
  /** Cambiaron los datos: se vuelve al resumen (P-05). */
  onVolverAlResumen: () => void;
  /** La reserva se cerró (hold vencido): se va a P-12. */
  onReservaCerrada: () => void;
  refCorta?: string | undefined;
  nombreTour?: string | undefined;
}

type Redireccion = "terminos" | "resumen" | "cerrada";

export function Firma({
  token,
  versionTerminosId,
  scrollCompleto,
  onFirmado,
  onVersionServidor,
  onVolverATerminos,
  onVolverAlResumen,
  onReservaCerrada,
  refCorta,
  nombreTour,
}: FirmaProps) {
  useTituloPantalla("Firma · Escapate Tours");

  const queryClient = useQueryClient();
  const lienzoRef = useRef<LienzoFirmaRef | null>(null);
  const claveRef = useRef<string | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [errorFirma, setErrorFirma] = useState("");
  const [ofrecerLimpiar, setOfrecerLimpiar] = useState(false);
  const [redireccion, setRedireccion] = useState<Redireccion | null>(null);

  // La reserva sirve para saber si el hold sigue vigente.
  const consulta = useQuery({
    queryKey: ["reserva", token],
    queryFn: () => api.publica.reserva(token),
    staleTime: 30_000,
  });
  const expiraEn = consulta.data?.reserva.expira_en ?? null;

  // Redirección automática tras un error que exige cambiar de pantalla.
  useEffect(() => {
    if (!redireccion) return;
    const id = window.setTimeout(() => {
      if (redireccion === "terminos") onVolverATerminos();
      if (redireccion === "resumen") onVolverAlResumen();
      if (redireccion === "cerrada") onReservaCerrada();
    }, 2200);
    return () => window.clearTimeout(id);
  }, [onReservaCerrada, onVolverAlResumen, onVolverATerminos, redireccion]);

  // Éxito: avance automático a P-08.
  useEffect(() => {
    if (!exito) return;
    const id = window.setTimeout(() => onFirmado(), 1800);
    return () => window.clearTimeout(id);
  }, [exito, onFirmado]);

  const firmar = async () => {
    if (enviando || exito) return;
    const lienzo = lienzoRef.current;
    if (!lienzo) return;

    const exportacion = lienzo.exportar();
    if (!exportacion.ok) {
      setErrorFirma(exportacion.mensaje);
      setOfrecerLimpiar(exportacion.motivo === "invalida");
      if (exportacion.motivo === "vacio") lienzo.enfocar();
      return;
    }

    // La clave se genera en el clic y se reutiliza en los reintentos (§8.2).
    if (!claveRef.current) claveRef.current = nuevaClaveIdempotencia();

    setEnviando(true);
    setErrorFirma("");
    setOfrecerLimpiar(false);

    try {
      const respuesta = await api.publica.firmar(
        token,
        {
          firma_png_base64: exportacion.resultado.png_base64,
          n_trazos: exportacion.resultado.metricas.n_trazos,
          longitud_px: exportacion.resultado.metricas.longitud_px,
          duracion_ms: exportacion.resultado.metricas.duracion_ms,
          scroll_completo: scrollCompleto,
          version_terminos_id: versionTerminosId,
        },
        claveRef.current,
      );
      claveRef.current = null;
      // La firma incrementó la versión en el servidor: adoptarla ya
      // (con la actualización de la consulta puede llegar tarde de más).
      onVersionServidor?.(respuesta.version);
      setExito(true);
      void queryClient.invalidateQueries({ queryKey: ["reserva", token] });
    } catch (error) {
      if (esApiError(error)) {
        switch (error.codigo) {
          case "FIRMA_INVALIDA": {
            setErrorFirma(error.mensajeMostrable);
            setOfrecerLimpiar(true);
            break;
          }
          case "VALIDACION": {
            // Casi siempre: el cliente no llegó al final de los términos.
            setErrorFirma(error.mensajeMostrable);
            // Si los términos ya se aceptaron en esta sesión no se rebota a
            // esa pantalla: cambiar de pantalla descartaría el dibujo sin
            // resolver nada (y el backend ya tiene esa aceptación registrada).
            if (!scrollCompleto) setRedireccion("terminos");
            break;
          }
          case "CONTENIDO_CAMBIO": {
            setErrorFirma("Tus datos cambiaron mientras firmabas. Revisa el resumen");
            setRedireccion("resumen");
            break;
          }
          case "TERMINOS_ACTUALIZADOS": {
            setErrorFirma("Actualizamos los términos; léelos de nuevo");
            setRedireccion("terminos");
            break;
          }
          case "RESERVA_CERRADA": {
            setErrorFirma("Esta reserva ya está cerrada.");
            setRedireccion("cerrada");
            break;
          }
          case "VERSION_DESACTUALIZADA": {
            setErrorFirma("Se actualizó en otro dispositivo. Revisamos tus datos");
            void queryClient.invalidateQueries({ queryKey: ["reserva", token] });
            break;
          }
          default: {
            if (error.status === 410) {
              setErrorFirma("Tu cupo se liberó porque venció el tiempo.");
              setRedireccion("cerrada");
            } else {
              setErrorFirma(error.mensajeMostrable);
            }
          }
        }
      } else {
        setErrorFirma("No pudimos enviar tu firma. Revisa tu conexión e inténtalo de nuevo.");
      }
    } finally {
      setEnviando(false);
    }
  };

  if (exito) {
    return (
      <PublicShell titulo="Registro completo" nombreTour={nombreTour} refCorta={refCorta}>
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-4 rounded-2xl border border-success/40 bg-success/10 px-5 py-8 text-center"
        >
          <CheckCircle2 className="h-12 w-12 text-success" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-extrabold text-foreground">¡Registro completo!</h2>
            <p className="mt-1 text-sm leading-relaxed text-foreground/80">
              Firmaste los términos y condiciones. Te enviamos un correo de confirmación con el
              resumen de tu reserva.
            </p>
          </div>
          <button
            type="button"
            onClick={onFirmado}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Continuar con el pago
          </button>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      titulo="Firma"
      subtitulo="Dibuja tu firma con el dedo o el mouse. Puedes girar el teléfono para tener más espacio."
      pasoActual="firma"
      nombreTour={nombreTour}
      refCorta={refCorta}
      expiraEn={expiraEn}
      accionPrincipal={{
        etiqueta: "Firmar y continuar",
        onClick: () => void firmar(),
        loading: enviando,
      }}
    >
      <div className="flex flex-col gap-5">
        {/* Declaración de RF-6.5: visible y no editable. */}
        <p className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-bold leading-relaxed text-foreground">
          {t("firmo_en_nombre")}
        </p>

        {errorFirma ? (
          <Banner variante="urgencia" titulo="No pudimos registrar tu firma" mensaje={errorFirma} />
        ) : null}

        {redireccion ? (
          <Banner
            variante="info"
            mensaje={
              redireccion === "resumen"
                ? "Te llevamos al resumen para que revises los cambios."
                : redireccion === "terminos"
                  ? "Te llevamos a los términos para que los leas de nuevo."
                  : "Te llevamos al estado de tu reserva."
            }
          />
        ) : null}

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-base font-bold text-foreground">Tu firma</h2>
          <p className="mt-0.5 mb-3 text-xs leading-relaxed text-muted-foreground">
            Firma dentro del recuadro. Cuanto más grande y lenta, más fácil es validar tu firma.
          </p>
          <LienzoFirma ref={lienzoRef} bloqueado={enviando} />
        </section>

        {ofrecerLimpiar ? (
          <button
            type="button"
            onClick={() => {
              lienzoRef.current?.limpiar();
              setOfrecerLimpiar(false);
              setErrorFirma("");
              lienzoRef.current?.enfocar();
            }}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-input bg-card px-4 text-sm font-bold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Eraser className="h-4 w-4" aria-hidden="true" />
            <span>Borrar la firma y empezar de nuevo</span>
          </button>
        ) : null}

        {/* Accesibilidad: la firma manuscrita no tiene equivalente de teclado (§7.3). */}
        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold text-foreground">¿No puedes firmar en pantalla?</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Podemos tomar tu firma por otro medio. Escríbenos y lo resolvemos contigo.
          </p>
          <BotonWhatsApp
            telefono={MARCA.whatsapp}
            mensaje={`Hola, no puedo firmar en pantalla. Necesito ayuda con mi reserva${refCorta ? ` ${refCorta}` : ""}.`}
            etiqueta="Contactar a la agencia"
            className="w-full"
          />
        </section>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Tu firma se usa sólo para confirmar esta reserva. No se guarda en este dispositivo: se
            envía y se descarta de la memoria.
          </span>
        </p>
      </div>
    </PublicShell>
  );
}
