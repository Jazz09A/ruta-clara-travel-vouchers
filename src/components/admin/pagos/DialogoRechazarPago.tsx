import * as React from "react";
import { CircleX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatUsd } from "@/lib/format";
import type { Pago, Reserva } from "@/lib/domain/types";
import { CatalogoMotivos, VistaPreviaMensaje, mensajeParaCliente } from "./CatalogoMotivos";

/**
 * Diálogo de **rechazo** de un pago (Spec §9.7).
 *
 * Motivo del catálogo + texto libre obligatorio cuando el motivo es «otro», y
 * vista previa del mensaje que verá el cliente antes de confirmar.
 */

export interface DatosRechazo {
  /** Código del motivo del catálogo. */
  motivoCatalogo: string;
  /** Mensaje que verá el cliente. */
  textoCliente: string;
}

export interface DialogoRechazarPagoProps {
  /** Estado de apertura (controlado). */
  abierto: boolean;
  /** Se llama al abrir o cerrar. */
  onAbiertoChange: (abierto: boolean) => void;
  /** Pago que se va a rechazar. */
  pago: Pago & { reserva: Reserva };
  /** La acción está en curso. */
  cargando: boolean;
  /** Confirma el rechazo. */
  onConfirmar: (datos: DatosRechazo) => void;
}

export function DialogoRechazarPago({
  abierto,
  onAbiertoChange,
  pago,
  cargando,
  onConfirmar,
}: DialogoRechazarPagoProps) {
  const [codigo, setCodigo] = React.useState("comprobante_ilegible");
  const [textoLibre, setTextoLibre] = React.useState("");
  const [nota, setNota] = React.useState("");

  React.useEffect(() => {
    if (abierto) {
      setCodigo("comprobante_ilegible");
      setTextoLibre("");
      setNota("");
    }
  }, [abierto]);

  const esOtro = codigo === "otro";
  const textoIncompleto = esOtro && textoLibre.trim().length < 10;
  const listo = !textoIncompleto && !cargando;

  const confirmar = () => {
    if (!listo) return;
    const textoCliente = mensajeParaCliente(codigo, textoLibre, nota);
    onConfirmar({ motivoCatalogo: codigo, textoCliente });
  };

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Rechazar pago</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {`Pago ${pago.referencia} de ${pago.reserva.codigo} por ${formatUsd(pago.monto)}. El titular podrá reportar el pago de nuevo desde su enlace.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <CatalogoMotivos
            valor={codigo}
            onChange={setCodigo}
            textoLibre={textoLibre}
            onTextoLibreChange={setTextoLibre}
            nota={nota}
            onNotaChange={setNota}
            disabled={cargando}
          />

          <VistaPreviaMensaje codigo={codigo} textoLibre={textoLibre} nota={nota} />
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
            variant="destructive"
            className="min-h-11"
            disabled={!listo}
            aria-busy={cargando || undefined}
            onClick={confirmar}
          >
            <CircleX className="h-4 w-4" aria-hidden="true" />
            <span>{cargando ? "Rechazando…" : "Rechazar pago"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
