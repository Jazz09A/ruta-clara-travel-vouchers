import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Clock3, CheckCircle2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Campo } from "@/components/admin/Campo";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { MARCA } from "@/lib/brand";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TasaCambio } from "@/lib/domain/types";
import { formatRelative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/configuracion/tasa")({
  head: () => ({
    meta: [
      { title: "Tasa de cambio · Panel" },
      { name: "description", content: "Gestión de la tasa USD/Bs vigente e historial." },
    ],
  }),
  component: TasaCambio,
});

function TasaCambio() {
  const queryClient = useQueryClient();
  const [nuevaTasa, setNuevaTasa] = useState("");

  const { data: datos, isLoading } = useQuery({
    queryKey: ["configuracion", "tasa"],
    queryFn: () => api.admin.configuracion(),
  });

  const tasaVigente = datos?.tasa.find((t) => t.vigente);
  const historial = datos?.tasa.filter((t) => !t.vigente) ?? [];

  const mutation = useMutation({
    mutationFn: async (valor: string) => {
      return await api.admin.registrarTasa({ valor });
    },
    onSuccess: () => {
      toast.success("Tasa de cambio actualizada");
      setNuevaTasa("");
      queryClient.invalidateQueries({ queryKey: ["configuracion", "tasa"] });
    },
    onError: () => {
      toast.error("No pudimos actualizar la tasa de cambio");
    },
  });

  const handleRegistrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaTasa) return;
    mutation.mutate(nuevaTasa);
  };

  return (
    <AdminShell
      titulo="Tasa de cambio"
      breadcrumb={[{ label: "Panel", to: "/admin" }, { label: "Configuración", to: "/admin/configuracion" }, { label: "Tasa de cambio" }]}
    >
      <div className="mx-auto w-full max-w-3xl">
        <Link
          to="/admin/configuracion"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a configuración
        </Link>

        {/* Tasa vigente */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">
            Tasa vigente
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            La tasa actual que se usa para calcular los precios en bolívares
          </p>

          {isLoading ? (
            <div className="mt-4 h-20 animate-pulse rounded-xl bg-muted" />
          ) : tasaVigente ? (
            <div className="mt-4 flex items-center gap-4 rounded-xl bg-primary/5 p-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="flex-1">
                <p className="text-3xl font-extrabold text-foreground">
                  {tasaVigente.valor} Bs/USD
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Registrada por {tasaVigente.registrada_por} ·{" "}
                  {formatRelative(tasaVigente.registrada_en)}
                </p>
              </div>
              <Badge variant="default" className="min-h-8">
                Vigente
              </Badge>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No hay una tasa vigente registrada
              </p>
            </div>
          )}
        </div>

        {/* Registrar nueva tasa */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">
            Registrar nueva tasa
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Al registrar una nueva tasa, la anterior deja de estar vigente
          </p>

          <form onSubmit={handleRegistrar} className="mt-6 space-y-4">
            <Campo
              id="nueva_tasa"
              label="Nueva tasa (Bs por USD)"
              type="number"
              value={nuevaTasa}
              onChange={(e) => setNuevaTasa(e.target.value)}
              placeholder="Ej: 36.50"
              step="0.01"
              min="0"
              required
              ayuda="El valor debe ser un número decimal positivo"
            />

            <BotonCargar
              type="submit"
              cargando={mutation.isPending}
              className="w-full"
              textoCargando="Registrando..."
            >
              Registrar nueva tasa
            </BotonCargar>
          </form>
        </div>

        {/* Historial */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
              Historial de tasas
            </h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Tasas anteriores que ya no están vigentes
          </p>

          {isLoading ? (
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : historial.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No hay historial de tasas registradas
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {historial.map((tasa) => (
                <li
                  key={tasa.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {tasa.valor} Bs/USD
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Por {tasa.registrada_por} · {formatRelative(tasa.registrada_en)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="min-h-8">
                    Histórico
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
