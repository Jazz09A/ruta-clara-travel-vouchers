/**
 * Redirige las escrituras de nitro dentro de `node_modules/.nitro/` (el
 * "well-known dir" donde nitro guarda `last-build.json` y `nitro.dev.json`).
 *
 * En este equipo `node_modules` no es escribible (ACL de otro usuario) y
 * nitro escribe ahí al terminar `vite build`, lo que rompía el build con
 * `EACCES` en el último paso (los artefactos ya estaban completos). El
 * parche sólo interviene si la escritura original falla con `EACCES` o
 * `ENOENT` en esa ruta: con un `node_modules` escribible el comportamiento
 * no cambia. Las lecturas de ese archivo ya degradan dentro de nitro a
 * `.output/` (su fallback), así que nada más depende de la ruta original.
 *
 * Debe importarse ANTES que el wrapper de Vite (es el primer import de
 * `vite.config.ts`) para que nitro capture las funciones ya parcheadas.
 */
import fs from "node:fs";
import path from "node:path";

const MARCA = `${path.sep}node_modules${path.sep}.nitro`;
const DESTINO = path.join(process.cwd(), ".nitro-build", "wellknown");

const esRutaWellknown = (valor) => typeof valor === "string" && valor.includes(MARCA);

const redirigir = (valor) => {
  const inicio = valor.indexOf(MARCA);
  return path.join(DESTINO, valor.slice(inicio + MARCA.length));
};

const promesas = fs.promises;

if (!promesas.__nitroWellknownRedirigido) {
  const mkdirOriginal = promesas.mkdir;
  const writeFileOriginal = promesas.writeFile;

  promesas.mkdir = async (directorio, opciones) => {
    if (!esRutaWellknown(directorio)) return mkdirOriginal(directorio, opciones);
    try {
      return await mkdirOriginal(directorio, opciones);
    } catch (error) {
      if (error?.code !== "EACCES") throw error;
      return mkdirOriginal(redirigir(directorio), { ...opciones, recursive: true });
    }
  };

  promesas.writeFile = async (archivo, datos, opciones) => {
    if (!esRutaWellknown(archivo)) return writeFileOriginal(archivo, datos, opciones);
    try {
      return await writeFileOriginal(archivo, datos, opciones);
    } catch (error) {
      if (error?.code !== "EACCES" && error?.code !== "ENOENT") throw error;
      const destino = redirigir(archivo);
      await mkdirOriginal(path.dirname(destino), { recursive: true });
      return writeFileOriginal(destino, datos, opciones);
    }
  };

  Object.defineProperty(promesas, "__nitroWellknownRedirigido", { value: true });
}
