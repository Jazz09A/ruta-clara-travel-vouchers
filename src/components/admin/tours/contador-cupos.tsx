import { cn } from "@/lib/utils";

export interface ContadorCuposProps {
  /** Cupos totales de la salida. */
  total: number;
  /** Cupos ya vendidos. */
  vendidos: number;
  /** Cupos retenidos por reservas en curso. */
  retenidos?: number | undefined;
  className?: string | undefined;
}

/**
 * C-29 · Contador de cupos.
 *
 * Muestra «32 de 40» con una barra de progreso y **siempre** acompaña la cifra
 * con texto (nunca solo color, Spec 3.9).
 */
export function ContadorCupos({ total, vendidos, retenidos = 0, className }: ContadorCuposProps) {
  const ocupados = Math.min(total, vendidos + retenidos);
  const libres = Math.max(0, total - ocupados);
  const porcentaje = total > 0 ? Math.round((ocupados / total) * 100) : 0;

  return (
    <div className={cn("min-w-[9rem]", className)}>
      <p className="text-xs font-semibold text-foreground">
        {ocupados} de {total} cupos ocupados
      </p>
      <div
        className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={ocupados}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`Cupos ocupados: ${ocupados} de ${total}`}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${porcentaje}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {libres} libres · {vendidos} vendidos{retenidos > 0 ? ` · ${retenidos} retenidos` : ""}
      </p>
    </div>
  );
}
