import * as React from "react";
import { Camera, FileText, RefreshCw, TriangleAlert, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/** Archivo listo para enviarse al servidor. */
export interface ArchivoPreparado {
  nombre: string;
  tipo: string;
  tamano: number;
  /** Miniatura (imagenes) o vista previa. */
  preview?: string | undefined;
  /** Contenido en base64 (solo imagenes comprimidas). */
  base64?: string | undefined;
}

export interface UploadArchivoProps {
  /** Se llama cuando el archivo queda listo para enviarse. */
  onArchivo?: ((archivo: ArchivoPreparado) => void | Promise<void>) | undefined;
  /** Error del servidor, mostrado bajo el bloque. */
  error?: string | undefined;
  /** Tipos aceptados. Por defecto imagenes y PDF. */
  accept?: string | undefined;
  /** Titulo del bloque. */
  label?: string | undefined;
  /** Tamano maximo en MB. Por defecto 10. */
  maximoMb?: number | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
}

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "application/pdf"];
const ACCEPT_POR_DEFECTO = "image/jpeg,image/png,application/pdf";
const LADO_MAXIMO = 2000;
const CALIDAD_INICIAL = 0.8;

type Estado = "inactivo" | "procesando" | "listo" | "error";

function pesoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * C-12 · Cargador de archivos.
 *
 * Camara o galeria, validacion de tipo y tamano, compresion en el dispositivo
 * de las imagenes (lado largo <= 2000 px, calidad 0,8) hasta quedar bajo el
 * limite, vista previa, progreso, cancelar y reintento (Spec 5.1).
 */
export function UploadArchivo({
  onArchivo,
  error,
  accept = ACCEPT_POR_DEFECTO,
  label = "Comprobante",
  maximoMb = 10,
  disabled = false,
  className,
}: UploadArchivoProps) {
  const [estado, setEstado] = React.useState<Estado>("inactivo");
  const [progreso, setProgreso] = React.useState(0);
  const [errorLocal, setErrorLocal] = React.useState<string | null>(null);
  const [archivo, setArchivo] = React.useState<ArchivoPreparado | null>(null);
  const [paginasPdf, setPaginasPdf] = React.useState<number | null>(null);

  const refEntradaCamara = React.useRef<HTMLInputElement>(null);
  const refEntradaArchivo = React.useRef<HTMLInputElement>(null);
  const refCancelado = React.useRef(false);
  const refUltimoArchivo = React.useRef<File | null>(null);

  const maximoBytes = maximoMb * 1024 * 1024;

  React.useEffect(
    () => () => {
      refCancelado.current = true;
    },
    [],
  );

  const procesar = React.useCallback(
    async (file: File) => {
      refCancelado.current = false;
      refUltimoArchivo.current = file;
      setErrorLocal(null);
      setEstado("procesando");
      setProgreso(10);

      // 1. Tipo de archivo.
      if (!TIPOS_PERMITIDOS.includes(file.type)) {
        setEstado("error");
        setErrorLocal("Ese archivo no es valido. Usa una foto (JPG o PNG) o un PDF.");
        setProgreso(0);
        return;
      }

      // 2. Tamano.
      if (file.size > maximoBytes) {
        setEstado("error");
        setErrorLocal(
          `El archivo pesa demasiado (${pesoLegible(file.size)}). El limite es ${maximoMb} MB.`,
        );
        setProgreso(0);
        return;
      }

      setProgreso(35);

      try {
        let preparado: ArchivoPreparado;

        if (file.type === "application/pdf") {
          setProgreso(60);
          const paginas = await contarPaginasPdf(file);
          if (refCancelado.current) return;
          setPaginasPdf(paginas);
          preparado = {
            nombre: file.name,
            tipo: file.type,
            tamano: file.size,
          };
        } else {
          setProgreso(60);
          const comprimida = await comprimirImagen(file, maximoBytes);
          if (refCancelado.current) return;
          if (!comprimida) {
            setEstado("error");
            setErrorLocal(
              "No pudimos procesar esa imagen. Prueba con otra foto o toma la foto de nuevo.",
            );
            setProgreso(0);
            return;
          }
          preparado = {
            nombre: file.name,
            tipo: file.type,
            tamano: comprimida.tamano,
            preview: comprimida.base64,
            base64: comprimida.base64,
          };
        }

        if (refCancelado.current) return;

        setProgreso(90);
        await onArchivo?.(preparado);
        if (refCancelado.current) return;

        setArchivo(preparado);
        setProgreso(100);
        setEstado("listo");
      } catch {
        if (refCancelado.current) return;
        setEstado("error");
        setErrorLocal("No pudimos procesar el archivo. Reintenta.");
        setProgreso(0);
      }
    },
    [maximoBytes, maximoMb, onArchivo],
  );

  const alSeleccionar = React.useCallback(
    (evento: React.ChangeEvent<HTMLInputElement>) => {
      const file = evento.target.files?.[0];
      evento.target.value = "";
      if (file) void procesar(file);
    },
    [procesar],
  );

  const cancelar = React.useCallback(() => {
    refCancelado.current = true;
    setEstado("inactivo");
    setProgreso(0);
    setErrorLocal(null);
  }, []);

  const reintentar = React.useCallback(() => {
    const file = refUltimoArchivo.current;
    if (file) void procesar(file);
  }, [procesar]);

  const quitar = React.useCallback(() => {
    refCancelado.current = true;
    refUltimoArchivo.current = null;
    setArchivo(null);
    setPaginasPdf(null);
    setEstado("inactivo");
    setProgreso(0);
    setErrorLocal(null);
  }, []);

  const mensajeError = errorLocal ?? error;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-sm font-medium text-foreground">{label}</p>

      {estado === "listo" && archivo ? (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
          {archivo.preview ? (
            <img
              src={archivo.preview}
              alt={`Vista previa de ${archivo.nombre}`}
              className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-border bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{archivo.nombre}</p>
            <p className="text-xs text-muted-foreground">
              {pesoLegible(archivo.tamano)}
              {paginasPdf && paginasPdf > 1 ? ` · ${paginasPdf} paginas` : ""}
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={quitar}
            className="min-h-11 shrink-0"
          >
            <X aria-hidden="true" />
            <span>Quitar</span>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border bg-card p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => refEntradaCamara.current?.click()}
              disabled={disabled || estado === "procesando"}
              className="min-h-11 flex-1"
            >
              <Camera aria-hidden="true" />
              <span>Tomar foto</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => refEntradaArchivo.current?.click()}
              disabled={disabled || estado === "procesando"}
              className="min-h-11 flex-1"
            >
              <Upload aria-hidden="true" />
              <span>Elegir archivo</span>
            </Button>
          </div>

          <p className="text-xs leading-snug text-muted-foreground">
            JPG, PNG o PDF de hasta {maximoMb} MB. Las fotos se comprimen en tu telefono antes de
            enviarse.
          </p>

          {estado === "procesando" ? (
            <div className="flex flex-col gap-2">
              <Progress value={progreso} aria-label="Progreso del archivo" />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {progreso < 60 ? "Preparando el archivo…" : "Comprimiendo la imagen…"}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={cancelar}
                  className="min-h-9"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}

          {estado === "error" ? (
            <div className="flex flex-col gap-2">
              <p className="flex items-start gap-1.5 text-xs leading-snug text-red-700 dark:text-red-300">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{mensajeError}</span>
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={reintentar}
                className="min-h-11 self-start"
              >
                <RefreshCw aria-hidden="true" />
                <span>Reintentar</span>
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {error && estado !== "error" ? (
        <p className="flex items-start gap-1.5 text-xs leading-snug text-red-700 dark:text-red-300">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}

      <input
        ref={refEntradaCamara}
        type="file"
        accept={accept}
        capture="environment"
        onChange={alSeleccionar}
        className="sr-only"
        aria-label="Tomar una foto con la camara"
      />
      <input
        ref={refEntradaArchivo}
        type="file"
        accept={accept}
        onChange={alSeleccionar}
        className="sr-only"
        aria-label="Elegir un archivo"
      />

      </div>
  );
}

/**
 * Comprime una imagen en el dispositivo: lado largo <= 2000 px y calidad 0,8,
 * bajando la calidad hasta quedar bajo el limite de tamano.
 */
async function comprimirImagen(
  file: File,
  maximoBytes: number,
): Promise<{ base64: string; tamano: number } | null> {
  const url = URL.createObjectURL(file);

  try {
    const imagen = await cargarImagen(url);
    if (!imagen) return null;

    const ladoMayor = Math.max(imagen.width, imagen.height);
    const escala = ladoMayor > LADO_MAXIMO ? LADO_MAXIMO / ladoMayor : 1;
    const ancho = Math.max(1, Math.round(imagen.width * escala));
    const alto = Math.max(1, Math.round(imagen.height * escala));

    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;

    const contexto = lienzo.getContext("2d");
    if (!contexto) return null;
    contexto.drawImage(imagen, 0, 0, ancho, alto);

    let calidad = CALIDAD_INICIAL;
    let blob: Blob | null = await exportar(lienzo, calidad);

    while (blob && blob.size > maximoBytes && calidad > 0.4) {
      calidad -= 0.1;
      blob = await exportar(lienzo, calidad);
    }

    // Si sigue pesando de mas, se reduce el tamano a la mitad y se reintenta.
    while (blob && blob.size > maximoBytes && ancho > 600) {
      const nuevoAncho = Math.round(ancho / 2);
      const nuevoAlto = Math.round(alto / 2);
      lienzo.width = nuevoAncho;
      lienzo.height = nuevoAlto;
      const contextoNuevo = lienzo.getContext("2d");
      if (!contextoNuevo) break;
      contextoNuevo.drawImage(imagen, 0, 0, nuevoAncho, nuevoAlto);
      blob = await exportar(lienzo, calidad);
    }

    if (!blob) return null;

    const base64 = await leerComoBase64(blob);
    return { base64, tamano: blob.size };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function cargarImagen(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolver) => {
    const imagen = new Image();
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => resolver(null);
    imagen.src = url;
  });
}

function exportar(lienzo: HTMLCanvasElement, calidad: number): Promise<Blob | null> {
  return new Promise((resolver) => {
    lienzo.toBlob(
      (blob) => resolver(blob),
      "image/jpeg",
      calidad,
    );
  });
}

function leerComoBase64(blob: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result ?? ""));
    lector.onerror = () => rechazar(new Error("No se pudo leer el archivo"));
    lector.readAsDataURL(blob);
  });
}

/** Cuenta aproximada de paginas de un PDF (busqueda de `/Type /Page`). */
async function contarPaginasPdf(file: File): Promise<number | null> {
  try {
    const buffer = await file.arrayBuffer();
    const texto = new TextDecoder("latin1").decode(buffer);
    const coincidencias = texto.match(/\/Type\s*\/Page[^s]/g);
    if (!coincidencias || coincidencias.length === 0) return null;
    return coincidencias.length;
  } catch {
    return null;
  }
}
