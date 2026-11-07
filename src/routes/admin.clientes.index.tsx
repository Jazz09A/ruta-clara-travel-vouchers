import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { Search, Users, Phone, Mail, Download } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/admin/EmptyState";
import { AdminShell } from "@/components/admin/AdminShell";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/clientes/")({
  head: () => ({
    meta: [
      { title: "Clientes · Panel" },
      { name: "description", content: "Catálogo de clientes y su historial de reservas." },
    ],
  }),
  component: Clientes,
});

interface ClienteItem {
  id: string;
  nombre: string;
  documento_enmascarado: string;
  telefono: string;
  correo: string;
  reservas: number;
  ultima_reserva: string | null;
  notas: string;
}

function Clientes() {
  const [busqueda, setBusqueda] = useState("");
  const busquedaDebounced = useDeferredValue(busqueda);
  const queryClient = useQueryClient();

  const { data, isPending, isError } = useQuery({
    queryKey: ["admin", "clientes", busquedaDebounced],
    queryFn: () => api.admin.clientes({ busqueda: busquedaDebounced || undefined }),
  });

  const exportar = useMutation({
    mutationFn: () => api.admin.crearExportacion("clientes"),
    onSuccess: () => {
      toast.success("Exportación de clientes en cola. Descárgala desde Reportes.");
      void queryClient.invalidateQueries({ queryKey: ["exportaciones"] });
    },
    onError: () => toast.error("No pudimos solicitar la exportación."),
  });

  const clientes = (data?.items ?? []) as ClienteItem[];

  return (
    <AdminShell
      titulo="Clientes"
      breadcrumb={[{ label: "Panel", to: "/admin" }, { label: "Clientes" }]}
      acciones={
        <button
          onClick={() => exportar.mutate()}
          disabled={exportar.isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {exportar.isPending ? "Solicitando…" : "Exportar datos"}
        </button>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          {isPending ? "Cargando…" : `${clientes.length} clientes`}
        </p>

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
        {isError ? (
          <EmptyState
            titulo="No pudimos cargar los clientes"
            descripcion="Revisa tu conexión e inténtalo de nuevo."
          />
        ) : clientes.length === 0 && !isPending ? (
          <EmptyState
            titulo="No hay clientes"
            descripcion={
              busqueda
                ? "No encontramos clientes con la búsqueda actual."
                : "Aún no hay clientes registrados."
            }
            accion={
              busqueda ? (
                <button
                  onClick={() => setBusqueda("")}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Limpiar búsqueda
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {clientes.map((cliente) => (
              <TarjetaCliente key={cliente.id} cliente={cliente} />
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function TarjetaCliente({ cliente }: { cliente: ClienteItem }) {
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
            {cliente.telefono && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="truncate">{cliente.telefono}</span>
              </div>
            )}
            {cliente.correo && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="truncate">{cliente.correo}</span>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              {cliente.reservas} reserva{cliente.reservas !== 1 ? "s" : ""}
            </span>
            {cliente.ultima_reserva && (
              <>
                <span>·</span>
                <span>Última: {formatDate(cliente.ultima_reserva)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
