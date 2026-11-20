import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, WifiOff } from "lucide-react";

import { Toaster } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { esApiError } from "@/lib/domain/api";
import type { PasoActual, ResumenReserva } from "@/lib/domain/types";
import { ETAPAS_RESERVA, MARCA } from "@/lib/brand";
import { formatCountdown } from "@/lib/format";
import { api } from "@/lib/api";

import { PublicShell } from "@/components/publica/layout/PublicShell";
import { nuevaClaveIdempotencia, useReserva } from "@/components/publica/use-reserva";
import { Bienvenida, type CategoriaConEdad } from "@/components/publica/screens/Bienvenida";
import { Titular } from "@/components/publica/screens/Titular";
import { Acompanantes } from "@/components/publica/screens/Acompanantes";
import { Preguntas } from "@/components/publica/screens/Preguntas";
import {
  Confirmacion,
  type ResultadoConfirmacion,
} from "@/components/publica/screens/Confirmacion";
import { Terminos, type AceptacionTerminos } from "@/components/publica/screens/Terminos";
import { Firma } from "@/components/publica/screens/Firma";
import { Voucher } from "@/components/publica/screens/Voucher";
import { EstadoBloqueante } from "@/components/publica/screens/EstadoBloqueante";
import { EnlaceInvalido, EnlaceVencido } from "@/components/publica/screens/pantallas";
import { useTituloPantalla } from "@/components/publica/ui/hooks";

export const Route = createFileRoute("/r/$token")({
  head: () => ({
    meta: [
      { title: "Completa tu reserva · Ruta Clara" },
      { name: "description", content: "Registra a tu grupo y confirma tu reserva en minutos." },
      // SEG-16: estas rutas nunca se indexan.
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Completa tu reserva · Ruta Clara" },
      {
        property: "og:description",
        content: "Registra a tu grupo y confirma tu reserva en minutos.",
      },
    ],
  }),
  component: PublicEntry,
  notFoundComponent: NotFoundPublico,
  errorComponent: ErrorPublico,
});

const CLAVE_ENLACE = "ruta_clara_enlace";

/** Pantallas del flujo público. Sin paso de pago: la firma confirma la
 *  reserva y genera el voucher (el pago se registra al crear el enlace). */
type Pantalla =
  | "bienvenida"
  | "titular"
  | "acompanantes"
  | "preguntas"
  | "resumen"
  | "terminos"
  | "firma"
  | "confirmada"
  | "cerrada";

const PANTALLA_POR_PASO: Record<PasoActual, Pantalla> = {
  paso_registro: "bienvenida",
  titular: "titular",
  acompanantes: "acompanantes",
  preguntas: "preguntas",
  resumen: "resumen",
  terminos: "terminos",
  firma: "firma",
  confirmada: "confirmada",
  cerrada: "cerrada",
};

const ORDEN_ETAPAS = ["titular", "acompanantes", "preguntas", "resumen", "terminos", "firma"];

const TITULO_POR_PANTALLA: Record<Pantalla, string> = {
  bienvenida: "Revisa tu salida",
  titular: "Datos del titular",
  acompanantes: "Tu grupo",
  preguntas: "Preguntas del tour",
  resumen: "Resumen de tu reserva",
  terminos: "Términos y condiciones",
  firma: "Firma",
  confirmada: "¡Reserva confirmada!",
  cerrada: "Reserva cerrada",
};

function PublicEntry() {
  const { token } = Route.useParams();

  // El token se quita de la barra de direcciones de inmediato y vive en
  // memoria + sessionStorage (Spec §4.1, SEG-02). Se conserva el estado del
  // historial para no romper el router.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(CLAVE_ENLACE, token);
      // NOTA: En producción, reemplazar el historial para ocultar el token.
      // En demo, lo dejamos visible para facilitar pruebas.
      // if (window.location.pathname.includes(token)) {
      //   window.history.replaceState(window.history.state, "", "/r/");
      // }
    } catch {
      // Si el almacenamiento no está disponible se sigue funcionando igual.
    }
  }, [token]);

  return (
    <>
      <ArranquePublico token={token} />
      <Toaster position="top-center" richColors closeButton />
    </>
  );
}

function ArranquePublico({ token }: { token: string }) {
  const {
    reserva,
    progreso,
    version,
    cargando,
    error,
    recargar,
    estadoGuardado,
    conectado,
    iniciar,
    guardarTitular,
    guardarAcompanantes,
    guardarRespuestas,
    completarPaso,
    sincronizarVersion,
  } = useReserva(token);

  const queryClient = useQueryClient();
  const [pasoForzado, setPasoForzado] = useState<Pantalla | null>(null);
  const [errorPaso, setErrorPaso] = useState<string | null>(null);
  const [continuarCargando, setContinuarCargando] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [errorInicio, setErrorInicio] = useState<string | null>(null);
  const [intentosCaptcha, setIntentosCaptcha] = useState(0);
  const claveConfirmarRef = useRef<string | null>(null);

  // Estado para términos y firma
  const [aceptacionTerminos, setAceptacionTerminos] = useState<AceptacionTerminos | null>(null);
  const [precargaPago, setPrecargaPago] = useState<
    Partial<import("@/lib/domain/api").ReportePago> | undefined
  >(undefined);

  const continuarRef = useRef<(() => void) | null>(null);
  const registrarContinuar = useCallback((accion: () => void) => {
    continuarRef.current = accion;
  }, []);

  const pasoServidor = progreso ? PANTALLA_POR_PASO[progreso.paso_actual] : "bienvenida";
  const pantalla: Pantalla = pasoForzado ?? pasoServidor;

  // Limpiar paso forzado cuando el servidor indica un paso diferente.
  // Excepciones: desvíos locales dentro del flujo de firma/pago — el servidor
  // permanece en su paso mientras el cliente resuelve un sub-paso:
  //  - «terminos» dentro de «firma» (los términos se exigen al firmar).
  //  - «pago» desde «verificacion»/«confirmada» (reportar el resto o pagar de nuevo).
  //  - «confirmada» desde «verificacion» (el voucher aparece al aprobarse el pago).
  //  - «cerrada» siempre manda: la reserva cerrada es terminal.
  useEffect(() => {
    if (!pasoForzado || !pasoServidor) return;
    const esDesvioLocal =
      (pasoForzado === "terminos" && pasoServidor === "firma") ||
      (pasoForzado === "pago" &&
        (pasoServidor === "verificacion" || pasoServidor === "confirmada")) ||
      (pasoForzado === "confirmada" && pasoServidor === "verificacion") ||
      pasoForzado === "cerrada";
    if (!esDesvioLocal && pasoForzado !== pasoServidor) {
      setPasoForzado(null);
    }
  }, [pasoForzado, pasoServidor]);

  useTituloPantalla(`${TITULO_POR_PANTALLA[pantalla]} · ${MARCA.nombre}`);

  const fechaSalida = reserva?.fecha?.fecha_salida;

  // Solo la pantalla de confirmación necesita el resumen (el total lo fija
  // la agencia); el resto del flujo no consulta precios.
  const resumenQuery = useQuery<ResumenReserva>({
    queryKey: ["resumen", token],
    queryFn: () => api.publica.resumen(token),
    enabled: pantalla === "resumen",
    staleTime: 30_000,
    retry: false,
  });

  const categorias: CategoriaConEdad[] = useMemo(() => {
    // El precio ya no viaja al cliente: solo la categoría y su rango de edad.
    return (reserva?.tarifas ?? []).map((tarifa) => ({
      categoria: tarifa.categoria,
      edad_min: tarifa.edad_min,
      edad_max: tarifa.edad_max,
    }));
  }, [reserva?.tarifas]);

  const config = reserva?.config;
  const maxPasajeros = config?.max_pasajeros_reserva ?? 10;
  const documentoMenores = config?.documento_menores ?? "opcional";
  const requiereAutorizacion = config?.Requires_autorizacion_menores ?? false;
  // Reporte de pago del cliente (flag global). Si está apagado, la agencia
  // anota los datos del pago desde el panel y el formulario no pide nada.
  const reportePagoActivo = config?.reporte_pago_cliente === true;

  // --- Cargas iniciales y errores de arranque --------------------------------
  if (cargando && !reserva) {
    return <EsqueletoArranque />;
  }

  if (error && !reserva) {
    if (esApiError(error) && error.codigo === "ENLACE_INVALIDO") {
      return (
        <PantallaBloqueada titulo="Este enlace no es válido">
          <EnlaceInvalido />
        </PantallaBloqueada>
      );
    }
    if (esApiError(error) && error.codigo === "ENLACE_VENCIDO") {
      return (
        <PantallaBloqueada titulo="Tu enlace venció">
          <EnlaceVencido />
        </PantallaBloqueada>
      );
    }
    if (esApiError(error) && error.status === 429) {
      return <PantallaEspera segundos={45} onReintentar={recargar} />;
    }
    return (
      <PantallaBloqueada titulo="No pudimos cargar tu reserva">
        <EstadoBloqueante
          titulo="No pudimos conectar"
          mensaje={
            <p>
              No pudimos cargar tu reserva. Revisa tu internet y vuelve a intentarlo. Tus datos no
              se han perdido.
            </p>
          }
          accion={{ etiqueta: "Reintentar", onClick: recargar }}
          whatsappMensaje="Hola, no puedo abrir mi enlace de reserva."
        />
      </PantallaBloqueada>
    );
  }

  if (!reserva || !progreso) {
    return <EsqueletoArranque />;
  }

  // --- Reserva cerrada --------------------------------------------------------
  if (progreso.cerrada || pasoServidor === "cerrada") {
    const motivo = progreso.motivo_cierre ?? reserva.motivo_cierre;
    return (
      <PantallaBloqueada titulo="Reserva cerrada">
        <EstadoBloqueante
          titulo={tituloDeCierre(motivo)}
          mensaje={<p>{mensajeDeCierre(motivo)}</p>}
          motivo={motivo}
          whatsappMensaje={`Hola, mi reserva ${reserva.ref_corta} aparece como cerrada. ¿Qué puedo hacer?`}
          tono="aviso"
        />
      </PantallaBloqueada>
    );
  }

  // --- Navegación -------------------------------------------------------------
  const etapaActual = ETAPAS_RESERVA.find((etapa) => etapa.id === pasoServidor)?.id;

  const irAPaso = (id: string) => {
    const destino = PANTALLA_POR_PASO[id as PasoActual];
    if (!destino) return;
    setErrorPaso(null);
    setPasoForzado(destino);
  };

  const atras = () => {
    const indice = ORDEN_ETAPAS.indexOf(etapaActual ?? "");
    if (indice <= 0) return;
    const anterior = ORDEN_ETAPAS[indice - 1];
    if (anterior) irAPaso(anterior);
  };

  /** Completa un paso en el servidor. Devuelve `true` si lo aceptó. */
  const avanzar = async (paso: string, payload: Record<string, unknown> = {}): Promise<boolean> => {
    setContinuarCargando(true);
    setErrorPaso(null);
    try {
      await completarPaso(paso, payload);
      setPasoForzado(null);
      return true;
    } catch (error) {
      // Si el servidor detalló los campos (p. ej. falta la foto del
      // documento), se muestra el mensaje específico en vez del genérico.
      const detalle =
        esApiError(error) && error.detalles?.length ? (error.detalles[0]?.mensaje ?? null) : null;
      setErrorPaso(detalle ?? mensajeDeError(error));
      return false;
    } finally {
      setContinuarCargando(false);
    }
  };

  const comenzar = async () => {
    setIniciando(true);
    setErrorInicio(null);
    try {
      await iniciar();
    } catch (error) {
      if (esApiError(error) && error.codigo === "CAPTCHA_FALLIDO") {
        setIntentosCaptcha((valor) => valor + 1);
        setErrorInicio("No pudimos verificar que eres una persona. Intenta de nuevo");
      } else if (
        esApiError(error) &&
        (error.codigo === "FECHA_CERRADA" || error.codigo === "CORTE_VENTA_CUMPLIDO")
      ) {
        setErrorInicio(error.mensajeMostrable);
      } else {
        setErrorInicio(mensajeDeError(error));
      }
    } finally {
      setIniciando(false);
    }
  };

  const confirmarResumen = async (
    totalVistoUsd: string,
    aceptaPolitica: boolean,
  ): Promise<ResultadoConfirmacion> => {
    // La clave se genera en el clic y se reutiliza si hay que reintentar.
    if (!claveConfirmarRef.current) claveConfirmarRef.current = nuevaClaveIdempotencia();
    try {
      const respuesta = await api.publica.confirmarResumen(
        token,
        { total_visto_usd: totalVistoUsd, version, acepta_politica: aceptaPolitica },
        claveConfirmarRef.current,
      );
      claveConfirmarRef.current = null;
      // La confirmación incrementó la versión en el servidor y la respuesta
      // la trae. Sin sincronizarla aquí, la siguiente escritura (términos)
      // viaja con la versión vieja y falla con 409 («otro dispositivo»).
      sincronizarVersion(respuesta.version);
      setPasoForzado(null);
      // El paso cambió en el servidor (resumen → firma): refrescar de
      // inmediato para que la UI avance al primer clic.
      await queryClient.invalidateQueries({ queryKey: ["reserva", token] });
      return { ok: true };
    } catch (error) {
      if (esApiError(error)) {
        if (error.codigo === "PRECIO_CAMBIO") {
          const nuevo = error.data?.["total_usd"];
          return {
            ok: false,
            codigo: error.codigo,
            mensaje: error.mensajeMostrable,
            nuevoTotalUsd: typeof nuevo === "string" ? nuevo : undefined,
          };
        }
        return { ok: false, codigo: error.codigo, mensaje: error.mensajeMostrable };
      }
      return { ok: false, codigo: "ERROR_INTERNO", mensaje: mensajeDeError(error) };
    }
  };

  const mensajeWhatsapp = `Hola, necesito ayuda con mi reserva ${reserva.ref_corta}`;

  const contenido = () => {
    switch (pantalla) {
      case "bienvenida":
        return (
          <Bienvenida
            reserva={reserva}
            onComenzar={() => void comenzar()}
            iniciando={iniciando}
            errorInicio={errorInicio}
            intentosCaptcha={intentosCaptcha}
          />
        );

      case "titular":
        return (
          <Titular
            reserva={reserva}
            token={token}
            fechaSalida={fechaSalida}
            onGuardar={guardarTitular}
            onContinuar={() => void avanzar("titular")}
            registrarContinuar={registrarContinuar}
            errorServidor={errorPaso ?? undefined}
          />
        );

      case "acompanantes":
        return (
          <Acompanantes
            reserva={reserva}
            fechaSalida={fechaSalida}
            categorias={categorias}
            maxPasajeros={maxPasajeros}
            documentoMenores={documentoMenores}
            requiereAutorizacionMenores={requiereAutorizacion}
            onGuardar={guardarAcompanantes}
            onContinuar={() => void avanzar("acompanantes")}
            registrarContinuar={registrarContinuar}
            errorServidor={errorPaso ?? undefined}
          />
        );

      case "preguntas":
        return (
          <Preguntas
            campos={reserva.formulario?.definicion.campos ?? []}
            pasajeros={reserva.pasajeros}
            respuestas={{
              por_pasajero: Object.fromEntries(
                reserva.pasajeros.map((pasajero) => [
                  pasajero.ref_cliente,
                  pasajero.respuestas ?? {},
                ]),
              ),
              globales: reserva.respuestas_globales ?? {},
            }}
            agotadas={reserva.opciones_agotadas}
            onCambiar={(respuestas) => void guardarRespuestas(respuestas)}
            onGuardar={(respuestas) => void guardarRespuestas(respuestas)}
            onContinuar={() => void avanzar("preguntas")}
            registrarContinuar={registrarContinuar}
            errorServidor={errorPaso ?? undefined}
          />
        );

      case "resumen":
        return (
          <Confirmacion
            reserva={reserva}
            resumen={resumenQuery.data ?? null}
            campos={reserva.formulario?.definicion.campos ?? []}
            cargando={resumenQuery.isPending}
            errorResumen={
              errorPaso ?? (resumenQuery.error ? mensajeDeError(resumenQuery.error) : null)
            }
            onEditar={irAPaso}
            onConfirmar={confirmarResumen}
            registrarContinuar={registrarContinuar}
            confirmando={continuarCargando}
            soloLectura={reserva.estado !== "en_registro" && reserva.estado !== "enlace_creado"}
          />
        );

      case "terminos":
        return (
          <Terminos
            token={token}
            onAceptar={async (aceptacion) => {
              // La aceptación sólo se adopta si el servidor la guardó: si
              // falla, la pantalla de términos se queda abierta con el error.
              // El servidor espera snake_case en `scroll_completo`; la UI
              // maneja `scrollCompleto` (AceptacionTerminos).
              const ok = await avanzar("terminos", {
                scroll_completo: aceptacion.scrollCompleto,
                versionTerminosId: aceptacion.versionTerminosId,
              });
              if (ok) setAceptacionTerminos(aceptacion);
            }}
            onAtras={() => irAPaso("resumen")}
            errorServidor={errorPaso ?? undefined}
            refCorta={reserva.ref_corta}
            nombreTour={reserva.tour?.nombre}
          />
        );

      case "firma": {
        // P-07 (leer y aceptar los términos) es previo a P-08 (firmar), pero
        // el servidor pasa directo de «resumen» a «firma»: sin este paso la
        // primera firma salía siempre con `scroll_completo=false` y el backend
        // la rechazaba con 422, devolviendo al cliente a los términos y
        // perdiendo el dibujo.
        //
        // Si los términos ya se aceptaron en una sesión anterior, la reserva
        // trae `terminos_version_id` y se firma directo (el backend acepta esa
        // evidencia registrada).
        const terminosAceptados =
          Boolean(aceptacionTerminos) || Boolean(reserva.terminos_version_id);

        if (!terminosAceptados) {
          return (
            <Terminos
              token={token}
              onAceptar={async (aceptacion) => {
                const ok = await avanzar("terminos", {
                  scroll_completo: aceptacion.scrollCompleto,
                  versionTerminosId: aceptacion.versionTerminosId,
                });
                if (ok) setAceptacionTerminos(aceptacion);
              }}
              onAtras={() => irAPaso("resumen")}
              errorServidor={errorPaso ?? undefined}
              refCorta={reserva.ref_corta}
              nombreTour={reserva.tour?.nombre}
            />
          );
        }

        return (
          <Firma
            token={token}
            // Si los términos se aceptaron en otra sesión (recarga, otro
            // dispositivo) el valor local no existe: vale el que la reserva
            // registró en el servidor.
            versionTerminosId={
              aceptacionTerminos?.versionTerminosId ?? reserva.terminos_version_id ?? ""
            }
            scrollCompleto={aceptacionTerminos?.scrollCompleto ?? false}
            onFirmado={() => {
              void queryClient.invalidateQueries({ queryKey: ["reserva", token] });
              setPasoForzado(null);
            }}
            onVersionServidor={sincronizarVersion}
            onVolverATerminos={() => setPasoForzado("terminos")}
            onVolverAlResumen={() => irAPaso("resumen")}
            onReservaCerrada={() => setPasoForzado("cerrada")}
            refCorta={reserva.ref_corta}
            nombreTour={reserva.tour?.nombre}
          />
        );
      }

      case "pago":
        // Con el reporte desactivado, este paso sólo informa: la agencia es
        // quien coordina el pago con el cliente fuera del formulario.
        if (!reportePagoActivo) {
          return (
            <PagoCoordina
              token={token}
              refCorta={reserva.ref_corta}
              nombreTour={reserva.tour?.nombre}
              telefonoWhatsapp={config?.agencia_whatsapp ?? MARCA.whatsapp}
            />
          );
        }
        return (
          <Pago
            token={token}
            onReportado={() => setPasoForzado("verificacion")}
            onReservaCerrada={() => setPasoForzado("cerrada")}
            refCorta={reserva.ref_corta}
            nombreTour={reserva.tour?.nombre}
            precarga={precargaPago}
          />
        );

      case "verificacion":
        return (
          <VerificacionPago
            token={token}
            permiteReportar={reportePagoActivo}
            onConfirmada={() => setPasoForzado("confirmada")}
            onVolverAPago={() => {
              setPrecargaPago(undefined);
              setPasoForzado("pago");
            }}
            onReservaCerrada={() => setPasoForzado("cerrada")}
            refCorta={reserva.ref_corta}
            nombreTour={reserva.tour?.nombre}
          />
        );

      case "confirmada":
        return (
          <Voucher
            token={token}
            onReportarPago={
              reportePagoActivo
                ? () => {
                    setPrecargaPago(undefined);
                    setPasoForzado("pago");
                  }
                : undefined
            }
            textoSaldo={
              reportePagoActivo
                ? undefined
                : "Tu reserva está confirmada. La agencia se pondrá en contacto contigo para coordinar el pago."
            }
            onReservaCerrada={() => setPasoForzado("cerrada")}
            refCorta={reserva.ref_corta}
            nombreTour={reserva.tour?.nombre}
          />
        );

      default:
        return (
          <EstadoBloqueante
            titulo={TITULO_POR_PANTALLA[pantalla]}
            mensaje={
              <p>
                Estamos terminando de preparar este paso. Si necesitas continuar ahora, escríbenos y
                lo resolvemos.
              </p>
            }
            whatsappMensaje={mensajeWhatsapp}
          />
        );
    }
  };

  const accionPrincipal =
    pantalla === "titular" || pantalla === "acompanantes" || pantalla === "preguntas"
      ? {
          etiqueta: "Continuar",
          onClick: () => continuarRef.current?.(),
          loading: continuarCargando,
        }
      : undefined;

  // Los pasos terminos, firma, pago, verificacion y confirmada tienen su propio
  // PublicShell. Con el reporte de pago desactivado, «pago» se muestra dentro
  // del shell normal (junto a la barra de progreso) como una pantalla informativa.
  const pasosConShellPropio = [
    "terminos",
    "firma",
    ...(reportePagoActivo ? (["pago"] as const) : []),
    "verificacion",
    "confirmada",
  ];
  const tieneShellPropio = pasosConShellPropio.includes(pantalla as never);

  if (tieneShellPropio) {
    return <>{contenido()}</>;
  }

  return (
    <PublicShell
      titulo={TITULO_POR_PANTALLA[pantalla]}
      pasoActual={etapaActual}
      pasos={progreso.pasos}
      onNavegarPaso={irAPaso}
      onAtras={atras}
      mostrarAtras={pantalla !== "bienvenida"}
      accionPrincipal={accionPrincipal}
      nombreTour={reserva.tour?.nombre}
      fechaTour={fechaSalida}
      horaTour={reserva.fecha?.hora_salida}
      refCorta={reserva.ref_corta}
      expiraEn={reserva.expira_en}
      estadoGuardado={estadoGuardado}
      mensajeReanudacion={progreso.mensaje_reanudacion}
      onEmpezarDeCero={
        progreso.mensaje_reanudacion
          ? () => {
              setPasoForzado("bienvenida");
            }
          : undefined
      }
      whatsappMensaje={mensajeWhatsapp}
      telefonoWhatsapp={config?.agencia_whatsapp ?? MARCA.whatsapp}
    >
      {!conectado ? (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-chart-2/40 bg-chart-2/10 px-3 py-2 text-sm text-foreground">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Sin conexión — se guardará al reconectar</span>
        </p>
      ) : null}
      {contenido()}
    </PublicShell>
  );
}

/** Esqueleto con la forma de la pantalla de progreso (nunca pantalla en blanco). */
function EsqueletoArranque() {
  return (
    <div className="min-h-dvh bg-background" aria-busy="true" aria-live="polite">
      <div className="border-b border-border bg-card px-4 py-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-40" />
        <div className="mt-3 flex gap-1">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-6 rounded-full" />
          ))}
        </div>
      </div>
      <main className="mx-auto w-full max-w-lg px-4 py-6">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-4 h-24 w-full rounded-2xl" />
        <Skeleton className="mt-3 h-40 w-full rounded-2xl" />
        <Skeleton className="mt-3 h-24 w-full rounded-2xl" />
        <p className="sr-only">Cargando tu reserva…</p>
      </main>
    </div>
  );
}

/** Contenedor para las pantallas bloqueantes (enlace inválido, vencido, cerrada). */
function PantallaBloqueada({ titulo, children }: { titulo: string; children: ReactNode }) {
  useTituloPantalla(`${titulo} · ${MARCA.nombre}`);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

/** Pantalla de espera por límite de solicitudes (429). */
function PantallaEspera({
  segundos,
  onReintentar,
}: {
  segundos: number;
  onReintentar: () => void;
}) {
  const [restante, setRestante] = useState(segundos);

  useEffect(() => {
    const id = window.setInterval(() => {
      setRestante((valor) => (valor > 0 ? valor - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useTituloPantalla(`Espera un momento · ${MARCA.nombre}`);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card px-5 py-8 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-extrabold text-foreground">Espera un momento</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {`Hay muchas personas reserving en este momento. Vuelve a intentarlo en ${formatCountdown(
            restante * 1000,
          )}.`}
        </p>
        <button
          type="button"
          onClick={onReintentar}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Reintentar ahora
        </button>
      </div>
    </div>
  );
}

/** 404 propio de la app pública (en lugar del genérico del root). */
function NotFoundPublico() {
  useTituloPantalla(`Página no encontrada · ${MARCA.nombre}`);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <EstadoBloqueante
          titulo="No encontramos esta página"
          mensaje={<p>Revisa el enlace que abriste o escríbenos y te ayudamos.</p>}
          whatsappMensaje="Hola, el enlace que abrí no funciona."
        />
      </div>
    </div>
  );
}

/** Error propio de la ruta (en lugar del genérico en inglés del root). */
function ErrorPublico({ error, reset }: ErrorComponentProps) {
  useTituloPantalla(`Algo salió mal · ${MARCA.nombre}`);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <EstadoBloqueante
          titulo="Algo salió mal"
          mensaje={
            <p>
              No pudimos mostrar esta pantalla. Tus datos están guardados. Vuelve a intentarlo y si
              sigue igual, escríbenos.
            </p>
          }
          accion={{ etiqueta: "Reintentar", onClick: reset }}
          whatsappMensaje="Hola, tuve un problema al abrir mi reserva."
        />
      </div>
    </div>
  );
}

/** Mensaje legible de un error de la API (el cliente nunca ve códigos). */
function mensajeDeError(error: unknown): string {
  if (esApiError(error)) {
    if (error.codigo === "VERSION_DESACTUALIZADA") {
      return "Se actualizó en otro dispositivo. Revisamos tus datos";
    }
    if (error.codigo === "ERROR_INTERNO") {
      return "No pudimos conectar. Revisa tu internet; tus datos están guardados";
    }
    return error.mensajeMostrable;
  }
  if (error instanceof Error && error.message === "sin_conexion") {
    return "No pudimos conectar. Revisa tu internet; tus datos están guardados";
  }
  return "No pudimos completar la acción. Intenta de nuevo";
}

function tituloDeCierre(motivo: string | undefined): string {
  switch (motivo) {
    case "cancelada":
      return "Esta reserva fue cancelada";
    case "expiracion":
      return "Tu cupo se liberó porque venció el tiempo";
    case "fecha_cancelada":
      return "La salida fue cancelada";
    case "fuerza_mayor":
      return "Esta salida no se puede realizar";
    default:
      return "Esta reserva ya no está activa";
  }
}

function mensajeDeCierre(motivo: string | undefined): string {
  switch (motivo) {
    case "cancelada":
      return "Si hiciste un pago, escríbenos y te devolvemos el dinero.";
    case "expiracion":
      return "Tu cupo quedó libre porque venció el tiempo de reserva. Si ya pagaste, escríbenos y lo resolvemos.";
    case "fecha_cancelada":
      return "Escríbenos y te ayudamos a reprogramar o a devolverte el dinero.";
    default:
      return "Escríbenos y te contamos qué pasó con tu reserva.";
  }
}
