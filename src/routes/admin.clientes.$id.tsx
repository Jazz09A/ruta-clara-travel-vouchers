import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Phone,
  Mail,
  FileText,
  Calendar,
  DollarSign,
  Shield,
  Download,
  Edit2,
  Eye,
  EyeOff,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { BadgeEstado } from "@/components/admin/BadgeEstado";
import { Campo } from "@/components/admin/Campo";
import { DialogoMotivo } from "@/components/admin/ui/dialogo-motivo";
import { MARCA } from "@/lib/brand";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Detalle de cliente · Panel" },
      { name: "description", content: "Historial de reservas y datos del cliente." },
    ],
  }),
  component: DetalleCliente,
});

// Mock data para demo
const clienteMock = {
  id: "1",
  nombre: "María Pérez",
  telefono: "+58 412 1234567",
  correo: "maria.perez@email.com",
  documento: "V-12345678",
  fecha_nacimiento: "15/03/1990",
  reservas: 3,
  notas: "Cliente frecuente, siempre paga puntual",
  notas_internas: "Prefiere asientos cerca de la ventana",
};

const reservasMock = [
  {
    id: "1",
    ref_corta: "K7M2QX9A",
    tour: "Full Day Los Roques",
    fecha: "Sáb 14 dic 2026",
    estado: "confirmada",
    estado_pago: "pagado",
    monto_usd: "240",
    pasajeros: 3,
  },
  {
    id: "2",
    ref_corta: "X3J9K2L5",
    tour: "Fin de semana Mérida",
    fecha: "Vie 13 nov 2026",
    estado: "completada",
    estado_pago: "pagado",
    monto_usd: "580",
    pasajeros: 2,
  },
  {
    id: "3",
    ref_corta: "P4M8N3Q6",
    tour: "Full Day Colonia Tovar",
    fecha: "Dom 8 nov 2026",
    estado: "cancelada",
    estado_pago: "reembolsado",
    monto_usd: "90",
    pasajeros: 1,
  },
];

function DetalleCliente() {
  const { id } = Route.useParams();
  const [editandoNotas, setEditandoNotas] = useState(false);
  const [notasInternas, setNotasInternas] = useState(clienteMock.notas_internas);
  const [datosRevelados, setDatosRevelados] = useState(false);
  const [accionAnonimizar, setAccionAnonimizar] = useState(false);

  const toggleDatosRevelados = () => {
    if (!datosRevelados) {
      // TODO: En producción, esto requeriría un paso de autenticación (step-up)
      toast.info("Datos revelados temporalmente");
    }
    setDatosRevelados(!datosRevelados);
  };

  return (
    <AdminShell titulo={clienteMock.nombre}>
      <div className="flex flex-col gap-6">
        {/* Cabecera */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/clientes"
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Volver
            </Link>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">
                {clienteMock.nombre}
              </h2>
              <p className="text-sm text-muted-foreground">
                {clienteMock.reservas || reservasMock.length} reservas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAccionAnonimizar(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-destructive/50 bg-destructive/5 px-4 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
            >
              <Shield className="h-4 w-4" aria-hidden="true" />
              Anonimizar
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Columna izquierda: datos del cliente */}
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="text-sm font-bold text-foreground">Datos de contacto</h2>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Teléfono</label>
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Phone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    {clienteMock.telefono}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Correo</label>
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    {clienteMock.correo}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Documento</label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">
                      {datosRevelados ? clienteMock.documento : "V-****5678"}
                    </span>
                    <button
                      onClick={toggleDatosRevelados}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      title={datosRevelados ? "Ocultar" : "Revelar"}
                    >
                      {datosRevelados ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {datosRevelados && (
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Fecha de nacimiento
                    </label>
                    <p className="text-sm text-foreground">{clienteMock.fecha_nacimiento}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground">Notas internas</h2>
                <button
                  onClick={() => setEditandoNotas(!editandoNotas)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Edit2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {editandoNotas ? (
                <div className="mt-3">
                  <Campo
                    type="textarea"
                    value={notasInternas}
                    onChange={(e) => setNotasInternas(e.target.value)}
                    placeholder="Notas para uso interno..."
                    rows={3}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => {
                        toast.success("Notas guardadas");
                        setEditandoNotas(false);
                      }}
                      className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => {
                        setNotasInternas(clienteMock.notas_internas);
                        setEditandoNotas(false);
                      }}
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  {notasInternas || "Sin notas internas"}
                </p>
              )}
            </div>
          </div>

          {/* Columna derecha: historial de reservas */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground">Historial de reservas</h2>
                <button className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent">
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Exportar
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {reservasMock.map((reserva) => (
                  <Link
                    key={reserva.id}
                    to="/admin/reservas/$id"
                    params={{ id: reserva.id }}
                    className="block rounded-lg border border-border bg-muted/50 p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">
                            {reserva.ref_corta}
                          </span>
                          <BadgeEstado estado={reserva.estado} />
                        </div>
                        <p className="mt-1 text-sm font-semibold text-foreground">{reserva.tour}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{reserva.fecha}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">${reserva.monto_usd}</p>
                        <p className="text-xs text-muted-foreground">{reserva.pasajeros} pax</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Diálogo de anonimización */}
        {accionAnonimizar && (
          <DialogoAnonimizar onCerrar={() => setAccionAnonimizar(false)} />
        )}
      </div>
    </AdminShell>
  );
}

function DialogoAnonimizar({ onCerrar }: { onCerrar: () => void }) {
  const [motivo, setMotivo] = useState("");
  return (
    <DialogoMotivo
      abierto
      onAbiertoChange={(abierto) => {
        if (!abierto) onCerrar();
      }}
      titulo="Anonimizar cliente"
      descripcion="Esta acción eliminará todos los datos personales del cliente de forma permanente. Solo se conservará el historial de reservas con datos enmascarados. Esta acción no se puede deshacer."
      etiquetaConfirmar="Anonimizar"
      destructivo
      motivo={motivo}
      onMotivoChange={setMotivo}
      onConfirmar={() => {
        toast.success("Cliente anonimizado");
        onCerrar();
      }}
    />
  );
}
