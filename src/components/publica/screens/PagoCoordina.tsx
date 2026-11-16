import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Handshake } from "lucide-react";

import { api } from "@/lib/api";
import { BotonWhatsApp, useTituloPantalla } from "../ui";
import { MARCA } from "@/lib/brand";

/**
 * Paso «pago» con el reporte del cliente desactivado (flag global
 * `reporte_pago_cliente`).
 *
 * El formulario no pide nada al cliente: la reserva queda registrada y la
 * agencia anota los datos del pago desde el panel para confirmarla. El flujo
 * original de reporte sigue en el código por si se reactiva el flag.
 */
export interface PagoCoordinaProps {
  /** Token del enlace: sirve para sondear la reserva. */
  token?: string | undefined;
  refCorta?: string | undefined;
  nombreTour?: string | undefined;
  /** WhatsApp configurado de la agencia. */
  telefonoWhatsapp?: string | undefined;
  /** Mensaje precargado para abrir la conversación. */
  whatsappMensaje?: string | undefined;
}

export function PagoCoordina({
  token,
  refCorta,
  nombreTour,
  telefonoWhatsapp,
  whatsappMensaje,
}: PagoCoordinaProps) {
  useTituloPantalla(`Coordinamos tu pago · ${MARCA.nombre}`);

  // Sondea la reserva: cuando la agencia la confirma, la pantalla pasa sola
  // al voucher sin recargar (mismo criterio que la de verificación de pago).
  useQuery({
    queryKey: ["reserva", token ?? ""],
    queryFn: () => api.publica.reserva(token ?? ""),
    enabled: Boolean(token),
    staleTime: 0,
    refetchInterval: () =>
      typeof document !== "undefined" && document.hidden ? 30_000 : 15_000,
  });

  return (
    <div className="flex flex-col gap-5">
      <section
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-4 rounded-2xl border border-success/40 bg-success/10 px-5 py-8 text-center"
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-success/20 text-success">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-foreground">Registro completo</h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground/80">
            {refCorta ? `Tu reserva ${refCorta} quedó guardada` : "Tu reserva quedó guardada"}
            {nombreTour ? ` para ${nombreTour}` : ""}. La agencia se pondrá en contacto contigo para
            coordinar el pago: no necesitas reportar nada por aquí.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
          <Handshake className="h-5 w-5 text-primary" aria-hidden="true" />
          <span>¿Qué sigue?</span>
        </h2>
        <ol className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <li>1. Te escribimos por WhatsApp para coordinar la forma de pago.</li>
          <li>2. Cuando el pago quede confirmado, tu reserva pasa a estar lista.</li>
          <li>3. Recibes tu voucher con todos los datos de la salida.</li>
        </ol>
      </section>

      <BotonWhatsApp
        telefono={telefonoWhatsapp ?? MARCA.whatsapp}
        mensaje={
          whatsappMensaje ??
          `Hola, quiero coordinar el pago de mi reserva${refCorta ? ` ${refCorta}` : ""}.`
        }
        etiqueta="Escribir a la agencia"
        variante="solido"
        className="w-full"
      />
    </div>
  );
}
