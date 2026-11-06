import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  MoreVertical,
  Calendar,
  Users,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { BadgeEstado } from "@/components/admin/BadgeEstado";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/EmptyState";
import { SheetBottom } from "@/components/admin/SheetBottom";
import { Campo } from "@/components/admin/Campo";
import { MARCA } from "@/lib/brand";

export const Route = createFileRoute("/admin/reservas/")({
  head: () => ({
    meta: [
      { title: "Reservas · Panel" },
      { name: "description", content: "Tablero y lista de reservas de la agencia." },
    ],
  }),
  component: Reservas,
});

// Mock data para demo
const reservasMock = [
  {
    id: "1",
    ref_corta: "K7M2QX9A",
    titular: "María Pérez",
    tour: "Full Day Los Roques",
    fecha: "Sáb 14 dic 2026",
    hora: "5:00 a. m.",
    pasajeros: 3,
    paso_actual: "pago",
    estado_pago: "pendiente_pago",
    saldo_usd: "240",
    expira_en: "1 h 30 min",
    ultima_actividad: "hace 30 min",
    alerta: "por_expirar",
  },
  {
    id: "2",
    ref_corta: "X3J9K2L5",
    titular: "José Rodríguez",
    tour: "Fin de semana Mérida",
    fecha: "Vie 13 nov 2026",
    hora: "6:00 a. m.",
    pasajeros: 2,
    paso_actual: "confirmada",
    estado_pago: "pagado",
    saldo_usd: "0",
    expira_en: null,
    ultima_actividad: "hace 2 h",
    alerta: null,
  },
  {
    id: "3",
    ref_corta: "P4M8N3Q6",
    titular: "Ana Gómez",
    tour: "Full Day Colonia Tovar",
    fecha: "Dom 8 nov 2026",
    hora: "6:30 a. m.",
    pasajeros: 4,
    paso_actual: "resumen",
    estado_pago: "pendiente_pago",
    saldo_usd: "360",
    expira_en: "23 h 40 min",
    ultima_actividad: "hace 5 min",
    alerta: null,
  },
  {
    id: "4",
    ref_corta: "T5L7N9M3",
    titular: "Carlos López",
    tour: "Full Day Los Roques",
    fecha: "Sáb 21 dic 2026",
    hora: "5:00 a. m.",
    pasajeros: 1,
    paso_actual: "bienvenida",
    estado_pago: "pendiente_pago",
    saldo_usd: "80",
    expira_en: "23 h 55 min",
    ultima_actividad: "hace 10 min",
    alerta: null,
  },
];

const ESTADOS_KANBAN = [
  { id: "bienvenida", label: "Bienvenida", count: 1 },
  { id: "resumen", label: "Resumen", count: 1 },
  { id: "pago", label: "Pago", count: 1 },
  { id: "confirmada", label: "Confirmada", count: 1 },
];

function Reservas() {
  const [vista, setVista] = useState<"lista" | "kanban">("lista");
  const [busqueda, setBusqueda] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [estadoSeleccionado, setEstadoSeleccionado] = useState("");
  const [pagoSeleccionado, setPagoSeleccionado] = useState("");

  const reservasFiltradas = reservasMock.filter(
    (r) =>
      r.ref_corta.toLowerCase().includes(busqueda.toLowerCase()) ||
      r.titular.toLowerCase().includes(busqueda.toLowerCase()) ||
      r.tour.toLowerCase().includes(busqueda.toLowerCase()),
  );

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
        <p className="text-sm text-muted-foreground">{reservasMock.length} reservas en total</p>

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
            vista === "kanban" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
          }`}
        >
          Kanban
        </button>
      </div>

      {/* Contenido según vista */}
      {vista === "lista" ? (
        <ListaReservas
          reservas={reservasFiltradas}
          onLimpiar={() => {
            setBusqueda("");
            setEstadoSeleccionado("");
            setPagoSeleccionado("");
          }}
        />
      ) : (
        <KanbanReservas reservas={reservasFiltradas} />
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
                    <Campo label="Estado del paso" type="select" value={estadoSeleccionado} onChange={(e) => setEstadoSeleccionado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="bienvenida">Bienvenida</option>
            <option value="resumen">Resumen</option>
            <option value="pago">Pago</option>
            <option value="confirmada">Confirmada</option>
          </Campo>
          <Campo label="Estado de pago" type="select" value={pagoSeleccionado} onChange={(e) => setPagoSeleccionado(e.target.value)}>
            <option value="">Todos los pagos</option>
            <option value="pendiente_pago">Pendiente</option>
            <option value="pagado">Pagado</option>
            <option value="reembolsado">Reembolsado</option>
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

function ListaReservas({
  reservas,
  onLimpiar,
}: {
  reservas: typeof reservasMock;
  onLimpiar: () => void;
}) {
  if (reservas.length === 0) {
    return (
      <EmptyState
        titulo="No hay reservas"
        descripcion="No encontramos reservas con los filtros actuales."
        accion={
          <button
            onClick={onLimpiar}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Limpiar filtros
          </button>
        }
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

function KanbanReservas({ reservas }: { reservas: typeof reservasMock }) {
  return (
    <KanbanColumnas estados={ESTADOS_KANBAN} reservas={reservas} />
  );
}

function TarjetaReserva({ reserva }: { reserva: (typeof reservasMock)[0] }) {
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
            {reserva.alerta && (
              <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {reserva.alerta === "por_expirar" ? "Por expirar" : reserva.alerta}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">{reserva.titular}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{reserva.tour}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              {reserva.fecha}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              {reserva.pasajeros} pax
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <BadgeEstado estado={reserva.estado_pago} />
          {reserva.saldo_usd !== "0" && (
            <span className="text-sm font-bold text-foreground">${reserva.saldo_usd}</span>
          )}
          {reserva.expira_en && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {reserva.expira_en}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function KanbanColumnas({
  estados,
  reservas,
}: {
  estados: typeof ESTADOS_KANBAN;
  reservas: typeof reservasMock;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:overflow-visible">
      {estados.map((estado) => (
        <div key={estado.id} className="min-w-[280px] flex-1">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">{estado.label}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {estado.count}
            </span>
          </div>
          <div className="space-y-2">
            {reservas
              .filter((r) => r.paso_actual === estado.id)
              .map((reserva) => (
                <TarjetaReserva key={reserva.id} reserva={reserva} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
