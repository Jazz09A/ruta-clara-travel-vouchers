import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/tours")({
  head: () => ({
    meta: [
      { title: "Tours · Panel" },
      { name: "description", content: "Catálogo de tours y configuración de formularios." },
    ],
  }),
  component: Tours,
});

function Tours() {
  return <Outlet />;
}
