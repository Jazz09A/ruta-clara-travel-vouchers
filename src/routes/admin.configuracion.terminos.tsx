import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, FileText, Plus, Eye, CheckCircle2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Campo } from "@/components/admin/Campo";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { VersionTerminos } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/admin/configuracion/terminos")({
  head: () => ({
    meta: [
      { title: "Términos y condiciones · Panel" },
      { name: "description", content: "Versiones publicadas y editor de términos." },
    ],
  }),
  component: TerminosCondiciones,
});

function TerminosCondiciones() {
  const queryClient = useQueryClient();
  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [nuevoCuerpo, setNuevoCuerpo] = useState("");
  const [vistaPrevia, setVistaPrevia] = useState(false);

  const { data: datos, isLoading } = useQuery({
    queryKey: ["configuracion", "terminos"],
    queryFn: () => api.admin.configuracion(),
  });

  const terminos = datos?.terminos ?? [];
  const versionActiva = terminos.find((t) => t.activa);
  const historial = terminos.filter((t) => !t.activa);

  const mutationPublicar = useMutation({
    mutationFn: async (body: { titulo: string; cuerpo: string }) => {
      return await api.admin.publicarTerminos(body);
    },
    onSuccess: () => {
      toast.success("Términos y condiciones publicados");
      setNuevoTitulo("");
      setNuevoCuerpo("");
      setVistaPrevia(false);
      queryClient.invalidateQueries({ queryKey: ["configuracion", "terminos"] });
    },
    onError: () => {
      toast.error("No pudimos publicar los términos y condiciones");
    },
  });

  const handlePublicar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTitulo || !nuevoCuerpo) return;
    mutationPublicar.mutate({ titulo: nuevoTitulo, cuerpo: nuevoCuerpo });
  };

  return (
    <AdminShell
      titulo="Términos y condiciones"
      breadcrumb={[
        { label: "Panel", to: "/admin" },
        { label: "Configuración", to: "/admin/configuracion" },
        { label: "Términos y condiciones" },
      ]}
    >
      <div className="mx-auto w-full max-w-4xl">
        <Link
          to="/admin/configuracion"
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a configuración
        </Link>

        {/* Versión activa */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
              Versión activa
            </h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta es la versión que los clientes ven actualmente
          </p>

          {isLoading ? (
            <div className="mt-4 h-32 animate-pulse rounded-xl bg-muted" />
          ) : versionActiva ? (
            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-foreground">{versionActiva.titulo}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Versión {versionActiva.version} · Publicada el{" "}
                    {formatRelative(versionActiva.publicada_en)}
                  </p>
                </div>
                <Badge variant="default" className="min-h-8">
                  Activa
                </Badge>
              </div>
              <div className="mt-4 rounded-lg bg-background p-4">
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {versionActiva.cuerpo}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-center">
              <p className="text-sm text-muted-foreground">No hay una versión activa publicada</p>
            </div>
          )}
        </div>

        {/* Crear nueva versión */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                Publicar nueva versión
              </h2>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setVistaPrevia(!vistaPrevia)}
            >
              <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
              {vistaPrevia ? "Ocultar vista previa" : "Vista previa"}
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Al publicar una nueva versión, la anterior pasa al historial
          </p>

          <form onSubmit={handlePublicar} className="mt-6 space-y-4">
            <Campo
              id="titulo"
              label="Título"
              type="text"
              value={nuevoTitulo}
              onChange={(e) => setNuevoTitulo(e.target.value)}
              placeholder="Ej: Términos y condiciones de Escapate Tours"
              required
            />

            <Campo
              id="cuerpo"
              label="Contenido"
              type="textarea"
              rows={10}
              value={nuevoCuerpo}
              onChange={(e) => setNuevoCuerpo(e.target.value)}
              placeholder="Escribe los términos y condiciones completos..."
              required
              ayuda="Puedes usar saltos de línea para separar secciones"
            />

            {vistaPrevia && nuevoCuerpo && (
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="mb-2 text-sm font-semibold text-muted-foreground">Vista previa:</p>
                <div className="rounded-lg bg-background p-4">
                  <p className="whitespace-pre-wrap text-sm text-foreground">{nuevoCuerpo}</p>
                </div>
              </div>
            )}

            <BotonCargar
              type="submit"
              cargando={mutationPublicar.isPending}
              className="w-full"
              textoCargando="Publicando..."
            >
              Publicar nueva versión
            </BotonCargar>
          </form>
        </div>

        {/* Historial */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
              Historial de versiones
            </h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Versiones anteriores que ya no están activas
          </p>

          {isLoading ? (
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : historial.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No hay historial de versiones anteriores
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {historial.map((version) => (
                <li key={version.id} className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{version.titulo}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Versión {version.version} · Publicada el{" "}
                        {formatRelative(version.publicada_en)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="min-h-8">
                      Histórico
                    </Badge>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                      Ver contenido
                    </summary>
                    <div className="mt-2 rounded-lg bg-background p-3">
                      <p className="whitespace-pre-wrap text-xs text-foreground">
                        {version.cuerpo}
                      </p>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
