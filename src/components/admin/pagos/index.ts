/**
 * Piezas reutilizables de la cola y la revisión de pagos (A-08 / A-09).
 */

export { BadgePago, type BadgePagoProps } from "./BadgePago";
export {
  DiferenciaMonto,
  calcularDiferencia,
  formatearMonto,
  type DiferenciaMontoProps,
  type OpcionesDiferencia,
  type ResultadoDiferencia,
} from "./DiferenciaMonto";
export {
  CatalogoMotivos,
  VistaPreviaMensaje,
  MOTIVOS_RECHAZO,
  etiquetaMotivo,
  mensajeParaCliente,
  type CodigoMotivoRechazo,
  type CatalogoMotivosProps,
  type VistaPreviaMensajeProps,
} from "./CatalogoMotivos";
export { VisorComprobante, type VisorComprobanteProps } from "./VisorComprobante";
export { FilaPagoCola, type FilaPagoColaProps } from "./FilaPagoCola";
export {
  DialogoAprobarPago,
  type DatosAprobacion,
  type DialogoAprobarPagoProps,
  type PagoDuplicado,
} from "./DialogoAprobarPago";
export {
  DialogoRechazarPago,
  type DatosRechazo,
  type DialogoRechazarPagoProps,
} from "./DialogoRechazarPago";
export {
  DialogoCorreccionPago,
  type DatosCorreccion,
  type DialogoCorreccionPagoProps,
} from "./DialogoCorreccionPago";
