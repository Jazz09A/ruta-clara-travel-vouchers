import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LogoEscapate } from "@/components/brand/LogoEscapate";
import { MARCA } from "@/lib/brand";
import { cn } from "@/lib/utils";
import {
  ETIQUETA_GRUPO,
  ORDEN_GRUPOS,
  esRutaActiva,
  menuDelRol,
  type GrupoMenu,
} from "@/components/admin/layout/menu";
import { useSesion } from "@/components/admin/auth/sesion";

/**
 * Navegación lateral de escritorio (≥ 1024 px).
 *
 * El menú se construye desde los permisos del rol: lo que el rol no puede
 * hacer no aparece.
 */

export interface NavegacionLateralProps {
  colapsada: boolean;
  onColapsadaCambia: (colapsada: boolean) => void;
  rutaActual: string;
}

export function NavegacionLateral({
  colapsada,
  onColapsadaCambia,
  rutaActual,
}: NavegacionLateralProps) {
  const { usuario } = useSesion();
  const items = menuDelRol(usuario?.rol ?? null);

  return (
    <aside
      aria-label="Navegación principal"
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
        colapsada ? "w-[76px]" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center gap-2 border-b border-sidebar-border px-4",
          colapsada ? "justify-center px-0" : "",
        )}
      >
        <LogoEscapate tamano={colapsada ? 32 : 40} className="shrink-0" />
        {!colapsada ? (
          <span className="truncate text-base font-extrabold tracking-tight">{MARCA.nombre}</span>
        ) : (
          <span className="sr-only">{MARCA.nombre}</span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {ORDEN_GRUPOS.map((grupo) => {
          const itemsGrupo = items.filter((item) => item.grupo === grupo);
          if (itemsGrupo.length === 0) return null;
          return (
            <div key={grupo} className="mb-5">
              {!colapsada ? (
                <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {ETIQUETA_GRUPO[grupo]}
                </p>
              ) : null}
              <ul className="flex flex-col gap-1">
                {itemsGrupo.map((item) => {
                  const activo = esRutaActiva(rutaActual, item.ruta);
                  const Icono = item.icono;
                  return (
                    <li key={item.id}>
                      <Link
                        to={item.ruta}
                        activeOptions={{ exact: item.ruta === "/admin" }}
                        aria-current={activo ? "page" : undefined}
                        title={colapsada ? item.etiqueta : undefined}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                          colapsada ? "justify-center px-0" : "",
                          activo
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent",
                        )}
                      >
                        <Icono
                          className={cn("h-4.5 w-4.5 shrink-0", activo ? "text-primary" : "")}
                          aria-hidden="true"
                        />
                        {colapsada ? (
                          <span className="sr-only">{item.etiqueta}</span>
                        ) : (
                          item.etiqueta
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onColapsadaCambia(!colapsada)}
          aria-label={colapsada ? "Expandir el menú" : "Colapsar el menú"}
          className="min-h-11 min-w-11 w-full"
        >
          {colapsada ? (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs font-semibold">Colapsar</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
