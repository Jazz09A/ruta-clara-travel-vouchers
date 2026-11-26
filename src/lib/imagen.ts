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

/** Opciones de `recortarImagenDataUrl`. */
export interface RecorteImagen {
  /** Luminancia máxima (0-255) para considerar un píxel «tinta». */
  umbral?: number;
  /** Píxeles oscuros mínimos en una fila/columna para que cuente. */
  minPorFila?: number;
  /** Margen en px que se deja alrededor de la tinta recortada. */
  margen?: number;
  /** Si el recorte no gana al menos este % del área, se devuelve el original. */
  gananciaMinima?: number;
}

/**
 * Recorta los márgenes en blanco de una imagen (p. ej. una firma escaneada
 * que llega con mucho papel alrededor).
 *
 * El voucher dibuja la firma con `object-fit: contain` dentro de una caja de
 * 280 × 150 px: si la imagen trae ~66% de blanco, la tinta termina ocupando
 * ~40 px y se lee diminuta. Al mandar sólo la zona con tinta, la firma llena
 * la caja (≈3× más grande en el PDF).
 *
 * Ignora el ruido del escaneo exigiendo un mínimo de píxeles oscuros por
 * fila/columna, y devuelve el original si no hay margen que ganar o si algo
 * falla (nunca rompe la subida).
 */
export async function recortarImagenDataUrl(
  dataUrl: string,
  opciones: RecorteImagen = {},
): Promise<string> {
  const { umbral = 200, minPorFila = 3, margen = 14, gananciaMinima = 0.15 } = opciones;
  try {
    const imagen = await cargarImagen(dataUrl);
    const ancho = imagen.naturalWidth || imagen.width;
    const alto = imagen.naturalHeight || imagen.height;
    if (!ancho || !alto) return dataUrl;

    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d", { willReadFrequently: true });
    if (!ctx) return dataUrl;
    ctx.drawImage(imagen, 0, 0, ancho, alto);

    const datos = ctx.getImageData(0, 0, ancho, alto).data;
    const porFila = new Uint32Array(alto);
    const porColumna = new Uint32Array(ancho);

    for (let y = 0; y < alto; y++) {
      let cuentaFila = 0;
      const base = y * ancho * 4;
      for (let x = 0; x < ancho; x++) {
        const i = base + x * 4;
        const alpha = datos[i + 3] ?? 0;
        if (alpha < 16) continue; // transparente = papel
        const luminancia =
          0.299 * (datos[i] ?? 0) + 0.587 * (datos[i + 1] ?? 0) + 0.114 * (datos[i + 2] ?? 0);
        if (luminancia <= umbral) {
          cuentaFila++;
          porColumna[x] = (porColumna[x] ?? 0) + 1;
        }
      }
      porFila[y] = cuentaFila;
    }

    const conTinta = (cuenta: number | undefined) => (cuenta ?? 0) >= minPorFila;
    let arriba = 0;
    while (arriba < alto && !conTinta(porFila[arriba])) arriba++;
    let abajo = alto - 1;
    while (abajo > arriba && !conTinta(porFila[abajo])) abajo--;
    let izquierda = 0;
    while (izquierda < ancho && !conTinta(porColumna[izquierda])) izquierda++;
    let derecha = ancho - 1;
    while (derecha > izquierda && !conTinta(porColumna[derecha])) derecha--;

    // Sin tinta reconocible (imagen totalmente blanca) o sin margen que ganar.
    if (abajo <= arriba || derecha <= izquierda) return dataUrl;
    const areaTinta = (abajo - arriba + 1) * (derecha - izquierda + 1);
    if (1 - areaTinta / (ancho * alto) < gananciaMinima) return dataUrl;

    const x = Math.max(0, izquierda - margen);
    const y = Math.max(0, arriba - margen);
    const w = Math.min(ancho - x, derecha - izquierda + 1 + margen * 2);
    const h = Math.min(alto - y, abajo - arriba + 1 + margen * 2);

    const salida = document.createElement("canvas");
    salida.width = w;
    salida.height = h;
    const ctxSalida = salida.getContext("2d");
    if (!ctxSalida) return dataUrl;
    ctxSalida.fillStyle = "#ffffff";
    ctxSalida.fillRect(0, 0, w, h);
    ctxSalida.drawImage(lienzo, x, y, w, h, 0, 0, w, h);
    return salida.toDataURL("image/png");
  } catch {
    return dataUrl;
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
