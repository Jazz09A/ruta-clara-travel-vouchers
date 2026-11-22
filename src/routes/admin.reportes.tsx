import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { api, apiAbsUrl } from "@/lib/api";
import { toast } from "sonner";
import type { EstadoExportacion, Exportacion, TipoExportacion } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/reportes")({
  head: () => ({
    meta: [
      { title: "Reportes · Panel" },
      { name: "description", content: "Reportes de ventas, pagos y exportaciones XLSX." },
    ],
  }),
  component: Reportes,
});

const TIPOS_EXPORTACION: {
  valor: TipoExportacion;
  etiqueta: string;
  descripcion: string;
  requiereSalida: boolean;
}[] = [
  {
    valor: "reservas",
    etiqueta: "Reservas",
    descripcion: "Todas las reservas con estado y totales",
    requiereSalida: false,
  },
  {
    valor: "tours",
    etiqueta: "Tours",
    descripcion: "Catálogo de tours activos",
    requiereSalida: false,
  },
  {
    valor: "clientes",
    etiqueta: "Clientes",
    descripcion: "Clientes con historial de reservas",
    requiereSalida: false,
  },
  {
    valor: "pagos",
    etiqueta: "Pagos",
    descripcion: "Pagos reportados y validados",
    requiereSalida: false,
  },
  {
    valor: "pasajeros_tour",
    etiqueta: "Pasajeros por tour",
    descripcion: "Manifiesto de pasajeros de una salida",
    requiereSalida: true,
  },
  {
    valor: "manifest",
    etiqueta: "Manifiesto",
    descripcion: "Lista de pasajeros para la salida",
    requiereSalida: true,
  },
  {
    valor: "cocina",
    etiqueta: "Cocina",
    descripcion: "Conteo de almuerzos y desayunos por opción",
    requiereSalida: true,
  },
];

const ETIQUETA_ESTADO: Record<EstadoExportacion, { texto: string; clase: string }> = {
  en_cola: { texto: "En cola", clase: "bg-muted text-muted-foreground" },
  procesando: { texto: "Generando", clase: "bg-blue-100 text-blue-700" },
  lista: { texto: "Lista", clase: "bg-green-100 text-green-700" },
  error: { texto: "Error", clase: "bg-red-100 text-red-700" },
  expirada: { texto: "Expirada", clase: "bg-muted text-muted-foreground line-through" },
};

function Reportes() {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<TipoExportacion>("reservas");
  const [fechaTourId, setFechaTourId] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Historial de exportaciones (polling mientras haya pendientes)
  const {
    data: exportaciones = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["exportaciones"],
    queryFn: () => api.admin.exportaciones(),
    refetchInterval: (query) => {
      const items = query.state.data as Exportacion[] | undefined;
      const hayPendientes = items?.some((e) => e.estado === "en_cola" || e.estado === "procesando");
      return hayPendientes ? 3000 : false;
    },
  });

  // Salidas disponibles para filtros que requieren fecha_tour_id
  const { data: salidas } = useQuery({
    queryKey: ["salidas-exportacion"],
    queryFn: () => api.admin.salidas(),
    enabled: TIPOS_EXPORTACION.find((t) => t.valor === tipo)?.requiereSalida ?? false,
  });

  const crearMutation = useMutation({
    mutationFn: (payload: { tipo: TipoExportacion; filtros: Record<string, unknown> }) =>
      api.admin.crearExportacion(payload.tipo, payload.filtros),
    onSuccess: () => {
      toast.success("Exportación en cola. Te avisaremos cuando esté lista.");
      queryClient.invalidateQueries({ queryKey: ["exportaciones"] });
    },
    onError: () => {
      toast.error("No pudimos iniciar la exportación");
    },
  });

  const descargarMutation = useMutation({
    mutationFn: (id: string) => api.admin.descargarExportacion(id),
    onSuccess: (data) => {
      // Abrir URL firmada en nueva pestaña
      window.open(apiAbsUrl(data.url), "_blank");
    },
    onError: () => {
      toast.error("No pudimos obtener el enlace de descarga");
    },
  });

  const tipoActual = TIPOS_EXPORTACION.find((t) => t.valor === tipo)!;

  const handleGenerar = () => {
    const filtros: Record<string, unknown> = {};
    if (tipoActual.requiereSalida) {
      if (!fechaTourId) {
        toast.error("Selecciona una salida");
        return;
      }
      filtros["fecha_tour_id"] = fechaTourId;
    }
    if (fechaDesde) filtros["fecha_desde"] = fechaDesde;
    if (fechaHasta) filtros["fecha_hasta"] = fechaHasta;

    crearMutation.mutate({ tipo, filtros });
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
              Exporta datos operativos en Excel (XLSX)
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Actualizar
          </button>
        </div>

        {/* Nueva exportación */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h3 className="text-sm font-bold text-foreground">Nueva exportación</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            El archivo se genera en segundo plano y se guarda de forma privada por 24 horas.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Tipo de exportación */}
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">Tipo de datos</label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {TIPOS_EXPORTACION.map((t) => (
                  <button
                    key={t.valor}
                    onClick={() => setTipo(t.valor)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      tipo === t.valor
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:bg-accent",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet
                        className={cn(
                          "h-4 w-4",
                          tipo === t.valor ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span className="text-sm font-semibold">{t.etiqueta}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{t.descripcion}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Filtro: salida (si aplica) */}
            {tipoActual.requiereSalida && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Salida</label>
                <select
                  value={fechaTourId}
                  onChange={(e) => setFechaTourId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecciona una salida…</option>
                  {(salidas ?? []).map((s) => (
                    <option key={s.fecha_tour_id} value={s.fecha_tour_id}>
                      {s.tour} — {s.fecha} {s.hora}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Filtros de fecha (opcional para algunos tipos) */}
            {!tipoActual.requiereSalida && (
              <>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Desde (opcional)
                  </label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Hasta (opcional)
                  </label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}
          </div>

          <BotonCargar onClick={handleGenerar} cargando={crearMutation.isPending} className="mt-4">
            <Download className="h-4 w-4" />
            Generar XLSX
          </BotonCargar>
        </div>

        {/* Historial */}
        <div>
          <h3 className="text-sm font-bold text-foreground">Exportaciones recientes</h3>
          <div className="mt-3 rounded-2xl border border-border bg-card p-5 shadow-card">
            {exportaciones.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay exportaciones aún.</p>
            ) : (
              <div className="space-y-3">
                {exportaciones.map((exp) => (
                  <FilaExportacion
                    key={exp.id}
                    exportacion={exp}
                    onDescargar={() => descargarMutation.mutate(exp.id)}
                    descargando={
                      descargarMutation.isPending && descargarMutation.variables === exp.id
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function FilaExportacion({
  exportacion,
  onDescargar,
  descargando,
}: {
  exportacion: Exportacion;
  onDescargar: () => void;
  descargando: boolean;
}) {
  const estado = ETIQUETA_ESTADO[exportacion.estado];
  const tipo = TIPOS_EXPORTACION.find((t) => t.valor === exportacion.tipo);

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {exportacion.nombre_archivo ?? `${tipo?.etiqueta ?? exportacion.tipo}`}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(exportacion.creado_en).toLocaleString("es-VE", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {" · "}
          {tipo?.etiqueta ?? exportacion.tipo}
        </p>
        {exportacion.error && <p className="mt-1 text-xs text-red-600">{exportacion.error}</p>}
      </div>

      <div className="flex items-center gap-3">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", estado.clase)}>
          {estado.texto}
        </span>

        {exportacion.estado === "lista" && (
          <button
            onClick={onDescargar}
            disabled={descargando}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline disabled:opacity-50"
          >
            {descargando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Descargar
          </button>
        )}

        {exportacion.estado === "en_cola" && <Clock className="h-4 w-4 text-muted-foreground" />}
        {exportacion.estado === "procesando" && (
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        )}
        {exportacion.estado === "error" && <AlertCircle className="h-4 w-4 text-red-600" />}
        {exportacion.estado === "lista" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
      </div>
    </div>
  );
}
