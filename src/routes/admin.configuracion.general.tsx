import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CreditCard, UtensilsCrossed } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/AdminShell";
import { Campo } from "@/components/admin/Campo";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Configuracion } from "@/lib/domain/types";

export const Route = createFileRoute("/admin/configuracion/general")({
  head: () => ({
    meta: [
      { title: "Configuración general · Panel" },
      { name: "description", content: "Ajustes de hold, abono y retención." },
    ],
  }),
  component: ConfiguracionGeneral,
});

function ConfiguracionGeneral() {
  const [guardando, setGuardando] = useState(false);
  const queryClient = useQueryClient();

  const { data: datos } = useQuery({
    queryKey: ["configuracion", "general"],
    queryFn: () => api.admin.configuracion(),
  });
  const config = datos?.config;

  // Banderas globales del formulario: se guardan de inmediato, sin botón aparte.
  const guardarPreferencia = useMutation({
    mutationFn: (cambios: Partial<Configuracion>) => api.admin.guardarConfiguracion(cambios),
    onSuccess: () => {
      toast.success("Preferencia actualizada");
      void queryClient.invalidateQueries({ queryKey: ["configuracion"] });
    },
    onError: () => {
      toast.error("No pudimos guardar la preferencia");
    },
  });

  const comidasHabilitadas = !(config?.comidas_deshabilitadas ?? true);
  const reportePagoActivo = config?.reporte_pago_cliente ?? false;

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      // TODO: Integrar con la API real
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Configuración guardada");
    } catch (error) {
      toast.error("No pudimos guardar la configuración");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AdminShell
      titulo="Configuración general"
      breadcrumb={[
        { label: "Panel", to: "/admin" },
        { label: "Configuración", to: "/admin/configuracion" },
        { label: "General" },
      ]}
    >
      <div className="mx-auto w-full max-w-2xl">
        <Link
          to="/admin/configuracion"
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a configuración
        </Link>

        {/* Preferencias del formulario (flags globales) ------------------- */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">
            Preferencias del formulario
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Se aplican a todos los formularios públicos. Se pueden activar o desactivar en cualquier
            momento, sin perder los campos ni el flujo.
          </p>

          <ul className="mt-5 space-y-4">
            <li className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background p-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <UtensilsCrossed className="h-4 w-4 text-primary" aria-hidden="true" />
                  Selección de comida
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Muestra u oculta las preguntas de comida (almuerzo, menús). Al ocultarlas, los
                  campos se conservan y las respuestas anteriores no se borran.
                </p>
              </div>
              <Switch
                id="flag-comidas"
                checked={comidasHabilitadas}
                disabled={guardarPreferencia.isPending}
                onCheckedChange={(checked) =>
                  guardarPreferencia.mutate({ comidas_deshabilitadas: !checked })
                }
                aria-label="Selección de comida habilitada"
              />
            </li>

            <li className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background p-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CreditCard className="h-4 w-4 text-primary" aria-hidden="true" />
                  Reporte de pago del cliente
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Si está apagado, el cliente no reporta pagos por el formulario: la agencia anota
                  los datos del pago desde la reserva y el pago entra a la cola «Pagos por validar».
                </p>
              </div>
              <Switch
                id="flag-reporte-pago"
                checked={reportePagoActivo}
                disabled={guardarPreferencia.isPending}
                onCheckedChange={(checked) =>
                  guardarPreferencia.mutate({ reporte_pago_cliente: checked })
                }
                aria-label="Reporte de pago del cliente habilitado"
              />
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">
            Configuración general
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ajustes de tiempo de reserva, pagos y retenciones
          </p>

          <form onSubmit={handleGuardar} className="mt-6 space-y-4">
            <Campo
              id="minutos_inactividad"
              label="Tiempo de hold al iniciar el registro (minutos)"
              type="number"
              defaultValue={config ? String(config.minutos_inactividad ?? 30) : "30"}
              ayuda="Tiempo que el cupo queda reservado desde que el cliente inicia el registro, mientras llena el formulario. Cada paso guardado lo renueva."
              min="5"
              max="240"
              required
            />

            <Campo
              id="hold_horas"
              label="Tiempo de hold tras confirmar la reserva (horas)"
              type="number"
              defaultValue={config ? String(config.hold_horas ?? 24) : "24"}
              ayuda="Cuando el cliente confirma el resumen se da más tiempo: el cupo queda reservado estas horas a la espera del pago."
              min="1"
              max="72"
              required
            />

            <Campo
              id="abono_porcentaje"
              label="Abono mínimo (%)"
              type="number"
              defaultValue="50"
              ayuda="Porcentaje mínimo para apartar el cupo"
              min="0"
              max="100"
              required
            />

            <Campo
              id="retencion_porcentaje"
              label="Retención por cancelación (%)"
              type="number"
              defaultValue="10"
              ayuda="Porcentaje retenido por cancelaciones tardías"
              min="0"
              max="100"
              required
            />

            <Campo
              id="max_pasajeros"
              label="Máximo de pasajeros por reserva"
              type="number"
              defaultValue="10"
              ayuda="Límite de pasajeros en una sola reserva"
              min="1"
              max="50"
              required
            />

            <BotonCargar type="submit" cargando={guardando} className="w-full">
              Guardar cambios
            </BotonCargar>
          </form>
        </div>
      </div>
    </AdminShell>
  );
}
