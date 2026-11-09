import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

/**
 * ¿La instalación todavía necesita el onboarding?
 *
 * `requiereOnboarding` sólo es confiable cuando `cargando` es `false` y
 * `error` es `false`: mientras tanto, el valor por defecto es `false` para no
 * bloquear al usuario con una pantalla de carga infinita.
 */
export interface EstadoSetup {
  /** `true` si aún no hay administrador y hay que instalar. */
  requiereOnboarding: boolean;
  /** `true` mientras se consulta el estado. */
  cargando: boolean;
  /** `true` si la consulta falló (no se sabe si hace falta instalar). */
  error: boolean;
  /** Vuelve a consultar el estado. */
  reintentar(): void;
}

export function useSetupRequerido(): EstadoSetup {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["setup", "estado"],
    queryFn: () => api.setup.estado(),
    staleTime: 60 * 1000,
    // Un 404 o un 500 no se resuelven reintentando: el error se muestra.
    retry: false,
  });

  return {
    requiereOnboarding: data?.requiere_onboarding ?? false,
    cargando: isLoading,
    error: isError,
    reintentar: () => {
      void refetch();
    },
  };
}
