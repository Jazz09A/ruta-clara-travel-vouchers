/**
 * Compara las props de un componente entre dos carpetas para decidir si el
 * duplicado local puede convertirse en un re-export del kit canónico.
 *
 * Uso:  bun scripts/comparar-props.ts <carpetaA> <carpetaB>
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error("Uso: bun scripts/comparar-props.ts <carpetaA> <carpetaB>");
  process.exit(1);
}

function propsDe(archivo: string): string[] {
  const fuente = readFileSync(archivo, "utf8");
  const props: string[] = [];
  const re = /export interface \w*Props[^{]*\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fuente)) !== null) {
    for (const linea of m[1].split("\n")) {
      const limpio = linea.replace(/\/\*[\s\S]*?\*\//g, "").trim();
      if (!limpio || limpio.startsWith("//") || limpio.startsWith("/*")) continue;
      props.push(limpio);
    }
  }
  return props;
}

function nombresDe(props: string[]): Set<string> {
  const nombres = new Set<string>();
  for (const p of props) {
    const m = p.match(/^(\w+)\??\s*:/);
    if (m && m[1]) nombres.add(m[1]);
  }
  return nombres;
}

const archivosA = readdirSync(a).filter((f) => f.endsWith(".tsx"));
const archivosB = new Set(readdirSync(b).filter((f) => f.endsWith(".tsx")));

for (const archivo of archivosA) {
  const nombre = archivo.replace(/\.tsx$/, "");
  if (!archivosB.has(archivo)) continue;
  const pa = propsDe(join(a, archivo));
  const pb = propsDe(join(b, archivo));
  if (pa.length === 0 || pb.length === 0) {
    console.log(`= ${nombre}: sin interfaz de props comparable`);
    continue;
  }
  const na = nombresDe(pa);
  const nb = nombresDe(pb);
  const soloA = [...na].filter((x) => !nb.has(x));
  const soloB = [...nb].filter((x) => !na.has(x));
  if (soloA.length === 0 && soloB.length === 0) {
    console.log(`= ${nombre}: props compatibles`);
  } else {
    console.log(`~ ${nombre}: solo en ${a}=[${soloA.join(", ")}] solo en ${b}=[${soloB.join(", ")}]`);
  }
}
