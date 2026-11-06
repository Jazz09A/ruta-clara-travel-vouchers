import { Link } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { esRutaActiva, menuDelRol } from "@/components/admin/layout/menu";
import { MenuMas } from "@/components/admin/layout/MenuMas";
import { useSesion } from "@/components/admin/auth/sesion";

/**
 * Barra inferior del móvil (< 1024 px).
 *
 * Cuatro accesos: Reservas, Pagos, Salidas y «Más» (Spec §9.1). Los tres
 * primeros sólo aparecen si el rol tiene el permiso; «Más» siempre está.
 */

export interface BarraInferiorProps {
  rutaActual: string;
}

export function BarraInferior({ rutaActual }: BarraInferiorProps) {
  const { usuario } = useSesion();
  const [masAbierto, setMasAbierto] = useState(false);
  const items = menuDelRol(usuario?.rol ?? null).filter((item) => item.barraInferior);

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur",
          "pb-[env(safe-area-inset-bottom)] lg:hidden",
        )}
      >
        <ul className="grid grid-cols-4">
          {items.map((item) => {
            const activo = esRutaActiva(rutaActual, item.ruta);
            const Icono = item.icono;
            return (
              <li key={item.id}>
                <Link
                  to={item.ruta}
                  aria-current={activo ? "page" : undefined}
                  className={cn(
                    "flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold",
                    activo ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icono className="h-5 w-5" aria-hidden="true" />
                  {item.etiqueta}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMasAbierto(true)}
              className="flex min-h-[60px] w-full flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold text-muted-foreground"
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              Más
            </button>
          </li>
        </ul>
      </nav>
      <MenuMas abierto={masAbierto} onAbiertoCambia={setMasAbierto} rutaActual={rutaActual} />
    </>
  );
}
