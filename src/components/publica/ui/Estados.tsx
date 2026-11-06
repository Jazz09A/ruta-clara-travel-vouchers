/**
 * Reexporta los estados de pantalla vacía y de error para mantener un único
 * punto de entrada en `src/components/publica/ui/index.ts`.
 */
export { ErrorState, type ErrorStateProps } from "./ErrorState";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { EstadoBloqueante, type EstadoBloqueanteProps } from "../screens/EstadoBloqueante";
