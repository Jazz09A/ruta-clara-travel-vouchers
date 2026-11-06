import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CircleCheckBig,
  CircleX,
  Keyboard,
  MessageCircleMore,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/AdminShell";
import { usePermiso, useSesion } from "@/components/admin/sesion";
import {
  BadgePago,
  DialogoAprobarPago,
  DialogoCorreccionPago,
  DialogoRechazarPago,
  VisorComprobante,
  calcularDiferencia,
  formatearMonto,
  type DatosAprobacion,
  type DatosCorreccion,
  type DatosRechazo,
  type PagoDuplicado,
} from "@/components/admin/pagos";
import { DialogoConfirmacion } from "@/components/core/DialogoConfirmacion";
import { Banner } from "@/components/core/Banner";
import { ErrorState } from "@/components/core/ErrorState";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { ETIQUETA_METODO_PAGO, formatDate, formatUsd, maskDocumento } from "@/lib/format";
import type { Pago, Reserva } from "@/lib/domain/types";
import { useEsEscritorio } from "@/lib/hooks/use-media-query";
import { mensajeDeError, nuevoIdempotencyKey } from "@/components/admin/ui/utilidades";

export const Route = createFileRoute("/admin/pagos/$id")({
  head: () => ({
    meta: [
      { title: "Revisión de pago · Ruta Clara" },
      {
        name: "description",
        content: "Comprobante y datos del pago listos para validar.",
      },
    ],
  }),
  component: RevisionPago,
});

type DialogoActivo = "ninguno" | "aprobar" | "rechazar" | "correccion" | "anular";

function RevisionPago() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const esEscritorio = useEsEscritorio();
  const { usuario } = useSesion();

  const puedeVer = usePermiso("pagos.ver");
  const puedeValidar = usePermiso("pagos.validar");

  const [dialogo, setDialogo] = React.useState<DialogoActivo>("ninguno");
  const [accionEnCurso, setAccionEnCurso] = React.useState<string | null>(null);
  const [mensaje, setMensaje] = React.useState<{ texto: string; error: boolean } | null>(null);
  const [motivoAnular, setMotivoAnular] = React.useState("");
  const claveIdempotencia = React.useRef<string>(nuevoIdempotencyKey());

  const tituloRef = React.useRef<HTMLHeadingElement>(null);

  const consulta = useQuery({
    queryKey: ["admin", "pago", id],
    queryFn: () => api.admin.pago(id),
    enabled: puedeVer,
  });

  const pago = consulta.data;

  const consultaDuplicado = useQuery({
    queryKey: ["admin", "pagos", "referencia", pago?.referencia ?? ""],
    queryFn: () => api.admin.pagos({ busqueda: pago?.referencia ?? "", limite: 20 }),
    enabled: Boolean(pago?.duplicado_de_pago_id),
  });

  // Historial de pagos previos de la misma reserva (A-09).
  const consultaPagosReserva = useQuery({
    queryKey: ["admin", "pagos", "reserva", pago?.reserva_id ?? ""],
    queryFn: () => api.admin.pagos({ reserva_id: pago?.reserva_id ?? "", limite: 50 }),
    enabled: Boolean(pago?.reserva_id),
  });

  const pagosPrevios =
    consultaPagosReserva.data?.items.filter((pagoPrevio) => pagoPrevio.id !== pago?.id) ?? [];

  const consultaCola = useQuery({
    queryKey: ["admin", "pagos", "pendientes"],
    queryFn: () => api.admin.pagos({ estado: "reportado", limite: 50 }),
    enabled: puedeVer,
  });

  React.useEffect(() => {
    if (pago) tituloRef.current?.focus();
  }, [pago]);

  const pendientes = consultaCola.data?.items ?? [];
  const siguiente = pendientes.find((item) => item.id !== id);

  const datosPago = pago as (Pago & { reserva: Reserva; comprobante_url?: string }) | undefined;

  const diferencia = React.useMemo(() => {
    if (!datosPago) return null;
    return calcularDiferencia({
      esperadoUsd: datosPago.reserva.saldo_usd,
      reportado: datosPago.monto,
      moneda: datosPago.moneda,
      tasa: datosPago.tasa,
    });
  }, [datosPago]);

  const pagoDuplicado: PagoDuplicado | undefined = React.useMemo(() => {
    if (!datosPago?.duplicado_de_pago_id) return undefined;
    const anterior = consultaDuplicado.data?.items.find(
      (item) => item.id === datosPago.duplicado_de_pago_id,
    );
    if (!anterior) return undefined;
    return {
      id: anterior.id,
      codigoReserva: anterior.reserva.codigo,
      estado: anterior.estado,
      monto: anterior.monto,
      fecha: anterior.fecha_pago,
    };
  }, [consultaDuplicado.data, datosPago]);

  /** Segregación de funciones: quien registró el pago no puede aprobarlo. */
  const registradoPorMismo =
    Boolean(usuario) &&
    Boolean(datosPago?.registrado_por) &&
    (datosPago?.registrado_por ?? "").trim().toLowerCase() ===
      (usuario?.nombre ?? "").trim().toLowerCase();

  const puedeAprobar =
    puedeValidar &&
    (!registradoPorMismo || usuario?.rol === "SA") &&
    datosPago?.estado === "reportado";

  const refrescar = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "pagos"] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "pago", id] });
    // La vista pública del cliente vive en la misma sesión de la demo: al
    // aprobar/rechazar un pago hay que invalidar también su reserva y resumen
    // para que el voucher y el saldo reflejen el cambio sin recargar.
    await queryClient.invalidateQueries({ queryKey: ["reserva"] });
    await queryClient.invalidateQueries({ queryKey: ["resumen"] });
  }, [id, queryClient]);

  const ejecutar = React.useCallback(
    async (nombre: string, accion: () => Promise<string>) => {
      setAccionEnCurso(nombre);
      setMensaje(null);
      try {
        const texto = await accion();
        setMensaje({ texto, error: false });
        toast.success(texto);
        await refrescar();
        return true;
      } catch (error) {
        const texto = mensajeDeError(error, "No pudimos resolver el pago.");
        setMensaje({ texto, error: true });
        toast.error(texto);
        return false;
      } finally {
        setAccionEnCurso(null);
      }
    },
    [refrescar],
  );

  const cerrarDialogo = React.useCallback(() => {
    setDialogo("ninguno");
    setMotivoAnular("");
  }, []);

  const irAlSiguiente = React.useCallback(() => {
    if (!siguiente) return;
    void navigate({ to: "/admin/pagos/$id", params: { id: siguiente.id } });
  }, [navigate, siguiente]);

  // Atajos de teclado (solo escritorio): abren diálogos, nunca ejecutan solos.
  React.useEffect(() => {
    if (!esEscritorio) return;
    const manejar = (evento: KeyboardEvent) => {
      const destino = evento.target as HTMLElement | null;
      const esCampo =
        destino !== null &&
        (destino.tagName === "INPUT" ||
          destino.tagName === "TEXTAREA" ||
          destino.isContentEditable);
      if (esCampo) return;
      if (evento.metaKey || evento.ctrlKey || evento.altKey) return;
      if (evento.key === "a" || evento.key === "A") {
        evento.preventDefault();
        setDialogo("aprobar");
      } else if (evento.key === "r" || evento.key === "R") {
        evento.preventDefault();
        setDialogo("rechazar");
      } else if (evento.key === "ArrowRight") {
        evento.preventDefault();
        irAlSiguiente();
      }
    };
    document.addEventListener("keydown", manejar);
    return () => document.removeEventListener("keydown", manejar);
  }, [esEscritorio, irAlSiguiente]);

  if (!puedeVer) {
    return (
      <AdminShell titulo="Revisión de pago">
        <ErrorState
          titulo="No tienes permiso para ver los pagos"
          mensaje="Tu rol no incluye la revisión de pagos."
        />
      </AdminShell>
    );
  }

  if (consulta.isLoading) {
    return (
      <AdminShell titulo="Revisión de pago">
        <div role="status" aria-live="polite" className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Cargando el pago…</p>
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      </AdminShell>
    );
  }

  if (consulta.isError || !datosPago) {
    return (
      <AdminShell titulo="Revisión de pago">
        <ErrorState
          titulo="No pudimos cargar el pago"
          mensaje={mensajeDeError(consulta.error, "Revisa tu conexión e inténtalo de nuevo.")}
          onReintentar={() => {
            void consulta.refetch();
          }}
        />
      </AdminShell>
    );
  }

  const titular = datosPago.reserva?.pasajeros?.find((pasajero) => pasajero.es_titular);
  const saldoNumero = Number.parseFloat(datosPago.reserva?.saldo_usd ?? "0");

  return (
    <AdminShell
      titulo="Revisión de pago"
      breadcrumb={[{ label: "Pagos", to: "/admin/pagos" }, { label: datosPago.referencia }]}
      acciones={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/pagos"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Volver a la cola</span>
          </Link>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={irAlSiguiente}
            disabled={!siguiente}
          >
            <span>Siguiente</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <h1
          ref={tituloRef}
          tabIndex={-1}
          className="text-2xl font-extrabold tracking-tight text-foreground focus:outline-none"
        >
          {`Pago ${datosPago.referencia}`}
        </h1>

        <div role="status" aria-live="polite" className="sr-only">
          {mensaje?.texto ?? ""}
        </div>

        {mensaje ? (
          <Banner
            variante={mensaje.error ? "error" : "success"}
            titulo={mensaje.error ? "No se pudo resolver el pago" : "Listo"}
            onCerrar={() => setMensaje(null)}
          >
            {mensaje.texto}
          </Banner>
        ) : null}

        {esEscritorio ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              Atajos: <kbd className="rounded bg-muted px-1">A</kbd> aprobar ·{" "}
              <kbd className="rounded bg-muted px-1">R</kbd> rechazar ·{" "}
              <kbd className="rounded bg-muted px-1">→</kbd> siguiente. Siempre piden confirmación.
            </span>
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <div className="flex flex-col gap-4 xl:col-span-3">
            <VisorComprobante
              pagoId={datosPago.id}
              comprobante={datosPago.comprobante}
              totalPaginas={1}
            />
          </div>

          <div className="flex flex-col gap-4 xl:col-span-2">
            <section
              aria-label="Datos a contrastar"
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <header className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-foreground">Datos a contrastar</h2>
                <BadgePago estado={datosPago.estado} />
              </header>

              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">Reserva</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {datosPago.reserva.codigo}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">Titular</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {titular?.nombre || "Sin titular"}
                  </dd>
                  <dd className="text-xs text-muted-foreground">
                    {titular ? maskDocumento(titular.tipo_doc, titular.documento) : "—"}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">Método</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {ETIQUETA_METODO_PAGO[datosPago.metodo] ?? datosPago.metodo}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">Moneda y tasa</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {datosPago.moneda}
                    {datosPago.tasa ? ` · tasa congelada ${datosPago.tasa}` : ""}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">Fecha del pago</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {formatDate(datosPago.fecha_pago)}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">Referencia</dt>
                  <dd className="font-mono text-sm font-medium text-foreground">
                    {datosPago.referencia}
                  </dd>
                </div>
              </dl>

              {diferencia ? (
                <div className="rounded-2xl border border-border bg-muted/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Monto esperado frente al reportado
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                    {formatearMonto(datosPago.reserva.saldo_usd, "USD")}
                    <span className="mx-2 text-sm font-normal text-muted-foreground">vs</span>
                    {formatearMonto(datosPago.monto, datosPago.moneda)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {diferencia.esSignificativa
                      ? "La diferencia supera la tolerancia: si apruebas, debes justificar el ajuste."
                      : "La diferencia está dentro de la tolerancia."}
                  </p>
                </div>
              ) : null}

              {datosPago.alertas.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {datosPago.alertas.map((alerta) => (
                    <li
                      key={`${alerta.codigo}-${alerta.mensaje}`}
                      className="flex items-start gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200"
                    >
                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{alerta.mensaje}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {pagosPrevios.length > 0 ? (
                <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pagos previos de la reserva
                  </p>
                  <ul className="flex flex-col gap-1">
                    {pagosPrevios.map((pagoPrevio) => (
                      <li
                        key={pagoPrevio.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="truncate text-foreground">
                          {`${ETIQUETA_METODO_PAGO[pagoPrevio.metodo] ?? pagoPrevio.metodo} · ${pagoPrevio.referencia}`}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="tabular-nums text-muted-foreground">
                            {formatUsd(pagoPrevio.monto)}
                          </span>
                          <BadgePago estado={pagoPrevio.estado} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <section
              aria-label="Acciones sobre el pago"
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <h2 className="text-sm font-bold text-foreground">Qué hacemos con este pago</h2>

              {registradoPorMismo && usuario?.rol !== "SA" ? (
                <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Otro validador debe aprobar este pago: lo registraste tú. Puedes rechazarlo o
                    pedir corrección.
                  </span>
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={!puedeAprobar || accionEnCurso !== null}
                  onClick={() => {
                    claveIdempotencia.current = nuevoIdempotencyKey();
                    setDialogo("aprobar");
                  }}
                >
                  <CircleCheckBig className="h-4 w-4" aria-hidden="true" />
                  <span>Aprobar</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={!puedeValidar || accionEnCurso !== null}
                  onClick={() => setDialogo("rechazar")}
                >
                  <CircleX className="h-4 w-4" aria-hidden="true" />
                  <span>Rechazar</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={!puedeValidar || accionEnCurso !== null}
                  onClick={() => setDialogo("correccion")}
                >
                  <MessageCircleMore className="h-4 w-4" aria-hidden="true" />
                  <span>Solicitar corrección</span>
                </Button>

                {usuario?.rol === "SA" ? (
                  <Button
                    type="button"
                    variant="destructive"
                    className="min-h-11"
                    disabled={accionEnCurso !== null}
                    onClick={() => setDialogo("anular")}
                  >
                    <Ban className="h-4 w-4" aria-hidden="true" />
                    <span>Anular</span>
                  </Button>
                ) : null}
              </div>

              {!puedeValidar ? (
                <p className="text-xs text-muted-foreground">
                  Tu rol puede consultar el pago, pero no resolverlo.
                </p>
              ) : null}

              {saldoNumero > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {`La reserva tiene ${formatUsd(datosPago.reserva.saldo_usd)} pendientes. Si apruebas, quedará como pago parcial.`}
                </p>
              ) : null}
            </section>
          </div>
        </div>
      </div>

      {diferencia ? (
        <DialogoAprobarPago
          abierto={dialogo === "aprobar"}
          onAbiertoChange={(abierto) => {
            if (!abierto) cerrarDialogo();
          }}
          pago={datosPago}
          diferencia={diferencia}
          pagoDuplicado={pagoDuplicado}
          cargando={accionEnCurso === "aprobar"}
          onConfirmar={(datos: DatosAprobacion) => {
            void ejecutar("aprobar", async () => {
              const resultado = await api.admin.validarPago(id, {
                accion: "aprobar",
                idempotencyKey: claveIdempotencia.current,
                ...(datos.montoValidado ? { monto_validado: datos.montoValidado } : {}),
                ...(datos.ajusteMotivo ? { motivo: datos.ajusteMotivo } : {}),
                ...(datos.confirmarDuplicado ? { confirmar_duplicado: true } : {}),
              });
              const saldo = Number.parseFloat(resultado.saldo_usd);
              return saldo <= 0
                ? "Reserva confirmada, voucher en proceso."
                : `Pago parcial aprobado, falta ${formatUsd(resultado.saldo_usd)}.`;
            }).then(() => {
              cerrarDialogo();
            });
          }}
        />
      ) : null}

      <DialogoRechazarPago
        abierto={dialogo === "rechazar"}
        onAbiertoChange={(abierto) => {
          if (!abierto) cerrarDialogo();
        }}
        pago={datosPago}
        cargando={accionEnCurso === "rechazar"}
        onConfirmar={(datos: DatosRechazo) => {
          void ejecutar("rechazar", async () => {
            await api.admin.validarPago(id, {
              accion: "rechazar",
              idempotencyKey: claveIdempotencia.current,
              motivo_catalogo: datos.motivoCatalogo,
              motivo: datos.textoCliente,
            });
            return "Pago rechazado. El titular ya puede corregirlo desde su enlace.";
          }).then(() => {
            cerrarDialogo();
          });
        }}
      />

      <DialogoCorreccionPago
        abierto={dialogo === "correccion"}
        onAbiertoChange={(abierto) => {
          if (!abierto) cerrarDialogo();
        }}
        pago={datosPago}
        cargando={accionEnCurso === "correccion"}
        onConfirmar={(datos: DatosCorreccion) => {
          void ejecutar("correccion", async () => {
            await api.admin.validarPago(id, {
              accion: "solicitar_correccion",
              idempotencyKey: claveIdempotencia.current,
              texto_cliente: datos.textoCliente,
            });
            return "Corrección solicitada. El titular recibió el mensaje.";
          }).then(() => {
            cerrarDialogo();
          });
        }}
      />

      <DialogoConfirmacion
        open={dialogo === "anular"}
        onOpenChange={(abierto) => {
          if (!abierto) cerrarDialogo();
        }}
        titulo="Anular el pago"
        descripcion="El pago queda anulado y no suma al saldo de la reserva. La acción queda auditada."
        textoConfirmar="Anular pago"
        variante="destructivo"
        loading={accionEnCurso === "anular"}
        motivo={{
          valor: motivoAnular,
          onChange: setMotivoAnular,
          obligatorio: true,
          minimoCaracteres: 5,
        }}
        onConfirm={() => {
          void ejecutar("anular", async () => {
            await api.admin.validarPago(id, {
              accion: "anular",
              idempotencyKey: claveIdempotencia.current,
              motivo: motivoAnular.trim(),
            });
            return "Pago anulado.";
          }).then(() => {
            cerrarDialogo();
          });
        }}
      />
    </AdminShell>
  );
}
