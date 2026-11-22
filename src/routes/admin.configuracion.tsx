import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración · Panel" },
      {
        name: "description",
        content: "Configuración general, métodos de pago, términos y usuarios.",
      },
    ],
  }),
  component: Configuracion,
});

function Configuracion() {
  return <Outlet />;
}
