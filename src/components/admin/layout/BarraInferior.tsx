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
 * Accesos principales: Inicio, Reservas, Pagos y Salidas (según permisos)
 * más «Más» para el resto de secciones. Se mantiene fija al borde inferior,
 * respeta el área segura y usa fondo opaco para evitar saltos al hacer scroll.
 */

export interface BarraInferiorProps {
  rutaActual: string;
}

export function BarraInferior({ rutaActual }: BarraInferiorProps) {
  const { usuario } = useSesion();
  const [masAbierto, setMasAbierto] = useState(false);

  const todos = menuDelRol(usuario?.rol ?? null);
  const items = todos.filter((item) => item.barraInferior);
  const secundarios = todos.filter((item) => !item.barraInferior);
  const masActivo = secundarios.some((item) => esRutaActiva(rutaActual, item.ruta));
  const columnas = Math.max(items.length + 1, 2);

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background",
          "pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_-16px_rgba(0,0,0,0.45)]",
          "lg:hidden",
        )}
      >
        <ul
          className="grid w-full items-stretch"
          style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
        >
          {items.map((item) => {
            const activo = esRutaActiva(rutaActual, item.ruta);
            const Icono = item.icono;
            return (
              <li key={item.id} className="min-w-0">
                <Link
                  to={item.ruta}
                  activeOptions={{ exact: item.ruta === "/admin" }}
                  aria-current={activo ? "page" : undefined}
                  className={cn(
                    "flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-0.5 px-1 pb-1.5 pt-1 text-[10px] font-semibold leading-none",
                    activo ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-8 w-12 place-items-center rounded-full transition-colors",
                      activo ? "bg-primary/10" : "bg-transparent",
                    )}
                  >
                    <Icono className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="max-w-full truncate">{item.etiqueta}</span>
                </Link>
              </li>
            );
          })}

          <li className="min-w-0">
            <button
              type="button"
              onClick={() => setMasAbierto(true)}
              aria-haspopup="dialog"
              aria-expanded={masAbierto}
              aria-current={masActivo ? "page" : undefined}
              aria-label="Más secciones"
              className={cn(
                "flex min-h-[58px] w-full min-w-0 flex-col items-center justify-center gap-0.5 px-1 pb-1.5 pt-1 text-[10px] font-semibold leading-none",
                masActivo ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-12 place-items-center rounded-full transition-colors",
                  masActivo ? "bg-primary/10" : "bg-transparent",
                )}
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="max-w-full truncate">Más</span>
            </button>
          </li>
        </ul>
      </nav>
      <MenuMas abierto={masAbierto} onAbiertoCambia={setMasAbierto} rutaActual={rutaActual} />
    </>
  );
}
