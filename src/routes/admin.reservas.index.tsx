import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { Plus, Search, Filter, Clock, AlertTriangle, Calendar, Users } from "lucide-react";
import { BadgeEstado } from "@/components/admin/BadgeEstado";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/EmptyState";
import { SheetBottom } from "@/components/admin/SheetBottom";
import { Campo } from "@/components/admin/Campo";
import { api } from "@/lib/api";
import { formatDate, formatTime, formatCountdown } from "@/lib/format";
import type { EstadoPago, EstadoReserva, Reserva } from "@/lib/domain/types";

export const Route = createFileRoute("/admin/reservas/")({
  head: () => ({
    meta: [
      { title: "Reservas · Panel" },
      { name: "description", content: "Tablero y lista de reservas de la agencia." },
    ],
  }),
  component: Reservas,
});

const ESTADOS_KANBAN: { id: EstadoReserva; label: string }[] = [
  { id: "enlace_creado", label: "Enlace creado" },
  { id: "en_registro", label: "En registro" },
  { id: "pendiente_firma", label: "Pendiente firma" },
  { id: "pendiente_pago", label: "Pendiente pago" },
  { id: "pago_en_verificacion", label: "Pago por verificar" },
  { id: "confirmada", label: "Confirmada" },
  { id: "completada", label: "Completada" },
  { id: "cancelada", label: "Cancelada" },
  { id: "expirada", label: "Expirada" },
];

const ESTADOS_FILTRO: { id: EstadoReserva; label: string }[] = ESTADOS_KANBAN;

const ESTADOS_PAGO_FILTRO: { id: EstadoPago; label: string }[] = [
  { id: "sin_pago", label: "Sin pago" },
  { id: "reportado", label: "Reportado" },
  { id: "parcial", label: "Parcial" },
  { id: "pagado", label: "Pagado" },
  { id: "rechazado", label: "Rechazado" },
  { id: "reembolsado", label: "Reembolsado" },
];

function Reservas() {
  const [vista, setVista] = useState<"lista" | "kanban">("lista");
  const [busqueda, setBusqueda] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [estadoSeleccionado, setEstadoSeleccionado] = useState<EstadoReserva | "">("");
  const [pagoSeleccionado, setPagoSeleccionado] = useState<EstadoPago | "">("");

  const busquedaDebounced = useDeferredValue(busqueda);

  const { data, isPending, isError } = useQuery({
    queryKey: ["admin", "reservas", busquedaDebounced, estadoSeleccionado, pagoSeleccionado],
    queryFn: () =>
      api.admin.reservas({
        busqueda: busquedaDebounced || undefined,
        estado: estadoSeleccionado || undefined,
        estado_pago: pagoSeleccionado || undefined,
        limite: 100,
      }),
  });

  const reservas = data?.items ?? [];

  return (
    <AdminShell
      titulo="Reservas"
      breadcrumb={[{ label: "Panel", to: "/admin" }, { label: "Reservas" }]}
      acciones={
        <>
          <button
            onClick={() => setFiltrosAbiertos(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            Filtros
          </button>

          <Link
            to="/admin/reservas/nueva"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nueva reserva
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          {isPending ? "Cargando…" : `${data?.total ?? reservas.length} reservas en total`}
        </p>

        {/* Barra de búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por referencia, código o referencia interna…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Toggle de vista */}
        <div className="flex items-center gap-1 rounded-xl border border-input bg-card p-1 w-fit">
          <button
            onClick={() => setVista("lista")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              vista === "lista" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
            }`}
          >
            Lista
          </button>
          <button
            onClick={() => setVista("kanban")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              vista === "kanban"
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground"
            }`}
          >
            Kanban
          </button>
        </div>

        {/* Contenido según vista */}
        {isError ? (
          <EmptyState
            titulo="No pudimos cargar las reservas"
            descripcion="Revisa tu conexión e inténtalo de nuevo."
          />
        ) : vista === "lista" ? (
          <ListaReservas reservas={reservas} />
        ) : (
          <KanbanReservas reservas={reservas} />
        )}

        {/* Panel de filtros */}
        <SheetBottom
          titulo="Filtros"
          abierto={filtrosAbiertos}
          onAbiertoCambia={(abiertoHojita) => {
            if (!abiertoHojita) setFiltrosAbiertos(false);
          }}
        >
          <div className="space-y-4 p-4">
            <Campo
              label="Estado de la reserva"
              type="select"
              value={estadoSeleccionado}
              onChange={(e) => setEstadoSeleccionado(e.target.value as EstadoReserva | "")}
            >
              <option value="">Todos los estados</option>
              {ESTADOS_FILTRO.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </Campo>
            <Campo
              label="Estado de pago"
              type="select"
              value={pagoSeleccionado}
              onChange={(e) => setPagoSeleccionado(e.target.value as EstadoPago | "")}
            >
              <option value="">Todos los pagos</option>
              {ESTADOS_PAGO_FILTRO.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </Campo>
            <button
              onClick={() => setFiltrosAbiertos(false)}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Aplicar filtros
            </button>
          </div>
        </SheetBottom>
      </div>
    </AdminShell>
  );
}

function ListaReservas({ reservas }: { reservas: Reserva[] }) {
  if (reservas.length === 0) {
    return (
      <EmptyState
        titulo="No hay reservas"
        descripcion="No encontramos reservas con los filtros actuales."
      />
    );
  }

  return (
    <div className="space-y-3">
      {reservas.map((reserva) => (
        <TarjetaReserva key={reserva.id} reserva={reserva} />
      ))}
    </div>
  );
}

function alertaDe(reserva: Reserva): string | null {
  if (reserva.requiere_accion) return reserva.requiere_accion;
  if (reserva.expira_en) {
    const restante = new Date(reserva.expira_en).getTime() - Date.now();
    if (restante > 0 && restante < 24 * 3600 * 1000) return "por_expirar";
  }
  return null;
}

function TarjetaReserva({ reserva }: { reserva: Reserva }) {
  const alerta = alertaDe(reserva);
  const saldo = Number(reserva.saldo_usd ?? 0);

  return (
    <Link
      to="/admin/reservas/$id"
      params={{ id: reserva.id }}
      className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">{reserva.ref_corta}</span>
            {alerta && (
              <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {alerta === "por_expirar" ? "Por expirar" : alerta}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {reserva.titular_nombre || reserva.titular?.nombre || "—"}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{reserva.tour_nombre || "Tour"}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            {reserva.fecha_salida ? (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" aria-hidden="true" />
                {formatDate(reserva.fecha_salida)}
                {reserva.hora_salida ? ` · ${formatTime(reserva.hora_salida)}` : ""}
              </span>
            ) : null}
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              {reserva.pasajeros?.length ?? 0} pax
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <BadgeEstado estado={reserva.estado_pago} />
          {saldo > 0 && (
            <span className="text-sm font-bold text-foreground">${reserva.saldo_usd}</span>
          )}
          {reserva.expira_en &&
            !["confirmada", "completada", "cancelada", "expirada"].includes(reserva.estado) && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {formatCountdown(new Date(reserva.expira_en).getTime() - Date.now())}
              </span>
            )}
        </div>
      </div>
    </Link>
  );
}

function KanbanReservas({ reservas }: { reservas: Reserva[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {ESTADOS_KANBAN.map((estado) => {
        const delEstado = reservas.filter((r) => r.estado === estado.id);
        if (
          delEstado.length === 0 &&
          ![
            "enlace_creado",
            "en_registro",
            "pendiente_firma",
            "pendiente_pago",
            "pago_en_verificacion",
            "confirmada",
          ].includes(estado.id)
        ) {
          return null;
        }
        return (
          <div key={estado.id} className="min-w-[280px] flex-1">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">{estado.label}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {delEstado.length}
              </span>
            </div>
            <div className="space-y-2">
              {delEstado.map((reserva) => (
                <TarjetaReserva key={reserva.id} reserva={reserva} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
