import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Users,
  Download,
  UtensilsCrossed,
  AlertTriangle,
  FileText,
  MoreVertical,
  XCircle,
  Lock,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { BadgeEstado } from "@/components/admin/BadgeEstado";
import { DialogoMotivo } from "@/components/admin/ui/dialogo-motivo";
import { api } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/format";
import type { EstadoReserva, Reserva } from "@/lib/domain/types";

export const Route = createFileRoute("/admin/salidas/$id")({
  head: () => ({
    meta: [
      { title: "Detalle de salida · Panel" },
      { name: "description", content: "Manifiesto, cocina y disponibilidad de la salida." },
    ],
  }),
  component: DetalleSalida,
});

interface SalidaDetalle {
  fecha: {
    id: string;
    fecha_salida: string;
    hora_salida: string;
    cupos_total: number;
    cupos_vendidos: number;
    cupos_retenidos: number;
    estado: string;
  };
  tour: { id: string; nombre: string };
  reservas_por_estado: { estado: EstadoReserva; total: number }[];
  opciones: {
    opcion: string;
    campo_id: string;
    cantidad: number;
    agotados: number;
    cupo: number;
  }[];
  manifest: Reserva[];
}

function DetalleSalida() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [pestaña, setPestaña] = useState<"general" | "manifiesto" | "cocina">("general");

  const { data, isPending, isError } = useQuery({
    queryKey: ["admin", "salida", id],
    queryFn: () => api.admin.salida(id) as Promise<SalidaDetalle>,
  });

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "salida", id] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "salidas"] });
  };

  const exportar = useMutation({
    mutationFn: (tipo: "manifest" | "cocina") =>
      api.admin.crearExportacion(tipo, { fecha_tour_id: id }),
    onSuccess: (_d, tipo) => {
      toast.success(
        `Exportación de ${tipo === "manifest" ? "manifiesto" : "cocina"} en cola. Descárgala desde Reportes.`,
      );
    },
    onError: () => toast.error("No pudimos solicitar la exportación."),
  });

  if (isPending) {
    return (
      <AdminShell
        titulo="Salida"
        breadcrumb={[
          { label: "Panel", to: "/admin" },
          { label: "Salidas", to: "/admin/salidas" },
        ]}
      >
        <p className="text-sm text-muted-foreground">Cargando salida…</p>
      </AdminShell>
    );
  }
  if (isError || !data) {
    return (
      <AdminShell
        titulo="Salida"
        breadcrumb={[
          { label: "Panel", to: "/admin" },
          { label: "Salidas", to: "/admin/salidas" },
        ]}
      >
        <p className="text-sm text-muted-foreground">No pudimos cargar la salida.</p>
      </AdminShell>
    );
  }

  const { fecha, tour, reservas_por_estado, opciones, manifest } = data;
  const ocupacion = fecha.cupos_vendidos + fecha.cupos_retenidos;
  const porcentaje = fecha.cupos_total > 0 ? (ocupacion / fecha.cupos_total) * 100 : 0;
  const totalDe = (estados: EstadoReserva[]) =>
    reservas_por_estado
      .filter((e) => estados.includes(e.estado))
      .reduce((acc, e) => acc + e.total, 0);

  return (
    <AdminShell
      titulo={tour.nombre}
      breadcrumb={[
        { label: "Panel", to: "/admin" },
        { label: "Salidas", to: "/admin/salidas" },
        { label: "Detalle" },
      ]}
    >
      <div className="flex flex-col gap-6">
        {/* Cabecera */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/salidas"
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Volver
            </Link>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">{tour.nombre}</h2>
              <p className="text-sm text-muted-foreground">
                {formatDate(fecha.fecha_salida)} · {formatTime(fecha.hora_salida)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <BadgeEstado estado={fecha.estado} />
          </div>
        </div>

        {/* Resumen rápido */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" aria-hidden="true" />
              Ocupación
            </div>
            <p className="mt-2 text-2xl font-extrabold text-foreground">
              {ocupacion}/{fecha.cupos_total}
            </p>
            <p className="text-xs text-muted-foreground">{porcentaje.toFixed(0)}% lleno</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Confirmadas
            </div>
            <p className="mt-2 text-2xl font-extrabold text-foreground">
              {totalDe(["confirmada", "completada"])}
            </p>
            <p className="text-xs text-muted-foreground">reservas pagadas</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Pendientes
            </div>
            <p className="mt-2 text-2xl font-extrabold text-foreground">
              {totalDe([
                "enlace_creado",
                "en_registro",
                "pendiente_firma",
                "pendiente_pago",
                "pago_en_verificacion",
              ])}
            </p>
            <p className="text-xs text-muted-foreground">en curso</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
              Opciones
            </div>
            <p className="mt-2 text-2xl font-extrabold text-foreground">{opciones.length}</p>
            <p className="text-xs text-muted-foreground">de cupo</p>
          </div>
        </div>

        {/* Pestañas */}
        <div className="flex items-center gap-1 rounded-xl border border-input bg-card p-1 overflow-x-auto">
          {(["general", "manifiesto", "cocina"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPestaña(p)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
                pestaña === p ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Contenido según pestaña */}
        {pestaña === "general" && <General id={id} fecha={fecha} onCambio={invalidar} />}
        {pestaña === "manifiesto" && (
          <Manifiesto
            manifest={manifest}
            exportando={exportar.isPending}
            onExportar={() => exportar.mutate("manifest")}
          />
        )}
        {pestaña === "cocina" && (
          <Cocina
            opciones={opciones}
            exportando={exportar.isPending}
            onExportar={() => exportar.mutate("cocina")}
          />
        )}
      </div>
    </AdminShell>
  );
}

function General({
  id,
  fecha,
  onCambio,
}: {
  id: string;
  fecha: SalidaDetalle["fecha"];
  onCambio: () => void;
}) {
  const queryClient = useQueryClient();
  const [dialogo, setDialogo] = useState<"cerrar" | "cancelar" | "sobrecupo" | null>(null);

  const cerrar = useMutation({
    mutationFn: (body: { expirar_pendientes: boolean; motivo: string }) =>
      api.admin.cerrarFecha(id, body),
    onSuccess: () => {
      toast.success("Fecha cerrada");
      setDialogo(null);
      onCambio();
      void queryClient.invalidateQueries({ queryKey: ["admin", "salidas"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo cerrar la fecha"),
  });

  const cancelar = useMutation({
    mutationFn: (body: { motivo: string; confirmacion: string }) =>
      api.admin.cancelarFecha(id, body),
    onSuccess: () => {
      toast.success("Fecha cancelada");
      setDialogo(null);
      onCambio();
      void queryClient.invalidateQueries({ queryKey: ["admin", "salidas"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo cancelar la fecha"),
  });

  const sobrecupo = useMutation({
    mutationFn: (body: { cupos_extra: number; motivo: string; codigo_totp: string }) =>
      api.admin.autorizarSobrecupo(id, body),
    onSuccess: () => {
      toast.success("Sobrecupo autorizado");
      setDialogo(null);
      onCambio();
      void queryClient.invalidateQueries({ queryKey: ["admin", "salidas"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "No se pudo autorizar el sobrecupo"),
  });

  const disponibles = fecha.cupos_total - fecha.cupos_vendidos - fecha.cupos_retenidos;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <h2 className="text-lg font-bold">Disponibilidad general</h2>

      <div className="mt-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Cupo total</span>
          <span className="text-sm font-semibold text-foreground">{fecha.cupos_total}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Vendidos</span>
          <span className="text-sm font-semibold text-foreground">{fecha.cupos_vendidos}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Retenidos</span>
          <span className="text-sm font-semibold text-foreground">{fecha.cupos_retenidos}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Disponibles</span>
          <span className="text-sm font-semibold text-foreground">{disponibles}</span>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-6">
        <h3 className="text-sm font-bold text-foreground">Acciones de fecha</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => setDialogo("cerrar")}
            disabled={fecha.estado !== "publicada"}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            Cerrar fecha
          </button>
          <button
            onClick={() => setDialogo("cancelar")}
            disabled={fecha.estado === "cancelada"}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Cancelar fecha
          </button>
          <button
            onClick={() => setDialogo("sobrecupo")}
            disabled={fecha.estado !== "publicada"}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            <Unlock className="h-4 w-4" aria-hidden="true" />
            Autorizar sobrecupo
          </button>
        </div>
      </div>

      {dialogo === "cerrar" && (
        <DialogoCerrar
          cargando={cerrar.isPending}
          onConfirmar={(motivo, expirar) => cerrar.mutate({ motivo, expirar_pendientes: expirar })}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo === "cancelar" && (
        <DialogoCancelar
          cargando={cancelar.isPending}
          onConfirmar={(motivo, confirmacion) => cancelar.mutate({ motivo, confirmacion })}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo === "sobrecupo" && (
        <DialogoSobrecupo
          cargando={sobrecupo.isPending}
          onConfirmar={(motivo, cuposExtra) =>
            sobrecupo.mutate({ cupos_extra: cuposExtra, motivo, codigo_totp: "" })
          }
          onCerrar={() => setDialogo(null)}
        />
      )}
    </div>
  );
}

function Manifiesto({
  manifest,
  exportando,
  onExportar,
}: {
  manifest: Reserva[];
  exportando: boolean;
  onExportar: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Manifiesto de pasajeros</h2>
        <button
          onClick={onExportar}
          disabled={exportando}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {exportando ? "Solicitando…" : "Exportar XLSX"}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {manifest.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay reservas activas en esta salida.</p>
        )}
        {manifest.map((reserva) => (
          <Link
            key={reserva.id}
            to="/admin/reservas/$id"
            params={{ id: reserva.id }}
            className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3 transition-colors hover:border-primary/40"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">
                {reserva.titular_nombre || reserva.titular?.nombre || "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {reserva.ref_corta} · {reserva.pasajeros?.length ?? 0} pasajeros
              </p>
            </div>
            <BadgeEstado estado={reserva.estado} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function Cocina({
  opciones,
  exportando,
  onExportar,
}: {
  opciones: SalidaDetalle["opciones"];
  exportando: boolean;
  onExportar: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Cocina (conteo de opciones)</h2>
        <button
          onClick={onExportar}
          disabled={exportando}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {exportando ? "Solicitando…" : "Exportar XLSX"}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {opciones.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Esta salida no tiene opciones de cupo configuradas.
          </p>
        )}
        {opciones.map((op) => (
          <div
            key={`${op.campo_id}-${op.opcion}`}
            className="rounded-lg border border-border bg-muted/50 p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{op.opcion}</p>
              <span className="text-sm font-bold text-foreground">
                {op.agotados} reservados / {op.cupo} cupo
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DialogoCerrar({
  cargando,
  onConfirmar,
  onCerrar,
}: {
  cargando: boolean;
  onConfirmar: (motivo: string, expirarPendientes: boolean) => void;
  onCerrar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [expirar, setExpirar] = useState(true);
  return (
    <DialogoMotivo
      abierto
      onAbiertoChange={(abierto) => {
        if (!abierto) onCerrar();
      }}
      titulo="Cerrar fecha"
      descripcion="Al cerrar la fecha, se dejará de aceptar nuevas reservas."
      etiquetaConfirmar="Cerrar fecha"
      motivo={motivo}
      onMotivoChange={setMotivo}
      cargando={cargando}
      onConfirmar={(m) => onConfirmar(m, expirar)}
      extra={
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={expirar}
            onChange={(e) => setExpirar(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          Expirar las reservas pendientes de pago
        </label>
      }
    />
  );
}

function DialogoCancelar({
  cargando,
  onConfirmar,
  onCerrar,
}: {
  cargando: boolean;
  onConfirmar: (motivo: string, confirmacion: string) => void;
  onCerrar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  return (
    <DialogoMotivo
      abierto
      onAbiertoChange={(abierto) => {
        if (!abierto) onCerrar();
      }}
      titulo="Cancelar fecha"
      descripcion="Esta acción cancelará la salida por completo. Las reservas confirmadas requerirán acción (reprogramar o reembolso). Las pendientes expirarán."
      etiquetaConfirmar="Cancelar fecha"
      destructivo
      motivo={motivo}
      onMotivoChange={setMotivo}
      confirmacionEsperada="CANCELAR"
      confirmacion={confirmacion}
      onConfirmacionChange={setConfirmacion}
      etiquetaConfirmacion="Escribe CANCELAR para confirmar"
      cargando={cargando}
      onConfirmar={(m) => onConfirmar(m, confirmacion.trim())}
    />
  );
}

function DialogoSobrecupo({
  cargando,
  onConfirmar,
  onCerrar,
}: {
  cargando: boolean;
  onConfirmar: (motivo: string, cuposExtra: number) => void;
  onCerrar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [cuposExtra, setCuposExtra] = useState("1");
  const n = Number(cuposExtra);
  const valido = Number.isInteger(n) && n > 0;
  return (
    <DialogoMotivo
      abierto
      onAbiertoChange={(abierto) => {
        if (!abierto) onCerrar();
      }}
      titulo="Autorizar sobrecupo"
      descripcion="Especifica cuántos cupos extra se autorizan sobre el cupo total de la fecha."
      etiquetaConfirmar="Autorizar sobrecupo"
      motivo={motivo}
      onMotivoChange={setMotivo}
      cargando={cargando}
      onConfirmar={(m) => valido && onConfirmar(m, n)}
      extra={
        <label className="flex flex-col gap-1 text-sm text-foreground">
          <span>Cupos extra</span>
          <input
            type="number"
            min={1}
            value={cuposExtra}
            onChange={(e) => setCuposExtra(e.target.value)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          />
          {!valido ? (
            <span className="text-xs text-destructive">Indica un número entero mayor que 0.</span>
          ) : null}
        </label>
      }
    />
  );
}
