import { MARCA } from "@/lib/brand";

import { EstadoBloqueante } from "../EstadoBloqueante";

export interface EnlaceVencidoProps {
  nombreTour?: string | undefined;
  fechaTour?: string | undefined;
  telefonoWhatsapp?: string | undefined;
  accion?: { etiqueta: string; onClick: () => void } | undefined;
}

/**
 * P-10 — Enlace vencido (410 `ENLACE_VENCIDO`).
 *
 * No se culpa al cliente ni se pide ningún dato: sólo se ofrece pedir un
 * enlace nuevo por WhatsApp (Spec §5, P-10).
 */
export function EnlaceVencido({
  nombreTour,
  fechaTour,
  telefonoWhatsapp,
  accion,
}: EnlaceVencidoProps) {
  const mensajeWhatsApp = [
    "Hola, quiero hacer una reserva.",
    nombreTour ? `Tour: ${nombreTour}.` : null,
    fechaTour ? `Fecha: ${fechaTour}.` : null,
    "Mi enlace venció, ¿me pueden enviar uno nuevo?",
  ]
    .filter((parte): parte is string => parte !== null)
    .join(" ");

  return (
    <EstadoBloqueante
      titulo="Tu enlace venció"
      mensaje={
        <p>
          Los enlaces de reserva tienen una vigencia limitada y el tuyo ya pasó la fecha. No te
          preocupes: escríbenos y te enviamos un enlace nuevo para la misma salida.
        </p>
      }
      whatsappMensaje={mensajeWhatsApp}
      telefonoWhatsapp={telefonoWhatsapp ?? MARCA.whatsapp}
      accion={accion}
      tono="aviso"
    />
  );
}
