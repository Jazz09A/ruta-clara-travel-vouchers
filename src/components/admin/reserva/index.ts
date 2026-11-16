/**
 * Piezas reutilizables del detalle de reserva (A-07).
 */

export { CabeceraReserva, type CabeceraReservaProps } from "./CabeceraReserva";
export {
  ProgresoReserva,
  calcularPasos,
  TEXTO_ESTADO_PASO,
  type ProgresoReservaProps,
} from "./ProgresoReserva";
export { PanelPasajeros, type PanelPasajerosProps } from "./PanelPasajeros";
export {
  TarjetaPasajero,
  type CampoRevelable,
  type SeleccionMostrada,
  type TarjetaPasajeroProps,
} from "./TarjetaPasajero";
export { PanelPagosReserva, type PanelPagosReservaProps } from "./PanelPagosReserva";
export { PanelFirma, type PanelFirmaProps } from "./PanelFirma";
export { PanelVoucher, type PanelVoucherProps } from "./PanelVoucher";
export {
  LineaTiempoReserva,
  humanizarAccion,
  type LineaTiempoReservaProps,
} from "./LineaTiempoReserva";
export { PanelNotas, type PanelNotasProps } from "./PanelNotas";
export { DialogoMotivo, type DialogoMotivoProps } from "./DialogoMotivo";
export { DialogoRevelarDato, type DialogoRevelarDatoProps } from "./DialogoRevelarDato";
export {
  DialogoCancelarReserva,
  type DatosCancelacion,
  type DialogoCancelarReservaProps,
  type OrigenCancelacion,
  type SimulacionCancelacion,
} from "./DialogoCancelarReserva";
export {
  DialogoReprogramar,
  type DatosReprogramar,
  type DialogoReprogramarProps,
} from "./DialogoReprogramar";
export {
  DialogoEditarDatos,
  type CampoEditable,
  type DatosEdicion,
  type DialogoEditarDatosProps,
} from "./DialogoEditarDatos";
export {
  DialogoPagoEfectivo,
  type DatosPagoEfectivo,
  type DialogoPagoEfectivoProps,
} from "./DialogoPagoEfectivo";
export {
  DialogoRegistrarPago,
  type DatosPagoReserva,
  type DialogoRegistrarPagoProps,
} from "./DialogoRegistrarPago";
export {
  DialogoReembolso,
  type DatosReembolso,
  type DialogoReembolsoProps,
} from "./DialogoReembolso";
export {
  DialogoExtenderHold,
  MAX_HORAS_HOLD,
  type DatosExtenderHold,
  type DialogoExtenderHoldProps,
} from "./DialogoExtenderHold";
export { useReveloTemporal, type ControlRevelo, type DatoRevelado } from "./use-revelo-temporal";
export {
  EditorPrecio,
  type DatosPrecio as DatosEditorPrecio,
  type EditorPrecioProps,
} from "./EditorPrecio";
export { PanelPrecio, type DatosPrecio, type PanelPrecioProps } from "./PanelPrecio";
