import * as React from "react";
import { NotebookPen, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Panel de **notas** de la reserva (A-07).
 *
 * - La referencia interna identifica la reserva para el equipo (la define el
 *   operador al crear el enlace).
 * - Las notas internas son del cliente: las ve el equipo, nunca el titular.
 */

export interface PanelNotasProps {
  /** Referencia interna de la reserva. */
  referenciaInterna: string | undefined;
  /** Notas internas del cliente. */
  notas: string;
  /** Guarda las notas. */
  onGuardarNotas: (notas: string) => void;
  /** El guardado está en curso. */
  guardando: boolean;
  /** Error del último guardado (mensaje en español). */
  error: string | undefined;
  className?: string | undefined;
}

export function PanelNotas({
  referenciaInterna,
  notas,
  onGuardarNotas,
  guardando,
  error,
  className,
}: PanelNotasProps) {
  const [borrador, setBorrador] = React.useState(notas);
  const [tocado, setTocado] = React.useState(false);

  React.useEffect(() => {
    if (!tocado) setBorrador(notas);
  }, [notas, tocado]);

  const cambiado = borrador !== notas;

  return (
    <section
      aria-label="Notas de la reserva"
      className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card", className)}
    >
      <header className="flex items-center gap-2">
        <NotebookPen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-bold text-foreground">Notas</h2>
      </header>

      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Referencia interna</span>
        </p>
        <p className="text-sm font-medium text-foreground">
          {referenciaInterna?.trim()
            ? referenciaInterna
            : "Sin referencia interna. Se define al crear el enlace."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notas-internas" className="text-sm font-semibold text-foreground">
          Notas internas del cliente
        </Label>
        <Textarea
          id="notas-internas"
          value={borrador}
          onChange={(evento) => {
            setTocado(true);
            setBorrador(evento.target.value);
          }}
          placeholder="Ej.: el titular pidió factura a nombre de su empresa."
          className="min-h-24"
          aria-describedby="notas-internas-ayuda"
        />
        <p id="notas-internas-ayuda" className="text-xs text-muted-foreground">
          Solo el equipo de la agencia las ve. El titular nunca las recibe.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="min-h-11"
          disabled={!cambiado || guardando}
          aria-busy={guardando || undefined}
          onClick={() => onGuardarNotas(borrador)}
        >
          {guardando ? "Guardando…" : "Guardar notas"}
        </Button>
        {cambiado && !guardando ? (
          <p className="text-xs text-muted-foreground">Hay cambios sin guardar.</p>
        ) : null}
      </div>
    </section>
  );
}
