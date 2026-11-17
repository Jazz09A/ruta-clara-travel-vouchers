import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AsistenteTour } from "@/components/admin/tours/asistente-tour";
import { ShellAdmin } from "@/components/admin/ui/shell";
import { usePermisoAdmin, SinPermiso } from "@/components/admin/ui/permisos";

export const Route = createFileRoute("/admin/tours/nuevo")({
  head: () => ({
    meta: [
      { title: "Nuevo tour · Panel de reservas" },
      {
        name: "description",
        content:
          "Alta de tours con la forma del catálogo: datos, contenido, puntos de salida, fechas y precios.",
      },
    ],
  }),
  component: NuevoTour,
});

/**
 * **Alta de tours** (RF-1.1).
 *
 * Es una página (no un modal) porque el tour tiene muchos campos: el
 * asistente va paso a paso y siempre se ve el avance.
 */
function NuevoTour() {
  const puedeEditar = usePermisoAdmin("tours.editar");
  const navegar = useNavigate();

  return (
    <ShellAdmin
      titulo="Nuevo tour"
      descripcion="Completa los datos del tour tal como los define el catálogo: con sus puntos de salida, sus salidas y sus precios."
      breadcrumb={[
        { label: "Panel", to: "/admin" },
        { label: "Tours", to: "/admin/tours" },
        { label: "Nuevo tour" },
      ]}
    >
      {!puedeEditar ? (
        <SinPermiso permiso="tours.editar" accion="crear un tour" />
      ) : (
        <AsistenteTour
          onCreado={async (tour) => {
            navegar({ to: "/admin/tours/$id", params: { id: tour.id } });
          }}
        />
      )}
    </ShellAdmin>
  );
}
