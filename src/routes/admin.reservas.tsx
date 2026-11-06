import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/reservas")({
  head: () => ({
    meta: [
      { title: "Reservas · Panel" },
      { name: "description", content: "Tablero y lista de reservas de la agencia." },
    ],
  }),
  component: Reservas,
});

function Reservas() {
  return <Outlet />;
}
