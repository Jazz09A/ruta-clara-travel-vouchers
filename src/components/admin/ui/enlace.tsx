import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export interface EnlaceAdminProps {
  /** Ruta interna del panel (por ejemplo `/admin/tours`). */
  to: string;
  children: ReactNode;
  className?: string | undefined;
  /** Texto alternativo cuando el enlace es solo un icono. */
  ariaLabel?: string | undefined;
  title?: string | undefined;
  onClick?: ((evento: React.MouseEvent<HTMLAnchorElement>) => void) | undefined;
}

/**
 * Enlace interno del panel.
 *
 * Envuelve el `Link` de TanStack Router para aceptar la ruta como texto
 * plano: el árbol de rutas se genera en tiempo de compilación, así que un
 * enlace escrito a mano no se puede validar con el tipado del router mientras
 * esa tabla no exista.
 */
export function EnlaceAdmin({ to, children, className, ariaLabel, title, onClick }: EnlaceAdminProps) {
  return (
    <Link to={to} className={className} aria-label={ariaLabel} title={title} onClick={onClick}>
      {children}
    </Link>
  );
}
