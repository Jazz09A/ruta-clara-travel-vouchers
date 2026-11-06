import type { CampoDef } from "@/lib/domain/types";
import { validarDependencias } from "@/lib/domain/form-engine";

export interface ProblemaCampo {
  campo: string;
  mensaje: string;
  nivel: "bloqueante" | "advertencia";
}

/**
 * Detecta ciclos entre condiciones de visibilidad.
 *
 * Un campo no puede depender (directamente o por cadena) de sí mismo.
 */
export function detectarCiclos(campos: CampoDef[]): CampoDef[] {
  const porId = new Map(campos.map((campo) => [campo.id, campo]));
  const enCiclo = new Set<string>();

  for (const campo of campos) {
    const vistos = new Set<string>([campo.id]);
    let actual = campo.visible_si?.campo;
    while (actual) {
      if (vistos.has(actual)) {
        enCiclo.add(campo.id);
        break;
      }
      vistos.add(actual);
      actual = porId.get(actual)?.visible_si?.campo;
    }
  }

  return campos.filter((campo) => enCiclo.has(campo.id));
}

/**
 * Validación continua de la definición del formulario.
 *
 * Reproduce las reglas del servidor (JSON Schema del formulario) para dar el
 * error **junto al campo** mientras se edita, sin esperar al guardado.
 */
export function validarDefinicion(campos: CampoDef[]): ProblemaCampo[] {
  const problemas: ProblemaCampo[] = [];
  const vistos = new Set<string>();

  for (const campo of campos) {
    if (!campo.id || campo.id.trim() === "") {
      problemas.push({
        campo: "(sin id)",
        mensaje: "Todos los campos necesitan un identificador.",
        nivel: "bloqueante",
      });
      continue;
    }

    if (vistos.has(campo.id)) {
      problemas.push({
        campo: campo.id,
        mensaje: "Hay dos campos con el mismo identificador.",
        nivel: "bloqueante",
      });
    }
    vistos.add(campo.id);

    if (!campo.label || campo.label.trim() === "") {
      problemas.push({
        campo: campo.id,
        mensaje: "El campo necesita una etiqueta.",
        nivel: "bloqueante",
      });
    }

    if ((campo.tipo === "select" || campo.tipo === "multiselect") && (campo.opciones?.length ?? 0) === 0) {
      problemas.push({
        campo: campo.id,
        mensaje: "Agrega al menos una opción.",
        nivel: "bloqueante",
      });
    }

    if (campo.tipo === "extra") {
      if (!campo.precio_usd || Number.parseFloat(campo.precio_usd) < 0) {
        problemas.push({
          campo: campo.id,
          mensaje: "El extra necesita un precio en dólares.",
          nivel: "bloqueante",
        });
      }
      if (campo.cantidad_max === undefined || campo.cantidad_max < 1) {
        problemas.push({
          campo: campo.id,
          mensaje: "El extra necesita una cantidad máxima.",
          nivel: "bloqueante",
        });
      }
    }

    if (campo.visible_si) {
      const dependencia = campos.find((otro) => otro.id === campo.visible_si?.campo);
      if (!dependencia) {
        problemas.push({
          campo: campo.id,
          mensaje: "La condición apunta a un campo que ya no existe.",
          nivel: "bloqueante",
        });
      }
    }
  }

  for (const error of validarDependencias(campos)) {
    problemas.push({ campo: error.campo, mensaje: error.mensaje, nivel: "advertencia" });
  }

  for (const campo of detectarCiclos(campos)) {
    problemas.push({
      campo: campo.id,
      mensaje: `«${campo.label}» depende de sí mismo. Quita la condición o cambia el campo del que depende.`,
      nivel: "bloqueante",
    });
  }

  return problemas;
}

export interface CambioCampo {
  id: string;
  etiqueta: string;
  cambios: string[];
}

export interface ComparacionVersiones {
  agregados: CampoDef[];
  quitados: CampoDef[];
  cambiados: CambioCampo[];
}

/** Cambios detectables entre dos versiones del mismo campo. */
export function cambiosDeCampo(base: CampoDef, nuevo: CampoDef): string[] {
  const cambios: string[] = [];
  if (base.label !== nuevo.label) cambios.push("Cambió la etiqueta");
  if (base.tipo !== nuevo.tipo) cambios.push("Cambió el tipo de pregunta");
  if (base.alcance !== nuevo.alcance) {
    cambios.push("Cambió si se responde por pasajero o por reserva");
  }
  if (base.obligatorio !== nuevo.obligatorio) {
    cambios.push(nuevo.obligatorio ? "Ahora es obligatoria" : "Ahora es opcional");
  }
  if ((base.ayuda ?? "") !== (nuevo.ayuda ?? "")) cambios.push("Cambió el texto de ayuda");
  if (JSON.stringify(base.visible_si ?? null) !== JSON.stringify(nuevo.visible_si ?? null)) {
    cambios.push("Cambió la condición de visibilidad");
  }
  if (JSON.stringify(base.opciones ?? []) !== JSON.stringify(nuevo.opciones ?? [])) {
    cambios.push("Cambiaron las opciones");
  }
  if ((base.precio_usd ?? "") !== (nuevo.precio_usd ?? "")) cambios.push("Cambió el precio");
  if ((base.cantidad_max ?? null) !== (nuevo.cantidad_max ?? null)) {
    cambios.push("Cambió la cantidad máxima");
  }
  return cambios;
}

/**
 * Comparación simple entre dos versiones (Spec 9.9).
 *
 * Devuelve los campos agregados, quitados y cambiados.
 */
export function compararVersiones(base: CampoDef[], nuevo: CampoDef[]): ComparacionVersiones {
  const porIdBase = new Map(base.map((campo) => [campo.id, campo]));
  const porIdNuevo = new Map(nuevo.map((campo) => [campo.id, campo]));

  const agregados = nuevo.filter((campo) => !porIdBase.has(campo.id));
  const quitados = base.filter((campo) => !porIdNuevo.has(campo.id));

  const cambiados: CambioCampo[] = [];
  for (const campo of nuevo) {
    const anterior = porIdBase.get(campo.id);
    if (!anterior) continue;
    const cambios = cambiosDeCampo(anterior, campo);
    if (cambios.length > 0) {
      cambiados.push({ id: campo.id, etiqueta: campo.label, cambios });
    }
  }

  return { agregados, quitados, cambiados };
}
