import { cn } from "@/lib/utils";

export interface EncabezadoProps {
  /** Texto de apoyo bajo el título del panel. */
  descripcion?: React.ReactNode;
  /** Acciones a la derecha (solo escritorio; en móvil van debajo). */
  acciones?: React.ReactNode;
  className?: string | undefined;
}

/**
 * Encabezado de pantalla.
 *
 * El `<h1>` único de la pantalla lo renderiza `CabeceraAdmin` (dentro de
 * `AdminShell`, Spec 3.9); `Encabezado` añade la descripción de apoyo y las
 * acciones de la cabecera, sin repetir el título.
 */
export function Encabezado({ descripcion, acciones, className }: EncabezadoProps) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between",
        className,
      )}
    >
      {descripcion ? (
        <div className="text-sm leading-relaxed text-muted-foreground">{descripcion}</div>
      ) : null}
      {acciones ? <div className="flex flex-wrap gap-2">{acciones}</div> : null}
    </div>
  );
}
