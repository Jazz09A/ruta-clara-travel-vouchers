import { DialogoConfirmacion } from "@/components/core/DialogoConfirmacion";

/**
 * Diálogo de confirmación con **motivo obligatorio**.
 *
 * Envuelve el diálogo compartido del núcleo para que todas las acciones
 * sensibles del panel pidan el motivo igual: mínimo 5 caracteres, con el
 * botón de confirmación en verbo explícito (UX-40, UX-41).
 */

export interface DialogoMotivoProps {
  /** Estado de apertura (controlado). */
  abierto: boolean;
  /** Se llama al abrir o cerrar. */
  onAbiertoChange: (abierto: boolean) => void;
  /** Título de la acción. */
  titulo: string;
  /** Explicación de lo que va a pasar. */
  descripcion: string;
  /** Verbo explícito del botón de confirmación. */
  textoConfirmar: string;
  /** Tono del botón de confirmación. */
  variante?: "normal" | "destructivo" | undefined;
  /** Motivo escrito por el operador. */
  motivo: string;
  /** Se llama al cambiar el motivo. */
  onMotivoChange: (valor: string) => void;
  /** La acción está en curso. */
  cargando: boolean;
  /** Confirma la acción. */
  onConfirmar: () => void;
}

export function DialogoMotivo({
  abierto,
  onAbiertoChange,
  titulo,
  descripcion,
  textoConfirmar,
  variante = "normal",
  motivo,
  onMotivoChange,
  cargando,
  onConfirmar,
}: DialogoMotivoProps) {
  return (
    <DialogoConfirmacion
      open={abierto}
      onOpenChange={onAbiertoChange}
      titulo={titulo}
      descripcion={descripcion}
      textoConfirmar={textoConfirmar}
      variante={variante}
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
