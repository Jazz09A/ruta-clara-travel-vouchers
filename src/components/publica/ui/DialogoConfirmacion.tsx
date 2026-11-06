import type { ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface DialogoConfirmacionProps {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  titulo: string;
  descripcion?: ReactNode | undefined;
  /** Verbo explícito en el botón (UX-40): «Eliminar pasajero», no «Aceptar». */
  etiquetaConfirmar: string;
  etiquetaCancelar?: string | undefined;
  onConfirmar: () => void;
  /** El botón principal queda en rojo y el foco inicial en «Cancelar». */
  destructivo?: boolean | undefined;
  cargando?: boolean | undefined;
}

/**
 * Diálogo de confirmación (C-15 / UX-35..UX-42).
 *
 * Se usa para decisiones de una sola vez. El botón destructivo nunca recibe
 * el foco inicial (UX-40) y el diálogo se cierra con `Esc`.
 */
export function DialogoConfirmacion({
  abierto,
  onAbiertoChange,
  titulo,
  descripcion,
  etiquetaConfirmar,
  etiquetaCancelar = "Cancelar",
  onConfirmar,
  destructivo,
  cargando,
}: DialogoConfirmacionProps) {
  return (
    <AlertDialog open={abierto} onOpenChange={onAbiertoChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-bold">{titulo}</AlertDialogTitle>
          {descripcion ? (
            <AlertDialogDescription asChild>
              <div className="text-sm leading-relaxed text-muted-foreground">{descripcion}</div>
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={cargando} className="min-h-11">
            {etiquetaCancelar}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={cargando}
            onClick={(evento) => {
              // `preventDefault` evita el cierre automático mientras la acción
              // se ejecuta (puede ser asíncrona).
              evento.preventDefault();
              onConfirmar();
            }}
            className={
              destructivo
                ? "min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "min-h-11"
            }
          >
            {cargando ? "Un momento…" : etiquetaConfirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
