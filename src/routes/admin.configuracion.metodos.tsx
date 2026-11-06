import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CreditCard, Plus, Pencil, Trash2, Copy, Eye, EyeOff } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Campo } from "@/components/admin/Campo";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MetodoPago } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogoConfirmacion } from "@/components/core/DialogoConfirmacion";

export const Route = createFileRoute("/admin/configuracion/metodos")({
  head: () => ({
    meta: [
      { title: "Métodos de pago · Panel" },
      { name: "description", content: "Gestión de cuentas bancarias, Zelle, Pago Móvil." },
    ],
  }),
  component: MetodosPago,
});

function MetodosPago() {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<MetodoPago | null>(null);
  const [dialogoEliminar, setDialogoEliminar] = useState<string | null>(null);

  const { data: datos, isLoading } = useQuery({
    queryKey: ["configuracion", "metodos"],
    queryFn: () => api.admin.configuracion(),
  });

  const metodos = datos?.metodos ?? [];

  const mutationGuardar = useMutation({
    mutationFn: async (metodo: Partial<MetodoPago> & { id?: string }) => {
      return await api.admin.guardarMetodoPago(metodo);
    },
    onSuccess: () => {
      toast.success("Método de pago guardado");
      setEditando(null);
      queryClient.invalidateQueries({ queryKey: ["configuracion", "metodos"] });
    },
    onError: () => {
      toast.error("No pudimos guardar el método de pago");
    },
  });

  const mutationEliminar = useMutation({
    mutationFn: async (id: string) => {
      // Simular eliminación marcando como inactivo
      return await api.admin.guardarMetodoPago({ id, activo: false });
    },
    onSuccess: () => {
      toast.success("Método de pago desactivado");
      setDialogoEliminar(null);
      queryClient.invalidateQueries({ queryKey: ["configuracion", "metodos"] });
    },
    onError: () => {
      toast.error("No pudimos desactivar el método de pago");
    },
  });

  const handleGuardar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editando) return;

    const formData = new FormData(e.currentTarget);
    const metodo: Partial<MetodoPago> = {
      id: editando.id,
      nombre: formData.get("nombre") as string,
      moneda: formData.get("moneda") as "USD" | "VES",
      activo: formData.get("activo") === "true",
      orden: parseInt(formData.get("orden") as string, 10),
      datos: [
        { etiqueta: "Cuenta", valor: formData.get("cuenta") as string, copiable: true },
        { etiqueta: "Titular", valor: formData.get("titular") as string, copiable: false },
        { etiqueta: "Banco", valor: formData.get("banco") as string, copiable: false },
      ],
      campos_requeridos: ["referencia", "monto"],
      requiere_comprobante: true,
      instrucciones: formData.get("instrucciones") as string,
    };

    mutationGuardar.mutate(metodo);
  };

  const handleEliminar = async (id: string) => {
    mutationEliminar.mutate(id);
  };

  const copiarAlPortapapeles = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast.success("Copiado al portapapeles");
  };

  return (
    <AdminShell
      titulo="Métodos de pago"
      breadcrumb={[{ label: "Panel", to: "/admin" }, { label: "Configuración", to: "/admin/configuracion" }, { label: "Métodos de pago" }]}
    >
      <div className="mx-auto w-full max-w-4xl">
        <Link
          to="/admin/configuracion"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a configuración
        </Link>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Métodos de pago
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Configura las cuentas bancarias, Zelle y Pago Móvil que aceptas
            </p>
          </div>
        </div>

        {/* Lista de métodos */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : metodos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
              <p className="mt-4 text-sm text-muted-foreground">
                No hay métodos de pago configurados
              </p>
            </div>
          ) : (
            metodos.map((metodo) => (
              <div
                key={metodo.id}
                className="rounded-2xl border border-border bg-card p-6 shadow-card"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-foreground">{metodo.nombre}</h3>
                      <Badge variant={metodo.activo ? "default" : "secondary"}>
                        {metodo.activo ? "Activo" : "Inactivo"}
                      </Badge>
                      <Badge variant="outline">{metodo.moneda}</Badge>
                    </div>

                    <div className="mt-4 space-y-2">
                      {metodo.datos.map((dato, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">{dato.etiqueta}</p>
                            <p className="text-sm font-medium text-foreground">{dato.valor}</p>
                          </div>
                          {dato.copiable && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => copiarAlPortapapeles(dato.valor)}
                            >
                              <Copy className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    {metodo.instrucciones && (
                      <div className="mt-4 rounded-lg bg-muted/30 p-3">
                        <p className="text-xs font-semibold text-muted-foreground">Instrucciones</p>
                        <p className="mt-1 text-sm text-foreground">{metodo.instrucciones}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setEditando(metodo)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setDialogoEliminar(metodo.id)}
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
            titulo={`Editar ${editando.nombre}`}
            descripcion="Modifica los datos del método de pago"
            textoConfirmar="Guardar cambios"
            variante="default"
            loading={mutationGuardar.isPending}
            motivo={undefined}
          >
            <form onSubmit={handleGuardar} className="space-y-4">
              <Campo
                id="nombre"
                label="Nombre del método"
                type="text"
                defaultValue={editando.nombre}
                required
              />

              <Campo
                id="moneda"
                label="Moneda"
                type="select"
                defaultValue={editando.moneda}
                required
              >
                <option value="USD">USD</option>
                <option value="VES">VES (Bolívares)</option>
              </Campo>

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

              <Campo
                id="orden"
                label="Orden de visualización"
                type="number"
                defaultValue={editando.orden}
                min="1"
                required
              />

              <Campo
                id="cuenta"
                label="Número de cuenta"
                type="text"
                defaultValue={editando.datos[0]?.valor}
                required
              />

              <Campo
                id="titular"
                label="Titular de la cuenta"
                type="text"
                defaultValue={editando.datos[1]?.valor}
                required
              />

              <Campo
                id="banco"
                label="Banco"
                type="text"
                defaultValue={editando.datos[2]?.valor}
                required
              />

              <Campo
                id="instrucciones"
                label="Instrucciones adicionales"
                type="textarea"
                rows={3}
                defaultValue={editando.instrucciones}
              />

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
                  Guardar cambios
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
          titulo="Desactivar método de pago"
          descripcion="El método de pago dejará de estar disponible para los clientes, pero no se eliminará permanentemente."
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
