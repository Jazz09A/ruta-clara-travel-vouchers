import { Link } from "@tanstack/react-router";
import { ExternalLink, LogOut } from "lucide-react";

import { SheetBottom } from "@/components/admin/SheetBottom";
import { Button } from "@/components/ui/button";
import { MARCA } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { ETIQUETA_ROL, esRutaActiva, menuDelRol } from "@/components/admin/layout/menu";
import { useSesion } from "@/components/admin/auth/sesion";

/**
 * Menú «Más» del móvil: hoja inferior con el resto de secciones y los
 * datos de la cuenta.
 */

export interface MenuMasProps {
  abierto: boolean;
  onAbiertoCambia: (abierto: boolean) => void;
  rutaActual: string;
}

export function MenuMas({ abierto, onAbiertoCambia, rutaActual }: MenuMasProps) {
  const { usuario, cerrarSesion } = useSesion();
  const items = menuDelRol(usuario?.rol ?? null).filter((item) => !item.barraInferior);

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
          <a
            href="/r/demo"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-input px-4 text-sm font-medium"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Ver el formulario del cliente
          </a>
        </div>
      }
    >
      {usuario ? (
        <div className="mb-4 rounded-xl border border-border bg-muted/40 px-4 py-3">
          <p className="text-sm font-bold text-foreground">{usuario.nombre}</p>
          <p className="text-xs text-muted-foreground">
            {ETIQUETA_ROL[usuario.rol]} · {usuario.correo}
          </p>
        </div>
      ) : null}

      <ul className="flex flex-col gap-1">
        {items.map((item) => {
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
                {item.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 px-3 text-xs text-muted-foreground">
        {MARCA.nombre} · {MARCA.nombreCompleto}
      </p>
    </SheetBottom>
  );
}
