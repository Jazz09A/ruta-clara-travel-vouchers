import * as React from "react";
import { X } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEsEscritorio } from "@/lib/hooks/use-media-query";

export interface SheetBottomProps {
  /** Estado de apertura (controlado). */
  open: boolean;
  /** Se llama cuando la hoja se abre o se cierra. */
  onOpenChange: (open: boolean) => void;
  /** Titulo de la hoja. */
  title: string;
  /** Descripcion opcional (se anuncia junto al titulo). */
  description?: string | undefined;
  /** Contenido desplazable. */
  children: React.ReactNode;
  /** Pie fijo con las acciones. */
  footer?: React.ReactNode | undefined;
  className?: string | undefined;
}

const estiloPie: React.CSSProperties = {
  paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
};

/**
 * C-14 · Hoja inferior en movil, dialogo centrado en escritorio.
 *
 * Cumple el contrato de los modales (UX-37): atrapa el foco, se cierra con
 * `Esc` y con el boton «Cerrar», devuelve el foco al elemento que lo abrio y
 * bloquea el scroll del fondo. Nunca se apilan dos modales (UX-39).
 */
export function SheetBottom({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: SheetBottomProps) {
  const esEscritorio = useEsEscritorio();

  if (esEscritorio) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85dvh] max-w-lg gap-0 overflow-hidden p-0 [&>button]:hidden">
          <div className="flex max-h-[85dvh] min-h-0 flex-col overflow-hidden">
            <header className="flex items-start gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold text-foreground">
                  {title}
                </DialogTitle>
                {description ? (
                  <DialogDescription className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </DialogDescription>
                ) : null}
              </div>

              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Cerrar"
                  className="h-11 w-11"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DialogClose>
            </header>

            <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-4", className)}>
              {children}
            </div>

            {footer ? (
              <footer style={estiloPie} className="border-t border-border px-4 py-3">
                {footer}
              </footer>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] gap-0 overflow-hidden rounded-t-2xl p-0 [&>button]:hidden"
      >
        <div className="flex max-h-[85dvh] min-h-0 flex-col overflow-hidden">
          <header className="flex items-start gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-semibold text-foreground">{title}</SheetTitle>
              {description ? (
                <SheetDescription className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </SheetDescription>
              ) : null}
            </div>

            <SheetClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Cerrar"
                className="h-11 w-11"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </SheetClose>
          </header>

          <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-4", className)}>
            {children}
          </div>

          {footer ? (
            <footer style={estiloPie} className="border-t border-border px-4 py-3">
              {footer}
            </footer>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
