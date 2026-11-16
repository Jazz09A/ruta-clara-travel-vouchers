/**
 * Motor de formularios dinámico de la app pública.
 *
 * Reexporta el render de un campo y del formulario por ámbito. La lógica de
 * evaluación vive en `@/lib/domain/form-engine` (compartida con el panel
 * admin).
 */
export { CampoDinamico, type CampoDinamicoProps } from "./CampoDinamico";
export { FormularioDinamico, type FormularioDinamicoProps } from "./FormularioDinamico";
