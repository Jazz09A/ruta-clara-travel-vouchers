import * as React from "react";
import { Calculator, TriangleAlert } from "lucide-react";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { formatUsd } from "@/lib/format";
import type { Pago, Reserva } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Diálogo de **cancelación** de reserva (A-07 · T9).
 *
 * Reúne lo que el operador necesita antes de confirmar: quién origina la
 * cancelación, la simulación del reembolso (tramo, porcentaje y monto
 * sugerido) y el motivo obligatorio. Si hay un pago sin validar, la
 * cancelación se bloquea salvo que un superadministrador la fuerce.
 */

export type OrigenCancelacion = "cliente" | "agencia" | "fuerza_mayor";

export interface DatosCancelacion {
  /** Quién origina la cancelación. */
  origen: OrigenCancelacion;
  /** Motivo obligatorio. */
  motivo: string;
  /** Monto a reembolsar, si aplica. */
  monto_reembolso: string | undefined;
  /** Forzar la cancelación con un pago sin validar. */
  forzar: boolean;
}

export interface SimulacionCancelacion {
  /** Días que faltan para la salida. */
  dias_para_salida: number;
  /** Tramo de la política aplicada. */
  tramo: { porcentaje: number; descripcion: string };
  /** Monto sugerido de reembolso. */
  monto_sugerido: string;
}

const ORÍGENES: { valor: OrigenCancelacion; etiqueta: string; ayuda: string }[] = [
  {
    valor: "cliente",
    etiqueta: "El cliente",
    ayuda: "El titular pidió cancelar.",
  },
  {
    valor: "agencia",
    etiqueta: "La agencia",
    ayuda: "La agencia decide cancelar por su cuenta.",
  },
  {
    valor: "fuerza_mayor",
    etiqueta: "Fuerza mayor",
    ayuda: "Clima, falta de quórum u otra causa externa.",
  },
];

export interface DialogoCancelarReservaProps {
  /** Estado de apertura (controlado). */
  abierto: boolean;
  /** Se llama al abrir o cerrar. */
  onAbiertoChange: (abierto: boolean) => void;
  /** Reserva que se cancela. */
  reserva: Reserva;
  /** Pagos de la reserva. */
  pagos: Pago[];
  /** El rol puede forzar la cancelación con un pago sin validar. */
  puedeForzar: boolean;
  /** Simulación del reembolso devuelta por el servidor. */
  simulacion: SimulacionCancelacion | null;
  /** La simulación se está calculando. */
  simulacionCargando: boolean;
  /** La acción está en curso. */
  cargando: boolean;
  /** Confirma la cancelación. */
  onConfirmar: (datos: DatosCancelacion) => void;
}

export function DialogoCancelarReserva({
  abierto,
  onAbiertoChange,
  reserva,
  pagos,
  puedeForzar,
  simulacion,
  simulacionCargando,
  cargando,
  onConfirmar,
}: DialogoCancelarReservaProps) {
  const [origen, setOrigen] = React.useState<OrigenCancelacion>("cliente");
  const [motivo, setMotivo] = React.useState("");
  const [monto, setMonto] = React.useState("");
  const [forzar, setForzar] = React.useState(false);

  React.useEffect(() => {
    if (!abierto) return;
    setOrigen("cliente");
    setMotivo("");
    setForzar(false);
    setMonto(simulacion?.monto_sugerido ?? "");
  }, [abierto, simulacion]);

  const hayPagosReportados = pagos.some((pago) => pago.estado === "reportado");
  const hayDineroAprobado = pagos.some((pago) => pago.estado === "aprobado");

  const motivoIncompleto = motivo.trim().length < 5;
  const montoInvalido = monto.trim() !== "" && !/^\d+([.,]\d{1,2})?$/.test(monto.trim());
  const bloqueadoPorPago = hayPagosReportados && !forzar;
  const listo =
    !motivoIncompleto && !montoInvalido && !bloqueadoPorPago && !cargando;

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Cancelar reserva</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {`${reserva.codigo} · ${reserva.ref_corta}. Al cancelar se libera el cupo y el titular recibe la notificación.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-semibold text-foreground">¿Quién origina la cancelación?</legend>
            <RadioGroup
              value={origen}
              onValueChange={(valor: string) => setOrigen(valor as OrigenCancelacion)}
              className="gap-2"
            >
              {ORÍGENES.map((opcion) => {
                const id = `origen-cancelacion-${opcion.valor}`;
                return (
                  <div key={opcion.valor} className="flex items-start gap-3">
                    <RadioGroupItem value={opcion.valor} id={id} className="mt-1" />
                    <Label htmlFor={id} className="flex cursor-pointer flex-col gap-0.5 py-1">
                      <span className="text-sm font-medium text-foreground">{opcion.etiqueta}</span>
                      <span className="text-xs text-muted-foreground">{opcion.ayuda}</span>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </fieldset>

          <div className="rounded-2xl border border-border bg-muted/50 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
              Simulación del reembolso
            </p>
            {simulacionCargando ? (
              <p className="mt-2 text-sm text-muted-foreground">Calculando…</p>
            ) : simulacion ? (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Días para la salida</p>
                  <p className="text-sm font-bold text-foreground">
                    {String(simulacion.dias_para_salida)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tramo aplicado</p>
                  <p className="text-sm font-bold text-foreground">
                    {`${simulacion.tramo.porcentaje}%`}
                  </p>
                  <p className="text-xs text-muted-foreground">{simulacion.tramo.descripcion}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monto sugerido</p>
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {formatUsd(simulacion.monto_sugerido)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No pudimos calcular la simulación. Puedes seguir y ajustar el monto a mano.
              </p>
            )}
          </div>

          {hayDineroAprobado || simulacion ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cancelar-monto" className="text-sm font-semibold text-foreground">
                Monto a reembolsar
              </Label>
              <Input
                id="cancelar-monto"
                inputMode="decimal"
                value={monto}
                onChange={(evento) => setMonto(evento.target.value)}
                aria-invalid={montoInvalido || undefined}
                aria-describedby="cancelar-monto-ayuda"
                placeholder="0.00"
                className="h-11"
              />
              <p
                id="cancelar-monto-ayuda"
                className={cn(
                  "text-xs",
                  montoInvalido ? "text-red-700 dark:text-red-300" : "text-muted-foreground",
                )}
              >
                {montoInvalido
                  ? "Escribe un monto válido, por ejemplo 55.00."
                  : "Déjalo vacío si no hay nada que devolver. El reembolso queda pendiente y lo registra el superadministrador."}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cancelar-motivo" className="text-sm font-semibold text-foreground">
              Motivo
            </Label>
            <Textarea
              id="cancelar-motivo"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              aria-invalid={motivoIncompleto || undefined}
              aria-describedby="cancelar-motivo-ayuda"
              placeholder="Explica por qué se cancela la reserva."
              className="min-h-20"
            />
            <p
              id="cancelar-motivo-ayuda"
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

          {hayPagosReportados ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10">
              <p className="flex items-start gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Hay un pago sin validar en esta reserva.</span>
              </p>
              <p className="text-sm text-amber-900 dark:text-amber-100">
                Si cancelas ahora, ese pago queda sin resolver y el titular debe pagar de nuevo.
              </p>
              {puedeForzar ? (
                <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm font-medium text-amber-900 dark:text-amber-100">
                  <input
                    type="checkbox"
                    checked={forzar}
                    onChange={(evento) => setForzar(evento.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0 rounded border-input accent-primary"
                  />
                  <span>Forzar la cancelación aunque haya un pago sin validar.</span>
                </label>
              ) : (
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Solo el superadministrador puede forzar la cancelación. Valida o rechaza el pago
                  primero.
                </p>
              )}
            </div>
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
            variant="destructive"
            className="min-h-11"
            disabled={!listo}
            aria-busy={cargando || undefined}
            onClick={() => {
              if (!listo) return;
              onConfirmar({
                origen,
                motivo: motivo.trim(),
                monto_reembolso: monto.trim() === "" ? undefined : monto.trim(),
                forzar,
              });
            }}
          >
            <span>{cargando ? "Cancelando…" : "Cancelar reserva"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
