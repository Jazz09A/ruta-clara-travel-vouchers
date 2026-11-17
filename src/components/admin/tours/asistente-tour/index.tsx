import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, LoaderCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { DocumentoTour, Tour } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { PasoContenido } from "./paso-contenido";
import { PasoDatos } from "./paso-datos";
import { PasoFechas, type RecurrenciaSalidas } from "./paso-fechas";

export interface AsistenteTourProps {
  /** Se llama cuando el tour queda creado (para navegar a su ficha). */
  onCreado: (tour: Tour) => void;
}

const PASOS = [
  {
    titulo: "Datos",
    ayuda: "Nombre, tipo, duración, política y términos.",
  },
  {
    titulo: "Contenido",
    ayuda: "Itinerario, qué incluye y notas internas.",
  },
  {
    titulo: "Fechas y precio",
    ayuda: "Salidas del tour (obligatorias) y precio por persona.",
  },
];

/** Documento vacío: la base sobre la que se construye el tour. */
function documentoVacio(): DocumentoTour {
  return {
    clave: "",
    nombre: "",
    tipo: "full_day",
    duracion: { dias: 1, noches: 0 },
    familia: null,
    politica: null,
    terminos: null,
    hora_salida: "06:00",
    reserva_usd: null,
    cupos: 40,
    descripcion: "",
    puntos: [],
    // Una sola cifra por tour: el backend deriva niño y tercera edad, y el
    // infante (0-4 años) siempre va en 0.
    precios: { adulto: undefined },
    fechas: [],
    incluye: [],
    no_incluye: [],
    itinerario: [],
    notas: [],
  };
}

/**
 * Asistente de alta de tours: **el catálogo como contrato**.
 *
 * Los pasos son las partes del documento de tour (`catalogo-escapate.json`):
 * datos, contenido y fechas/precio. Los **puntos de salida no se preguntan**:
 * son siempre los del catálogo global (los mismos en todos los formularios) y
 * el tour los hereda; su hora se puede ajustar en la ficha del tour.
 *
 * Al terminar, el tour queda en borrador con su formulario publicado y sus
 * salidas con tarifas: listo para activarse y para que el cliente se registre.
 */
export function AsistenteTour({ onCreado }: AsistenteTourProps) {
  const [paso, setPaso] = React.useState(0);
  const [documento, setDocumento] = React.useState<DocumentoTour>(documentoVacio);
  const [recurrencia, setRecurrencia] = React.useState<RecurrenciaSalidas | null>(null);
  const [error, setError] = React.useState("");

  const { data: configuracion } = useQuery({
    queryKey: ["admin", "configuracion"],
    queryFn: () => api.admin.configuracion(),
  });

  const { data: tours } = useQuery({
    queryKey: ["admin", "tours"],
    queryFn: () => api.admin.tours(),
  });

  const familias = React.useMemo(() => {
    const set = new Set<string>();
    for (const tour of tours ?? []) {
      if (tour.familia) set.add(tour.familia);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [tours]);

  const guardar = useMutation({
    mutationFn: async () => {
      // Las fechas y el precio van **en el documento**: el tour se crea con
      // sus salidas y sus tarifas, listo para activarse.
      const { tour } = await api.admin.crearDesdeDocumento(documento);
      // Las salidas recurrentes se agregan aparte (el documento es explícito).
      if (recurrencia?.desde && recurrencia?.hasta) {
        await api.admin.fechasMasivo(tour.id, {
          recurrencia,
          precios: documento.precios,
          cupos_total: documento.cupos ?? 40,
          hora_salida: documento.hora_salida ?? undefined,
          estado: "publicada",
        });
      }
      // El formulario base (punto de salida, almuerzo, alergias, comentarios).
      await api.admin.formularioPlantilla(tour.id);
      return tour;
    },
    onSuccess: (tour) => {
      onCreado(tour);
    },
    onError: (fallo) => {
      setError(fallo instanceof Error ? fallo.message : "No pudimos crear el tour.");
    },
  });

  /** Nombre, precio y **salidas** son obligatorios. */
  const haySalidas =
    documento.fechas.length > 0 || Boolean(recurrencia?.desde && recurrencia?.hasta);
  const listoParaGuardar =
    documento.nombre.trim() !== "" &&
    documento.precios.adulto !== undefined &&
    documento.precios.adulto !== null &&
    haySalidas;

  const irA = (destino: number) => {
    setError("");
    setPaso(Math.max(0, Math.min(PASOS.length - 1, destino)));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      {/* ── Pasos ────────────────────────────────────────────────────── */}
      <nav aria-label="Pasos del alta" className="lg:sticky lg:top-4 lg:self-start">
        {/* En móvil: fila compacta con desplazamiento horizontal. */}
        <ol className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-1">
          {PASOS.map((item, indice) => {
            const activo = indice === paso;
            const hecho = indice < paso;
            return (
              <li key={item.titulo} className="w-48 shrink-0 snap-start sm:w-auto sm:shrink">
                <button
                  type="button"
                  onClick={() => irA(indice)}
                  aria-current={activo ? "step" : undefined}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition",
                    activo
                      ? "border-primary bg-primary/5 shadow-card"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      activo
                        ? "bg-primary text-primary-foreground"
                        : hecho
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {hecho ? <Check className="h-4 w-4" aria-hidden="true" /> : indice + 1}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-sm font-semibold",
                        activo ? "text-foreground" : "text-foreground/90",
                      )}
                    >
                      {item.titulo}
                    </span>
                    <span className="hidden text-xs leading-snug text-muted-foreground sm:block">
                      {item.ayuda}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <p className="mt-4 hidden items-start gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground lg:flex">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            El catálogo es la fuente de verdad: lo que completes aquí se guarda con la misma forma
            que <code className="font-mono">catalogo-escapate.json</code>.
          </span>
        </p>
      </nav>

      {/* ── Formulario del paso ─────────────────────────────────────── */}
      <div className="min-w-0 space-y-4">
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <header className="border-b border-border bg-muted/30 px-4 py-4 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-foreground md:text-lg">
                  Paso {paso + 1} de {PASOS.length} · {PASOS[paso]?.titulo}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {PASOS[paso]?.ayuda}
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {Math.round(((paso + 1) / PASOS.length) * 100)} % completado
              </span>
            </div>
            <div
              className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={PASOS.length}
              aria-valuenow={paso + 1}
              aria-label="Avance del alta"
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${((paso + 1) / PASOS.length) * 100}%` }}
              />
            </div>
          </header>

          <div className="p-4 md:p-6">
            {paso === 0 ? (
              <PasoDatos
                documento={documento}
                onChange={setDocumento}
                politicas={configuracion?.politicas ?? []}
                terminos={configuracion?.terminos ?? []}
                familias={familias}
              />
            ) : null}
            {paso === 1 ? <PasoContenido documento={documento} onChange={setDocumento} /> : null}
            {paso === 2 ? (
              <PasoFechas
                documento={documento}
                onChange={setDocumento}
                recurrencia={recurrencia}
                onRecurrenciaChange={setRecurrencia}
              />
            ) : null}
          </div>
        </section>

        {error ? (
          <p
            role="alert"
            className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        {paso === PASOS.length - 1 && !listoParaGuardar ? (
          <p className="text-xs font-medium text-destructive">
            Para crear el tour hacen falta: el nombre, el precio por persona y al menos una salida
            (son las que el cliente puede reservar).
          </p>
        ) : null}

        {/* ── Acciones ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-card md:px-5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => irA(paso - 1)}
            disabled={paso === 0 || guardar.isPending}
            className="min-h-11"
          >
            <ChevronLeft aria-hidden="true" />
            Atrás
          </Button>

          <p className="order-last w-full text-xs text-muted-foreground sm:order-none sm:w-auto sm:flex-1">
            {paso === PASOS.length - 1
              ? "Al crear el tour queda en borrador, con su formulario publicado y sus salidas con tarifas."
              : "Puedes volver y ajustar cualquier paso antes de crear el tour."}
          </p>

          {paso < PASOS.length - 1 ? (
            <Button type="button" onClick={() => irA(paso + 1)} className="min-h-11">
              Continuar
              <ChevronRight aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => guardar.mutate()}
              disabled={guardar.isPending || !listoParaGuardar}
              aria-busy={guardar.isPending || undefined}
              className="min-h-11"
            >
              {guardar.isPending ? (
                <>
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                  Creando…
                </>
              ) : (
                "Crear tour"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
