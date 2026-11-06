import * as React from "react";
import { MessageCircleMore } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatUsd } from "@/lib/format";
import type { Pago, Reserva } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Diálogo de **solicitud de corrección** (Spec §9.7).
 *
 * Es un mensaje libre dirigido al cliente, con mínimo de 10 caracteres. El
 * pago queda en «corrección solicitada» y el titular puede corregirlo desde
 * su enlace sin que se pierda el resto del formulario.
 */

export interface DatosCorreccion {
  /** Texto que verá el cliente. */
  textoCliente: string;
}

export interface DialogoCorreccionPagoProps {
  /** Estado de apertura (controlado). */
  abierto: boolean;
  /** Se llama al abrir o cerrar. */
  onAbiertoChange: (abierto: boolean) => void;
  /** Pago que se corrige. */
  pago: Pago & { reserva: Reserva };
  /** La acción está en curso. */
  cargando: boolean;
  /** Confirma la solicitud. */
  onConfirmar: (datos: DatosCorreccion) => void;
}

export function DialogoCorreccionPago({
  abierto,
  onAbiertoChange,
  pago,
  cargando,
  onConfirmar,
}: DialogoCorreccionPagoProps) {
  const [texto, setTexto] = React.useState("");

  React.useEffect(() => {
    if (abierto) setTexto("");
  }, [abierto]);

  const longitud = texto.trim().length;
  const incompleto = longitud < 10;
  const listo = !incompleto && !cargando;

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="max-h-[92dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Solicitar corrección</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {`Pago ${pago.referencia} de ${pago.reserva.codigo} por ${formatUsd(pago.monto)}. Escribe qué debe corregir el titular; el pago vuelve a la cola.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="correccion-texto" className="text-sm font-semibold text-foreground">
            Mensaje para el cliente
          </Label>
          <Textarea
            id="correccion-texto"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            aria-invalid={incompleto || undefined}
            aria-describedby="correccion-texto-ayuda"
            placeholder="Por ejemplo: vuelve a subir la captura con la referencia visible."
            className="min-h-32"
          />
          <p
            id="correccion-texto-ayuda"
            className={cn(
              "text-xs",
              incompleto ? "text-red-700 dark:text-red-300" : "text-muted-foreground",
            )}
          >
            {incompleto
              ? `Escribe al menos 10 caracteres (${longitud}/10).`
              : "El titular recibe este mensaje y puede corregir su pago."}
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={cargando}
            onClick={() => onAbiertoChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={!listo}
            aria-busy={cargando || undefined}
            onClick={() => {
              if (!listo) return;
              onConfirmar({ textoCliente: texto.trim() });
            }}
          >
            <MessageCircleMore className="h-4 w-4" aria-hidden="true" />
            <span>{cargando ? "Enviando…" : "Solicitar corrección"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
