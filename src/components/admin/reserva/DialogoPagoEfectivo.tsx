import * as React from "react";
import { Banknote } from "lucide-react";

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
import { formatUsd } from "@/lib/format";
import type { Reserva } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Diálogo de **pago en efectivo** (RF-7.8).
 *
 * Lo registra el operador en el mostrador: monto, referencia del recibo
 * interno y una nota. El pago queda aprobado de inmediato.
 */

export interface DatosPagoEfectivo {
  /** Monto recibido. */
  monto: string;
  /** Referencia del recibo interno. */
  referencia: string;
  /** Nota interna. */
  nota: string;
}

export interface DialogoPagoEfectivoProps {
  /** Estado de apertura (controlado). */
  abierto: boolean;
  /** Se llama al abrir o cerrar. */
  onAbiertoChange: (abierto: boolean) => void;
  /** Reserva que recibe el pago. */
  reserva: Reserva;
  /** La acción está en curso. */
  cargando: boolean;
  /** Confirma el registro. */
  onConfirmar: (datos: DatosPagoEfectivo) => void;
}

export function DialogoPagoEfectivo({
  abierto,
  onAbiertoChange,
  reserva,
  cargando,
  onConfirmar,
}: DialogoPagoEfectivoProps) {
  const [monto, setMonto] = React.useState("");
  const [referencia, setReferencia] = React.useState("");
  const [nota, setNota] = React.useState("");

  React.useEffect(() => {
    if (!abierto) return;
    setMonto(
      reserva.saldo_usd && Number.parseFloat(reserva.saldo_usd) > 0 ? reserva.saldo_usd : "",
    );
    setReferencia("");
    setNota("");
  }, [abierto, reserva.saldo_usd]);

  const montoInvalido = !/^\d+([.,]\d{1,2})?$/.test(monto.trim()) || monto.trim() === "";
  const listo = !montoInvalido && !cargando;

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Registrar pago en efectivo</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {`${reserva.codigo} · saldo pendiente ${formatUsd(reserva.saldo_usd)}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="efectivo-monto" className="text-sm font-semibold text-foreground">
              Monto recibido
            </Label>
            <Input
              id="efectivo-monto"
              inputMode="decimal"
              value={monto}
              onChange={(evento) => setMonto(evento.target.value)}
              aria-invalid={montoInvalido || undefined}
              aria-describedby="efectivo-monto-ayuda"
              placeholder="0.00"
              className="h-11"
            />
            <p
              id="efectivo-monto-ayuda"
              className={cn(
                "text-xs",
                montoInvalido ? "text-red-700 dark:text-red-300" : "text-muted-foreground",
              )}
            >
              {montoInvalido ? "Escribe un monto válido, por ejemplo 55.00." : "En dólares."}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="efectivo-referencia" className="text-sm font-semibold text-foreground">
              Referencia del recibo (opcional)
            </Label>
            <Input
              id="efectivo-referencia"
              value={referencia}
              onChange={(evento) => setReferencia(evento.target.value)}
              placeholder="EFE-000231"
              className="h-11"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="efectivo-nota" className="text-sm font-semibold text-foreground">
              Nota interna (opcional)
            </Label>
            <Textarea
              id="efectivo-nota"
              value={nota}
              onChange={(evento) => setNota(evento.target.value)}
              placeholder="Dónde, cuándo y quién recibió el dinero."
              className="min-h-20"
            />
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
              onConfirmar({
                monto: monto.trim().replace(",", "."),
                referencia: referencia.trim(),
                nota: nota.trim(),
              });
            }}
          >
            <Banknote className="h-4 w-4" aria-hidden="true" />
            <span>{cargando ? "Registrando…" : "Registrar pago"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
