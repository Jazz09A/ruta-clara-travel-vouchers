import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/pagos")({
  head: () => ({
    meta: [
      { title: "Pagos · Panel" },
      { name: "description", content: "Cola de pagos pendientes de validación." },
    ],
  }),
  component: Pagos,
});

function Pagos() {
  return <Outlet />;
}
