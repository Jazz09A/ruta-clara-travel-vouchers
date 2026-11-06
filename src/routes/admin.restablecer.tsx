import { createFileRoute, Link, type ErrorComponentProps } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Campo } from "@/components/admin/Campo";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { esApiError } from "@/lib/domain/api";
import { MARCA } from "@/lib/brand";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/restablecer")({
  head: () => ({
    meta: [
      { title: "Restablecer contraseña · Panel" },
      { name: "description", content: "Recupera tu acceso al panel administrativo." },
    ],
  }),
  component: RestablecerContrasena,
  errorComponent: ErrorRestablecer,
});

function RestablecerContrasena() {
  const [enviado, setEnviado] = useState(false);
  const [correo, setCorreo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);

    try {
      // TODO: Integrar con la API real: POST /auth/recuperar
      // await api.auth.recuperar({ correo });

      // Simulación
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setEnviado(true);
      toast.success("Si el correo existe, te enviamos un enlace");
    } catch (error) {
      toast.error(mensajeDeError(error));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AdminShell titulo="Restablecer contraseña">
      <div className="mx-auto w-full max-w-md">
        <Link
          to="/admin/login"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al login
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">
            Restablecer contraseña
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Te enviaremos un enlace a tu correo para que crees una nueva contraseña.
          </p>

          {!enviado ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Campo
                id="correo"
                label="Correo electrónico"
                type="email"
                autoComplete="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="tu@correo.com"
                required
              />

              <BotonCargar
                type="submit"
                cargando={enviando}
                className="w-full"
                disabled={!correo}
              >
                Enviar enlace
              </BotonCargar>
            </form>
          ) : (
            <div className="mt-6 rounded-xl bg-success/10 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Si el correo existe, te enviamos un enlace
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Revisa tu bandeja de entrada y sigue las instrucciones. El enlace expira en 30
                    minutos.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

function ErrorRestablecer({ error, reset }: ErrorComponentProps) {
  console.error(error);

  return (
    <AdminShell titulo="Algo salió mal">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-destructive/50 bg-destructive/5 p-6">
          <h2 className="text-lg font-bold text-foreground">Algo salió mal</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No pudimos procesar tu solicitud. Vuelve a intentarlo.
          </p>
          <button
            onClick={reset}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reintentar
          </button>
        </div>
      </div>
    </AdminShell>
  );
}

function mensajeDeError(error: unknown): string {
  if (esApiError(error)) {
    return error.mensajeMostrable;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "No pudimos procesar tu solicitud";
}
