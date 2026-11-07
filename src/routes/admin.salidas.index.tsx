import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Calendar, Users, AlertTriangle, Filter } from "lucide-react";
import { BadgeEstado } from "@/components/admin/BadgeEstado";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/EmptyState";
import { SheetBottom } from "@/components/admin/SheetBottom";
import { Campo } from "@/components/admin/Campo";
import { api } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/format";
import { MARCA } from "@/lib/brand";

export const Route = createFileRoute("/admin/salidas/")({
  head: () => ({
    meta: [
      { title: "Salidas · Panel" },
      { name: "description", content: "Calendario de fechas de salida de los tours." },
    ],
  }),
  component: Salidas,
});

interface Salida {
  fecha_tour_id: string;
  tour: string;
  tour_id?: string;
  fecha: string;
  hora: string;
  estado: string;
  vendidos: number;
  retenidos: number;
  total: number;
  alertas: string[];
}

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function Salidas() {
  const [vista, setVista] = useState<"lista" | "calendario">("lista");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [tourSeleccionado, setTourSeleccionado] = useState("");
  const [estadoSeleccionado, setEstadoSeleccionado] = useState("");

  const { data: tours } = useQuery({
    queryKey: ["admin", "tours"],
    queryFn: () => api.admin.tours(),
  });
  const {
    data: salidas,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["admin", "salidas", tourSeleccionado],
    queryFn: () => api.admin.salidas(tourSeleccionado ? { tour_id: tourSeleccionado } : undefined),
  });

  const salidasFiltradas = useMemo<Salida[]>(() => {
    const items = (salidas ?? []) as Salida[];
    return items.filter((s) => !estadoSeleccionado || s.estado === estadoSeleccionado);
  }, [salidas, estadoSeleccionado]);

  // Agrupar por mes para vista lista
  const porMes = salidasFiltradas.reduce(
    (acc, salida) => {
      const mesIdx = Number(salida.fecha.slice(5, 7)) - 1;
      const mes = MESES[mesIdx] ?? salida.fecha.slice(0, 7);
      if (!acc[mes]) acc[mes] = [];
      acc[mes].push(salida);
      return acc;
    },
    {} as Record<string, Salida[]>,
  );

  const estados = useMemo(
    () => [...new Set(salidasFiltradas.map((s) => s.estado))],
    [salidasFiltradas],
  );

  return (
    <AdminShell
      titulo="Salidas"
      breadcrumb={[{ label: "Panel", to: "/admin" }, { label: "Salidas" }]}
      acciones={
        <button
          onClick={() => setFiltrosAbiertos(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          <Filter className="h-4 w-4" aria-hidden="true" />
          Filtros
        </button>
      }
    >
      <div className="flex flex-col gap-6">
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
            onClick={() => setVista("calendario")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              vista === "calendario"
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground"
            }`}
          >
            Calendario
          </button>
        </div>

        {isPending ? (
          <p className="text-sm text-muted-foreground">Cargando salidas…</p>
        ) : isError ? (
          <EmptyState
            titulo="No pudimos cargar las salidas"
            descripcion="Revisa tu conexión e inténtalo de nuevo."
          />
        ) : vista === "lista" ? (
          <ListaSalidas porMes={porMes} />
        ) : (
          <CalendarioSalidas salidas={salidasFiltradas} />
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
              label="Tour"
              type="select"
              value={tourSeleccionado}
              onChange={(e) => setTourSeleccionado(e.target.value)}
            >
              <option value="">Todos los tours</option>
              {(tours ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </Campo>
            <Campo
              label="Estado"
              type="select"
              value={estadoSeleccionado}
              onChange={(e) => setEstadoSeleccionado(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {estados.map((e) => (
                <option key={e} value={e}>
                  {e}
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

function ListaSalidas({ porMes }: { porMes: Record<string, Salida[]> }) {
  if (Object.keys(porMes).length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">No hay salidas con los filtros actuales.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(porMes).map(([mes, salidas]) => (
        <div key={mes}>
          <h2 className="mb-3 text-lg font-bold text-foreground">{mes}</h2>
          <div className="space-y-3">
            {salidas.map((salida) => (
              <TarjetaSalida key={salida.fecha_tour_id} salida={salida} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TarjetaSalida({ salida }: { salida: Salida }) {
  const ocupacion = salida.vendidos + salida.retenidos;
  const porcentaje = salida.total > 0 ? (ocupacion / salida.total) * 100 : 0;
  const alerta = salida.alertas[0];

  return (
    <Link
      to="/admin/salidas/$id"
      params={{ id: salida.fecha_tour_id }}
      className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">{formatDate(salida.fecha)}</span>
            {alerta && (
              <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {alerta}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">{salida.tour}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{formatTime(salida.hora)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <BadgeEstado estado={salida.estado} />
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4" aria-hidden="true" />
            {ocupacion}/{salida.total}
          </div>
        </div>
      </div>

      {/* Barra de ocupación */}
      <div className="mt-3 h-2 rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${
            porcentaje >= 100 ? "bg-destructive" : porcentaje >= 80 ? "bg-warning" : "bg-success"
          }`}
          style={{ width: `${Math.min(porcentaje, 100)}%` }}
        />
      </div>
    </Link>
  );
}

function CalendarioSalidas({ salidas }: { salidas: Salida[] }) {
  // Vista simplificada de calendario (grid de días)
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {salidas.map((salida) => (
        <TarjetaSalida key={salida.fecha_tour_id} salida={salida} />
      ))}
    </div>
  );
}
