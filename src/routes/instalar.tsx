import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Building2, Eye, EyeOff, Rocket, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Banner } from "@/components/admin/Banner";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { Campo } from "@/components/admin/Campo";
import { ProveedorSesion, useNavegarAdmin, useSesion } from "@/components/admin/auth/sesion";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/domain/api";
import { useSetupRequerido } from "@/lib/hooks/use-setup";
import {
  FORMULARIO_VACIO,
  MIN_PASSWORD,
  reglasPassword,
  validarAgencia,
  validarCuenta,
  type ErroresInstalacion,
  type FormularioInstalacion,
} from "@/lib/onboarding";
import { MARCA } from "@/lib/brand";

/**
 * Onboarding del primer arranque (A-00).
 *
 * Se muestra únicamente cuando la instalación no tiene administrador: es el
 * momento de crear la primera cuenta y de personalizar la agencia. Terminado
 * el alta, la API deja la sesión abierta y el usuario entra al panel.
 */

export const Route = createFileRoute("/instalar")({
  head: () => ({
    meta: [
      { title: `Instalar la agencia · ${MARCA.nombre}` },
      { name: "description", content: "Configuración inicial del panel de la agencia." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Instalar,
});

/** Zonas horarias frecuentes para una agencia de viajes. */
const ZONAS_HORARIAS = [
  { valor: "America/Caracas", etiqueta: "Caracas (GMT-4)" },
  { valor: "America/Bogota", etiqueta: "Bogotá (GMT-5)" },
  { valor: "America/Lima", etiqueta: "Lima (GMT-5)" },
  { valor: "America/Mexico_City", etiqueta: "Ciudad de México (GMT-6)" },
  { valor: "America/Argentina/Buenos_Aires", etiqueta: "Buenos Aires (GMT-3)" },
  { valor: "America/Santiago", etiqueta: "Santiago (GMT-4/-3)" },
  { valor: "America/Guayaquil", etiqueta: "Guayaquil (GMT-5)" },
  { valor: "America/Panama", etiqueta: "Panamá (GMT-5)" },
  { valor: "Europe/Madrid", etiqueta: "Madrid (GMT+1/+2)" },
  { valor: "UTC", etiqueta: "UTC" },
];

/** Lleva el foco al primer campo con error (UX-11). */
function enfocarPrimerError(errores: ErroresInstalacion): void {
  const primero = (Object.keys(errores) as Array<keyof FormularioInstalacion>).find(
    (campo) => errores[campo],
  );
  if (!primero) return;
  document.getElementById(primero)?.focus();
}

function Instalar() {
  return (
    <ProveedorSesion>
      <PantallaInstalar />
    </ProveedorSesion>
  );
}

function PantallaInstalar() {
  const { requiereOnboarding, cargando, error, reintentar } = useSetupRequerido();
  const navegar = useNavegarAdmin();

  // Ya hay administrador: esta pantalla no aplica.
  useEffect(() => {
    if (cargando || error) return;
    if (!requiereOnboarding) navegar("/admin/login", { reemplazar: true });
  }, [cargando, error, requiereOnboarding, navegar]);

  if (cargando) return <PantallaCarga />;
  if (error) {
    return (
      <PantallaMensaje
        titulo="No pudimos comprobar la instalación"
        descripcion="No responde el servidor. Revisa que el API esté encendido e inténtalo de nuevo."
        accion={{ texto: "Reintentar", onClick: reintentar }}
      />
    );
  }
  if (!requiereOnboarding) return <PantallaCarga />;

  return <FormularioInstalar />;
}

function PantallaCarga() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Cargando…</p>
      </div>
    </main>
  );
}

function PantallaMensaje({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion: string;
  accion: { texto: string; onClick: () => void };
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{descripcion}</p>
        <Button onClick={accion.onClick} className="min-h-11 w-full">
          {accion.texto}
        </Button>
      </div>
    </main>
  );
}

function FormularioInstalar() {
  const { iniciarSesion } = useSesion();
  const navegar = useNavegarAdmin();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormularioInstalacion>(FORMULARIO_VACIO);
  const [errores, setErrores] = useState<ErroresInstalacion>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [yaInstalado, setYaInstalado] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [paso, setPaso] = useState<1 | 2>(1);

  const actualizar = (campo: keyof FormularioInstalacion) => (valor: string) => {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
    setErrores((anteriores) => ({ ...anteriores, [campo]: undefined }));
  };

  const reglas = useMemo(() => reglasPassword(form.password), [form.password]);

  function irAlPaso2(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const encontrados = validarCuenta(form);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) {
      enfocarPrimerError(encontrados);
      return;
    }
    setPaso(2);
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;

    const erroresCuenta = validarCuenta(form);
    const encontrados = { ...erroresCuenta, ...validarAgencia(form) };
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) {
      setPaso(Object.keys(erroresCuenta).length > 0 ? 1 : 2);
      enfocarPrimerError(encontrados);
      return;
    }

    setEnviando(true);
    setErrorGeneral(null);

    try {
      const { usuario } = await api.setup.iniciar({
        nombre: form.nombre.trim(),
        correo: form.correo.trim(),
        password: form.password,
        agencia: {
          nombre: form.agenciaNombre.trim(),
          email: form.agenciaEmail.trim() || undefined,
          whatsapp: form.agenciaWhatsapp.trim() || undefined,
          direccion: form.agenciaDireccion.trim() || undefined,
          zona_horaria: form.agenciaZona,
        },
      });
      iniciarSesion(usuario);
      // La agencia acaba de cambiar de nombre: se invalida la caché para que
      // el panel se presente con el nombre recién elegido.
      void queryClient.invalidateQueries({ queryKey: ["publico", "agencia"] });
      toast.success(
        `¡Listo, ${usuario.nombre}! Tu panel de ${form.agenciaNombre.trim()} ya está activo.`,
      );
      navegar("/admin", { reemplazar: true });
    } catch (fallo) {
      const apiError = fallo instanceof ApiError ? fallo : null;

      if (apiError?.codigo === "SETUP_YA_COMPLETADO" || apiError?.status === 409) {
        setYaInstalado(true);
        setErrorGeneral("Esta instalación ya tiene un administrador. Entra con tu cuenta.");
        return;
      }
      if (apiError?.codigo === "DEMASIADAS_SOLICITUDES" || apiError?.status === 429) {
        const datos = apiError?.data?.["retry_after"];
        const segundos = typeof datos === "number" ? datos : 60;
        setErrorGeneral(
          `Demasiados intentos. Espera ${segundos} segundos antes de volver a intentarlo.`,
        );
        return;
      }
      if (apiError?.status === 422 && apiError.detalles?.length) {
        const primero = apiError.detalles[0];
        if (primero?.campo) {
          setErrores({ [primero.campo]: primero.mensaje } as ErroresInstalacion);
          return;
        }
      }
      setErrorGeneral(
        apiError?.mensajeMostrable ?? "No pudimos completar la instalación. Intenta de nuevo.",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center bg-background px-4 py-8 sm:py-12">
      <div className="w-full max-w-lg space-y-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand">
            <Rocket className="h-5 w-5 text-white" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Configura tu agencia</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Primer arranque: crea tu cuenta de administrador y deja el panel con tu nombre.
            </p>
          </div>
        </header>

        <ol
          className="flex items-center justify-center gap-2 text-xs font-semibold"
          aria-label="Pasos"
        >
          <li
            className={`rounded-full px-3 py-1 ${paso === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            aria-current={paso === 1 ? "step" : undefined}
          >
            1 · Tu cuenta
          </li>
          <li
            className={`rounded-full px-3 py-1 ${paso === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            aria-current={paso === 2 ? "step" : undefined}
          >
            2 · Tu agencia
          </li>
        </ol>

        {errorGeneral ? (
          <Banner tono="peligro" titulo="No se pudo completar la instalación">
            <p>{errorGeneral}</p>
            {yaInstalado ? (
              <Button
                variant="outline"
                className="mt-3 min-h-11"
                onClick={() => navegar("/admin/login")}
              >
                Ir al acceso
              </Button>
            ) : null}
          </Banner>
        ) : null}

        {paso === 1 ? (
          <form onSubmit={irAlPaso2} className="space-y-4" noValidate>
            <Campo
              id="nombre"
              label="Tu nombre"
              type="text"
              autoComplete="name"
              value={form.nombre}
              onChange={(e) => actualizar("nombre")(e.target.value)}
              error={errores.nombre}
              ayuda="Así te saludaremos en el panel."
            />

            <Campo
              id="correo"
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              value={form.correo}
              onChange={(e) => actualizar("correo")(e.target.value)}
              error={errores.correo}
              ayuda="Con este correo entrarás al panel."
            />

            <Campo
              id="password"
              label="Contraseña"
              type={verPassword ? "text" : "password"}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => actualizar("password")(e.target.value)}
              error={errores.password}
              ayuda="Mínimo 10 caracteres, con letras y números."
            />

            <Campo
              id="confirmar"
              label="Repite la contraseña"
              type={verPassword ? "text" : "password"}
              autoComplete="new-password"
              value={form.confirmar}
              onChange={(e) => actualizar("confirmar")(e.target.value)}
              error={errores.confirmar}
            />

            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {reglas.map((regla) => (
                <li key={regla.texto} className="flex items-center gap-1">
                  <ShieldCheck
                    className={`h-3.5 w-3.5 ${regla.cumple ? "text-emerald-600" : "text-muted-foreground/50"}`}
                    aria-hidden="true"
                  />
                  <span className={regla.cumple ? "text-foreground" : undefined}>
                    {regla.texto}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                onClick={() => setVerPassword((v) => !v)}
              >
                {verPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
                {verPassword ? "Ocultar" : "Mostrar"} contraseña
              </Button>
            </div>

            <BotonCargar type="submit" className="h-11 w-full">
              Continuar
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </BotonCargar>
          </form>
        ) : (
          <form onSubmit={enviar} className="space-y-4" noValidate>
            <Campo
              id="agenciaNombre"
              label="Nombre de la agencia"
              type="text"
              value={form.agenciaNombre}
              onChange={(e) => actualizar("agenciaNombre")(e.target.value)}
              error={errores.agenciaNombre}
              ayuda="Aparecerá en el panel y en los correos al cliente."
            />

            <Campo
              id="agenciaEmail"
              label="Correo de la agencia"
              type="email"
              value={form.agenciaEmail}
              onChange={(e) => actualizar("agenciaEmail")(e.target.value)}
              error={errores.agenciaEmail}
            />

            <Campo
              id="agenciaWhatsapp"
              label="WhatsApp de la agencia"
              type="text"
              inputMode="tel"
              value={form.agenciaWhatsapp}
              onChange={(e) => actualizar("agenciaWhatsapp")(e.target.value)}
              ayuda="Con prefijo internacional, por ejemplo +584121234567."
            />

            <Campo
              id="agenciaDireccion"
              label="Dirección"
              type="text"
              value={form.agenciaDireccion}
              onChange={(e) => actualizar("agenciaDireccion")(e.target.value)}
            />

            <Campo
              id="agenciaZona"
              label="Zona horaria"
              type="select"
              value={form.agenciaZona}
              onChange={(e) => actualizar("agenciaZona")(e.target.value)}
            >
              {ZONAS_HORARIAS.map((zona) => (
                <option key={zona.valor} value={zona.valor}>
                  {zona.etiqueta}
                </option>
              ))}
            </Campo>

            {form.agenciaNombre.trim() ? (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand">
                  <Building2 className="h-5 w-5 text-white" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">
                    {form.agenciaNombre.trim()}
                  </p>
                  <p className="text-xs text-muted-foreground">Así se verá tu panel.</p>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setPaso(1)}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Volver
              </Button>
              <BotonCargar
                type="submit"
                cargando={enviando}
                className="h-11 sm:min-w-44"
                textoCargando="Creando tu panel…"
              >
                Crear mi panel
              </BotonCargar>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
