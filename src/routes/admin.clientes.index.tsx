import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Users, Phone, Mail, MoreVertical, Download, Shield } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { AdminShell } from "@/components/admin/AdminShell";
import { Campo } from "@/components/admin/Campo";
import { DialogoMotivo } from "@/components/admin/ui/dialogo-motivo";
import { MARCA } from "@/lib/brand";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/clientes/")({
  head: () => ({
    meta: [
      { title: "Clientes · Panel" },
      { name: "description", content: "Catálogo de clientes y su historial de reservas." },
    ],
  }),
  component: Clientes,
});

// Mock data para demo
const clientesMock = [
  {
    id: "1",
    nombre: "María Pérez",
    telefono: "+58 412 1234567",
    correo: "maria.perez@email.com",
    documento: "V-12345678",
    reservas: 3,
    ultima_reserva: "Sáb 14 dic 2026",
    notas: "Cliente frecuente, siempre paga puntual",
  },
  {
    id: "2",
    nombre: "José Rodríguez",
    telefono: "+58 414 9876543",
    correo: "jose.rodriguez@email.com",
    documento: "E-87654321",
    reservas: 1,
    ultima_reserva: "Vie 13 nov 2026",
    notas: "",
  },
  {
    id: "3",
    nombre: "Ana Gómez",
    telefono: "+58 416 5555555",
    correo: "ana.gomez@email.com",
    documento: "V-11112222",
    reservas: 2,
    ultima_reserva: "Dom 8 nov 2026",
    notas: "Alérgica a mariscos",
  },
];

function Clientes() {
  const [busqueda, setBusqueda] = useState("");
  const [accionAnonimizar, setAccionAnonimizar] = useState<string | null>(null);

  const clientesFiltrados = clientesMock.filter(
    (c) =>
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.telefono.includes(busqueda) ||
      c.documento.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.correo.toLowerCase().includes(busqueda.toLowerCase()),
  );

  return (
    <AdminShell
      titulo="Clientes"
      breadcrumb={[{ label: "Panel", to: "/admin" }, { label: "Clientes" }]}
      acciones={
        <button className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent">
          <Download className="h-4 w-4" aria-hidden="true" />
          Exportar datos
        </button>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">{clientesMock.length} clientes en total</p>

        {/* Barra de búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono, documento o correo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Lista de clientes */}
        {clientesFiltrados.length === 0 ? (
          <EmptyState
            titulo="No hay clientes"
            descripcion="No encontramos clientes con la búsqueda actual."
            accion={
            <button
              onClick={() => setBusqueda("")}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Limpiar búsqueda
            </button>
          }
          />
        ) : (
          <div className="space-y-3">
            {clientesFiltrados.map((cliente) => (
              <TarjetaCliente
                key={cliente.id}
                cliente={cliente}
                onAnonimizar={() => setAccionAnonimizar(cliente.id)}
              />
            ))}
          </div>
        )}

        {/* Diálogo de anonimización */}
        {accionAnonimizar && (
          <DialogoAnonimizar onCerrar={() => setAccionAnonimizar(null)} />
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

function TarjetaCliente({
  cliente,
  onAnonimizar,
}: {
  cliente: (typeof clientesMock)[0];
  onAnonimizar: () => void;
}) {
  return (
    <Link
      to="/admin/clientes/$id"
      params={{ id: cliente.id }}
      className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">{cliente.nombre}</h3>
            {cliente.notas && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                Notas
              </span>
            )}
          </div>

          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate">{cliente.telefono}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate">{cliente.correo}</span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              {cliente.reservas} reserva{cliente.reservas !== 1 ? "s" : ""}
            </span>
            <span>·</span>
            <span>Última: {cliente.ultima_reserva}</span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.preventDefault();
            onAnonimizar();
          }}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          title="Anonimizar cliente"
        >
          <Shield className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </Link>
  );
}
