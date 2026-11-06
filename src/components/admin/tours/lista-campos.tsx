import * as React from "react";
import { ArrowDown, ArrowUp, GripVertical, ListOrdered, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { ETIQUETA_ALCANCE, ETIQUETA_TIPO_CAMPO } from "./tipos-campo";
import type { CampoDef } from "@/lib/domain/types";

export interface ListaCamposProps {
  campos: CampoDef[];
  /** Id del campo que se está editando. */
  seleccionado: string | null;
  onSeleccionar: (id: string) => void;
  /** Mueve el campo a la posición indicada (0 = primero). */
  onMover: (id: string, destino: number) => void;
  /** Añade un campo nuevo (abre el selector de tipo en el padre). */
  onAgregar?: (() => void) | undefined;
  className?: string | undefined;
}

/**
 * Lista ordenable de campos del formulario (Spec 9.9).
 *
 * Se puede reordenar **arrastrando** o con los botones «Subir» / «Bajar» y el
 * menú «Mover a…». Ninguna función depende solo del gesto (UX-09).
 */
export function ListaCampos({
  campos,
  seleccionado,
  onSeleccionar,
  onMover,
  onAgregar,
  className,
}: ListaCamposProps) {
  const [arrastrado, setArrastrado] = React.useState<string | null>(null);
  const [destino, setDestino] = React.useState<string | null>(null);

  if (campos.length === 0) {
    return (
      <div className={cn("rounded-2xl border border-dashed border-border p-6 text-center", className)}>
        <p className="font-semibold text-foreground">Este formulario todavía no tiene preguntas</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Agrega la primera pregunta o inserta una de la biblioteca de campos.
        </p>
        {onAgregar ? (
          <Button type="button" onClick={onAgregar} className="mt-4 min-h-11">
            <Plus aria-hidden="true" />
            Agregar campo
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <ul className="space-y-2" aria-label="Preguntas del formulario">
        {campos.map((campo, indice) => {
          const activo = campo.id === seleccionado;
          const esDestino = destino === campo.id && arrastrado !== null && arrastrado !== campo.id;

          return (
            <li
              key={campo.id}
              draggable
              onDragStart={() => setArrastrado(campo.id)}
              onDragEnd={() => {
                setArrastrado(null);
                setDestino(null);
              }}
              onDragOver={(evento) => {
                evento.preventDefault();
                setDestino(campo.id);
              }}
              onDrop={(evento) => {
                evento.preventDefault();
                if (arrastrado && arrastrado !== campo.id) {
                  onMover(arrastrado, indice);
                }
                setArrastrado(null);
                setDestino(null);
              }}
              className={cn(
                "rounded-xl border bg-card p-3 transition-colors",
                activo ? "border-primary ring-1 ring-primary/40" : "border-border",
                esDestino ? "border-dashed border-primary" : undefined,
                arrastrado === campo.id ? "opacity-60" : undefined,
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-1 cursor-grab text-muted-foreground"
                  aria-hidden="true"
                  title="Arrastra para reordenar"
                >
                  <GripVertical className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onSeleccionar(campo.id)}
                    className="block w-full text-left"
                    aria-pressed={activo}
                  >
                    <span className="flex items-center gap-2">
                      <Pencil
                        className={cn("h-3.5 w-3.5 shrink-0", activo ? "text-primary" : "text-muted-foreground")}
                        aria-hidden="true"
                      />
                      <span className="truncate text-sm font-semibold text-foreground">
                        {campo.label || "Pregunta sin etiqueta"}
                      </span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        {ETIQUETA_TIPO_CAMPO[campo.tipo]}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        {ETIQUETA_ALCANCE[campo.alcance]}
                      </span>
                      {campo.obligatorio ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                          Obligatoria
                        </span>
                      ) : null}
                      {campo.visible_si ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                          Condicionada
                        </span>
                      ) : null}
                    </span>
                  </button>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onMover(campo.id, indice - 1)}
                    disabled={indice === 0}
                    className="min-h-11 min-w-11"
                    aria-label={`Subir la pregunta ${campo.label}`}
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onMover(campo.id, indice + 1)}
                    disabled={indice === campos.length - 1}
                    className="min-h-11 min-w-11"
                    aria-label={`Bajar la pregunta ${campo.label}`}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-11 min-w-11"
                        aria-label={`Mover la pregunta ${campo.label} a otra posición`}
                      >
                        <ListOrdered aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Mover a…</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {campos.map((otro, posicion) => (
                        <DropdownMenuItem
                          key={otro.id}
                          disabled={posicion === indice}
                          onSelect={() => onMover(campo.id, posicion)}
                        >
                          {posicion + 1}. {otro.label || "Pregunta sin etiqueta"}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {onAgregar ? (
        <Button type="button" variant="outline" onClick={onAgregar} className="min-h-11 w-full">
          <Plus aria-hidden="true" />
          Agregar campo
        </Button>
      ) : null}
    </div>
  );
}
