import { useMemo } from "react";

import { Switch } from "@/components/ui/switch";
import { evaluarCampos, type ContextoMotor } from "@/lib/domain/form-engine";
import type { CampoDef, Respuesta } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

import { CampoDinamico } from "./CampoDinamico";

export interface FormularioDinamicoProps {
  /** Contexto del motor: campos, respuestas, categorías y opciones agotadas. */
  ctx: ContextoMotor;
  /** Ámbito que se renderiza. */
  alcance: "por_reserva" | "por_pasajero";
  /** Referencia del pasajero cuando el ámbito es `por_pasajero`. */
  refPasajero?: string | undefined;
  /** Cambia el valor de un campo dentro de su ámbito. */
  onChange: (campoId: string, valor: Respuesta) => void;
  /** Errores por clave: `campoId` o `campoId@refPasajero`. */
  errores?: Record<string, string> | undefined;
  /** Opciones agotadas por el servidor: `"campoId:valor" -> true`. */
  agotadas?: Record<string, boolean> | undefined;
  /** Copia las respuestas del pasajero anterior. */
  onCopiarAnterior?: ((campoId: string) => void) | undefined;
  /** Decide si un campo concreto admite la copia del pasajero anterior. */
  puedeCopiar?: ((campo: CampoDef) => boolean) | undefined;
  /**
   * Filtra los campos que se renderizan. Por defecto se muestran todos los
   * visibles y aplicables del ámbito; el filtro permite separar los campos
   * "para toda la reserva" de los que responde cada pasajero.
   */
  filtrarCampos?: ((campo: CampoDef) => boolean) | undefined;
  /**
   * Campos `por_reserva` que además pueden responderse por pasajero.
   * `true` = la misma respuesta para todos.
   */
  modoCompartido?: Record<string, boolean> | undefined;
  onAlternarModoCompartido?: ((campoId: string, compartido: boolean) => void) | undefined;
  deshabilitado?: boolean | undefined;
  className?: string | undefined;
}

/**
 * Render del formulario dinámico por ámbito (Spec §6).
 *
 * No decide nada: la visibilidad, la aplicabilidad y el valor actual salen
 * del motor (`evaluarCampos`). Este componente sólo compone.
 */
export function FormularioDinamico({
  ctx,
  alcance,
  refPasajero,
  onChange,
  errores,
  agotadas,
  onCopiarAnterior,
  puedeCopiar,
  filtrarCampos,
  modoCompartido,
  onAlternarModoCompartido,
  deshabilitado,
  className,
}: FormularioDinamicoProps) {
  const evaluados = useMemo(() => evaluarCampos(ctx, refPasajero), [ctx, refPasajero]);

  const visibles = useMemo(
    () =>
      evaluados.filter(
        (evaluado) =>
          evaluado.aplica && evaluado.visible && (filtrarCampos ? filtrarCampos(evaluado.campo) : true),
      ),
    [evaluados, filtrarCampos],
  );

  const errorDe = (campoId: string): string | undefined => {
    if (!errores) return undefined;
    if (refPasajero) {
      const porPasajero = errores[`${campoId}@${refPasajero}`];
      if (porPasajero) return porPasajero;
    }
    return errores[campoId];
  };

  if (visibles.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {visibles.map((evaluado) => {
        const campo = evaluado.campo;
        const compartido = modoCompartido?.[campo.id] ?? true;
        const puedeBajar = campo.permite_por_pasajero === true;

        return (
          <section key={campo.id} className="flex flex-col gap-2">
            {puedeBajar && onAlternarModoCompartido && alcance === "por_reserva" ? (
              <div className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                <Switch
                  checked={compartido}
                  disabled={deshabilitado}
                  onCheckedChange={(estado) => onAlternarModoCompartido(campo.id, estado)}
                  id={`${campo.id}-compartido`}
                />
                <label
                  htmlFor={`${campo.id}-compartido`}
                  className="text-sm font-medium text-foreground"
                >
                  Todos usan la misma respuesta
                </label>
              </div>
            ) : null}

            <CampoDinamico
              campo={campo}
              valor={evaluado.valor}
              error={errorDe(campo.id)}
              agotadas={agotadas}
              deshabilitado={deshabilitado}
              onChange={(valor) => onChange(campo.id, valor)}
              onCopiarAnterior={
                onCopiarAnterior && (puedeCopiar ? puedeCopiar(campo) : true)
                  ? (campoId) => onCopiarAnterior(campoId)
                  : undefined
              }
            />
          </section>
        );
      })}
    </div>
  );
}
