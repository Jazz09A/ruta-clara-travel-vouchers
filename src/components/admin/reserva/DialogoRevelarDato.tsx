import { DialogoConfirmacion } from "@/components/core/DialogoConfirmacion";
import type { CampoRevelable } from "./TarjetaPasajero";

/**
 * Diálogo de **revelado de datos sensibles** (A-07).
 *
 * Pide un motivo obligatorio (queda auditado) y explica que el dato se
 * vuelve a enmascarar a los 30 segundos. Nunca copia el dato al
 * portapapeles por su cuenta (SEG-07).
 */

const TITULOS: Record<CampoRevelable, string> = {
  documento: "documento",
  fecha_nacimiento: "fecha de nacimiento",
};

export interface DialogoRevelarDatoProps {
  /** Estado de apertura (controlado). */
  abierto: boolean;
  /** Se llama al abrir o cerrar. */
  onAbiertoChange: (abierto: boolean) => void;
  /** Campo que se va a revelar. */
  campo: CampoRevelable;
  /** Nombre de la persona a la que pertenece el dato. */
  nombre: string;
  /** Motivo escrito por el operador. */
  motivo: string;
  /** Se llama al cambiar el motivo. */
  onMotivoChange: (valor: string) => void;
  /** La acción está en curso. */
  cargando: boolean;
  /** Confirma el revelado. */
  onConfirmar: () => void;
}

export function DialogoRevelarDato({
  abierto,
  onAbiertoChange,
  campo,
  nombre,
  motivo,
  onMotivoChange,
  cargando,
  onConfirmar,
}: DialogoRevelarDatoProps) {
  return (
    <DialogoConfirmacion
      open={abierto}
      onOpenChange={onAbiertoChange}
      titulo={`Ver ${TITULOS[campo]} de ${nombre}`}
      descripcion="Información sensible: el dato se muestra durante 30 segundos y después vuelve a ocultarse. La consulta queda registrada en la auditoría."
      textoConfirmar="Ver dato"
      loading={cargando}
      motivo={{
        valor: motivo,
        onChange: onMotivoChange,
        obligatorio: true,
        minimoCaracteres: 5,
      }}
      onConfirm={onConfirmar}
    />
  );
}
