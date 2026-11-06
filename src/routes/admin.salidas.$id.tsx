import { createFileRoute, Link } from "@tanstack/react-router";
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
import { AdminShell } from "@/components/admin/AdminShell";
import { BadgeEstado } from "@/components/admin/BadgeEstado";
import { DialogoMotivo } from "@/components/admin/ui/dialogo-motivo";
import { Campo } from "@/components/admin/Campo";
import { MARCA } from "@/lib/brand";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/salidas/$id")({
  head: () => ({
    meta: [
      { title: "Detalle de salida · Panel" },
      { name: "description", content: "Manifiesto, cocina y disponibilidad de la salida." },
    ],
  }),
  component: DetalleSalida,
});

// Mock data para demo
const salidaMock = {
  id: "1",
  tour: "Full Day Los Roques",
  fecha: "Sáb 14 dic 2026",
  hora: "5:00 a. m.",
  cupo_total: 40,
  vendidos: 32,
  retenidos: 2,
  estado: "publicada",
  alerta: "casi_llena",
};

const reservasMock = [
  {
    id: "1",
    ref_corta: "K7M2QX9A",
    titular: "María Pérez",
    pasajeros: 3,
    estado: "confirmada",
    estado_pago: "pagado",
  },
  {
    id: "2",
    ref_corta: "X3J9K2L5",
    titular: "José Rodríguez",
    pasajeros: 2,
    estado: "confirmada",
    estado_pago: "pagado",
  },
  {
    id: "3",
    ref_corta: "P4M8N3Q6",
    titular: "Ana Gómez",
    pasajeros: 4,
    estado: "pendiente_pago",
    estado_pago: "pendiente_pago",
  },
];

const almuerzosMock = [
  { opcion: "Pescado frito", cantidad: 15, alergias: ["María Pérez", "Ana Gómez"] },
  { opcion: "Pollo asado", cantidad: 12, alergias: [] },
  { opcion: "Ensalada vegetariana", cantidad: 5, alergias: ["José Rodríguez"] },
];

function DetalleSalida() {
  const { id } = Route.useParams();
  const [pestaña, setPestaña] = useState<"general" | "manifiesto" | "cocina">("general");
  const [accionDialogo, setAccionDialogo] = useState<{
    tipo: "cerrar" | "cancelar" | "sobrecupo" | null;
  }>({ tipo: null });

  const ocupacion = salidaMock.vendidos + salidaMock.retenidos;
  const porcentaje = (ocupacion / salidaMock.cupo_total) * 100;

  return (
    <AdminShell
      titulo={salidaMock.tour}
      breadcrumb={[{ label: "Panel", to: "/admin" }, { label: "Salidas", to: "/admin/salidas" }, { label: "Detalle" }]}
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
              <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">
                {salidaMock.tour}
              </h2>
              <p className="text-sm text-muted-foreground">
                {salidaMock.fecha} · {salidaMock.hora}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <BadgeEstado estado={salidaMock.estado} />
            <button className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <MoreVertical className="h-5 w-5" aria-hidden="true" />
            </button>
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
              {ocupacion}/{salidaMock.cupo_total}
            </p>
            <p className="text-xs text-muted-foreground">{porcentaje.toFixed(0)}% lleno</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Confirmadas
            </div>
            <p className="mt-2 text-2xl font-extrabold text-foreground">
              {reservasMock.filter((r) => r.estado === "confirmada").length}
            </p>
            <p className="text-xs text-muted-foreground">reservas pagadas</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Pendientes
            </div>
            <p className="mt-2 text-2xl font-extrabold text-foreground">
              {reservasMock.filter((r) => r.estado === "pendiente_pago").length}
            </p>
            <p className="text-xs text-muted-foreground">por pagar</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
              Almuerzos
            </div>
            <p className="mt-2 text-2xl font-extrabold text-foreground">{almuerzosMock.length}</p>
            <p className="text-xs text-muted-foreground">opciones</p>
          </div>
        </div>

        {/* Pestañas */}
        <div className="flex items-center gap-1 rounded-xl border border-input bg-card p-1 overflow-x-auto">
          {(["general", "manifiesto", "cocina"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPestaña(p)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
                pestaña === p
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Contenido según pestaña */}
        {pestaña === "general" && <General />}
        {pestaña === "manifiesto" && <Manifiesto />}
        {pestaña === "cocina" && <Cocina />}

        {/* Diálogos de acción */}
        {accionDialogo.tipo === "cerrar" && (
          <DialogoCerrar onCerrar={() => setAccionDialogo({ tipo: null })} />
        )}
        {accionDialogo.tipo === "cancelar" && (
          <DialogoCancelar onCerrar={() => setAccionDialogo({ tipo: null })} />
        )}
        {accionDialogo.tipo === "sobrecupo" && (
          <DialogoSobrecupo onCerrar={() => setAccionDialogo({ tipo: null })} />
        )}
      </div>
    </AdminShell>
  );
}

function General() {
  const [dialogo, setDialogo] = useState<"cerrar" | "cancelar" | "sobrecupo" | null>(null);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <h2 className="text-lg font-bold">Disponibilidad general</h2>

      <div className="mt-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Cupo total</span>
          <span className="text-sm font-semibold text-foreground">{salidaMock.cupo_total}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Vendidos</span>
          <span className="text-sm font-semibold text-foreground">{salidaMock.vendidos}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Retenidos</span>
          <span className="text-sm font-semibold text-foreground">{salidaMock.retenidos}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Disponibles</span>
          <span className="text-sm font-semibold text-foreground">
            {salidaMock.cupo_total - salidaMock.vendidos - salidaMock.retenidos}
          </span>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-6">
        <h3 className="text-sm font-bold text-foreground">Acciones de fecha</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => setDialogo("cerrar")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            Cerrar fecha
          </button>
          <button
            onClick={() => setDialogo("cancelar")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Cancelar fecha
          </button>
          <button
            onClick={() => setDialogo("sobrecupo")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            <Unlock className="h-4 w-4" aria-hidden="true" />
            Autorizar sobrecupo
          </button>
        </div>
      </div>

      {dialogo === "cerrar" && <DialogoCerrar onCerrar={() => setDialogo(null)} />}
      {dialogo === "cancelar" && <DialogoCancelar onCerrar={() => setDialogo(null)} />}
      {dialogo === "sobrecupo" && <DialogoSobrecupo onCerrar={() => setDialogo(null)} />}
    </div>
  );
}

function Manifiesto() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Manifiesto de pasajeros</h2>
        <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
          <Download className="h-4 w-4" aria-hidden="true" />
          Exportar PDF
        </button>
      </div>

      <div className="mt-4">
        <Campo label="Incluir pendientes de pago" type="checkbox">
          <option value="true">Mostrar también reservas sin pago confirmado</option>
        </Campo>
      </div>

      <div className="mt-4 space-y-2">
        {reservasMock.map((reserva) => (
          <div
            key={reserva.id}
            className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">{reserva.titular}</p>
              <p className="text-xs text-muted-foreground">
                {reserva.ref_corta} · {reserva.pasajeros} pasajeros
              </p>
            </div>
            <BadgeEstado estado={reserva.estado} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Cocina() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Cocina (conteo de almuerzos)</h2>
        <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
          <Download className="h-4 w-4" aria-hidden="true" />
          Exportar PDF
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {almuerzosMock.map((almuerzo) => (
          <div
            key={almuerzo.opcion}
            className="rounded-lg border border-border bg-muted/50 p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{almuerzo.opcion}</p>
              <span className="text-sm font-bold text-foreground">{almuerzo.cantidad} porciones</span>
            </div>

            {almuerzo.alergias.length > 0 && (
              <div className="mt-2 rounded-lg bg-warning/10 p-2">
                <p className="text-xs font-semibold text-warning">Alergias:</p>
                <p className="text-xs text-muted-foreground">{almuerzo.alergias.join(", ")}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DialogoCerrar({ onCerrar }: { onCerrar: () => void }) {
  const [motivo, setMotivo] = useState("");
  return (
    <DialogoMotivo
      abierto
      onAbiertoChange={(abierto) => {
        if (!abierto) onCerrar();
      }}
      titulo="Cerrar fecha"
      descripcion="Al cerrar la fecha, se dejará de aceptar nuevas reservas. ¿Quieres que las reservas pendientes de pago expiren automáticamente?"
      etiquetaConfirmar="Cerrar fecha"
      motivo={motivo}
      onMotivoChange={setMotivo}
      onConfirmar={() => {
        toast.success("Fecha cerrada");
        onCerrar();
      }}
    />
  );
}

function DialogoCancelar({ onCerrar }: { onCerrar: () => void }) {
  const [motivo, setMotivo] = useState("");
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
      onConfirmar={() => {
        toast.success("Fecha cancelada");
        onCerrar();
      }}
    />
  );
}

function DialogoSobrecupo({ onCerrar }: { onCerrar: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [totp, setTotp] = useState("");
  return (
    <DialogoMotivo
      abierto
      onAbiertoChange={(abierto) => {
        if (!abierto) onCerrar();
      }}
      titulo="Autorizar sobrecupo"
      descripcion="Especifica el nuevo cupo total. Esta acción requiere código de autenticación."
      etiquetaConfirmar="Autorizar sobrecupo"
      requiereTotp
      totp={totp}
      onTotpChange={setTotp}
      motivo={motivo}
      onMotivoChange={setMotivo}
      onConfirmar={() => {
        toast.success("Sobrecupo autorizado");
        onCerrar();
      }}
    />
  );
}
