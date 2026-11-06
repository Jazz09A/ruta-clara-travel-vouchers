import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatUsd } from "@/lib/format";
import { opcionesDisponibles } from "@/lib/domain/form-engine";
import type { CampoDef, Respuesta } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

import { BirthDateInput, Campo, Stepper } from "../ui";

export interface CampoDinamicoProps {
  campo: CampoDef;
  valor: Respuesta;
  onChange: (valor: Respuesta) => void;
  onBlur?: (() => void) | undefined;
  error?: string | undefined;
  aviso?: string | undefined;
  /** Opciones agotadas por el servidor: `"campoId:valor" -> true`. */
  agotadas?: Record<string, boolean> | undefined;
  /** Copia la respuesta del pasajero anterior (sólo en campos que lo permiten). */
  onCopiarAnterior?: ((campoId: string) => void) | undefined;
  deshabilitado?: boolean | undefined;
  className?: string | undefined;
}

const LONGITUD_TEXTO = 500;
const LONGITUD_TEXTAREA = 1000;
/** A partir del 80 % de la longitud máxima se muestra el contador (Spec §6.2). */
const UMBRAL_CONTADOR = 0.8;

/**
 * Render de un campo del formulario dinámico según su `tipo` (Spec §6.2).
 *
 * El componente es "tonto": no decide visibilidad ni obligatoriedad, eso lo
 * hace el motor (`form-engine.ts`). Sólo dibuja el control y devuelve el
 * valor.
 */
export function CampoDinamico({
  campo,
  valor,
  onChange,
  onBlur,
  error,
  aviso,
  agotadas,
  onCopiarAnterior,
  deshabilitado,
  className,
}: CampoDinamicoProps) {
  const opciones = useMemo(
    () => opcionesDisponibles(campo, agotadas),
    [campo, agotadas],
  );

  const id = `campo-${campo.id}`;

  const cuerpo = () => {
    switch (campo.tipo) {
      case "text": {
        const max = campo.max_length ?? LONGITUD_TEXTO;
        const texto = typeof valor === "string" ? valor : "";
        const mostrarContador = texto.length >= max * UMBRAL_CONTADOR;
        return (
          <Campo
            id={id}
            etiqueta={campo.label}
            ayuda={campo.ayuda}
            error={error}
            aviso={aviso}
            requerido={campo.obligatorio}
          >
            {(aria) => (
              <div>
                <Input
                  {...aria}
                  type="text"
                  autoComplete="off"
                  maxLength={max}
                  className="h-11 text-base"
                  value={texto}
                  disabled={deshabilitado}
                  onChange={(evento) => onChange(evento.target.value)}
                  onBlur={onBlur}
                />
                {mostrarContador ? (
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    {`${texto.length} de ${max} caracteres`}
                  </p>
                ) : null}
              </div>
            )}
          </Campo>
        );
      }

      case "textarea": {
        const max = campo.max_length ?? LONGITUD_TEXTAREA;
        const texto = typeof valor === "string" ? valor : "";
        return (
          <Campo
            id={id}
            etiqueta={campo.label}
            ayuda={campo.ayuda}
            error={error}
            aviso={aviso}
            requerido={campo.obligatorio}
          >
            {(aria) => (
              <Textarea
                {...aria}
                rows={4}
                maxLength={max}
                className="min-h-24 text-base"
                value={texto}
                disabled={deshabilitado}
                onChange={(evento) => onChange(evento.target.value)}
                onBlur={onBlur}
              />
            )}
          </Campo>
        );
      }

      case "select": {
        const seleccionado = typeof valor === "string" ? valor : "";
        if (opciones.length <= 5) {
          return (
            <Campo
              id={id}
              etiqueta={campo.label}
              ayuda={campo.ayuda}
              error={error}
              aviso={aviso}
              requerido={campo.obligatorio}
            >
              {() => (
                <RadioGroup
                  value={seleccionado}
                  onValueChange={(nuevo: string) => onChange(nuevo)}
                  className="gap-2"
                  disabled={deshabilitado}
                  aria-describedby={error ? `${id}-error` : undefined}
                >
                  {opciones.map((opcion) => (
                    <RadioGroupItem
                      key={opcion.valor}
                      value={opcion.valor}
                      disabled={opcion.agotada || deshabilitado}
                      className={cn(
                        "aspect-auto h-auto min-h-11 w-full items-center justify-start gap-3 rounded-xl border border-input px-3 py-3 text-left text-sm font-medium text-foreground",
                        "data-[state=checked]:border-primary data-[state=checked]:bg-primary/5 data-[state=checked]:text-foreground",
                      )}
                    >
                      <span className="flex-1">{opcion.label}</span>
                      {opcion.agotada ? (
                        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Agotado
                        </span>
                      ) : null}
                    </RadioGroupItem>
                  ))}
                </RadioGroup>
              )}
            </Campo>
          );
        }

        return (
          <Campo
            id={id}
            etiqueta={campo.label}
            ayuda={campo.ayuda}
            error={error}
            aviso={aviso}
            requerido={campo.obligatorio}
          >
            {(aria) => (
              <Select
                value={seleccionado}
                disabled={deshabilitado}
                onValueChange={(nuevo: string) => onChange(nuevo)}
              >
                <SelectTrigger
                  id={aria.id}
                  aria-invalid={aria["aria-invalid"]}
                  aria-required={aria["aria-required"]}
                  aria-describedby={aria["aria-describedby"]}
                  className="h-11"
                >
                  <SelectValue placeholder="Elige una opción" />
                </SelectTrigger>
                <SelectContent>
                  {opciones.map((opcion) => (
                    <SelectItem
                      key={opcion.valor}
                      value={opcion.valor}
                      disabled={opcion.agotada}
                    >
                      <span className="flex w-full items-center justify-between gap-3">
                        <span>{opcion.label}</span>
                        {opcion.agotada ? (
                          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            Agotado
                          </span>
                        ) : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Campo>
        );
      }

      case "multiselect": {
        const actuales = Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : [];
        return (
          <Campo
            id={id}
            etiqueta={campo.label}
            ayuda={campo.ayuda}
            error={error}
            aviso={aviso}
            requerido={campo.obligatorio}
          >
            {() => (
              <div
                role="group"
                aria-label={campo.label}
                aria-describedby={error ? `${id}-error` : undefined}
                className={cn(
                  "flex flex-col gap-2",
                  opciones.length > 7 && "max-h-72 overflow-y-auto pr-1",
                )}
              >
                {opciones.map((opcion) => {
                  const marcado = actuales.includes(opcion.valor);
                  return (
                    <Checkbox
                      key={opcion.valor}
                      checked={marcado}
                      disabled={opcion.agotada || deshabilitado}
                      onCheckedChange={(estado) => {
                        const nuevo = estado === true
                          ? [...actuales, opcion.valor]
                          : actuales.filter((v) => v !== opcion.valor);
                        onChange(nuevo);
                      }}
                      className="aspect-auto h-auto min-h-11 w-full grid-cols-[auto_1fr] items-center gap-3 rounded-xl border border-input px-3 py-3 text-left text-sm font-medium text-foreground data-[state=checked]:border-primary data-[state=checked]:bg-primary/5"
                    >
                      <span className="flex-1">{opcion.label}</span>
                      {opcion.agotada ? (
                        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Agotado
                        </span>
                      ) : null}
                    </Checkbox>
                  );
                })}
              </div>
            )}
          </Campo>
        );
      }

      case "checkbox": {
        const marcado = valor === true;
        return (
          <Campo
            id={id}
            etiqueta={campo.label}
            ayuda={campo.ayuda}
            error={error}
            aviso={aviso}
            requerido={campo.obligatorio}
          >
            {() => (
              <Checkbox
                id={id}
                checked={marcado}
                disabled={deshabilitado}
                onCheckedChange={(estado) => onChange(estado === true)}
                className="aspect-auto h-auto min-h-11 w-full grid-cols-[auto_1fr] items-center gap-3 rounded-xl border border-input px-3 py-3 text-left text-sm font-medium text-foreground data-[state=checked]:border-primary data-[state=checked]:bg-primary/5"
              >
                <span className="flex-1">{marcado ? "Sí" : "No"}</span>
              </Checkbox>
            )}
          </Campo>
        );
      }

      case "number": {
        const numero = typeof valor === "number" ? valor : "";
        return (
          <Campo
            id={id}
            etiqueta={campo.label}
            ayuda={campo.ayuda}
            error={error}
            aviso={aviso}
            requerido={campo.obligatorio}
          >
            {(aria) => (
              <Input
                {...aria}
                type="number"
                inputMode="decimal"
                className="h-11 text-base"
                min={campo.min}
                max={campo.max}
                step={campo.step}
                value={numero}
                disabled={deshabilitado}
                onChange={(evento) => {
                  const bruto = evento.target.value;
                  if (bruto === "") {
                    onChange(null);
                    return;
                  }
                  const n = Number.parseFloat(bruto);
                  onChange(Number.isNaN(n) ? null : n);
                }}
                onBlur={onBlur}
              />
            )}
          </Campo>
        );
      }

      case "date": {
        const fecha = typeof valor === "string" ? valor : "";
        return (
          <Campo
            id={id}
            etiqueta={campo.label}
            ayuda={campo.ayuda}
            error={error}
            aviso={aviso}
            requerido={campo.obligatorio}
          >
            {() => (
              <BirthDateInput
                id={id}
                valor={fecha}
                error={error}
                requerido={campo.obligatorio}
                deshabilitado={deshabilitado}
                onChange={(nuevo) => onChange(nuevo)}
                onBlur={onBlur}
              />
            )}
          </Campo>
        );
      }

      case "extra": {
        const cantidad = typeof valor === "number" ? valor : 0;
        const max = campo.cantidad_max ?? 99;
        const precio = campo.precio_usd;
        return (
          <Campo
            id={id}
            etiqueta={campo.label}
            ayuda={campo.ayuda}
            error={error}
            aviso={aviso}
            requerido={campo.obligatorio}
          >
            {() => (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{campo.label}</p>
                  {precio ? (
                    <p className="text-xs text-muted-foreground">
                      {`${formatUsd(precio)} c/u${campo.unidad ? ` · ${campo.unidad}` : ""}`}
                    </p>
                  ) : null}
                </div>
                <Stepper
                  id={`${id}-cantidad`}
                  valor={cantidad}
                  min={0}
                  max={max}
                  etiqueta={campo.label}
                  deshabilitado={deshabilitado}
                  onChange={(nuevo) => onChange(nuevo)}
                />
              </div>
            )}
          </Campo>
        );
      }

      default:
        // Tipo desconocido: el campo se omite sin romper la pantalla
        // (Spec §6.4). El aviso lo pone el formulario.
        return (
          <p className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Hay una pregunta que no se puede mostrar. Contáctanos</span>
          </p>
        );
    }
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {cuerpo()}
      {onCopiarAnterior ? (
        <button
          type="button"
          onClick={() => onCopiarAnterior(campo.id)}
          className="-mt-2 min-h-11 self-start text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Copiar respuestas del pasajero anterior
        </button>
      ) : null}
    </div>
  );
}
