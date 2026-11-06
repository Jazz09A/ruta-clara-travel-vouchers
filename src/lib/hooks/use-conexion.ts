import * as React from "react";

import { t } from "@/lib/i18n/es";

/**
 * Estado del guardado automático de un paso (Spec 3.6 · UX-29).
 *
 * - `guardando`    → hay una escritura en vuelo.
 * - `guardado`     → la última escritura terminó bien.
 * - `sin-conexion` → no hay red; los cambios quedan en cola.
 * - `error`        → la escritura falló y hay que reintentar.
 */
export type EstadoGuardado = "guardando" | "guardado" | "sin-conexion" | "error";

/** Texto legible de cada estado (nunca un identificador interno). */
export const MENSAJE_ESTADO_GUARDADO: Record<EstadoGuardado, string> = {
  guardando: t("guardando"),
  guardado: t("guardado"),
  "sin-conexion": t("sin_conexion"),
  error: t("error_guardado"),
};

/**
 * `true` si el dispositivo tiene conexión.
 *
 * Escucha los eventos `online` / `offline` de la ventana, que es la única
 * señal fiable en navegadores móviles (no refleja el estado real del Wi-Fi).
 */
export function useConexion(): boolean {
  const [conectado, setConectado] = React.useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  React.useEffect(() => {
    const alConectar = () => setConectado(true);
    const alDesconectar = () => setConectado(false);

    window.addEventListener("online", alConectar);
    window.addEventListener("offline", alDesconectar);
    // El estado pudo cambiar entre el render y el efecto.
    setConectado(navigator.onLine);

    return () => {
      window.removeEventListener("online", alConectar);
      window.removeEventListener("offline", alDesconectar);
    };
  }, []);

  return conectado;
}

export interface ControlEstadoGuardado {
  /** Estado efectivo (ya considera la falta de conexión). */
  estado: EstadoGuardado;
  /** Texto listo para mostrar, en español. */
  mensaje: string;
  /** `false` cuando el dispositivo está sin conexión. */
  conectado: boolean;
  /** Marca de tiempo del último guardado correcto (`null` si nunca se guardó). */
  ultimoGuardadoEn: number | null;
  marcarGuardando: () => void;
  marcarGuardado: () => void;
  marcarError: () => void;
  reiniciar: () => void;
}

/**
 * Control del indicador de guardado (C-09 · UX-29).
 *
 * El estado real siempre depende de la conexión: si el dispositivo está
 * sin red, el estado efectivo es `sin-conexion` aunque el llamador haya
 * pedido `guardando` o `guardado`.
 */
export function useEstadoGuardado(): ControlEstadoGuardado {
  const conectado = useConexion();
  const [estadoManual, setEstadoManual] = React.useState<"guardando" | "guardado" | "error">(
    "guardado",
  );
  const [ultimoGuardadoEn, setUltimoGuardadoEn] = React.useState<number | null>(null);

  const marcarGuardando = React.useCallback(() => setEstadoManual("guardando"), []);

  const marcarGuardado = React.useCallback(() => {
    setUltimoGuardadoEn(Date.now());
    setEstadoManual("guardado");
  }, []);

  const marcarError = React.useCallback(() => setEstadoManual("error"), []);

  const reiniciar = React.useCallback(() => setEstadoManual("guardado"), []);

  const estado: EstadoGuardado = conectado ? estadoManual : "sin-conexion";

  return {
    estado,
    mensaje: MENSAJE_ESTADO_GUARDADO[estado],
    conectado,
    ultimoGuardadoEn,
    marcarGuardando,
    marcarGuardado,
    marcarError,
    reiniciar,
  };
}
