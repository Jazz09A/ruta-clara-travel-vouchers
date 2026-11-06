import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Botón de WhatsApp (C-26).
 *
 * El texto y el destinatario SIEMPRE vienen del servidor (`whatsapp_url`);
 * el front nunca concatena texto libre del usuario en el enlace.
 */

export interface BotonWhatsAppProps extends Omit<ButtonProps, "children"> {
  /** URL `wa.me` armada por el servidor (nunca texto libre del usuario). */
  url: string;
  children?: ReactNode;
  className?: string;
}

export function BotonWhatsApp({ url, children = "Enviar por WhatsApp", className, ...props }: BotonWhatsAppProps) {
  return (
    <Button {...props} asChild className={cn(className)}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        {children}
      </a>
    </Button>
  );
}
