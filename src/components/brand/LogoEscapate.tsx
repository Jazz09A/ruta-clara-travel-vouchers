/**
 * Logo de Escapate Tours. La imagen vive en `public/logo-escapate.png`
 * (optimizada a 512 px) y se sirve en `/logo-escapate.png`.
 */
export interface LogoEscapateProps {
  /** Lado mayor en px (el PNG es 512×487, casi cuadrado). */
  tamano?: number;
  className?: string;
}

export function LogoEscapate({ tamano = 48, className }: LogoEscapateProps) {
  return (
    <img
      src="/logo-escapate.png"
      alt="Escapate Tours"
      width={tamano}
      height={Math.round((tamano * 487) / 512)}
      className={className}
      decoding="async"
      draggable={false}
    />
  );
}
