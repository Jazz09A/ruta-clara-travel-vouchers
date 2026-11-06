import { Ban, CircleHelp, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ETIQUETA_ALCANCE, ETIQUETA_TIPO_CAMPO } from "@/components/admin/tours/tipos-campo";
import type { CampoDef, Condicion } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

import { detectarCiclos } from "./validacion";

type Operador = "igual_a" | "en" | "distinto_de" | "no_vacio";

const OPERADORES: { valor: Operador; texto: string }[] = [
  { valor: "igual_a", texto: "es igual a" },
  { valor: "en", texto: "es uno de" },
  { valor: "distinto_de", texto: "es distinto de" },
  { valor: "no_vacio", texto: "no está vacío" },
];

export interface EditorCondicionProps {
  /** Campo que se está editando (no puede depender de sí mismo). */
  campo: CampoDef;
  /** Todos los campos del formulario. */
  campos: CampoDef[];
  onChange: (condicion: Condicion | undefined) => void;
  className?: string | undefined;
}

function operadorDe(condicion: Condicion | undefined): Operador {
  if (!condicion) return "igual_a";
  if ("no_vacio" in condicion) return "no_vacio";
  if ("en" in condicion) return "en";
  if ("distinto_de" in condicion) return "distinto_de";
  return "igual_a";
}

/** Un campo `por_reserva` no puede depender de uno `por_pasajero` (Spec 9.9). */
function alcancesCompatibles(campo: CampoDef, dependencia: CampoDef): boolean {
  if (campo.alcance === "por_reserva" && dependencia.alcance === "por_pasajero") return false;
  if (
    campo.alcance === "por_pasajero" &&
    dependencia.alcance === "por_reserva" &&
    dependencia.permite_por_pasajero !== true
  ) {
    return false;
  }
  return true;
}

/**
 * C-28 · Editor guiado de la condición de visibilidad.
 *
 * «Mostrar este campo si [campo] [operador] [valor]»: todo con selectores,
 * nunca texto libre. Solo se ofrecen dependencias válidas (mismo ámbito y sin
 * ciclos) y se explica por qué se descartan las demás.
 */
export function EditorCondicion({ campo, campos, onChange, className }: EditorCondicionProps) {
  const condicion = campo.visible_si;
  const operador = operadorDe(condicion);
  const dependencia = campos.find((otro) => otro.id === condicion?.campo);

  const enCiclo = new Set(detectarCiclos(campos).map((c) => c.id));

  const candidatos = campos.filter((otro) => {
    if (otro.id === campo.id) return false;
    if (enCiclo.has(otro.id)) return false;
    return alcancesCompatibles(campo, otro);
  });

  const descartados = campos.filter(
    (otro) =>
      otro.id !== campo.id && !candidatos.some((candidato) => candidato.id === otro.id),
  );

  const cambiarDependencia = (idCampo: string) => {
    onChange({ campo: idCampo, no_vacio: true });
  };

  const cambiarOperador = (nuevo: Operador) => {
    if (!dependencia) return;
    if (nuevo === "no_vacio") {
      onChange({ campo: dependencia.id, no_vacio: true });
      return;
    }
    if (nuevo === "en") {
      onChange({ campo: dependencia.id, en: [] });
      return;
    }
    const valorInicial =
      dependencia.tipo === "checkbox" ? true : (dependencia.opciones?.[0]?.valor ?? "");
    if (nuevo === "igual_a") {
      onChange({ campo: dependencia.id, igual_a: valorInicial });
      return;
    }
    onChange({ campo: dependencia.id, distinto_de: valorInicial });
  };

  const cambiarValor = (valor: unknown) => {
    if (!dependencia) return;
    if (operador === "no_vacio" || operador === "en") return;
    if (operador === "igual_a") {
      onChange({ campo: dependencia.id, igual_a: valor });
      return;
    }
    onChange({ campo: dependencia.id, distinto_de: valor });
  };

  const valoresEn = Array.isArray(condicion?.en) ? (condicion?.en as unknown[]) : [];

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-sm font-semibold text-foreground">Condición de visibilidad</p>
      <p className="text-xs leading-snug text-muted-foreground">
        Muestra este campo solo cuando se cumple la condición. Elige siempre de las listas: no se
        escribe texto libre.
      </p>

      {condicion ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor="condicion-campo" className="text-xs">
              Mostrar este campo si…
            </Label>
            <Select value={condicion.campo} onValueChange={cambiarDependencia}>
              <SelectTrigger id="condicion-campo" className="min-h-11">
                <SelectValue placeholder="Elige un campo" />
              </SelectTrigger>
              <SelectContent>
                {candidatos.map((otro) => (
                  <SelectItem key={otro.id} value={otro.id}>
                    {otro.label} · {ETIQUETA_TIPO_CAMPO[otro.tipo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor="condicion-operador" className="text-xs">
              Condición
            </Label>
            <Select value={operador} onValueChange={(valor) => cambiarOperador(valor as Operador)}>
              <SelectTrigger id="condicion-operador" className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERADORES.filter((item) => {
                  if (item.valor === "en") return (dependencia?.opciones?.length ?? 0) > 0;
                  return true;
                }).map((item) => (
                  <SelectItem key={item.valor} value={item.valor}>
                    {item.texto}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange(undefined)}
            className="min-h-11 text-destructive"
          >
            <Ban aria-hidden="true" />
            Quitar condición
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor="condicion-campo-nuevo" className="text-xs">
              Mostrar este campo si…
            </Label>
            <Select value="" onValueChange={cambiarDependencia}>
              <SelectTrigger id="condicion-campo-nuevo" className="min-h-11">
                <SelectValue placeholder="Elige el campo del que depende" />
              </SelectTrigger>
              <SelectContent>
                {candidatos.map((otro) => (
                  <SelectItem key={otro.id} value={otro.id}>
                    {otro.label} · {ETIQUETA_TIPO_CAMPO[otro.tipo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {dependencia && operador !== "no_vacio" ? (
        <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            Valor de «{dependencia.label}»:
          </p>

          {operador === "en" ? (
            <ul className="space-y-2">
              {(dependencia.opciones ?? []).map((opcion) => {
                const marcado = valoresEn.includes(opcion.valor);
                return (
                  <li key={opcion.valor} className="flex items-center gap-2">
                    <Checkbox
                      id={`condicion-en-${opcion.valor}`}
                      checked={marcado}
                      onCheckedChange={(estado) => {
                        const nuevos = estado
                          ? [...valoresEn, opcion.valor]
                          : valoresEn.filter((valor) => valor !== opcion.valor);
                        onChange({ campo: dependencia.id, en: nuevos });
                      }}
                    />
                    <Label htmlFor={`condicion-en-${opcion.valor}`} className="text-sm font-normal">
                      {opcion.label}
                    </Label>
                  </li>
                );
              })}
            </ul>
          ) : dependencia.opciones && dependencia.opciones.length > 0 ? (
            <Select
              value={String(condicion?.igual_a ?? condicion?.distinto_de ?? "")}
              onValueChange={(valor) => cambiarValor(valor)}
            >
              <SelectTrigger className="min-h-11" aria-label="Valor de la condición">
                <SelectValue placeholder="Elige el valor" />
              </SelectTrigger>
              <SelectContent>
                {dependencia.opciones.map((opcion) => (
                  <SelectItem key={opcion.valor} value={opcion.valor}>
                    {opcion.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : dependencia.tipo === "checkbox" ? (
            <Select
              value={String(condicion?.igual_a ?? condicion?.distinto_de ?? "")}
              onValueChange={(valor) => cambiarValor(valor === "si")}
            >
              <SelectTrigger className="min-h-11" aria-label="Valor de la condición">
                <SelectValue placeholder="Elige el valor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="si">Sí</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="min-h-11"
              aria-label="Valor de la condición"
              value={String(condicion?.igual_a ?? condicion?.distinto_de ?? "")}
              onChange={(evento) => {
                const texto = evento.target.value;
                cambiarValor(dependencia.tipo === "number" ? Number(texto) : texto);
              }}
              placeholder="Valor que debe tener"
            />
          )}
        </div>
      ) : null}

      {descartados.length > 0 ? (
        <details className="rounded-xl border border-border bg-muted/20 p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted-foreground">
            <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
            {descartados.length}{" "}
            {descartados.length === 1 ? "campo no puede ser dependencia" : "campos no pueden ser dependencia"}
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {descartados.map((otro) => (
              <li key={otro.id} className="flex items-start gap-1.5">
                <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                <span>
                  «{otro.label}» ({ETIQUETA_ALCANCE[otro.alcance]}): se responde en un ámbito distinto
                  al de este campo o forma un ciclo.
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
