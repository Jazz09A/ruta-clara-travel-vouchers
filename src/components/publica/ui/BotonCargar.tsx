import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export interface BotonCargarProps {
  children?: ReactNode | undefined;
  cargando?: boolean | undefined;
  onClick?: (() => void) | undefined;
  deshabilitado?: boolean | undefined;
  variante?: "primario" | "secundario" | "peligro" | undefined;
  className?: string | undefined;
  type?: "button" | "submit" | undefined;
}

/**
 * Botón con estado de carga (C-01).
 *
 * Mientras carga ignora los clics (doble envío imposible, UX-18) y se
 * anuncia con `aria-busy`.
 */
export function BotonCargar({
  children,
  cargando,
  onClick,
  deshabilitado,
  variante = "primario",
  className,
  type = "button",
}: BotonCargarProps) {
  const estilos = {
    primario: "bg-primary text-primary-foreground hover:bg-primary/90",
    secundario: "border border-input bg-card text-foreground hover:bg-accent",
    peligro: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  } as const;

  return (
    <button
      type={type}
      onClick={cargando ? undefined : onClick}
      disabled={cargando || deshabilitado}
      aria-busy={cargando || undefined}
      className={cn(
        "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
        estilos[variante],
        className,
      )}
    >
      {cargando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {cargando ? "Un momento…" : children}
    </button>
  );
}
