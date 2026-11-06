import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Diálogo de confirmación (C-15).
 *
 * El botón de acción usa un verbo explícito («Cancelar reserva», «Crear de
 * todos modos»), nunca «Sí/No». El botón destructivo no recibe el foco
 * inicial (UX-40).
 */

export interface DialogoConfirmacionProps {
  abierto: boolean;
  onAbiertoCambia: (abierto: boolean) => void;
  titulo: string;
  descripcion?: string;
  /** Verbo explícito de la acción confirmatoria. */
  textoConfirmar: string;
  textoCancelar?: string;
  onConfirmar: () => void;
  onCancelar?: () => void;
  /** Estilo destructivo para acciones irreversibles. */
  destructivo?: boolean;
  cargando?: boolean;
  /** Contenido extra (motivo, resumen…). */
  children?: React.ReactNode;
  className?: string;
}

export function DialogoConfirmacion({
  abierto,
  onAbiertoCambia,
  titulo,
  descripcion,
  textoConfirmar,
  textoCancelar = "Cancelar",
  onConfirmar,
  onCancelar,
  destructivo = false,
  cargando = false,
  children,
  className,
}: DialogoConfirmacionProps) {
  return (
    <Dialog open={abierto} onOpenChange={onAbiertoCambia}>
      <DialogContent
        className={cn("max-h-[90dvh] overflow-y-auto sm:max-w-lg", className)}
        onEscapeKeyDown={(e) => {
          if (cargando) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion ? <DialogDescription>{descripcion}</DialogDescription> : null}
        </DialogHeader>
        {children ? <div className="space-y-3 py-2">{children}</div> : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onCancelar?.();
              onAbiertoCambia(false);
            }}
            disabled={cargando}
            className="min-h-11"
          >
            {textoCancelar}
          </Button>
          <Button
            type="button"
            variant={destructivo ? "destructive" : "default"}
            onClick={onConfirmar}
            disabled={cargando}
            className="min-h-11"
          >
            {cargando ? "Un momento…" : textoConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
