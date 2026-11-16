import type { AlcanceCampo, Categoria, TipoCampo } from "@/lib/domain/types";

/** Etiqueta legible de cada tipo de campo del motor (Spec 6.2). */
export const ETIQUETA_TIPO_CAMPO: Record<TipoCampo, string> = {
  text: "Texto corto",
  textarea: "Texto largo",
  select: "Opción única",
  multiselect: "Varias opciones",
  checkbox: "Sí o no",
  number: "Número",
  date: "Fecha",
  extra: "Extra con precio",
};

/** Qué verá el cliente en cada tipo (Spec 6.2). */
export const AYUDA_TIPO_CAMPO: Record<TipoCampo, string> = {
  text: "Una línea de texto. Ideal para nombres o códigos.",
  textarea: "Varias líneas de texto. Ideal para comentarios.",
  select: "El cliente elige una sola opción de la lista.",
  multiselect: "El cliente puede elegir varias opciones.",
  checkbox: "Una casilla de sí o no.",
  number: "Un número, con límites opcionales.",
  date: "Una fecha (por ejemplo, la fecha de nacimiento).",
  extra: "Un extra que se cobra aparte y se suma al resumen.",
};

/** Alcance de la respuesta (Spec 6.3). */
export const ETIQUETA_ALCANCE: Record<AlcanceCampo, string> = {
  por_pasajero: "Por cada pasajero",
  por_reserva: "Para toda la reserva",
};

export const AYUDA_ALCANCE: Record<AlcanceCampo, string> = {
  por_pasajero: "El cliente responde una vez por cada persona del grupo.",
  por_reserva: "El cliente responde una sola vez para todo el grupo.",
};

/** Categorías de pasajero con su rango de edad (política de la agencia). */
export const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  Adulto: "Adulto (18 a 120 años)",
  Niño: "Niño (5 a 11 años)",
  "Tercera Edad": "Tercera edad (61 a 120 años)",
  Infante: "Infante (0 a 4 años)",
};

export const CATEGORIAS: Categoria[] = ["Adulto", "Niño", "Tercera Edad", "Infante"];

/** Tipos que necesitan una lista de opciones. */
export const TIPOS_CON_OPCIONES: TipoCampo[] = ["select", "multiselect"];
