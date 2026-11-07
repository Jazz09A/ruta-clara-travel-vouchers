/**
 * Contexto de sesión del panel administrativo (A-01 a A-03).
 *
 * Decisiones de seguridad (Spec §9.2 y §12.3):
 * - El **access token vive sólo en memoria**. Nunca se escribe en
 *   `localStorage` ni en `sessionStorage` (SEG-03).
 * - El refresh es una cookie `HttpOnly` simulada por la API; el front sólo
 *   llama a `api.admin.yo()` para renovarla.
 * - La ruta a la que se vuelve tras entrar se valida contra una lista blanca
 *   de rutas internas (SEG-19): nunca se acepta una URL externa.
 * - Al cerrar sesión se limpia la caché de consultas (SEG-06).
 *
 * API pública (estable para el resto de agentes):
 * - `ProveedorSesion` — monta el ciclo de vida de la sesión.
 * - `useSesion()` — estado y acciones de la sesión.
 * - `usePermiso(permiso)` — `true` si el rol actual tiene ese permiso.
 */

import * as React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState, type AnyRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { DialogoConfirmacion } from "@/components/admin/DialogoConfirmacion";
import { Toaster } from "@/components/ui/sonner";
import { ApiError } from "@/lib/domain/api";
import { tienePermiso, type Permiso, type Usuario } from "@/lib/domain/types";
import { api, limpiarAccessToken, tokenAccesoActual } from "@/lib/api";

// ---------------------------------------------------------------------------
// Contrato público
// ---------------------------------------------------------------------------

export interface EstadoSesion {
  /** Usuario conectado (null si no hay sesión). */
  usuario: Usuario | null;
  /** `true` mientras se restaura la sesión al cargar la página. */
  cargando: boolean;
  /** `true` si hay una sesión válida. */
  autenticado: boolean;
  /** Inicia sesión. */
  login(correo: string, password: string): Promise<void>;
  /** Cierra sesión y limpia la caché de datos. */
  cerrarSesion(): void;
  /** Ruta a la que volver tras el login (validada contra rutas internas). */
  setRutaPendiente(ruta: string): void;

  // ---- Extensiones del panel (útiles para A-01/A-02) ----
  /** Ruta guardada a la que se vuelve tras entrar. */
  rutaPendiente: string | null;
  /** Motivo por el que el servidor cerró la sesión (si aplica). */
  motivoCierre: string | null;
  limpiarMotivoCierre(): void;
  /** `true` mientras se muestra el aviso de inactividad. */
  avisoInactividad: boolean;
  /** Cancela el aviso de inactividad y reinicia el contador. */
  seguirConectado(): void;
  /** Vuelve a pedir el usuario al servidor (tras un 403, p. ej.). */
  refrescarUsuario(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Constantes de sesión
// ---------------------------------------------------------------------------

/** Aviso de inactividad (UX-68). */
export const AVISO_INACTIVIDAD_MS = 25 * 60 * 1000;
/** Cierre de sesión por inactividad (UX-68). */
export const CIERRE_INACTIVIDAD_MS = 30 * 60 * 1000;
/** Renovación silenciosa del token antes de vencer (UX-67). */
export const RENOVACION_MS = 12 * 60 * 1000;

const CLAVE_RUTA_PENDIENTE = "ruta-clara:ruta-pendiente";

/** Lista blanca de rutas internas a las que se puede volver (SEG-19). */
export const RUTAS_INTERNAS = [
  "/admin",
  "/admin/reservas",
  "/admin/pagos",
  "/admin/salidas",
  "/admin/tours",
  "/admin/clientes",
  "/admin/reportes",
  "/admin/configuracion",
  "/admin/auditoria",
] as const;

export function esRutaInternaValida(ruta: string): boolean {
  if (!ruta.startsWith("/")) return false;
  if (ruta.startsWith("//")) return false;
  if (ruta.includes("\\")) return false;
  const base = ruta.split("?")[0] ?? "";
  const limpia = base.length > 1 ? base.replace(/\/+$/, "") : base;
  return RUTAS_INTERNAS.some(
    (permitida) => limpia === permitida || limpia.startsWith(`${permitida}/`),
  );
}

// ---------------------------------------------------------------------------
// Estado interno (store externo, compartido entre rutas)
// ---------------------------------------------------------------------------

interface EstadoInterno {
  usuario: Usuario | null;
  cargando: boolean;
  autenticado: boolean;
  rutaPendiente: string | null;
  motivoCierre: string | null;
  avisoInactividad: boolean;
}

const ESTADO_INICIAL: EstadoInterno = {
  usuario: null,
  cargando: true,
  autenticado: false,
  rutaPendiente: null,
  motivoCierre: null,
  avisoInactividad: false,
};

let estado: EstadoInterno = { ...ESTADO_INICIAL };
const suscriptores = new Set<() => void>();

/**
 * Época de la sesión: se incrementa con cada login. Las restauraciones y
 * renovaciones en vuelo capturan su época al arrancar y **sólo aplican su
 * resultado si sigue siendo la época vigente**. Sin esto, una restauración
 * tardía que falla borraba una sesión que el usuario acababa de crear (el
 * login respondía 200, la navegación saltaba y la sesión rebotaba al login).
 */
let epocaSesion = 0;

function fijarEstado(cambio: Partial<EstadoInterno>): void {
  estado = { ...estado, ...cambio };
  suscriptores.forEach((cb) => cb());
}

function suscribir(cb: () => void): () => void {
  suscriptores.add(cb);
  return () => {
    suscriptores.delete(cb);
  };
}

function instantanea(): EstadoInterno {
  return estado;
}

// ---------------------------------------------------------------------------
// Referencias inyectadas por el proveedor (navegador y caché de consultas)
// ---------------------------------------------------------------------------

let navegarA: ((destino: string, opciones?: { reemplazar?: boolean }) => void) | null = null;
let queryClientGlobal: QueryClient | null = null;
let rutaActual: () => string = () => "/admin";

function leerRutaPendiente(): string | null {
  try {
    const valor = window.sessionStorage.getItem(CLAVE_RUTA_PENDIENTE);
    return valor && esRutaInternaValida(valor) ? valor : null;
  } catch {
    return null;
  }
}

function guardarRutaPendiente(ruta: string | null): void {
  try {
    if (ruta && esRutaInternaValida(ruta)) {
      window.sessionStorage.setItem(CLAVE_RUTA_PENDIENTE, ruta);
    } else {
      window.sessionStorage.removeItem(CLAVE_RUTA_PENDIENTE);
    }
  } catch {
    /* almacenamiento no disponible: la ruta queda sólo en memoria */
  }
}

// ---------------------------------------------------------------------------
// Inactividad
// ---------------------------------------------------------------------------

let temporizadorAviso: ReturnType<typeof setTimeout> | undefined;
let temporizadorCierre: ReturnType<typeof setTimeout> | undefined;
let avisoMostrado = false;

function limpiarTemporizadores(): void {
  if (temporizadorAviso !== undefined) clearTimeout(temporizadorAviso);
  if (temporizadorCierre !== undefined) clearTimeout(temporizadorCierre);
  temporizadorAviso = undefined;
  temporizadorCierre = undefined;
}

function programarInactividad(): void {
  limpiarTemporizadores();
  if (!estado.autenticado) return;
  temporizadorAviso = setTimeout(() => {
    avisoMostrado = true;
    fijarEstado({ avisoInactividad: true });
    temporizadorCierre = setTimeout(() => {
      avisoMostrado = false;
      cerrarSesion("Tu sesión se cerró por seguridad porque estuviste mucho tiempo sin actividad.");
    }, CIERRE_INACTIVIDAD_MS - AVISO_INACTIVIDAD_MS);
  }, AVISO_INACTIVIDAD_MS);
}

export function seguirConectado(): void {
  avisoMostrado = false;
  fijarEstado({ avisoInactividad: false });
  programarInactividad();
}

// ---------------------------------------------------------------------------
// Renovación silenciosa del token (UX-67)
// ---------------------------------------------------------------------------

let renovacionEnCurso: Promise<boolean> | null = null;

/**
 * Renueva el token en silencio vía `POST /auth/refresh`. Sólo una renovación
 * a la vez: las peticiones que llegan mientras corre esperan a la misma
 * promesa. El intervalo (12 min) es menor al TTL del access token (15 min),
 * así que en condiciones normales nunca vence durante la sesión.
 */
async function renovarToken(): Promise<boolean> {
  if (renovacionEnCurso) return renovacionEnCurso;

  const tarea = (async (): Promise<boolean> => {
    try {
      await api.admin.renovar();
      return true;
    } catch {
      return false;
    }
  })();

  renovacionEnCurso = tarea;
  try {
    return await tarea;
  } finally {
    renovacionEnCurso = null;
  }
}

/** Access token vigente en memoria (delegado en el cliente HTTP; SEG-03). */
export function tokenEnMemoria(): string | null {
  return tokenAccesoActual();
}

// ---------------------------------------------------------------------------
// Acciones de sesión
// ---------------------------------------------------------------------------

export function setRutaPendiente(ruta: string): void {
  if (!esRutaInternaValida(ruta)) return;
  guardarRutaPendiente(ruta);
  fijarEstado({ rutaPendiente: ruta });
}

export function limpiarMotivoCierre(): void {
  fijarEstado({ motivoCierre: null });
}

export function cerrarSesion(motivo?: string): void {
  limpiarAccessToken();
  avisoMostrado = false;
  limpiarTemporizadores();
  fijarEstado({
    usuario: null,
    autenticado: false,
    cargando: false,
    rutaPendiente: null,
    motivoCierre: motivo ?? null,
    avisoInactividad: false,
  });
  guardarRutaPendiente(null);
  queryClientGlobal?.clear();
  navegarA?.("/admin/login", { reemplazar: true });
}

export async function refrescarUsuario(): Promise<void> {
  try {
    const { usuario } = await api.admin.yo();
    fijarEstado({ usuario, autenticado: true });
  } catch {
    /* se conserva el usuario actual; otro flujo lo cerrará si hace falta */
  }
}

/** Va al login conservando la ruta actual para volver a ella (UX-67). */
export function enviarAlLogin(motivo?: string): void {
  const destino = rutaActual();
  cerrarSesion(motivo);
  if (esRutaInternaValida(destino) && !destino.startsWith("/admin/login")) {
    setRutaPendiente(destino);
  }
}

let restauracionEnCurso: Promise<void> | null = null;

/**
 * Restaura la sesión al recargar la página (llama a `/auth/yo`).
 *
 * - **Dedupe**: varios `ProveedorSesion` pueden montarse a la vez (el login,
 *   cada pangina admin que envuelve `AdminShell`, las transiciones de ruta);
 *   aquí sólo una restauración va a la red y todos esperan la misma promesa.
 * - **Época**: si el usuario entró mientras la restauración corría, el
 *   resultado tardío de ésta se descarta en ambos sentidos — su éxito no pisa
 *   al usuario que acaba de entrar y su fallo (401 ya sin cookie válida) no
 *   puede tumbar una sesión recién creada. Ese choque era la causa del
 *   «la petición respondió bien pero me devolvió al login».
 */
export async function restaurarSesion(): Promise<void> {
  if (estado.autenticado) return;
  if (restauracionEnCurso) return restauracionEnCurso;

  const miEpoca = epocaSesion;
  restauracionEnCurso = (async () => {
    try {
      const { usuario } = await api.admin.yo();
      if (miEpoca !== epocaSesion || estado.autenticado) return;
      fijarEstado({
        usuario,
        autenticado: true,
        cargando: false,
        rutaPendiente: leerRutaPendiente(),
      });
      programarInactividad();
    } catch {
      // Llegó tarde: la época cambió (el usuario ya entró o ya salió); no
      // tocamos el estado vigente.
      if (miEpoca !== epocaSesion || estado.autenticado) return;
      fijarEstado({ usuario: null, autenticado: false, cargando: false });
    }
  })();

  try {
    await restauracionEnCurso;
  } finally {
    restauracionEnCurso = null;
  }
}

export async function login(correo: string, password: string): Promise<void> {
  // Nueva época: cualquier restauración en vuelo queda obsoleta.
  const miEpoca = ++epocaSesion;
  await api.admin.login({ correo, password });
  // La API deja la sesión lista y `yo()` la confirma. Si `yo()` falla, las
  // credenciales YA fueron aceptadas: el error no debe mostrarse como
  // «correo o contraseña incorrectos» sino como un fallo transitorio.
  try {
    const { usuario } = await api.admin.yo();
    if (miEpoca !== epocaSesion) return;
    fijarEstado({ usuario, autenticado: true, cargando: false });
    programarInactividad();
  } catch (_fallo) {
    if (miEpoca !== epocaSesion) return;
    throw new ApiError(500, {
      codigo: "VERIFICACION_SESION",
      mensaje: "Entramos, pero no pudimos verificar tu sesión. Intenta de nuevo.",
      request_id: "",
    });
  }
}

// ---------------------------------------------------------------------------
// Contexto React
// ---------------------------------------------------------------------------

const ContextoSesion = createContext<EstadoSesion | null>(null);

export function useSesion(): EstadoSesion {
  const contexto = useContext(ContextoSesion);
  const foto = useSyncExternalStore(suscribir, instantanea, instantanea);

  return useMemo<EstadoSesion>(
    () => ({
      usuario: foto.usuario,
      cargando: foto.cargando,
      autenticado: foto.autenticado,
      login,
      cerrarSesion: () => cerrarSesion(),
      setRutaPendiente,
      rutaPendiente: foto.rutaPendiente,
      motivoCierre: foto.motivoCierre,
      limpiarMotivoCierre,
      avisoInactividad: foto.avisoInactividad,
      seguirConectado,
      refrescarUsuario,
    }),
    [foto, contexto],
  );
}

/** `true` si el rol del usuario actual tiene el permiso pedido. */
export function usePermiso(permiso: Permiso): boolean {
  const { usuario } = useSesion();
  return usuario ? tienePermiso(usuario.rol, permiso) : false;
}

/**
 * Navegación del panel con rutas sueltas.
 *
 * El árbol de rutas se autogenera (`routeTree.gen.ts`), así que el panel
 * navega indicando siempre el `href` completo: así funciona aunque la ruta
 * todavía no esté en el árbol generado.
 */
export function useNavegarAdmin(): (destino: string, opciones?: { reemplazar?: boolean }) => void {
  const navegar = useNavigate();
  return useCallback(
    (destino: string, opciones?: { reemplazar?: boolean }) => {
      void navegar<AnyRouter, string>({
        to: destino,
        href: destino,
        ...(opciones?.reemplazar ? { replace: true } : {}),
      });
    },
    [navegar],
  );
}

// ---------------------------------------------------------------------------
// Proveedor
// ---------------------------------------------------------------------------

export interface ProveedorSesionProps {
  children: ReactNode;
}

export function ProveedorSesion({ children }: ProveedorSesionProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const navegar = useNavigate();
  const ubicacion = useRouterState({ select: (s) => s.location });
  const foto = useSyncExternalStore(suscribir, instantanea, instantanea);
  const [proveedoresActivos, setProveedoresActivos] = useState(0);

  // Navegador con rutas sueltas: el panel navega a rutas que puede que aún
  // no estén en el árbol generado (`routeTree.gen.ts` se autogenera).
  useEffect(() => {
    navegarA = (destino: string, opciones?: { reemplazar?: boolean }) => {
      void navegar<AnyRouter, string>({
        to: destino,
        href: destino,
        ...(opciones?.reemplazar ? { replace: true } : {}),
      });
    };
    return () => {
      navegarA = null;
    };
  }, [navegar]);

  useEffect(() => {
    queryClientGlobal = queryClient;
    return () => {
      if (queryClientGlobal === queryClient) queryClientGlobal = null;
    };
  }, [queryClient]);

  useEffect(() => {
    rutaActual = () => `${ubicacion.pathname}${ubicacion.searchStr}`;
  }, [ubicacion.pathname, ubicacion.searchStr]);

  // Restaura la sesión al cargar la página (una sola vez).
  const restaurado = useRef(false);
  useEffect(() => {
    if (restaurado.current) return;
    restaurado.current = true;
    void restaurarSesion();
  }, []);

  // Renovación periódica del token (12 min) y una sola a la vez.
  useEffect(() => {
    if (!foto.autenticado) return;
    const temporizador = setInterval(() => {
      void renovarToken();
    }, RENOVACION_MS);
    return () => clearInterval(temporizador);
  }, [foto.autenticado]);

  // Inactividad: aviso a los 25 min y cierre a los 30 min.
  useEffect(() => {
    if (!foto.autenticado) {
      limpiarTemporizadores();
      return;
    }
    programarInactividad();

    const alInteractuar = () => {
      if (avisoMostrado) return;
      programarInactividad();
    };
    const eventos: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
    eventos.forEach((evento) => window.addEventListener(evento, alInteractuar, { passive: true }));
    return () => {
      eventos.forEach((evento) => window.removeEventListener(evento, alInteractuar));
    };
  }, [foto.autenticado]);

  // 401 → renovación silenciosa; si falla, login conservando la ruta.
  // 403 → aviso claro y actualización del menú.
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    return cache.subscribe((evento) => {
      if (evento.type !== "updated") return;
      const accion = evento.action;
      if (accion.type !== "error") return;
      const error = accion.error;
      if (!(error instanceof ApiError)) return;
      if (error.status === 401) {
        void renovarToken().then((ok) => {
          if (!ok) enviarAlLogin();
        });
      }
      if (error.status === 403) {
        toast.error("No tienes permiso para esto");
        void refrescarUsuario();
      }
    });
  }, [queryClient]);

  // Un único `Toaster` en toda la app.
  useEffect(() => {
    setProveedoresActivos((n) => n + 1);
    return () => setProveedoresActivos((n) => Math.max(0, n - 1));
  }, []);

  const valor = useMemo<EstadoSesion>(
    () => ({
      usuario: foto.usuario,
      cargando: foto.cargando,
      autenticado: foto.autenticado,
      login,
      cerrarSesion: () => cerrarSesion(),
      setRutaPendiente,
      rutaPendiente: foto.rutaPendiente,
      motivoCierre: foto.motivoCierre,
      limpiarMotivoCierre,
      avisoInactividad: foto.avisoInactividad,
      seguirConectado,
      refrescarUsuario,
    }),
    [foto],
  );

  return (
    <ContextoSesion.Provider value={valor}>
      {children}
      {proveedoresActivos === 1 ? <Toaster position="top-center" richColors closeButton /> : null}
      <DialogoConfirmacion
        abierto={foto.avisoInactividad}
        onAbiertoCambia={(abierto) => {
          if (!abierto) seguirConectado();
        }}
        titulo="¿Sigues ahí?"
        descripcion="Por seguridad cerramos la sesión si pasan 30 minutos sin actividad."
        textoConfirmar="Seguir conectado"
        textoCancelar="Cerrar sesión"
        onConfirmar={seguirConectado}
        onCancelar={() => cerrarSesion("Tu sesión se cerró por seguridad.")}
      />
    </ContextoSesion.Provider>
  );
}
