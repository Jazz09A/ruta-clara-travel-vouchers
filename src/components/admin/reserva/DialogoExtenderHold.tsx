import * as React from "react";
import { TimerReset } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Diálogo de **extensión del hold** (A-07).
 *
 * El tiempo extra se pide en horas, con un máximo de 72, y exige un motivo:
 * ampliar la reserva sin control es una de las formas de perder un cupo.
 */

/** Máximo de horas que se pueden añadir (Spec §9.6). */
export const MAX_HORAS_HOLD = 72;

export interface DatosExtenderHold {
  /** Horas adicionales. */
  horas: number;
  /** Motivo obligatorio. */
  motivo: string;
}

export interface DialogoExtenderHoldProps {
  /** Estado de apertura (controlado). */
  abierto: boolean;
  /** Se llama al abrir o cerrar. */
  onAbiertoChange: (abierto: boolean) => void;
  /** Vencimiento actual del cupo. */
  expiraEn: string | null;
  /** La acción está en curso. */
  cargando: boolean;
  /** Confirma la extensión. */
  onConfirmar: (datos: DatosExtenderHold) => void;
}

export function DialogoExtenderHold({
  abierto,
  onAbiertoChange,
  expiraEn,
  cargando,
  onConfirmar,
}: DialogoExtenderHoldProps) {
  const [horas, setHoras] = React.useState("24");
  const [motivo, setMotivo] = React.useState("");

  React.useEffect(() => {
    if (!abierto) return;
    setHoras("24");
    setMotivo("");
  }, [abierto]);

  const horasNumero = Number.parseInt(horas, 10);
  const horasInvalidas =
    !Number.isFinite(horasNumero) || horasNumero < 1 || horasNumero > MAX_HORAS_HOLD;
  const motivoIncompleto = motivo.trim().length < 5;
  const listo = !horasInvalidas && !motivoIncompleto && !cargando;

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Extender el cupo reservado</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {expiraEn
              ? `El cupo vence el ${expiraEn.slice(0, 10)}. Puedes añadir hasta ${MAX_HORAS_HOLD} horas.`
              : `Esta reserva no tiene vencimiento activo. Puedes añadir hasta ${MAX_HORAS_HOLD} horas.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="extender-horas" className="text-sm font-semibold text-foreground">
              Horas adicionales
            </Label>
            <Input
              id="extender-horas"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_HORAS_HOLD}
              value={horas}
              onChange={(evento) => setHoras(evento.target.value)}
              aria-invalid={horasInvalidas || undefined}
              aria-describedby="extender-horas-ayuda"
              className="h-11"
            />
            <p
              id="extender-horas-ayuda"
              className={cn(
                "text-xs",
                horasInvalidas ? "text-red-700 dark:text-red-300" : "text-muted-foreground",
              )}
            >
              {horasInvalidas
                ? `Escribe un número entre 1 y ${MAX_HORAS_HOLD}.`
                : `El nuevo vencimiento se calcula desde ahora.`}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="extender-motivo" className="text-sm font-semibold text-foreground">
              Motivo
            </Label>
            <Textarea
              id="extender-motivo"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              aria-invalid={motivoIncompleto || undefined}
              aria-describedby="extender-motivo-ayuda"
              placeholder="Por ejemplo: el titular dijo que transfiere mañana."
              className="min-h-20"
            />
            <p
              id="extender-motivo-ayuda"
              className={cn(
                "text-xs",
                motivoIncompleto ? "text-red-700 dark:text-red-300" : "text-muted-foreground",
              )}
            >
              {motivoIncompleto
                ? "Escribe al menos 5 caracteres."
                : "El motivo queda registrado en la auditoría."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={cargando}
            onClick={() => onAbiertoChange(false)}
          >
            Volver
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={!listo}
            aria-busy={cargando || undefined}
            onClick={() => {
              if (!listo) return;
              onConfirmar({ horas: horasNumero, motivo: motivo.trim() });
            }}
          >
            <TimerReset className="h-4 w-4" aria-hidden="true" />
            <span>{cargando ? "Extendiendo…" : "Extender cupo"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
