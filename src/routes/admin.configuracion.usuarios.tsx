import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Users,
  Plus,
  Pencil,
  Shield,
  CheckCircle2,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Campo } from "@/components/admin/Campo";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Usuario, Rol, Permiso } from "@/lib/domain/types";
import { PERMISOS_POR_ROL, tienePermiso } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogoConfirmacion } from "@/components/admin/DialogoConfirmacion";

const ETIQUETA_ROL: Record<Rol, string> = {
  SA: "Super Admin",
  AD: "Administrador",
  OP: "Operador",
  VAL: "Validador",
  GU: "Guía",
};

const DESCRIPCION_ROL: Record<Rol, string> = {
  SA: "Acceso total a todas las funciones del sistema",
  AD: "Todo lo del super admin menos auditoría ni gestión de usuarios",
  OP: "Gestión de reservas, pagos y clientes",
  VAL: "Validación de pagos y manejo de salidas",
  GU: "Acceso a salidas y manifiestos",
};

export const Route = createFileRoute("/admin/configuracion/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuarios y permisos · Panel" },
      { name: "description", content: "Equipo, roles y accesos." },
    ],
  }),
  component: UsuariosPermisos,
});

function UsuariosPermisos() {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [rolSeleccionado, setRolSeleccionado] = useState<Rol | null>(null);

  const { data: datos, isLoading } = useQuery({
    queryKey: ["configuracion", "usuarios"],
    queryFn: () => api.admin.configuracion(),
  });

  const usuarios = datos?.usuarios ?? [];

  const mutationGuardar = useMutation({
    mutationFn: async (usuario: Partial<Usuario> & { id?: string }) => {
      // Simular guardado
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { success: true };
    },
    onSuccess: () => {
      toast.success("Usuario guardado");
      setEditando(null);
      queryClient.invalidateQueries({ queryKey: ["configuracion", "usuarios"] });
    },
    onError: () => {
      toast.error("No pudimos guardar el usuario");
    },
  });

  const handleGuardar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editando) return;

    const formData = new FormData(e.currentTarget);
    const usuario: Partial<Usuario> = {
      id: editando.id,
      nombre: formData.get("nombre") as string,
      correo: formData.get("correo") as string,
      rol: formData.get("rol") as Rol,
      activo: formData.get("activo") === "true",
    };

    mutationGuardar.mutate(usuario);
  };

  const getPermisosPorRol = (rol: Rol): Permiso[] => {
    return PERMISOS_POR_ROL[rol] || [];
  };

  const formatearPermiso = (permiso: string): string => {
    return permiso
      .split(".")
      .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
      .join(" - ");
  };

  return (
    <AdminShell
      titulo="Usuarios y permisos"
      breadcrumb={[
        { label: "Panel", to: "/admin" },
        { label: "Configuración", to: "/admin/configuracion" },
        { label: "Usuarios y permisos" },
      ]}
    >
      <div className="mx-auto w-full max-w-5xl">
        <Link
          to="/admin/configuracion"
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a configuración
        </Link>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Gestiona el equipo, roles y accesos al sistema
          </p>
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            onClick={() =>
              setEditando({
                id: "",
                nombre: "",
                correo: "",
                rol: "OP",
                activo: true,
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Nuevo usuario
          </Button>
        </div>

        {/* Lista de usuarios */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : usuarios.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
              <p className="mt-4 text-sm text-muted-foreground">No hay usuarios configurados</p>
            </div>
          ) : (
            usuarios.map((usuario) => (
              <div
                key={usuario.id}
                className="rounded-2xl border border-border bg-card p-6 shadow-card"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Users className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">{usuario.nombre}</h3>
                        <p className="text-sm text-muted-foreground">{usuario.correo}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="outline">{ETIQUETA_ROL[usuario.rol]}</Badge>
                      {usuario.activo ? (
                        <Badge variant="default" className="min-h-8">
                          <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="min-h-8">
                          <XCircle className="mr-1 h-3 w-3" aria-hidden="true" />
                          Inactivo
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setEditando(usuario)}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
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
            titulo={editando.id ? "Editar usuario" : "Nuevo usuario"}
            descripcion="Configura los datos y permisos del usuario"
            textoConfirmar="Guardar"
            onConfirmar={() => setEditando(null)}
            cargando={mutationGuardar.isPending}
          >
            <form onSubmit={handleGuardar} className="space-y-4">
              <Campo
                id="nombre"
                label="Nombre completo"
                type="text"
                defaultValue={editando.nombre}
                placeholder="Ej: María González"
                required
              />

              <Campo
                id="correo"
                label="Correo electrónico"
                type="email"
                defaultValue={editando.correo}
                placeholder="Ej: maria@escapetour.app"
                required
              />

              <Campo
                id="rol"
                label="Rol"
                type="select"
                defaultValue={editando.rol}
                required
                onChange={(e) => setRolSeleccionado(e.target.value as Rol)}
              >
                <option value="SA">Super Admin (SA)</option>
                <option value="AD">Administrador (AD)</option>
                <option value="OP">Operador (OP)</option>
                <option value="VAL">Validador (VAL)</option>
                <option value="GU">Guía (GU)</option>
              </Campo>

              {rolSeleccionado && (
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <p className="text-sm font-semibold text-foreground">
                      Permisos del rol {ETIQUETA_ROL[rolSeleccionado]}
                    </p>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    {DESCRIPCION_ROL[rolSeleccionado]}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {getPermisosPorRol(rolSeleccionado).map((permiso) => (
                      <Badge key={permiso} variant="outline" className="text-xs">
                        {formatearPermiso(permiso)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

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
