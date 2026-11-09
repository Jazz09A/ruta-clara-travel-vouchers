import { Link } from "@tanstack/react-router";
import { Bell, ChevronRight, LogOut } from "lucide-react";
import { useState, type ReactNode, type Ref } from "react";

import { BuscadorGlobal } from "@/components/admin/layout/BuscadorGlobal";
import { CampanaNotificaciones } from "@/components/admin/layout/CampanaNotificaciones";
import { useSesion } from "@/components/admin/auth/sesion";
import { ETIQUETA_ROL } from "@/components/admin/layout/menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Cabecera del panel.
 *
 * Móvil: título de la pantalla + búsqueda/campana en la primera fila y las
 * acciones contextuales en una segunda fila desplazable. Así el título nunca
 * se comprime y los botones no se salen de la pantalla.
 * Escritorio: una sola fila con título + acciones + búsqueda + campana + usuario.
 */

const ES_DEV = import.meta.env.DEV;

export interface Migaja {
  label: string;
  to?: string;
}

export interface CabeceraAdminProps {
  titulo: string;
  acciones?: ReactNode;
  breadcrumb?: Migaja[];
  tituloRef?: Ref<HTMLHeadingElement>;
}

export function CabeceraAdmin({ titulo, acciones, breadcrumb, tituloRef }: CabeceraAdminProps) {
  const { usuario, cerrarSesion } = useSesion();
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2 sm:px-4 lg:flex-nowrap lg:px-8">
        <div className="min-w-0 flex-1">
          {breadcrumb && breadcrumb.length > 0 ? (
            <nav aria-label="Ruta de la pantalla" className="mb-0.5 hidden lg:block">
              <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                {breadcrumb.map((miga, indice) => (
                  <li key={`${miga.label}-${indice}`} className="flex items-center gap-1">
                    {indice > 0 ? <ChevronRight className="h-3 w-3" aria-hidden="true" /> : null}
                    {miga.to ? (
                      <Link to={miga.to} className="rounded hover:text-foreground">
                        {miga.label}
                      </Link>
                    ) : (
                      <span aria-current="page">{miga.label}</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <h1
            ref={tituloRef}
            tabIndex={-1}
            className="truncate text-lg font-extrabold tracking-tight outline-none sm:text-xl lg:text-2xl"
          >
            {titulo}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-1 lg:order-3 lg:gap-2">
          {/* Búsqueda global (una sola instancia: se adapta a móvil/escritorio). */}
          <BuscadorGlobal abierto={buscadorAbierto} onAbiertoCambia={setBuscadorAbierto} />

          <CampanaNotificaciones />

          {usuario ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="hidden min-h-11 min-w-11 items-center gap-2 rounded-xl border border-border bg-card px-2 text-sm font-semibold lg:inline-flex"
                  aria-label="Menú de usuario"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-[11px] font-bold text-primary-foreground">
                    {iniciales(usuario.nombre)}
                  </span>
                  <span className="max-w-[10rem] truncate">{usuario.nombre}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-bold text-foreground">{usuario.nombre}</p>
                  <p className="text-xs text-muted-foreground">{usuario.correo}</p>
                  <p className="mt-1 inline-flex rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                    {ETIQUETA_ROL[usuario.rol]}
                  </p>
                </DropdownMenuLabel>
                {ES_DEV ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a href="/r/demo" target="_blank" rel="noopener noreferrer">
                        <Bell className="h-4 w-4" aria-hidden="true" />
                        Ver el formulario del cliente
                      </a>
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => cerrarSesion()}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {acciones ? (
          <div
            className={[
              "order-last flex w-full items-center gap-2 overflow-x-auto pb-0.5",
              "lg:order-2 lg:ml-auto lg:w-auto lg:overflow-visible lg:pb-0",
              "[&>*]:shrink-0 [&>div]:items-center max-lg:[&>div]:[flex-wrap:nowrap]",
              "[&_a]:whitespace-nowrap [&_button]:whitespace-nowrap",
            ].join(" ")}
          >
            {acciones}
          </div>
        ) : null}
      </div>
    </header>
  );
}

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}
