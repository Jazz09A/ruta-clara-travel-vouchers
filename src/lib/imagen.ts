import type { FotoDocumento } from "@/lib/domain/types";

/**
 * Utilidades de imagen compartidas por el formulario público.
 *
 * - `generarPreview`: miniatura para mostrar en pantalla (480 px).
 * - `prepararFotoDocumento`: comprime la foto del documento a un tamaño
 *   que el servidor acepta (≤ 5 MB) sin perder legibilidad (1600 px).
 */

/** Límite del servidor para la foto del documento (política). */
export const MAX_FOTO_DOCUMENTO_MB = 5;

/** Lee un archivo como data URL. */
export function leerComoDataUrl(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result ?? ""));
    lector.onerror = () => rechazar(new Error("No se pudo leer el archivo"));
    lector.readAsDataURL(archivo);
  });
}

/** Carga una imagen desde un data URL. */
export function cargarImagen(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image();
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => rechazar(new Error("No se pudo cargar la imagen"));
    imagen.src = dataUrl;
  });
}

/** Miniatura en JPEG para previsualización en pantalla. */
export async function generarPreview(archivo: File): Promise<string> {
  if (!archivo.type.startsWith("image/")) return "";
  try {
    const dataUrl = await leerComoDataUrl(archivo);
    const imagen = await cargarImagen(dataUrl);
    const maximo = 480;
    const escala = Math.min(1, maximo / Math.max(imagen.width, imagen.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.max(1, Math.round(imagen.width * escala));
    lienzo.height = Math.max(1, Math.round(imagen.height * escala));
    const ctx = lienzo.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    return lienzo.toDataURL("image/jpeg", 0.7);
  } catch {
    return "";
  }
}

/**
 * Prepara la foto del documento para enviarla: las imágenes se escalan a
 * como máximo 1600 px y se reencodan en JPEG (fondo blanco para que las
 * zonas transparentes no salgan negras); los PDFs van tal cual.
 */
export async function prepararFotoDocumento(archivo: File): Promise<FotoDocumento> {
  if (!archivo.type.startsWith("image/")) {
    return { data: await leerComoDataUrl(archivo), tipo: archivo.type, nombre: archivo.name };
  }
  const dataUrl = await leerComoDataUrl(archivo);
  const imagen = await cargarImagen(dataUrl);
  const maximo = 1600;
  const escala = Math.min(1, maximo / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.max(1, Math.round(imagen.width * escala));
  lienzo.height = Math.max(1, Math.round(imagen.height * escala));
  const ctx = lienzo.getContext("2d");
  if (!ctx) return { data: dataUrl, tipo: archivo.type, nombre: archivo.name };
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  return {
    data: lienzo.toDataURL("image/jpeg", 0.8),
    tipo: "image/jpeg",
    nombre: archivo.name.replace(/\.[^.]+$/, "") + ".jpg",
  };
}
