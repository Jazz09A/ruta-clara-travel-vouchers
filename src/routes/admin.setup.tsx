import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, LogIn, MailCheck, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { BotonCargar } from "@/components/admin/BotonCargar";
import { Field } from "@/components/admin/Field";
import { completarSetup, useNavegarAdmin, useSesion } from "@/components/admin/auth/sesion";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/domain/api";
import { MARCA } from "@/lib/brand";
import { api } from "@/lib/api";

/**
 * A-01 · Ingreso al panel (Spec §9.2, UX-61).
 *
 * Onboarding del primer arranque: crea el primer superadmin y personaliza
 * la agencia. Solo está disponible mientras no exista un administrador
 * (GET /setup/estado → requiere_onboarding: true).
 * Tras completarse, deja la sesión iniciada y redirige al panel.
 */

export const Route = createFileRoute("/admin/setup")({
  head: () => ({
    meta: [
      {
        title: `Configurar el primer administrador · ${MARCA.nombre}`,
      },
      {
        name: "description",
        content: "Crea el superadministrador y personaliza la agencia.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PantallaSetup,
});

function PantallaSetup() {
  const navegar = useNavegarAdmin();
  const { rutaPendiente } = useSesion();

  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmar, setPasswordConfirmar] = useState("");
  const [agenciaNombre, setAgenciaNombre] = useState("");
  const [agenciaEmail, setAgenciaEmail] = useState("");
  const [agenciaWhatsapp, setAgenciaWhatsapp] = useState("");
  const [agenciaDireccion, setAgenciaDireccion] = useState("");
  const [agenciaZonaHoraria, setAgenciaZonaHoraria] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [verPasswordConfirmar, setVerPasswordConfirmar] = useState(false);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentos, setIntentos] = useState(0);
  const [esperaHasta, setEsperaHasta] = useState<number | null>(null);
  const [restante, setRestante] = useState(0);
  const [yaExisteAdmin, setYaExisteAdmin] = useState(false);

  // --- Cuenta regresiva de espera por 429 ---
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

  useEffect(() => {
    let ignorar = false;
    (async () => {
      try {
        const { requiere_onboarding } = await api.admin.estadoSetup();
        if (!ignorar && !requiere_onboarding) {
          setYaExisteAdmin(true);
        }
      } catch {
        /* si falla la comprobación, mostramos el formulario igualmente */
      }
    })();
    return () => {
      ignorar = true;
    };
  }, []);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (cargando || bloqueado) return;
    setCargando(true);
    setError(null);

    try {
      await api.admin.iniciarSetup({
        nombre: nombre.trim(),
        correo: correo.trim().toLowerCase(),
        password,
        agencia: {
          nombre: agenciaNombre.trim(),
          email: agenciaEmail.trim() || undefined,
          whatsapp: agenciaWhatsapp.trim() || undefined,
          direccion: agenciaDireccion.trim() || undefined,
          zona_horaria: agenciaZonaHoraria.trim() || undefined,
        },
      });
      // El backend ya emitió la sesión (access_token). Confirmamos el usuario.
      await completarSetup();
      navegar(rutaPendiente ?? "/admin", { reemplazar: true });
    } catch (fallo) {
      const apiError = fallo instanceof ApiError ? fallo : null;
      const datos = apiError?.data?.["retry_after"];
      const segundos = typeof datos === "number" ? datos : 60;

      if (apiError?.codigo === "SETUP_YA_COMPLETADO") {
        setYaExisteAdmin(true);
        setError("El administrador ya fue creado. Accede con tu cuenta.");
        return;
      }

      if (apiError?.codigo === "DEMASIADAS_SOLICITUDES" || apiError?.status === 429) {
        setEsperaHasta(Date.now() + segundos * 1000);
        setError("Demasiados intentos. Espera un momento antes de volver a intentarlo.");
        return;
      }

      const total = intentos + 1;
      setIntentos(total);
      if (total >= 5) {
        setEsperaHasta(Date.now() + 60 * 1000);
      }

      // Mensaje genérico: no revela si el correo ya existe ni detalles del fallo.
      setError("No se pudo completar el registro. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  // Ya existe un administrador: avisar y ofrecer ir al login.
  if (yaExisteAdmin) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8 sm:py-10">
        <div className="w-full max-w-md space-y-6">
          <header className="flex flex-col items-center gap-3 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand">
              <ShieldCheck className="h-6 w-6 text-white" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">El administrador ya existe</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                El primer administrador de {MARCA.nombre} ya fue configurado.
              </p>
            </div>
          </header>

          <div
            role="status"
            className="rounded-xl border border-amber-600/30 bg-amber-500/10 px-4 py-3"
          >
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              {error ?? "Accede con tu cuenta para continuar."}
            </p>
          </div>

          <Link
            to="/admin/login"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Ir al inicio de sesión
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8 sm:py-10">
      <div className="w-full max-w-md space-y-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand">
            <MailCheck className="h-6 w-6 text-white" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Configurar el primer administrador
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {MARCA.nombre} · creación de cuenta y datos de la agencia
            </p>
          </div>
        </header>

        <form onSubmit={enviar} className="space-y-4" noValidate>
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

          <Field id="nombre" etiqueta="Tu nombre" obligatorio>
            <Input
              type="text"
              autoComplete="name"
              autoCapitalize="words"
              placeholder="Juan Pérez"
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              className="h-11"
            />
          </Field>

          <Field
            id="correo"
            etiqueta="Correo electrónico"
            ayuda="El correo con el que te registrarás en la agencia."
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

          <Field
            id="password"
            etiqueta="Contraseña"
            ayuda="Mínimo 10 caracteres."
            obligatorio
            trailing={
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                aria-pressed={verPassword}
                aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {verPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            }
          >
            <Input
              type={verPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••••"
              value={password}
              onChange={(evento) => setPassword(evento.target.value)}
              className="h-11 pr-12"
            />
          </Field>

          <Field
            id="password-confirmar"
            etiqueta="Confirma la contraseña"
            obligatorio
            trailing={
              <button
                type="button"
                onClick={() => setVerPasswordConfirmar((v) => !v)}
                aria-pressed={verPasswordConfirmar}
                aria-label={verPasswordConfirmar ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {verPasswordConfirmar ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            }
          >
            <Input
              type={verPasswordConfirmar ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••••"
              value={passwordConfirmar}
              onChange={(evento) => setPasswordConfirmar(evento.target.value)}
              className="h-11 pr-12"
            />
          </Field>

          <Field id="agencia-nombre" etiqueta="Nombre de la agencia" obligatorio>
            <Input
              type="text"
              autoComplete="organization"
              autoCapitalize="words"
              placeholder="Ruta Clara Viajes"
              value={agenciaNombre}
              onChange={(evento) => setAgenciaNombre(evento.target.value)}
              className="h-11"
            />
          </Field>

          <Field id="agencia-email" etiqueta="Correo de la agencia">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="agencia@rutaclara.ve"
              value={agenciaEmail}
              onChange={(evento) => setAgenciaEmail(evento.target.value)}
              className="h-11"
            />
          </Field>

          <Field id="agencia-whatsapp" etiqueta="WhatsApp de la agencia">
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+58 412 000 0000"
              value={agenciaWhatsapp}
              onChange={(evento) => setAgenciaWhatsapp(evento.target.value)}
              className="h-11"
            />
          </Field>

          <Field id="agencia-direccion" etiqueta="Dirección de la agencia">
            <Input
              type="text"
              autoComplete="street-address"
              placeholder="Av. Principal, Caracas"
              value={agenciaDireccion}
              onChange={(evento) => setAgenciaDireccion(evento.target.value)}
              className="h-11"
            />
          </Field>

          <Field id="agencia-zona-horaria" etiqueta="Zona horaria">
            <Input
              type="text"
              autoComplete="off"
              placeholder="America/Caracas"
              value={agenciaZonaHoraria}
              onChange={(evento) => setAgenciaZonaHoraria(evento.target.value)}
              className="h-11"
            />
          </Field>

          <BotonCargar
            type="submit"
            cargando={cargando}
            disabled={bloqueado}
            textoCargando="Creando administrador…"
            className="h-11 w-full"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Crear administrador
          </BotonCargar>

          <Link
            to="/admin/login"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Tengo cuenta, ir al inicio de sesión
          </Link>
        </form>
      </div>
    </main>
  );
}
