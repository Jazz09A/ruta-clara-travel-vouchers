/**
 * Primitivas de interfaz de la app pública.
 *
 * Son la versión local de `src/components/core/` (que otro agente está
 * escribiendo). Se mantienen aquí para que la app pública no dependa de un
 * módulo que todavía no existe; cuando `src/components/core/` esté listo,
 * estos archivos se pueden sustituir por reexportaciones sin cambiar las
 * pantallas.
 */
export { ActionBar, type AccionPrincipal, type ActionBarProps } from "./ActionBar";
export { BadgeEstado, type BadgeEstadoProps, type TonoEstado } from "./BadgeEstado";
export { Banner, type BannerProps, type VarianteBanner } from "./Banner";
export { BirthDateInput, type BirthDateInputProps } from "./BirthDateInput";
export { BotonCargar, type BotonCargarProps } from "./BotonCargar";
export { BotonCopiar, type BotonCopiarProps } from "./BotonCopiar";
export { BotonWhatsApp, type BotonWhatsAppProps } from "./BotonWhatsApp";
export { Campo, type CampoAria, type CampoProps } from "./Campo";
export { ContadorRegresivo, type ContadorRegresivoProps } from "./ContadorRegresivo";
export { DialogoConfirmacion, type DialogoConfirmacionProps } from "./DialogoConfirmacion";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { ErrorState, type ErrorStateProps } from "./ErrorState";
export { EstadoBloqueante, type EstadoBloqueanteProps } from "./Estados";
export { EstadoConexion, type EstadoConexionProps, type EstadoGuardado } from "./EstadoConexion";
export { useFocoEnTitulo, useMovimientoReducido, useTituloPantalla } from "./hooks";
export {
  PAISES_TELEFONO,
  PAIS_TELEFONO_POR_DEFECTO,
  PhoneInput,
  type PaisTelefono,
  type PhoneInputProps,
} from "./PhoneInput";
export { ProgressSteps, type PasoBarra, type ProgressStepsProps } from "./ProgressSteps";
export { SheetBottom, type SheetBottomProps } from "./SheetBottom";
export { Stepper, type StepperProps } from "./Stepper";
export { UploadArchivo, type UploadArchivoProps } from "./UploadArchivo";
