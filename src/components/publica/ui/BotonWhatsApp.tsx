import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export interface BotonWhatsAppProps {
  /** Teléfono con o sin `+` (sólo dígitos se usan). */
  telefono?: string | undefined;
  /** Texto prearmado; se codifica con `encodeURIComponent` (SEG-10). */
  mensaje?: string | undefined;
  etiqueta?: string | undefined;
  variante?: "solido" | "contorno" | "flotante" | undefined;
  className?: string | undefined;
}

/**
 * Botón de WhatsApp (C-26 / Spec §4.4).
 *
 * El texto siempre viene de una plantilla del servidor o de la app: nunca se
 * concatena entrada libre del usuario en el enlace.
 */
export function BotonWhatsApp({
  telefono,
  mensaje,
  etiqueta = "Escríbenos por WhatsApp",
  variante = "contorno",
  className,
}: BotonWhatsAppProps) {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  if (!digitos) return null;

  const url = `https://wa.me/${digitos}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;

  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const estilos = {
    solido: "bg-success text-white hover:opacity-90",
    contorno: "border border-input bg-card text-foreground hover:bg-accent",
    flotante:
      "h-12 w-12 rounded-full bg-success p-0 text-white shadow-lg hover:opacity-90",
  } as const;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={variante === "flotante" ? etiqueta : undefined}
      className={cn(base, estilos[variante], variante === "flotante" && "w-12 px-0", className)}
    >
      <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      {variante === "flotante" ? <span className="sr-only">{etiqueta}</span> : <span>{etiqueta}</span>}
    </a>
  );
}
