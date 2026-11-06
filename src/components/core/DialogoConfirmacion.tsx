import * as React from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Motivo obligatorio u opcional para acciones criticas (UX-41 · C-27). */
export interface MotivoDialogo {
  /** Valor actual (controlado por el llamador). */
  valor: string;
  /** Se llama en cada cambio del texto. */
  onChange: (valor: string) => void;
  /** Si es `true`, no se puede confirmar sin cumplir el minimo. */
  obligatorio?: boolean | undefined;
  /** Minimo de caracteres. Por defecto 5. */
  minimoCaracteres?: number | undefined;
  /** Plantillas rapidas que rellenan el motivo. */
  plantillas?: { etiqueta: string; texto: string }[] | undefined;
}

export interface DialogoConfirmacionProps {
  /** Estado de apertura (controlado). */
  open: boolean;
  /** Se llama cuando el dialogo se abre o se cierra. */
  onOpenChange: (open: boolean) => void;
  /** Titulo de la accion. */
  titulo: string;
  /** Explicacion de lo que va a pasar. */
  descripcion: string;
  /** Verbo explicito del boton de confirmacion. Nunca «Si» / «No». */
  textoConfirmar: string;
  /** `destructivo` pinta el boton de confirmacion como accion irreversible. */
  variante?: "normal" | "destructivo" | undefined;
  /** Motivo (opcional u obligatorio) para acciones criticas. */
  motivo?: MotivoDialogo | undefined;
  /** Ejecuta la accion. */
  onConfirm: () => void;
  /** La accion esta en curso: el boton muestra progreso y no se reenvia. */
  loading?: boolean | undefined;
  /** Texto del boton de cancelar. Por defecto «Cancelar». */
  textoCancelar?: string | undefined;
  className?: string | undefined;
}

/**
 * C-15 · Dialogo de confirmacion.
 *
 * - El boton de confirmacion usa un **verbo explicito**, nunca «Si/No» (UX-40).
 * - El boton destructivo **no** recibe el foco inicial: el foco va al titulo.
 * - Si el motivo es obligatorio, confirmar se bloquea hasta cumplir el minimo.
 * - El dialogo no se cierra al hacer clic fuera (AlertDialog), para no perder
 *   un motivo ya escrito (UX-38).
 */
export function DialogoConfirmacion({
  open,
  onOpenChange,
  titulo,
  descripcion,
  textoConfirmar,
  variante = "normal",
  motivo,
  onConfirm,
  loading = false,
  textoCancelar = "Cancelar",
  className,
}: DialogoConfirmacionProps) {
  const refTitulo = React.useRef<HTMLHeadingElement>(null);
  const refMotivo = React.useRef<HTMLTextAreaElement>(null);
  const idAyudaMotivo = React.useId();

  const minimo = motivo?.minimoCaracteres ?? 5;
  const longitud = (motivo?.valor ?? "").trim().length;
  const obligatorio = motivo?.obligatorio ?? false;
  const valorMotivo = motivo?.valor ?? "";
  const cambiarMotivo = motivo?.onChange;
  const motivoCompleto = !obligatorio || longitud >= minimo;
  const confirmarBloqueado = !motivoCompleto || loading;

  const manejarConfirmar = React.useCallback(
    (evento: React.MouseEvent<HTMLButtonElement>) => {
      // Evita el cierre automatico: el llamador decide cuando cerrar.
      evento.preventDefault();
      if (confirmarBloqueado) return;
      onConfirm();
    },
    [confirmarBloqueado, onConfirm],
  );

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn("max-w-md", className)}
        onOpenAutoFocus={(evento) => {
          // El boton destructivo nunca recibe el foco inicial (UX-40).
          evento.preventDefault();
          if (motivo) {
            refMotivo.current?.focus();
          } else {
            refTitulo.current?.focus();
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            ref={refTitulo}
            tabIndex={-1}
            className="text-base font-semibold text-foreground"
          >
            {titulo}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {descripcion}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {motivo ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="dialogo-confirmacion-motivo" className="text-sm font-medium">
              Motivo
              {obligatorio ? <span className="text-destructive"> *</span> : null}
            </Label>

            <Textarea
              id="dialogo-confirmacion-motivo"
              ref={refMotivo}
              value={valorMotivo}
              onChange={(evento) => cambiarMotivo?.(evento.target.value)}
              aria-invalid={obligatorio && !motivoCompleto}
              aria-describedby={idAyudaMotivo}
              placeholder="Describe el motivo"
              className="min-h-20"
            />

            <p
              id={idAyudaMotivo}
              className={cn(
                "flex items-center gap-1.5 text-xs",
                obligatorio && !motivoCompleto ? "text-red-700 dark:text-red-300" : "text-muted-foreground",
              )}
            >
              {obligatorio && !motivoCompleto ? (
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : null}
              <span>
                {obligatorio
                  ? `Escribe al menos ${minimo} caracteres (${longitud}/${minimo})`
                  : `Opcional · ${longitud} caracteres`}
              </span>
            </p>

            {motivo.plantillas && motivo.plantillas.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {motivo.plantillas.map((plantilla) => (
                  <Button
                    key={plantilla.etiqueta}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => cambiarMotivo?.(plantilla.texto)}
                    className="min-h-11"
                  >
                    {plantilla.etiqueta}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="min-h-11"
          >
            {textoCancelar}
          </Button>

          <Button
            type="button"
            variant={variante === "destructivo" ? "destructive" : "default"}
            onClick={manejarConfirmar}
            disabled={confirmarBloqueado}
            aria-busy={loading || undefined}
            className="min-h-11"
          >
            {loading ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden="true" />
                <span>Procesando…</span>
              </>
            ) : (
              <span>{textoConfirmar}</span>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
