import * as React from "react";
import { Save } from "lucide-react";

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
import type { Pasajero, Respuesta } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Diálogo de **edición de datos** de la reserva (A-07).
 *
 * Permite corregir el nombre de cada pasajero y sus selecciones (las del
 * formulario del tour), además de las respuestas globales. Toda edición
 * exige un motivo y queda registrada en la auditoría (RF-9.6).
 */

/** Campo del formulario que el panel puede editar. */
export interface CampoEditable {
  /** Identificador del campo. */
  id: string;
  /** Etiqueta visible. */
  label: string;
  /** Tipo de control. */
  tipo: "select" | "text" | "textarea";
  /** Opciones (solo para `select`). */
  opciones: { valor: string; label: string }[];
  /** Alcance del campo en el formulario. */
  alcance: "por_pasajero" | "por_reserva";
}

export interface DatosEdicion {
  /** Pasajeros con los datos corregidos. */
  pasajeros: Pasajero[];
  /** Respuestas globales corregidas. */
  respuestas_globales: Record<string, Respuesta>;
  /** Motivo obligatorio de la edición. */
  motivo: string;
}

const VALOR_VACIO = "__sin_valor__";

export interface DialogoEditarDatosProps {
  /** Estado de apertura (controlado). */
  abierto: boolean;
  /** Se llama al abrir o cerrar. */
  onAbiertoChange: (abierto: boolean) => void;
  /** Pasajeros actuales. */
  pasajeros: Pasajero[];
  /** Respuestas globales actuales. */
  respuestasGlobales: Record<string, Respuesta>;
  /** Campos del formulario que se pueden editar. */
  campos: CampoEditable[];
  /** La acción está en curso. */
  cargando: boolean;
  /** Confirma la edición. */
  onConfirmar: (datos: DatosEdicion) => void;
}

export function DialogoEditarDatos({
  abierto,
  onAbiertoChange,
  pasajeros,
  respuestasGlobales,
  campos,
  cargando,
  onConfirmar,
}: DialogoEditarDatosProps) {
  const [nombres, setNombres] = React.useState<Record<string, string>>({});
  const [selecciones, setSelecciones] = React.useState<Record<string, Record<string, Respuesta>>>({});
  const [globales, setGlobales] = React.useState<Record<string, Respuesta>>({});
  const [motivo, setMotivo] = React.useState("");

  React.useEffect(() => {
    if (!abierto) return;
    setNombres(Object.fromEntries(pasajeros.map((p) => [p.ref_cliente, p.nombre])));
    setSelecciones({});
    setGlobales({ ...respuestasGlobales });
    setMotivo("");
  }, [abierto, pasajeros, respuestasGlobales]);

  const camposPorPasajero = campos.filter((campo) => campo.alcance === "por_pasajero");
  const camposGlobales = campos.filter((campo) => campo.alcance === "por_reserva");

  const motivoIncompleto = motivo.trim().length < 5;
  const listo = !motivoIncompleto && !cargando;

  const actualizarSeleccion = (
    refPasajero: string,
    campo: string,
    valor: string,
  ) => {
    setSelecciones((previas) => ({
      ...previas,
      [refPasajero]: {
        ...(previas[refPasajero] ?? {}),
        [campo]: valor === VALOR_VACIO ? null : valor,
      },
    }));
  };

  const confirmar = () => {
    if (!listo) return;
    const nuevosPasajeros = pasajeros.map((pasajero) => ({
      ...pasajero,
      nombre: (nombres[pasajero.ref_cliente] ?? pasajero.nombre).trim(),
      respuestas: {
        ...pasajero.respuestas,
        ...(selecciones[pasajero.ref_cliente] ?? {}),
      },
    }));
    onConfirmar({
      pasajeros: nuevosPasajeros,
      respuestas_globales: globales,
      motivo: motivo.trim(),
    });
  };

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Editar datos de la reserva</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            Los cambios se guardan con el motivo que indiques y quedan registrados en la
            auditoría.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {pasajeros.map((pasajero) => (
            <section
              key={pasajero.ref_cliente}
              className="flex flex-col gap-3 rounded-2xl border border-border p-3"
            >
              <p className="text-sm font-bold text-foreground">
                {pasajero.es_titular ? "Titular" : `Pasajero ${pasajero.nombre || "sin nombre"}`}
              </p>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`nombre-${pasajero.ref_cliente}`} className="text-sm font-medium">
                  Nombre
                </Label>
                <Input
                  id={`nombre-${pasajero.ref_cliente}`}
                  value={nombres[pasajero.ref_cliente] ?? ""}
                  onChange={(evento) =>
                    setNombres((previas) => ({
                      ...previas,
                      [pasajero.ref_cliente]: evento.target.value,
                    }))
                  }
                  className="h-11"
                />
              </div>

              {camposPorPasajero.map((campo) => {
                const valor =
                  selecciones[pasajero.ref_cliente]?.[campo.id] ??
                  pasajero.respuestas[campo.id] ??
                  null;
                return (
                  <div key={campo.id} className="flex flex-col gap-1.5">
                    <Label
                      htmlFor={`campo-${pasajero.ref_cliente}-${campo.id}`}
                      className="text-sm font-medium"
                    >
                      {campo.label}
                    </Label>
                    <Select
                      value={typeof valor === "string" ? valor : VALOR_VACIO}
                      onValueChange={(nuevo: string) =>
                        actualizarSeleccion(pasajero.ref_cliente, campo.id, nuevo)
                      }
                    >
                      <SelectTrigger id={`campo-${pasajero.ref_cliente}-${campo.id}`} className="h-11">
                        <SelectValue placeholder="Sin seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={VALOR_VACIO}>Sin seleccionar</SelectItem>
                        {campo.opciones.map((opcion) => (
                          <SelectItem key={opcion.valor} value={opcion.valor}>
                            {opcion.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </section>
          ))}

          {camposGlobales.length > 0 ? (
            <section className="flex flex-col gap-3 rounded-2xl border border-border p-3">
              <p className="text-sm font-bold text-foreground">Respuestas de la reserva</p>
              {camposGlobales.map((campo) => {
                const valor = globales[campo.id] ?? null;
                if (campo.tipo === "select") {
                  return (
                    <div key={campo.id} className="flex flex-col gap-1.5">
                      <Label htmlFor={`campo-global-${campo.id}`} className="text-sm font-medium">
                        {campo.label}
                      </Label>
                      <Select
                        value={typeof valor === "string" ? valor : VALOR_VACIO}
                        onValueChange={(nuevo: string) =>
                          setGlobales((previas) => ({
                            ...previas,
                            [campo.id]: nuevo === VALOR_VACIO ? null : nuevo,
                          }))
                        }
                      >
                        <SelectTrigger id={`campo-global-${campo.id}`} className="h-11">
                          <SelectValue placeholder="Sin seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={VALOR_VACIO}>Sin seleccionar</SelectItem>
                          {campo.opciones.map((opcion) => (
                            <SelectItem key={opcion.valor} value={opcion.valor}>
                              {opcion.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }
                return (
                  <div key={campo.id} className="flex flex-col gap-1.5">
                    <Label htmlFor={`campo-global-${campo.id}`} className="text-sm font-medium">
                      {campo.label}
                    </Label>
                    {campo.tipo === "textarea" ? (
                      <Textarea
                        id={`campo-global-${campo.id}`}
                        value={typeof valor === "string" ? valor : ""}
                        onChange={(evento) =>
                          setGlobales((previas) => ({ ...previas, [campo.id]: evento.target.value }))
                        }
                        className="min-h-20"
                      />
                    ) : (
                      <Input
                        id={`campo-global-${campo.id}`}
                        value={typeof valor === "string" ? valor : ""}
                        onChange={(evento) =>
                          setGlobales((previas) => ({ ...previas, [campo.id]: evento.target.value }))
                        }
                        className="h-11"
                      />
                    )}
                  </div>
                );
              })}
            </section>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editar-motivo" className="text-sm font-semibold text-foreground">
              Motivo de la edición
            </Label>
            <Textarea
              id="editar-motivo"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              aria-invalid={motivoIncompleto || undefined}
              aria-describedby="editar-motivo-ayuda"
              placeholder="Por ejemplo: el titular corrigió su número de documento por WhatsApp."
              className="min-h-20"
            />
            <p
              id="editar-motivo-ayuda"
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
            onClick={confirmar}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{cargando ? "Guardando…" : "Guardar cambios"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
