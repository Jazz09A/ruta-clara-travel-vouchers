import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Campo } from "@/components/admin/ui/campo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/lib/api";
import type { DocumentoTour, PuntoSalida, Tour } from "@/lib/domain/types";
import { PasoContenido } from "./paso-contenido";
import { PasoDatos } from "./paso-datos";
import { PasoFechas, type RecurrenciaSalidas } from "./paso-fechas";
import { PasoPuntos } from "./paso-puntos";

export interface AsistenteTourProps {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  /** Se llama cuando el tour queda creado (para navegar a su ficha). */
  onCreado: (tour: Tour) => void;
}

const PASOS = [
  { titulo: "Datos", ayuda: "Nombre, tipo, duración, política y términos." },
  { titulo: "Contenido", ayuda: "Itinerario, qué incluye y notas internas." },
  { titulo: "Puntos", ayuda: "De dónde sale el bus y a qué hora." },
  { titulo: "Fechas y precios", ayuda: "Salidas del tour y precio por categoría." },
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
    precios: { adulto: undefined, nino: undefined, tercera_edad: undefined, infante: 0 },
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
 * Los cuatro pasos son las cuatro partes del documento de tour
 * (`catalogo-escapate.json`): datos, contenido, puntos y fechas/precios. Al
 * terminar, el tour queda en borrador con su formulario publicado y sus
 * salidas con tarifas: listo para activarse y para que el cliente se registre.
 */
export function AsistenteTour({ abierto, onAbiertoChange, onCreado }: AsistenteTourProps) {
  const [paso, setPaso] = React.useState(0);
  const [documento, setDocumento] = React.useState<DocumentoTour>(documentoVacio);
  const [recurrencia, setRecurrencia] = React.useState<RecurrenciaSalidas | null>(null);
  const [error, setError] = React.useState("");

  const { data: configuracion } = useQuery({
    queryKey: ["admin", "configuracion"],
    queryFn: () => api.admin.configuracion(),
    enabled: abierto,
  });

  const { data: puntos } = useQuery({
    queryKey: ["admin", "puntos-salida"],
    queryFn: () => api.admin.puntosSalida(),
    enabled: abierto,
  });

  const { data: tours } = useQuery({
    queryKey: ["admin", "tours"],
    queryFn: () => api.admin.tours(),
    enabled: abierto,
  });

  const familias = React.useMemo(() => {
    const set = new Set<string>();
    for (const tour of tours ?? []) {
      if (tour.familia) set.add(tour.familia);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [tours]);

  React.useEffect(() => {
    if (!abierto) return;
    setPaso(0);
    setDocumento(documentoVacio());
    setRecurrencia(null);
    setError("");
  }, [abierto]);

  const guardar = useMutation({
    mutationFn: async () => {
      const { tour } = await api.admin.crearDesdeDocumento(documento);
      const fechas = documento.fechas.length > 0 || recurrencia ? documento.fechas : [];
      if (fechas.length > 0 || (recurrencia?.desde && recurrencia?.hasta)) {
        await api.admin.fechasMasivo(tour.id, {
          fechas,
          recurrencia: recurrencia?.desde && recurrencia?.hasta ? recurrencia : null,
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
      onAbiertoChange(false);
      onCreado(tour);
    },
    onError: (fallo) => {
      setError(fallo instanceof Error ? fallo.message : "No pudimos crear el tour.");
    },
  });

  const listoParaGuardar =
    documento.nombre.trim() !== "" &&
    Object.values(documento.precios).some((precio) => precio !== undefined && precio !== null);

  return (
    <Sheet open={abierto} onOpenChange={onAbiertoChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Nuevo tour</SheetTitle>
          <SheetDescription>
            El catálogo es la fuente de verdad: completa los datos del tour y sus salidas. Al
            terminar podrás activarlo para que el cliente se registre.
          </SheetDescription>
        </SheetHeader>

        <ol className="my-4 grid gap-2 sm:grid-cols-4" aria-label="Pasos del alta">
          {PASOS.map((item, indice) => {
            const activo = indice === paso;
            const hecho = indice < paso;
            return (
              <li key={item.titulo}>
                <button
                  type="button"
                  onClick={() => setPaso(indice)}
                  aria-current={activo ? "step" : undefined}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                    activo ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <span className="block text-xs font-semibold text-muted-foreground">
                    Paso {indice + 1}
                    {hecho ? " ✓" : ""}
                  </span>
                  <span className="block text-sm font-semibold text-foreground">{item.titulo}</span>
                  <span className="block text-xs text-muted-foreground">{item.ayuda}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {error ? (
          <p className="mb-3 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="pb-4">
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
            <PasoPuntos
              documento={documento}
              onChange={setDocumento}
              puntos={(puntos ?? []) as PuntoSalida[]}
            />
          ) : null}
          {paso === 3 ? (
            <PasoFechas
              documento={documento}
              onChange={setDocumento}
              recurrencia={recurrencia}
              onRecurrenciaChange={setRecurrencia}
            />
          ) : null}
        </div>

        <SheetFooter className="flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onAbiertoChange(false)}
            disabled={guardar.isPending}
            className="min-h-11"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setPaso((p) => Math.max(0, p - 1))}
            disabled={paso === 0 || guardar.isPending}
            className="min-h-11"
          >
            Atrás
          </Button>
          {paso < PASOS.length - 1 ? (
            <Button
              type="button"
              onClick={() => setPaso((p) => Math.min(PASOS.length - 1, p + 1))}
              className="min-h-11"
            >
              Continuar
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => guardar.mutate()}
              disabled={guardar.isPending || !listoParaGuardar}
              aria-busy={guardar.isPending || undefined}
              className="min-h-11"
            >
              {guardar.isPending ? "Creando…" : "Crear tour"}
            </Button>
          )}
        </SheetFooter>

        {paso === PASOS.length - 1 && !listoParaGuardar ? (
          <Campo id="asistente-avisos" etiqueta="Para crear el tour">
            {(props) => (
              <p {...props} className="text-xs text-muted-foreground">
                Ponle un nombre y al menos un precio por categoría: son los datos que el cliente
                necesita para reservar.
              </p>
            )}
          </Campo>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
