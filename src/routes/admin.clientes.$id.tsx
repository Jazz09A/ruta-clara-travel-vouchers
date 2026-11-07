import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Phone, Mail, Calendar, Edit2, MapPin, Repeat } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { BadgeEstado } from "@/components/admin/BadgeEstado";
import { EmptyState } from "@/components/admin/EmptyState";
import { Campo } from "@/components/admin/Campo";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Reserva } from "@/lib/domain/types";

export const Route = createFileRoute("/admin/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Detalle de cliente · Panel" },
      { name: "description", content: "Historial de reservas y datos del cliente." },
    ],
  }),
  component: DetalleCliente,
});

interface ClienteDetalle {
  id: string;
  nombre: string;
  tipo_doc: string;
  documento_enmascarado: string;
  telefono: string;
  correo: string;
  notas: string;
  reservas: Reserva[];
  viajes: {
    total: number;
    confirmadas: number;
    canceladas: number;
    tours: { tour_id: string; tour: string; veces: number }[];
    primera_fecha: string | null;
    ultima_fecha: string | null;
  };
}

function DetalleCliente() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [editandoNotas, setEditandoNotas] = useState(false);
  const [notasInternas, setNotasInternas] = useState("");

  const {
    data: cliente,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["admin", "cliente", id],
    queryFn: () => api.admin.cliente(id) as Promise<ClienteDetalle>,
  });

  const guardarNotas = useMutation({
    mutationFn: (notas: string) => api.admin.guardarNotaCliente(id, { notas }),
    onSuccess: () => {
      toast.success("Notas guardadas");
      setEditandoNotas(false);
      void queryClient.invalidateQueries({ queryKey: ["admin", "cliente", id] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "clientes"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "No se pudieron guardar las notas"),
  });

  if (isPending) {
    return (
      <AdminShell titulo="Cliente">
        <p className="text-sm text-muted-foreground">Cargando cliente…</p>
      </AdminShell>
    );
  }
  if (isError || !cliente) {
    return (
      <AdminShell titulo="Cliente">
        <EmptyState
          titulo="No encontramos este cliente"
          descripcion="Es posible que el enlace esté desactualizado."
        />
      </AdminShell>
    );
  }

  const iniciarEdicion = () => {
    setNotasInternas(cliente.notas ?? "");
    setEditandoNotas(true);
  };

  const reservasOrdenadas = [...cliente.reservas].sort((a, b) =>
    String(b.fecha_salida ?? "").localeCompare(String(a.fecha_salida ?? "")),
  );

  return (
    <AdminShell titulo={cliente.nombre}>
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
                {cliente.nombre}
              </h2>
              <p className="text-sm text-muted-foreground">
                {cliente.viajes.total} reserva{cliente.viajes.total !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Columna izquierda: datos del cliente */}
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="text-sm font-bold text-foreground">Datos de contacto</h2>

              <div className="mt-4 space-y-3">
                {cliente.telefono && (
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Teléfono</label>
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Phone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      {cliente.telefono}
                    </div>
                  </div>
                )}

                {cliente.correo && (
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Correo</label>
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      {cliente.correo}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Documento</label>
                  <p className="text-sm text-foreground">{cliente.documento_enmascarado || "—"}</p>
                </div>
              </div>
            </div>

            {/* Resumen de viajes */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="text-sm font-bold text-foreground">Resumen de viajes</h2>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-extrabold text-foreground">{cliente.viajes.total}</p>
                  <p className="text-xs text-muted-foreground">viajes</p>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-foreground">
                    {cliente.viajes.confirmadas}
                  </p>
                  <p className="text-xs text-muted-foreground">confirmadas</p>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-foreground">
                    {cliente.viajes.canceladas}
                  </p>
                  <p className="text-xs text-muted-foreground">canceladas</p>
                </div>
              </div>
              {(cliente.viajes.primera_fecha || cliente.viajes.ultima_fecha) && (
                <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  {cliente.viajes.primera_fecha && (
                    <p>Primera salida: {formatDate(cliente.viajes.primera_fecha)}</p>
                  )}
                  {cliente.viajes.ultima_fecha && (
                    <p>Última salida: {formatDate(cliente.viajes.ultima_fecha)}</p>
                  )}
                </div>
              )}

              {cliente.viajes.tours.length > 0 && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    Destinos
                  </p>
                  <ul className="space-y-1.5">
                    {cliente.viajes.tours.map((t) => (
                      <li
                        key={t.tour_id || t.tour}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="truncate text-foreground">{t.tour || "Tour"}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Repeat className="h-3 w-3" aria-hidden="true" />×{t.veces}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground">Notas internas</h2>
                <button
                  onClick={editandoNotas ? () => setEditandoNotas(false) : iniciarEdicion}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title={editandoNotas ? "Cancelar" : "Editar"}
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
                      onClick={() => guardarNotas.mutate(notasInternas)}
                      disabled={guardarNotas.isPending}
                      className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                    >
                      {guardarNotas.isPending ? "Guardando…" : "Guardar"}
                    </button>
                    <button
                      onClick={() => setEditandoNotas(false)}
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  {cliente.notas || "Sin notas internas"}
                </p>
              )}
            </div>
          </div>

          {/* Columna derecha: historial de reservas */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="text-sm font-bold text-foreground">Historial de reservas</h2>

              <div className="mt-4 space-y-3">
                {reservasOrdenadas.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Este cliente aún no tiene reservas.
                  </p>
                )}
                {reservasOrdenadas.map((reserva) => (
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
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {reserva.tour_nombre || "Tour"}
                        </p>
                        {reserva.fecha_salida && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" aria-hidden="true" />
                            {formatDate(reserva.fecha_salida)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">${reserva.total_usd}</p>
                        <p className="text-xs text-muted-foreground">
                          {reserva.pasajeros?.length ?? 0} pax
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
