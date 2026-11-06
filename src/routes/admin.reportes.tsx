import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Download,
  FileText,
  DollarSign,
  TrendingUp,
  Calendar,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Campo } from "@/components/admin/Campo";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { MARCA } from "@/lib/brand";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/reportes")({
  head: () => ({
    meta: [
      { title: "Reportes · Panel" },
      { name: "description", content: "Reportes de ventas, pagos y exportaciones." },
    ],
  }),
  component: Reportes,
});

// Mock data para demo
const reportesMock = [
  {
    id: "ventas-tour",
    titulo: "Ventas por tour",
    descripcion: "Resumen de ventas y ocupación por tour en un período",
    icono: TrendingUp,
    tipo: "grafico",
  },
  {
    id: "ventas-fecha",
    titulo: "Ventas por fecha",
    descripcion: "Ventas agrupadas por fecha de salida",
    icono: Calendar,
    tipo: "tabla",
  },
  {
    id: "pagos-pendientes",
    titulo: "Pagos pendientes",
    descripcion: "Pagos en verificación y por validar",
    icono: DollarSign,
    tipo: "lista",
  },
  {
    id: "reembolsos",
    titulo: "Reembolsos",
    descripcion: "Historial de reembolsos procesados",
    icono: FileText,
    tipo: "tabla",
  },
  {
    id: "ocupacion",
    titulo: "Ocupación",
    descripcion: "Tasa de ocupación por tour y fecha",
    icono: TrendingUp,
    tipo: "grafico",
  },
];

const exportacionesMock = [
  {
    id: "1",
    nombre: "Ventas Noviembre 2026",
    tipo: "ventas",
    fecha: "1 nov 2026",
    estado: "completada",
    enlace: "#",
  },
  {
    id: "2",
    nombre: "Pagos pendientes",
    tipo: "pagos",
    fecha: "3 nov 2026",
    estado: "en_proceso",
    enlace: null,
  },
];

function Reportes() {
  const [rango, setRango] = useState("30_dias");
  const [generando, setGenerando] = useState<string | null>(null);
  const [exportaciones, setExportaciones] = useState(exportacionesMock);

  const handleGenerarReporte = async (reporteId: string) => {
    setGenerando(reporteId);
    try {
      // TODO: Integrar con la API real
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast.success("Reporte generado exitosamente");
    } catch (error) {
      toast.error("No pudimos generar el reporte");
    } finally {
      setGenerando(null);
    }
  };

  const handleExportar = async (tipo: string) => {
    try {
      // TODO: Integrar con la API real: POST /exportaciones
      const nuevaExportacion = {
        id: Date.now().toString(),
        nombre: `Exportación ${tipo} ${new Date().toLocaleDateString("es-VE")}`,
        tipo,
        fecha: new Date().toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" }),
        estado: "en_proceso" as const,
        enlace: null,
      };
      setExportaciones([nuevaExportacion, ...exportaciones]);
      toast.success("Exportación iniciada");

      // Simular completado
      setTimeout(() => {
        setExportaciones((prev) =>
          prev.map((e) =>
            e.id === nuevaExportacion.id
              ? { ...e, estado: "completada" as const, enlace: "#" }
              : e,
          ),
        );
        toast.success("Exportación completada");
      }, 3000);
    } catch (error) {
      toast.error("No pudimos iniciar la exportación");
    }
  };

  return (
    <AdminShell
      titulo="Reportes"
      breadcrumb={[{ label: "Panel", to: "/admin" }, { label: "Reportes" }]}
    >
      <div className="flex flex-col gap-6">
        {/* Cabecera */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">Reportes</h2>
            <p className="text-sm text-muted-foreground">
              Análisis de ventas, pagos y exportaciones de datos
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-input bg-card p-1">
            {["7_dias", "30_dias", "90_dias", "12_meses"].map((r) => (
              <button
                key={r}
                onClick={() => setRango(r)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  rango === r
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {r === "7_dias" ? "7 días" : r === "30_dias" ? "30 días" : r === "90_dias" ? "90 días" : "12 meses"}
              </button>
            ))}
          </div>
        </div>

        {/* Reportes disponibles */}
        <div>
          <h2 className="text-sm font-bold text-foreground">Reportes disponibles</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reportesMock.map((reporte) => (
              <TarjetaReporte
                key={reporte.id}
                reporte={reporte}
                generando={generando === reporte.id}
                onGenerar={() => handleGenerarReporte(reporte.id)}
              />
            ))}
          </div>
        </div>

        {/* Exportaciones */}
        <div>
          <h2 className="text-sm font-bold text-foreground">Exportaciones recientes</h2>
          <div className="mt-3 rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="space-y-3">
              {exportaciones.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay exportaciones recientes.</p>
              ) : (
                exportaciones.map((exportacion) => (
                  <FilaExportacion key={exportacion.id} exportacion={exportacion} />
                ))
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => handleExportar("ventas")}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Exportar ventas
              </button>
              <button
                onClick={() => handleExportar("pagos")}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Exportar pagos
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function TarjetaReporte({
  reporte,
  generando,
  onGenerar,
}: {
  reporte: (typeof reportesMock)[0];
  generando: boolean;
  onGenerar: () => void;
}) {
  const Icono = reporte.icono;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icono className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-foreground">{reporte.titulo}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{reporte.descripcion}</p>
        </div>
      </div>

      <BotonCargar
        onClick={onGenerar}
        cargando={generando}
        className="mt-4 w-full"
        variant="outline"
      >
        {generando ? "Generando..." : "Generar reporte"}
      </BotonCargar>
    </div>
  );
}

function FilaExportacion({
  exportacion,
}: {
  exportacion: (typeof exportacionesMock)[0];
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{exportacion.nombre}</p>
        <p className="text-xs text-muted-foreground">
          {exportacion.fecha} · {exportacion.tipo}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {exportacion.estado === "en_proceso" ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Procesando...
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
            <a
              href={exportacion.enlace || "#"}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Descargar
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
