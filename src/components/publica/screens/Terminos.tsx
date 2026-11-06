import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FileText, ScrollText } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/i18n/es";

import { PublicShell } from "../layout/PublicShell";
import { Banner, useTituloPantalla } from "../ui";

/**
 * P-07 — Términos y condiciones (Spec §5, P-07).
 *
 * Regla de scroll (RF-6.2): la casilla «He leído y acepto» sólo se habilita
 * cuando el centinela del final del texto fue visible. Se mide con
 * `IntersectionObserver` sobre el contenedor con scroll interno (no con
 * `scrollTop`, que falla con zoom o fuentes grandes).
 */

export interface AceptacionTerminos {
  /** Versión exacta de los términos que el cliente leyó (RF-6.1). */
  versionTerminosId: string;
  /** `true` sólo si el centinela fue visible en esta sesión de lectura. */
  scrollCompleto: boolean;
}

export interface TerminosProps {
  token: string;
  /** Se llama cuando el cliente acepta los términos. */
  onAceptar: (aceptacion: AceptacionTerminos) => void;
  onAtras?: (() => void) | undefined;
  /** Referencia corta de la reserva, para el mensaje de WhatsApp. */
  refCorta?: string | undefined;
  /** Nombre del tour, para la cabecera del shell. */
  nombreTour?: string | undefined;
  /** Error del servidor al aceptar (p. ej. versión desactualizada). */
  errorServidor?: string | undefined;
}

export function Terminos({
  token,
  onAceptar,
  onAtras,
  refCorta,
  nombreTour,
  errorServidor,
}: TerminosProps) {
  useTituloPantalla("Términos y condiciones · Ruta Clara");

  const consulta = useQuery({
    queryKey: ["terminos", token],
    queryFn: () => api.publica.terminos(token),
    staleTime: 60_000,
  });

  const terminos = consulta.data;
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const centinelaRef = useRef<HTMLDivElement | null>(null);

  const [leidoAlFinal, setLeidoAlFinal] = useState(false);
  const [aceptado, setAceptado] = useState(false);
  const [aviso, setAviso] = useState("");

  const desplazarAlFinal = () => {
    contenedorRef.current?.scrollTo({
      top: contenedorRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  const versionId = terminos?.id;

  // Al cambiar la versión de los términos se reinicia la lectura (P-07).
  useEffect(() => {
    setLeidoAlFinal(false);
    setAceptado(false);
    setAviso("");
    contenedorRef.current?.scrollTo({ top: 0 });
  }, [versionId]);

  // Centinela al final del texto: si entra en pantalla, el texto se leyó.
  useEffect(() => {
    const contenedor = contenedorRef.current;
    const centinela = centinelaRef.current;
    if (!contenedor || !centinela) return;
    if (typeof IntersectionObserver === "undefined") {
      setLeidoAlFinal(true);
      return;
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          setLeidoAlFinal(true);
        }
      },
      { root: contenedor, threshold: 0.01, rootMargin: "0px 0px -50px 0px" },
    );
    observador.observe(centinela);
    return () => observador.disconnect();
  }, [versionId]);

  // Si el texto cabe completo sin scroll, se considera leído (P-07).
  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return;
    if (contenedor.scrollHeight <= contenedor.clientHeight + 4) {
      setLeidoAlFinal(true);
    }
  }, [versionId]);

  const cuerpo = useMemo(() => renderCuerpo(terminos?.cuerpo ?? ""), [terminos?.cuerpo]);

  const aceptar = () => {
    if (!terminos) return;
    if (!leidoAlFinal) {
      setAviso(t("desplazate"));
      return;
    }
    if (!aceptado) {
      setAviso("Marca la casilla para aceptar los términos y condiciones");
      return;
    }
    setAviso("");
    onAceptar({ versionTerminosId: terminos.id, scrollCompleto: leidoAlFinal });
  };

  if (consulta.isPending) {
    return (
      <PublicShell
        titulo="Términos y condiciones"
        onAtras={onAtras}
        mostrarAtras={Boolean(onAtras)}
      >
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {t("cargando")}
        </p>
      </PublicShell>
    );
  }

  if (consulta.isError || !terminos) {
    return (
      <PublicShell
        titulo="Términos y condiciones"
        onAtras={onAtras}
        mostrarAtras={Boolean(onAtras)}
      >
        <Banner
          variante="urgencia"
          titulo="No pudimos cargar los términos"
          mensaje="Revisa tu conexión e inténtalo de nuevo. Si el problema sigue, escríbenos."
        />
        <button
          type="button"
          onClick={() => void consulta.refetch()}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-input bg-card px-4 text-sm font-bold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Reintentar
        </button>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      titulo="Términos y condiciones"
      subtitulo={`Versión ${terminos.version} · publicada el ${formatDate(terminos.publicada_en.slice(0, 10))}`}
      onAtras={onAtras}
      mostrarAtras={Boolean(onAtras)}
      refCorta={refCorta}
      nombreTour={nombreTour}
      accionPrincipal={{
        etiqueta: "Aceptar y continuar",
        onClick: aceptar,
      }}
    >
      <div className="flex flex-col gap-4">
        {errorServidor ? (
          <Banner variante="urgencia" titulo="No pudimos continuar" mensaje={errorServidor} />
        ) : null}

        <p aria-live="polite" className="sr-only">
          {leidoAlFinal
            ? "Llegaste al final del documento. Ya puedes marcar la casilla de aceptación."
            : t("desplazate")}
        </p>

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-sm font-bold text-foreground">{terminos.titulo}</h2>
          </div>

          <div
            ref={contenedorRef}
            role="region"
            aria-label="Términos y condiciones (desplázate para leerlos completos)"
            tabIndex={0}
            className="max-h-[45vh] overflow-y-auto overscroll-contain px-4 py-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {cuerpo}
            <div ref={centinelaRef} aria-hidden="true" className="h-2 w-full" />
            <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Fin de los términos y condiciones</span>
            </p>
          </div>
        </section>

        {leidoAlFinal ? null : (
          <div className="flex items-center justify-center gap-2">
            <p
              role="status"
              className="flex items-center gap-2 rounded-xl border border-chart-2/40 bg-chart-2/10 px-3 py-2.5 text-sm font-semibold text-foreground"
            >
              <ScrollText className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t("desplazate")}</span>
            </p>
            <button
              type="button"
              onClick={desplazarAlFinal}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-input bg-card px-4 text-sm font-bold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ir al final
            </button>
          </div>
        )}

        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
          <Checkbox
            id="terminos-aceptar"
            checked={aceptado}
            disabled={!leidoAlFinal}
            aria-describedby="terminos-ayuda"
            className="mt-0.5 h-5 w-5"
            onCheckedChange={(valor) => setAceptado(valor === true)}
          />
          <div className="min-w-0 flex-1">
            <label
              htmlFor="terminos-aceptar"
              className="block text-sm font-semibold text-foreground"
            >
              {t("terminos_leidos")}
            </label>
            <p id="terminos-ayuda" className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {leidoAlFinal
                ? "Puedes marcar esta casilla para continuar."
                : "Disponible al terminar de leer"}
            </p>
          </div>
        </div>

        {/* Declaración de RF-6.5: visible y no editable. */}
        <p className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-bold leading-relaxed text-foreground">
          {t("firmo_en_nombre")}
        </p>

        {aviso ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
          >
            {aviso}
          </p>
        ) : null}
      </div>
    </PublicShell>
  );
}

/**
 * Render mínimo del cuerpo de los términos.
 *
 * Los términos llegan como texto plano con títulos (`## `) y viñetas (`- `).
 * Se construyen elementos de React: nunca se inyecta HTML crudo.
 */
function renderCuerpo(cuerpo: string): ReactNode[] {
  const lineas = cuerpo.split(/\r?\n/);
  const nodos: ReactNode[] = [];
  let vinetas: string[] = [];
  let clave = 0;

  const cerrarLista = () => {
    if (vinetas.length === 0) return;
    const items = vinetas;
    vinetas = [];
    nodos.push(
      <ul
        key={`lista-${clave}`}
        className="my-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground/90"
      >
        {items.map((texto, indice) => (
          <li key={`${clave}-${indice}`}>{texto}</li>
        ))}
      </ul>,
    );
    clave += 1;
  };

  for (const linea of lineas) {
    const limpio = linea.trim();
    if (limpio.startsWith("- ") || limpio.startsWith("* ")) {
      vinetas.push(limpio.slice(2));
      continue;
    }
    cerrarLista();
    if (limpio === "") continue;
    if (limpio.startsWith("### ")) {
      nodos.push(
        <h4
          key={`h-${clave}`}
          className="mt-4 text-sm font-bold uppercase tracking-wide text-muted-foreground"
        >
          {limpio.slice(4)}
        </h4>,
      );
    } else if (limpio.startsWith("## ")) {
      nodos.push(
        <h3 key={`h-${clave}`} className="mt-5 text-base font-extrabold text-foreground">
          {limpio.slice(3)}
        </h3>,
      );
    } else if (limpio.startsWith("# ")) {
      nodos.push(
        <h3 key={`h-${clave}`} className="mt-5 text-base font-extrabold text-foreground">
          {limpio.slice(2)}
        </h3>,
      );
    } else {
      nodos.push(
        <p key={`p-${clave}`} className="my-2 text-sm leading-relaxed text-foreground/90">
          {limpio}
        </p>,
      );
    }
    clave += 1;
  }
  cerrarLista();

  return nodos;
}
