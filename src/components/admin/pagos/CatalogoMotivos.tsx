import { Eye, MessageSquareQuote } from "lucide-react";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { ETIQUETA_MOTIVO_RECHAZO } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Catálogo de motivos de rechazo (Spec §9.7).
 *
 * El motivo se elige de una lista cerrada y, cuando es «otro», se exige un
 * texto libre. El texto que se envía al cliente se compone aquí y se muestra
 * como **vista previa** antes de confirmar, para que el validador sepa
 * exactamente lo que va a leer el titular.
 */

/** Motivos disponibles (los mismos del contrato de la API). */
export const MOTIVOS_RECHAZO = [
  "comprobante_ilegible",
  "monto_incorrecto",
  "referencia_no_encontrada",
  "pago_no_recibido",
  "otro",
] as const;

export type CodigoMotivoRechazo = (typeof MOTIVOS_RECHAZO)[number];

/** Etiqueta legible de un motivo del catálogo. */
export function etiquetaMotivo(codigo: string): string {
  return ETIQUETA_MOTIVO_RECHAZO[codigo] ?? "Motivo sin descripción";
}

/**
 * Compone el mensaje que verá el cliente.
 *
 * - Motivo del catálogo: se usa su etiqueta.
 * - «otro»: el texto libre es el mensaje.
 * - Nota adicional: se anexa al final cuando el validador la escribe.
 */
export function mensajeParaCliente(codigo: string, textoLibre: string, nota = ""): string {
  const libre = textoLibre.trim();
  const extra = nota.trim();
  const base = codigo === "otro" ? libre : etiquetaMotivo(codigo);
  if (!base) return extra;
  if (!extra) return base;
  return `${base}. ${extra}`;
}

export interface CatalogoMotivosProps {
  /** Código del motivo seleccionado. */
  valor: string;
  /** Se llama al cambiar de motivo. */
  onChange: (codigo: string) => void;
  /** Texto libre. Obligatorio cuando el motivo es «otro». */
  textoLibre: string;
  /** Se llama al cambiar el texto libre. */
  onTextoLibreChange: (texto: string) => void;
  /** Nota opcional que se anexa al mensaje del cliente. */
  nota: string;
  /** Se llama al cambiar la nota. */
  onNotaChange: (nota: string) => void;
  /** Deshabilita la edición (por ejemplo, mientras se guarda). */
  disabled?: boolean | undefined;
  className?: string | undefined;
}

export function CatalogoMotivos({
  valor,
  onChange,
  textoLibre,
  onTextoLibreChange,
  nota,
  onNotaChange,
  disabled = false,
  className,
}: CatalogoMotivosProps) {
  const esOtro = valor === "otro";
  const textoIncompleto = esOtro && textoLibre.trim().length < 10;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <fieldset className="flex flex-col gap-2" disabled={disabled}>
        <legend className="text-sm font-semibold text-foreground">Motivo del rechazo</legend>

        <RadioGroup
          value={valor}
          onValueChange={(siguiente: string) => onChange(siguiente)}
          className="gap-2"
        >
          {MOTIVOS_RECHAZO.map((codigo) => {
            const id = `motivo-rechazo-${codigo}`;
            return (
              <div key={codigo} className="flex items-center gap-3">
                <RadioGroupItem value={codigo} id={id} disabled={disabled} />
                <Label
                  htmlFor={id}
                  className="min-h-11 cursor-pointer py-2 text-sm font-normal leading-snug text-foreground"
                >
                  {etiquetaMotivo(codigo)}
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="motivo-rechazo-texto" className="text-sm font-semibold text-foreground">
          {esOtro ? "Motivo para el cliente" : "Detalle para el cliente (opcional)"}
          {esOtro ? <span className="text-destructive"> *</span> : null}
        </Label>
        <Textarea
          id="motivo-rechazo-texto"
          value={textoLibre}
          onChange={(evento) => onTextoLibreChange(evento.target.value)}
          disabled={disabled}
          aria-invalid={textoIncompleto || undefined}
          aria-describedby="motivo-rechazo-texto-ayuda"
          placeholder={
            esOtro
              ? "Explica con tus palabras qué debe corregir el cliente."
              : "Por ejemplo: vuelve a subir la captura con la referencia visible."
          }
          className="min-h-24"
        />
        <p
          id="motivo-rechazo-texto-ayuda"
          className={cn(
            "text-xs leading-snug",
            textoIncompleto ? "text-red-700 dark:text-red-300" : "text-muted-foreground",
          )}
        >
          {esOtro
            ? `Escribe al menos 10 caracteres (${textoLibre.trim().length}/10).`
            : "Este texto se anexa al motivo y el cliente lo verá."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="motivo-rechazo-nota" className="text-sm font-semibold text-foreground">
          Nota interna (opcional)
        </Label>
        <Textarea
          id="motivo-rechazo-nota"
          value={nota}
          onChange={(evento) => onNotaChange(evento.target.value)}
          disabled={disabled}
          placeholder="Solo lo verá el equipo. No se envía al cliente."
          className="min-h-20"
        />
      </div>
    </div>
  );
}

export interface VistaPreviaMensajeProps {
  /** Código del motivo elegido. */
  codigo: string;
  /** Texto libre escrito por el validador. */
  textoLibre: string;
  /** Nota interna (no se envía al cliente). */
  nota?: string | undefined;
  className?: string | undefined;
}

/**
 * Vista previa del mensaje que verá el cliente.
 *
 * Se muestra **antes** de confirmar: el validador nunca rechaza un pago sin
 * saber qué va a leer el titular.
 */
export function VistaPreviaMensaje({
  codigo,
  textoLibre,
  nota = "",
  className,
}: VistaPreviaMensajeProps) {
  const mensaje = mensajeParaCliente(codigo, textoLibre, nota);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl border border-border bg-muted/60 p-4",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        Mensaje que verá el cliente
      </p>
      <p className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
        <MessageSquareQuote
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span>{mensaje || "Elige un motivo para ver el mensaje."}</span>
      </p>
    </div>
  );
}
