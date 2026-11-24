import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { ArrowLeft, PenTool, Upload, X, Check, Eraser, Undo2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LienzoFirma, type LienzoFirmaRef } from "@/components/publica/firma/LienzoFirma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/configuracion/firma")({
  head: () => ({
    meta: [
      { title: "Firma de la empresa · Panel" },
      { name: "description", content: "Imagen de firma digital." },
    ],
  }),
  component: FirmaEmpresa,
});

/** Límite del PNG que viaja en base64 por el cuerpo del request (backend: 1 MB). */
const TAMANO_MAX_BYTES = 2 * 1024 * 1024;

type ViaFirma = "subir" | "firmar";

function FirmaEmpresa() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lienzoRef = useRef<LienzoFirmaRef>(null);
  const [via, setVia] = useState<ViaFirma>("subir");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [hayTrazos, setHayTrazos] = useState(false);

  const { data: datos, isLoading } = useQuery({
    queryKey: ["configuracion"],
    queryFn: () => api.admin.configuracion(),
  });

  const config = datos?.config;
  const firmaEmpresaFecha = config?.firma_empresa_fecha;
  const firmaEmpresaUrl = config?.firma_empresa_url;

  const mutationGuardar = useMutation({
    mutationFn: async (imagen_base64: string) => {
      const nombre = via === "firmar" ? "firma-empresa-canvas.png" : "firma-empresa.png";
      return api.admin.subirFirmaEmpresa({ nombre, tamano: imagen_base64.length, imagen_base64 });
    },
    onSuccess: () => {
      toast.success("Firma de la empresa actualizada");
      setPreviewUrl(null);
      setHayTrazos(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      lienzoRef.current?.limpiar();
      setVia("subir");
      queryClient.invalidateQueries({ queryKey: ["configuracion"] });
    },
    onError: () => {
      toast.error("No pudimos actualizar la firma de la empresa");
    },
  });

  const leerArchivo = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.readAsDataURL(file);
    });

  const handleFileSelect = (file: File | null) => {
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen");
      return;
    }

    // Validar tamaño: viaja en base64 por el request (~+33%)
    if (file.size > TAMANO_MAX_BYTES) {
      toast.error("La imagen no puede superar 2MB");
      return;
    }

    // Crear preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  /** Guarda: desde el archivo subido o desde el lienzo dibujado. */
  const handleGuardar = async () => {
    if (via === "firmar") {
      const out = lienzoRef.current?.exportar();
      if (!out) return;
      if (!out.ok) {
        toast.error(out.mensaje);
        return;
      }
      mutationGuardar.mutate(out.resultado.data_url);
      return;
    }
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await leerArchivo(file);
      mutationGuardar.mutate(dataUrl);
    } catch {
      toast.error("No pudimos leer la imagen");
    }
  };

  const handleCancelar = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    lienzoRef.current?.limpiar();
    setHayTrazos(false);
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <AdminShell
      titulo="Firma de la empresa"
      breadcrumb={[
        { label: "Panel", to: "/admin" },
        { label: "Configuración", to: "/admin/configuracion" },
        { label: "Firma de la empresa" },
      ]}
    >
      <div className="mx-auto w-full max-w-3xl">
        <Link
          to="/admin/configuracion"
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a configuración
        </Link>

        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            Sube una imagen o firma directamente; esta es la firma que aparecerá en los vouchers
          </p>
        </div>

        {/* Firma actual */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">Firma actual</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta es la firma que actualmente se usa en los vouchers
          </p>

          {isLoading ? (
            <div className="mt-4 h-48 animate-pulse rounded-xl bg-muted" />
          ) : firmaEmpresaUrl ? (
            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {firmaEmpresaFecha
                    ? `Actualizada el ${new Date(firmaEmpresaFecha).toLocaleDateString("es-VE")}`
                    : "Sin fecha de actualización"}
                </p>
                <Badge variant="default" className="min-h-8">
                  Activa
                </Badge>
              </div>
              <div className="flex items-center justify-center rounded-lg bg-background p-8">
                <img
                  src={firmaEmpresaUrl}
                  alt="Firma actual de la empresa"
                  loading="lazy"
                  decoding="async"
                  className="max-h-40 max-w-full object-contain"
                />
              </div>
            </div>
          ) : firmaEmpresaFecha ? (
            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Actualizada el {new Date(firmaEmpresaFecha).toLocaleDateString("es-VE")}
                </p>
                <Badge variant="default" className="min-h-8">
                  Activa
                </Badge>
              </div>
              <div className="flex items-center justify-center rounded-lg bg-background p-8">
                <div className="text-center">
                  <PenTool className="mx-auto h-16 w-16 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-2 text-sm text-muted-foreground">Firma digital de la empresa</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
              <PenTool className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
              <p className="mt-4 text-sm text-muted-foreground">
                No hay una firma de empresa configurada
              </p>
            </div>
          )}
        </div>

        {/* Nueva firma: subir o firmar */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">Nueva firma</h2>
          </div>

          {/* Selector de vía */}
          <div
            className="mt-4 inline-flex rounded-xl border border-border bg-muted/40 p-1"
            role="tablist"
            aria-label="Método para definir la firma"
          >
            <button
              type="button"
              role="tab"
              aria-selected={via === "subir"}
              onClick={() => setVia("subir")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                via === "subir"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Subir imagen
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={via === "firmar"}
              onClick={() => setVia("firmar")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                via === "firmar"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <PenTool className="h-4 w-4" aria-hidden="true" />
              Firmar aquí
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={handleInputChange}
            className="hidden"
            aria-label="Seleccionar imagen de firma"
          />

          {via === "subir" ? (
            <>
              <div
                className={`mt-6 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/30 hover:border-primary/50"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {previewUrl ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center rounded-lg bg-background p-4">
                      <img
                        src={previewUrl}
                        alt="Vista previa de la firma"
                        loading="lazy"
                        decoding="async"
                        className="max-h-48 max-w-full object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
                      <span>Imagen lista para guardar</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload
                      className="mx-auto h-12 w-12 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Arrastra una imagen aquí o
                      </p>
                      <Button
                        type="button"
                        variant="link"
                        className="p-0 text-sm"
                        onClick={handleClickUpload}
                      >
                        haz clic para seleccionar
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">PNG, JPG o JPEG (máx. 2MB)</p>
                  </div>
                )}
              </div>

              {previewUrl && (
                <div className="mt-4 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleCancelar}>
                    <X className="mr-2 h-4 w-4" aria-hidden="true" />
                    Cancelar
                  </Button>
                  <BotonCargar
                    type="button"
                    cargando={mutationGuardar.isPending}
                    onClick={() => void handleGuardar()}
                    textoCargando="Guardando..."
                  >
                    <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                    Guardar firma
                  </BotonCargar>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mt-6">
                <LienzoFirma
                  ref={lienzoRef}
                  bloqueado={mutationGuardar.isPending}
                  onCambio={(estado) => setHayTrazos(!estado.vacio)}
                />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => lienzoRef.current?.deshacer()}
                  >
                    <Undo2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    Deshacer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => lienzoRef.current?.limpiar()}
                  >
                    <Eraser className="mr-2 h-4 w-4" aria-hidden="true" />
                    Limpiar
                  </Button>
                </div>
                <BotonCargar
                  type="button"
                  cargando={mutationGuardar.isPending}
                  onClick={() => void handleGuardar()}
                  disabled={!hayTrazos}
                  textoCargando="Guardando..."
                >
                  <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                  Guardar firma
                </BotonCargar>
              </div>
            </>
          )}
        </div>

        {/* Recomendaciones */}
        <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-6">
          <h3 className="text-sm font-bold text-foreground">Recomendaciones</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>• Si subes una imagen, usa un PNG con fondo transparente para mejor integración</li>
            <li>• La resolución recomendada es de al menos 300x100 píxeles</li>
            <li>• Si firmas aquí, usa el ratón o el dedo ocupando el espacio del lienzo</li>
            <li>• Asegúrate de que la firma sea legible en tamaños pequeños</li>
            <li>• Evita imágenes con mucho ruido o artefactos de compresión</li>
          </ul>
        </div>
      </div>
    </AdminShell>
  );
}
