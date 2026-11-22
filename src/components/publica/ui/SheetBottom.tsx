import type { ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface SheetBottomProps {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  titulo: string;
  descripcion?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}

/**
 * Hoja inferior (C-14 / UX-35).
 *
 * En móvil el contenido llega desde abajo; en escritorio se limita a un
 * diálogo centrado. El título es visible (no sólo `sr-only`) porque el
 * cliente usa la hoja para leer textos largos.
 */
export function SheetBottom({
  abierto,
  onAbiertoChange,
  titulo,
  descripcion,
  children,
  className,
}: SheetBottomProps) {
  return (
    <Sheet open={abierto} onOpenChange={onAbiertoChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "max-h-[85dvh] overflow-y-auto rounded-t-2xl border-border bg-card p-0 sm:max-w-lg sm:rounded-2xl",
          className,
        )}
      >
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="text-base font-bold text-foreground">{titulo}</SheetTitle>
          {descripcion ? (
            <SheetDescription className="text-sm text-muted-foreground">
              {descripcion}
            </SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="px-5 py-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
