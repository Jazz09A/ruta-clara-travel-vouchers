import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { tienePermiso, type Permiso, type Usuario } from "@/lib/domain/types";

/**
 * Sesión del panel (copia local).
 *
 * Mientras el módulo compartido `auth/sesion` no exista, esta implementación
 * resuelve el usuario actual desde la API simulada y expone los permisos
 * derivados del rol. Los componentes solo dependen de `useSesion` y
 * `usePermiso`, así que el origen puede cambiar sin tocar las pantallas.
 */

export interface SesionAdmin {
  /** Usuario con sesión iniciada (`null` si todavía no se resuelve). */
  usuario: Usuario | null;
  /** `true` cuando hay un usuario con sesión. */
  autenticado: boolean;
  /** `true` mientras se resuelve la sesión. */
  cargando: boolean;
}

/** Usuario de la sesión actual. */
export function useSesion(): SesionAdmin {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "yo"],
    queryFn: async () => {
      const respuesta = await api.admin.yo();
      return respuesta.usuario;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    usuario: data ?? null,
    autenticado: Boolean(data),
    cargando: isLoading,
  };
}

/** `true` cuando el usuario de la sesión tiene el permiso pedido. */
export function usePermiso(permiso: Permiso): boolean {
  const { usuario } = useSesion();
  if (!usuario) return false;
  return tienePermiso(usuario.rol, permiso);
}
