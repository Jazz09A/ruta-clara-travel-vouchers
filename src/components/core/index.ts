/**
 * `ui-core` — biblioteca de componentes compartidos por la app publica y el
 * panel admin (Spec 2.1 · FD-02).
 *
 * Todo lo que se exporta aqui es **agnostico del dominio**: recibe datos por
 * props y no hace peticiones. Las pantallas de cada app deciden cuando y con
 * que datos usar cada componente.
 */

export { ActionBar, type ActionBarProps } from "./ActionBar";
export { BadgeEstado, resolverEstado, type BadgeEstadoProps, type TipoEstado } from "./BadgeEstado";
export { Banner, type BannerProps, type VarianteBanner } from "./Banner";
export { BirthDateInput, diasDelMes, type BirthDateInputProps } from "./BirthDateInput";
export {
  BotonCargar,
  type BotonCargarProps,
} from "./BotonCargar";
export { BotonCopiar, type BotonCopiarProps } from "./BotonCopiar";
export { BotonWhatsApp, type BotonWhatsAppProps } from "./BotonWhatsApp";
export {
  ContadorRegresivo,
  type ContadorRegresivoProps,
} from "./ContadorRegresivo";
export {
  DesglosePrecios,
  type DesglosePreciosProps,
} from "./DesglosePrecios";
export { DialogoConfirmacion, type DialogoConfirmacionProps, type MotivoDialogo } from "./DialogoConfirmacion";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { ErrorState, type ErrorStateProps } from "./ErrorState";
export { EstadoConexion, type EstadoConexionProps } from "./EstadoConexion";
export { Field, type FieldProps } from "./Field";
export { InputOTP, type InputOTPProps } from "./InputOTP";
export {
  PhoneInput,
  detectarPais,
  PAISES_TELEFONO,
  type PaisTelefono,
  type PhoneInputProps,
} from "./PhoneInput";
export { ProgressSteps, type ProgressStepsProps, type PasoBarra } from "./ProgressSteps";
export { SheetBottom, type SheetBottomProps } from "./SheetBottom";
export { Stepper, type StepperProps } from "./Stepper";
export {
  UploadArchivo,
  type ArchivoPreparado,
  type UploadArchivoProps,
} from "./UploadArchivo";
