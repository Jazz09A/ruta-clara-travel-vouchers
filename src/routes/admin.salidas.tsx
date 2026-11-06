import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/salidas")({
  head: () => ({
    meta: [
      { title: "Salidas · Panel" },
      { name: "description", content: "Calendario de fechas de salida de los tours." },
    ],
  }),
  component: Salidas,
});

function Salidas() {
  return <Outlet />;
}
