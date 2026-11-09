import { Link } from "@tanstack/react-router";
import { ExternalLink, LogOut, Plus } from "lucide-react";

import { SheetBottom } from "@/components/admin/SheetBottom";
import { Button } from "@/components/ui/button";
import { MARCA } from "@/lib/brand";
import { cn } from "@/lib/utils";
import {
  ETIQUETA_GRUPO,
  ETIQUETA_ROL,
  ORDEN_GRUPOS,
  esRutaActiva,
  menuDelRol,
} from "@/components/admin/layout/menu";
import { useSesion } from "@/components/admin/auth/sesion";
import { tienePermiso } from "@/lib/domain/types";

/**
 * Menú «Más» del móvil: hoja inferior con el resto de secciones y los
 * datos de la cuenta. Las secciones se agrupan para que la lista siga
 * siendo legible cuando el rol tiene muchos permisos.
 */

const ES_DEV = import.meta.env.DEV;

export interface MenuMasProps {
  abierto: boolean;
  onAbiertoCambia: (abierto: boolean) => void;
  rutaActual: string;
}

export function MenuMas({ abierto, onAbiertoCambia, rutaActual }: MenuMasProps) {
  const { usuario, cerrarSesion } = useSesion();
  const puedeCrearReserva = usuario ? tienePermiso(usuario.rol, "reservas.crear") : false;
  const items = menuDelRol(usuario?.rol ?? null).filter((item) => !item.barraInferior);
  const grupos = ORDEN_GRUPOS.map((grupo) => ({
    grupo,
    items: items.filter((item) => item.grupo === grupo),
  })).filter((bloque) => bloque.items.length > 0);

  return (
    <SheetBottom
      abierto={abierto}
      onAbiertoCambia={onAbiertoCambia}
      titulo="Más opciones"
      descripcion="Todas las secciones del panel"
      pie={
        <div className="flex w-full flex-col gap-2">
          <Button
            variant="outline"
            className="min-h-11 w-full"
            onClick={() => {
              onAbiertoCambia(false);
              cerrarSesion();
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Cerrar sesión
          </Button>
          {ES_DEV ? (
            <a
              href="/r/demo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-input px-4 text-sm font-medium"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Ver el formulario del cliente
            </a>
          ) : null}
        </div>
      }
    >
      {usuario ? (
        <div className="mb-4 rounded-xl border border-border bg-muted/40 px-4 py-3">
          <p className="truncate text-sm font-bold text-foreground">{usuario.nombre}</p>
          <p className="truncate text-xs text-muted-foreground">
            {ETIQUETA_ROL[usuario.rol]} · {usuario.correo}
          </p>
        </div>
      ) : null}

      {puedeCrearReserva ? (
        <Link
          to="/admin/reservas/nueva"
          onClick={() => onAbiertoCambia(false)}
          className="mb-4 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nueva reserva
        </Link>
      ) : null}

      <div className="flex flex-col gap-4">
        {grupos.map(({ grupo, items: itemsGrupo }) => (
          <section key={grupo} aria-label={ETIQUETA_GRUPO[grupo]}>
            <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {ETIQUETA_GRUPO[grupo]}
            </p>
            <ul className="flex flex-col gap-1">
              {itemsGrupo.map((item) => {
                const activo = esRutaActiva(rutaActual, item.ruta);
                const Icono = item.icono;
                return (
                  <li key={item.id}>
                    <Link
                      to={item.ruta}
                      onClick={() => onAbiertoCambia(false)}
                      aria-current={activo ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold",
                        activo
                          ? "bg-secondary text-secondary-foreground"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      <Icono className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                      <span className="truncate">{item.etiqueta}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-4 px-3 text-xs text-muted-foreground">
        {MARCA.nombre} · {MARCA.nombreCompleto}
      </p>
    </SheetBottom>
  );
}
