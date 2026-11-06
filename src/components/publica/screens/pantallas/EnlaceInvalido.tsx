import { MARCA } from "@/lib/brand";

import { EstadoBloqueante } from "../EstadoBloqueante";

export interface EnlaceInvalidoProps {
  /** Nombre del tour, si el servidor lo devolvió. */
  nombreTour?: string | undefined;
  /** Fecha de salida, si el servidor la devolvió. */
  fechaTour?: string | undefined;
  telefonoWhatsapp?: string | undefined;
  accion?: { etiqueta: string; onClick: () => void } | undefined;
}

/**
 * P-11 — Enlace inválido (404 `ENLACE_INVALIDO`).
 *
 * Anti-enumeración: el mismo texto exista o no haya existido el enlace
 * (Spec §5, P-11).
 */
export function EnlaceInvalido({
  nombreTour,
  fechaTour,
  telefonoWhatsapp,
  accion,
}: EnlaceInvalidoProps) {
  const mensajeWhatsApp = [
    "Hola, quiero hacer una reserva.",
    nombreTour ? `Tour: ${nombreTour}.` : null,
    fechaTour ? `Fecha: ${fechaTour}.` : null,
    "Mi enlace no funciona, ¿me pueden enviar uno nuevo?",
  ]
    .filter((parte): parte is string => parte !== null)
    .join(" ");

  return (
    <EstadoBloqueante
      titulo="Este enlace no es válido"
      mensaje={
        <p>
          El enlace que abriste no está disponible. Puede que haya caducado o que ya se haya
          usado. Escríbenos y te enviamos uno nuevo en un minuto.
        </p>
      }
      whatsappMensaje={mensajeWhatsApp}
      telefonoWhatsapp={telefonoWhatsapp ?? MARCA.whatsapp}
      accion={accion}
      tono="neutro"
    />
  );
}
