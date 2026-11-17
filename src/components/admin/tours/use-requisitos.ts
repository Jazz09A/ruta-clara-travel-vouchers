import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { RequisitoTour } from "@/lib/domain/types";

/**
 * Requisitos para activar un tour: **los calcula el servidor**.
 *
 * Antes el panel decía «todo listo» con la política y los términos, y el
 * servidor fallaba después por el formulario o las tarifas. Ahora la lista
 * sale de `GET /adminfx/tours/:id/requisitos`, que es la misma que usa la
 * activación.
 */
export function useRequisitosTour(id: string | null) {
  return useQuery({
    queryKey: ["admin", "tour-requisitos", id],
    queryFn: () => api.admin.requisitosTour(id as string),
    enabled: Boolean(id),
  });
}

export type { RequisitoTour };
