import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, Share2, AlertTriangle, Loader2, X } from "lucide-react";
import { Campo } from "@/components/admin/Campo";
import { AdminShell } from "@/components/admin/AdminShell";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { BotonCopiar } from "@/components/admin/BotonCopiar";
import { BotonWhatsApp } from "@/components/admin/BotonWhatsApp";
import { EditorPrecio, type DatosPrecio } from "@/components/admin/reserva";
import { esApiError } from "@/lib/domain/api";
import { MARCA } from "@/lib/brand";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/format";

export const Route = createFileRoute("/admin/reservas/nueva")({
  head: () => ({
    meta: [
      { title: "Crear enlace · Panel" },
      { name: "description", content: "Genera un nuevo enlace de reserva para un cliente." },
    ],
  }),
  component: CrearEnlace,
});

function CrearEnlace() {
  const [paso, setPaso] = useState<"form" | "resultado">("form");
  const [tourId, setTourId] = useState("");
  const [fechaId, setFechaId] = useState("");
  const [referenciaInterna, setReferenciaInterna] = useState("");
  const [conPrecio, setConPrecio] = useState(false);
  const [datosPrecio, setDatosPrecio] = useState<DatosPrecio | null>(null);
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState<{
    token: string;
    enlace: string;
    whatsapp_url: string;
    expira_en: string;
    advertencias: string[];
  } | null>(null);

  const { data: tours, isLoading: loadingTours } = useQuery({
    queryKey: ["admin", "tours"],
    queryFn: () => api.admin.tours(),
  });

  const { data: fechas, isLoading: loadingFechas } = useQuery({
    queryKey: ["admin", "fechas"],
    queryFn: () => api.admin.fechas(""),
  });

  const tourSeleccionado = tours?.find((t) => t.id === tourId);
  const fechasDisponibles = tourId
    ? fechas?.filter((f) => f.tour_id === tourId && f.estado === "publicada")
    : [];
  const fechaSeleccionada = fechasDisponibles?.find((f) => f.id === fechaId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tourId || !fechaId) return;
    if (conPrecio && !datosPrecio) {
      toast.error("Guarda los cargos o ajustes antes de generar el enlace.");
      return;
    }

    setGenerando(true);

    try {
      const resp = await api.admin.crearReserva({
        fecha_tour_id: fechaId,
        referencia_interna: referenciaInterna || undefined,
        ...(datosPrecio ? { lineas: datosPrecio.lineas, ajustes: datosPrecio.ajustes } : {}),
      });

      const enlace = `${window.location.origin}${resp.enlace}`;
      const whatsapp_url = `https://wa.me/${MARCA.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hola, te compartimos el enlace para tu reserva: ${enlace}`,
      )}`;

      const expira = (resp as { expira_en?: string | null }).expira_en;
      setResultado({
        token: resp.reserva.id,
        enlace,
        whatsapp_url,
        expira_en: expira ? new Date(expira).toLocaleString("es-VE") : "",
        advertencias: resp.advertencias.map((a) => a.mensaje),
      });

      setPaso("resultado");
      toast.success("Enlace generado exitosamente");
    } catch (error) {
      toast.error(mensajeDeError(error));
    } finally {
      setGenerando(false);
    }
  };

  const handleCrearOtra = () => {
    setPaso("form");
    setTourId("");
    setFechaId("");
    setReferenciaInterna("");
    setConPrecio(false);
    setDatosPrecio(null);
    setResultado(null);
  };

  return (
    <AdminShell
      titulo="Nueva reserva"
      breadcrumb={[{ label: "Reservas", to: "/admin/reservas" }, { label: "Nueva reserva" }]}
    >
      <div className="mx-auto w-full max-w-2xl">
        <Link
          to="/admin/reservas"
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a reservas
        </Link>

        {paso === "form" ? (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
              Crear nuevo enlace
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Genera un enlace único para que el cliente complete su reserva.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Campo
                id="tour"
                label="Tour"
                type="select"
                value={tourId}
                onChange={(e) => {
                  setTourId(e.target.value);
                  setFechaId("");
                }}
                required
                disabled={loadingTours}
              >
                <option value="">Selecciona un tour</option>
                {tours
                  ?.filter((t) => t.estado === "activo")
                  .map((tour) => (
                    <option key={tour.id} value={tour.id}>
                      {tour.nombre}
                    </option>
                  ))}
              </Campo>

              {tourId && loadingFechas && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando fechas...
                </div>
              )}

              {tourId && !loadingFechas && (
                <Campo
                  id="fecha"
                  label="Fecha de salida"
                  type="select"
                  value={fechaId}
                  onChange={(e) => setFechaId(e.target.value)}
                  required
                >
                  <option value="">Selecciona una fecha</option>
                  {fechasDisponibles?.map((fecha) => (
                    <option
                      key={fecha.id}
                      value={fecha.id}
                      disabled={fecha.cupos_vendidos >= fecha.cupos_total}
                    >
                      {formatDate(fecha.fecha_salida)} · {formatTime(fecha.hora_salida)}
                      {fecha.cupos_vendidos >= fecha.cupos_total
                        ? " (sin cupo)"
                        : ` · ${fecha.cupos_total - fecha.cupos_vendidos} cupos disponibles`}
                    </option>
                  ))}
                </Campo>
              )}

              {fechaSeleccionada && (
                <div className="rounded-xl bg-success/10 p-3">
                  <p className="text-sm font-semibold text-success">
                    {fechaSeleccionada.cupos_total - fechaSeleccionada.cupos_vendidos} cupos
                    disponibles
                  </p>
                </div>
              )}

              <Campo
                id="referencia"
                label="Referencia interna (opcional)"
                type="text"
                value={referenciaInterna}
                onChange={(e) => setReferenciaInterna(e.target.value)}
                placeholder="Nombre o teléfono del cliente"
                ayuda="Solo para tu referencia interna. El cliente no lo ve."
              />

              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <Campo
                  id="con-precio"
                  label="Cargos o ajustes iniciales (opcional)"
                  type="checkbox"
                  checked={conPrecio}
                  onChange={(e) => {
                    const activo = (e.target as HTMLInputElement).checked;
                    setConPrecio(activo);
                    if (!activo) setDatosPrecio(null);
                  }}
                  ayuda="Toldos, recargos por habitación o descuentos. Quedan en la reserva desde el primer momento."
                >
                  Agregar cargos, recargos o descuentos
                </Campo>

                {conPrecio && !datosPrecio ? (
                  <div className="mt-3 border-t border-border pt-3">
                    <EditorPrecio
                      motivoFijo="Alta de reserva con cargos iniciales"
                      onGuardar={async (datos) => {
                        setDatosPrecio(datos);
                        toast.success("Cargos guardados. Se aplicarán al crear el enlace.");
                      }}
                    />
                  </div>
                ) : null}

                {conPrecio && datosPrecio ? (
                  <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-success">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      {datosPrecio.lineas.length + datosPrecio.ajustes.length} concepto(s) listo(s)
                    </div>
                    <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {datosPrecio.lineas.map((l, i) => (
                        <li key={`l-${i}`} className="flex justify-between gap-2">
                          <span>
                            {l.concepto} · {l.cantidad} × {l.precio_unit_usd}
                          </span>
                        </li>
                      ))}
                      {datosPrecio.ajustes.map((a, i) => (
                        <li key={`a-${i}`} className="flex justify-between gap-2">
                          <span>
                            {a.tipo === "descuento" ? "−" : "+"} {a.monto_usd} · {a.motivo}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-1.5 self-start text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setDatosPrecio(null)}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      Modificar
                    </button>
                  </div>
                ) : null}
              </div>

              <BotonCargar
                type="submit"
                cargando={generando}
                className="w-full"
                disabled={!tourId || !fechaId}
              >
                Generar enlace
              </BotonCargar>
            </form>
          </div>
        ) : (
          resultado && <ResultadoEnlace resultado={resultado} onCrearOtra={handleCrearOtra} />
        )}
      </div>
    </AdminShell>
  );
}

function ResultadoEnlace({
  resultado,
  onCrearOtra,
}: {
  resultado: {
    token: string;
    enlace: string;
    whatsapp_url: string;
    expira_en: string;
    advertencias: string[];
  };
  onCrearOtra: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-8 w-8 text-success" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">Enlace generado</h2>
          <p className="text-sm text-muted-foreground">
            Este enlace se muestra una sola vez. Cópialo ahora.
          </p>
        </div>
      </div>

      {resultado.advertencias.length > 0 && (
        <div className="mt-4 rounded-xl bg-warning/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            <div className="space-y-1">
              {resultado.advertencias.map((advertencia, i) => (
                <p key={i} className="text-sm text-warning">
                  {advertencia}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-foreground">
            Enlace de reserva
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={resultado.enlace}
              readOnly
              className="flex-1 rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground"
            />
            <BotonCopiar valor={resultado.enlace} />
          </div>
        </div>

        <div className="flex gap-2">
          <BotonWhatsApp url={resultado.whatsapp_url} className="flex-1">
            <Share2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Enviar por WhatsApp
          </BotonWhatsApp>
        </div>

        <div className="rounded-xl bg-muted p-3">
          <p className="text-sm text-muted-foreground">
            Vence en: <span className="font-semibold text-foreground">{resultado.expira_en}</span>
          </p>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <Link
          to="/admin/reservas"
          className="flex-1 inline-flex min-h-11 items-center justify-center rounded-xl border border-input bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          Ir a la reserva
        </Link>
        <button
          onClick={onCrearOtra}
          className="flex-1 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Crear otra
        </button>
      </div>
    </div>
  );
}

function mensajeDeError(error: unknown): string {
  if (esApiError(error)) {
    return error.mensajeMostrable;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "No pudimos generar el enlace";
}
