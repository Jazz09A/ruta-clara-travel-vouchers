import { Checkbox } from "@/components/ui/checkbox";
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
import { evaluarCampos, type ContextoMotor } from "@/lib/domain/form-engine";
import { formatUsd } from "@/lib/format";
import type { Categoria, CampoDef, Respuesta } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export interface VisorFormularioProps {
  campos: CampoDef[];
  /** Respuestas del pasajero simulado. */
  respuestas: Record<string, Respuesta>;
  /** Categoría del pasajero simulado. */
  categoria: Categoria;
  /** Referencia del pasajero simulado. */
  refPasajero: string;
  onRespuesta: (campoId: string, valor: Respuesta) => void;
  className?: string | undefined;
}

/**
 * Vista previa del formulario con el **mismo motor** que la app pública
 * (`evaluarCampos`): lo que se ve aquí es lo que verá el cliente (RF-3.8).
 *
 * No persiste nada.
 */
export function VisorFormulario({
  campos,
  respuestas,
  categoria,
  refPasajero,
  onRespuesta,
  className,
}: VisorFormularioProps) {
  const ctx: ContextoMotor = {
    campos,
    globales: {},
    porPasajero: { [refPasajero]: respuestas },
    categorias: { [refPasajero]: categoria },
  };

  const evaluados = evaluarCampos(ctx, refPasajero);
  const visibles = evaluados.filter((evaluado) => evaluado.aplica && evaluado.visible);
  const ocultos = evaluados.filter((evaluado) => evaluado.aplica && !evaluado.visible);

  if (visibles.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No hay preguntas que mostrar para esta categoría.
      </p>
    );
  }

  return (
    <div className={cn("space-y-5", className)}>
      {visibles.map((evaluado) => {
        const { campo, valor } = evaluado;
        const id = `vista-previa-${campo.id}`;

        return (
          <div key={campo.id} className="space-y-1.5">
            <Label htmlFor={id} className="text-sm font-semibold text-foreground">
              {campo.label}
              {campo.obligatorio ? (
                <span className="text-destructive" aria-hidden="true">
                  {" "}
                  *
                </span>
              ) : null}
            </Label>
            {campo.ayuda ? <p className="text-xs text-muted-foreground">{campo.ayuda}</p> : null}

            {campo.tipo === "text" ? (
              <Input
                id={id}
                className="min-h-11"
                value={typeof valor === "string" ? valor : ""}
                onChange={(evento) => onRespuesta(campo.id, evento.target.value)}
              />
            ) : null}

            {campo.tipo === "textarea" ? (
              <Textarea
                id={id}
                className="min-h-11"
                rows={3}
                value={typeof valor === "string" ? valor : ""}
                onChange={(evento) => onRespuesta(campo.id, evento.target.value)}
              />
            ) : null}

            {campo.tipo === "select" ? (
              <Select
                value={typeof valor === "string" ? valor : ""}
                onValueChange={(nuevo) => onRespuesta(campo.id, nuevo)}
              >
                <SelectTrigger id={id} className="min-h-11">
                  <SelectValue placeholder="Elige una opción" />
                </SelectTrigger>
                <SelectContent>
                  {(campo.opciones ?? []).map((opcion) => (
                    <SelectItem key={opcion.valor} value={opcion.valor}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {campo.tipo === "multiselect" ? (
              <ul className="space-y-2">
                {(campo.opciones ?? []).map((opcion) => {
                  const marcados = Array.isArray(valor) ? valor : [];
                  const marcado = marcados.includes(opcion.valor);
                  return (
                    <li key={opcion.valor} className="flex items-center gap-2">
                      <Checkbox
                        id={`${id}-${opcion.valor}`}
                        checked={marcado}
                        onCheckedChange={(estado) => {
                          const nuevos = estado
                            ? [...marcados, opcion.valor]
                            : marcados.filter((valorOpcion) => valorOpcion !== opcion.valor);
                          onRespuesta(campo.id, nuevos);
                        }}
                      />
                      <Label htmlFor={`${id}-${opcion.valor}`} className="text-sm font-normal">
                        {opcion.label}
                      </Label>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {campo.tipo === "checkbox" ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={valor === true}
                  onCheckedChange={(estado) => onRespuesta(campo.id, estado === true)}
                />
                <Label htmlFor={id} className="text-sm font-normal">
                  {campo.obligatorio ? "Sí, обязаatoriamente" : "Sí, lo marco"}
                </Label>
              </div>
            ) : null}

            {campo.tipo === "number" ? (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                className="min-h-11"
                min={campo.min}
                max={campo.max}
                value={typeof valor === "number" ? valor : ""}
                onChange={(evento) => {
                  const texto = evento.target.value;
                  onRespuesta(campo.id, texto === "" ? null : Number(texto));
                }}
              />
            ) : null}

            {campo.tipo === "date" ? (
              <Input
                id={id}
                type="date"
                className="min-h-11"
                value={typeof valor === "string" ? valor : ""}
                onChange={(evento) => onRespuesta(campo.id, evento.target.value)}
              />
            ) : null}

            {campo.tipo === "extra" ? (
              <div className="space-y-1">
                <Input
                  id={id}
                  type="number"
                  inputMode="numeric"
                  className="min-h-11"
                  min={0}
                  max={campo.cantidad_max}
                  value={typeof valor === "number" ? valor : ""}
                  onChange={(evento) => {
                    const texto = evento.target.value;
                    onRespuesta(campo.id, texto === "" ? null : Number(texto));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {formatUsd(campo.precio_usd ?? "0")} por unidad
                  {campo.cantidad_max ? ` · máximo ${campo.cantidad_max}` : ""}
                </p>
              </div>
            ) : null}
          </div>
        );
      })}

      {ocultos.length > 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          {ocultos.length}{" "}
          {ocultos.length === 1 ? "pregunta está oculta" : "preguntas están ocultas"} con las
          respuestas actuales (se muestran cuando se cumple su condición).
        </p>
      ) : null}
    </div>
  );
}
