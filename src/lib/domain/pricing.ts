import {
  addDecimals,
  multiplyDecimal,
  plural,
  subtractDecimals,
  toDecimalString,
} from "@/lib/format";
import { edadEn } from "@/lib/format";
import type { Categoria, CupoOpcion, LineaPrecio, Respuesta } from "./types";

/**
 * Cálculo del precio (PRD §11).
 *
 * En producción lo calcula el servidor; en esta demo el "servidor" es este
 * módulo. Todas las sumas de dinero se hacen con las helpers de
 * `@/lib/format`: el dinero siempre viaja como string decimal.
 */

export interface ExtraCalculo {
  id: string;
  label: string;
  precio_usd: string;
  cantidad_max: number;
}

export interface EntradaCalculo {
  pasajeros: { categoria: Categoria; respuestas: Record<string, Respuesta> }[];
  tarifas: { categoria: Categoria; precio_usd: string }[];
  camposExtra: ExtraCalculo[];
  respuestasGlobales: Record<string, Respuesta>;
  cuposOpcion?: CupoOpcion[];
  promocion?: { tipo: "porcentaje" | "monto"; valor: number };
  saldoPrevio?: string;
}

export interface ResultadoCalculo {
  lineas: LineaPrecio[];
  subtotal_usd: string;
  adicionales_usd: string;
  descuento_usd: string;
  total_usd: string;
  saldo_usd: string;
  advertencias: string[];
}

/** Un monto nunca baja de cero (PRD §11). */
function noNegativo(valor: string): string {
  const normalizado = toDecimalString(valor);
  return Number.parseFloat(normalizado) < 0 ? "0.00" : normalizado;
}

/** Convierte una respuesta en cantidad (los extras son enteros). */
function aCantidad(valor: Respuesta | undefined): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim() !== "") {
    const n = Number.parseFloat(valor);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

/**
 * Cantidad contratada de un ítem con costo.
 * El valor global manda; si no hay valor global, se suman los de cada
 * pasajero (un extra `por_reserva` con `permite_por_pasajero` no se duplica).
 */
function cantidadExtra(id: string, entrada: EntradaCalculo): number {
  const global = aCantidad(entrada.respuestasGlobales[id]);
  if (global !== null) return global;

  let total = 0;
  for (const pasajero of entrada.pasajeros) {
    const valor = aCantidad(pasajero.respuestas[id]);
    if (valor !== null) total += valor;
  }
  return total;
}

/**
 * Calcula el desglose de la reserva.
 * Subtotal (tarifas por categoría) + adicionales (ítems con costo) −
 * descuentos, con saldo pendiente sobre lo ya pagado (PRD §11).
 */
export function calcularPrecio(entrada: EntradaCalculo): ResultadoCalculo {
  const advertencias: string[] = [];
  const lineas: LineaPrecio[] = [];

  // 1. Una línea por categoría usada.
  const porCategoria = new Map<Categoria, number>();
  for (const pasajero of entrada.pasajeros) {
    porCategoria.set(pasajero.categoria, (porCategoria.get(pasajero.categoria) ?? 0) + 1);
  }

  let subtotal = "0.00";
  for (const [categoria, cantidad] of porCategoria) {
    const tarifa = entrada.tarifas.find((t) => t.categoria === categoria);
    if (!tarifa) {
      advertencias.push(
        `No tenemos tarifa para la categoría ${categoria}. Contacta a la agencia para regularizar el pago.`,
      );
      continue;
    }
    const unitario = toDecimalString(tarifa.precio_usd);
    const total = multiplyDecimal(unitario, cantidad);
    lineas.push({
      concepto: categoria,
      detalle: `${plural(cantidad, "pasajero", "pasajeros")} x $${unitario}`,
      cantidad,
      precio_usd: unitario,
      total_usd: total,
    });
    subtotal = addDecimals(subtotal, total);
  }

  // 2. Adicionales: ítems con costo por cantidad (precio del snapshot).
  let adicionales = "0.00";
  for (const extra of entrada.camposExtra) {
    const cantidad = cantidadExtra(extra.id, entrada);
    if (cantidad <= 0) continue;

    if (extra.cantidad_max > 0 && cantidad > extra.cantidad_max) {
      advertencias.push(
        `La cantidad de «${extra.label}» (${cantidad}) supera el máximo permitido (${extra.cantidad_max}).`,
      );
    }

    const unitario = toDecimalString(extra.precio_usd);
    const total = multiplyDecimal(unitario, cantidad);
    lineas.push({
      concepto: extra.label,
      detalle: `${plural(cantidad, "unidad", "unidades")} x $${unitario}`,
      cantidad,
      precio_usd: unitario,
      total_usd: total,
    });
    adicionales = addDecimals(adicionales, total);
  }

  // 3. Descuento por promoción.
  const base = addDecimals(subtotal, adicionales);
  let descuento = "0.00";
  if (entrada.promocion) {
    if (entrada.promocion.tipo === "porcentaje") {
      descuento = multiplyDecimal(base, entrada.promocion.valor / 100);
    } else {
      descuento = toDecimalString(entrada.promocion.valor);
    }
    if (Number.parseFloat(descuento) > Number.parseFloat(base)) {
      descuento = base;
    }
  }

  // 4. Total y saldo.
  const total = noNegativo(subtractDecimals(base, descuento));
  const saldo = noNegativo(subtractDecimals(total, entrada.saldoPrevio ?? "0.00"));

  return {
    lineas,
    subtotal_usd: subtotal,
    adicionales_usd: adicionales,
    descuento_usd: toDecimalString(descuento),
    total_usd: total,
    saldo_usd: saldo,
    advertencias,
  };
}

/**
 * Categoría que corresponde a una edad en la fecha de salida.
 * Devuelve `null` si ninguna tarifa cubre esa edad.
 */
export function calcularCategorias(
  tarifas: { categoria: Categoria; edad_min: number; edad_max: number; precio_usd: string }[],
  fechaSalida: string,
  fechaNacimiento: string,
): Categoria | null {
  const edad = edadEn(fechaNacimiento, fechaSalida);
  if (edad === null) return null;
  const tarifa = tarifas.find((t) => edad >= t.edad_min && edad <= t.edad_max);
  return tarifa ? tarifa.categoria : null;
}

/**
 * Equivalente en bolívares. Sin tasa vigente no se puede calcular (PRD §11).
 */
export function totalBs(totalUsd: string, tasa: string | null): string | null {
  if (!tasa) return null;
  const valor = Number.parseFloat(toDecimalString(tasa));
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return multiplyDecimal(totalUsd, valor);
}

/**
 * Detecta las opciones agotadas a partir de los cupos por opción (RF-3.5).
 * La clave es `"<campo_id>:<opcion>"`, igual que la que consume el motor.
 * Las opciones ya elegidas por el cliente que se agotaron también quedan
 * marcadas para bloquear "Continuar" (Spec §6.3, punto 6).
 */
export function detectarOpcionesAgotadas(
  cuposOpcion: CupoOpcion[],
  respuestas: Record<string, Respuesta>,
): Record<string, boolean> {
  const agotadas: Record<string, boolean> = {};
  const estadoPorOpcion = new Map<string, boolean>();

  for (const cupo of cuposOpcion) {
    const clave = `${cupo.campo_id}:${cupo.opcion}`;
    const agotado = cupo.cupo <= cupo.agotados;
    estadoPorOpcion.set(clave, agotado);
    if (agotado) agotadas[clave] = true;
  }

  for (const [campoId, valor] of Object.entries(respuestas)) {
    const valores = Array.isArray(valor) ? valor : [valor];
    for (const v of valores) {
      if (typeof v !== "string") continue;
      const clave = `${campoId}:${v}`;
      if (estadoPorOpcion.get(clave) === true) agotadas[clave] = true;
    }
  }

  return agotadas;
}
