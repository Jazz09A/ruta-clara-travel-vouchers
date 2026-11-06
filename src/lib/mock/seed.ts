/**
 * Datos semilla — Ruta Clara CRM
 *
 * Genera el dataset inicial del "backend" simulado en memoria.
 *
 * Reglas de este archivo:
 * - Determinista: sin `Math.random()`. La variabilidad usa un PRNG mulberry32
 *   con semilla fija, por lo que dos llamadas a `crearSeed()` producen el mismo
 *   dataset (ids, códigos, referencias cortas, hashes).
 * - Los instantes (`creado_en`, `expira_en`, ...) se calculan relativos al
 *   momento de la llamada porque la demo necesita cuentas regresivas vivas
 *   (25 min, 1 h 30, 23 h). El contenido (ids, montos, nombres) sí es fijo.
 * - Todos los textos visibles están en español.
 * - Los montos son strings decimales (FD-09). Nunca se usan floats para dinero.
 */

import { addDecimals, multiplyDecimal } from "@/lib/format";

import type {
  Auditoria,
  CampoDef,
  Categoria,
  CodigoPromocional,
  Configuracion,
  CupoOpcion,
  EstadoReserva,
  FechaTour,
  Firma,
  Formulario,
  MetodoPago,
  MetodoPagoId,
  Notificacion,
  Pago,
  Pasajero,
  PoliticaCancelacion,
  PlantillaMensaje,
  Reserva,
  Rol,
  Tarifa,
  TasaCambio,
  Tour,
  Usuario,
  VersionTerminos,
} from "@/lib/domain/types";

// ---------------------------------------------------------------------------
// Tipos del seed
// ---------------------------------------------------------------------------

export interface SeedData {
  usuarios: Usuario[];
  tours: Tour[];
  fechas: FechaTour[];
  tarifas: Tarifa[];
  formularios: Formulario[];
  reservas: Reserva[];
  pagos: Pago[];
  metodos_pago: MetodoPago[];
  tasa: TasaCambio[];
  terminos: VersionTerminos[];
  politicas: PoliticaCancelacion[];
  plantillas: PlantillaMensaje[];
  promos: CodigoPromocional[];
  config: Configuracion;
  auditoria: Auditoria[];
  notificaciones: Notificacion[];
  /** Token de enlace -> id de reserva. Los tokens SOLO se entregan al crear un enlace nuevo (D-08). */
  enlaces: Record<string, string>;
  /** Token de verificación QR -> id de reserva. */
  verificaciones: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Utilidades deterministas
// ---------------------------------------------------------------------------

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/**
 * PRNG mulberry32: secuencia pseudoaleatoria reproducible a partir de una semilla.
 * Se exporta para que la capa de estado (`db.ts`) genere referencias cortas
 * nuevas con el mismo algoritmo y el mismo alfabeto que el seed.
 */
export function mulberry32(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HEX = "0123456789abcdef";

/** UUID determinista con forma v4 (solo para `ref_cliente` de cada pasajero). */
function uuidDesde(rng: () => number): string {
  let salida = "";
  for (let i = 0; i < 32; i++) {
    salida += HEX[Math.floor(rng() * 16)] ?? "0";
    if (i === 7 || i === 11 || i === 15 || i === 19) salida += "-";
  }
  return salida;
}

/** Sin caracteres ambiguos (0/O, 1/I) para poder leerla en voz alta. */
const ALFABETO_REF = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Referencia corta de 8 caracteres en mayúsculas (ej. "K7M2QX9A").
 *
 * Longitud fijada por el Spec Backend D-01 (`ref_corta char(8) NOT NULL UNIQUE`).
 * Se exporta para que la capa de estado pueda emitir referencias nuevas con el
 * mismo alfabeto que el seed.
 */
export function generarRefCorta(rng: () => number): string {
  let salida = "";
  for (let i = 0; i < 8; i++) {
    salida += ALFABETO_REF[Math.floor(rng() * ALFABETO_REF.length)] ?? "X";
  }
  return salida;
}

/**
 * SHA-256 simulado: 64 hexadecimales deterministas derivados de la entrada.
 * No es criptografía real; solo simula la evidencia de integridad (RF-6.4).
 */
function hashSimulado(entrada: string): string {
  let h = 0x811c9dc5;
  for (const caracter of entrada) {
    h ^= caracter.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let estado = h >>> 0;
  let salida = "";
  for (let bloque = 0; bloque < 8; bloque++) {
    estado = (Math.imul(estado ^ (bloque + 1), 0x85ebca6b) >>> 0) ^ (estado >>> 13);
    estado = estado >>> 0;
    for (let i = 0; i < 8; i++) {
      estado = (Math.imul(estado, 0x27d4eb2d) >>> 0) ^ (estado >>> 15);
      estado = estado >>> 0;
      salida += HEX[estado % 16] ?? "0";
    }
  }
  return salida;
}

/** Suma de decimales en string, reutilizando el formateador del proyecto. */
function sumarDecimales(valores: string[]): string {
  return valores.reduce((total, valor) => addDecimals(total, valor), "0.00");
}

function fechaIso(ahora: number, dias: number, horas = 0, minutos = 0): string {
  return new Date(ahora + dias * DIA + horas * HORA + minutos * MINUTO).toISOString();
}

// ---------------------------------------------------------------------------
// Catálogo base
// ---------------------------------------------------------------------------

const PRECIOS_POR_TOUR: Record<string, { Adulto: string; Niño: string; "Tercera Edad": string }> = {
  tour_roques: { Adulto: "55.00", Niño: "35.00", "Tercera Edad": "50.00" },
  tour_merida: { Adulto: "90.00", Niño: "60.00", "Tercera Edad": "80.00" },
  tour_colonia: { Adulto: "50.00", Niño: "32.00", "Tercera Edad": "45.00" },
  tour_lacosta: { Adulto: "75.00", Niño: "50.00", "Tercera Edad": "65.00" },
};

const RANGOS_CATEGORIA: Record<Categoria, { min: number; max: number }> = {
  Adulto: { min: 18, max: 120 },
  Niño: { min: 3, max: 11 },
  "Tercera Edad": { min: 61, max: 120 },
  Infante: { min: 0, max: 2 },
};

const CATEGORIAS: Categoria[] = ["Adulto", "Niño", "Tercera Edad", "Infante"];

function crearUsuarios(): Usuario[] {
  return [
    {
      id: "usr_sa_1",
      nombre: "Manuel Rodríguez",
      correo: "admin@rutaclara.ve",
      rol: "SA",
      dos_factores_activo: true,
      activo: true,
    },
    {
      id: "usr_op_1",
      nombre: "Carmen Díaz",
      correo: "operador@rutaclara.ve",
      rol: "OP",
      dos_factores_activo: false,
      activo: true,
    },
    {
      id: "usr_val_1",
      nombre: "Luis Bracho",
      correo: "validador@rutaclara.ve",
      rol: "VAL",
      dos_factores_activo: false,
      activo: true,
    },
    {
      id: "usr_gu_1",
      nombre: "Ana Rojas",
      correo: "guia@rutaclara.ve",
      rol: "GU",
      dos_factores_activo: false,
      activo: true,
    },
    {
      id: "usr_sa_0",
      nombre: "Patricia Bello",
      correo: "admin.anterior@rutaclara.ve",
      rol: "SA",
      dos_factores_activo: true,
      activo: false,
    },
  ];
}

/** Password único de la demo. */
export const PASSWORD_DEMO = "demo1234";

export const CREDENCIALES_DEMO: { correo: string; password: string; rol: Rol }[] = [
  { correo: "admin@rutaclara.ve", password: PASSWORD_DEMO, rol: "SA" },
  { correo: "operador@rutaclara.ve", password: PASSWORD_DEMO, rol: "OP" },
  { correo: "validador@rutaclara.ve", password: PASSWORD_DEMO, rol: "VAL" },
  { correo: "guia@rutaclara.ve", password: PASSWORD_DEMO, rol: "GU" },
];

// ---------------------------------------------------------------------------
// Formularios
// ---------------------------------------------------------------------------

type CamposFormulario = CampoDef[];

function camposSimples(puntos: { valor: string; label: string }[]): CamposFormulario {
  return [
    {
      id: "almuerzo",
      label: "Selección de almuerzo",
      ayuda: "El menú se sirve al mediodía, en el destino.",
      tipo: "select",
      alcance: "por_pasajero",
      obligatorio: true,
      aplica_a: ["Adulto", "Tercera Edad", "Niño"],
      opciones: [
        { valor: "pescado", label: "Pescado frito", cupo: 20 },
        { valor: "pollo", label: "Pollo a la canasta", cupo: 30 },
        { valor: "vegetariano", label: "Vegetariano", cupo: 10 },
      ],
    },
    {
      id: "tiene_alergias",
      label: "¿Tiene alergias o condiciones médicas?",
      ayuda: "Marca la casilla si hay alguna alergia, intolerancia o condición a considerar.",
      tipo: "checkbox",
      alcance: "por_pasajero",
      obligatorio: false,
    },
    {
      id: "detalle_alergias",
      label: "Describa cuáles",
      ayuda: "Indique el alérgeno y la forma en que se presenta.",
      tipo: "text",
      alcance: "por_pasajero",
      obligatorio: true,
      visible_si: { campo: "tiene_alergias", igual_a: true },
    },
    {
      id: "punto_abordaje",
      label: "Punto de abordaje",
      ayuda: "Selecciona dónde te vamos a buscar.",
      tipo: "select",
      alcance: "por_reserva",
      obligatorio: true,
      permite_por_pasajero: true,
      opciones: puntos,
    },
    {
      id: "comentarios",
      label: "Comentarios",
      ayuda: "Cualquier dato que debamos saber (movilidad, acompañante, equipaje especial).",
      tipo: "textarea",
      alcance: "por_reserva",
      obligatorio: false,
      max_length: 1000,
    },
  ];
}

const CAMPOS_ROQUES_V1: CamposFormulario = [
  ...camposSimples([
    { valor: "altamira", label: "Altamira, 5:00 a. m." },
    { valor: "petare", label: "Petare, 5:30 a. m." },
    { valor: "plaza_caracas", label: "Plaza Caracas, 5:15 a. m." },
  ]),
  {
    id: "toldo",
    label: "Alquiler de toldo",
    ayuda: "Toldo de 3 x 3 metros para el grupo en la playa. Se entrega en el punto de abordaje.",
    tipo: "extra",
    alcance: "por_reserva",
    obligatorio: false,
    precio_usd: "10.00",
    cantidad_max: 3,
    unidad: "unidad",
  },
];

const CAMPOS_ROQUES_V2: CamposFormulario = [
  ...CAMPOS_ROQUES_V1,
  {
    id: "menu_infantil",
    label: "Menú infantil",
    ayuda: "Selecciona el menú del niño. El almuerzo de adulto no aplica a esta categoría.",
    tipo: "select",
    alcance: "por_pasajero",
    obligatorio: true,
    aplica_a: ["Niño"],
    opciones: [
      { valor: "jugo_emparedado", label: "Jugo y emparedado" },
      { valor: "sandwich_pollo", label: "Sándwich de pollo" },
      { valor: "pasta", label: "Pasta" },
    ],
  },
];

function crearFormularios(ahora: number): Formulario[] {
  return [
    {
      id: "form_roques",
      tour_id: "tour_roques",
      definicion: { campos: CAMPOS_ROQUES_V2 },
      actualizado_en: fechaIso(ahora, -12),
    },
    {
      id: "form_merida",
      tour_id: "tour_merida",
      definicion: {
        campos: camposSimples([
          { valor: "altamira", label: "Altamira, 5:00 a. m." },
          { valor: "plaza_caracas", label: "Plaza Caracas, 5:15 a. m." },
          { valor: "el_paraiso", label: "El Paraíso, 5:00 a. m." },
        ]),
      },
      actualizado_en: fechaIso(ahora, -95),
    },
    {
      id: "form_colonia",
      tour_id: "tour_colonia",
      definicion: {
        campos: camposSimples([
          { valor: "altamira", label: "Altamira, 5:30 a. m." },
          { valor: "plaza_caracas", label: "Plaza Caracas, 5:45 a. m." },
        ]),
      },
      actualizado_en: fechaIso(ahora, -60),
    },
    {
      id: "form_lacosta",
      tour_id: "tour_lacosta",
      definicion: {
        campos: camposSimples([
          { valor: "altamira", label: "Altamira, 5:00 a. m." },
          { valor: "petare", label: "Petare, 5:30 a. m." },
        ]),
      },
      actualizado_en: fechaIso(ahora, -9),
    },
  ];
}

// ---------------------------------------------------------------------------
// Tours
// ---------------------------------------------------------------------------

function crearTours(ahora: number): Tour[] {
  return [
    {
      id: "tour_roques",
      nombre: "Full Day Los Roques",
      tipo: "full_day",
      descripcion:
        "Salida a las 5:00 a. m. hacia Los Roques con ida y vuelta el mismo día, almuerzo en la playa y tiempo libre para natación.",
      itinerario: [
        {
          hora: "05:00",
          titulo: "Recogida en el punto de abordaje",
          detalle: "Altamira, Plaza Caracas o Petare, según la reserva.",
        },
        {
          hora: "07:15",
          titulo: "Salida desde Caracas",
          detalle: "Desayuno en ruta hacia la costa.",
        },
        {
          hora: "10:30",
          titulo: "Llegada a Los Roques",
          detalle: "Traslado al muelle y preparación de la lancha.",
        },
        {
          hora: "12:30",
          titulo: "Almuerzo",
          detalle: "Menú en la playa, según la selección del pasajero.",
        },
        { hora: "14:00", titulo: "Tiempo libre", detalle: "Playa, natación y paseo en lancha." },
        { hora: "16:30", titulo: "Regreso", detalle: "Partida hacia Caracas." },
        {
          hora: "19:45",
          titulo: "Llegada a Caracas",
          detalle: "Descenso en el punto de abordaje.",
        },
        { hora: "20:00", titulo: "Cierre de la salida", detalle: "Fin del servicio." },
      ],
      incluye: [
        "Transporte ida y vuelta desde Caracas",
        "Almuerzo según la selección del pasajero",
        "Entrada y uso del muelle de Los Roques",
        "Guía acompañante durante todo el recorrido",
        "Botiquín de primeros auxilios a bordo",
      ],
      no_incluye: [
        "Bebidas adicionales y consumos personales",
        "Actividades acuáticas con costo adicional",
        "Propinas",
      ],
      imagenes: [
        "https://picsum.photos/seed/roques1/1200/800",
        "https://picsum.photos/seed/roques2/1200/800",
        "https://picsum.photos/seed/roques3/1200/800",
      ],
      puntos_abordaje: [
        {
          id: "pa_roq_altamira",
          nombre: "Altamira",
          hora: "05:00",
          referencia_ubicacion: "Plaza Los Caracas, frente al Multicine.",
          mapa_url: "https://maps.google.com/?q=Plaza+Los+Caracas+Altamira",
        },
        {
          id: "pa_roq_petare",
          nombre: "Petare",
          hora: "05:30",
          referencia_ubicacion: "Estación de servicio junto al Mercado Municipal.",
          mapa_url: "https://maps.google.com/?q=Mercado+Municipal+Petare",
        },
        {
          id: "pa_roq_plaza_caracas",
          nombre: "Plaza Caracas",
          hora: "05:15",
          referencia_ubicacion: "Estacionamiento del Teatro Municipal.",
          mapa_url: "https://maps.google.com/?q=Teatro+Municipal+Caracas",
        },
      ],
      estado: "activo",
      politica_cancelacion_id: "pol_roques",
      terminos_version_id: "term_v2",
      formulario_id: "form_roques",
      fecha_creacion: fechaIso(ahora, -150),
    },
    {
      id: "tour_merida",
      nombre: "Fin de Semana Mérida",
      tipo: "fin_de_semana",
      descripcion:
        "Dos días y una noche en Mérida: hotel, traslado desde Caracas, almuerzo de bienvenida y día libre en el centro histórico.",
      itinerario: [
        {
          hora: "05:00",
          titulo: "Recogida en el punto de abordaje",
          detalle: "Salida desde Caracas.",
        },
        {
          hora: "12:30",
          titulo: "Llegada a Mérida",
          detalle: "Traslado al hotel y almuerzo de bienvenida.",
        },
        {
          hora: "16:00",
          titulo: "Tarde libre",
          detalle: "Paseo por el centro histórico y la plaza principal.",
        },
        { hora: "19:30", titulo: "Cena en el hotel", detalle: "Cena de grupo con el acompañante." },
        { hora: "08:00", titulo: "Desayuno y mañana libre", detalle: "Día libre en la ciudad." },
        {
          hora: "15:00",
          titulo: "Regreso",
          detalle: "Salida hacia Caracas con parada en los Llanos.",
        },
        { hora: "20:30", titulo: "Llegada a Caracas", detalle: "Fin del servicio." },
      ],
      incluye: [
        "Transporte ida y vuelta desde Caracas",
        "Una noche de alojamiento en hotel tres estrellas",
        "Desayuno y cena del primer día",
        "Almuerzo del primer día según selección",
        "Guía durante todo el recorrido",
      ],
      no_incluye: [
        "Almuerzos y cenas no incluidos en el plan",
        "Entradas a museos y actividades opcionales",
        "Propinas y gastos personales",
      ],
      imagenes: [
        "https://picsum.photos/seed/merida1/1200/800",
        "https://picsum.photos/seed/merida2/1200/800",
      ],
      puntos_abordaje: [
        {
          id: "pa_mer_altamira",
          nombre: "Altamira",
          hora: "05:00",
          referencia_ubicacion: "Plaza Los Caracas, frente al Multicine.",
        },
        {
          id: "pa_mer_el_paraiso",
          nombre: "El Paraíso",
          hora: "05:00",
          referencia_ubicacion: "Plaza El Paraíso, sentido norte.",
        },
        {
          id: "pa_mer_plaza_caracas",
          nombre: "Plaza Caracas",
          hora: "05:15",
          referencia_ubicacion: "Estacionamiento del Teatro Municipal.",
        },
      ],
      estado: "activo",
      politica_cancelacion_id: "pol_merida",
      terminos_version_id: "term_v2",
      formulario_id: "form_merida",
      fecha_creacion: fechaIso(ahora, -130),
    },
    {
      id: "tour_colonia",
      nombre: "Full Day Colonia Tovar",
      tipo: "full_day",
      descripcion:
        "Viaje de un día a Colonia Tovar, en las montañas de Carabobo, con almuerzo, casco histórico y tiempo libre.",
      itinerario: [
        {
          hora: "05:30",
          titulo: "Recogida en el punto de abordaje",
          detalle: "Altamira o Plaza Caracas.",
        },
        {
          hora: "08:00",
          titulo: "Salida desde Caracas",
          detalle: "Ruta por la Gran Mariscal de Ayacucho.",
        },
        {
          hora: "10:30",
          titulo: "Llegada a Colonia Tovar",
          detalle: "Caminata por el casco histórico y la/rfc artesanal.",
        },
        {
          hora: "12:30",
          titulo: "Almuerzo",
          detalle: "Cocina típica de la zona con el acompañante.",
        },
        { hora: "14:30", titulo: "Tiempo libre", detalle: "Parque, miradores y artesanías." },
        { hora: "16:30", titulo: "Regreso", detalle: "Partida hacia Caracas." },
        {
          hora: "19:00",
          titulo: "Llegada a Caracas",
          detalle: "Descenso en el punto de abordaje.",
        },
      ],
      incluye: [
        "Transporte ida y vuelta desde Caracas",
        "Almuerzo según la selección del pasajero",
        "Guía durante todo el recorrido",
        "Parada en el mirador de la colonia",
      ],
      no_incluye: ["Bebidas adicionales", "Artesanías y compras personales", "Propinas"],
      imagenes: [
        "https://picsum.photos/seed/colonia1/1200/800",
        "https://picsum.photos/seed/colonia2/1200/800",
      ],
      puntos_abordaje: [
        {
          id: "pa_col_altamira",
          nombre: "Altamira",
          hora: "05:30",
          referencia_ubicacion: "Plaza Los Caracas, frente al Multicine.",
        },
        {
          id: "pa_col_plaza_caracas",
          nombre: "Plaza Caracas",
          hora: "05:45",
          referencia_ubicacion: "Estacionamiento del Teatro Municipal.",
        },
      ],
      estado: "activo",
      politica_cancelacion_id: "pol_roques",
      terminos_version_id: "term_v2",
      formulario_id: "form_colonia",
      fecha_creacion: fechaIso(ahora, -80),
    },
    {
      id: "tour_lacosta",
      nombre: "Fin de Semana La Costa",
      tipo: "fin_de_semana",
      descripcion:
        "Escapada de fin de semana a La Costa con paseo por el malecón y día de playa. En construcción.",
      itinerario: [
        {
          hora: "06:00",
          titulo: "Recogida en el punto de abordaje",
          detalle: "Altamira o Petare.",
        },
        {
          hora: "08:30",
          titulo: "Salida desde Caracas",
          detalle: "Ruta por la autopista Caracas-La Costa.",
        },
        { hora: "11:00", titulo: "Llegada a La Costa", detalle: "Alojamiento y tiempo libre." },
        { hora: "13:00", titulo: "Almuerzo", detalle: "Comida en el malecón." },
        { hora: "15:30", titulo: "Playa de Agua de Caro", detalle: "Día libre de playa." },
        { hora: "17:00", titulo: "Regreso", detalle: "Partida hacia Caracas." },
      ],
      incluye: ["Transporte ida y vuelta desde Caracas", "Una noche de alojamiento", "Desayuno"],
      no_incluye: ["Almuerzos y cenas", "Actividades recreativas con costo", "Propinas"],
      imagenes: ["https://picsum.photos/seed/lacosta1/1200/800"],
      puntos_abordaje: [
        {
          id: "pa_lac_altamira",
          nombre: "Altamira",
          hora: "06:00",
          referencia_ubicacion: "Plaza Los Caracas, frente al Multicine.",
        },
        {
          id: "pa_lac_petare",
          nombre: "Petare",
          hora: "06:30",
          referencia_ubicacion: "Estación de servicio junto al Mercado Municipal.",
        },
      ],
      estado: "activo",
      politica_cancelacion_id: "pol_merida",
      terminos_version_id: "term_v2",
      formulario_id: "form_lacosta",
      fecha_creacion: fechaIso(ahora, -9),
    },
  ];
}

// ---------------------------------------------------------------------------
// Fechas y tarifas
// ---------------------------------------------------------------------------

interface SemillaFecha {
  id: string;
  tour_id: string;
  fecha_salida: string;
  hora_salida: string;
  cupos_total: number;
  cupos_vendidos: number;
  cupos_retenidos: number;
  estado: FechaTour["estado"];
  motivo_cierre?: string;
  /** Porcentaje de agotamiento por opción de almuerzo (0-100). */
  agotamiento: [number, number, number];
}

const SEMILLAS_FECHAS: SemillaFecha[] = [
  // Los Roques
  {
    id: "fch_roq_01",
    tour_id: "tour_roques",
    fecha_salida: "2026-11-07",
    hora_salida: "05:30",
    cupos_total: 40,
    cupos_vendidos: 40,
    cupos_retenidos: 0,
    estado: "publicada",
    agotamiento: [100, 100, 100],
  },
  {
    id: "fch_roq_02",
    tour_id: "tour_roques",
    fecha_salida: "2026-11-21",
    hora_salida: "05:30",
    cupos_total: 40,
    cupos_vendidos: 38,
    cupos_retenidos: 0,
    estado: "publicada",
    agotamiento: [95, 80, 60],
  },
  {
    id: "fch_roq_03",
    tour_id: "tour_roques",
    fecha_salida: "2026-12-12",
    hora_salida: "05:30",
    cupos_total: 40,
    cupos_vendidos: 22,
    cupos_retenidos: 0,
    estado: "publicada",
    agotamiento: [60, 45, 30],
  },
  {
    id: "fch_roq_04",
    tour_id: "tour_roques",
    fecha_salida: "2026-12-26",
    hora_salida: "05:30",
    cupos_total: 40,
    cupos_vendidos: 30,
    cupos_retenidos: 0,
    estado: "publicada",
    agotamiento: [75, 60, 40],
  },
  {
    id: "fch_roq_05",
    tour_id: "tour_roques",
    fecha_salida: "2027-01-16",
    hora_salida: "05:30",
    cupos_total: 40,
    cupos_vendidos: 12,
    cupos_retenidos: 0,
    estado: "publicada",
    agotamiento: [30, 20, 10],
  },
  {
    id: "fch_roq_06",
    tour_id: "tour_roques",
    fecha_salida: "2027-01-30",
    hora_salida: "05:30",
    cupos_total: 40,
    cupos_vendidos: 40,
    cupos_retenidos: 0,
    estado: "cerrada",
    motivo_cierre: "Cupo completo, no se aceptan más reservas.",
    agotamiento: [100, 100, 100],
  },
  // Mérida
  {
    id: "fch_mer_01",
    tour_id: "tour_merida",
    fecha_salida: "2026-11-27",
    hora_salida: "05:00",
    cupos_total: 24,
    cupos_vendidos: 16,
    cupos_retenidos: 0,
    estado: "publicada",
    agotamiento: [65, 50, 35],
  },
  {
    id: "fch_mer_02",
    tour_id: "tour_merida",
    fecha_salida: "2026-12-18",
    hora_salida: "05:00",
    cupos_total: 24,
    cupos_vendidos: 22,
    cupos_retenidos: 0,
    estado: "publicada",
    agotamiento: [90, 85, 70],
  },
  {
    id: "fch_mer_03",
    tour_id: "tour_merida",
    fecha_salida: "2027-01-22",
    hora_salida: "05:00",
    cupos_total: 24,
    cupos_vendidos: 9,
    cupos_retenidos: 0,
    estado: "publicada",
    agotamiento: [40, 30, 20],
  },
  // Colonia Tovar
  {
    id: "fch_col_01",
    tour_id: "tour_colonia",
    fecha_salida: "2026-11-14",
    hora_salida: "05:30",
    cupos_total: 36,
    cupos_vendidos: 18,
    cupos_retenidos: 0,
    estado: "publicada",
    agotamiento: [50, 40, 25],
  },
  {
    id: "fch_col_02",
    tour_id: "tour_colonia",
    fecha_salida: "2026-12-19",
    hora_salida: "05:30",
    cupos_total: 36,
    cupos_vendidos: 5,
    cupos_retenidos: 0,
    estado: "publicada",
    agotamiento: [15, 10, 5],
  },
  {
    id: "fch_col_03",
    tour_id: "tour_colonia",
    fecha_salida: "2027-02-06",
    hora_salida: "05:30",
    cupos_total: 36,
    cupos_vendidos: 27,
    cupos_retenidos: 0,
    estado: "publicada",
    agotamiento: [70, 60, 45],
  },
  // La Costa
  {
    id: "fch_lac_01",
    tour_id: "tour_lacosta",
    fecha_salida: "2026-12-06",
    hora_salida: "06:00",
    cupos_total: 30,
    cupos_vendidos: 0,
    cupos_retenidos: 0,
    estado: "publicada",
    agotamiento: [0, 0, 0],
  },
  {
    id: "fch_lac_02",
    tour_id: "tour_lacosta",
    fecha_salida: "2026-12-05",
    hora_salida: "06:00",
    cupos_total: 30,
    cupos_vendidos: 0,
    cupos_retenidos: 0,
    estado: "borrador",
    agotamiento: [0, 0, 0],
  },
  {
    id: "fch_lac_03",
    tour_id: "tour_lacosta",
    fecha_salida: "2027-02-20",
    hora_salida: "06:00",
    cupos_total: 30,
    cupos_vendidos: 0,
    cupos_retenidos: 0,
    estado: "cancelada",
    motivo_cierre: "Cancelada por el proveedor: el hospedaje no tiene disponibilidad.",
    agotamiento: [0, 0, 0],
  },
];

const OPCIONES_ALMUERZO: { valor: string; label: string; cupo: number }[] = [
  { valor: "pescado", label: "Pescado frito", cupo: 20 },
  { valor: "pollo", label: "Pollo a la canasta", cupo: 30 },
  { valor: "vegetariano", label: "Vegetariano", cupo: 10 },
];

function crearFechas(): FechaTour[] {
  return SEMILLAS_FECHAS.map((semilla) => {
    const opciones_cupo: CupoOpcion[] = OPCIONES_ALMUERZO.map((opcion, indice) => {
      const porcentaje = semilla.agotamiento[indice] ?? 0;
      return {
        campo_id: "almuerzo",
        opcion: opcion.valor,
        cupo: opcion.cupo,
        agotados: Math.round((opcion.cupo * porcentaje) / 100),
      };
    });

    const base: FechaTour = {
      id: semilla.id,
      tour_id: semilla.tour_id,
      fecha_salida: semilla.fecha_salida,
      hora_salida: semilla.hora_salida,
      cupos_total: semilla.cupos_total,
      cupos_retenidos: semilla.cupos_retenidos,
      cupos_vendidos: semilla.cupos_vendidos,
      estado: semilla.estado,
      corte_venta_horas: 12,
      opciones_cupo,
    };

    if (semilla.motivo_cierre !== undefined) {
      return { ...base, motivo_cierre: semilla.motivo_cierre };
    }
    return base;
  });
}

function crearTarifas(fechas: FechaTour[]): Tarifa[] {
  const tarifas: Tarifa[] = [];
  for (const fecha of fechas) {
    const precios = PRECIOS_POR_TOUR[fecha.tour_id];
    if (!precios) continue;
    for (const categoria of CATEGORIAS) {
      const rango = RANGOS_CATEGORIA[categoria];
      const precio = categoria === "Infante" ? "0.00" : precios[categoria];
      tarifas.push({
        id: `tar_${fecha.id}_${categoria.toLowerCase().replace(" ", "_")}`,
        fecha_tour_id: fecha.id,
        categoria,
        edad_min: rango.min,
        edad_max: rango.max,
        precio_usd: precio,
      });
    }
  }
  return tarifas;
}

// ---------------------------------------------------------------------------
// Términos, políticas, plantillas, promos, config, métodos de pago
// ---------------------------------------------------------------------------

const CUERPO_TERMINOS_V2 = `## 1. Objeto del viaje

Ruta Clara Viajes comercializa tours turísticos Full Days y fines de semana desde Caracas hacia destinos nacionales. La reserva formaliza el derecho del titular a ocupar el cupo asignado en la salida seleccionada y los servicios descritos en el itinerario del tour.

## 2. Responsabilidades del titular

El titular declara ser mayor de 18 años, firma en nombre propio y de sus acompañantes, y entrega datos veraces de todos los pasajeros. Cada pasajero debe cumplir los requisitos migratorios y de salud aplicables al destino. El titular se hace responsable de la custodia de sus menores durante todo el viaje.

## 3. Cancelaciones y reembolsos

La cancelación debe solicitarse antes de la salida. El reembolso se calcula con la tabla escalonada de la política de cancelación del tour: con más de 7 días se devuelve el 100 %, entre 3 y 7 días el 50 % y con menos de 3 días no hay reembolso. El saldo no reembolsable cubre servicios ya contratados con proveedores.

## 4. Uso de datos personales

Los datos del titular y de sus acompañantes se usan exclusivamente para gestionar la reserva, emitir el voucher y coordinar la salida. No se comparten con terceros salvo con los proveedores del tour y cuando la ley lo exija.

## 5. Firma digital

La firma manuscrita capturada en pantalla, junto con la versión de términos aceptada, la fecha y hora en UTC, la dirección IP y el agente de usuario, constituyen evidencia de aceptación. Los cambios materiales posteriores a la firma invalidan la evidencia y requieren una nueva firma.

## 6. Documentación y vouchers

El voucher emitido es un comprobante de reserva y no sustituye la factura fiscal. El titular debe presentar su documento de identidad y la autorización de viaje de los menores cuando el tour la requiera.`;

const CUERPO_TERMINOS_V1 = `## 1. Objeto del viaje

Ruta Clara Viajes comercializa tours turísticos Full Days y fines de semana desde Caracas. La reserva asigna un cupo en la salida seleccionada.

## 2. Responsabilidades del titular

El titular declara ser mayor de 18 años y entrega datos veraces de todos los pasajeros.

## 3. Cancelaciones y reembolsos

La cancelación se calcula con la tabla escalonada de la política de cancelación del tour.

## 4. Uso de datos personales

Los datos se usan para gestionar la reserva y emitir el voucher.

## 5. Firma digital

La firma capturada en pantalla con fecha, IP y versión de términos es evidencia de aceptación.

## 6. Documentación

El voucher es un comprobante de reserva y no sustituye la factura fiscal.`;

function crearTerminos(ahora: number): VersionTerminos[] {
  return [
    {
      id: "term_v1",
      version: 1,
      titulo: "Términos y condiciones — Ruta Clara Viajes",
      cuerpo: CUERPO_TERMINOS_V1,
      publicada_en: fechaIso(ahora, -180),
      activa: false,
      hash: hashSimulado("terminos-v1"),
    },
    {
      id: "term_v2",
      version: 2,
      titulo: "Términos y condiciones — Ruta Clara Viajes",
      cuerpo: CUERPO_TERMINOS_V2,
      publicada_en: fechaIso(ahora, -25),
      activa: true,
      hash: hashSimulado("terminos-v2"),
    },
  ];
}

function crearPoliticas(): PoliticaCancelacion[] {
  return [
    {
      id: "pol_roques",
      nombre: "Política de cancelación — Full Days",
      tramos: [
        {
          dias_desde_salida: 7,
          porcentaje_reembolso: 100,
          descripcion: "Más de 7 días antes de la salida: reembolso del 100 %.",
        },
        {
          dias_desde_salida: 3,
          porcentaje_reembolso: 50,
          descripcion: "Entre 3 y 7 días antes de la salida: reembolso del 50 %.",
        },
        {
          dias_desde_salida: 0,
          porcentaje_reembolso: 0,
          descripcion: "Con menos de 3 días de anticipación: no hay reembolso.",
        },
      ],
    },
    {
      id: "pol_merida",
      nombre: "Política de cancelación — Fines de semana",
      tramos: [
        {
          dias_desde_salida: 15,
          porcentaje_reembolso: 100,
          descripcion: "Más de 15 días antes de la salida: reembolso del 100 %.",
        },
        {
          dias_desde_salida: 7,
          porcentaje_reembolso: 75,
          descripcion: "Entre 7 y 15 días antes de la salida: reembolso del 75 %.",
        },
        {
          dias_desde_salida: 3,
          porcentaje_reembolso: 50,
          descripcion: "Entre 3 y 7 días antes de la salida: reembolso del 50 %.",
        },
        {
          dias_desde_salida: 0,
          porcentaje_reembolso: 0,
          descripcion: "Con menos de 3 días de anticipación: no hay reembolso.",
        },
      ],
    },
  ];
}

function crearPlantillas(): PlantillaMensaje[] {
  const variables = ["nombre_cliente", "tour", "fecha", "ref_corta"];
  return [
    {
      id: "msg_registro",
      clave: "registro_completado",
      nombre: "Registro completado",
      variables,
      cuerpo:
        "Hola {nombre_cliente}, tu registro para {tour} (salida {fecha}) quedó completado. Referencia {ref_corta}. Te avisaremos cuando confirmemos tu pago.",
    },
    {
      id: "msg_pago_reportado",
      clave: "pago_reportado",
      nombre: "Pago reportado",
      variables,
      cuerpo:
        "Hola {nombre_cliente}, recibimos tu reporte de pago para {tour} (salida {fecha}). Lo estamos verificando. Tu referencia es {ref_corta}.",
    },
    {
      id: "msg_pago_rechazado",
      clave: "pago_rechazado",
      nombre: "Pago rechazado",
      variables,
      cuerpo:
        "Hola {nombre_cliente}, no pudimos validar tu pago de {tour} (salida {fecha}). Revisa el motivo en el enlace y vuelve a reportarlo. Referencia {ref_corta}.",
    },
    {
      id: "msg_voucher",
      clave: "voucher_emitido",
      nombre: "Voucher emitido",
      variables,
      cuerpo:
        "¡Listo, {nombre_cliente}! Tu voucher de {tour} (salida {fecha}) está disponible. Referencia {ref_corta}. Muéstralo en el punto de abordaje.",
    },
  ];
}

function crearPromos(ahora: number): CodigoPromocional[] {
  return [
    {
      id: "promo_bienvenida",
      codigo: "BIENVENIDA10",
      tipo: "porcentaje",
      valor: 10,
      vigente_desde: fechaIso(ahora, -30),
      vigente_hasta: fechaIso(ahora, 120),
      usos_max: 30,
      usos: 8,
      activo: true,
    },
    {
      id: "promo_verano",
      codigo: "VERANO20",
      tipo: "monto",
      valor: 20,
      vigente_desde: fechaIso(ahora, -10),
      vigente_hasta: fechaIso(ahora, 60),
      usos_max: 50,
      usos: 3,
      tour_id: "tour_roques",
      activo: true,
    },
  ];
}

function crearConfiguracion(tourActivoDefault: string): Configuracion {
  return {
    agencia_nombre: "Ruta Clara Viajes",
    agencia_whatsapp: "+584121234567",
    agencia_email: "hola@rutaclara.ve",
    agencia_direccion: "Av. Libertador, Caracas",
    idioma: "es",
    zona_horaria: "America/Caracas",
    hold_horas: 24,
    enlace_vigencia_horas: 72,
    abono_minimo_porcentaje: 50,
    max_pasajeros_reserva: 10,
    permite_sobreventa: false,
    Requires_autorizacion_menores: true,
    documento_menores: "opcional",
    minutos_inactividad: 30,
    tour_activo_default: tourActivoDefault,
  };
}

function crearMetodosPago(): MetodoPago[] {
  return [
    {
      id: "transferencia",
      nombre: "Transferencia bancaria",
      moneda: "USD",
      activo: true,
      orden: 1,
      datos: [
        { etiqueta: "Banco", valor: "Bancamiga" },
        { etiqueta: "Número de cuenta", valor: "0102-0000-00-0000000000", copiable: true },
        { etiqueta: "Tipo de cuenta", valor: "Corriente" },
        { etiqueta: "Titular", valor: "Ruta Clara Viajes C.A." },
        { etiqueta: "RIF", valor: "J-40123456-7" },
      ],
      campos_requeridos: ["referencia", "fecha_pago"],
      requiere_comprobante: true,
      instrucciones:
        "Realiza la transferencia y reporta el pago con la referencia exacta del banco. El comprobante puede adjuntarse como imagen o PDF.",
    },
    {
      id: "pago_movil",
      nombre: "Pago Móvil",
      moneda: "VES",
      activo: true,
      orden: 2,
      datos: [
        { etiqueta: "Banco", valor: "Banesco" },
        { etiqueta: "Teléfono", valor: "+584121234567", copiable: true },
        { etiqueta: "Cédula", valor: "V-12345678" },
        { etiqueta: "RIF", valor: "J-40123456-7" },
      ],
      campos_requeridos: ["referencia", "monto_ves", "fecha_pago"],
      requiere_comprobante: true,
      instrucciones:
        "Envía el pago móvil al número indicado y reporta el monto en bolívares junto con la referencia de la operación.",
    },
    {
      id: "zelle",
      nombre: "Zelle",
      moneda: "USD",
      activo: true,
      orden: 3,
      datos: [{ etiqueta: "Correo", valor: "pagos@rutaclara.ve", copiable: true }],
      campos_requeridos: ["referencia", "fecha_pago"],
      requiere_comprobante: true,
      instrucciones:
        "Envía el pago en dólares al correo indicado y reporta la referencia del correo de confirmación.",
    },
    {
      id: "efectivo",
      nombre: "Efectivo",
      moneda: "USD",
      activo: true,
      orden: 4,
      datos: [{ etiqueta: "Caja", valor: "Mostrador Ruta Clara, Av. Libertador" }],
      campos_requeridos: ["referencia"],
      requiere_comprobante: false,
      instrucciones:
        "Paga en la agencia. El operador registra el pago en efectivo y emite el recibo interno.",
    },
    {
      id: "binance",
      nombre: "Binance Pay",
      moneda: "USD",
      activo: true,
      orden: 5,
      datos: [{ etiqueta: "Binance ID", valor: "842199553", copiable: true }],
      campos_requeridos: ["referencia", "fecha_pago"],
      requiere_comprobante: true,
      instrucciones:
        "Paga con Binance Pay usando el ID indicado y reporta el ID de la transacción.",
    },
  ];
}

function crearTasa(ahora: number): TasaCambio[] {
  return [
    {
      id: "tasa_03650",
      valor: "36.50",
      registrada_por: "Manuel Rodríguez",
      registrada_en: fechaIso(ahora, -2),
      vigente: true,
    },
    {
      id: "tasa_03600",
      valor: "36.00",
      registrada_por: "Manuel Rodríguez",
      registrada_en: fechaIso(ahora, -9),
      vigente: false,
    },
  ];
}

// ---------------------------------------------------------------------------
// Reservas
// ---------------------------------------------------------------------------

interface SemillaPasajero {
  nombre: string;
  tipo_doc: Pasajero["tipo_doc"];
  documento: string;
  fecha_nacimiento: string;
  categoria: Categoria;
  almuerzo?: string;
  tiene_alergias?: boolean;
  detalle_alergias?: string;
  menu_infantil?: string;
}

/** Etiquetas de vencimiento para no repetir literales ISO en el seed. */
type EtiquetaVencimiento =
  | "enlace"
  | "enlace_vencido"
  | "hold_23h"
  | "hold_1h30"
  | "hold_25m"
  | "hold_20h"
  | "hold_5h"
  | "congelado";

interface SemillaReserva {
  id: string;
  codigo: string;
  ref_corta: string;
  tour_id: string;
  fecha_tour_id: string;
  formulario_id: string;
  estado: EstadoReserva;
  estado_pago: Reserva["estado_pago"];
  paso_actual: Reserva["paso_actual"];
  pasajeros: SemillaPasajero[];
  punto_abordaje?: string;
  toldo?: number;
  comentarios?: string;
  saldo_manual?: string;
  tasa_aplicada?: string | null;
  vencimiento?: EtiquetaVencimiento;
  referencia_interna?: string;
  requiere_accion?: string;
  motivo_cierre?: string;
  promocion?: { codigo: string; tipo: "porcentaje" | "monto"; valor: number };
  firma?: boolean;
  voucher?: { version: number; vigente: boolean; verif_token: string };
  creado_dias: number;
  actividad_min: number;
}

const SEMILLAS_RESERVAS: SemillaReserva[] = [
  {
    id: "res_001",
    codigo: "VJ-2026-00101",
    ref_corta: "K7M2QX9A",
    tour_id: "tour_roques",
    fecha_tour_id: "fch_roq_03",
    formulario_id: "form_roques",
    estado: "enlace_creado",
    estado_pago: "sin_pago",
    paso_actual: "paso_registro",
    pasajeros: [],
    referencia_interna: "Carlos Márquez",
    vencimiento: "enlace",
    creado_dias: 0,
    actividad_min: 12,
  },
  {
    id: "res_002",
    codigo: "VJ-2026-00102",
    ref_corta: "R4T8NMB2",
    tour_id: "tour_roques",
    fecha_tour_id: "fch_roq_04",
    formulario_id: "form_roques",
    estado: "en_registro",
    estado_pago: "sin_pago",
    paso_actual: "titular",
    pasajeros: [
      {
        nombre: "Yajaira Colmenares",
        tipo_doc: "V",
        documento: "19332245",
        fecha_nacimiento: "1986-04-17",
        categoria: "Adulto",
      },
    ],
    referencia_interna: "Yajaira Colmenares",
    creado_dias: 1,
    actividad_min: 95,
  },
  {
    id: "res_003",
    codigo: "VJ-2026-00103",
    ref_corta: "W9C3DLF5",
    tour_id: "tour_colonia",
    fecha_tour_id: "fch_col_01",
    formulario_id: "form_colonia",
    estado: "en_registro",
    estado_pago: "sin_pago",
    paso_actual: "acompanantes",
    pasajeros: [
      {
        nombre: "José Gil",
        tipo_doc: "V",
        documento: "10233445",
        fecha_nacimiento: "1985-03-14",
        categoria: "Adulto",
        almuerzo: "pollo",
      },
      {
        nombre: "Rosa Hernández",
        tipo_doc: "V",
        documento: "10233446",
        fecha_nacimiento: "2015-06-09",
        categoria: "Niño",
        almuerzo: "vegetariano",
      },
    ],
    punto_abordaje: "altamira",
    promocion: { codigo: "BIENVENIDA10", tipo: "porcentaje", valor: 10 },
    creado_dias: 2,
    actividad_min: 40,
  },
  {
    id: "res_004",
    codigo: "VJ-2026-00104",
    ref_corta: "Z5H7QPX3",
    tour_id: "tour_merida",
    fecha_tour_id: "fch_mer_01",
    formulario_id: "form_merida",
    estado: "en_registro",
    estado_pago: "sin_pago",
    paso_actual: "preguntas",
    pasajeros: [
      {
        nombre: "Pedro Salazar",
        tipo_doc: "V",
        documento: "16554433",
        fecha_nacimiento: "1978-11-02",
        categoria: "Adulto",
        almuerzo: "pescado",
      },
      {
        nombre: "Andrea Ríos",
        tipo_doc: "V",
        documento: "16554434",
        fecha_nacimiento: "1979-05-21",
        categoria: "Adulto",
        almuerzo: "pescado",
        tiene_alergias: true,
        detalle_alergias: "Alergia al camarón y a los moluscos.",
      },
    ],
    punto_abordaje: "el_paraiso",
    creado_dias: 3,
    actividad_min: 130,
  },
  {
    id: "res_005",
    codigo: "VJ-2026-00105",
    ref_corta: "B2N4VKM7",
    tour_id: "tour_roques",
    fecha_tour_id: "fch_roq_05",
    formulario_id: "form_roques",
    estado: "pendiente_firma",
    estado_pago: "sin_pago",
    paso_actual: "firma",
    pasajeros: [
      {
        nombre: "Ramón Torres",
        tipo_doc: "V",
        documento: "12001122",
        fecha_nacimiento: "1990-01-30",
        categoria: "Adulto",
        almuerzo: "pescado",
      },
      {
        nombre: "Isabel Ferrer",
        tipo_doc: "V",
        documento: "12001123",
        fecha_nacimiento: "1991-09-12",
        categoria: "Adulto",
        almuerzo: "vegetariano",
        tiene_alergias: true,
        detalle_alergias: "Intolerancia a la lactosa.",
      },
      {
        nombre: "Milagros Suárez",
        tipo_doc: "V",
        documento: "12001124",
        fecha_nacimiento: "2016-04-04",
        categoria: "Niño",
        almuerzo: "pollo",
        menu_infantil: "sandwich_pollo",
      },
    ],
    punto_abordaje: "petare",
    toldo: 1,
    comentarios: "Una Carry-On y un coche de bebé, por favor.",
    vencimiento: "hold_20h",
    creado_dias: 1,
    actividad_min: 55,
  },
  {
    id: "res_006",
    codigo: "VJ-2026-00106",
    ref_corta: "M6X8TDR3",
    tour_id: "tour_colonia",
    fecha_tour_id: "fch_col_02",
    formulario_id: "form_colonia",
    estado: "pendiente_firma",
    estado_pago: "sin_pago",
    paso_actual: "firma",
    pasajeros: [
      {
        nombre: "Gustavo Rincón",
        tipo_doc: "V",
        documento: "13998877",
        fecha_nacimiento: "1965-08-18",
        categoria: "Tercera Edad",
        almuerzo: "pescado",
      },
    ],
    punto_abordaje: "plaza_caracas",
    vencimiento: "hold_5h",
    creado_dias: 1,
    actividad_min: 200,
  },
  {
    id: "res_007",
    codigo: "VJ-2026-00107",
    ref_corta: "P3V9KZJ6",
    tour_id: "tour_roques",
    fecha_tour_id: "fch_roq_03",
    formulario_id: "form_roques",
    estado: "pendiente_pago",
    estado_pago: "sin_pago",
    paso_actual: "pago",
    pasajeros: [
      {
        nombre: "Carmen Díaz",
        tipo_doc: "V",
        documento: "15550111",
        fecha_nacimiento: "1988-02-26",
        categoria: "Adulto",
        almuerzo: "pescado",
      },
      {
        nombre: "Luis Bracho",
        tipo_doc: "V",
        documento: "15550112",
        fecha_nacimiento: "2012-07-15",
        categoria: "Niño",
        almuerzo: "pollo",
        menu_infantil: "jugo_emparedado",
      },
    ],
    punto_abordaje: "altamira",
    toldo: 2,
    vencimiento: "hold_23h",
    creado_dias: 1,
    actividad_min: 70,
  },
  {
    id: "res_008",
    codigo: "VJ-2026-00108",
    ref_corta: "F5L2WQH8",
    tour_id: "tour_merida",
    fecha_tour_id: "fch_mer_02",
    formulario_id: "form_merida",
    estado: "pendiente_pago",
    estado_pago: "sin_pago",
    paso_actual: "pago",
    pasajeros: [
      {
        nombre: "María Pérez",
        tipo_doc: "V",
        documento: "18447788",
        fecha_nacimiento: "1993-10-05",
        categoria: "Adulto",
        almuerzo: "pollo",
      },
      {
        nombre: "Juan Pérez",
        tipo_doc: "V",
        documento: "18447789",
        fecha_nacimiento: "1962-12-01",
        categoria: "Tercera Edad",
        almuerzo: "pescado",
      },
    ],
    punto_abordaje: "altamira",
    vencimiento: "hold_1h30",
    creado_dias: 1,
    actividad_min: 25,
  },
  {
    id: "res_009",
    codigo: "VJ-2026-00109",
    ref_corta: "T8D1NMB4",
    tour_id: "tour_roques",
    fecha_tour_id: "fch_roq_02",
    formulario_id: "form_roques_v1",
    estado: "pendiente_pago",
    estado_pago: "sin_pago",
    paso_actual: "pago",
    pasajeros: [
      {
        nombre: "Yajaira Colmenares",
        tipo_doc: "V",
        documento: "19332244",
        fecha_nacimiento: "1982-05-19",
        categoria: "Adulto",
        almuerzo: "vegetariano",
      },
    ],
    punto_abordaje: "plaza_caracas",
    vencimiento: "hold_25m",
    creado_dias: 1,
    actividad_min: 8,
  },
  {
    id: "res_010",
    codigo: "VJ-2026-00110",
    ref_corta: "H4Q7ZVK2",
    tour_id: "tour_roques",
    fecha_tour_id: "fch_roq_03",
    formulario_id: "form_roques",
    estado: "pago_en_verificacion",
    estado_pago: "reportado",
    paso_actual: "verificacion",
    pasajeros: [
      {
        nombre: "Andrea Ríos",
        tipo_doc: "V",
        documento: "20778899",
        fecha_nacimiento: "1996-09-08",
        categoria: "Adulto",
        almuerzo: "pescado",
      },
    ],
    punto_abordaje: "petare",
    vencimiento: "congelado",
    creado_dias: 2,
    actividad_min: 45,
  },
  {
    id: "res_011",
    codigo: "VJ-2026-00111",
    ref_corta: "V9C3MBT6",
    tour_id: "tour_colonia",
    fecha_tour_id: "fch_col_03",
    formulario_id: "form_colonia",
    estado: "pago_en_verificacion",
    estado_pago: "reportado",
    paso_actual: "verificacion",
    pasajeros: [
      {
        nombre: "Rosa Hernández",
        tipo_doc: "V",
        documento: "21556677",
        fecha_nacimiento: "1987-04-22",
        categoria: "Adulto",
        almuerzo: "pollo",
      },
      {
        nombre: "José Gil",
        tipo_doc: "V",
        documento: "21556678",
        fecha_nacimiento: "2014-08-11",
        categoria: "Niño",
        almuerzo: "vegetariano",
      },
    ],
    punto_abordaje: "plaza_caracas",
    requiere_accion: "Falta validar el comprobante del titular",
    vencimiento: "congelado",
    creado_dias: 2,
    actividad_min: 150,
  },
  {
    id: "res_012",
    codigo: "VJ-2026-00112",
    ref_corta: "J6X2RTF9",
    tour_id: "tour_roques",
    fecha_tour_id: "fch_roq_02",
    formulario_id: "form_roques",
    estado: "confirmada",
    estado_pago: "pagado",
    paso_actual: "confirmada",
    pasajeros: [
      {
        nombre: "María Pérez",
        tipo_doc: "V",
        documento: "24680123",
        fecha_nacimiento: "1990-01-15",
        categoria: "Adulto",
        almuerzo: "pescado",
      },
      {
        nombre: "Juan Pérez",
        tipo_doc: "V",
        documento: "24680124",
        fecha_nacimiento: "2013-05-30",
        categoria: "Niño",
        almuerzo: "pollo",
        menu_infantil: "pasta",
      },
    ],
    punto_abordaje: "altamira",
    toldo: 1,
    comentarios: "Preferimos el asiento delantero en la lancha.",
    tasa_aplicada: "36.50",
    firma: true,
    voucher: { version: 1, vigente: true, verif_token: "qr-confirmada" },
    creado_dias: 6,
    actividad_min: 2880,
  },
  {
    id: "res_013",
    codigo: "VJ-2026-00113",
    ref_corta: "N7Q1MKZ4",
    tour_id: "tour_merida",
    fecha_tour_id: "fch_mer_01",
    formulario_id: "form_merida",
    estado: "confirmada",
    estado_pago: "pagado",
    paso_actual: "confirmada",
    pasajeros: [
      {
        nombre: "Pedro Salazar",
        tipo_doc: "V",
        documento: "25990555",
        fecha_nacimiento: "1975-02-11",
        categoria: "Adulto",
        almuerzo: "pollo",
      },
      {
        nombre: "Milagros Suárez",
        tipo_doc: "V",
        documento: "25990556",
        fecha_nacimiento: "1948-07-19",
        categoria: "Tercera Edad",
        almuerzo: "pescado",
      },
    ],
    punto_abordaje: "el_paraiso",
    tasa_aplicada: "36.50",
    firma: true,
    voucher: { version: 1, vigente: true, verif_token: "qr-reprogramada" },
    creado_dias: 9,
    actividad_min: 4320,
  },
  {
    id: "res_014",
    codigo: "VJ-2026-00114",
    ref_corta: "C4W8PZD6",
    tour_id: "tour_roques",
    fecha_tour_id: "fch_roq_04",
    formulario_id: "form_roques",
    estado: "confirmada",
    estado_pago: "parcial",
    paso_actual: "confirmada",
    pasajeros: [
      {
        nombre: "Carlos Márquez",
        tipo_doc: "V",
        documento: "27011233",
        fecha_nacimiento: "1983-10-25",
        categoria: "Adulto",
        almuerzo: "pescado",
      },
      {
        nombre: "Andrea Ríos",
        tipo_doc: "V",
        documento: "27011234",
        fecha_nacimiento: "1985-03-04",
        categoria: "Adulto",
        almuerzo: "vegetariano",
      },
    ],
    punto_abordaje: "petare",
    toldo: 1,
    saldo_manual: "65.00",
    tasa_aplicada: "36.50",
    firma: true,
    voucher: { version: 1, vigente: true, verif_token: "qr-parcial" },
    creado_dias: 4,
    actividad_min: 1440,
  },
  {
    id: "res_015",
    codigo: "VJ-2026-00115",
    ref_corta: "S3F6NKY8",
    tour_id: "tour_colonia",
    fecha_tour_id: "fch_col_01",
    formulario_id: "form_colonia",
    estado: "confirmada",
    estado_pago: "pagado",
    paso_actual: "confirmada",
    pasajeros: [
      {
        nombre: "Gustavo Rincón",
        tipo_doc: "V",
        documento: "28330444",
        fecha_nacimiento: "1970-06-08",
        categoria: "Adulto",
        almuerzo: "pescado",
      },
    ],
    punto_abordaje: "altamira",
    tasa_aplicada: "36.50",
    firma: true,
    voucher: { version: 1, vigente: true, verif_token: "qr-colonia" },
    creado_dias: 7,
    actividad_min: 5760,
  },
  {
    id: "res_016",
    codigo: "VJ-2026-00116",
    ref_corta: "A9H2VQM7",
    tour_id: "tour_roques",
    fecha_tour_id: "fch_roq_05",
    formulario_id: "form_roques",
    estado: "cancelada",
    estado_pago: "reembolsado",
    paso_actual: "cerrada",
    pasajeros: [
      {
        nombre: "Ramón Torres",
        tipo_doc: "V",
        documento: "29115566",
        fecha_nacimiento: "1986-03-09",
        categoria: "Adulto",
        almuerzo: "pollo",
      },
    ],
    punto_abordaje: "altamira",
    saldo_manual: "0.00",
    tasa_aplicada: "36.50",
    motivo_cierre: "La reserva fue cancelada por el titular",
    referencia_interna: "Pedro Salazar",
    firma: true,
    voucher: { version: 1, vigente: false, verif_token: "qr-cancelada" },
    creado_dias: 11,
    actividad_min: 7200,
  },
  {
    id: "res_017",
    codigo: "VJ-2026-00117",
    ref_corta: "E5R3KZB9",
    tour_id: "tour_merida",
    fecha_tour_id: "fch_mer_03",
    formulario_id: "form_merida",
    estado: "expirada",
    estado_pago: "sin_pago",
    paso_actual: "cerrada",
    pasajeros: [
      {
        nombre: "Isabel Ferrer",
        tipo_doc: "V",
        documento: "30446677",
        fecha_nacimiento: "1994-08-30",
        categoria: "Adulto",
        almuerzo: "vegetariano",
      },
    ],
    punto_abordaje: "plaza_caracas",
    motivo_cierre: "Venció el plazo de pago; el cupo fue liberado.",
    creado_dias: 5,
    actividad_min: 7200,
  },
  {
    id: "res_018",
    codigo: "VJ-2026-00118",
    ref_corta: "Y7M6NDF2",
    tour_id: "tour_roques",
    fecha_tour_id: "fch_roq_01",
    formulario_id: "form_roques_v1",
    estado: "completada",
    estado_pago: "pagado",
    paso_actual: "cerrada",
    pasajeros: [
      {
        nombre: "Ramón Torres",
        tipo_doc: "V",
        documento: "31227788",
        fecha_nacimiento: "1980-11-17",
        categoria: "Adulto",
        almuerzo: "pescado",
      },
      {
        nombre: "Isabel Ferrer",
        tipo_doc: "V",
        documento: "31227789",
        fecha_nacimiento: "1982-01-25",
        categoria: "Adulto",
        almuerzo: "pescado",
      },
    ],
    punto_abordaje: "altamira",
    tasa_aplicada: "36.50",
    motivo_cierre: "La salida se realizó y el grupo retornó a Caracas.",
    firma: true,
    voucher: { version: 1, vigente: true, verif_token: "qr-completada" },
    creado_dias: 20,
    actividad_min: 14400,
  },
  {
    // El enlace caducó sin que el cliente iniciara el registro (RF-4.4).
    // Escenario de la pantalla P-10 «Tu enlace venció» (410).
    id: "res_019",
    codigo: "VJ-2026-00119",
    ref_corta: "H3W8QPL5",
    tour_id: "tour_roques",
    fecha_tour_id: "fch_roq_05",
    formulario_id: "form_roques",
    estado: "enlace_creado",
    estado_pago: "sin_pago",
    paso_actual: "paso_registro",
    pasajeros: [],
    referencia_interna: "Enlace caducado (demo)",
    vencimiento: "enlace_vencido",
    creado_dias: 4,
    actividad_min: 5760,
  },
];

/** Calcula `expira_en` según la etiqueta de la semilla. */
function calcularExpiraEn(etiqueta: EtiquetaVencimiento | undefined, ahora: number): string | null {
  switch (etiqueta) {
    case "enlace":
      return fechaIso(ahora, 0, 70);
    case "enlace_vencido":
      // El enlace caducó sin que el cliente iniciara el registro (RF-4.4).
      return fechaIso(ahora, -1, 0);
    case "hold_23h":
      return fechaIso(ahora, 0, 23);
    case "hold_1h30":
      return fechaIso(ahora, 0, 1, 30);
    case "hold_25m":
      return fechaIso(ahora, 0, 0, 25);
    case "hold_20h":
      return fechaIso(ahora, 0, 20);
    case "hold_5h":
      return fechaIso(ahora, 0, 5);
    case "congelado":
      // El vencimiento se congela mientras hay un pago por validar.
      return null;
    default:
      return null;
  }
}

/**
 * Descuento de un código promocional sobre la base (subtotal + adicionales).
 * Usa la misma fórmula que `calcularPrecio` (`@/lib/domain/pricing`).
 */
function calcularDescuento(
  promocion: { tipo: "porcentaje" | "monto"; valor: number },
  base: string,
): string {
  if (promocion.tipo === "porcentaje") {
    return multiplyDecimal(base, promocion.valor / 100);
  }
  const baseNumero = Number.parseFloat(base);
  const valor = Math.min(promocion.valor, Number.isFinite(baseNumero) ? baseNumero : 0);
  return valor.toFixed(2);
}

function crearReservas(
  ahora: number,
  tarifas: Tarifa[],
  terminosActiva: string,
  rng: () => number,
): Reserva[] {
  const precioPorFechaCategoria = new Map<string, string>();
  for (const tarifa of tarifas) {
    precioPorFechaCategoria.set(`${tarifa.fecha_tour_id}|${tarifa.categoria}`, tarifa.precio_usd);
  }

  return SEMILLAS_RESERVAS.map((semilla) => {
    const pasajeros: Pasajero[] = semilla.pasajeros.map((semillaPasajero, indice) => {
      const respuestas: Pasajero["respuestas"] = {};
      if (semillaPasajero.almuerzo !== undefined) {
        respuestas["almuerzo"] = semillaPasajero.almuerzo;
      }
      if (semillaPasajero.tiene_alergias !== undefined) {
        respuestas["tiene_alergias"] = semillaPasajero.tiene_alergias;
      }
      if (semillaPasajero.detalle_alergias !== undefined) {
        respuestas["detalle_alergias"] = semillaPasajero.detalle_alergias;
      }
      if (semillaPasajero.menu_infantil !== undefined) {
        respuestas["menu_infantil"] = semillaPasajero.menu_infantil;
      }

      return {
        ref_cliente: uuidDesde(rng),
        es_titular: indice === 0,
        nombre: semillaPasajero.nombre,
        tipo_doc: semillaPasajero.tipo_doc,
        documento: semillaPasajero.documento,
        fecha_nacimiento: semillaPasajero.fecha_nacimiento,
        categoria: semillaPasajero.categoria,
        respuestas,
      };
    });

    const respuestas_globales: Reserva["respuestas_globales"] = {};
    if (semilla.punto_abordaje !== undefined) {
      respuestas_globales["punto_abordaje"] = semilla.punto_abordaje;
    }
    if (semilla.toldo !== undefined) {
      respuestas_globales["toldo"] = semilla.toldo;
    }
    if (semilla.comentarios !== undefined) {
      respuestas_globales["comentarios"] = semilla.comentarios;
    }

    // El total se calcula con las tarifas de la fecha (PRD §11): subtotal por
    // pasajero + adicionales (toldo) - descuentos.
    const subtotal = sumarDecimales(
      pasajeros.map(
        (pasajero) =>
          precioPorFechaCategoria.get(`${semilla.fecha_tour_id}|${pasajero.categoria}`) ?? "0.00",
      ),
    );
    const adicionales = semilla.toldo !== undefined ? (semilla.toldo * 10).toFixed(2) : "0.00";
    const base = sumarDecimales([subtotal, adicionales]);

    const descuento = semilla.promocion ? calcularDescuento(semilla.promocion, base) : "0.00";
    const total_usd = sumarDecimales([base, `-${descuento}`]);

    const saldo_usd =
      semilla.saldo_manual ??
      (semilla.estado_pago === "pagado" || semilla.estado_pago === "reembolsado"
        ? "0.00"
        : total_usd);

    const reserva: Reserva = {
      id: semilla.id,
      codigo: semilla.codigo,
      ref_corta: semilla.ref_corta,
      tour_id: semilla.tour_id,
      fecha_tour_id: semilla.fecha_tour_id,
      formulario_id: semilla.formulario_id,
      estado: semilla.estado,
      estado_pago: semilla.estado_pago,
      pasajeros,
      respuestas_globales,
      total_usd,
      saldo_usd,
      tasa_aplicada: semilla.tasa_aplicada ?? null,
      expira_en: calcularExpiraEn(semilla.vencimiento, ahora),
      version: 1,
      paso_actual: semilla.paso_actual,
      creado_en: fechaIso(ahora, -semilla.creado_dias),
      ultima_actividad_en: fechaIso(ahora, 0, 0, -semilla.actividad_min),
    };

    if (semilla.referencia_interna !== undefined) {
      reserva.referencia_interna = semilla.referencia_interna;
    }
    if (semilla.requiere_accion !== undefined) {
      reserva.requiere_accion = semilla.requiere_accion;
    }
    if (semilla.motivo_cierre !== undefined) {
      reserva.motivo_cierre = semilla.motivo_cierre;
    }
    if (semilla.promocion !== undefined) {
      reserva.promocion = {
        codigo: semilla.promocion.codigo,
        tipo: semilla.promocion.tipo,
        valor: semilla.promocion.valor,
        descuento_usd: descuento,
      };
    }
    if (semilla.firma === true) {
      reserva.firma = {
        id: `firma_${semilla.id}`,
        hash_imagen: hashSimulado(`firma-imagen-${semilla.id}`),
        hash_documento: hashSimulado(`terminos-${terminosActiva}`),
        version_terminos_id: terminosActiva,
        firmada_en: fechaIso(ahora, -semilla.creado_dias, 1),
        ip: "190.113.44.21",
        user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)",
        n_trazos: 42,
        longitud_px: 612,
        duracion_ms: 8400,
        integridad: "ok",
        preview: "data:image/svg+xml;base64,PHN2Zy8+",
      };
      reserva.terminos_version_id = terminosActiva;
    }
    if (semilla.voucher !== undefined) {
      reserva.voucher = {
        id: `vou_${semilla.id}`,
        version: semilla.voucher.version,
        estado: "listo",
        vigente: semilla.voucher.vigente,
        generado_en: fechaIso(ahora, -semilla.creado_dias, 2),
        verif_token: semilla.voucher.verif_token,
      };
    }

    return reserva;
  });
}

// ---------------------------------------------------------------------------
// Pagos
// ---------------------------------------------------------------------------

interface SemillaPago {
  id: string;
  reserva_id: string;
  metodo: MetodoPagoId;
  monto: string;
  moneda: "USD" | "VES";
  tasa: string | null;
  referencia: string;
  estado: Pago["estado"];
  motivo_rechazo?: string;
  comentario_validador?: string;
  duplicado_de_pago_id?: string;
  alertas: { codigo: string; mensaje: string }[];
  registrado_por?: string;
  validado_por?: string;
  dias: number;
  horas: number;
  comprobante?: { nombre: string; tipo: string; tamano: number };
}

const SEMILLAS_PAGOS: SemillaPago[] = [
  {
    id: "pag_001",
    reserva_id: "res_010",
    metodo: "zelle",
    monto: "55.00",
    moneda: "USD",
    tasa: "36.50",
    referencia: "ZL-884512",
    estado: "reportado",
    alertas: [
      { codigo: "duplicado_referencia", mensaje: "Esta referencia ya se usó en otra reserva" },
    ],
    duplicado_de_pago_id: "pag_004",
    registrado_por: "Andrea Ríos",
    dias: 2,
    horas: 1,
    comprobante: { nombre: "comprobante-zelle.png", tipo: "image/png", tamano: 184320 },
  },
  {
    id: "pag_002",
    reserva_id: "res_011",
    metodo: "pago_movil",
    monto: "3200.00",
    moneda: "VES",
    tasa: "36.50",
    referencia: "PM-20261103-4471",
    estado: "reportado",
    alertas: [],
    registrado_por: "Rosa Hernández",
    dias: 2,
    horas: 3,
    comprobante: { nombre: "captura-pago-movil.jpg", tipo: "image/jpeg", tamano: 245760 },
  },
  {
    id: "pag_003",
    reserva_id: "res_012",
    metodo: "transferencia",
    monto: "100.00",
    moneda: "USD",
    tasa: "36.50",
    referencia: "BMG-00041188",
    estado: "aprobado",
    alertas: [],
    validado_por: "Luis Bracho",
    dias: 6,
    horas: 4,
    comprobante: {
      nombre: "transferencia-bancamiga.pdf",
      tipo: "application/pdf",
      tamano: 1048576,
    },
  },
  {
    id: "pag_004",
    reserva_id: "res_014",
    metodo: "transferencia",
    monto: "55.00",
    moneda: "USD",
    tasa: "36.50",
    referencia: "ZL-884512",
    estado: "aprobado",
    alertas: [],
    validado_por: "Luis Bracho",
    dias: 4,
    horas: 6,
  },
  {
    id: "pag_005",
    reserva_id: "res_013",
    metodo: "binance",
    monto: "170.00",
    moneda: "USD",
    tasa: "36.50",
    referencia: "BIN-99827341",
    estado: "aprobado",
    alertas: [],
    validado_por: "Manuel Rodríguez",
    dias: 9,
    horas: 2,
  },
  {
    id: "pag_006",
    reserva_id: "res_015",
    metodo: "efectivo",
    monto: "50.00",
    moneda: "USD",
    tasa: null,
    referencia: "EFE-000231",
    estado: "aprobado",
    alertas: [],
    registrado_por: "Carmen Díaz",
    validado_por: "Carmen Díaz",
    dias: 7,
    horas: 5,
  },
  {
    id: "pag_007",
    reserva_id: "res_016",
    metodo: "zelle",
    monto: "55.00",
    moneda: "USD",
    tasa: "36.50",
    referencia: "ZL-771209",
    estado: "rechazado",
    motivo_rechazo: "comprobante_ilegible",
    comentario_validador:
      "La captura del comprobante está borrosa y no se lee la referencia. Vuelve a subirla, por favor.",
    alertas: [],
    dias: 11,
    horas: 7,
    comprobante: { nombre: "comprobante-oscuro.jpg", tipo: "image/jpeg", tamano: 92160 },
  },
  {
    id: "pag_008",
    reserva_id: "res_016",
    metodo: "zelle",
    monto: "55.00",
    moneda: "USD",
    tasa: "36.50",
    referencia: "ZL-884201",
    estado: "aprobado",
    alertas: [],
    validado_por: "Luis Bracho",
    dias: 11,
    horas: 9,
  },
  {
    id: "pag_009",
    reserva_id: "res_018",
    metodo: "efectivo",
    monto: "110.00",
    moneda: "USD",
    tasa: null,
    referencia: "EFE-000198",
    estado: "aprobado",
    alertas: [],
    registrado_por: "Carmen Díaz",
    validado_por: "Carmen Díaz",
    dias: 20,
    horas: 2,
  },
  {
    id: "pag_010",
    reserva_id: "res_014",
    metodo: "pago_movil",
    monto: "4562.50",
    moneda: "VES",
    tasa: "36.50",
    referencia: "PM-20261028-9913",
    estado: "correccion_solicitada",
    comentario_validador:
      "El monto reportado no coincide con el abono pendiente. Confirma el valor transferido.",
    alertas: [],
    registrado_por: "Carlos Márquez",
    dias: 4,
    horas: 4,
    comprobante: { nombre: "pago-movil-parcial.jpg", tipo: "image/jpeg", tamano: 143360 },
  },
];

function crearPagos(ahora: number): Pago[] {
  return SEMILLAS_PAGOS.map((semilla) => {
    const pago: Pago = {
      id: semilla.id,
      reserva_id: semilla.reserva_id,
      metodo: semilla.metodo,
      monto: semilla.monto,
      moneda: semilla.moneda,
      tasa: semilla.tasa,
      fecha_pago: fechaIso(ahora, -semilla.dias, -semilla.horas),
      referencia: semilla.referencia,
      estado: semilla.estado,
      alertas: semilla.alertas,
      creado_en: fechaIso(ahora, -semilla.dias, -semilla.horas),
    };

    if (semilla.motivo_rechazo !== undefined) pago.motivo_rechazo = semilla.motivo_rechazo;
    if (semilla.comentario_validador !== undefined) {
      pago.comentario_validador = semilla.comentario_validador;
    }
    if (semilla.duplicado_de_pago_id !== undefined) {
      pago.duplicado_de_pago_id = semilla.duplicado_de_pago_id;
    }
    if (semilla.registrado_por !== undefined) pago.registrado_por = semilla.registrado_por;
    if (semilla.validado_por !== undefined) {
      pago.validado_por = semilla.validado_por;
      pago.validado_en = fechaIso(ahora, -semilla.dias, -semilla.horas + 2);
    }
    if (semilla.comprobante !== undefined) {
      pago.comprobante = { ...semilla.comprobante };
    }

    return pago;
  });
}

// ---------------------------------------------------------------------------
// Auditoría y notificaciones
// ---------------------------------------------------------------------------

function crearAuditoria(ahora: number): Auditoria[] {
  const entradas: Omit<Auditoria, "id" | "cadena">[] = [
    {
      usuario_id: "usr_val_1",
      usuario_nombre: "Luis Bracho",
      entidad: "pago",
      entidad_id: "pag_003",
      accion: "pago.aprobado",
      valor_anterior: "reportado",
      valor_nuevo: "aprobado",
      fecha: fechaIso(ahora, -6, -4),
      motivo: "Referencia y monto coinciden con la transferencia.",
    },
    {
      usuario_id: "usr_val_1",
      usuario_nombre: "Luis Bracho",
      entidad: "pago",
      entidad_id: "pag_004",
      accion: "pago.aprobado",
      valor_anterior: "reportado",
      valor_nuevo: "aprobado",
      fecha: fechaIso(ahora, -4, -6),
    },
    {
      usuario_id: "usr_val_1",
      usuario_nombre: "Luis Bracho",
      entidad: "pago",
      entidad_id: "pag_007",
      accion: "pago.rechazado",
      valor_anterior: "reportado",
      valor_nuevo: "rechazado",
      fecha: fechaIso(ahora, -11, -7),
      motivo: "Comprobante ilegible.",
    },
    {
      usuario_id: "usr_op_1",
      usuario_nombre: "Carmen Díaz",
      entidad: "reserva",
      entidad_id: "res_016",
      accion: "reserva.cancelada",
      valor_anterior: "confirmada",
      valor_nuevo: "cancelada",
      fecha: fechaIso(ahora, -11, -5),
      motivo: "La reserva fue cancelada por el titular",
    },
    {
      usuario_id: "usr_op_1",
      usuario_nombre: "Carmen Díaz",
      entidad: "reserva",
      entidad_id: "res_010",
      accion: "datos.revelados",
      valor_anterior: "V-****4455",
      valor_nuevo: "V-20778899",
      fecha: fechaIso(ahora, -2, -2),
      motivo: "Verificación del comprobante de pago.",
    },
    {
      usuario_id: "usr_op_1",
      usuario_nombre: "Carmen Díaz",
      entidad: "reserva",
      entidad_id: "res_009",
      accion: "enlace.regenerado",
      valor_anterior: "enlace-oculto-001",
      valor_nuevo: "enlace-nuevo-002",
      fecha: fechaIso(ahora, -1, -3),
      motivo: "El cliente no recibía el enlace por WhatsApp.",
    },
    {
      usuario_id: "usr_sa_1",
      usuario_nombre: "Manuel Rodríguez",
      entidad: "formulario",
      entidad_id: "form_roques_v2",
      accion: "formulario.publicado",
      valor_anterior: "v1",
      valor_nuevo: "v2",
      fecha: fechaIso(ahora, -12),
      motivo: "Se agregó el menú infantil y el alquiler de toldo.",
    },
    {
      usuario_id: "usr_sa_1",
      usuario_nombre: "Manuel Rodríguez",
      entidad: "configuracion",
      entidad_id: "tasa_03650",
      accion: "tasa.registrada",
      valor_anterior: "36.00",
      valor_nuevo: "36.50",
      fecha: fechaIso(ahora, -2),
    },
    {
      usuario_id: "usr_val_1",
      usuario_nombre: "Luis Bracho",
      entidad: "pago",
      entidad_id: "pag_010",
      accion: "pago.correccion_solicitada",
      valor_anterior: "reportado",
      valor_nuevo: "correccion_solicitada",
      fecha: fechaIso(ahora, -4, -4),
      motivo: "El monto reportado no coincide con el saldo pendiente.",
    },
    {
      usuario_id: "usr_sa_1",
      usuario_nombre: "Manuel Rodríguez",
      entidad: "reserva",
      entidad_id: "res_013",
      accion: "reserva.reprogramada",
      valor_anterior: "fch_mer_03",
      valor_nuevo: "fch_mer_01",
      fecha: fechaIso(ahora, -9, -2),
      motivo: "Reprogramada al 2026-12-20",
    },
    {
      usuario_id: "usr_op_1",
      usuario_nombre: "Carmen Díaz",
      entidad: "reserva",
      entidad_id: "res_012",
      accion: "voucher.emitido",
      valor_anterior: "generando",
      valor_nuevo: "listo",
      fecha: fechaIso(ahora, -6, -2),
    },
    {
      usuario_id: "usr_sa_1",
      usuario_nombre: "Manuel Rodríguez",
      entidad: "usuario",
      entidad_id: "usr_sa_0",
      accion: "usuario.desactivado",
      valor_anterior: "activo",
      valor_nuevo: "inactivo",
      fecha: fechaIso(ahora, -30),
      motivo: "Renuncia del superadministrador anterior.",
    },
    {
      usuario_id: "usr_val_1",
      usuario_nombre: "Luis Bracho",
      entidad: "pago",
      entidad_id: "pag_001",
      accion: "pago.marcado_duplicado",
      valor_anterior: "ZL-884512",
      valor_nuevo: "ZL-884512",
      fecha: fechaIso(ahora, -2, -1),
      motivo: "La referencia ya fue usada en la reserva VJ-2026-00114.",
    },
  ];

  return entradas.map((entrada, indice) => ({
    ...entrada,
    id: `aud_${String(indice + 1).padStart(3, "0")}`,
    cadena: "ok",
  }));
}

function crearNotificaciones(ahora: number): Notificacion[] {
  const notificaciones: Omit<Notificacion, "id">[] = [
    {
      tipo: "pago",
      titulo: "Pago reportado por verificar",
      detalle: "Andrea Ríos reportó un pago de $55.00 con Zelle para Full Day Los Roques.",
      entidad_id: "pag_001",
      leida: false,
      fecha: fechaIso(ahora, -2, -1),
    },
    {
      tipo: "pago",
      titulo: "Referencia duplicada detectada",
      detalle: "La referencia ZL-884512 aparece en dos pagos. Confirma antes de aprobar.",
      entidad_id: "pag_001",
      leida: false,
      fecha: fechaIso(ahora, -2, -1),
    },
    {
      tipo: "reserva",
      titulo: "Reserva por expirar",
      detalle: "La reserva F5L2WQH8 vence en menos de 2 horas si no se reporta el pago.",
      entidad_id: "res_008",
      leida: false,
      fecha: fechaIso(ahora, 0, -1),
    },
    {
      tipo: "salida",
      titulo: "Salida casi llena",
      detalle: "Full Day Los Roques del 21 de noviembre tiene 2 cupos libres.",
      entidad_id: "fch_roq_02",
      leida: true,
      fecha: fechaIso(ahora, -1),
    },
    {
      tipo: "sistema",
      titulo: "Voucher emitido",
      detalle: "El voucher de la reserva J6X2RTF9 está listo para descargar.",
      entidad_id: "res_012",
      leida: true,
      fecha: fechaIso(ahora, -6, -2),
    },
  ];

  return notificaciones.map((notificacion, indice) => ({
    ...notificacion,
    id: `not_${String(indice + 1).padStart(3, "0")}`,
  }));
}

// ---------------------------------------------------------------------------
// Fábrica principal
// ---------------------------------------------------------------------------

export function crearSeed(): SeedData {
  const ahora = Date.now();
  const rng = mulberry32(0x52555441); // "RUTA"

  const usuarios = crearUsuarios();
  const tours = crearTours(ahora);
  const formularios = crearFormularios(ahora);
  const fechas = crearFechas();
  const tarifas = crearTarifas(fechas);
  const terminos = crearTerminos(ahora);
  const politicas = crearPoliticas();
  const plantillas = crearPlantillas();
  const promos = crearPromos(ahora);
  const config = crearConfiguracion("tour_roques");
  const metodos_pago = crearMetodosPago();
  const tasa = crearTasa(ahora);

  const terminosActiva = terminos.find((termino) => termino.activa)?.id ?? "term_v2";
  const reservas = crearReservas(ahora, tarifas, terminosActiva, rng);
  const pagos = crearPagos(ahora);
  const auditoria = crearAuditoria(ahora);
  const notificaciones = crearNotificaciones(ahora);

  const enlaces: Record<string, string> = {
    demo1: "res_001",
    "demo-firma": "res_005",
    "demo-pago": "res_007",
    "demo-pago-urgente": "res_009",
    "demo-ventana": "res_008",
    "demo-verif": "res_010",
    "demo-confirmada": "res_012",
    "demo-cancelada": "res_016",
    "demo-expirada": "res_017",
    "demo-completada": "res_018",
    "demo-enregistro": "res_004",
    "demo-enlace-vencido": "res_019",
  };

  // Decisión documentada: el tipo `EstadoReserva` no tiene "reprogramada".
  // La reserva reprogramada se representa como `confirmada`, con el texto
  // "Reprogramada al ..." en `referencia_interna` y un voucher versión 2.
  const reservaReprogramada = reservas.find((reserva) => reserva.id === "res_013");
  if (reservaReprogramada) {
    reservaReprogramada.referencia_interna = "Reprogramada al 2026-12-20";
    reservaReprogramada.voucher = {
      id: "vou_res_013",
      version: 2,
      estado: "listo",
      vigente: true,
      generado_en: fechaIso(ahora, -9, -2),
      verif_token: "qr-reprogramada",
    };
  }

  const verificaciones: Record<string, string> = {
    "qr-confirmada": "res_012",
    "qr-cancelada": "res_016",
    "qr-completada": "res_018",
    "qr-reprogramada": "res_013",
    "qr-parcial": "res_014",
    "qr-colonia": "res_015",
  };

  return {
    usuarios,
    tours,
    fechas,
    tarifas,
    formularios,
    reservas,
    pagos,
    metodos_pago,
    tasa,
    terminos,
    politicas,
    plantillas,
    promos,
    config,
    auditoria,
    notificaciones,
    enlaces,
    verificaciones,
  };
}
