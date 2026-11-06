import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes · Panel" },
      { name: "description", content: "Catálogo de clientes y su historial de reservas." },
    ],
  }),
  component: Clientes,
});

function Clientes() {
  return <Outlet />;
}
