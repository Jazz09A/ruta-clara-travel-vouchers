import * as React from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Hoja inferior (C-14).
 *
 * En móvil es una hoja desde el borde inferior; en escritorio se convierte
 * en un panel centrado para no romper la disposición de dos columnas.
 */

export interface SheetBottomProps {
  abierto: boolean;
  onAbiertoCambia: (abierto: boolean) => void;
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
  /** Acciones fijas al pie de la hoja. */
  pie?: React.ReactNode;
  className?: string;
}

export function SheetBottom({
  abierto,
  onAbiertoCambia,
  titulo,
  descripcion,
  children,
  pie,
  className,
}: SheetBottomProps) {
  return (
    <Sheet open={abierto} onOpenChange={onAbiertoCambia}>
      <SheetContent
        side="bottom"
        className={cn(
          "max-h-[88dvh] overflow-hidden rounded-t-2xl border-border bg-background p-0 sm:left-1/2 sm:right-auto sm:max-h-[80dvh] sm:w-[30rem] sm:-translate-x-1/2 sm:rounded-2xl",
          className,
        )}
      >
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <div
            className="mx-auto mb-1 h-1.5 w-12 rounded-full bg-border sm:hidden"
            aria-hidden="true"
          />
          <SheetTitle className="text-base">{titulo}</SheetTitle>
          {descripcion ? (
            <SheetDescription className="text-sm text-muted-foreground">
              {descripcion}
            </SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="max-h-[60dvh] overflow-y-auto px-5 py-4">{children}</div>
        {pie ? (
          <SheetFooter className="border-t border-border px-5 py-3 sm:justify-end">
            {pie}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
