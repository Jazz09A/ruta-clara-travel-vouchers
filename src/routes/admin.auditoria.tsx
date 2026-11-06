import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search,
  Filter,
  Shield,
  Clock,
  User,
  FileText,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { BadgeEstado } from "@/components/admin/BadgeEstado";
import { SheetBottom } from "@/components/admin/SheetBottom";
import { Campo } from "@/components/admin/Campo";
import { MARCA } from "@/lib/brand";

export const Route = createFileRoute("/admin/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoría · Panel" },
      { name: "description", content: "Historial de cambios y acciones del sistema." },
    ],
  }),
  component: Auditoria,
});

// Mock data para demo
const auditoriaMock = [
  {
    id: "1",
    usuario: "Manuel (SA)",
    accion: "Actualizar tasa",
    entidad: "Configuración",
    entidad_id: null,
    fecha: "Hace 2 horas",
    valor_anterior: "Bs. 35,50",
    valor_nuevo: "Bs. 36,00",
    motivo: "Ajuste por mercado",
    integridad: "ok",
  },
  {
    id: "2",
    usuario: "Carlos (OP)",
    accion: "Cancelar reserva",
    entidad: "Reserva",
    entidad_id: "K7M2QX9A",
    fecha: "Hace 5 horas",
    valor_anterior: "confirmada",
    valor_nuevo: "cancelada",
    motivo: "Cliente solicitó reembolso",
    integridad: "ok",
  },
  {
    id: "3",
    usuario: "Sistema",
    accion: "Generar voucher",
    entidad: "Reserva",
    entidad_id: "X3J9K2L5",
    fecha: "Hace 1 día",
    valor_anterior: null,
    valor_nuevo: "voucher_generado",
    motivo: null,
    integridad: "ok",
  },
  {
    id: "4",
    usuario: "Ana (VAL)",
    accion: "Aprobar pago",
    entidad: "Pago",
    entidad_id: "PAG-123",
    fecha: "Hace 1 día",
    valor_anterior: "en_verificacion",
    valor_nuevo: "aprobado",
    motivo: "Comprobante válido",
    integridad: "ok",
  },
  {
    id: "5",
    usuario: "Manuel (SA)",
    accion: "Desactivar usuario",
    entidad: "Usuario",
    entidad_id: "USR-456",
    fecha: "Hace 2 días",
    valor_anterior: "activo",
    valor_nuevo: "inactivo",
    motivo: "Salida del equipo",
    integridad: "ok",
  },
];

function Auditoria() {
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState("");
  const [accionSeleccionada, setAccionSeleccionada] = useState("");

  const auditoriaFiltrada = auditoriaMock.filter((registro) => {
    if (busqueda && !registro.usuario.toLowerCase().includes(busqueda.toLowerCase())) {
      return false;
    }
    if (usuarioSeleccionado && !registro.usuario.includes(usuarioSeleccionado)) {
      return false;
    }
    if (accionSeleccionada && !registro.accion.includes(accionSeleccionada)) {
      return false;
    }
    return true;
  });

  return (
    <AdminShell
      titulo="Auditoría"
      breadcrumb={[{ label: "Panel", to: "/admin" }, { label: "Auditoría" }]}
    >
      <div className="flex flex-col gap-6">
        {/* Cabecera */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">Auditoría</h2>
            <p className="text-sm text-muted-foreground">
              Historial de cambios y acciones del sistema
            </p>
          </div>

          <button
            onClick={() => setFiltrosAbiertos(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            Filtros
          </button>
        </div>

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
                {auditoriaFiltrada.map((registro) => (
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
                        <Campo label="Usuario" type="select" value={usuarioSeleccionado} onChange={(e) => setUsuarioSeleccionado(e.target.value)}>
              <option value="">Todos los usuarios</option>
              <option value="Manuel">Manuel (SA)</option>
              <option value="Carlos">Carlos (OP)</option>
              <option value="Ana">Ana (VAL)</option>
              <option value="Sistema">Sistema</option>
            </Campo>
            <Campo label="Acción" type="select" value={accionSeleccionada} onChange={(e) => setAccionSeleccionada(e.target.value)}>
              <option value="">Todas las acciones</option>
              <option value="Actualizar">Actualizar</option>
              <option value="Cancelar">Cancelar</option>
              <option value="Aprobar">Aprobar</option>
              <option value="Desactivar">Desactivar</option>
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

function FilaAuditoria({ registro }: { registro: (typeof auditoriaMock)[0] }) {
  return (
    <tr className="border-b border-border hover:bg-muted/30">
      <td className="px-4 py-3 text-muted-foreground">{registro.fecha}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium text-foreground">{registro.usuario}</span>
        </div>
      </td>
      <td className="px-4 py-3 font-medium text-foreground">{registro.accion}</td>
      <td className="px-4 py-3">
        {registro.entidad === "Reserva" && registro.entidad_id ? (
          <Link
            to="/admin/reservas/$id"
            params={{ id: registro.entidad_id }}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            {registro.entidad_id}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        ) : registro.entidad === "Pago" && registro.entidad_id ? (
          <Link
            to="/admin/pagos/$id"
            params={{ id: registro.entidad_id }}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            {registro.entidad_id}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        ) : registro.entidad_id ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            {registro.entidad_id}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          {registro.valor_anterior && (
            <div className="text-xs text-muted-foreground">
              Antes: <span className="font-mono">{registro.valor_anterior}</span>
            </div>
          )}
          {registro.valor_nuevo && (
            <div className="text-xs text-foreground">
              Después: <span className="font-mono">{registro.valor_nuevo}</span>
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{registro.motivo || "—"}</td>
      <td className="px-4 py-3">
        {registro.integridad === "ok" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            OK
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            Alerta
          </span>
        )}
      </td>
    </tr>
  );
}
