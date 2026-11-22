import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Banner } from "@/components/admin/Banner";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { Field } from "@/components/admin/Field";
import { ProveedorSesion } from "@/components/admin/auth/sesion";
import { Input } from "@/components/ui/input";
import { MARCA } from "@/lib/brand";
import { api } from "@/lib/api";

/**
 * A-03 · Recuperar contraseña (Spec §9.2, UX-65).
 *
 * La respuesta es siempre la misma: nunca se revela si el correo existe.
 */

export const Route = createFileRoute("/admin/recuperar")({
  head: () => ({
    meta: [
      { title: `Recuperar contraseña · ${MARCA.nombre}` },
      { name: "description", content: "Solicita un enlace para restablecer tu contraseña." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PantallaRecuperar,
});

/** Vigencia del enlace de restablecimiento. */
const VIGENCIA_ENLACE_MINUTOS = 30;

function PantallaRecuperar() {
  return (
    <ProveedorSesion>
      <FormularioRecuperar />
    </ProveedorSesion>
  );
}

function FormularioRecuperar() {
  const [correo, setCorreo] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (cargando) return;
    setCargando(true);
    try {
      await api.admin.recuperar({ correo: correo.trim() });
    } catch {
      /* la demo no tiene servidor real: nunca se revela el resultado */
    } finally {
      setCargando(false);
      // La respuesta es la misma exista o no el correo: nunca lo revelamos.
      setEnviado(true);
    }
  }

  if (enviado) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md space-y-6">
          <header className="flex flex-col items-center gap-3 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand">
              <MailCheck className="h-6 w-6 text-white" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Revisa tu correo</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Si el correo existe, te enviamos un enlace para restablecer la contraseña.
              </p>
            </div>
          </header>

          <Banner tono="info" titulo="Demo local">
            No se envía ningún correo real. El enlace caduca en {VIGENCIA_ENLACE_MINUTOS} minutos y
            sólo sirve dentro de esta demo.
          </Banner>

          <Link
            to="/admin/login"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-input px-4 text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al inicio de sesión
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand">
            <span className="h-4 w-4 rounded-full bg-white/90" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Recupera tu contraseña</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {MARCA.nombre} · te enviamos un enlace por correo.
            </p>
          </div>
        </header>

        <Banner tono="aviso" titulo="Demo local">
          Esta pantalla es una simulación: no se envía ningún correo ni se guarda nada.
        </Banner>

        <form onSubmit={enviar} className="space-y-4" noValidate>
          <Field
            id="correo-recuperacion"
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

          <BotonCargar
            type="submit"
            cargando={cargando}
            textoCargando="Enviando…"
            className="h-11 w-full"
          >
            <MailCheck className="h-4 w-4" aria-hidden="true" />
            Enviar enlace
          </BotonCargar>

          <Link
            to="/admin/login"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al inicio de sesión
          </Link>
        </form>
      </div>
    </main>
  );
}
