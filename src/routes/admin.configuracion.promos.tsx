import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Tag, Plus, Pencil, Trash2, Percent, DollarSign, Calendar, Users } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Campo } from "@/components/admin/Campo";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CodigoPromocional } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogoConfirmacion } from "@/components/core/DialogoConfirmacion";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/admin/configuracion/promos")({
  head: () => ({
    meta: [
      { title: "Códigos promocionales · Panel" },
      { name: "description", content: "Descuentos y promociones." },
    ],
  }),
  component: CodigosPromocionales,
});

function CodigosPromocionales() {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<CodigoPromocional | null>(null);
  const [dialogoEliminar, setDialogoEliminar] = useState<string | null>(null);

  const { data: datos, isLoading } = useQuery({
    queryKey: ["configuracion", "promos"],
    queryFn: () => api.admin.configuracion(),
  });

  const promos = datos?.promos ?? [];

  const mutationGuardar = useMutation({
    mutationFn: async (promo: Partial<CodigoPromocional> & { id?: string }) => {
      return await api.admin.guardarPromo(promo);
    },
    onSuccess: () => {
      toast.success("Código promocional guardado");
      setEditando(null);
      queryClient.invalidateQueries({ queryKey: ["configuracion", "promos"] });
    },
    onError: () => {
      toast.error("No pudimos guardar el código promocional");
    },
  });

  const mutationEliminar = useMutation({
    mutationFn: async (id: string) => {
      return await api.admin.guardarPromo({ id, activo: false });
    },
    onSuccess: () => {
      toast.success("Código promocional desactivado");
      setDialogoEliminar(null);
      queryClient.invalidateQueries({ queryKey: ["configuracion", "promos"] });
    },
    onError: () => {
      toast.error("No pudimos desactivar el código promocional");
    },
  });

  const handleGuardar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editando) return;

    const formData = new FormData(e.currentTarget);
    const promo: Partial<CodigoPromocional> = {
      id: editando.id,
      codigo: formData.get("codigo") as string,
      tipo: formData.get("tipo") as "porcentaje" | "monto",
      valor: parseFloat(formData.get("valor") as string),
      vigente_desde: formData.get("vigente_desde") as string,
      vigente_hasta: formData.get("vigente_hasta") as string,
      usos_max: parseInt(formData.get("usos_max") as string, 10),
      tour_id: formData.get("tour_id") as string || undefined,
      activo: formData.get("activo") === "true",
    };

    mutationGuardar.mutate(promo);
  };

  const handleEliminar = async (id: string) => {
    mutationEliminar.mutate(id);
  };

  const calcularUsoRestante = (promo: CodigoPromocional) => {
    return promo.usos_max - promo.usos;
  };

  const esExpirado = (promo: CodigoPromocional) => {
    return new Date(promo.vigente_hasta) < new Date();
  };

  return (
    <AdminShell
      titulo="Códigos promocionales"
      breadcrumb={[{ label: "Panel", to: "/admin" }, { label: "Configuración", to: "/admin/configuracion" }, { label: "Códigos promocionales" }]}
    >
      <div className="mx-auto w-full max-w-4xl">
        <Link
          to="/admin/configuracion"
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a configuración
        </Link>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Configura descuentos y promociones para tus clientes
          </p>
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => setEditando({
              id: "",
              codigo: "",
              tipo: "porcentaje",
              valor: 10,
              vigente_desde: new Date().toISOString().split("T")[0],
              vigente_hasta: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              usos_max: 100,
              usos: 0,
              activo: true,
            })}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Nuevo código
          </Button>
        </div>

        {/* Lista de códigos */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : promos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <Tag className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
              <p className="mt-4 text-sm text-muted-foreground">
                No hay códigos promocionales configurados
              </p>
            </div>
          ) : (
            promos.map((promo) => (
              <div
                key={promo.id}
                className="rounded-2xl border border-border bg-card p-6 shadow-card"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Tag className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-lg font-bold text-foreground uppercase">{promo.codigo}</h3>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge variant={promo.activo ? "default" : "secondary"}>
                            {promo.activo ? "Activo" : "Inactivo"}
                          </Badge>
                          {esExpirado(promo) && (
                            <Badge variant="destructive">Expirado</Badge>
                          )}
                          <Badge variant="outline">
                            {promo.tipo === "porcentaje" ? "%" : "$"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div className="flex items-center gap-2">
                        {promo.tipo === "porcentaje" ? (
                          <Percent className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        ) : (
                          <DollarSign className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        )}
                        <div>
                          <p className="text-xs text-muted-foreground">Descuento</p>
                          <p className="text-sm font-semibold text-foreground">
                            {promo.tipo === "porcentaje" ? `${promo.valor}%` : `$${promo.valor}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <div>
                          <p className="text-xs text-muted-foreground">Válido hasta</p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatRelative(promo.vigente_hasta)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <div>
                          <p className="text-xs text-muted-foreground">Usos</p>
                          <p className="text-sm font-semibold text-foreground">
                            {promo.usos} / {promo.usos_max}
                          </p>
                        </div>
                      </div>

                      {promo.tour_id && (
                        <div>
                          <p className="text-xs text-muted-foreground">Tour específico</p>
                          <p className="text-sm font-semibold text-foreground">
                            {promo.tour_id}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setEditando(promo)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setDialogoEliminar(promo.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal de edición */}
        {editando && (
          <DialogoConfirmacion
            open={!!editando}
            onOpenChange={(abierto) => {
              if (!abierto) setEditando(null);
            }}
            titulo={editando.id ? "Editar código promocional" : "Nuevo código promocional"}
            descripcion="Configura los detalles del descuento"
            textoConfirmar="Guardar"
            variante="default"
            loading={mutationGuardar.isPending}
            motivo={undefined}
          >
            <form onSubmit={handleGuardar} className="space-y-4">
              <Campo
                id="codigo"
                label="Código"
                type="text"
                defaultValue={editando.codigo}
                placeholder="Ej: VERANO2026"
                required
                ayuda="El código que los clientes deben ingresar (en mayúsculas)"
              />

              <Campo
                id="tipo"
                label="Tipo de descuento"
                type="select"
                defaultValue={editando.tipo}
                required
              >
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="monto">Monto fijo ($)</option>
              </Campo>

              <Campo
                id="valor"
                label="Valor del descuento"
                type="number"
                defaultValue={editando.valor}
                min="0"
                step={editando.tipo === "porcentaje" ? "1" : "0.01"}
                required
                ayuda={editando.tipo === "porcentaje" ? "Porcentaje de descuento (0-100)" : "Monto en USD"}
              />

              <Campo
                id="vigente_desde"
                label="Válido desde"
                type="date"
                defaultValue={editando.vigente_desde.split("T")[0]}
                required
              />

              <Campo
                id="vigente_hasta"
                label="Válido hasta"
                type="date"
                defaultValue={editando.vigente_hasta.split("T")[0]}
                required
              />

              <Campo
                id="usos_max"
                label="Máximo de usos"
                type="number"
                defaultValue={editando.usos_max}
                min="1"
                required
                ayuda="Número máximo de veces que se puede usar este código"
              />

              <Campo
                id="tour_id"
                label="Tour específico (opcional)"
                type="text"
                defaultValue={editando.tour_id}
                placeholder="Deja vacío para todos los tours"
                ayuda="Si se especifica, el código solo aplica a este tour"
              />

              <Campo
                id="activo"
                label="Estado"
                type="select"
                defaultValue={editando.activo ? "true" : "false"}
                required
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </Campo>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditando(null)}
                >
                  Cancelar
                </Button>
                <BotonCargar
                  type="submit"
                  cargando={mutationGuardar.isPending}
                  textoCargando="Guardando..."
                >
                  Guardar
                </BotonCargar>
              </div>
            </form>
          </DialogoConfirmacion>
        )}

        {/* Diálogo de eliminación */}
        <DialogoConfirmacion
          open={!!dialogoEliminar}
          onOpenChange={(abierto) => {
            if (!abierto) setDialogoEliminar(null);
          }}
          titulo="Desactivar código promocional"
          descripcion="El código dejará de estar disponible para nuevos clientes, pero los usos existentes se mantienen."
          textoConfirmar="Desactivar"
          variante="destructive"
          loading={mutationEliminar.isPending}
          motivo={undefined}
          onConfirmar={() => {
            if (dialogoEliminar) handleEliminar(dialogoEliminar);
          }}
        />
      </div>
    </AdminShell>
  );
}
