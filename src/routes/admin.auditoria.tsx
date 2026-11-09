import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { Search, Filter, User, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/EmptyState";
import { SheetBottom } from "@/components/admin/SheetBottom";
import { Campo } from "@/components/admin/Campo";
import { api } from "@/lib/api";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { Auditoria } from "@/lib/domain/types";

export const Route = createFileRoute("/admin/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoría · Panel" },
      { name: "description", content: "Historial de cambios y acciones del sistema." },
    ],
  }),
  component: AuditoriaPage,
});

const ENTIDADES_FILTRO = [
  { id: "", label: "Todas las entidades" },
  { id: "reserva", label: "Reserva" },
  { id: "pago", label: "Pago" },
  { id: "cliente", label: "Cliente" },
  { id: "tour", label: "Tour" },
  { id: "fecha_tour", label: "Fecha de salida" },
  { id: "usuario", label: "Usuario" },
  { id: "configuracion", label: "Configuración" },
  { id: "tasa_cambio", label: "Tasa de cambio" },
];

function AuditoriaPage() {
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [entidadSeleccionada, setEntidadSeleccionada] = useState("");
  const [accionSeleccionada, setAccionSeleccionada] = useState("");

  const busquedaDebounced = useDeferredValue(busqueda);

  const { data, isPending, isError } = useQuery({
    queryKey: ["admin", "auditoria", entidadSeleccionada, accionSeleccionada],
    queryFn: () =>
      api.admin.auditoria({
        entidad: entidadSeleccionada || undefined,
        accion: accionSeleccionada || undefined,
      }),
  });

  const registros = (data ?? []).filter((r) => {
    if (!busquedaDebounced) return true;
    const q = busquedaDebounced.toLowerCase();
    return [r.usuario_nombre, r.accion, r.entidad, r.entidad_id]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  return (
    <AdminShell
      titulo="Auditoría"
      breadcrumb={[{ label: "Panel", to: "/admin" }, { label: "Auditoría" }]}
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
      <div className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">Historial de cambios y acciones del sistema</p>

        {/* Barra de búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por usuario, acción o entidad..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Tabla de auditoría */}
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Usuario</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Acción</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Entidad</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Cambio</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Motivo</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Integridad</th>
                </tr>
              </thead>
              <tbody>
                {isPending && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Cargando auditoría…
                    </td>
                  </tr>
                )}
                {isError && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No pudimos cargar la auditoría.
                    </td>
                  </tr>
                )}
                {!isPending && !isError && registros.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No hay registros con los filtros actuales.
                    </td>
                  </tr>
                )}
                {registros.map((registro) => (
                  <FilaAuditoria key={registro.id} registro={registro} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
              label="Entidad"
              type="select"
              value={entidadSeleccionada}
              onChange={(e) => setEntidadSeleccionada(e.target.value)}
            >
              {ENTIDADES_FILTRO.map((en) => (
                <option key={en.id} value={en.id}>
                  {en.label}
                </option>
              ))}
            </Campo>
            <Campo
              label="Acción (texto)"
              type="text"
              value={accionSeleccionada}
              onChange={(e) => setAccionSeleccionada(e.target.value)}
              placeholder="Ej. reserva.cancelada"
            />
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

const ETIQUETA_ENTIDAD: Record<string, string> = {
  reserva: "Reserva",
  pago: "Pago",
  cliente: "Cliente",
  tour: "Tour",
  fecha_tour: "Salida",
  usuario: "Usuario",
  configuracion: "Configuración",
  tasa_cambio: "Tasa",
};

function FilaAuditoria({ registro }: { registro: Auditoria }) {
  const entidadLabel = ETIQUETA_ENTIDAD[registro.entidad] ?? registro.entidad;
  const valorAnterior =
    registro.valor_anterior && registro.valor_anterior !== "—" ? registro.valor_anterior : null;
  const valorNuevo =
    registro.valor_nuevo && registro.valor_nuevo !== "—" ? registro.valor_nuevo : null;

  return (
    <tr className="border-b border-border hover:bg-muted/30">
      <td className="px-4 py-3 text-muted-foreground" title={formatDateTime(registro.fecha)}>
        {formatRelative(registro.fecha)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium text-foreground">
            {registro.usuario_nombre || "Sistema"}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 font-medium text-foreground">{registro.accion}</td>
      <td className="px-4 py-3">
        {registro.entidad === "reserva" && registro.entidad_id ? (
          <Link
            to="/admin/reservas/$id"
            params={{ id: registro.entidad_id }}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            {entidadLabel}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        ) : registro.entidad === "pago" && registro.entidad_id ? (
          <Link
            to="/admin/pagos/$id"
            params={{ id: registro.entidad_id }}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            {entidadLabel}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        ) : (
          <span className="text-muted-foreground">{entidadLabel}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          {valorAnterior && (
            <div className="text-xs text-muted-foreground">
              Antes: <span className="font-mono">{valorAnterior}</span>
            </div>
          )}
          {valorNuevo && (
            <div className="text-xs text-foreground">
              Después: <span className="font-mono">{valorNuevo}</span>
            </div>
          )}
          {!valorAnterior && !valorNuevo && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{registro.motivo || "—"}</td>
      <td className="px-4 py-3">
        {registro.cadena === "rota" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            Alerta
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            OK
          </span>
        )}
      </td>
    </tr>
  );
}
