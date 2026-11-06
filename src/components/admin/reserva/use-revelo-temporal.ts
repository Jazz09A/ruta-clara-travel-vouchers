import * as React from "react";

import { DURACION_REVELADO_MS } from "@/components/admin/ui/utilidades";

/**
 * Datos sensibles revelados temporalmente (SEG-05).
 *
 * El valor revelado:
 * - vive **solo en el estado del componente** (nunca en la URL, el historial
 *   ni la caché de consultas),
 * - se vuelve a enmascarar a los 30 s,
 * - se enmascara de nuevo al desmontar la pantalla (el estado muere con ella).
 */

export interface DatoRevelado {
  /** Valor en claro. */
  valor: string;
  /** Instante (epoch ms) en el que vuelve a enmascararse. */
  expiraEn: number;
}

export interface ControlRevelo {
  /** Valores revelados por clave. */
  revelados: Record<string, DatoRevelado>;
  /** Registra un valor revelado para una clave. */
  revelar: (clave: string, valor: string) => void;
  /** Vuelve a enmascarar una clave. */
  ocultar: (clave: string) => void;
  /** Segundos que faltan para que la clave vuelva a enmascararse. */
  segundosRestantes: (clave: string) => number | null;
}

/**
 * Estado temporal de los datos revelados.
 *
 * @param duracionMs Ventana durante la que el dato queda visible.
 */
export function useReveloTemporal(duracionMs: number = DURACION_REVELADO_MS): ControlRevelo {
  const [revelados, setRevelados] = React.useState<Record<string, DatoRevelado>>({});
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (Object.keys(revelados).length === 0) return;
    const id = window.setInterval(() => setTick((valor) => valor + 1), 1000);
    return () => window.clearInterval(id);
  }, [revelados]);

  React.useEffect(() => {
    const ahora = Date.now();
    const vencidas = Object.keys(revelados).filter((clave) => {
      const dato = revelados[clave];
      return dato !== undefined && dato.expiraEn <= ahora;
    });
    if (vencidas.length === 0) return;
    setRevelados((previos) => {
      const siguiente = { ...previos };
      for (const clave of vencidas) delete siguiente[clave];
      return siguiente;
    });
  }, [revelados, tick]);

  const revelar = React.useCallback(
    (clave: string, valor: string) => {
      setRevelados((previos) => ({
        ...previos,
        [clave]: { valor, expiraEn: Date.now() + duracionMs },
      }));
    },
    [duracionMs],
  );

  const ocultar = React.useCallback((clave: string) => {
    setRevelados((previos) => {
      if (!(clave in previos)) return previos;
      const siguiente = { ...previos };
      delete siguiente[clave];
      return siguiente;
    });
  }, []);

  const segundosRestantes = React.useCallback(
    (clave: string) => {
      const dato = revelados[clave];
      if (!dato) return null;
      return Math.max(0, Math.ceil((dato.expiraEn - Date.now()) / 1000));
    },
    // `tick` fuerza el recálculo de la cuenta atrás.
    [revelados, tick],
  );

  return { revelados, revelar, ocultar, segundosRestantes };
}
