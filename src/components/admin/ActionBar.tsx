import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Barra de acción inferior (C-08).
 *
 * Fija al borde inferior en móvil (respeta `safe-area-inset-bottom`) y con
 * espacio en el flujo para que el contenido no quede tapado (UX-05).
 * En escritorio deja de ser fija: el flujo vuelve al contenido normal.
 */

export interface ActionBarProps {
  children: ReactNode;
  className?: string;
}

export function ActionBar({ children, className }: ActionBarProps) {
  return (
    <>
      <div aria-hidden="true" className="h-[84px] lg:hidden" />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur",
          "pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden",
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}
