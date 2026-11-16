import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { NotebookPen } from "lucide-react";

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
import { api } from "@/lib/api";
import { formatUsd } from "@/lib/format";
import type { Reserva } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Diálogo para **anotar los datos de un pago desde la reserva**.
 *
 * El cliente no reporta nada por el formulario: el operador registra método,
 * monto, fecha y referencia, y el pago queda `reportado` en la cola «Pagos por
 * validar». La validación/aprobación sigue el flujo normal de la cola.
 */
export interface DatosPagoReserva {
  metodo_clave: string;
  monto: string;
  moneda: "USD" | "VES" | "USDT";
  fecha_pago: string;
  referencia: string;
  nota: string;
}

export interface DialogoRegistrarPagoProps {
  /** Estado de apertura (controlado). */
  abierto: boolean;
  /** Se llama al abrir o cerrar. */
  onAbiertoChange: (abierto: boolean) => void;
  /** Reserva que recibe el pago. */
  reserva: Reserva;
  /** La acción está en curso. */
  cargando: boolean;
  /** Confirma el registro. */
  onConfirmar: (datos: DatosPagoReserva) => void;
}

const HOY = () => new Date().toISOString().slice(0, 10);

export function DialogoRegistrarPago({
  abierto,
  onAbiertoChange,
  reserva,
  cargando,
  onConfirmar,
}: DialogoRegistrarPagoProps) {
  const [metodo, setMetodo] = React.useState("");
  const [monto, setMonto] = React.useState("");
  const [fecha, setFecha] = React.useState(HOY);
  const [referencia, setReferencia] = React.useState("");
  const [nota, setNota] = React.useState("");

  const consultaConfig = useQuery({
    queryKey: ["configuracion", "general"],
    queryFn: () => api.admin.configuracion(),
    enabled: abierto,
    staleTime: 60_000,
  });

  const metodos = React.useMemo(
    () => (consultaConfig.data?.metodos ?? []).filter((m) => m.activo && m.id !== "efectivo"),
    [consultaConfig.data],
  );
  const metodoActual = metodos.find((m) => m.id === metodo) ?? null;

  React.useEffect(() => {
    if (!abierto) return;
    const saldo =
      reserva.saldo_usd && Number.parseFloat(reserva.saldo_usd) > 0 ? reserva.saldo_usd : "";
    setMonto(saldo);
    setFecha(HOY());
    setReferencia("");
    setNota("");
    setMetodo("");
  }, [abierto, reserva.saldo_usd]);

  // Si sólo hay un método disponible, se preselecciona.
  React.useEffect(() => {
    if (!abierto || metodo || metodos.length === 0) return;
    setMetodo(metodos[0]?.id ?? "");
  }, [abierto, metodo, metodos]);

  const montoInvalido = !/^\d+([.,]\d{1,2})?$/.test(monto.trim());
  const fechaInvalida = !/^\d{4}-\d{2}-\d{2}$/.test(fecha);
  const listo =
    Boolean(metodo) && !montoInvalido && monto.trim() !== "" && !fechaInvalida && !cargando;

  const enBolivares = metodoActual?.moneda === "VES";

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Registrar datos de pago</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {`${reserva.codigo} · saldo pendiente ${formatUsd(reserva.saldo_usd)}. El pago entra a la cola «Pagos por validar».`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pago-metodo" className="text-sm font-semibold text-foreground">
              Método de pago
            </Label>
            <Select value={metodo} onValueChange={setMetodo} disabled={consultaConfig.isPending}>
              <SelectTrigger id="pago-metodo" className="min-h-11">
                <SelectValue
                  placeholder={
                    consultaConfig.isPending
                      ? "Cargando métodos…"
                      : metodos.length > 0
                        ? "Elige el método"
                        : "No hay métodos activos"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {metodos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {`${m.nombre} (${m.moneda})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pago-monto" className="text-sm font-semibold text-foreground">
                {enBolivares ? "Monto (Bs)" : "Monto (USD)"}
              </Label>
              <Input
                id="pago-monto"
                inputMode="decimal"
                value={monto}
                onChange={(evento) => setMonto(evento.target.value)}
                aria-invalid={montoInvalido || undefined}
                aria-describedby="pago-monto-ayuda"
                placeholder="0.00"
                className="h-11"
              />
              <p
                id="pago-monto-ayuda"
                className={cn(
                  "text-xs",
                  montoInvalido ? "text-red-700 dark:text-red-300" : "text-muted-foreground",
                )}
              >
                {montoInvalido
                  ? "Escribe un monto válido, por ejemplo 55.00."
                  : enBolivares
                    ? "En bolívares; el equivalente USD usa la tasa vigente."
                    : "En dólares."}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pago-fecha" className="text-sm font-semibold text-foreground">
                Fecha del pago
              </Label>
              <Input
                id="pago-fecha"
                type="date"
                value={fecha}
                onChange={(evento) => setFecha(evento.target.value)}
                aria-invalid={fechaInvalida || undefined}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">Día en que se realizó.</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pago-referencia" className="text-sm font-semibold text-foreground">
              Referencia (opcional)
            </Label>
            <Input
              id="pago-referencia"
              value={referencia}
              onChange={(evento) => setReferencia(evento.target.value)}
              placeholder="Número de operación o recibo"
              className="h-11"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pago-nota" className="text-sm font-semibold text-foreground">
              Nota interna (opcional)
            </Label>
            <Textarea
              id="pago-nota"
              value={nota}
              onChange={(evento) => setNota(evento.target.value)}
              placeholder="Con quién se coordinó, comprobante visto, etc."
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
              if (!listo || !metodoActual) return;
              onConfirmar({
                metodo_clave: metodoActual.id,
                monto: monto.trim().replace(",", "."),
                moneda: metodoActual.moneda,
                fecha_pago: fecha,
                referencia: referencia.trim(),
                nota: nota.trim(),
              });
            }}
          >
            <NotebookPen className="h-4 w-4" aria-hidden="true" />
            <span>{cargando ? "Registrando…" : "Registrar pago"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
