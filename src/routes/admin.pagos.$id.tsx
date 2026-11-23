import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { ArrowLeft, Ban } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/AdminShell";
import { usePermiso, useSesion } from "@/components/admin/sesion";
import {
  BadgePago,
  VisorComprobante,
  calcularDiferencia,
  formatearMonto,
} from "@/components/admin/pagos";
import { DialogoConfirmacion } from "@/components/core/DialogoConfirmacion";
import { Banner } from "@/components/core/Banner";
import { ErrorState } from "@/components/core/ErrorState";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { ETIQUETA_METODO_PAGO, formatDate, formatUsd, maskDocumento } from "@/lib/format";
import type { Pago, Reserva } from "@/lib/domain/types";
import { mensajeDeError, nuevoIdempotencyKey } from "@/components/admin/ui/utilidades";

export const Route = createFileRoute("/admin/pagos/$id")({
  head: () => ({
    meta: [
      { title: "Detalle de pago · Escapate Tours" },
      {
        name: "description",
        content: "Comprobante y datos del pago registrado.",
      },
    ],
  }),
  component: DetallePago,
});

function DetallePago() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const { usuario } = useSesion();

  const puedeVer = usePermiso("pagos.ver");

  const [dialogo, setDialogo] = React.useState<"ninguno" | "anular">("ninguno");
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

  // Historial de pagos previos de la misma reserva (A-09).
  const consultaPagosReserva = useQuery({
    queryKey: ["admin", "pagos", "reserva", pago?.reserva_id ?? ""],
    queryFn: () => api.admin.pagos({ reserva_id: pago?.reserva_id ?? "", limite: 50 }),
    enabled: Boolean(pago?.reserva_id),
  });

  const pagosPrevios =
    consultaPagosReserva.data?.items.filter((pagoPrevio) => pagoPrevio.id !== pago?.id) ?? [];

  React.useEffect(() => {
    if (pago) tituloRef.current?.focus();
  }, [pago]);

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

  const refrescar = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "pagos"] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "pago", id] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "reserva", pago?.reserva_id] });
    await queryClient.invalidateQueries({ queryKey: ["reserva"] });
    await queryClient.invalidateQueries({ queryKey: ["resumen"] });
  }, [id, pago?.reserva_id, queryClient]);

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
        const texto = mensajeDeError(error, "No pudimos completar la acción.");
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

  if (!puedeVer) {
    return (
      <AdminShell titulo="Detalle de pago">
        <ErrorState
          titulo="No tienes permiso para ver los pagos"
          mensaje="Tu rol no incluye la consulta de pagos."
        />
      </AdminShell>
    );
  }

  if (consulta.isLoading) {
    return (
      <AdminShell titulo="Detalle de pago">
        <div role="status" aria-live="polite" className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Cargando el pago…</p>
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      </AdminShell>
    );
  }

  if (consulta.isError || !datosPago) {
    return (
      <AdminShell titulo="Detalle de pago">
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
      titulo="Detalle de pago"
      breadcrumb={[{ label: "Pagos", to: "/admin/pagos" }, { label: datosPago.referencia }]}
      acciones={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/pagos"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Volver a Pagos</span>
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <h2
          ref={tituloRef}
          tabIndex={-1}
          className="text-2xl font-extrabold tracking-tight text-foreground focus:outline-none"
        >
          {`Pago ${datosPago.referencia}`}
        </h2>

        <div role="status" aria-live="polite" className="sr-only">
          {mensaje?.texto ?? ""}
        </div>

        {mensaje ? (
          <Banner
            variante={mensaje.error ? "error" : "success"}
            titulo={mensaje.error ? "No se pudo completar la acción" : "Listo"}
            onCerrar={() => setMensaje(null)}
          >
            {mensaje.texto}
          </Banner>
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
              aria-label="Datos del pago"
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <header className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-foreground">Datos del pago</h2>
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
                    Monto esperado frente al registrado
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                    {formatearMonto(datosPago.reserva.saldo_usd, "USD")}
                    <span className="mx-2 text-sm font-normal text-muted-foreground">vs</span>
                    {formatearMonto(datosPago.monto, datosPago.moneda)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {diferencia.esSignificativa
                      ? "La diferencia supera la tolerancia registrada."
                      : "La diferencia está dentro de la tolerancia."}
                  </p>
                </div>
              ) : null}

              {datosPago.alertas.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {datosPago.alertas.map((alerta) => (
                    <li
                      key={`${alerta.codigo}-${alerta.mensaje}`}
                      className="text-xs font-medium text-amber-900 dark:text-amber-200"
                    >
                      {alerta.mensaje}
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

              {usuario?.rol === "SA" ? (
                <div className="flex flex-wrap gap-2">
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
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sólo la administración puede anular un pago.
                </p>
              )}

              {saldoNumero > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {`La reserva tiene ${formatUsd(datosPago.reserva.saldo_usd)} pendientes.`}
                </p>
              ) : null}
            </section>
          </div>
        </div>
      </div>

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
