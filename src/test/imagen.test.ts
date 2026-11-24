import { describe, expect, it } from "vitest";

import {
  generarPreview,
  leerComoDataUrl,
  MAX_FOTO_DOCUMENTO_MB,
  prepararFotoDocumento,
} from "@/lib/imagen";

/**
 * `imagen.ts` en jsdom: FileReader funciona, pero no hay decodificación de
 * imágenes (sin paquete canvas), así que sólo se cubren las rutas que no
 * cargan un <img>: archivos no-imagen y la lectura data URL.
 */

const PDF = new File(["%PDF-1.4 fake"], "documento.pdf", { type: "application/pdf" });
const TXT = new File(["hola"], "nota.txt", { type: "text/plain" });

describe("leerComoDataUrl", () => {
  it("lee un archivo como data URL con su MIME", async () => {
    const dataUrl = await leerComoDataUrl(PDF);
    expect(dataUrl).toMatch(/^data:application\/pdf;base64,/);
  });

  it("un archivo vacío sigue produciendo un data URL válido", async () => {
    const vacio = new File([], "vacio.bin", { type: "application/octet-stream" });
    const dataUrl = await leerComoDataUrl(vacio);
    expect(dataUrl).toMatch(/^data:application\/octet-stream;base64,/);
  });
});

describe("generarPreview — archivos que no son imagen", () => {
  it("devuelve cadena vacía sin tocar canvas ni Image", async () => {
    await expect(generarPreview(PDF)).resolves.toBe("");
    await expect(generarPreview(TXT)).resolves.toBe("");
  });

  it("un File sin tipo también devuelve vacío", async () => {
    const sinTipo = new File(["x"], "raro", { type: "" });
    await expect(generarPreview(sinTipo)).resolves.toBe("");
  });
});

describe("prepararFotoDocumento — archivos que no son imagen", () => {
  it("un PDF viaja tal cual: data URL, tipo y nombre intactos", async () => {
    const foto = await prepararFotoDocumento(PDF);
    expect(foto.tipo).toBe("application/pdf");
    expect(foto.nombre).toBe("documento.pdf");
    expect(foto.data).toMatch(/^data:application\/pdf;base64,/);
  });

  it("cualquier tipo no-image se preserva sin recomprimir", async () => {
    const foto = await prepararFotoDocumento(TXT);
    expect(foto.tipo).toBe("text/plain");
    expect(foto.nombre).toBe("nota.txt");
    expect(foto.data).toContain("aG9sYQ=="); // "hola" en base64
  });
});

describe("constantes", () => {
  it("el límite de foto coincide con la política del servidor (5 MB)", () => {
    expect(MAX_FOTO_DOCUMENTO_MB).toBe(5);
  });
});
