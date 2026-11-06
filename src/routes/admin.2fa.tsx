import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Banner } from "@/components/admin/Banner";
import { BotonCargar } from "@/components/admin/BotonCargar";
import { Field } from "@/components/admin/Field";
import { InputOTP } from "@/components/admin/InputOTP";
import { ProveedorSesion, useNavegarAdmin, useSesion } from "@/components/admin/auth/sesion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/domain/api";
import { MARCA } from "@/lib/brand";
import { formatCountdown } from "@/lib/format";

/**
 * A-02 · Verificación en dos pasos (Spec §9.2, UX-62).
 *
 * Campo de 6 dígitos con envío automático al completar el sexto, opción de
 * código de recuperación y vigencia de 5 minutos del token parcial.
 */

export const Route = createFileRoute("/admin/2fa")({
  head: () => ({
    meta: [
      { title: `Verificación en dos pasos · ${MARCA.nombre}` },
      { name: "description", content: "Confirma tu identidad para entrar al panel." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Pantalla2FA,
});

/** Vigencia del token parcial. */
const VIGENCIA_MS = 5 * 60 * 1000;

function Pantalla2FA() {
  return (
    <ProveedorSesion>
      <Formulario2FA />
    </ProveedorSesion>
  );
}

function Formulario2FA() {
  const { tokenParcial, tokenParcialCreadoEn, verificar2fa, rutaPendiente, setRutaPendiente } = useSesion();
  const navegar = useNavegarAdmin();

  const [codigo, setCodigo] = useState("");
  const [recuperacion, setRecuperacion] = useState("");
  const [usarRecuperacion, setUsarRecuperacion] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restante, setRestante] = useState(VIGENCIA_MS);

  // Cuenta regresiva de la vigencia del token parcial.
  useEffect(() => {
    const creado = tokenParcialCreadoEn ?? Date.now();
    const actualizar = () => {
      setRestante(Math.max(0, creado + VIGENCIA_MS - Date.now()));
    };
    actualizar();
    const temporizador = setInterval(actualizar, 1000);
    return () => clearInterval(temporizador);
  }, [tokenParcialCreadoEn]);

  // Sin token parcial (o vencido): de vuelta al login con un aviso.
  useEffect(() => {
    if (!tokenParcial) {
      navegar("/admin/login", { reemplazar: true });
      return;
    }
    if (restante <= 0) {
      navegar("/admin/login", { reemplazar: true });
    }
  }, [tokenParcial, restante, navegar]);

  async function confirmar() {
    if (cargando || !tokenParcial) return;
    const valor = usarRecuperacion ? recuperacion.trim() : codigo;
    if (!valor) {
      setError(
        usarRecuperacion
          ? "Escribe el código de recuperación."
          : "Escribe los 6 dígitos del código.",
      );
      return;
    }
    // Validar que el código tenga 6 dígitos si no es código de recuperación
    if (!usarRecuperacion && valor.length !== 6) {
      setError("El código debe tener 6 dígitos.");
      return;
    }
    setCargando(true);
    setError(null);
    try {
      await verificar2fa(valor, tokenParcial);
      const destino = rutaPendiente === "/admin/login" ? "/admin" : (rutaPendiente ?? "/admin");
      console.log("2FA verificado, navegando a:", destino);
      setRutaPendiente("");
      navegar(destino);
    } catch (fallo) {
      const apiError = fallo instanceof ApiError ? fallo : null;
      if (apiError?.codigo === "ENLACE_VENCIDO" || apiError?.status === 410) {
        navegar("/admin/login", { reemplazar: true });
        return;
      }
      setError("El código no es correcto. Revísalo e inténtalo de nuevo.");
      setCodigo("");
    } finally {
      setCargando(false);
    }
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    void confirmar();
  }

  const expirado = restante <= 0;
  const codigoIncompleto = !usarRecuperacion && codigo.length !== 6;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand">
            <ShieldCheck className="h-6 w-6 text-white" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Verifica tu identidad</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {MARCA.nombre} · introduce el código de 6 dígitos de tu aplicación de autenticación.
            </p>
          </div>
        </header>

        <Banner tono="info" titulo="Demo local">
          El código válido es <code className="font-mono">123456</code> y el código de recuperación es{" "}
          <code className="font-mono">ABCD-EFGH</code>.
        </Banner>

        {expirado ? (
          <Banner tono="peligro" titulo="El código expiró">
            Vuelve a entrar para generar uno nuevo.
          </Banner>
        ) : null}

        <form onSubmit={enviar} className="space-y-4" noValidate>
          {usarRecuperacion ? (
            <Field
              id="codigo-recuperacion"
              etiqueta="Código de recuperación"
              ayuda="Es el código de 8 caracteres que guardaste al activar la verificación."
              obligatorio
            >
              <Input
                value={recuperacion}
                onChange={(evento) => setRecuperacion(evento.target.value.toUpperCase())}
                autoComplete="off"
                spellCheck={false}
                placeholder="ABCD-EFGH"
                className="h-11 font-mono"
              />
            </Field>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Código de 6 dígitos</p>
              <InputOTP
                valor={codigo}
                onValorCambia={setCodigo}
                onCompleto={() => void confirmar()}
                disabled={cargando || expirado}
                aria-label="Código de verificación de 6 dígitos"
              />
            </div>
          )}

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-red-600/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-800 dark:text-red-200"
            >
              {error}
            </p>
          ) : null}

          <div aria-live="polite" className="text-center text-sm text-muted-foreground">
            {expirado ? (
              "El código venció."
            ) : (
              <>
                Este código expira en{" "}
                <span className="font-mono font-semibold text-foreground">
                  {formatCountdown(restante)}
                </span>
                .
              </>
            )}
          </div>

          <BotonCargar
            type="submit"
            cargando={cargando}
            disabled={expirado || codigoIncompleto}
            textoCargando="Verificando…"
            className="h-11 w-full"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Verificar código
          </BotonCargar>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => {
                setUsarRecuperacion((v) => !v);
                setError(null);
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded font-semibold text-primary underline-offset-4 hover:underline"
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              {usarRecuperacion ? "Usar el código de 6 dígitos" : "Usar código de recuperación"}
            </button>
            <Link
              to="/admin/login"
              className="inline-flex min-h-11 items-center rounded font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        </form>

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => navegar("/admin/login", { reemplazar: true })}
        >
          Cancelar y volver al inicio de sesión
        </Button>
      </div>
    </main>
  );
}
