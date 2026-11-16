import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock3, MapPin, Pencil, Plus, Trash2 } from "lucide-react";

import { AdminShell } from "@/components/admin/AdminShell";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/domain/api";
import { formatTime } from "@/lib/format";
import type { PuntoSalida } from "@/lib/domain/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/configuracion/puntos")({
  head: () => ({
    meta: [
      { title: "Puntos de salida · Panel" },
      { name: "description", content: "Catálogo de puntos de salida: crear, editar y eliminar." },
    ],
  }),
  component: PuntosSalida,
});

function mensajeError(error: unknown): string {
  return error instanceof ApiError
    ? error.mensajeMostrable
    : "No pudimos completar la acción. Intenta de nuevo.";
}

interface EdicionPunto {
  id: string;
  nombre: string;
  hora: string;
  referencia: string;
  ciudad: string;
  seleccionable: boolean;
}

/**
 * Catálogo global de puntos de salida (Guatire, Guarenas, Caracas…).
 *
 * Todos los formularios públicos toman sus opciones de aquí: crear o quitar
 * un punto se refleja en los formularios sin republicarlos. Un punto que ya
 * se usó en reservas no se borra: se desactiva.
 */
function PuntosSalida() {
  const queryClient = useQueryClient();

  const { data: puntos = [], isLoading } = useQuery({
    queryKey: ["puntos-salida"],
    queryFn: () => api.admin.puntosSalida(),
  });

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ["puntos-salida"] });
    // El detalle de tours y los formularios públicos leen los puntos.
    void queryClient.invalidateQueries({ queryKey: ["tours"] });
    void queryClient.invalidateQueries({ queryKey: ["configuracion"] });
  };

  const [nombre, setNombre] = useState("");
  const [hora, setHora] = useState("06:00");
  const [referencia, setReferencia] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [seleccionable, setSeleccionable] = useState(true);
  const [edicion, setEdicion] = useState<EdicionPunto | null>(null);
  const [confirmarEliminacion, setConfirmarEliminacion] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: () =>
      api.admin.crearPuntoSalida({ nombre, hora, referencia, ciudad, seleccionable }),
    onSuccess: (punto) => {
      toast.success(`Punto «${punto.nombre}» creado`);
      setNombre("");
      setHora("06:00");
      setReferencia("");
      setCiudad("");
      setSeleccionable(true);
      invalidar();
    },
    onError: (error) => toast.error(mensajeError(error)),
  });

  const guardar = useMutation({
    mutationFn: (datos: EdicionPunto) =>
      api.admin.actualizarPuntoSalida(datos.id, {
        nombre: datos.nombre,
        hora: datos.hora,
        referencia: datos.referencia,
        ciudad: datos.ciudad,
        seleccionable: datos.seleccionable,
      }),
    onSuccess: (punto) => {
      toast.success(`Punto «${punto.nombre}» actualizado`);
      setEdicion(null);
      invalidar();
    },
    onError: (error) => toast.error(mensajeError(error)),
  });

  const alternarSeleccionable = useMutation({
    mutationFn: (punto: PuntoSalida) =>
      api.admin.actualizarPuntoSalida(punto.id, { seleccionable: punto.seleccionable === false }),
    onSuccess: (punto) => {
      toast.success(
        punto.seleccionable !== false
          ? `Punto «${punto.nombre}» ahora lo puede elegir el cliente`
          : `Punto «${punto.nombre}» pasa a ser de referencia: no lo elige el cliente`,
      );
      invalidar();
    },
    onError: (error) => toast.error(mensajeError(error)),
  });

  const alternarActivo = useMutation({
    mutationFn: (punto: PuntoSalida) =>
      api.admin.actualizarPuntoSalida(punto.id, { activo: !punto.activo }),
    onSuccess: (punto) => {
      toast.success(
        punto.activo
          ? `Punto «${punto.nombre}» activado`
          : `Punto «${punto.nombre}» desactivado: ya no aparece en los formularios`,
      );
      invalidar();
    },
    onError: (error) => toast.error(mensajeError(error)),
  });

  const eliminar = useMutation({
    mutationFn: (punto: PuntoSalida) => api.admin.eliminarPuntoSalida(punto.id),
    onSuccess: (resultado) => {
      setConfirmarEliminacion(null);
      if (resultado.eliminado) {
        toast.success(`Punto «${resultado.nombre}» eliminado`);
      } else {
        toast.info(
          `El punto «${resultado.nombre}» ya se usó en reservas: se desactivó para conservar el historial.`,
        );
      }
      invalidar();
    },
    onError: (error) => {
      setConfirmarEliminacion(null);
      toast.error(mensajeError(error));
    },
  });

  const listoCrear = nombre.trim().length > 0 && /^\d{2}:\d{2}$/.test(hora) && !crear.isPending;

  return (
    <AdminShell
      titulo="Puntos de salida"
      breadcrumb={[
        { label: "Panel", to: "/admin" },
        { label: "Configuración", to: "/admin/configuracion" },
        { label: "Puntos de salida" },
      ]}
    >
      <div className="mx-auto w-full max-w-3xl">
        <Link
          to="/admin/configuracion"
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a configuración
        </Link>

        {/* Catálogo ---------------------------------------------------- */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">
            Puntos de salida
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Estos puntos son los que ve el cliente en todos los formularios. Puedes crear, editar o
            quitar los que la agencia necesite. Los puntos marcados como{" "}
            <span className="font-semibold text-foreground">sólo referencia</span> se muestran como
            informativo (por ejemplo Caracas, que se confirma por WhatsApp) pero no los elige el
            cliente.
          </p>

          {isLoading ? (
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : puntos.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Aún no hay puntos de salida. Crea el primero abajo.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {puntos.map((punto) => {
                const editando = edicion?.id === punto.id;
                return (
                  <li key={punto.id} className="rounded-xl border border-border bg-background p-4">
                    {editando ? (
                      <div className="flex flex-col gap-3">
                        <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                          <div className="flex flex-col gap-1.5">
                            <Label
                              htmlFor={`editar-nombre-${punto.id}`}
                              className="text-sm font-semibold"
                            >
                              Nombre
                            </Label>
                            <Input
                              id={`editar-nombre-${punto.id}`}
                              value={edicion.nombre}
                              onChange={(evento) =>
                                setEdicion({ ...edicion, nombre: evento.target.value })
                              }
                              className="h-11"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label
                              htmlFor={`editar-hora-${punto.id}`}
                              className="text-sm font-semibold"
                            >
                              Hora
                            </Label>
                            <Input
                              id={`editar-hora-${punto.id}`}
                              type="time"
                              value={edicion.hora}
                              onChange={(evento) =>
                                setEdicion({ ...edicion, hora: evento.target.value })
                              }
                              className="h-11"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label
                            htmlFor={`editar-referencia-${punto.id}`}
                            className="text-sm font-semibold"
                          >
                            Referencia (opcional)
                          </Label>
                          <Textarea
                            id={`editar-referencia-${punto.id}`}
                            rows={2}
                            value={edicion.referencia}
                            onChange={(evento) =>
                              setEdicion({ ...edicion, referencia: evento.target.value })
                            }
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                          <div className="flex flex-col gap-1.5">
                            <Label
                              htmlFor={`editar-ciudad-${punto.id}`}
                              className="text-sm font-semibold"
                            >
                              Ciudad (opcional)
                            </Label>
                            <Input
                              id={`editar-ciudad-${punto.id}`}
                              value={edicion.ciudad}
                              onChange={(evento) =>
                                setEdicion({ ...edicion, ciudad: evento.target.value })
                              }
                              placeholder="Guatire, Guarenas, Caracas…"
                              className="h-11"
                            />
                          </div>
                          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                            <Checkbox
                              checked={edicion.seleccionable}
                              onCheckedChange={(estado) =>
                                setEdicion({ ...edicion, seleccionable: estado === true })
                              }
                            />
                            El cliente lo puede elegir
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-11"
                            disabled={guardar.isPending || edicion.nombre.trim() === ""}
                            onClick={() => guardar.mutate(edicion)}
                          >
                            {guardar.isPending ? "Guardando…" : "Guardar cambios"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-11"
                            disabled={guardar.isPending}
                            onClick={() => setEdicion(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : confirmarEliminacion === punto.id ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-foreground">
                          {`¿Eliminar «${punto.nombre}»? Si ya se usó en reservas se desactivará en su lugar.`}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-11"
                            disabled={eliminar.isPending}
                            onClick={() => eliminar.mutate(punto)}
                          >
                            {eliminar.isPending ? "Eliminando…" : "Sí, eliminar"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-11"
                            disabled={eliminar.isPending}
                            onClick={() => setConfirmarEliminacion(null)}
                          >
                            No
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
                            <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            <span>{punto.nombre}</span>
                            <Badge
                              variant={punto.activo ? "default" : "secondary"}
                              className="min-h-6 px-2 text-[11px]"
                            >
                              {punto.activo ? "Activo" : "Inactivo"}
                            </Badge>
                            {punto.seleccionable === false ? (
                              <Badge
                                variant="outline"
                                className="min-h-6 px-2 text-[11px] text-muted-foreground"
                              >
                                Sólo referencia
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                            {`${formatTime(punto.hora)}${punto.ciudad ? ` · ${punto.ciudad}` : ""} · clave «${punto.clave}»`}
                          </p>
                          {punto.referencia ? (
                            <p className="mt-1 text-xs text-muted-foreground">{punto.referencia}</p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-11"
                            onClick={() =>
                              setEdicion({
                                id: punto.id,
                                nombre: punto.nombre,
                                hora: punto.hora,
                                referencia: punto.referencia ?? "",
                                ciudad: punto.ciudad ?? "",
                                seleccionable: punto.seleccionable !== false,
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-11"
                            disabled={alternarSeleccionable.isPending}
                            onClick={() => alternarSeleccionable.mutate(punto)}
                          >
                            {punto.seleccionable !== false ? "Sólo referencia" : "Seleccionable"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-11"
                            disabled={alternarActivo.isPending}
                            onClick={() => alternarActivo.mutate(punto)}
                          >
                            {punto.activo ? "Desactivar" : "Activar"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-11 text-destructive"
                            onClick={() => setConfirmarEliminacion(punto.id)}
                            aria-label={`Eliminar el punto ${punto.nombre}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Crear -------------------------------------------------------- */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">
            Nuevo punto de salida
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            La hora es la recogida estimada; aparece junto al nombre en el formulario del cliente.
          </p>

          <form
            className="mt-5 flex flex-col gap-4"
            onSubmit={(evento) => {
              evento.preventDefault();
              if (listoCrear) crear.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="punto-nombre" className="text-sm font-semibold text-foreground">
                  Nombre
                </Label>
                <Input
                  id="punto-nombre"
                  value={nombre}
                  onChange={(evento) => setNombre(evento.target.value)}
                  placeholder="Por ejemplo: Guatire"
                  className="h-11"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="punto-hora" className="text-sm font-semibold text-foreground">
                  Hora estimada
                </Label>
                <Input
                  id="punto-hora"
                  type="time"
                  value={hora}
                  onChange={(evento) => setHora(evento.target.value)}
                  className="h-11"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="punto-referencia" className="text-sm font-semibold text-foreground">
                Referencia (opcional)
              </Label>
              <Textarea
                id="punto-referencia"
                rows={2}
                value={referencia}
                onChange={(evento) => setReferencia(evento.target.value)}
                placeholder="Dónde espera el vehículo, punto de referencia…"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="punto-ciudad" className="text-sm font-semibold text-foreground">
                  Ciudad (opcional)
                </Label>
                <Input
                  id="punto-ciudad"
                  value={ciudad}
                  onChange={(evento) => setCiudad(evento.target.value)}
                  placeholder="Guatire, Guarenas, Caracas…"
                  className="h-11"
                />
              </div>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                <Checkbox
                  checked={seleccionable}
                  onCheckedChange={(estado) => setSeleccionable(estado === true)}
                />
                El cliente lo puede elegir
              </label>
            </div>

            <BotonCargar
              type="submit"
              cargando={crear.isPending}
              className="w-full sm:w-auto sm:self-start"
              textoCargando="Creando…"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Crear punto de salida
            </BotonCargar>
          </form>
        </div>
      </div>
    </AdminShell>
  );
}
