import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Shield, Plus, Pencil, Trash2, Percent } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Campo } from "@/components/admin/Campo";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PoliticaCancelacion, TramoCancelacion } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogoConfirmacion } from "@/components/admin/DialogoConfirmacion";

export const Route = createFileRoute("/admin/configuracion/politicas")({
  head: () => ({
    meta: [
      { title: "Políticas de cancelación · Panel" },
      { name: "description", content: "Tramos y porcentajes de reembolso." },
    ],
  }),
  component: PoliticasCancelacion,
});

function PoliticasCancelacion() {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<PoliticaCancelacion | null>(null);
  const [dialogoEliminar, setDialogoEliminar] = useState<string | null>(null);

  const { data: datos, isLoading } = useQuery({
    queryKey: ["configuracion", "politicas"],
    queryFn: () => api.admin.configuracion(),
  });

  const politicas = datos?.politicas ?? [];

  const mutationGuardar = useMutation({
    mutationFn: async (politica: Partial<PoliticaCancelacion> & { id?: string }) => {
      return await api.admin.guardarPolitica(politica);
    },
    onSuccess: () => {
      toast.success("Política de cancelación guardada");
      setEditando(null);
      queryClient.invalidateQueries({ queryKey: ["configuracion", "politicas"] });
    },
    onError: () => {
      toast.error("No pudimos guardar la política de cancelación");
    },
  });

  const mutationEliminar = useMutation({
    mutationFn: async (id: string) => {
      // Simular eliminación
      return await api.admin.guardarPolitica({ id });
    },
    onSuccess: () => {
      toast.success("Política de cancelación eliminada");
      setDialogoEliminar(null);
      queryClient.invalidateQueries({ queryKey: ["configuracion", "politicas"] });
    },
    onError: () => {
      toast.error("No pudimos eliminar la política de cancelación");
    },
  });

  const handleGuardar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editando) return;

    const formData = new FormData(e.currentTarget);
    const tramosCount = parseInt(formData.get("tramos_count") as string, 10);

    const tramos: TramoCancelacion[] = [];
    for (let i = 0; i < tramosCount; i++) {
      const dias = formData.get(`tramo_${i}_dias`) as string;
      const porcentaje = formData.get(`tramo_${i}_porcentaje`) as string;
      const descripcion = formData.get(`tramo_${i}_descripcion`) as string;

      if (dias && porcentaje) {
        tramos.push({
          dias_desde_salida: parseInt(dias, 10),
          porcentaje_reembolso: parseInt(porcentaje, 10),
          descripcion: descripcion || "",
        });
      }
    }

    const politica: Partial<PoliticaCancelacion> = {
      id: editando.id,
      nombre: formData.get("nombre") as string,
      clave: (formData.get("clave") as string)?.trim() || null,
      tramos,
    };

    mutationGuardar.mutate(politica);
  };

  const handleEliminar = async (id: string) => {
    mutationEliminar.mutate(id);
  };

  const agregarTramo = () => {
    if (!editando) return;
    setEditando({
      ...editando,
      tramos: [
        ...editando.tramos,
        { dias_desde_salida: 0, porcentaje_reembolso: 0, descripcion: "" },
      ],
    });
  };

  const eliminarTramo = (index: number) => {
    if (!editando) return;
    const nuevosTramos = editando.tramos.filter((_, i) => i !== index);
    setEditando({ ...editando, tramos: nuevosTramos });
  };

  const actualizarTramo = (
    index: number,
    campo: keyof TramoCancelacion,
    valor: string | number,
  ) => {
    if (!editando) return;
    const nuevosTramos = [...editando.tramos];
    const actual = nuevosTramos[index];
    if (!actual) return;
    nuevosTramos[index] = { ...actual, [campo]: valor } as TramoCancelacion;
    setEditando({ ...editando, tramos: nuevosTramos });
  };

  return (
    <AdminShell
      titulo="Políticas de cancelación"
      breadcrumb={[
        { label: "Panel", to: "/admin" },
        { label: "Configuración", to: "/admin/configuracion" },
        { label: "Políticas de cancelación" },
      ]}
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
            Configura los tramos y porcentajes de reembolso por cancelación. El reembolso por
            defecto es del 0 %.
          </p>
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            onClick={() =>
              setEditando({
                id: "",
                nombre: "",
                tramos: [
                  {
                    dias_desde_salida: 7,
                    porcentaje_reembolso: 0,
                    descripcion: "No reembolsable — logística y políticas de la empresa",
                  },
                  {
                    dias_desde_salida: 3,
                    porcentaje_reembolso: 0,
                    descripcion: "No reembolsable — logística y políticas de la empresa",
                  },
                  {
                    dias_desde_salida: 0,
                    porcentaje_reembolso: 0,
                    descripcion: "No reembolsable — logística y políticas de la empresa",
                  },
                ],
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Nueva política
          </Button>
        </div>

        {/* Lista de políticas */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : politicas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <Shield className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
              <p className="mt-4 text-sm text-muted-foreground">
                No hay políticas de cancelación configuradas
              </p>
            </div>
          ) : (
            politicas.map((politica) => (
              <div
                key={politica.id}
                className="rounded-2xl border border-border bg-card p-6 shadow-card"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Shield className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <h3 className="text-lg font-bold text-foreground">{politica.nombre}</h3>
                    </div>

                    <div className="mt-4 space-y-2">
                      {politica.tramos.map((tramo, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-lg bg-muted/30 p-3"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {tramo.descripcion}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {tramo.dias_desde_salida}+ días antes de la salida
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Percent className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <span className="text-lg font-bold text-foreground">
                              {tramo.porcentaje_reembolso}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setEditando(politica)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setDialogoEliminar(politica.id)}
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
            abierto={!!editando}
            onAbiertoCambia={(abierto) => {
              if (!abierto) setEditando(null);
            }}
            titulo={editando.id ? "Editar política" : "Nueva política"}
            descripcion="Configura los tramos y porcentajes de reembolso. El reembolso por defecto es del 0 %."
            textoConfirmar="Guardar"
            cargando={mutationGuardar.isPending}
            onConfirmar={() => setEditando(null)}
          >
            <form onSubmit={handleGuardar} className="space-y-4">
              <Campo
                id="nombre"
                label="Nombre de la política"
                type="text"
                defaultValue={editando.nombre}
                placeholder="Ej: Política estándar de cancelación"
                required
              />

              <Campo
                id="clave"
                label="Clave"
                type="text"
                defaultValue={editando.clave ?? ""}
                placeholder="Ej: full_day"
                ayuda="Así la referencia un tour en el catálogo (full_day, multi_dia)."
              />

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-sm font-semibold">Tramos de reembolso</label>
                  <Button type="button" variant="outline" size="sm" onClick={agregarTramo}>
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    Agregar tramo
                  </Button>
                </div>

                <div className="space-y-3">
                  {editando.tramos.map((tramo, idx) => (
                    <div key={idx} className="rounded-xl border border-border bg-muted/30 p-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Campo
                          id={`tramo_${idx}_dias`}
                          label="Días desde salida"
                          type="number"
                          value={tramo.dias_desde_salida.toString()}
                          onChange={(e) =>
                            actualizarTramo(idx, "dias_desde_salida", parseInt(e.target.value, 10))
                          }
                          min="0"
                          required
                        />
                        <Campo
                          id={`tramo_${idx}_porcentaje`}
                          label="Porcentaje %"
                          type="number"
                          value={tramo.porcentaje_reembolso.toString()}
                          onChange={(e) =>
                            actualizarTramo(
                              idx,
                              "porcentaje_reembolso",
                              parseInt(e.target.value, 10),
                            )
                          }
                          min="0"
                          max="100"
                          required
                        />
                        <Campo
                          id={`tramo_${idx}_descripcion`}
                          label="Descripción"
                          type="text"
                          value={tramo.descripcion}
                          onChange={(e) => actualizarTramo(idx, "descripcion", e.target.value)}
                          placeholder="Ej: Más de 7 días antes"
                          required
                        />
                      </div>
                      {editando.tramos.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-destructive"
                          onClick={() => eliminarTramo(idx)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                          Eliminar tramo
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <input type="hidden" name="tramos_count" value={editando.tramos.length} />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditando(null)}>
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
          abierto={!!dialogoEliminar}
          onAbiertoCambia={(abierto) => {
            if (!abierto) setDialogoEliminar(null);
          }}
          titulo="Eliminar política de cancelación"
          descripcion="Esta acción no se puede deshacer. La política será eliminada permanentemente."
          textoConfirmar="Eliminar"
          destructivo
          cargando={mutationEliminar.isPending}
          onConfirmar={() => {
            if (dialogoEliminar) handleEliminar(dialogoEliminar);
          }}
        />
      </div>
    </AdminShell>
  );
}
