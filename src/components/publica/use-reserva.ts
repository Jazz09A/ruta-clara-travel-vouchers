import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import {
  esApiError,
  type ContextoReservaPublica,
  type DatosTitular,
  type RespuestasFormulario,
} from "@/lib/domain/api";
import type {
  Configuracion,
  Formulario,
  Pasajero,
  PoliticaCancelacion,
  Progreso,
  Reserva,
  TarifaPublica,
  Tour,
  FechaTour,
} from "@/lib/domain/types";

import type { EstadoGuardado } from "./ui/EstadoConexion";

/**
 * Datos que el servidor puede adjuntar a la reserva pública.
 *
 * El contrato `Reserva` (§ types.ts) no los incluye porque son del dominio
 * del tour, no de la reserva. La app pública los usa en P-01 y P-03; si el
 * servidor no los envía, la pantalla degrada sin romperse.
 */
export interface ContextoReserva extends Reserva {
  tour?: Tour | undefined;
  fecha?: FechaTour | undefined;
  tarifas?: TarifaPublica[] | undefined;
  politica_cancelacion?: PoliticaCancelacion | undefined;
  config?: Configuracion | undefined;
  formulario?: Formulario | undefined;
  /** Opciones agotadas reportadas por el servidor: `"campo:valor" -> true`. */
  opciones_agotadas?: Record<string, boolean> | undefined;
}

export type DatosReserva = ContextoReservaPublica;

/** Borradores pendientes de enviar (Spec §8.3). */
interface Cola {
  titular?: DatosTitular | undefined;
  acompanantes?: Pasajero[] | undefined;
  respuestas?: RespuestasFormulario | undefined;
}

function tieneContenido(cola: Cola): boolean {
  return Boolean(cola.titular || cola.acompanantes || cola.respuestas);
}

/**
 * Backoff exponencial para reintentos automáticos de lectura
 * (1 s, 2 s, 5 s, 10 s, tope 30 s — Spec UX-30).
 */
const DELAY_REINTENTO = [1000, 2000, 5000, 10000];

/**
 * Clave de idempotencia UUID v4 (Spec §8.2).
 * Se genera en el momento del clic y se reutiliza si la misma acción se
 * reintenta.
 */
export function nuevaClaveIdempotencia(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback para contextos sin `crypto.randomUUID`.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Un error de red (sin respuesta del servidor) se puede reintentar. */
function esErrorDeRed(error: unknown): boolean {
  if (esApiError(error)) return error.status >= 500;
  return true;
}

export interface UseReserva {
  token: string;
  reserva: ContextoReserva | null;
  progreso: Progreso | null;
  version: number;
  cargando: boolean;
  refrescando: boolean;
  error: unknown;
  recargar: () => void;
  /** Estado del autoguardado (indicador de la cabecera). */
  estadoGuardado: EstadoGuardado;
  conectado: boolean;
  /** `true` cuando hay cambios escritos que aún no llegaron al servidor. */
  pendienteGuardado: boolean;
  /** Inicia el registro. Es idempotente. */
  iniciar: () => Promise<void>;
  guardarTitular: (datos: DatosTitular) => Promise<void>;
  guardarAcompanantes: (pasajeros: Pasajero[]) => Promise<void>;
  guardarRespuestas: (respuestas: RespuestasFormulario) => Promise<void>;
  /** Completa el paso actual; primero sincroniza el borrador (Spec §8.3). */
  completarPaso: (paso: string, payload?: Record<string, unknown>) => Promise<Progreso>;
  refrescarProgreso: () => Promise<void>;
  /** Fuerza el envío de lo pendiente y espera a que termine. */
  sincronizar: () => Promise<void>;
  /** Adopta la versión del servidor tras un éxito que la no devuelven los writes. */
  sincronizarVersion: (nueva: number) => void;
}

/**
 * Estado de la reserva para la app pública.
 *
 * Reglas que aplica (Spec §4.3, §8):
 * - una sola escritura en vuelo; lo que llega durante el envío se acumula y
 *   sale como un único `PUT` al terminar;
 * - autoguardado con debounce de 800 ms, al salir del campo, al cambiar de
 *   paso y al ocultar la pestaña;
 * - se descartan respuestas del servidor con `version` menor a la aplicada;
 * - ante `409 VERSION_DESACTUALIZADA` se recarga, se reenvían los cambios
 *   locales y se avisa al cliente.
 */
export function useReserva(token: string): UseReserva {
  const queryClient = useQueryClient();

  const colaRef = useRef<Cola>({});
  const enVueloRef = useRef(false);
  const esperaColaRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<number | null>(null);
  const versionRef = useRef(0);
  const esperasRef = useRef<Array<() => void>>([]);
  const conflictosRef = useRef(0);
  const canalRef = useRef<BroadcastChannel | null>(null);
  const ocultaDesdeRef = useRef<number | null>(null);
  const claveIniciarRef = useRef<string | null>(null);

  const [version, setVersion] = useState(0);
  const [estadoGuardado, setEstadoGuardado] = useState<EstadoGuardado>("inactivo");
  const [conectado, setConectado] = useState(true);

  const consulta = useQuery<DatosReserva>({
    queryKey: ["reserva", token],
    queryFn: () => api.publica.reserva(token),
    staleTime: 30_000,
    // Sólo se reintenta lo que puede volver a funcionar: errores de red y 5xx.
    retry: (fallos, error) => fallos < 4 && esErrorDeRed(error),
    retryDelay: (intento) => DELAY_REINTENTO[intento] ?? 30000,
  });

  const datos = consulta.data;
  // El servidor devuelve el tour/fecha/tarifas/formulario como campos
  // hermanos de `reserva` (ContextoReservaPublica); la app los consume
  // como parte de la reserva, así que se fusionan aquí.
  const reserva = datos
    ? ({
        ...datos.reserva,
        tour: datos.tour,
        fecha: datos.fecha,
        tarifas: datos.tarifas,
        politica_cancelacion: datos.politica_cancelacion,
        config: datos.config,
        formulario: datos.formulario,
        opciones_agotadas: datos.opciones_agotadas,
      } as ContextoReserva)
    : null;
  const progreso = datos?.progreso ?? null;
  const refetch = consulta.refetch;

  // La versión conocida se sincroniza con la del servidor, pero nunca baja.
  useEffect(() => {
    const v = datos?.reserva.version;
    if (typeof v === "number" && v > versionRef.current) {
      versionRef.current = v;
      setVersion(v);
    }
  }, [datos]);

  const resolverEsperas = useCallback(() => {
    const esperas = esperasRef.current;
    esperasRef.current = [];
    for (const resolver of esperas) resolver();
  }, []);

  const avisarOtrasPestanas = useCallback(() => {
    try {
      canalRef.current?.postMessage({ token, tipo: "cambio" });
    } catch {
      // El canal puede estar cerrado; no es crítico.
    }
  }, [token]);

  const refrescarVersionDesdeCache = useCallback(() => {
    const cached = queryClient.getQueryData<DatosReserva>(["reserva", token]);
    const v = cached?.reserva.version;
    if (typeof v === "number" && v > versionRef.current) {
      versionRef.current = v;
      setVersion(v);
    }
  }, [queryClient, token]);

  const aplicarLote = useCallback(
    async (lote: Cola): Promise<boolean> => {
      setEstadoGuardado("guardando");
      try {
        let v = versionRef.current;

        if (lote.titular) {
          const respuesta = await api.publica.guardarTitular(token, lote.titular, v);
          v = Math.max(v, respuesta.version);
          // El servidor devuelve solo {version} (+ la foto del documento si
          // se envió): reflejar el titular en la caché local.
          const t = lote.titular;
          queryClient.setQueryData<DatosReserva>(["reserva", token], (prev) =>
            prev
              ? {
                  ...prev,
                  reserva: {
                    ...prev.reserva,
                    pasajeros: prev.reserva.pasajeros.map((p) =>
                      p.es_titular
                        ? {
                            ...p,
                            nombre: t.nombre,
                            tipo_doc: t.tipo_doc,
                            documento: t.documento,
                            fecha_nacimiento: t.fecha_nacimiento,
                            telefono: t.telefono,
                            correo: t.correo,
                            contacto_emergencia_nombre: t.contacto_emergencia_nombre,
                            contacto_emergencia_telefono: t.contacto_emergencia_telefono,
                            ...(respuesta.documento_imagen_id !== undefined
                              ? { documento_imagen_id: respuesta.documento_imagen_id }
                              : {}),
                          }
                        : p,
                    ),
                  },
                }
              : prev,
          );
        }
        if (lote.acompanantes) {
          const respuesta = await api.publica.guardarAcompanantes(token, lote.acompanantes, v);
          v = Math.max(v, respuesta.version);
          queryClient.setQueryData<DatosReserva>(["reserva", token], (prev) =>
            prev
              ? {
                  ...prev,
                  reserva: { ...prev.reserva, pasajeros: respuesta.pasajeros, version: v },
                }
              : prev,
          );
        }
        if (lote.respuestas) {
          const respuesta = await api.publica.guardarRespuestas(token, lote.respuestas, v);
          v = Math.max(v, respuesta.version);
        }

        if (v > versionRef.current) {
          versionRef.current = v;
          setVersion(v);
        }
        queryClient.setQueryData<DatosReserva>(["reserva", token], (prev) =>
          prev ? { ...prev, reserva: { ...prev.reserva, version: v } } : prev,
        );

        setEstadoGuardado("guardado");
        conflictosRef.current = 0;
        avisarOtrasPestanas();
        return true;
      } catch (error) {
        // Nunca se pierde lo escrito: el lote vuelve a la cola (Spec UX-19).
        colaRef.current = { ...lote, ...colaRef.current };

        if (esApiError(error) && error.codigo === "VERSION_DESACTUALIZADA") {
          if (conflictosRef.current < 2) {
            conflictosRef.current += 1;
            await refetch();
            refrescarVersionDesdeCache();
            toast.info("Se actualizó en otro dispositivo. Revisamos tus datos");
            return true;
          }
          setEstadoGuardado("error");
          return false;
        }

        if (esErrorDeRed(error) && typeof navigator !== "undefined" && !navigator.onLine) {
          setConectado(false);
          setEstadoGuardado("sin_conexion");
          return false;
        }

        setEstadoGuardado("error");
        return false;
      } finally {
        resolverEsperas();
      }
    },
    [avisarOtrasPestanas, queryClient, refetch, refrescarVersionDesdeCache, resolverEsperas, token],
  );

  /**
   * Ejecuta la cola: nunca hay dos escrituras en vuelo. Lo que se acumule
   * mientras corre sale justo después, como un único envío.
   */
  const ejecutarCola = useCallback((): Promise<void> => {
    const enCurso = esperaColaRef.current;
    if (enCurso) return enCurso;

    const promesa = (async () => {
      enVueloRef.current = true;
      try {
        while (tieneContenido(colaRef.current)) {
          const lote = colaRef.current;
          colaRef.current = {};
          const ok = await aplicarLote(lote);
          // Si el envío falló, lo que quedó en la cola espera a que vuelva
          // la conexión o a un reintento manual: no se reintenta en bucle.
          if (!ok) break;
        }
      } finally {
        enVueloRef.current = false;
        esperaColaRef.current = null;
      }
    })();

    esperaColaRef.current = promesa;
    return promesa;
  }, [aplicarLote]);

  const programarGuardado = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void ejecutarCola();
    }, 800);
  }, [ejecutarCola]);

  const sincronizar = useCallback(async (): Promise<void> => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await ejecutarCola();
  }, [ejecutarCola]);

  const encolar = useCallback(
    (aplicar: (cola: Cola) => void): Promise<void> => {
      aplicar(colaRef.current);
      const espera = new Promise<void>((resolve) => {
        esperasRef.current.push(() => resolve());
      });
      programarGuardado();
      return espera;
    },
    [programarGuardado],
  );

  const guardarTitular = useCallback(
    (datosTitular: DatosTitular) =>
      encolar((cola) => {
        cola.titular = datosTitular;
      }),
    [encolar],
  );

  const guardarAcompanantes = useCallback(
    (pasajeros: Pasajero[]) =>
      encolar((cola) => {
        cola.acompanantes = pasajeros;
      }),
    [encolar],
  );

  const guardarRespuestas = useCallback(
    (respuestas: RespuestasFormulario) =>
      encolar((cola) => {
        cola.respuestas = respuestas;
      }),
    [encolar],
  );

  const iniciar = useCallback(async (): Promise<void> => {
    // La clave se genera en el clic y se reutiliza si hay que reintentar.
    let clave = claveIniciarRef.current;
    if (!clave) {
      clave = nuevaClaveIdempotencia();
      claveIniciarRef.current = clave;
    }
    await api.publica.iniciar(token, { acepta_aviso_privacidad: true }, clave);
    claveIniciarRef.current = null;
    await refetch();
  }, [refetch, token]);

  const completarPaso = useCallback(
    async (paso: string, payload: Record<string, unknown> = {}): Promise<Progreso> => {
      // El borrador se sincroniza antes de completar (Spec §8.3).
      await sincronizar();

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("sin_conexion");
      }

      const respuesta = await api.publica.completarPaso(token, paso, payload, versionRef.current);

      const nuevaVersion = Math.max(versionRef.current, respuesta.version);
      versionRef.current = nuevaVersion;
      setVersion(nuevaVersion);

      queryClient.setQueryData<DatosReserva>(["reserva", token], (prev) =>
        prev
          ? {
              ...prev,
              reserva: {
                ...prev.reserva,
                version: nuevaVersion,
                paso_actual: respuesta.paso_actual as Reserva["paso_actual"],
              },
              progreso: respuesta.progreso,
            }
          : prev,
      );

      return respuesta.progreso;
    },
    [queryClient, refetch, sincronizar, token],
  );

  const refrescarProgreso = useCallback(async (): Promise<void> => {
    await refetch();
  }, [refetch]);

  /**
   * Sincroniza la versión conocida con la fuente de verdad del servidor.
   *
   * `confirmarResumen` y `firmar` no pasan por `completarPaso`, pero ambas
   * incrementan la versión en el servidor. Sin esta sincronización, la
   * siguiente escritura viaja con la versión vieja y el servidor responde
   * `409 VERSION_DESACTUALIZADA` («se actualizó en otro dispositivo»).
   */
  const sincronizarVersion = useCallback(
    (nueva: number) => {
      if (!Number.isFinite(nueva) || nueva <= versionRef.current) return;
      versionRef.current = nueva;
      setVersion(nueva);
      queryClient.setQueryData<DatosReserva>(["reserva", token], (prev) =>
        prev ? { ...prev, reserva: { ...prev.reserva, version: nueva } } : prev,
      );
    },
    [queryClient, token],
  );

  // Estado de la conexión: sin red se sigue escribiendo y se acumula (UX-31).
  useEffect(() => {
    if (typeof navigator === "undefined") return () => {};
    setConectado(navigator.onLine);

    const alConectar = () => {
      setConectado(true);
      setEstadoGuardado("guardando");
      void ejecutarCola();
    };
    const alPerder = () => {
      setConectado(false);
      setEstadoGuardado("sin_conexion");
    };
    window.addEventListener("online", alConectar);
    window.addEventListener("offline", alPerder);
    return () => {
      window.removeEventListener("online", alConectar);
      window.removeEventListener("offline", alPerder);
    };
  }, [ejecutarCola]);

  // Autoguardado al ocultar la pestaña (UX-45) y refresco al volver.
  useEffect(() => {
    const alCambiar = () => {
      if (document.visibilityState === "hidden") {
        ocultaDesdeRef.current = Date.now();
        void sincronizar();
        return;
      }
      const ocultaDesde = ocultaDesdeRef.current;
      ocultaDesdeRef.current = null;
      if (ocultaDesde !== null && Date.now() - ocultaDesde > 60_000) {
        void refetch();
      }
    };
    document.addEventListener("visibilitychange", alCambiar);
    return () => document.removeEventListener("visibilitychange", alCambiar);
  }, [refetch, sincronizar]);

  // Aviso entre pestañas de la misma reserva (Spec §8.4).
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return () => {};
    const canal = new BroadcastChannel("ruta_clara_reserva");
    canalRef.current = canal;
    canal.onmessage = (evento: MessageEvent) => {
      const mensaje = evento.data as { token?: string; tipo?: string } | undefined;
      if (!mensaje || mensaje.token !== token) return;
      if (mensaje.tipo === "cambio") void refetch();
    };
    return () => {
      canal.close();
      canalRef.current = null;
    };
  }, [refetch, token]);

  const recargar = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Los refs no disparan render: se recalcula en cada render, que ocurre
  // siempre que cambia el estado de guardado o la versión.
  const pendienteGuardado = tieneContenido(colaRef.current) || enVueloRef.current;

  return {
    token,
    reserva,
    progreso,
    version,
    cargando: consulta.isPending,
    refrescando: consulta.isFetching && !consulta.isPending,
    error: consulta.error,
    recargar,
    estadoGuardado,
    conectado,
    pendienteGuardado,
    iniciar,
    guardarTitular,
    guardarAcompanantes,
    guardarRespuestas,
    completarPaso,
    refrescarProgreso,
    sincronizar,
    sincronizarVersion,
  };
}
