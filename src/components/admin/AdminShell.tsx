import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ProveedorSesion, useNavegarAdmin, useSesion } from "@/components/admin/auth/sesion";
import { BarraInferior } from "@/components/admin/layout/BarraInferior";
import { CabeceraAdmin } from "@/components/admin/layout/CabeceraAdmin";
import { NavegacionLateral } from "@/components/admin/layout/NavegacionLateral";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Shell del panel administrativo (Spec §9.1).
 *
 * - Móvil (< 1024 px): barra inferior con 4 accesos + menú «Más» en hoja
 *   inferior. Contenido en una columna.
 * - Escritorio (≥ 1024 px): barra lateral fija y colapsable con el menú
 *   construido desde los permisos del rol.
 *
 * API pública:
 * ```tsx
 * <AdminShell titulo="Reservas" acciones={<BotonCargar>Nueva</BotonCargar>}>
 *   ...contenido...
 * </AdminShell>
 * ```
 */

export interface AdminShellProps {
  /** Título de la pantalla. Se muestra como `<h1>` y es el foco al entrar. */
  titulo: string;
  /** Acción principal contextual (botón, enlace, etc.). */
  acciones?: ReactNode;
  /** Contenido de la pantalla. */
  children: ReactNode;
  /** Ruta de migas mostrada sobre el título. */
  breadcrumb?: { label: string; to?: string }[];
}

export function AdminShell({ titulo, acciones, children, breadcrumb }: AdminShellProps) {
  return (
    <ProveedorSesion>
      <ContenidoAdminShell titulo={titulo} acciones={acciones} breadcrumb={breadcrumb}>
        {children}
      </ContenidoAdminShell>
    </ProveedorSesion>
  );
}

function ContenidoAdminShell({
  titulo,
  acciones,
  breadcrumb,
  children,
}: AdminShellProps) {
  const { cargando, autenticado, setRutaPendiente } = useSesion();
  const navegar = useNavegarAdmin();
  const ubicacion = useRouterState({ select: (s) => s.location });
  const [colapsada, setColapsada] = useState(false);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  const rutaActual = `${ubicacion.pathname}${ubicacion.searchStr}`;

  // Sin sesión válida: se guarda la ruta y se vuelve al login (UX-67).
  useEffect(() => {
    if (cargando || autenticado) return;
    setRutaPendiente(rutaActual);
    navegar("/admin/login", { reemplazar: true });
  }, [cargando, autenticado, rutaActual, setRutaPendiente, navegar]);

  // El foco va al título al entrar en la pantalla (Spec §3.9).
  useEffect(() => {
    tituloRef.current?.focus({ preventScroll: true });
  }, []);

  if (cargando) return <PantallaCarga />;
  if (!autenticado) return <PantallaCarga />;

  return (
    <div className="min-h-dvh bg-background">
      <NavegacionLateral
        colapsada={colapsada}
        onColapsadaCambia={setColapsada}
        rutaActual={rutaActual}
      />

      <div
        className={cn(
          "transition-[padding] duration-200",
          colapsada ? "lg:pl-[76px]" : "lg:pl-64",
        )}
      >
        <CabeceraAdmin
          titulo={titulo}
          acciones={acciones}
          breadcrumb={breadcrumb}
          tituloRef={tituloRef}
        />

        <main
          id="contenido-principal"
          className="px-4 pb-28 pt-4 lg:px-8 lg:pb-12 lg:pt-6"
        >
          {children}
        </main>
      </div>

      <BarraInferior rutaActual={rutaActual} />
    </div>
  );
}

function PantallaCarga() {
  return (
    <div className="min-h-dvh bg-background px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_v, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}
