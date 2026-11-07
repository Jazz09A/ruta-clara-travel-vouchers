import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, EyeOff, LogIn, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Banner } from "@/components/admin/Banner";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { Field } from "@/components/admin/Field";
import { ProveedorSesion, useNavegarAdmin, useSesion } from "@/components/admin/auth/sesion";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/domain/api";
import { MARCA } from "@/lib/brand";

/**
 * A-01 · Ingreso al panel (Spec §9.2, UX-61).
 *
 * El mensaje de error es genérico: nunca se revela si el correo existe.
 * Tras 5 intentos fallidos se muestra una espera con cuenta regresiva.
 */

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: `Entrar al panel · ${MARCA.nombre}` },
      { name: "description", content: "Acceso del equipo de la agencia al panel de reservas." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PantallaLogin,
});

const MAX_INTENTOS = 5;
const ESPERA_SEGUNDOS = 60;

/** Cuentas de la demo local (solo visibles en desarrollo). */
const CUENTAS_DEMO = [
  { correo: "admin@rutaclara.ve", rol: "Administración" },
  { correo: "operador@rutaclara.ve", rol: "Operación" },
  { correo: "validador@rutaclara.ve", rol: "Validación de pagos" },
  { correo: "guia@rutaclara.ve", rol: "Guía / logística" },
];
const PASSWORD_DEMO = "demo1234";

/** Solo desarrollo: muestra las cuentas demo. */
const ES_DEV = import.meta.env.DEV;

function PantallaLogin() {
  return (
    <ProveedorSesion>
      <FormularioLogin />
    </ProveedorSesion>
  );
}

function FormularioLogin() {
  const { login, rutaPendiente, motivoCierre, limpiarMotivoCierre, setRutaPendiente } = useSesion();
  const navegar = useNavegarAdmin();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentos, setIntentos] = useState(0);
  const [esperaHasta, setEsperaHasta] = useState<number | null>(null);
  const [restante, setRestante] = useState(0);

  // Cuenta regresiva de espera.
  useEffect(() => {
    if (esperaHasta === null) {
      setRestante(0);
      return;
    }
    const actualizar = () => {
      const segundos = Math.max(0, Math.ceil((esperaHasta - Date.now()) / 1000));
      setRestante(segundos);
      if (segundos === 0) setEsperaHasta(null);
    };
    actualizar();
    const temporizador = setInterval(actualizar, 1000);
    return () => clearInterval(temporizador);
  }, [esperaHasta]);

  const bloqueado = restante > 0;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (cargando || bloqueado) return;
    setCargando(true);
    setError(null);
    limpiarMotivoCierre();

    try {
      await login(correo.trim(), password);
      navegar(rutaPendiente ?? "/admin");
    } catch (fallo) {
      const apiError = fallo instanceof ApiError ? fallo : null;
      const datos = apiError?.data?.["retry_after"];
      const segundos = typeof datos === "number" ? datos : ESPERA_SEGUNDOS;

      if (apiError?.codigo === "DEMASIADAS_SOLICITUDES" || apiError?.status === 429) {
        setEsperaHasta(Date.now() + segundos * 1000);
        setError("Demasiados intentos. Espera un momento antes de volver a intentarlo.");
        return;
      }

      // Credenciales ya aceptadas pero falló la verificación de la sesión
      // (transitorio, p. ej. un refresh en carrera): no cuenta como intento
      // fallido ni se muestra como error de contraseña.
      if (apiError?.codigo === "VERIFICACION_SESION") {
        setError("No pudimos completar el ingreso. Intenta de nuevo en unos segundos.");
        return;
      }

      const total = intentos + 1;
      setIntentos(total);
      if (total >= MAX_INTENTOS) {
        setEsperaHasta(Date.now() + ESPERA_SEGUNDOS * 1000);
      }
      // Mensaje genérico: no revela si el correo o la contraseña fallaron.
      setError("Correo o contraseña incorrectos.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand">
            <span className="h-4 w-4 rounded-full bg-white/90" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Entrar al panel</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {MARCA.nombre} · gestión de reservas, pagos y salidas
            </p>
          </div>
        </header>

        {motivoCierre ? (
          <Banner tono="aviso" titulo="Tu sesión se cerró por seguridad">
            Vuelve a entrar para continuar donde estabas.
          </Banner>
        ) : null}

        <form onSubmit={enviar} className="space-y-4" noValidate>
          <Field
            id="correo"
            etiqueta="Correo electrónico"
            ayuda="El correo con el que te registraste en la agencia."
            obligatorio
          >
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="nombre@rutaclara.ve"
              value={correo}
              onChange={(evento) => setCorreo(evento.target.value)}
              className="h-11"
            />
          </Field>

          <Field id="password" etiqueta="Contraseña" obligatorio>
            <Input
              type={verPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(evento) => setPassword(evento.target.value)}
              className="h-11"
            />
          </Field>
          <button
            type="button"
            onClick={() => setVerPassword((v) => !v)}
            aria-pressed={verPassword}
            className="inline-flex min-h-11 items-center gap-2 rounded text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {verPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
            {verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          </button>

          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-red-600/30 bg-red-500/10 px-4 py-3"
            >
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">{error}</p>
              {bloqueado ? (
                <p className="mt-1 text-sm text-red-800 dark:text-red-200" aria-live="polite">
                  Espera {restante} segundo{restante === 1 ? "" : "s"} para volver a intentarlo.
                </p>
              ) : null}
            </div>
          ) : null}

          <BotonCargar
            type="submit"
            cargando={cargando}
            disabled={bloqueado}
            textoCargando="Entrando…"
            className="h-11 w-full"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Entrar
          </BotonCargar>

          <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
            <Link
              to="/r/$token"
              params={{ token: "demo" }}
              className="inline-flex min-h-11 items-center gap-2 rounded font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Ver el formulario del cliente
            </Link>
          </div>
        </form>

        {ES_DEV ? (
          <section className="rounded-xl border border-dashed border-border bg-muted/40 p-4">
            <h2 className="text-sm font-bold text-foreground">Cuentas de la demo local</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Esta demo usa cualquiera de estas cuentas con la contraseña{" "}
              <code className="rounded bg-background px-1 py-0.5 font-mono">{PASSWORD_DEMO}</code>.
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {CUENTAS_DEMO.map((cuenta) => (
                <li key={cuenta.correo}>
                  <button
                    type="button"
                    onClick={() => {
                      setCorreo(cuenta.correo);
                      setPassword(PASSWORD_DEMO);
                      setError(null);
                    }}
                    className="flex min-h-11 w-full flex-col rounded-lg border border-border bg-background px-3 py-2 text-left hover:bg-accent"
                  >
                    <span className="truncate text-xs font-mono font-semibold">
                      {cuenta.correo}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{cuenta.rol}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
