import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
  head: () => ({
    meta: [
      { title: "Agencia Full Days · Reservas" },
      { name: "description", content: "Gestión de reservas de Full Days y Fines de Semana." },
      { property: "og:title", content: "Agencia Full Days · Reservas" },
      { property: "og:description", content: "Gestión de reservas de Full Days y Fines de Semana." },
    ],
  }),
});
