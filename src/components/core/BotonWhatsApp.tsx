import * as React from "react";
import { MessageCircle } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BotonWhatsAppProps {
  /** Telefono destino. Acepta cualquier formato; se normaliza a solo digitos. */
  telefono: string;
  /** Mensaje prearmado. Se codifica con `encodeURIComponent` (SEG-10). */
  mensaje: string;
  /** Texto visible del boton. Por defecto «Escribir por WhatsApp». */
  etiqueta?: string | undefined;
  variant?: ButtonProps["variant"] | undefined;
  size?: ButtonProps["size"] | undefined;
  className?: string | undefined;
  /** Desactiva el enlace (por ejemplo, si no hay telefono registrado). */
  disabled?: boolean | undefined;
  /** Texto que explica por que el boton esta desactivado. */
  motivoDeshabilitado?: string | undefined;
}

/**
 * C-26 · Boton de WhatsApp.
 *
 * Abre `wa.me` en una pestana nueva con el mensaje prearmado y
 * `rel="noopener noreferrer"` (Spec 4.1 y SEG-10). El mensaje debe venir de
 * una plantilla del servidor, nunca de texto libre concatenado por el usuario.
 */
export function BotonWhatsApp({
  telefono,
  mensaje,
  etiqueta = "Escribir por WhatsApp",
  variant = "default",
  size = "default",
  className,
  disabled = false,
  motivoDeshabilitado,
}: BotonWhatsAppProps) {
  const digitos = React.useMemo(() => (telefono || "").replace(/\D/g, ""), [telefono]);
  const sinTelefono = digitos.length === 0;
  const inactivo = disabled || sinTelefono;

  const url = React.useMemo(() => {
    if (!digitos) return "";
    return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje ?? "")}`;
  }, [digitos, mensaje]);

  if (inactivo) {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Button type="button" variant={variant} size={size} disabled aria-disabled="true">
          <MessageCircle aria-hidden="true" />
          <span>{etiqueta}</span>
        </Button>
        {motivoDeshabilitado ? (
          <p className="text-xs leading-snug text-muted-foreground">{motivoDeshabilitado}</p>
        ) : null}
      </div>
    );
  }

  return (
    <Button asChild variant={variant} size={size} className={cn("min-h-11", className)}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <MessageCircle aria-hidden="true" />
        <span>{etiqueta}</span>
      </a>
    </Button>
  );
}
