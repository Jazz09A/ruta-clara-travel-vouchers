import type { CampoDef } from "@/lib/domain/types";

/**
 * Genera un identificador de campo a partir de su etiqueta.
 *
 * El `id` se autogenera del nombre y se vuelve **inmutable** cuando el
 * formulario ya está publicado (Spec 9.9).
 */
export function generarIdCampo(etiqueta: string): string {
  const base = etiqueta
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 36);
  const sufijo = Math.random().toString(36).slice(2, 6);
  return base ? `${base}_${sufijo}` : `campo_${sufijo}`;
}

export interface CampoBiblioteca {
  clave: string;
  nombre: string;
  descripcion: string;
  /** Crea una copia nueva del campo (con `id` único). */
  crear: () => CampoDef;
}

/**
 * RF-3.9 · Biblioteca de campos reutilizables.
 *
 * Campos que la agencia usa en varios tours y que se insertan con un clic,
 * sin volver a escribirlos.
 */
export const BIBLIOTECA_CAMPOS: CampoBiblioteca[] = [
  {
    clave: "silla_ruedas",
    nombre: "Necesita silla de ruedas",
    descripcion: "Casilla de sí o no por pasajero.",
    crear: () => ({
      id: generarIdCampo("silla_ruedas"),
      label: "¿Necesita silla de ruedas?",
      ayuda: "Cuéntanos si alguien del grupo necesita apoyo para moverse.",
      tipo: "checkbox",
      alcance: "por_pasajero",
      obligatorio: false,
    }),
  },
  {
    clave: "alergias",
    nombre: "Alergias o condiciones médicas",
    descripcion: "Pregunta de sí o no con una pregunta de seguimiento.",
    crear: () => ({
      id: generarIdCampo("tiene_alergias"),
      label: "¿Tiene alergias o condiciones médicas?",
      ayuda: "Marca la casilla si hay alguna alergia, intolerancia o condición a considerar.",
      tipo: "checkbox",
      alcance: "por_pasajero",
      obligatorio: false,
    }),
  },
  {
    clave: "detalle_alergias",
    nombre: "Detalle de alergias",
    descripcion: "Texto que solo aparece si respondió que sí.",
    crear: () => ({
      id: generarIdCampo("detalle_alergias"),
      label: "Describa cuáles",
      ayuda: "Indique el alérgeno y la forma en que se presenta.",
      tipo: "textarea",
      alcance: "por_pasajero",
      obligatorio: true,
      visible_si: { campo: "tiene_alergias", igual_a: true },
    }),
  },
  {
    clave: "documento_adulto",
    nombre: "Documento del adulto",
    descripcion: "Texto corto por pasajero.",
    crear: () => ({
      id: generarIdCampo("documento_adulto"),
      label: "Número de documento",
      ayuda: "Escribe el número de documento de identidad.",
      tipo: "text",
      alcance: "por_pasajero",
      obligatorio: false,
      max_length: 20,
    }),
  },
  {
    clave: "telefono_emergencia",
    nombre: "Teléfono de emergencia",
    descripcion: "Texto corto por pasajero.",
    crear: () => ({
      id: generarIdCampo("telefono_emergencia"),
      label: "Teléfono de emergencia",
      ayuda: "Número de una persona a la que podamos llamar durante el viaje.",
      tipo: "text",
      alcance: "por_pasajero",
      obligatorio: false,
      max_length: 20,
    }),
  },
  {
    clave: "punto_abordaje",
    nombre: "Punto de abordaje",
    descripcion: "Opción única para toda la reserva.",
    crear: () => ({
      id: generarIdCampo("punto_abordaje"),
      label: "Punto de abordaje",
      ayuda: "Selecciona dónde te vamos a buscar.",
      tipo: "select",
      alcance: "por_reserva",
      obligatorio: true,
      permite_por_pasajero: true,
      fuente: "puntos_salida",
      opciones: [
        { valor: "altamira", label: "Altamira" },
        { valor: "petare", label: "Petare" },
        { valor: "plaza_caracas", label: "Plaza Caracas" },
      ],
    }),
  },
  {
    clave: "comentarios",
    nombre: "Comentarios del grupo",
    descripcion: "Texto largo para toda la reserva.",
    crear: () => ({
      id: generarIdCampo("comentarios"),
      label: "Comentarios",
      ayuda: "Cualquier dato que debamos saber (movilidad, equipaje especial).",
      tipo: "textarea",
      alcance: "por_reserva",
      obligatorio: false,
      max_length: 1000,
    }),
  },
  {
    clave: "cena_incluida",
    nombre: "Cena incluida",
    descripcion: "Opción única con un extra por persona.",
    crear: () => ({
      id: generarIdCampo("cena_incluida"),
      label: "¿Deseas incluir la cena?",
      ayuda: "La cena se cobra aparte y se suma al resumen.",
      tipo: "extra",
      alcance: "por_reserva",
      obligatorio: false,
      precio_usd: "15.00",
      cantidad_max: 4,
      unidad: "persona",
    }),
  },
  {
    clave: "sabor_desayuno",
    nombre: "Sabor del desayuno",
    descripcion:
      "Multiselect: cazón, molida, pollo, queso (pueden pedir 2 empanadas de sabores distintos)",
    crear: () => ({
      id: generarIdCampo("sabor_desayuno"),
      label: "¿Qué sabor de empanada deseas?",
      ayuda: "Selecciona uno o dos sabores de empanada para cada pasajero.",
      tipo: "multiselect",
      alcance: "por_pasajero",
      obligatorio: false,
      opciones: [
        { valor: "cazon", label: "Cazón" },
        { valor: "molida", label: "Molida" },
        { valor: "pollo", label: "Pollo" },
        { valor: "queso", label: "Queso" },
      ],
    }),
  },
];
