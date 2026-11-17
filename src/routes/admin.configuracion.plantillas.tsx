import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, MessageSquare, Plus, Pencil, Mail, MessageCircle } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Campo } from "@/components/admin/Campo";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PlantillaMensaje } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogoConfirmacion } from "@/components/admin/DialogoConfirmacion";

export const Route = createFileRoute("/admin/configuracion/plantillas")({
  head: () => ({
    meta: [
      { title: "Plantillas de mensaje · Panel" },
      { name: "description", content: "Correos y WhatsApp automáticos." },
    ],
  }),
  component: PlantillasMensaje,
});

function PlantillasMensaje() {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<PlantillaMensaje | null>(null);

  const { data: datos, isLoading } = useQuery({
    queryKey: ["configuracion", "plantillas"],
    queryFn: () => api.admin.configuracion(),
  });

  const plantillas = datos?.plantillas ?? [];

  const mutationGuardar = useMutation({
    mutationFn: async (plantilla: Partial<PlantillaMensaje> & { id?: string }) => {
      return await api.admin.guardarPlantilla(plantilla);
    },
    onSuccess: () => {
      toast.success("Plantilla guardada");
      setEditando(null);
      queryClient.invalidateQueries({ queryKey: ["configuracion", "plantillas"] });
    },
    onError: () => {
      toast.error("No pudimos guardar la plantilla");
    },
  });

  const handleGuardar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editando) return;

    const formData = new FormData(e.currentTarget);
    const plantilla: Partial<PlantillaMensaje> = {
      id: editando.id,
      clave: formData.get("clave") as string,
      nombre: formData.get("nombre") as string,
      cuerpo: formData.get("cuerpo") as string,
      variables: (formData.get("variables") as string)
        ? (formData.get("variables") as string).split(",").map((v) => v.trim())
        : [],
    };

    mutationGuardar.mutate(plantilla);
  };

  const getIconoPorClave = (clave: string) => {
    if (clave.includes("email") || clave.includes("correo")) return Mail;
    if (clave.includes("whatsapp") || clave.includes("wa")) return MessageCircle;
    return MessageSquare;
  };

  return (
    <AdminShell
      titulo="Plantillas de mensaje"
      breadcrumb={[
        { label: "Panel", to: "/admin" },
        { label: "Configuración", to: "/admin/configuracion" },
        { label: "Plantillas de mensaje" },
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
            Configura los correos y mensajes de WhatsApp automáticos
          </p>
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            onClick={() =>
              setEditando({
                id: "",
                clave: "",
                nombre: "",
                variables: [],
                cuerpo: "",
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Nueva plantilla
          </Button>
        </div>

        {/* Lista de plantillas */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : plantillas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <MessageSquare
                className="mx-auto h-12 w-12 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="mt-4 text-sm text-muted-foreground">
                No hay plantillas de mensaje configuradas
              </p>
            </div>
          ) : (
            plantillas.map((plantilla) => {
              const Icono = getIconoPorClave(plantilla.clave);
              return (
                <div
                  key={plantilla.id}
                  className="rounded-2xl border border-border bg-card p-6 shadow-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Icono className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{plantilla.nombre}</h3>
                          <p className="text-xs text-muted-foreground">{plantilla.clave}</p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg bg-muted/30 p-3">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Cuerpo del mensaje
                        </p>
                        <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                          {plantilla.cuerpo}
                        </p>
                      </div>

                      {plantilla.variables.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {plantilla.variables.map((variable, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {`{${variable}}`}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setEditando(plantilla)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal de edición */}
        {editando && (
          <DialogoConfirmacion
            abierto={!!editando}
            onAbiertoCambia={(abierto) => {
              if (!abierto) setEditando(null);
            }}
            titulo={editando.id ? "Editar plantilla" : "Nueva plantilla"}
            descripcion="Configura los datos de la plantilla de mensaje"
            textoConfirmar="Guardar"
            onConfirmar={() => setEditando(null)}
            cargando={mutationGuardar.isPending}
          >
            <form onSubmit={handleGuardar} className="space-y-4">
              <Campo
                id="clave"
                label="Clave de la plantilla"
                type="text"
                defaultValue={editando.clave}
                placeholder="Ej: email_confirmacion, whatsapp_pago"
                required
                ayuda="Identificador único para referenciar esta plantilla"
              />

              <Campo
                id="nombre"
                label="Nombre"
                type="text"
                defaultValue={editando.nombre}
                placeholder="Ej: Confirmación de reserva"
                required
              />

              <Campo
                id="variables"
                label="Variables (separadas por coma)"
                type="text"
                defaultValue={editando.variables.join(", ")}
                placeholder="Ej: nombre, codigo, fecha"
                ayuda="Las variables se usan como {nombre}, {codigo}, etc."
              />

              <Campo
                id="cuerpo"
                label="Cuerpo del mensaje"
                type="textarea"
                rows={8}
                defaultValue={editando.cuerpo}
                placeholder="Escribe el mensaje usando {variable} para datos dinámicos..."
                required
              />

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
      </div>
    </AdminShell>
  );
}
