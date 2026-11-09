import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { MARCA } from "@/lib/brand";
import type { DatosAgencia } from "@/lib/domain/types";

/**
 * Datos de la agencia para la interfaz.
 *
 * El onboarding del primer arranque deja el nombre y el contacto de la
 * agencia en la configuración; aquí se leen (endpoint público) para que el
 * panel y el login se presenten con el nombre real y no con el de la demo.
 *
 * Mientras no haya respuesta (o si la API falla) se usa `MARCA` como valor
 * por defecto: la interfaz nunca se queda sin nombre.
 */

const ContextoAgencia = createContext<DatosAgencia | null>(null);

export function ProveedorAgencia({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: ["publico", "agencia"],
    queryFn: () => api.publica.agencia(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return <ContextoAgencia.Provider value={data ?? null}>{children}</ContextoAgencia.Provider>;
}

export interface AgenciaActual {
  /** Nombre corto de la agencia (barra lateral, títulos). */
  nombre: string;
  /** Nombre completo de la agencia. */
  nombreCompleto: string;
  email: string;
  whatsapp: string;
  direccion: string;
  zonaHoraria: string;
}

/** Datos de la agencia con `MARCA` como respaldo. */
export function useAgencia(): AgenciaActual {
  const datos = useContext(ContextoAgencia);

  return useMemo<AgenciaActual>(
    () => ({
      nombre: datos?.nombre ?? MARCA.nombre,
      nombreCompleto: datos?.nombre ?? MARCA.nombreCompleto,
      email: datos?.email ?? MARCA.email,
      whatsapp: datos?.telefono ?? MARCA.whatsapp,
      direccion: datos?.direccion ?? MARCA.direccion,
      zonaHoraria: datos?.zona_horaria ?? MARCA.zonaHoraria,
    }),
    [datos],
  );
}
