import * as React from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { Campo } from "./campo";

/** Mínimo de caracteres del motivo (Spec 3.7 · UX-41). */
export const MINIMO_MOTIVO = 5;

export interface DialogoMotivoProps {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  titulo: string;
  descripcion?: React.ReactNode;
  /** Verbo explícito en el botón principal (UX-40): «Archivar tour». */
  etiquetaConfirmar: string;
  etiquetaCancelar?: string | undefined;
  /** Motivo obligatorio que escribe el operador. */
  motivo: string;
  onMotivoChange: (motivo: string) => void;
  /** Se invoca con el motivo ya validado. */
  onConfirmar: (motivo: string) => void;
  /** Estilo destructivo del botón principal. */
  destructivo?: boolean | undefined;
  cargando?: boolean | undefined;
  /** Exige un código TOTP de 6 dígitos (*step-up*, Spec 12.4). */
  requiereTotp?: boolean | undefined;
  totp?: string | undefined;
  onTotpChange?: (valor: string) => void;
  /** Exige escribir un texto exacto (confirmación escrita). */
  confirmacionEsperada?: string | undefined;
  confirmacion?: string | undefined;
  onConfirmacionChange?: (valor: string) => void;
  /** Texto del campo de confirmación escrita. */
  etiquetaConfirmacion?: string | undefined;
  /** Contenido extra (por ejemplo, los bloqueos que devuelve el servidor). */
  extra?: React.ReactNode;
}

/**
 * C-15 / C-27 · Diálogo de confirmación con motivo y *step-up*.
 *
 * Reúne las tres capas de seguridad de una acción sensible:
 * 1. Verbo explícito en el botón (nunca «Sí/No»).
 * 2. Motivo escrito obligatorio (mínimo 5 caracteres) que queda auditado.
 * 3. Código TOTP de 6 dígitos cuando la acción es crítica.
 *
 * El foco inicial va al campo de motivo, nunca al botón destructivo (UX-40).
 */
export function DialogoMotivo({
  abierto,
  onAbiertoChange,
  titulo,
  descripcion,
  etiquetaConfirmar,
  etiquetaCancelar = "Cancelar",
  motivo,
  onMotivoChange,
  onConfirmar,
  destructivo = false,
  cargando = false,
  requiereTotp = false,
  totp = "",
  onTotpChange,
  confirmacionEsperada,
  confirmacion = "",
  onConfirmacionChange,
  etiquetaConfirmacion,
  extra,
}: DialogoMotivoProps) {
  const motivoLimpio = motivo.trim();
  const motivoValido = motivoLimpio.length >= MINIMO_MOTIVO;
  const totpValido = !requiereTotp || /^\d{6}$/.test(totp.trim());
  const confirmacionValida =
    !confirmacionEsperada || confirmacion.trim() === confirmacionEsperada.trim();

  const habilitado = motivoValido && totpValido && confirmacionValida && !cargando;

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">{titulo}</DialogTitle>
          {descripcion ? (
            <DialogDescription asChild>
              <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                {descripcion}
              </div>
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-4">
          <Campo
            id="motivo-accion"
            etiqueta="Motivo"
            ayuda="Queda registrado en la auditoría. Escribe al menos 5 caracteres."
            error={
              motivoLimpio.length > 0 && !motivoValido ? "Escribe un motivo más largo." : undefined
            }
            requerido
          >
            {(props) => (
              <Textarea
                {...props}
                value={motivo}
                onChange={(evento) => onMotivoChange(evento.target.value)}
                rows={3}
                placeholder="Por ejemplo: el proveedor cambió el horario de salida"
              />
            )}
          </Campo>

          {requiereTotp ? (
            <Campo
              id="codigo-totp"
              etiqueta="Código de seguridad"
              ayuda="Escribe el código de 6 dígitos de tu aplicación de autenticación."
              error={
                totp.trim().length > 0 && !totpValido
                  ? "El código debe tener 6 dígitos."
                  : undefined
              }
              requerido
            >
              {(props) => (
                <Input
                  {...props}
                  value={totp}
                  onChange={(evento) =>
                    onTotpChange?.(evento.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="tracking-[0.4em]"
                />
              )}
            </Campo>
          ) : null}

          {confirmacionEsperada ? (
            <Campo
              id="confirmacion-escrita"
              etiqueta={etiquetaConfirmacion ?? "Confirmación escrita"}
              ayuda={`Escribe exactamente: ${confirmacionEsperada}`}
              error={
                confirmacion.trim().length > 0 && !confirmacionValida
                  ? "El texto no coincide con el solicitado."
                  : undefined
              }
              requerido
            >
              {(props) => (
                <Input
                  {...props}
                  value={confirmacion}
                  onChange={(evento) => onConfirmacionChange?.(evento.target.value)}
                  autoComplete="off"
                />
              )}
            </Campo>
          ) : null}
        </div>

        {extra ? <div className="space-y-2">{extra}</div> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onAbiertoChange(false)}
            disabled={cargando}
            className="min-h-11"
          >
            {etiquetaCancelar}
          </Button>
          <Button
            type="button"
            variant={destructivo ? "destructive" : "default"}
            onClick={() => onConfirmar(motivoLimpio)}
            disabled={!habilitado}
            aria-busy={cargando || undefined}
            className="min-h-11"
          >
            {requiereTotp ? <ShieldCheck aria-hidden="true" /> : null}
            {cargando ? "Un momento…" : etiquetaConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
