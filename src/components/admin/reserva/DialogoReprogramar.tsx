import * as React from "react";
import { CalendarClock, TriangleAlert } from "lucide-react";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatTime } from "@/lib/format";
import type { FechaTour } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Diálogo de **reprogramación** (A-07 · RF-9.5).
 *
 * Solo ofrece fechas del mismo tour. Cada opción muestra la disponibilidad y
 * queda deshabilitada cuando no hay cupo para todo el grupo, con el motivo a
 * la vista.
 */

export interface DatosReprogramar {
  /** Id de la fecha de salida destino. */
  fecha_tour_id: string;
  /** Motivo obligatorio. */
  motivo: string;
}

export interface DialogoReprogramarProps {
  /** Estado de apertura (controlado). */
  abierto: boolean;
  /** Se llama al abrir o cerrar. */
  onAbiertoChange: (abierto: boolean) => void;
  /** Fechas del mismo tour. */
  fechas: FechaTour[];
  /** Fecha actual de la reserva. */
  fechaActualId: string;
  /** Pasajeros que hay que acomodar. */
  numeroPasajeros: number;
  /** La acción está en curso. */
  cargando: boolean;
  /** Conflicto devuelto por el servidor (por ejemplo, cupo insuficiente). */
  conflicto: string | undefined;
  /** Confirma la reprogramación. */
  onConfirmar: (datos: DatosReprogramar) => void;
}

export function DialogoReprogramar({
  abierto,
  onAbiertoChange,
  fechas,
  fechaActualId,
  numeroPasajeros,
  cargando,
  conflicto,
  onConfirmar,
}: DialogoReprogramarProps) {
  const [destino, setDestino] = React.useState("");
  const [motivo, setMotivo] = React.useState("");

  React.useEffect(() => {
    if (!abierto) return;
    setDestino("");
    setMotivo("");
  }, [abierto]);

  const motivoIncompleto = motivo.trim().length < 5;
  const listo = destino !== "" && !motivoIncompleto && !cargando;

  const candidatas = fechas.filter((fecha) => fecha.id !== fechaActualId);

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Reprogramar reserva</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {`Elige otra salida del mismo tour para ${numeroPasajeros} ${
              numeroPasajeros === 1 ? "pasajero" : "pasajeros"
            }. El voucher se regenera y el saldo se mantiene.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {candidatas.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              Este tour no tiene otras fechas disponibles para reprogramar.
            </p>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-semibold text-foreground">Fechas disponibles</legend>
              <RadioGroup value={destino} onValueChange={(valor: string) => setDestino(valor)}>
                {candidatas.map((fecha) => {
                  const libres = fecha.cupos_total - fecha.cupos_vendidos - fecha.cupos_retenidos;
                  const suficiente = libres >= numeroPasajeros && fecha.estado === "publicada";
                  const id = `fecha-destino-${fecha.id}`;
                  return (
                    <div key={fecha.id} className="flex items-start gap-3">
                      <RadioGroupItem
                        value={fecha.id}
                        id={id}
                        disabled={!suficiente}
                        className="mt-1"
                      />
                      <Label
                        htmlFor={id}
                        className={cn(
                          "flex flex-1 cursor-pointer flex-col gap-0.5 py-1",
                          !suficiente && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          <CalendarClock
                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span>{`${formatDate(fecha.fecha_salida)} · ${formatTime(fecha.hora_salida)}`}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {suficiente
                            ? `Quedan ${libres} lugares de ${fecha.cupos_total}.`
                            : `Sin cupo suficiente: quedan ${libres} de ${fecha.cupos_total}.`}
                        </span>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </fieldset>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reprogramar-motivo" className="text-sm font-semibold text-foreground">
              Motivo
            </Label>
            <Textarea
              id="reprogramar-motivo"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              aria-invalid={motivoIncompleto || undefined}
              aria-describedby="reprogramar-motivo-ayuda"
              placeholder="Por ejemplo: el titular no puede viajar el día original."
              className="min-h-20"
            />
            <p
              id="reprogramar-motivo-ayuda"
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

          {conflicto ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{conflicto}</span>
            </p>
          ) : null}
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
              onConfirmar({ fecha_tour_id: destino, motivo: motivo.trim() });
            }}
          >
            <span>{cargando ? "Reprogramando…" : "Reprogramar reserva"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
