import { useRef, useState } from "react";
import { FileText, Paperclip, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

export interface UploadArchivoProps {
  id: string;
  /** Nombre del archivo ya cargado (opcional). */
  nombreArchivo?: string | undefined;
  onSeleccionar: (archivo: File) => void;
  onQuitar?: (() => void) | undefined;
  cargando?: boolean | undefined;
  error?: string | undefined;
  etiqueta?: string | undefined;
  ayuda?: string | undefined;
  /** MIME aceptados. Por defecto: imagen o PDF (Spec §5.1). */
  acepta?: string | undefined;
  /** Tamaño máximo en MB (por defecto 10). */
  maxMB?: number | undefined;
  /** Abre directamente la cámara del celular (`environment` o `user`). */
  captura?: "environment" | "user" | undefined;
  /** Miniatura del archivo ya cargado (data URL). */
  previewUrl?: string | undefined;
  className?: string | undefined;
}

const TIPOS_POR_DEFECTO = ["image/jpeg", "image/png", "application/pdf"];

/**
 * Cargador de archivos (C-12).
 *
 * El cliente valida tipo y tamaño para dar mensajes rápidos, pero la
 * validación real es del servidor (SEG-11).
 */
export function UploadArchivo({
  id,
  nombreArchivo,
  onSeleccionar,
  onQuitar,
  cargando,
  error,
  etiqueta = "Adjuntar archivo",
  ayuda,
  acepta,
  maxMB = 10,
  captura,
  previewUrl,
  className,
}: UploadArchivoProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  // `acepta` admite uno o varios MIME separados por coma.
  const tipos = acepta
    ? acepta
        .split(",")
        .map((tipo) => tipo.trim())
        .filter(Boolean)
    : TIPOS_POR_DEFECTO;

  const errorVisible = error ?? errorLocal;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="text-sm font-semibold text-foreground">{etiqueta}</p>

      {nombreArchivo ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={`Vista previa de ${nombreArchivo}`}
              className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
            />
          ) : (
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{nombreArchivo}</span>
          {onQuitar ? (
            <button
              type="button"
              onClick={onQuitar}
              aria-label={`Quitar ${nombreArchivo}`}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={tipos.join(",")}
        capture={captura}
        className="sr-only"
        aria-invalid={errorVisible ? true : undefined}
        aria-describedby={errorVisible ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined}
        onChange={(evento) => {
          // Móvil: leemos `files` antes de tocar `value`. iOS Safari y
          // Android Chrome limpian la selección si se resetea de forma
          // síncrona dentro del handler. El valor se limpia al abrir el
          // selector (ver onClick más abajo), que es lo que permite volver
          // a elegir el mismo archivo sin disparar doble evento.
          const archivo = evento.target.files?.[0];
          if (!archivo) return;
          setErrorLocal(null);

          if (!tipos.includes(archivo.type)) {
            setErrorLocal("Ese archivo no es válido. Usa una foto (JPG o PNG) o un PDF");
            return;
          }
          if (archivo.size > maxMB * 1024 * 1024) {
            setErrorLocal(`El archivo pesa demasiado. El máximo es ${maxMB} MB`);
            return;
          }
          onSeleccionar(archivo);
        }}
      />

      <button
        type="button"
        onClick={() => {
          // Re-selección: si `value` no se limpia, el navegador no dispara
          // `onChange` cuando el usuario vuelve a elegir el mismo archivo.
          // Se hace aquí (fuera del handler) para no tocar `files` en
          // el momento en que el navegador lo está leyendo.
          if (inputRef.current) inputRef.current.value = "";
          inputRef.current?.click();
        }}
        disabled={cargando}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <Paperclip className="h-4 w-4" aria-hidden="true" />
        {cargando ? "Subiendo…" : nombreArchivo ? "Cambiar archivo" : etiqueta}
      </button>

      {ayuda ? (
        <p id={`${id}-ayuda`} className="text-xs leading-relaxed text-muted-foreground">
          {ayuda}
        </p>
      ) : null}
      {errorVisible ? (
        <p id={`${id}-error`} className="text-xs font-medium leading-relaxed text-destructive">
          {errorVisible}
        </p>
      ) : null}
    </div>
  );
}
