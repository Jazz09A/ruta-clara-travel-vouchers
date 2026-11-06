import * as React from "react";

import { Campo } from "@/components/admin/ui/campo";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EstadoFecha, FechaTour } from "@/lib/domain/types";

export interface DialogoFechaProps {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  /** Fecha a editar (`null` = crear una nueva). */
  fecha: FechaTour | null;
  onGuardar: (datos: {
    id?: string;
    fecha_salida: string;
    hora_salida: string;
    cupos_total: number;
    corte_venta_horas: number;
    estado: EstadoFecha;
  }) => void;
  guardando: boolean;
  /** Error devuelto por el servidor (se muestra junto al campo). */
  error?: string | undefined;
}

const ETIQUETA_ESTADO: Record<EstadoFecha, string> = {
  borrador: "Borrador (no visible para el cliente)",
  publicada: "Publicada (los clientes pueden reservar)",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
};

/**
 * Diálogo de creación y edición de una **fecha de salida**.
 *
 * Incluye los datos del RF-1.1: fecha, hora, cupos totales y corte de venta.
 */
export function DialogoFecha({
  abierto,
  onAbiertoChange,
  fecha,
  onGuardar,
  guardando,
  error,
}: DialogoFechaProps) {
  const [fechaSalida, setFechaSalida] = React.useState("");
  const [hora, setHora] = React.useState("05:30");
  const [cupos, setCupos] = React.useState("40");
  const [corte, setCorte] = React.useState("12");
  const [estado, setEstado] = React.useState<EstadoFecha>("borrador");

  React.useEffect(() => {
    if (!abierto) return;
    setFechaSalida(fecha?.fecha_salida ?? new Date().toISOString().slice(0, 10));
    setHora(fecha?.hora_salida ?? "05:30");
    setCupos(String(fecha?.cupos_total ?? 40));
    setCorte(String(fecha?.corte_venta_horas ?? 12));
    setEstado(fecha?.estado ?? "borrador");
  }, [abierto, fecha]);

  const cuposNumero = Number.parseInt(cupos, 10);
  const cuposValidos = Number.isFinite(cuposNumero) && cuposNumero > 0;

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            {fecha ? "Editar salida" : "Nueva salida"}
          </DialogTitle>
          <DialogDescription>
            La salida define el día, la hora de salida y cuántos cupos se ofrecen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="fecha-salida" etiqueta="Fecha de salida" requerido>
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={fechaSalida}
                  onChange={(evento) => setFechaSalida(evento.target.value)}
                />
              )}
            </Campo>

            <Campo id="hora-salida" etiqueta="Hora de salida" requerido>
              {(props) => (
                <Input
                  {...props}
                  type="time"
                  value={hora}
                  onChange={(evento) => setHora(evento.target.value)}
                />
              )}
            </Campo>

            <Campo
              id="cupos-total"
              etiqueta="Cupos totales"
              ayuda="Número de personas que se pueden subir a esta salida."
              error={error}
              requerido
            >
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={cupos}
                  onChange={(evento) => setCupos(evento.target.value)}
                />
              )}
            </Campo>

            <Campo
              id="corte-venta"
              etiqueta="Corte de venta (horas)"
              ayuda="Horas antes de la salida en que se cierra la venta."
              requerido
            >
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={corte}
                  onChange={(evento) => setCorte(evento.target.value)}
                />
              )}
            </Campo>
          </div>

          <Campo id="estado-salida" etiqueta="Estado de la salida" ayuda={ETIQUETA_ESTADO[estado]}>
            {(props) => (
              <Select value={estado} onValueChange={(valor) => setEstado(valor as EstadoFecha)}>
                <SelectTrigger {...props} className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="borrador">{ETIQUETA_ESTADO.borrador}</SelectItem>
                  <SelectItem value="publicada">{ETIQUETA_ESTADO.publicada}</SelectItem>
                  <SelectItem value="cerrada">{ETIQUETA_ESTADO.cerrada}</SelectItem>
                  <SelectItem value="cancelada">{ETIQUETA_ESTADO.cancelada}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </Campo>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onAbiertoChange(false)}
            disabled={guardando}
            className="min-h-11"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() =>
              onGuardar({
                ...(fecha ? { id: fecha.id } : {}),
                fecha_salida: fechaSalida,
                hora_salida: hora,
                cupos_total: cuposNumero,
                corte_venta_horas: Number.parseInt(corte, 10) || 0,
                estado,
              })
            }
            disabled={guardando || !cuposValidos || fechaSalida === ""}
            aria-busy={guardando || undefined}
            className="min-h-11"
          >
            {guardando ? "Guardando…" : fecha ? "Guardar cambios" : "Crear salida"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
