import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { Eraser, RotateCcw, Smartphone } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * C-10 — Lienzo de firma manuscrita (Spec §7.1).
 *
 * Reglas que implementa:
 * - UX-51: proporción ≈ 3:1, mínimo 300 × 100 px lógicos.
 * - UX-52: Pointer Events (dedo, lápiz y mouse), trazo suavizado y presión.
 * - UX-53: escalado por `devicePixelRatio`; el trazo se conserva al cambiar
 *   el tamaño o la orientación porque se guardan los **puntos vectoriales**
 *   normalizados y se redibuja.
 * - UX-54: «Borrar» y «Deshacer último trazo».
 * - UX-55: texto guía «Firma aquí» mientras el lienzo está vacío.
 * - UX-56/57: métricas (`n_trazos`, `longitud_px`, `duracion_ms`) y validación
 *   previa con los mismos umbrales que aplica el servidor.
 * - UX-58: PNG con fondo blanco y ≤ 300 KB (bajando resolución si hace falta).
 * - UX-59: en móvil vertical se *sugiere* girar el teléfono (no se bloquea).
 * - §7.3: `role="img"` con descripción; el dibujo es sólo por puntero.
 * - §7.4: la imagen vive **sólo en memoria**; nunca se escribe en
 *   `localStorage` ni en `sessionStorage`.
 */

/** Umbrales de validación (Backend 8.5 / UX-57). */
export const UMBRALES_FIRMA = {
  /** Porcentaje mínimo de píxeles con trazo sobre el área del lienzo. */
  pixelesConTrazoMin: 0.005,
  /** Fracción mínima del ancho que debe ocupar la firma. */
  anchoMin: 0.15,
  /** Número mínimo de trazos. */
  trazosMin: 1,
  /** Longitud mínima del trazo, en píxeles del PNG exportado. */
  longitudMin: 150,
  /** Duración mínima de la firma, en milisegundos. */
  duracionMin: 300,
} as const;

/** Límites del PNG exportado (UX-51 / UX-58). */
const ANCHO_EXPORT_MIN = 300;
const ANCHO_EXPORT_MAX = 1200;
const ALTO_EXPORT_MAX = 600;
const PESO_MAX_BYTES = 300 * 1024;

const COLOR_TRAZO = "#0f172a";
const COLOR_FONDO = "#ffffff";

export interface MetricasFirma {
  n_trazos: number;
  longitud_px: number;
  duracion_ms: number;
}

export interface ResultadoFirma {
  /** PNG en base64, **sin** el prefijo `data:` (es lo que espera la API). */
  png_base64: string;
  /** Data URL completa, lista para mostrar o descargar. */
  data_url: string;
  metricas: MetricasFirma;
  /** Ancho del PNG exportado, en píxeles. */
  ancho: number;
  /** Alto del PNG exportado, en píxeles. */
  alto: number;
}

export type MotivoFalloFirma = "vacio" | "invalida";

export type ResultadoExportacion =
  | { ok: true; resultado: ResultadoFirma }
  | { ok: false; motivo: MotivoFalloFirma; mensaje: string };

export interface LienzoFirmaRef {
  /**
   * Valida y exporta la firma. No lanza: devuelve un resultado discriminado
   * para que la pantalla pueda explicar el problema en lenguaje de persona.
   */
  exportar: () => ResultadoExportacion;
  /** Borra todos los trazos. */
  limpiar: () => void;
  /** Elimina el último trazo. */
  deshacer: () => void;
  /** Mueve el foco al lienzo (cuando está vacío hay que dibujarlo). */
  enfocar: () => void;
  /** `true` si hay al menos un trazo. */
  hayTrazos: boolean;
}

export interface LienzoFirmaProps {
  ref?: Ref<LienzoFirmaRef> | undefined;
  /** Bloquea el dibujo (por ejemplo, mientras se envía la firma). */
  bloqueado?: boolean | undefined;
  /** Avisa cuando cambia el estado del lienzo. */
  onCambio?: ((estado: { vacio: boolean; nTrazos: number }) => void) | undefined;
  className?: string | undefined;
}

/** Punto del trazo: coordenadas normalizadas (0..1) respecto del lienzo. */
interface Punto {
  x: number;
  y: number;
  /** Presión del puntero (0..1). */
  p: number;
  /** Marca de tiempo (`performance.now`). */
  t: number;
}

interface Trazo {
  puntos: Punto[];
}

export function LienzoFirma({
  ref,
  bloqueado = false,
  onCambio,
  className,
}: LienzoFirmaProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const trazosRef = useRef<Trazo[]>([]);
  const trazoActualRef = useRef<Trazo | null>(null);
  const punteroActivoRef = useRef<number | null>(null);

  const [nTrazos, setNTrazos] = useState(0);
  const [sugerirRotacion, setSugerirRotacion] = useState(false);

  const hayTrazos = nTrazos > 0;

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  /** Pinta un trazo suavizado (curvas cuadráticas por los puntos medios). */
  const pintarTrazo = useCallback(
    (ctx: CanvasRenderingContext2D, trazo: Trazo, ancho: number, alto: number) => {
      const puntos = trazo.puntos;
      const primero = puntos[0];
      if (!primero) return;

      const presion =
        puntos.reduce((suma, punto) => suma + punto.p, 0) / Math.max(1, puntos.length);
      const grosor = Math.max(1.6, ancho / 240) * (0.75 + presion * 0.6);

      ctx.strokeStyle = COLOR_TRAZO;
      ctx.fillStyle = COLOR_TRAZO;
      ctx.lineWidth = grosor;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (puntos.length === 1) {
        ctx.beginPath();
        ctx.arc(primero.x * ancho, primero.y * alto, grosor / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      ctx.beginPath();
      ctx.moveTo(primero.x * ancho, primero.y * alto);
      for (let i = 1; i < puntos.length - 1; i += 1) {
        const punto = puntos[i];
        const siguiente = puntos[i + 1];
        if (!punto || !siguiente) continue;
        const medioX = ((punto.x + siguiente.x) / 2) * ancho;
        const medioY = ((punto.y + siguiente.y) / 2) * alto;
        ctx.quadraticCurveTo(punto.x * ancho, punto.y * alto, medioX, medioY);
      }
      const ultimo = puntos[puntos.length - 1];
      if (ultimo) ctx.lineTo(ultimo.x * ancho, ultimo.y * alto);
      ctx.stroke();
    },
    [],
  );

  /** Redibuja el lienzo visible desde los puntos vectoriales. */
  const redibujar = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = COLOR_FONDO;
    ctx.fillRect(0, 0, width, height);

    for (const trazo of trazosRef.current) {
      pintarTrazo(ctx, trazo, width, height);
    }
    const actual = trazoActualRef.current;
    if (actual) {
      pintarTrazo(ctx, actual, width, height);
    }
  }, [pintarTrazo]);

  /** Ajusta el buffer del lienzo al tamaño real y al `devicePixelRatio`. */
  const ajustarTamano = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const ancho = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const alto = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== ancho || canvas.height !== alto) {
      canvas.width = ancho;
      canvas.height = alto;
    }
    redibujar();
  }, [redibujar]);

  useEffect(() => {
    ajustarTamano();
    const contenedor = contenedorRef.current;
    if (!contenedor || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(() => ajustarTamano());
    observador.observe(contenedor);
    return () => observador.disconnect();
  }, [ajustarTamano]);

  // Sugerencia de girar el teléfono (UX-59): nunca bloquea.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const consulta = window.matchMedia("(max-width: 640px) and (orientation: portrait)");
    const actualizar = () => setSugerirRotacion(consulta.matches);
    actualizar();
    consulta.addEventListener("change", actualizar);
    return () => consulta.removeEventListener("change", actualizar);
  }, []);

  // Avisa al padre cuando cambia el estado del lienzo.
  useEffect(() => {
    onCambio?.({ vacio: nTrazos === 0, nTrazos });
  }, [nTrazos, onCambio]);

  // Privacidad (§7.4): al desmontar, la firma se descarta de la memoria.
  useEffect(
    () => () => {
      trazosRef.current = [];
      trazoActualRef.current = null;
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Puntero
  // -------------------------------------------------------------------------

  const coordenada = useCallback(
    (evento: { clientX: number; clientY: number; pressure: number }): Punto | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const presion = evento.pressure > 0 ? evento.pressure : 0.5;
      return {
        x: Math.min(1, Math.max(0, (evento.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (evento.clientY - rect.top) / rect.height)),
        p: presion,
        t: performance.now(),
      };
    },
    [],
  );

  const alIniciarTrazo = useCallback(
    (evento: React.PointerEvent<HTMLCanvasElement>) => {
      if (bloqueado) return;
      const punto = coordenada(evento);
      if (!punto) return;
      evento.preventDefault();
      canvasRef.current?.setPointerCapture(evento.pointerId);
      punteroActivoRef.current = evento.pointerId;
      trazoActualRef.current = { puntos: [punto] };
      redibujar();
    },
    [bloqueado, coordenada, redibujar],
  );

  const alContinuarTrazo = useCallback(
    (evento: React.PointerEvent<HTMLCanvasElement>) => {
      if (bloqueado) return;
      if (punteroActivoRef.current !== evento.pointerId) return;
      const trazo = trazoActualRef.current;
      if (!trazo) return;
      evento.preventDefault();

      // `getCoalescedEvents` agrupa los puntos intermedios del lápiz/dedo.
      const eventos =
        typeof evento.nativeEvent.getCoalescedEvents === "function"
          ? evento.nativeEvent.getCoalescedEvents()
          : [evento.nativeEvent];

      for (const nativo of eventos) {
        const punto = coordenada(nativo);
        if (punto) trazo.puntos.push(punto);
      }
      redibujar();
    },
    [bloqueado, coordenada, redibujar],
  );

  const alTerminarTrazo = useCallback(
    (evento: React.PointerEvent<HTMLCanvasElement>) => {
      if (punteroActivoRef.current !== evento.pointerId) return;
      punteroActivoRef.current = null;
      const trazo = trazoActualRef.current;
      trazoActualRef.current = null;
      if (!trazo || trazo.puntos.length === 0) {
        redibujar();
        return;
      }
      trazosRef.current = [...trazosRef.current, trazo];
      setNTrazos(trazosRef.current.length);
      redibujar();
    },
    [redibujar],
  );

  // -------------------------------------------------------------------------
  // Acciones
  // -------------------------------------------------------------------------

  const limpiar = useCallback(() => {
    trazosRef.current = [];
    trazoActualRef.current = null;
    punteroActivoRef.current = null;
    setNTrazos(0);
    redibujar();
  }, [redibujar]);

  const deshacer = useCallback(() => {
    if (trazosRef.current.length === 0) return;
    trazosRef.current = trazosRef.current.slice(0, -1);
    setNTrazos(trazosRef.current.length);
    redibujar();
  }, [redibujar]);

  const enfocar = useCallback(() => {
    canvasRef.current?.focus();
  }, []);

  // -------------------------------------------------------------------------
  // Exportación y validación
  // -------------------------------------------------------------------------

  const calcularMetricas = useCallback((trazos: Trazo[], ancho: number, alto: number): MetricasFirma => {
    let longitud = 0;
    let inicio = Number.POSITIVE_INFINITY;
    let fin = Number.NEGATIVE_INFINITY;

    for (const trazo of trazos) {
      for (let i = 0; i < trazo.puntos.length; i += 1) {
        const punto = trazo.puntos[i];
        if (!punto) continue;
        if (punto.t < inicio) inicio = punto.t;
        if (punto.t > fin) fin = punto.t;
        const previo = i > 0 ? trazo.puntos[i - 1] : undefined;
        if (!previo) continue;
        longitud += Math.hypot((punto.x - previo.x) * ancho, (punto.y - previo.y) * alto);
      }
    }

    return {
      n_trazos: trazos.length,
      longitud_px: Math.round(longitud),
      duracion_ms: Number.isFinite(inicio) && Number.isFinite(fin) ? Math.max(0, Math.round(fin - inicio)) : 0,
    };
  }, []);

  /** Fracción de píxeles con trazo (sobre fondo blanco). */
  const medirTinta = useCallback((ctx: CanvasRenderingContext2D, ancho: number, alto: number): number => {
    const datos = ctx.getImageData(0, 0, ancho, alto).data;
    let pintados = 0;
    for (let i = 0; i < datos.length; i += 4) {
      const r = datos[i] ?? 255;
      const g = datos[i + 1] ?? 255;
      const b = datos[i + 2] ?? 255;
      if (r < 245 || g < 245 || b < 245) pintados += 1;
    }
    return pintados / Math.max(1, ancho * alto);
  }, []);

  /** Ancho ocupado por la firma, como fracción del ancho del lienzo. */
  const medirAncho = useCallback((trazos: Trazo[]): number => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const trazo of trazos) {
      for (const punto of trazo.puntos) {
        if (punto.x < min) min = punto.x;
        if (punto.x > max) max = punto.x;
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
    return max - min;
  }, []);

  const exportar = useCallback((): ResultadoExportacion => {
    const trazos = trazosRef.current;
    if (trazos.length === 0) {
      return { ok: false, motivo: "vacio", mensaje: "Dibuja tu firma" };
    }

    const canvas = canvasRef.current;
    const anchoLogico = canvas?.clientWidth ?? 0;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const anchoObjetivo = Math.min(
      ANCHO_EXPORT_MAX,
      Math.max(ANCHO_EXPORT_MIN, Math.round(anchoLogico * dpr)),
    );

    const candidatos = Array.from(
      new Set(
        [
          anchoObjetivo,
          Math.round(anchoObjetivo * 0.8),
          Math.round(anchoObjetivo * 0.6),
          Math.round(anchoObjetivo * 0.45),
          600,
          400,
          ANCHO_EXPORT_MIN,
        ].filter((valor) => valor >= ANCHO_EXPORT_MIN && valor <= ANCHO_EXPORT_MAX),
      ),
    ).sort((a, b) => b - a);

    for (const ancho of candidatos) {
      const alto = Math.min(ALTO_EXPORT_MAX, Math.round(ancho / 3));
      if (alto < 100) continue;

      const salida = document.createElement("canvas");
      salida.width = ancho;
      salida.height = alto;
      const ctx = salida.getContext("2d");
      if (!ctx) continue;

      ctx.fillStyle = COLOR_FONDO;
      ctx.fillRect(0, 0, ancho, alto);
      for (const trazo of trazos) {
        pintarTrazo(ctx, trazo, ancho, alto);
      }

      const dataUrl = salida.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1] ?? "";
      const peso = Math.ceil((base64.length * 3) / 4);
      const metricas = calcularMetricas(trazos, ancho, alto);

      if (peso > PESO_MAX_BYTES) continue;

      const tinta = medirTinta(ctx, ancho, alto);
      const anchoOcupado = medirAncho(trazos);

      const valida =
        metricas.n_trazos >= UMBRALES_FIRMA.trazosMin &&
        metricas.longitud_px >= UMBRALES_FIRMA.longitudMin &&
        metricas.duracion_ms >= UMBRALES_FIRMA.duracionMin &&
        tinta >= UMBRALES_FIRMA.pixelesConTrazoMin &&
        anchoOcupado >= UMBRALES_FIRMA.anchoMin;

      if (valida) {
        return {
          ok: true,
          resultado: {
            png_base64: base64,
            data_url: dataUrl,
            metricas,
            ancho,
            alto,
          },
        };
      }

      // La firma no cumple los umbrales: se avisa con el motivo.
    }

    return {
      ok: false,
      motivo: "invalida",
      mensaje: "La firma es muy pequeña o muy corta. Firma ocupando más espacio",
    };
  }, [calcularMetricas, medirAncho, medirTinta, pintarTrazo]);

  useImperativeHandle(
    ref,
    () => ({ exportar, limpiar, deshacer, enfocar, hayTrazos }),
    [deshacer, enfocar, exportar, hayTrazos, limpiar],
  );

  const descripcion = hayTrazos
    ? `Firma dibujada con ${nTrazos} ${nTrazos === 1 ? "trazo" : "trazos"}.`
    : "Zona para dibujar tu firma. Está vacía.";

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {sugerirRotacion ? (
        <p className="flex items-start gap-2 rounded-xl border border-chart-2/40 bg-chart-2/10 px-3 py-2 text-xs leading-relaxed text-foreground">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Gira tu teléfono para firmar con más espacio.</span>
        </p>
      ) : null}

      <div
        ref={contenedorRef}
        className="relative w-full overflow-hidden rounded-2xl border-2 border-dashed border-input bg-card"
      >
        <canvas
          ref={canvasRef}
          role="img"
          tabIndex={0}
          aria-label={descripcion}
          aria-disabled={bloqueado || undefined}
          className="block w-full touch-none select-none"
          style={{ aspectRatio: "3 / 1", minHeight: 100 }}
          onPointerDown={alIniciarTrazo}
          onPointerMove={alContinuarTrazo}
          onPointerUp={alTerminarTrazo}
          onPointerCancel={alTerminarTrazo}
          onPointerLeave={alTerminarTrazo}
        />
        {hayTrazos ? null : (
          <p className="pointer-events-none absolute inset-0 grid select-none place-items-center text-sm font-medium text-muted-foreground">
            Firma aquí
          </p>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {descripcion}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={deshacer}
          disabled={!hayTrazos || bloqueado}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-input bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <span>Deshacer último trazo</span>
        </button>
        <button
          type="button"
          onClick={limpiar}
          disabled={!hayTrazos || bloqueado}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-input bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Eraser className="h-4 w-4" aria-hidden="true" />
          <span>Borrar</span>
        </button>
      </div>
    </div>
  );
}
