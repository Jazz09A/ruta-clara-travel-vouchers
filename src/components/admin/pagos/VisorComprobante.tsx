import * as React from "react";
import {
  FileText,
  ImageIcon,
  Maximize2,
  Minimize2,
  RefreshCw,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { mensajeDeError } from "@/components/admin/ui/utilidades";

/**
 * C-13 · Visor de comprobante (admin).
 *
 * - El archivo se pide por **URL firmada de 5 minutos**; si caduca mientras se
 *   mira, el visor la renueva solo (Spec §9.7).
 * - Las imágenes admiten zoom, giro y pantalla completa.
 * - Los PDF se muestran con paginación y **no** se incrustan con `<iframe>`
 *   (SEG-12): se abren por su URL firmada.
 */

/** Vigencia de la URL firmada del comprobante. */
const VIGENCIA_URL_MS = 5 * 60 * 1000;

export interface VisorComprobanteProps {
  /** Id del pago: se usa para pedir la URL firmada. */
  pagoId: string;
  /** Datos del comprobante reportados por el cliente. */
  comprobante:
    | {
        nombre: string;
        tipo: string;
        tamano: number;
        preview?: string | undefined;
      }
    | undefined;
  /** Número de páginas del PDF (1 en imágenes). */
  totalPaginas?: number | undefined;
  className?: string | undefined;
}

function formatearTamano(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Sin tamaño conocido";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VisorComprobante({
  pagoId,
  comprobante,
  totalPaginas = 1,
  className,
}: VisorComprobanteProps) {
  const [urlFirmada, setUrlFirmada] = React.useState<string | null>(null);
  const [expiraEn, setExpiraEn] = React.useState<number | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [segundosRestantes, setSegundosRestantes] = React.useState<number | null>(null);

  const [zoom, setZoom] = React.useState(1);
  const [rotacion, setRotacion] = React.useState(0);
  const [pantallaCompleta, setPantallaCompleta] = React.useState(false);
  const [pagina, setPagina] = React.useState(1);
  const [falloImagen, setFalloImagen] = React.useState(false);

  const esPdf = (comprobante?.tipo ?? "").includes("pdf");
  const esImagen = !esPdf && (comprobante?.tipo ?? "").startsWith("image/");
  const tieneVistaPrevia = Boolean(comprobante?.preview);

  const pedirUrlFirmada = React.useCallback(async () => {
    setCargando(true);
    try {
      const pago = await api.admin.pago(pagoId);
      setUrlFirmada(pago.comprobante_url ?? null);
      setExpiraEn(Date.now() + VIGENCIA_URL_MS);
      setError(null);
    } catch (fallo) {
      setError(mensajeDeError(fallo, "No pudimos pedir el comprobante. Reintenta."));
    } finally {
      setCargando(false);
    }
  }, [pagoId]);

  React.useEffect(() => {
    void pedirUrlFirmada();
  }, [pedirUrlFirmada]);

  // Renovación automática: cuando el enlace está por caducar se pide uno nuevo.
  React.useEffect(() => {
    const id = window.setInterval(() => {
      if (expiraEn !== null && Date.now() >= expiraEn - 30_000) {
        void pedirUrlFirmada();
      }
    }, 15_000);
    return () => window.clearInterval(id);
  }, [expiraEn, pedirUrlFirmada]);

  // Cuenta atrás de la URL firmada.
  React.useEffect(() => {
    if (expiraEn === null) {
      setSegundosRestantes(null);
      return;
    }
    const actualizar = () => {
      setSegundosRestantes(Math.max(0, Math.round((expiraEn - Date.now()) / 1000)));
    };
    actualizar();
    const id = window.setInterval(actualizar, 1000);
    return () => window.clearInterval(id);
  }, [expiraEn]);

  const contador =
    segundosRestantes === null
      ? "—"
      : segundosRestantes >= 60
        ? `${Math.floor(segundosRestantes / 60)} min ${segundosRestantes % 60} s`
        : `${segundosRestantes} s`;

  const panel = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {esPdf ? (
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="truncate text-sm font-semibold text-foreground">
            {comprobante?.nombre ?? "Sin comprobante adjunto"}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          {`${formatearTamano(comprobante?.tamano ?? 0)} · enlace firmado ${contador}`}
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900"
        >
          <p>{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 min-h-11"
            onClick={() => {
              void pedirUrlFirmada();
            }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </Button>
        </div>
      ) : null}

      <div className="relative flex min-h-56 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/60 p-3">
        {esImagen && tieneVistaPrevia && !falloImagen ? (
          <img
            src={comprobante?.preview}
            alt={`Comprobante del pago: ${comprobante?.nombre ?? "imagen"}`}
            onError={() => setFalloImagen(true)}
            className="max-h-[420px] w-auto max-w-full object-contain"
            style={{ transform: `scale(${zoom}) rotate(${rotacion}deg)` }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">
              {esPdf ? "Documento PDF" : "Imagen del comprobante"}
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              {cargando
                ? "Pidiendo el enlace firmado del comprobante…"
                : "La vista previa no está disponible en esta demostración. Abre el archivo para revisarlo."}
            </p>
            {urlFirmada ? (
              <a
                href={urlFirmada}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Abrir comprobante
              </a>
            ) : null}
          </div>
        )}
      </div>

      {esImagen ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => setZoom((valor) => Math.max(0.5, Number((valor - 0.25).toFixed(2))))}
          >
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
            <span>Reducir</span>
          </Button>
          <span className="min-w-14 text-center text-sm font-semibold tabular-nums text-foreground">
            {`${Math.round(zoom * 100)}%`}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => setZoom((valor) => Math.min(3, Number((valor + 0.25).toFixed(2))))}
          >
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
            <span>Acercar</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => setRotacion((valor) => (valor + 90) % 360)}
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            <span>Girar</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => setPantallaCompleta((valor) => !valor)}
          >
            {pantallaCompleta ? (
              <Minimize2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{pantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}</span>
          </Button>
        </div>
      ) : null}

      {esPdf && totalPaginas > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={pagina <= 1}
            onClick={() => setPagina((valor) => Math.max(1, valor - 1))}
          >
            <span>Página anterior</span>
          </Button>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {`Página ${pagina} de ${totalPaginas}`}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((valor) => Math.min(totalPaginas, valor + 1))}
          >
            <span>Página siguiente</span>
          </Button>
        </div>
      ) : null}

      {esPdf ? (
        <p className="text-xs text-muted-foreground">
          El PDF se abre por su enlace firmado (no se incrusta en la página). La descarga queda
          registrada en la auditoría.
        </p>
      ) : null}
    </div>
  );

  return (
    <section
      aria-label="Comprobante del pago"
      className={cn(
        "rounded-2xl border border-border bg-card p-4",
        pantallaCompleta && "fixed inset-0 z-50 m-0 flex flex-col overflow-y-auto rounded-none p-4",
        className,
      )}
    >
      {panel}
    </section>
  );
}
