import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Calendar, Users, AlertTriangle, Clock, XCircle, CheckCircle2, Filter } from "lucide-react";
import { BadgeEstado } from "@/components/admin/BadgeEstado";
import { AdminShell } from "@/components/admin/AdminShell";
import { SheetBottom } from "@/components/admin/SheetBottom";
import { Campo } from "@/components/admin/Campo";
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

// Mock data para demo
const salidasMock = [
  {
    id: "1",
    tour: "Full Day Los Roques",
    fecha: "Sáb 14 dic 2026",
    hora: "5:00 a. m.",
    cupo_total: 40,
    vendidos: 32,
    retenidos: 2,
    estado: "publicada",
    alerta: "casi_llena",
  },
  {
    id: "2",
    tour: "Full Day Los Roques",
    fecha: "Dom 15 dic 2026",
    hora: "5:00 a. m.",
    cupo_total: 40,
    vendidos: 40,
    retenidos: 0,
    estado: "agotada",
    alerta: null,
  },
  {
    id: "3",
    tour: "Fin de semana Mérida",
    fecha: "Vie 13 nov 2026",
    hora: "6:00 a. m.",
    cupo_total: 30,
    vendidos: 22,
    retenidos: 5,
    estado: "publicada",
    alerta: null,
  },
  {
    id: "4",
    tour: "Full Day Colonia Tovar",
    fecha: "Dom 8 nov 2026",
    hora: "6:30 a. m.",
    cupo_total: 45,
    vendidos: 41,
    retenidos: 0,
    estado: "publicada",
    alerta: "casi_llena",
  },
  {
    id: "5",
    tour: "Full Day Los Roques",
    fecha: "Sáb 21 dic 2026",
    hora: "5:00 a. m.",
    cupo_total: 40,
    vendidos: 0,
    retenidos: 0,
    estado: "cerrada",
    alerta: null,
  },
  {
    id: "6",
    tour: "Fin de semana Mérida",
    fecha: "Vie 20 nov 2026",
    hora: "6:00 a. m.",
    cupo_total: 30,
    vendidos: 15,
    retenidos: 2,
    estado: "cancelada",
    alerta: null,
  },
];

const meses = ["Noviembre", "Diciembre", "Enero"];

function Salidas() {
  const [vista, setVista] = useState<"lista" | "calendario">("lista");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [tourSeleccionado, setTourSeleccionado] = useState("");
  const [estadoSeleccionado, setEstadoSeleccionado] = useState("");

  const salidasFiltradas = salidasMock.filter((s) => {
    if (tourSeleccionado && !s.tour.toLowerCase().includes(tourSeleccionado.toLowerCase())) {
      return false;
    }
    if (estadoSeleccionado && s.estado !== estadoSeleccionado) {
      return false;
    }
    return true;
  });

  // Agrupar por mes para vista lista
  const porMes = salidasFiltradas.reduce(
    (acc, salida) => {
      const mes = salida.fecha.split(" ")[1] ?? "Desconocido"; // Extract month
      if (!acc[mes]) acc[mes] = [];
      acc[mes].push(salida);
      return acc;
    },
    {} as Record<string, typeof salidasMock>,
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

      {/* Contenido según vista */}
      {vista === "lista" ? (
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
                    <Campo label="Tour" type="select" value={tourSeleccionado} onChange={(e) => setTourSeleccionado(e.target.value)}>
            <option value="">Todos los tours</option>
            <option value="los roques">Full Day Los Roques</option>
            <option value="merida">Fin de semana Mérida</option>
            <option value="colonia tovar">Full Day Colonia Tovar</option>
          </Campo>
          <Campo label="Estado" type="select" value={estadoSeleccionado} onChange={(e) => setEstadoSeleccionado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="publicada">Publicada</option>
            <option value="agotada">Agotada</option>
            <option value="cerrada">Cerrada</option>
            <option value="cancelada">Cancelada</option>
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

function ListaSalidas({ porMes }: { porMes: Record<string, typeof salidasMock> }) {
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
              <TarjetaSalida key={salida.id} salida={salida} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TarjetaSalida({ salida }: { salida: (typeof salidasMock)[0] }) {
  const ocupacion = salida.vendidos + salida.retenidos;
  const porcentaje = (ocupacion / salida.cupo_total) * 100;

  return (
    <Link
      to="/admin/salidas/$id"
      params={{ id: salida.id }}
      className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">{salida.fecha}</span>
            {salida.alerta && (
              <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {salida.alerta === "casi_llena" ? "Casi llena" : salida.alerta}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">{salida.tour}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{salida.hora}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <BadgeEstado estado={salida.estado} />
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4" aria-hidden="true" />
            {ocupacion}/{salida.cupo_total}
          </div>
        </div>
      </div>

      {/* Barra de ocupación */}
      <div className="mt-3 h-2 rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${
            porcentaje >= 100
              ? "bg-destructive"
              : porcentaje >= 80
                ? "bg-warning"
                : "bg-success"
          }`}
          style={{ width: `${Math.min(porcentaje, 100)}%` }}
        />
      </div>
    </Link>
  );
}

function CalendarioSalidas({ salidas }: { salidas: typeof salidasMock }) {
  // Vista simplificada de calendario (grid de días)
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {salidas.map((salida) => (
        <TarjetaSalida key={salida.id} salida={salida} />
      ))}
    </div>
  );
}
