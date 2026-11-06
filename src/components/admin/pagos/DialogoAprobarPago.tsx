import * as React from "react";
import { CopyCheck, TriangleAlert } from "lucide-react";

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
import { ETIQUETA_METODO_PAGO, ETIQUETA_ESTADO_PAGO, formatUsd } from "@/lib/format";
import type { Pago, Reserva } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { DiferenciaMonto, type ResultadoDiferencia } from "./DiferenciaMonto";

/**
 * Diálogo de **aprobación** de un pago (Spec §9.7).
 *
 * Exige un ajuste justificado cuando el monto difiere del esperado y una
 * confirmación explícita cuando la referencia ya se usó en otro pago. Nunca
 * aprueba «a ciegas»: el validador ve exactamente qué está confirmando.
 */

export interface DatosAprobacion {
  /** Monto que se aprueba (si el validador lo ajusta). */
  montoValidado: string | undefined;
  /** Motivo del ajuste (obligatorio si hay diferencia). */
  ajusteMotivo: string;
  /** Confirmación de que el pago no es un duplicado. */
  confirmarDuplicado: boolean;
}

export interface PagoDuplicado {
  /** Id del pago anterior. */
  id: string;
  /** Código de la reserva del pago anterior. */
  codigoReserva: string;
  /** Estado del pago anterior. */
  estado: string;
  /** Monto del pago anterior. */
  monto: string;
  /** Fecha del pago anterior. */
  fecha: string;
}

export interface DialogoAprobarPagoProps {
  /** Estado de apertura (controlado). */
  abierto: boolean;
  /** Se llama al abrir o cerrar. */
  onAbiertoChange: (abierto: boolean) => void;
  /** Pago que se va a aprobar. */
  pago: Pago & { reserva: Reserva };
  /** Resultado del contraste entre monto esperado y reportado. */
  diferencia: ResultadoDiferencia;
  /** Pago anterior, si la referencia ya se usó. */
  pagoDuplicado: PagoDuplicado | undefined;
  /** La acción está en curso. */
  cargando: boolean;
  /** Confirma la aprobación. */
  onConfirmar: (datos: DatosAprobacion) => void;
}

export function DialogoAprobarPago({
  abierto,
  onAbiertoChange,
  pago,
  diferencia,
  pagoDuplicado,
  cargando,
  onConfirmar,
}: DialogoAprobarPagoProps) {
  const [montoValidado, setMontoValidado] = React.useState(pago.monto);
  const [ajusteMotivo, setAjusteMotivo] = React.useState("");
  const [confirmarDuplicado, setConfirmarDuplicado] = React.useState(false);

  React.useEffect(() => {
    if (abierto) {
      setMontoValidado(pago.monto);
      setAjusteMotivo("");
      setConfirmarDuplicado(false);
    }
  }, [abierto, pago.monto]);

  const requiereAjuste = diferencia.esSignificativa;
  const ajusteIncompleto = requiereAjuste && ajusteMotivo.trim().length < 5;
  const requiereDuplicado = Boolean(pagoDuplicado);
  const faltaDuplicado = requiereDuplicado && !confirmarDuplicado;

  const montoVacio = montoValidado.trim().length === 0;

  const listo = !ajusteIncompleto && !faltaDuplicado && !montoVacio && !cargando;

  const confirmar = () => {
    if (!listo) return;
    onConfirmar({
      montoValidado: montoValidado.trim(),
      ajusteMotivo: ajusteMotivo.trim(),
      confirmarDuplicado: confirmarDuplicado,
    });
  };

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Aprobar pago</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {`Pago ${pago.referencia} de ${pago.reserva.codigo} por ${formatUsd(pago.monto)} (${ETIQUETA_METODO_PAGO[pago.metodo] ?? pago.metodo}). Al confirmar, la reserva avanza según el saldo.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <DiferenciaMonto
            esperadoUsd={pago.reserva.saldo_usd}
            reportado={pago.monto}
            moneda={pago.moneda}
            tasa={pago.tasa}
          />

          {requiereAjuste ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10">
              <p className="flex items-start gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  El monto reportado no coincide con el esperado. Ajusta el monto que se aprueba y
                  explica el motivo.
                </span>
              </p>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="aprobar-monto" className="text-sm font-medium text-foreground">
                  Monto a validar
                </Label>
                <Input
                  id="aprobar-monto"
                  inputMode="decimal"
                  value={montoValidado}
                  onChange={(evento) => setMontoValidado(evento.target.value)}
                  aria-invalid={montoVacio || undefined}
                  aria-describedby="aprobar-monto-ayuda"
                  className="h-11"
                />
                <p id="aprobar-monto-ayuda" className="text-xs text-muted-foreground">
                  Escribe el monto real recibido. La diferencia queda registrada en la auditoría.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="aprobar-ajuste" className="text-sm font-medium text-foreground">
                  Motivo del ajuste
                </Label>
                <Textarea
                  id="aprobar-ajuste"
                  value={ajusteMotivo}
                  onChange={(evento) => setAjusteMotivo(evento.target.value)}
                  aria-invalid={ajusteIncompleto || undefined}
                  aria-describedby="aprobar-ajuste-ayuda"
                  placeholder="Por ejemplo: el cliente envió $10 menos por el cargo del banco."
                  className="min-h-20"
                />
                <p
                  id="aprobar-ajuste-ayuda"
                  className={cn(
                    "text-xs",
                    ajusteIncompleto ? "text-red-700 dark:text-red-300" : "text-muted-foreground",
                  )}
                >
                  {ajusteIncompleto
                    ? "Escribe al menos 5 caracteres para justificar el ajuste."
                    : "Queda registrado en la auditoría."}
                </p>
              </div>
            </div>
          ) : null}

          {requiereDuplicado && pagoDuplicado ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-500/10">
              <p className="flex items-start gap-2 text-sm font-semibold text-red-900 dark:text-red-100">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Esta referencia ya se usó en otro pago.</span>
              </p>

              <div className="rounded-xl border border-border bg-card p-3 text-sm">
                <p className="font-semibold text-foreground">
                  {`Pago anterior ${pagoDuplicado.id}`}
                </p>
                <p className="text-muted-foreground">
                  {`Reserva ${pagoDuplicado.codigoReserva} · ${formatUsd(pagoDuplicado.monto)} · ${pagoDuplicado.fecha}`}
                </p>
                <p className="text-muted-foreground">
                  {`Estado: ${ETIQUETA_ESTADO_PAGO[pagoDuplicado.estado] ?? pagoDuplicado.estado}`}
                </p>
              </div>

              <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={confirmarDuplicado}
                  onChange={(evento) => setConfirmarDuplicado(evento.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-input accent-primary"
                />
                <span>Confirmo que no es un duplicado.</span>
              </label>

              {faltaDuplicado ? (
                <p className="text-xs font-medium text-red-700 dark:text-red-300">
                  Marca la confirmación para poder aprobar.
                </p>
              ) : null}
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
            Cancelar
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={!listo}
            aria-busy={cargando || undefined}
            onClick={confirmar}
          >
            <CopyCheck className="h-4 w-4" aria-hidden="true" />
            <span>{cargando ? "Aprobando…" : "Aprobar pago"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
