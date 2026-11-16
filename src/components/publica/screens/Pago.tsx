import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Check, CircleDollarSign, Info, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { esApiError, type ReportePago } from "@/lib/domain/api";
import type { MetodoPago, Moneda, Pago, Progreso } from "@/lib/domain/types";
import { ETIQUETA_METODO_PAGO, formatBs, formatDate, formatUsd } from "@/lib/format";
import { generarPreview } from "@/lib/imagen";
import { nuevaClaveIdempotencia } from "../use-reserva";
import type { ContextoReserva } from "../use-reserva";

import { PublicShell } from "../layout/PublicShell";
import {
  BadgeEstado,
  Banner,
  BotonCopiar,
  Campo,
  DialogoConfirmacion,
  UploadArchivo,
  useTituloPantalla,
  type TonoEstado,
} from "../ui";

/**
 * P-08 — Instrucciones de pago y reporte (Spec §5, P-08).
 *
 * El cliente ve **dónde pagar** (datos de cuenta con botón «Copiar») antes de
 * reportar el pago (RF-7.2). El servidor es la autoridad del saldo: aquí sólo
 * se muestra lo que devuelve la API.
 */

/** El cuerpo del reporte acepta además el token del captcha. */
type ReportePagoConCaptcha = ReportePago & { captcha_token?: string | undefined };

/** En la demo no hay Turnstile: el token viaja pero no se valida. */
const CAPTCHA_DEMO = "captcha-demo";

/** Abono mínimo por defecto (configuración de la agencia). */
const ABONO_MINIMO_PORCENTAJE = 50;

export interface PagoProps {
  token: string;
  /** El reporte se envió: se pasa a P-09. */
  onReportado: () => void;
  /** La reserva se cerró: se pasa a P-12. */
  onReservaCerrada: () => void;
  refCorta?: string | undefined;
  nombreTour?: string | undefined;
  /** Datos precargados (al volver de un rechazo o de una corrección). */
  precarga?: Partial<ReportePago> | undefined;
}

interface Comprobante {
  nombre: string;
  tipo: string;
  tamano: number;
  preview: string;
}

type Errores = Partial<Record<string, string>>;

const HOY = hoyEnAgencia();

export function Pago({
  token,
  onReportado,
  onReservaCerrada,
  refCorta,
  nombreTour,
  precarga,
}: PagoProps) {
  useTituloPantalla("Pago · Ruta Clara");

  const queryClient = useQueryClient();
  const claveRef = useRef<string | null>(null);

  const consultaReserva = useQuery<{ reserva: ContextoReserva; progreso: Progreso }>({
    queryKey: ["reserva", token],
    queryFn: () => api.publica.reserva(token),
    staleTime: 30_000,
  });
  const consultaResumen = useQuery({
    queryKey: ["resumen", token],
    queryFn: () => api.publica.resumen(token),
    staleTime: 30_000,
  });
  const consultaMetodos = useQuery({
    queryKey: ["metodos-pago", token],
    queryFn: () => api.publica.metodosPago(token),
    staleTime: 30_000,
  });
  const consultaPagos = useQuery({
    queryKey: ["pagos", token],
    queryFn: () => api.publica.pagos(token),
    staleTime: 15_000,
  });

  const reserva = consultaReserva.data?.reserva ?? null;
  const resumen = consultaResumen.data ?? null;
  const metodosDisponibles = consultaMetodos.data?.metodos ?? [];
  const tasa = consultaMetodos.data?.tasa_vigente ?? null;
  const pagos = consultaPagos.data ?? [];

  // Sin tasa vigente no se pueden mostrar los métodos en bolívares.
  const hayMetodosEnBs = metodosDisponibles.some((item) => item.moneda === "VES");
  const sinTasa = hayMetodosEnBs && !tasa;
  const metodos = useMemo(
    () =>
      sinTasa ? metodosDisponibles.filter((item) => item.moneda === "USD") : metodosDisponibles,
    [metodosDisponibles, sinTasa],
  );

  const totalUsd = resumen?.total_usd ?? reserva?.total_usd ?? "0.00";
  const saldoUsd = resumen?.saldo_usd ?? reserva?.saldo_usd ?? "0.00";
  const saldoBs = tasa ? multiplicar(saldoUsd, tasa.valor) : null;
  const abonoMinimo = multiplicar(totalUsd, String(ABONO_MINIMO_PORCENTAJE / 100));

  const [metodoId, setMetodoId] = useState("");
  const metodo = metodos.find((item) => item.id === metodoId) ?? null;

  const [monto, setMonto] = useState("");
  const [fechaPago, setFechaPago] = useState(HOY);
  const [referencia, setReferencia] = useState("");
  const [camposExtra, setCamposExtra] = useState<Record<string, string>>({});
  const [comprobante, setComprobante] = useState<Comprobante | null>(null);
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);
  const [errorServidor, setErrorServidor] = useState("");
  const [anuncio, setAnuncio] = useState("");
  const [dialogoTasa, setDialogoTasa] = useState<{ montoBs: string; tasaId: string } | null>(null);

  // Si no hay método elegido (o el elegido ya no existe), se toma el primero.
  useEffect(() => {
    if (metodoId && metodos.some((item) => item.id === metodoId)) return;
    const primero = metodos[0];
    if (primero) setMetodoId(primero.id);
  }, [metodoId, metodos]);

  // Precarga (reporte de nuevo / corrección solicitada).
  const precargaAplicada = useRef(false);
  useEffect(() => {
    if (precargaAplicada.current || !precarga) return;
    precargaAplicada.current = true;
    if (precarga.metodo) setMetodoId(precarga.metodo);
    if (precarga.referencia) setReferencia(precarga.referencia);
    if (precarga.fecha_pago) setFechaPago(precarga.fecha_pago);
  }, [precarga]);

  // Monta el saldo del método elegido como monto inicial (editable).
  const montoInicialAplicado = useRef(false);
  useEffect(() => {
    if (montoInicialAplicado.current) return;
    if (!metodo || saldoUsd === "0.00") return;
    montoInicialAplicado.current = true;
    setMonto(metodo.moneda === "VES" ? (saldoBs ?? "") : saldoUsd);
  }, [metodo, saldoBs, saldoUsd]);

  const cambiarMetodo = (id: string) => {
    const nuevo = metodos.find((item) => item.id === id);
    setMetodoId(id);
    setCamposExtra({});
    setComprobante(null);
    setErrores({});
    if (nuevo) {
      setMonto(nuevo.moneda === "VES" ? (saldoBs ?? "") : saldoUsd);
    }
  };

  const montoEnUsd = useMemo(() => {
    const valor = Number.parseFloat(monto.replace(",", "."));
    if (Number.isNaN(valor)) return 0;
    if (metodo?.moneda === "VES") {
      const tasaValor = Number.parseFloat(tasa?.valor ?? "0");
      if (!tasaValor) return 0;
      return valor / tasaValor;
    }
    return valor;
  }, [metodo, monto, tasa]);

  const camposExtraNecesarios = useMemo(() => {
    if (!metodo) return [] as string[];
    return metodo.campos_requeridos.filter(
      (campo) => campo !== "referencia" && campo !== "fecha_pago" && campo !== "monto_ves",
    );
  }, [metodo]);

  const referenciaRequerida = metodo?.campos_requeridos.includes("referencia") ?? false;

  // -------------------------------------------------------------------------
  // Validación (UX-13: al salir del campo y al avanzar)
  // -------------------------------------------------------------------------

  const validarCampo = (campo: string): string | undefined => {
    switch (campo) {
      case "monto":
        return validarMonto(monto, metodo?.moneda, tasa?.valor, totalUsd);
      case "fecha_pago": {
        if (!fechaPago) return "Elige la fecha en que hiciste el pago";
        if (fechaPago > HOY) return "La fecha del pago no puede ser futura";
        return undefined;
      }
      case "referencia": {
        if (referenciaRequerida && !referencia.trim()) {
          return "Escribe la referencia de tu pago";
        }
        return undefined;
      }
      case "comprobante": {
        if (metodo?.requiere_comprobante && !comprobante) {
          return "Adjunta el comprobante para que podamos validarlo";
        }
        return undefined;
      }
      default: {
        if (camposExtraNecesarios.includes(campo) && !camposExtra[campo]?.trim()) {
          return `Escribe ${etiquetaCampo(campo).toLowerCase()}`;
        }
        return undefined;
      }
    }
  };

  const validarTodo = (): Errores => {
    const nuevos: Errores = {};
    const campos = ["monto", "fecha_pago", "referencia", "comprobante", ...camposExtraNecesarios];
    for (const campo of campos) {
      const mensaje = validarCampo(campo);
      if (mensaje) nuevos[campo] = mensaje;
    }
    return nuevos;
  };

  const marcarTocado = (campo: string) => {
    const mensaje = validarCampo(campo);
    setErrores((previos) => ({ ...previos, [campo]: mensaje }));
  };

  // -------------------------------------------------------------------------
  // Envío
  // -------------------------------------------------------------------------

  const construirCuerpo = (tasaIdVisto: string | undefined): ReportePagoConCaptcha => {
    const valor = Number.parseFloat(monto.replace(",", ".") || "0");
    const cuerpo: ReportePagoConCaptcha = {
      metodo: metodo?.id ?? "",
      monto:
        metodo?.moneda === "VES"
          ? montoEnUsd.toFixed(2)
          : (Number.isNaN(valor) ? 0 : valor).toFixed(2),
      moneda: metodo?.moneda ?? "USD",
      fecha_pago: fechaPago,
      referencia: referencia.trim(),
      captcha_token: CAPTCHA_DEMO,
    };

    if (comprobante) {
      cuerpo.comprobante_nombre = comprobante.nombre;
      cuerpo.comprobante_tipo = comprobante.tipo;
      cuerpo.comprobante_tamano = comprobante.tamano;
      if (comprobante.preview) cuerpo.comprobante_preview = comprobante.preview;
    }

    const extra: Record<string, string> = { ...camposExtra };
    if (metodo?.moneda === "VES") extra["monto_ves"] = monto;
    if (Object.keys(extra).length > 0) cuerpo.campos_extra = extra;

    if (tasaIdVisto) cuerpo.tasa_id_vista = tasaIdVisto;

    return cuerpo;
  };

  const enviar = async (tasaIdVisto?: string) => {
    if (enviando) return;

    const nuevosErrores = validarTodo();
    setErrores(nuevosErrores);

    if (Object.keys(nuevosErrores).length > 0) {
      const cantidad = Object.keys(nuevosErrores).length;
      setAnuncio(`Hay ${cantidad} ${cantidad === 1 ? "campo" : "campos"} por corregir`);
      const primero = Object.keys(nuevosErrores)[0];
      if (primero) {
        window.requestAnimationFrame(() => {
          const control = document.getElementById(`pago-${primero}`);
          control?.scrollIntoView({ block: "center" });
          control?.focus();
        });
      }
      return;
    }

    if (!claveRef.current) claveRef.current = nuevaClaveIdempotencia();

    setEnviando(true);
    setErrorServidor("");
    setAnuncio("");

    try {
      await api.publica.reportarPago(token, construirCuerpo(tasaIdVisto), claveRef.current);
      claveRef.current = null;
      void queryClient.invalidateQueries({ queryKey: ["pagos", token] });
      void queryClient.invalidateQueries({ queryKey: ["reserva", token] });
      onReportado();
    } catch (error) {
      if (esApiError(error)) {
        switch (error.codigo) {
          case "TASA_CAMBIO": {
            // El monto reportado NO cambia solo: se muestra el nuevo equivalente
            // y el cliente decide (Spec §5, P-08).
            try {
              const actualizado = await api.publica.metodosPago(token);
              const nuevaTasa = actualizado.tasa_vigente;
              if (nuevaTasa) {
                setDialogoTasa({
                  montoBs: multiplicar(saldoUsd, nuevaTasa.valor),
                  tasaId: nuevaTasa.id,
                });
              } else {
                setErrorServidor("Los pagos en bolívares no están disponibles ahora; contáctanos");
              }
            } catch {
              setErrorServidor("No pudimos actualizar la tasa. Vuelve a intentarlo.");
            }
            break;
          }
          case "RESERVA_CERRADA": {
            setErrorServidor("Esta reserva ya está cerrada.");
            onReservaCerrada();
            break;
          }
          case "VALIDACION": {
            const mapeados: Errores = {};
            for (const detalle of error.detalles ?? []) {
              mapeados[detalle.campo] = detalle.mensaje;
            }
            setErrores(mapeados);
            setErrorServidor(error.mensajeMostrable);
            break;
          }
          case "VERSION_DESACTUALIZADA": {
            setErrorServidor("Se actualizó en otro dispositivo. Revisamos tus datos");
            void queryClient.invalidateQueries({ queryKey: ["reserva", token] });
            break;
          }
          default: {
            if (error.status === 410) {
              setErrorServidor("Tu cupo se liberó porque venció el tiempo.");
              onReservaCerrada();
            } else if (error.status === 503) {
              setErrorServidor("Los pagos en bolívares no están disponibles ahora; contáctanos");
            } else {
              setErrorServidor(error.mensajeMostrable);
            }
          }
        }
      } else {
        setErrorServidor("No pudimos conectar. Revisa tu internet; lo que escribiste sigue aquí.");
      }
    } finally {
      setEnviando(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const cargando =
    consultaReserva.isPending || consultaResumen.isPending || consultaMetodos.isPending;

  if (cargando) {
    return (
      <PublicShell titulo="Instrucciones de pago" nombreTour={nombreTour} refCorta={refCorta}>
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Cargando las instrucciones de pago…
        </p>
      </PublicShell>
    );
  }

  if (consultaMetodos.isError) {
    return (
      <PublicShell titulo="Instrucciones de pago" nombreTour={nombreTour} refCorta={refCorta}>
        <Banner
          variante="urgencia"
          titulo="No pudimos cargar los métodos de pago"
          mensaje="Revisa tu conexión e inténtalo de nuevo. Si el problema sigue, escríbenos."
        />
        <button
          type="button"
          onClick={() => void consultaMetodos.refetch()}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-input bg-card px-4 text-sm font-bold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Reintentar
        </button>
      </PublicShell>
    );
  }

  const totalBs = tasa ? multiplicar(totalUsd, tasa.valor) : null;

  return (
    <PublicShell
      titulo="Instrucciones de pago"
      subtitulo="Paga por el método que prefieras y repórtalo aquí para que lo verifiquemos."
      pasoActual="pago"
      nombreTour={nombreTour}
      refCorta={refCorta}
      expiraEn={reserva?.expira_en ?? null}
      accionPrincipal={{
        etiqueta: "Reportar pago",
        onClick: () => void enviar(),
        loading: enviando,
      }}
    >
      <div className="flex flex-col gap-5">
        <p aria-live="assertive" className="sr-only">
          {anuncio}
        </p>

        {errorServidor ? (
          <Banner
            variante="urgencia"
            titulo="No pudimos registrar tu pago"
            mensaje={errorServidor}
          />
        ) : null}

        {sinTasa ? (
          <Banner
            variante="aviso"
            titulo="Pagos en bolívares no disponibles"
            mensaje="Los pagos en bolívares no están disponibles ahora; contáctanos por WhatsApp para resolverlo."
          />
        ) : null}

        {/* Saldo a pagar ------------------------------------------------- */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold text-foreground">Saldo a pagar</h2>
          <p className="mt-2 text-3xl font-extrabold leading-none text-foreground">
            {formatUsd(saldoUsd)}
          </p>
          <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between gap-3">
              <dt>Total de la reserva</dt>
              <dd className="text-right font-semibold text-foreground">{formatUsd(totalUsd)}</dd>
            </div>
            {totalBs ? (
              <div className="flex justify-between gap-3">
                <dt>Equivale en bolívares</dt>
                <dd className="text-right font-semibold text-foreground">{formatBs(totalBs)}</dd>
              </div>
            ) : null}
            {tasa ? (
              <div className="flex justify-between gap-3">
                <dt>Tasa vigente</dt>
                <dd className="text-right font-semibold text-foreground">
                  {`${formatBs(tasa.valor)} por $1 · fijada el ${formatDate(tasa.registrada_en.slice(0, 10))}`}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-chart-2/40 bg-chart-2/10 px-3 py-2 text-xs leading-relaxed text-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {`Para apartar tu cupo debes pagar al menos ${formatUsd(abonoMinimo)} (${ABONO_MINIMO_PORCENTAJE} %). Si pagas menos, tu reserva queda como pago parcial.`}
            </span>
          </p>
        </section>

        {/* Método de pago ------------------------------------------------ */}
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-bold text-foreground">Elige cómo pagar</h2>
          <div role="radiogroup" aria-label="Método de pago" className="flex flex-col gap-2">
            {metodos.map((item) => (
              <MetodoTarjeta
                key={item.id}
                metodo={item}
                seleccionado={item.id === metodoId}
                onSeleccionar={() => cambiarMetodo(item.id)}
              />
            ))}
          </div>
        </section>

        {metodo ? (
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-base font-bold text-foreground">{`Datos para ${metodo.nombre}`}</h2>
            {metodo.instrucciones ? (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {metodo.instrucciones}
              </p>
            ) : null}
            <dl className="mt-3 divide-y divide-border">
              {metodo.datos.map((dato) => (
                <div
                  key={`${dato.etiqueta}-${dato.valor}`}
                  className="flex items-center gap-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <dt className="text-xs text-muted-foreground">{dato.etiqueta}</dt>
                    <dd className="break-all text-sm font-semibold text-foreground">
                      {dato.valor}
                    </dd>
                  </div>
                  {dato.copiable ? (
                    <BotonCopiar
                      valor={dato.valor}
                      etiqueta="Copiar"
                      onCopiado={() => toast.success("Copiado")}
                      onError={() => toast.error("No pudimos copiar. Cópialo a mano.")}
                    />
                  ) : null}
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {/* Reporte ------------------------------------------------------- */}
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-base font-bold text-foreground">Reporta tu pago</h2>

          <Campo
            id="pago-monto"
            etiqueta={
              metodo?.moneda === "VES"
                ? "Monto que vas a pagar (Bs)"
                : "Monto que vas a pagar (USD)"
            }
            ayuda={
              metodo?.moneda === "VES" && tasa
                ? `Equivale a ${formatUsd(montoEnUsd)} con la tasa vigente.`
                : "Puedes reportar un abono parcial si aún no puedes pagar todo."
            }
            error={errores["monto"]}
            requerido
          >
            {(aria) => (
              <Input
                {...aria}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className="h-11 text-base"
                value={monto}
                onChange={(evento) => {
                  const nuevo = evento.target.value;
                  setMonto(nuevo);
                  if (errores["monto"]) {
                    setErrores((previos) => ({
                      ...previos,
                      monto: validarMonto(nuevo, metodo?.moneda, tasa?.valor, totalUsd),
                    }));
                  }
                }}
                onBlur={() => marcarTocado("monto")}
              />
            )}
          </Campo>

          <Campo
            id="pago-fecha_pago"
            etiqueta="Fecha del pago"
            ayuda="No puede ser una fecha futura."
            error={errores["fecha_pago"]}
            requerido
          >
            {(aria) => (
              <Input
                {...aria}
                type="date"
                max={HOY}
                className="h-11 text-base"
                value={fechaPago}
                onChange={(evento) => {
                  setFechaPago(evento.target.value);
                  if (errores["fecha_pago"]) marcarTocado("fecha_pago");
                }}
                onBlur={() => marcarTocado("fecha_pago")}
              />
            )}
          </Campo>

          <Campo
            id="pago-referencia"
            etiqueta="Referencia del pago"
            ayuda="Es el número que te dio tu banco o la aplicación con la que pagaste."
            error={errores["referencia"]}
            requerido={referenciaRequerida}
          >
            {(aria) => (
              <Input
                {...aria}
                type="text"
                autoComplete="off"
                className="h-11 text-base uppercase"
                value={referencia}
                onChange={(evento) => {
                  const nuevo = evento.target.value;
                  setReferencia(nuevo);
                  if (errores["referencia"]) {
                    setErrores((previos) => ({
                      ...previos,
                      referencia:
                        referenciaRequerida && !nuevo.trim()
                          ? "Escribe la referencia de tu pago"
                          : undefined,
                    }));
                  }
                }}
                onBlur={() => marcarTocado("referencia")}
              />
            )}
          </Campo>

          {camposExtraNecesarios.map((campo) => (
            <Campo
              key={campo}
              id={`pago-${campo}`}
              etiqueta={etiquetaCampo(campo)}
              error={errores[campo]}
              requerido
            >
              {(aria) => (
                <Input
                  {...aria}
                  type="text"
                  autoComplete="off"
                  className="h-11 text-base"
                  value={camposExtra[campo] ?? ""}
                  onChange={(evento) => {
                    const nuevo = evento.target.value;
                    setCamposExtra((previos) => ({ ...previos, [campo]: nuevo }));
                    if (errores[campo]) {
                      setErrores((previos) => ({
                        ...previos,
                        [campo]: nuevo.trim()
                          ? undefined
                          : `Escribe ${etiquetaCampo(campo).toLowerCase()}`,
                      }));
                    }
                  }}
                  onBlur={() => marcarTocado(campo)}
                />
              )}
            </Campo>
          ))}

          <div id="pago-comprobante" tabIndex={-1}>
            <UploadArchivo
              id="pago-comprobante-input"
              nombreArchivo={comprobante?.nombre}
              etiqueta="Comprobante del pago"
              ayuda={
                metodo?.requiere_comprobante
                  ? "Sube una foto o un PDF. Sin comprobante no podemos validarlo."
                  : "Opcional: adjunta una foto o un PDF para validarlo más rápido."
              }
              error={errores["comprobante"]}
              onSeleccionar={(archivo) => {
                void construirComprobante(archivo).then((nuevo) => {
                  setComprobante(nuevo);
                  marcarTocado("comprobante");
                });
              }}
              onQuitar={() => {
                setComprobante(null);
                marcarTocado("comprobante");
              }}
            />
          </div>

          {metodo?.requiere_comprobante === false ? (
            <p className="text-xs text-muted-foreground">
              Para este método el comprobante es opcional.
            </p>
          ) : null}

          {metodo?.moneda === "VES" ? (
            <p className="text-xs text-muted-foreground">
              {`Equivale a ${formatUsd(montoEnUsd)} de tu reserva.`}
            </p>
          ) : null}
        </section>

        {/* Historial de pagos -------------------------------------------- */}
        {pagos.length > 0 ? (
          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <h2 className="text-base font-bold text-foreground">Tus pagos reportados</h2>
            <ul className="flex flex-col gap-3">
              {pagos.map((pago) => (
                <PagoFila key={pago.id} pago={pago} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <DialogoConfirmacion
        abierto={dialogoTasa !== null}
        onAbiertoChange={(abierto) => {
          if (!abierto) setDialogoTasa(null);
        }}
        titulo="Cambió la tasa de cambio"
        descripcion={
          dialogoTasa ? (
            <p>
              {`La tasa vigente cambió. Tu saldo de ${formatUsd(saldoUsd)} ahora equivale a ${formatBs(dialogoTasa.montoBs)}. El monto que reportas no cambia solo: confírmalo para enviarlo con la nueva tasa.`}
            </p>
          ) : undefined
        }
        etiquetaConfirmar="Confirmar y reenviar"
        etiquetaCancelar="Revisar el monto"
        onConfirmar={() => {
          const tasaId = dialogoTasa?.tasaId;
          setDialogoTasa(null);
          void enviar(tasaId);
        }}
      />
    </PublicShell>
  );
}

/** Tarjeta de método de pago seleccionable (icono + texto, nunca sólo color). */
function MetodoTarjeta({
  metodo,
  seleccionado,
  onSeleccionar,
}: {
  metodo: MetodoPago;
  seleccionado: boolean;
  onSeleccionar: () => void;
}) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
        seleccionado ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent"
      }`}
    >
      <input
        type="radio"
        name="metodo-pago"
        value={metodo.id}
        checked={seleccionado}
        onChange={onSeleccionar}
        className="h-5 w-5 shrink-0 accent-[var(--primary)]"
      />
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        {metodo.moneda === "VES" ? (
          <Wallet className="h-4 w-4" aria-hidden="true" />
        ) : (
          <CircleDollarSign className="h-4 w-4" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-foreground">{metodo.nombre}</span>
        <span className="block text-xs text-muted-foreground">
          {metodo.moneda === "VES" ? "Se paga en bolívares" : "Se paga en dólares"}
        </span>
      </span>
      {seleccionado ? <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" /> : null}
    </label>
  );
}

/** Fila del historial de pagos con su estado (icono + texto). */
function PagoFila({ pago }: { pago: Pago }) {
  const tono: TonoEstado =
    pago.estado === "aprobado"
      ? "exito"
      : pago.estado === "rechazado"
        ? "peligro"
        : pago.estado === "correccion_solicitada"
          ? "aviso"
          : "activo";

  const etiqueta =
    pago.estado === "reportado"
      ? "En verificación"
      : pago.estado === "aprobado"
        ? "Aprobado"
        : pago.estado === "rechazado"
          ? "Rechazado"
          : pago.estado === "correccion_solicitada"
            ? "Necesita corrección"
            : "Anulado";

  return (
    <li className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <Banknote className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-foreground">
            {ETIQUETA_METODO_PAGO[pago.metodo] ?? "Pago"}
          </p>
          <BadgeEstado etiqueta={etiqueta} tono={tono} />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {`${formatUsd(pago.monto)} · ${formatDate(pago.fecha_pago)}`}
        </p>
        {pago.referencia ? (
          <p className="mt-0.5 break-all text-xs text-muted-foreground">
            {`Referencia: ${pago.referencia}`}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** Etiqueta legible de un campo extra del método de pago. */
function etiquetaCampo(campo: string): string {
  const mapa: Record<string, string> = {
    monto_ves: "Monto en bolívares",
    referencia: "Referencia del pago",
    fecha_pago: "Fecha del pago",
    cedula: "Cédula",
    telefono: "Teléfono",
  };
  return mapa[campo] ?? `Escribe ${campo.replace(/_/g, " ")}`;
}

/** Lee el archivo y genera una vista previa pequeña (sólo imágenes). */
async function construirComprobante(archivo: File): Promise<Comprobante> {
  const preview = await generarPreview(archivo);
  return {
    nombre: archivo.name,
    tipo: archivo.type || "application/octet-stream",
    tamano: archivo.size,
    preview,
  };
}

/**
 * Valida el monto con los mismos umbrales que el servidor (sobrepago > 2×).
 * Es una función pura para poder revalidar mientras se escribe (UX-13).
 */
function validarMonto(
  valor: string,
  moneda: Moneda | undefined,
  tasaValor: string | undefined,
  totalUsd: string,
): string | undefined {
  if (!valor.trim()) return "Escribe el monto que vas a pagar";
  const numero = Number.parseFloat(valor.replace(",", "."));
  if (Number.isNaN(numero) || numero <= 0) return "Escribe un monto válido, por ejemplo 90.00";

  const tasa = Number.parseFloat(tasaValor ?? "0");
  const enUsd = moneda === "VES" ? (tasa ? numero / tasa : 0) : numero;
  if (enUsd > Number.parseFloat(totalUsd) * 2) {
    return "Revisa el monto; parece demasiado alto";
  }
  return undefined;
}

/** Multiplica dos decimales sin arrastrar `float` al resultado (FD-09). */
function multiplicar(valor: string, factor: string): string {
  const a = Number.parseFloat(valor || "0");
  const b = Number.parseFloat(factor || "0");
  if (Number.isNaN(a) || Number.isNaN(b)) return "0.00";
  return (a * b).toFixed(2);
}

/** Hoy en la zona horaria de la agencia (`YYYY-MM-DD`). */
function hoyEnAgencia(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
