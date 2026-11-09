import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Campo } from "@/components/admin/Campo";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { MARCA } from "@/lib/brand";
import { toast } from "sonner";

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
      breadcrumb={[{ label: "Panel", to: "/admin" }, { label: "Configuración", to: "/admin/configuracion" }, { label: "General" }]}
    >
      <div className="mx-auto w-full max-w-2xl">
        <Link
          to="/admin/configuracion"
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a configuración
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">
            Configuración general
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ajustes de tiempo de reserva, pagos y retenciones
          </p>

          <form onSubmit={handleGuardar} className="mt-6 space-y-4">
            <Campo
              id="hold_horas"
              label="Tiempo de hold (horas)"
              type="number"
              defaultValue="24"
              ayuda="Tiempo que el cupo queda reservado tras iniciar el registro"
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
