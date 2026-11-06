import * as React from "react";
import { RotateCcw } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ETIQUETA_METODO_PAGO, formatUsd } from "@/lib/format";
import type { MetodoPagoId, Pago } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Diálogo de **reembolso** (RF-7.9).
 *
 * Solo el superadministrador registra reembolsos. Pide monto, método y
 * motivo: el motivo queda en la auditoría y el estado de pago de la reserva
 * pasa a «reembolsado».
 */

export interface DatosReembolso {
  /** Monto devuelto. */
  monto: string;
  /** Método del reembolso. */
  metodo: string;
  /** Motivo obligatorio. */
  motivo: string;
}

const METODOS: MetodoPagoId[] = ["transferencia", "pago_movil", "zelle", "efectivo", "binance"];

export interface DialogoReembolsoProps {
  /** Estado de apertura (controlado). */
  abierto: boolean;
  /** Se llama al abrir o cerrar. */
  onAbiertoChange: (abierto: boolean) => void;
  /** Pago que se reembolsa. */
  pago: Pago | undefined;
  /** La acción está en curso. */
  cargando: boolean;
  /** Confirma el reembolso. */
  onConfirmar: (datos: DatosReembolso) => void;
}

export function DialogoReembolso({
  abierto,
  onAbiertoChange,
  pago,
  cargando,
  onConfirmar,
}: DialogoReembolsoProps) {
  const [monto, setMonto] = React.useState(pago?.monto ?? "");
  const [metodo, setMetodo] = React.useState<MetodoPagoId>("transferencia");
  const [motivo, setMotivo] = React.useState("");

  React.useEffect(() => {
    if (!abierto) return;
    setMonto(pago?.monto ?? "");
    setMetodo("transferencia");
    setMotivo("");
  }, [abierto, pago?.monto]);

  if (!pago) return null;

  const montoInvalido = !/^\d+([.,]\d{1,2})?$/.test(monto.trim()) || monto.trim() === "";
  const motivoIncompleto = motivo.trim().length < 5;
  const listo = !montoInvalido && !motivoIncompleto && !cargando;

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Reembolsar pago</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {`Pago ${pago.referencia} por ${formatUsd(pago.monto)}. La reserva queda cancelada y el saldo en cero.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reembolso-monto" className="text-sm font-semibold text-foreground">
              Monto a devolver
            </Label>
            <Input
              id="reembolso-monto"
              inputMode="decimal"
              value={monto}
              onChange={(evento) => setMonto(evento.target.value)}
              aria-invalid={montoInvalido || undefined}
              className="h-11"
            />
            {montoInvalido ? (
              <p className="text-xs text-red-700 dark:text-red-300">
                Escribe un monto válido, por ejemplo 55.00.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reembolso-metodo" className="text-sm font-semibold text-foreground">
              Método del reembolso
            </Label>
            <Select value={metodo} onValueChange={(valor: string) => setMetodo(valor as MetodoPagoId)}>
              <SelectTrigger id="reembolso-metodo" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METODOS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {ETIQUETA_METODO_PAGO[id] ?? id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reembolso-motivo" className="text-sm font-semibold text-foreground">
              Motivo
            </Label>
            <Textarea
              id="reembolso-motivo"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              aria-invalid={motivoIncompleto || undefined}
              aria-describedby="reembolso-motivo-ayuda"
              placeholder="Por ejemplo: el tour se canceló por clima."
              className="min-h-20"
            />
            <p
              id="reembolso-motivo-ayuda"
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
            variant="destructive"
            className="min-h-11"
            disabled={!listo}
            aria-busy={cargando || undefined}
            onClick={() => {
              if (!listo) return;
              onConfirmar({
                monto: monto.trim().replace(",", "."),
                metodo,
                motivo: motivo.trim(),
              });
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>{cargando ? "Reembolsando…" : "Reembolsar pago"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
