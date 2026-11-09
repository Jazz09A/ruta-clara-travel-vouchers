import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { api, apiAbsUrl } from "@/lib/api";
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  FileClock,
  Link2,
  MoreVertical,
  PencilLine,
  RefreshCw,
  RotateCcw,
  Ticket,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/AdminShell";
import { usePermiso, useSesion } from "@/components/admin/sesion";
import {
  CabeceraReserva,
  DialogoCancelarReserva,
  DialogoEditarDatos,
  DialogoExtenderHold,
  DialogoMotivo,
  DialogoPagoEfectivo,
  DialogoReembolso,
  DialogoReprogramar,
  DialogoRevelarDato,
  LineaTiempoReserva,
  PanelFirma,
  PanelNotas,
  PanelPagosReserva,
  PanelPasajeros,
  PanelPrecio,
  PanelVoucher,
  ProgresoReserva,
  useReveloTemporal,
  type CampoEditable,
  type CampoRevelable,
  type DatosCancelacion,
  type DatosEdicion,
  type DatosExtenderHold,
  type DatosPagoEfectivo,
  type DatosReembolso,
  type DatosReprogramar,
  type SimulacionCancelacion,
} from "@/components/admin/reserva";
import { Banner } from "@/components/core/Banner";
import { ErrorState } from "@/components/core/ErrorState";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelative, formatUsd } from "@/lib/format";
import { TRANSICIONES } from "@/lib/domain/state-machine";
import type { FechaTour, Pago } from "@/lib/domain/types";
import { useEsEscritorio } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { mensajeDeError } from "@/components/admin/ui/utilidades";

export const Route = createFileRoute("/admin/reservas/$id")({
  head: () => ({
    meta: [
      { title: "Detalle de reserva · Ruta Clara" },
      {
        name: "description",
        content: "Datos, pagos, firma y voucher de una reserva.",
      },
    ],
  }),
  component: DetalleReserva,
});

/** Diálogos que la pantalla puede abrir. */
type DialogoActivo =
  | "ninguno"
  | "regenerar-enlace"
  | "revocar-enlace"
  | "extender-hold"
  | "reactivar"
  | "cancelar"
  | "reprogramar"
  | "reabrir"
  | "editar"
  | "efectivo"
  | "reembolso"
  | "revelar"
  | "voucher";

/** Campos que el panel de passengers puede editar. */
const TIPOS_EDITABLES = new Set(["select", "text", "textarea"]);

function DetalleReserva() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const esEscritorio = useEsEscritorio();
  const { usuario } = useSesion();

  const puedeVer = usePermiso("reservas.ver");
  const puedeEditar = usePermiso("reservas.editar");
  const puedeCancelar = usePermiso("reservas.cancelar");
  const puedeRevelar = usePermiso("reservas.revelar");
  const puedeReprogramar = usePermiso("reservas.reprogramar");
  const puedeRegistrarEfectivo = usePermiso("pagos.registrar");
  const puedeValidar = usePermiso("pagos.validar");
  const puedeReembolsar = usePermiso("pagos.reembolsar");

  const [dialogo, setDialogo] = React.useState<DialogoActivo>("ninguno");
  const [motivo, setMotivo] = React.useState("");
  const [accionEnCurso, setAccionEnCurso] = React.useState<string | null>(null);
  const [mensaje, setMensaje] = React.useState<{ texto: string; error: boolean } | null>(null);
  const [simulacion, setSimulacion] = React.useState<SimulacionCancelacion | null>(null);
  const [simulacionCargando, setSimulacionCargando] = React.useState(false);
  const [conflicto, setConflicto] = React.useState<string | undefined>(undefined);
  const [pagoAReembolsar, setPagoAReembolsar] = React.useState<Pago | null>(null);
  const [pasajeroRevelado, setPasajeroRevelado] = React.useState<string | null>(null);
  const [campoRevelado, setCampoRevelado] = React.useState<CampoRevelable>("documento");
  const [notas, setNotas] = React.useState("");
  const [guardandoNotas, setGuardandoNotas] = React.useState(false);

  const tituloRef = React.useRef<HTMLHeadingElement>(null);
  const revelado = useReveloTemporal();

  const consulta = useQuery({
    queryKey: ["admin", "reserva", id],
    queryFn: () => api.admin.reserva(id),
    enabled: puedeVer,
  });

  const reserva = consulta.data;

  const consultaTour = useQuery({
    queryKey: ["admin", "tour", reserva?.tour?.id ?? ""],
    queryFn: () => api.admin.tour(reserva?.tour?.id ?? ""),
    enabled: Boolean(reserva?.tour?.id),
  });

  const consultaCliente = useQuery({
    queryKey: ["admin", "cliente", reserva?.pasajeros?.find((p) => p.es_titular)?.documento ?? ""],
    queryFn: () =>
      api.admin.cliente(reserva?.pasajeros?.find((p) => p.es_titular)?.documento ?? ""),
    enabled: Boolean(reserva?.pasajeros?.find((p) => p.es_titular)?.documento),
  });

  React.useEffect(() => {
    if (reserva) tituloRef.current?.focus();
  }, [reserva]);

  React.useEffect(() => {
    if (consultaCliente.data) setNotas(consultaCliente.data.notas);
  }, [consultaCliente.data]);

  const camposEditables: CampoEditable[] = React.useMemo(() => {
    const definicion = (consultaTour.data?.form_versiones ?? []).find(
      (version) => version.id === reserva?.formulario_id,
    );
    if (!definicion) return [];
    return definicion.definicion.campos
      .filter((campo) => TIPOS_EDITABLES.has(campo.tipo))
      .map((campo) => ({
        id: campo.id,
        label: campo.label,
        tipo: campo.tipo === "select" ? "select" : campo.tipo === "textarea" ? "textarea" : "text",
        opciones: (campo.opciones ?? []).map((opcion) => ({
          valor: opcion.valor,
          label: opcion.label,
        })),
        alcance: campo.alcance,
      }));
  }, [consultaTour.data, reserva?.formulario_id]);

  const refrescar = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "reserva", id] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "tour"] });
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
    setMotivo("");
    setConflicto(undefined);
    setSimulacion(null);
    setPagoAReembolsar(null);
    setPasajeroRevelado(null);
  }, []);

  const abrirCancelar = React.useCallback(async () => {
    setDialogo("cancelar");
    setSimulacionCargando(true);
    try {
      const resultado = await api.admin.simularCancelacion(id);
      setSimulacion(resultado);
    } catch (error) {
      setMensaje({
        texto: mensajeDeError(error, "No pudimos calcular el reembolso sugerido."),
        error: true,
      });
    } finally {
      setSimulacionCargando(false);
    }
  }, [id]);

  if (!puedeVer) {
    return (
      <AdminShell titulo="Detalle de reserva">
        <ErrorState
          titulo="No tienes permiso para ver esta reserva"
          mensaje="Tu rol no incluye la consulta de reservas. Pídele a un administrador que te habilite el acceso."
        />
      </AdminShell>
    );
  }

  if (consulta.isLoading) {
    return (
      <AdminShell titulo="Detalle de reserva">
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
        >
          <p className="text-sm text-muted-foreground">Cargando la reserva…</p>
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-muted" />
        </div>
      </AdminShell>
    );
  }

  if (consulta.isError || !reserva) {
    return (
      <AdminShell titulo="Detalle de reserva">
        <ErrorState
          titulo="No pudimos cargar la reserva"
          mensaje={mensajeDeError(consulta.error, "Revisa tu conexión e inténtalo de nuevo.")}
          onReintentar={() => {
            void consulta.refetch();
          }}
        />
      </AdminShell>
    );
  }

  const estado = reserva.estado;
  const abierta = !["cancelada", "expirada", "completada"].includes(estado);
  const puedeCancelarAhora = TRANSICIONES[estado].includes("cancelada");
  const puedeReactivarAhora = estado === "expirada";
  const puedeReprogramarAhora = estado === "confirmada" || estado === "pago_en_verificacion";
  const puedeExtenderAhora = Boolean(reserva.expira_en) && abierta;
  const puedeEditarEnlace = abierta;
  const hayTokenEnlace = Boolean(reserva.link_token);

  const montoAprobado = reserva.pagos
    .filter((pago) => pago.estado === "aprobado")
    .reduce((total, pago) => total + Number.parseFloat(pago.monto), 0);

  const camposFaltantes: string[] = [];
  const titular = reserva.pasajeros.find((pasajero) => pasajero.es_titular);
  if (!titular?.nombre) camposFaltantes.push("Nombre del titular");
  if (!titular?.documento) camposFaltantes.push("Documento del titular");
  if (!titular?.fecha_nacimiento) camposFaltantes.push("Fecha de nacimiento del titular");
  if (!titular?.telefono) camposFaltantes.push("Teléfono del titular");
  if (!titular?.correo) camposFaltantes.push("Correo del titular");
  if (!reserva.firma) camposFaltantes.push("Firma de los términos");
  if (reserva.estado_pago !== "pagado") camposFaltantes.push("Pago completo");

  const panelCabecera = (
    <CabeceraReserva
      reserva={reserva}
      tour={reserva.tour?.nombre}
      fechaSalida={reserva.fecha?.fecha_salida}
      horaSalida={reserva.fecha?.hora_salida}
    />
  );

  const panelProgreso = (
    <ProgresoReserva
      estado={estado}
      pasoActual={reserva.paso_actual}
      ultimaActividadEn={reserva.ultima_actividad_en}
      camposFaltantes={camposFaltantes}
    />
  );

  const panelPasajeros = (
    <PanelPasajeros
      pasajeros={reserva.pasajeros}
      respuestasGlobales={reserva.respuestas_globales}
      campos={camposEditables}
      puedeRevelar={puedeRevelar}
      revelados={revelado.revelados}
      segundosRestantes={revelado.segundosRestantes}
      onRevelar={(campo, refPasajero) => {
        setCampoRevelado(campo);
        setPasajeroRevelado(refPasajero);
        setMotivo("");
        setDialogo("revelar");
      }}
      onOcultar={(campo, refPasajero) => {
        revelado.ocultar(`${refPasajero}:${campo}`);
      }}
    />
  );

  const panelPagos = (
    <PanelPagosReserva
      pagos={reserva.pagos}
      puedeRegistrarEfectivo={puedeRegistrarEfectivo && abierta}
      puedeValidar={puedeValidar}
      puedeReembolsar={puedeReembolsar}
      onRegistrarEfectivo={() => setDialogo("efectivo")}
      onReembolsar={(pago) => {
        setPagoAReembolsar(pago);
        setDialogo("reembolso");
      }}
    />
  );

  const panelPrecio = (
    <PanelPrecio
      reserva={reserva}
      puedeEditar={puedeEditar}
      abierta={abierta}
      guardando={accionEnCurso === "precio"}
      onGuardar={async (datos) => {
        setAccionEnCurso("precio");
        setMensaje(null);
        try {
          const resultado = await api.admin.guardarPrecio(id, datos);
          const texto = resultado.advertencia
            ? `Precio actualizado. ${resultado.advertencia}`
            : "Precio actualizado.";
          setMensaje({ texto, error: false });
          toast.success("Precio actualizado.");
          await refrescar();
        } catch (error) {
          const texto = mensajeDeError(error, "No pudimos guardar el precio.");
          setMensaje({ texto, error: true });
          toast.error(texto);
          // El panel conserva el borrador para reintentar.
          throw error;
        } finally {
          setAccionEnCurso(null);
        }
      }}
    />
  );

  const panelFirma = <PanelFirma firma={reserva.firma} />;

  const puedeGenerarVoucher = ["pago_en_verificacion", "confirmada", "completada"].includes(estado);

  const panelVoucher = (
    <PanelVoucher
      voucher={reserva.voucher}
      regenerando={accionEnCurso === "voucher"}
      puedeRegenerar={puedeGenerarVoucher}
      motivoBloqueo={
        puedeGenerarVoucher
          ? "La regeneración crea una versión nueva del voucher y deja la anterior como reemplazada."
          : "El voucher se genera cuando el pago queda aprobado."
      }
      descargando={accionEnCurso === "voucher-descarga"}
      onDescargar={() => {
        void ejecutar("voucher-descarga", async () => {
          const voucher = reserva.voucher;
          if (!voucher) throw new Error("Esta reserva no tiene voucher.");
          const { url } = await api.admin.voucherDescarga(voucher.id);
          window.open(apiAbsUrl(url), "_blank", "noopener,noreferrer");
          return "Voucher listo para descargar.";
        });
      }}
      onRegenerar={() => setDialogo("voucher")}
    />
  );

  const panelNotas = (
    <PanelNotas
      referenciaInterna={reserva.referencia_interna}
      notas={notas}
      guardando={guardandoNotas}
      error={undefined}
      onGuardarNotas={(texto) => {
        const documento = titular?.documento ?? "";
        if (!documento) {
          setMensaje({
            texto:
              "El titular todavía no tiene documento, así que no hay ficha de cliente donde guardar la nota.",
            error: true,
          });
          return;
        }
        setGuardandoNotas(true);
        void api.admin
          .guardarNotaCliente(documento, { notas: texto })
          .then(() => {
            setMensaje({ texto: "Notas guardadas.", error: false });
            toast.success("Notas guardadas.");
          })
          .catch((error: unknown) => {
            const textoError = mensajeDeError(error, "No pudimos guardar las notas.");
            setMensaje({ texto: textoError, error: true });
            toast.error(textoError);
          })
          .finally(() => setGuardandoNotas(false));
      }}
    />
  );

  const panelLineaTiempo = <LineaTiempoReserva auditoria={reserva.auditoria} />;

  return (
    <AdminShell
      titulo="Detalle de reserva"
      breadcrumb={[{ label: "Reservas", to: "/admin/reservas" }, { label: reserva.codigo }]}
      acciones={
        <div className="flex flex-wrap items-center gap-2">
          {puedeEditar && abierta ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setDialogo("editar")}
            >
              <PencilLine className="h-4 w-4" aria-hidden="true" />
              <span>Editar datos</span>
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setMotivo("");
              setDialogo("reactivar");
            }}
            disabled={!puedeReactivarAhora || accionEnCurso !== null}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>Reactivar</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" className="min-h-11" disabled={accionEnCurso !== null}>
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
                <span>Acciones</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Acciones sobre la reserva
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                disabled={!puedeEditarEnlace}
                onSelect={() => {
                  setMotivo("");
                  setDialogo("regenerar-enlace");
                }}
              >
                <Link2 className="h-4 w-4" aria-hidden="true" />
                <span>
                  Regenerar enlace
                  {!puedeEditarEnlace ? " — solo en reservas abiertas" : ""}
                </span>
              </DropdownMenuItem>

              <DropdownMenuItem
                disabled={!puedeEditarEnlace}
                onSelect={() => {
                  setMotivo("");
                  setDialogo("revocar-enlace");
                }}
              >
                <Ban className="h-4 w-4" aria-hidden="true" />
                <span>
                  Revocar enlace
                  {!puedeEditarEnlace ? " — solo en reservas abiertas" : ""}
                </span>
              </DropdownMenuItem>

              <DropdownMenuItem
                disabled={!puedeExtenderAhora}
                onSelect={() => setDialogo("extender-hold")}
              >
                <FileClock className="h-4 w-4" aria-hidden="true" />
                <span>
                  Extender cupo
                  {!puedeExtenderAhora ? " — la reserva no tiene vencimiento activo" : ""}
                </span>
              </DropdownMenuItem>

              <DropdownMenuItem
                disabled={!puedeReactivarAhora}
                onSelect={() => {
                  setMotivo("");
                  setDialogo("reactivar");
                }}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>
                  Reactivar reserva
                  {!puedeReactivarAhora ? " — solo se reactiva una reserva expirada" : ""}
                </span>
              </DropdownMenuItem>

              <DropdownMenuItem
                disabled={!puedeReprogramarAhora}
                onSelect={() => setDialogo("reprogramar")}
              >
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
                <span>
                  Reprogramar
                  {!puedeReprogramarAhora
                    ? " — disponible cuando el pago está en verificación o la reserva está confirmada"
                    : ""}
                </span>
              </DropdownMenuItem>

              {hayTokenEnlace ? (
                <DropdownMenuItem
                  disabled={!abierta}
                  onSelect={() => {
                    setMotivo("");
                    setDialogo("reabrir");
                  }}
                >
                  <PencilLine className="h-4 w-4" aria-hidden="true" />
                  <span>
                    Reabrir edición
                    {!abierta ? " — la reserva está cerrada" : ""}
                  </span>
                </DropdownMenuItem>
              ) : null}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                disabled={!puedeCancelar || !puedeCancelarAhora}
                onSelect={() => {
                  void abrirCancelar();
                }}
                className={cn(
                  !puedeCancelar || !puedeCancelarAhora ? "opacity-60" : "text-destructive",
                )}
              >
                <Ban className="h-4 w-4" aria-hidden="true" />
                <span>
                  Cancelar reserva
                  {!puedeCancelar
                    ? " — tu rol no puede cancelar reservas"
                    : !puedeCancelarAhora
                      ? " — no se puede cancelar desde este estado"
                      : ""}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/admin/reservas"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Volver a reservas</span>
          </Link>
          <span className="text-xs text-muted-foreground">
            {`Última actividad ${formatRelative(reserva.ultima_actividad_en)} · versión ${reserva.version}`}
          </span>
        </div>

        <h2
          ref={tituloRef}
          tabIndex={-1}
          className="text-2xl font-extrabold tracking-tight text-foreground focus:outline-none"
        >
          {`Reserva ${reserva.codigo}`}
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

        {estado === "cancelada" && montoAprobado > 0 ? (
          <Banner
            variante="urgente"
            titulo="Reembolso pendiente"
            accion={
              puedeReembolsar
                ? {
                    etiqueta: "Registrar reembolso",
                    onClick: () => {
                      const primero = reserva.pagos.find((pago) => pago.estado === "aprobado");
                      if (primero) {
                        setPagoAReembolsar(primero);
                        setDialogo("reembolso");
                      }
                    },
                  }
                : undefined
            }
          >
            {`Esta reserva tenía ${formatUsd(montoAprobado.toFixed(2))} aprobados. El reembolso queda pendiente de registro.`}
          </Banner>
        ) : null}

        {esEscritorio ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="flex flex-col gap-4 xl:col-span-2">
              {panelCabecera}
              {panelProgreso}
              {panelPasajeros}
              {panelPrecio}
              {panelPagos}
            </div>
            <div className="flex flex-col gap-4">
              {panelFirma}
              {panelVoucher}
              {panelNotas}
              {panelLineaTiempo}
            </div>
          </div>
        ) : (
          <Tabs defaultValue="resumen">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="resumen" className="min-h-11">
                Reserva
              </TabsTrigger>
              <TabsTrigger value="pagos" className="min-h-11">
                Pagos
              </TabsTrigger>
              <TabsTrigger value="historial" className="min-h-11">
                Historial
              </TabsTrigger>
            </TabsList>
            <TabsContent value="resumen" className="flex flex-col gap-4">
              {panelCabecera}
              {panelProgreso}
              {panelPasajeros}
            </TabsContent>
            <TabsContent value="pagos" className="flex flex-col gap-4">
              {panelPrecio}
              {panelPagos}
              {panelFirma}
              {panelVoucher}
            </TabsContent>
            <TabsContent value="historial" className="flex flex-col gap-4">
              {panelNotas}
              {panelLineaTiempo}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Diálogos de acciones */}
      <DialogoMotivo
        abierto={dialogo === "regenerar-enlace"}
        onAbiertoChange={(abierto) => {
          if (!abierto) cerrarDialogo();
        }}
        titulo="Regenerar el enlace de la reserva"
        descripcion="Se crea un enlace nuevo y el anterior deja de funcionar. El enlace nuevo se muestra una sola vez."
        textoConfirmar="Regenerar enlace"
        motivo={motivo}
        onMotivoChange={setMotivo}
        cargando={accionEnCurso === "regenerar-enlace"}
        onConfirmar={() => {
          void ejecutar("regenerar-enlace", async () => {
            const resultado = await api.admin.regenerarEnlace(id, { motivo: motivo.trim() });
            return `Enlace nuevo: ${resultado.enlace}`;
          }).then(() => {
            cerrarDialogo();
          });
        }}
      />

      <DialogoMotivo
        abierto={dialogo === "revocar-enlace"}
        onAbiertoChange={(abierto) => {
          if (!abierto) cerrarDialogo();
        }}
        titulo="Revocar el enlace de la reserva"
        descripcion="El titular no podrá volver a abrir su formulario con este enlace."
        textoConfirmar="Revocar enlace"
        variante="destructivo"
        motivo={motivo}
        onMotivoChange={setMotivo}
        cargando={accionEnCurso === "revocar-enlace"}
        onConfirmar={() => {
          void ejecutar("revocar-enlace", async () => {
            await api.admin.revocarEnlace(id, { motivo: motivo.trim() });
            return "Enlace revocado.";
          }).then(() => {
            cerrarDialogo();
          });
        }}
      />

      <DialogoExtenderHold
        abierto={dialogo === "extender-hold"}
        onAbiertoChange={(abierto) => {
          if (!abierto) cerrarDialogo();
        }}
        expiraEn={reserva.expira_en}
        cargando={accionEnCurso === "extender-hold"}
        onConfirmar={(datos: DatosExtenderHold) => {
          void ejecutar("extender-hold", async () => {
            const resultado = await api.admin.extenderHold(id, {
              horas: datos.horas,
              motivo: datos.motivo,
            });
            return `Cupo extendido hasta ${resultado.expira_en.slice(0, 16).replace("T", " ")}.`;
          }).then(() => {
            cerrarDialogo();
          });
        }}
      />

      <DialogoMotivo
        abierto={dialogo === "reactivar"}
        onAbiertoChange={(abierto) => {
          if (!abierto) cerrarDialogo();
        }}
        titulo="Reactivar la reserva"
        descripcion="La reserva vuelve al estado inicial con un enlace nuevo y el titular puede completarla otra vez."
        textoConfirmar="Reactivar reserva"
        motivo={motivo}
        onMotivoChange={setMotivo}
        cargando={accionEnCurso === "reactivar"}
        onConfirmar={() => {
          void ejecutar("reactivar", async () => {
            await api.admin.reactivar(id, { motivo: motivo.trim() });
            return "Reserva reactivada.";
          }).then(() => {
            cerrarDialogo();
          });
        }}
      />

      <DialogoMotivo
        abierto={dialogo === "reabrir"}
        onAbiertoChange={(abierto) => {
          if (!abierto) cerrarDialogo();
        }}
        titulo="Reabrir la edición"
        descripcion="El titular vuelve al formulario desde el primer paso y tendrá que firmar de nuevo. La firma anterior se descarta."
        textoConfirmar="Reabrir edición"
        motivo={motivo}
        onMotivoChange={setMotivo}
        cargando={accionEnCurso === "reabrir"}
        onConfirmar={() => {
          void ejecutar("reabrir", async () => {
            const token = reserva.link_token;
            if (!token) throw new Error("No hay token del enlace para reabrir la edición.");
            await api.publica.reabrirEdicion(token, motivo.trim());
            return "Edición reabierta para el titular.";
          }).then(() => {
            cerrarDialogo();
          });
        }}
      />

      <DialogoMotivo
        abierto={dialogo === "voucher"}
        onAbiertoChange={(abierto) => {
          if (!abierto) cerrarDialogo();
        }}
        titulo="Regenerar el voucher"
        descripcion="Se crea una versión nueva del voucher y la anterior queda como reemplazada. El motivo queda registrado en la auditoría."
        textoConfirmar="Regenerar voucher"
        motivo={motivo}
        onMotivoChange={setMotivo}
        cargando={accionEnCurso === "voucher"}
        onConfirmar={() => {
          void ejecutar("voucher", async () => {
            await api.admin.regenerarVoucher(id, { motivo: motivo.trim() });
            return "Voucher en generación. Vuelve a consultar en unos segundos.";
          }).then(() => {
            cerrarDialogo();
          });
        }}
      />

      <DialogoCancelarReserva
        abierto={dialogo === "cancelar"}
        onAbiertoChange={(abierto) => {
          if (!abierto) cerrarDialogo();
        }}
        reserva={reserva}
        pagos={reserva.pagos}
        puedeForzar={usuario?.rol === "SA"}
        simulacion={simulacion}
        simulacionCargando={simulacionCargando}
        cargando={accionEnCurso === "cancelar"}
        onConfirmar={(datos: DatosCancelacion) => {
          void ejecutar("cancelar", async () => {
            await api.admin.cancelarReserva(id, {
              origen: datos.origen,
              motivo: datos.motivo,
              ...(datos.monto_reembolso ? { monto_reembolso: datos.monto_reembolso } : {}),
              ...(datos.forzar ? { forzar: true } : {}),
            });
            return datos.monto_reembolso
              ? `Reserva cancelada. Reembolso pendiente: ${formatUsd(datos.monto_reembolso)}.`
              : "Reserva cancelada.";
          }).then(() => {
            cerrarDialogo();
          });
        }}
      />

      <DialogoReprogramar
        abierto={dialogo === "reprogramar"}
        onAbiertoChange={(abierto) => {
          if (!abierto) cerrarDialogo();
        }}
        fechas={(consultaTour.data?.fechas ?? []) as FechaTour[]}
        fechaActualId={reserva.fecha_tour_id}
        numeroPasajeros={reserva.pasajeros.length}
        cargando={accionEnCurso === "reprogramar"}
        conflicto={conflicto}
        onConfirmar={(datos: DatosReprogramar) => {
          setConflicto(undefined);
          void ejecutar("reprogramar", async () => {
            await api.admin.reprogramar(id, {
              fecha_tour_id: datos.fecha_tour_id,
              motivo: datos.motivo,
            });
            return "Reserva reprogramada. El voucher se vuelve a generar.";
          })
            .then((ok) => {
              if (ok) cerrarDialogo();
            })
            .catch(() => {
              setConflicto("El servidor no pudo reprogramar la reserva.");
            });
        }}
      />

      <DialogoEditarDatos
        abierto={dialogo === "editar"}
        onAbiertoChange={(abierto) => {
          if (!abierto) cerrarDialogo();
        }}
        pasajeros={reserva.pasajeros}
        respuestasGlobales={reserva.respuestas_globales}
        campos={camposEditables}
        cargando={accionEnCurso === "editar"}
        onConfirmar={(datos: DatosEdicion) => {
          void ejecutar("editar", async () => {
            await api.admin.editarReserva(id, {
              motivo: datos.motivo,
              cambios: {
                pasajeros: datos.pasajeros,
                respuestas_globales: datos.respuestas_globales,
              },
            });
            return "Datos actualizados.";
          }).then(() => {
            cerrarDialogo();
          });
        }}
      />

      <DialogoPagoEfectivo
        abierto={dialogo === "efectivo"}
        onAbiertoChange={(abierto) => {
          if (!abierto) cerrarDialogo();
        }}
        reserva={reserva}
        cargando={accionEnCurso === "efectivo"}
        onConfirmar={(datos: DatosPagoEfectivo) => {
          void ejecutar("efectivo", async () => {
            await api.admin.registrarPagoEfectivo(id, {
              monto: datos.monto,
              ...(datos.referencia ? { referencia: datos.referencia } : {}),
              ...(datos.nota ? { nota: datos.nota } : {}),
            });
            return "Pago en efectivo registrado.";
          }).then(() => {
            cerrarDialogo();
          });
        }}
      />

      <DialogoReembolso
        abierto={dialogo === "reembolso"}
        onAbiertoChange={(abierto) => {
          if (!abierto) cerrarDialogo();
        }}
        pago={pagoAReembolsar ?? undefined}
        cargando={accionEnCurso === "reembolso"}
        onConfirmar={(datos: DatosReembolso) => {
          const pago = pagoAReembolsar;
          if (!pago) return;
          void ejecutar("reembolso", async () => {
            await api.admin.reembolsar(pago.id, {
              monto: datos.monto,
              metodo: datos.metodo,
              motivo: datos.motivo,
            });
            return `Reembolso de ${formatUsd(datos.monto)} registrado.`;
          }).then(() => {
            cerrarDialogo();
          });
        }}
      />

      <DialogoRevelarDato
        abierto={dialogo === "revelar"}
        onAbiertoChange={(abierto) => {
          if (!abierto) cerrarDialogo();
        }}
        campo={campoRevelado}
        nombre={
          reserva.pasajeros.find((pasajero) => pasajero.ref_cliente === pasajeroRevelado)?.nombre ??
          "del titular"
        }
        motivo={motivo}
        onMotivoChange={setMotivo}
        cargando={accionEnCurso === "revelar"}
        onConfirmar={() => {
          void ejecutar("revelar", async () => {
            if (!pasajeroRevelado) throw new Error("No encontramos al pasajero.");
            const resultado = await api.admin.revelar(id, {
              campo: campoRevelado,
              pasajero_ref: pasajeroRevelado,
              motivo: motivo.trim(),
            });
            revelado.revelar(`${pasajeroRevelado}:${campoRevelado}`, resultado.valor);
            return "Dato revelado durante 30 segundos.";
          }).then(() => {
            setDialogo("ninguno");
            setMotivo("");
          });
        }}
      />

      {usuario?.rol === "GU" ? (
        <Banner variante="info" titulo="Acceso de solo lectura">
          <span className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            <span>Tu rol puede ver la reserva pero no modificar nada.</span>
          </span>
        </Banner>
      ) : null}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          El servidor es la autoridad: los importes y los estados se muestran, no se calculan.
        </span>
      </p>
    </AdminShell>
  );
}
