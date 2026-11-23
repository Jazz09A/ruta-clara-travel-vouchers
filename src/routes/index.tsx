import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { ProveedorSesion, useSesion, useNavegarAdmin } from "@/components/admin/auth/sesion";
import { MARCA } from "@/lib/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${MARCA.nombre} · Panel administrativo` },
      {
        name: "description",
        content:
          "Panel administrativo de Escapate Tours: gestión de reservas, pagos, salidas y tours.",
      },
    ],
  }),
  component: EntradaAdmin,
});

function EntradaAdmin() {
  return (
    <ProveedorSesion>
      <RedirigirSegunSesion />
    </ProveedorSesion>
  );
}

function RedirigirSegunSesion() {
  const { cargando, autenticado } = useSesion();
  const navegar = useNavegarAdmin();

  useEffect(() => {
    if (cargando) return;
    if (autenticado) {
      navegar("/admin");
    } else {
      navegar("/admin/login");
    }
  }, [cargando, autenticado, navegar]);

  // Estado neutro mientras se verifica la sesión
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Cargando…</p>
      </div>
    </div>
  );
}
