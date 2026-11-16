/**
 * Pantallas de estado bloqueante reutilizables.
 *
 * P-10 (enlace vencido) y P-11 (enlace inválido) envuelven la plantilla
 * `EstadoBloqueante` con el copy de la Spec §5. P-12 (reserva cerrada) y
 * P-13 (voucher) los prepara otro agente sobre la misma plantilla.
 */
export { EstadoBloqueante } from "../EstadoBloqueante";
export type { EstadoBloqueanteProps, TonoEstadoBloqueante } from "../EstadoBloqueante";
export { EnlaceInvalido, type EnlaceInvalidoProps } from "./EnlaceInvalido";
export { EnlaceVencido, type EnlaceVencidoProps } from "./EnlaceVencido";
