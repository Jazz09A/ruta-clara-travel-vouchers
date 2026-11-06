import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, CircleCheck, TriangleAlert } from "lucide-react";

import type { RespuestasFormulario } from "@/lib/domain/api";
import {
  aplicarValorDefecto,
  evaluarCampos,
  type ContextoMotor,
  validarFormulario,
} from "@/lib/domain/form-engine";
import type { CampoDef, Categoria, Pasajero, Respuesta } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

import { FormularioDinamico } from "../form-engine";

export interface PreguntasProps {
  /** Definición del formulario (snapshot de la reserva). */
  campos: CampoDef[];
  /** Pasajeros de la reserva (el titular es el primero). */
  pasajeros: Pasajero[];
  /** Respuestas actuales. */
  respuestas: RespuestasFormulario;
  /** Cambia una respuesta (inmediato, reevalúa visibilidad). */
  onCambiar: (respuestas: RespuestasFormulario) => void;
  /** Autoguardado. */
  onGuardar: (respuestas: RespuestasFormulario) => void;
  onContinuar: () => void;
  registrarContinuar?: ((accion: () => void) => void) | undefined;
  /** Opciones agotadas: `"campoId:valor" -> true`. */
  agotadas?: Record<string, boolean> | undefined;
  errorServidor?: string | undefined;
}

/** Un valor está vacío si no hay nada que mostrar. */
function esVacio(valor: Respuesta | undefined): boolean {
  if (valor === null || valor === undefined) return true;
  if (valor === "") return true;
  if (Array.isArray(valor) && valor.length === 0) return true;
  if (valor === false) return true;
  return false;
}

/**
 * Sólo se pueden copiar respuestas de campos de selección sin cupo propio y
 * que no sean datos sensibles (por ejemplo, alergias).
 */
function admiteCopia(campo: CampoDef): boolean {
  if (campo.tipo !== "select") return false;
  if ((campo.opciones ?? []).some((opcion) => opcion.cupo !== undefined)) return false;
  return !/alergi|condici|medic|salud|diagn/i.test(campo.label);
}

/**
 * P-04 — Preguntas del tour.
 *
 * Primero los campos "para toda la reserva" y luego un acordeón por
 * pasajero con los campos que le aplican (Spec §5, P-04).
 */
export function Preguntas({
  campos,
  pasajeros,
  respuestas,
  onCambiar,
  onGuardar,
  onContinuar,
  registrarContinuar,
  agotadas,
  errorServidor,
}: PreguntasProps) {
  const [respuestasLocales, setRespuestasLocales] = useState<RespuestasFormulario>(respuestas);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [anuncio, setAnuncio] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [modoCompartido, setModoCompartido] = useState<Record<string, boolean>>({});
  const inicializadoRef = useRef(false);

  const categorias = useMemo(() => {
    const mapa: Record<string, Categoria> = {};
    for (const pasajero of pasajeros) mapa[pasajero.ref_cliente] = pasajero.categoria;
    return mapa;
  }, [pasajeros]);

  const ctx: ContextoMotor = useMemo(
    () => ({
      campos,
      globales: respuestasLocales.globales,
      porPasajero: respuestasLocales.por_pasajero,
      categorias,
      agotadas,
    }),
    [agotadas, campos, categorias, respuestasLocales],
  );

  // Los valores por defecto se pre-cargan sólo la primera vez (Spec §6.3).
  useEffect(() => {
    if (inicializadoRef.current) return;
    inicializadoRef.current = true;
    const conDefecto = aplicarValorDefecto({
      campos,
      globales: respuestasLocales.globales,
      porPasajero: respuestasLocales.por_pasajero,
      categorias,
      agotadas,
    });
    setRespuestasLocales({
      globales: conDefecto.globales,
      por_pasajero: conDefecto.porPasajero,
    });
  }, [agotadas, categorias, campos, respuestasLocales.globales, respuestasLocales.por_pasajero]);

  // Se abre el primer pasajero incompleto.
  useEffect(() => {
    if (expandido) return;
    for (const pasajero of pasajeros) {
      const progreso = avanceDe(ctx, pasajero.ref_cliente, modoCompartido);
      if (progreso.respondidos < progreso.total) {
        setExpandido(pasajero.ref_cliente);
        return;
      }
    }
  }, [ctx, expandido, pasajeros]);

  const guardar = (siguiente: RespuestasFormulario) => {
    setRespuestasLocales(siguiente);
    onGuardar(siguiente);
  };

  const cambiarGlobal = (campoId: string, valor: Respuesta) => {
    const siguiente: RespuestasFormulario = {
      ...respuestasLocales,
      globales: { ...respuestasLocales.globales, [campoId]: valor },
    };
    setRespuestasLocales(siguiente);
    onCambiar(siguiente);
  };

  const cambiarPasajero = (ref: string, campoId: string, valor: Respuesta) => {
    const propias = respuestasLocales.por_pasajero[ref] ?? {};
    const siguiente: RespuestasFormulario = {
      ...respuestasLocales,
      por_pasajero: {
        ...respuestasLocales.por_pasajero,
        [ref]: { ...propias, [campoId]: valor },
      },
    };
    setRespuestasLocales(siguiente);
    onCambiar(siguiente);
  };

  const alternarModoCompartido = (campoId: string, compartido: boolean) => {
    const siguienteModo = { ...modoCompartido, [campoId]: compartido };
    setModoCompartido(siguienteModo);

    if (compartido) {
      // Vuelve a una sola respuesta: se toma la del primer pasajero.
      const primer = pasajeros[0];
      const valor = primer ? respuestasLocales.por_pasajero[primer.ref_cliente]?.[campoId] : undefined;
      const porPasajero: Record<string, Record<string, Respuesta>> = {};
      for (const pasajero of pasajeros) {
        const propias = respuestasLocales.por_pasajero[pasajero.ref_cliente];
        if (!propias || !(campoId in propias)) continue;
        const copia = { ...propias };
        delete copia[campoId];
        porPasajero[pasajero.ref_cliente] = copia;
      }
      const siguiente: RespuestasFormulario = {
        ...respuestasLocales,
        globales: { ...respuestasLocales.globales, [campoId]: valor ?? null },
        por_pasajero: porPasajero,
      };
      setRespuestasLocales(siguiente);
      onGuardar(siguiente);
      return;
    }

    // Cada pasajero responde por su cuenta: la respuesta global se vacía.
    const siguiente: RespuestasFormulario = {
      ...respuestasLocales,
      globales: { ...respuestasLocales.globales, [campoId]: null },
    };
    setRespuestasLocales(siguiente);
    onGuardar(siguiente);
  };

  const copiarDelAnterior = (ref: string, campoId: string) => {
    const indice = pasajeros.findIndex((pasajero) => pasajero.ref_cliente === ref);
    if (indice <= 0) return;
    const anterior = pasajeros[indice - 1];
    if (!anterior) return;
    const valor = respuestasLocales.por_pasajero[anterior.ref_cliente]?.[campoId];
    if (valor === undefined) return;
    cambiarPasajero(ref, campoId, valor);
  };

  const continuar = () => {
    const resultado = validarFormulario(ctx);
    if (!resultado.ok) {
      const nuevosErrores: Record<string, string> = {};
      for (const error of resultado.errores) {
        const clave = error.pasajero_ref ? `${error.campo}@${error.pasajero_ref}` : error.campo;
        if (!nuevosErrores[clave]) nuevosErrores[clave] = error.mensaje;
      }
      setErrores(nuevosErrores);
      setAnuncio(
        `Hay ${resultado.errores.length} ${resultado.errores.length === 1 ? "pregunta" : "preguntas"} por corregir`,
      );

      const primero = resultado.errores[0];
      if (primero) {
        if (primero.pasajero_ref) setExpandido(primero.pasajero_ref);
        window.requestAnimationFrame(() => {
          document.getElementById(`campo-${primero.campo}`)?.focus();
        });
      }
      return;
    }

    setErrores({});
    setAnuncio("");
    guardar(respuestasLocales);
    onContinuar();
  };

  useEffect(() => {
    registrarContinuar?.(continuar);
  });

  const filtroGlobal = (campo: CampoDef) =>
    campo.alcance === "por_reserva" && modoCompartido[campo.id] !== false;

  const filtroPasajero = (campo: CampoDef) =>
    campo.alcance === "por_pasajero" ||
    (campo.alcance === "por_reserva" &&
      campo.permite_por_pasajero === true &&
      modoCompartido[campo.id] === false);

  const hayGlobales = campos.some(filtroGlobal);

  return (
    <div className="flex flex-col gap-5">
      <p aria-live="assertive" className="sr-only">
        {anuncio}
      </p>

      {errorServidor ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {errorServidor}
        </p>
      ) : null}

      {campos.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Este tour no tiene preguntas adicionales. Ya puedes revisar tu resumen.
        </p>
      ) : null}

      {/* Para toda la reserva */}
      {hayGlobales ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-base font-bold text-foreground">Para toda la reserva</h2>
          <div className="mt-4">
            <FormularioDinamico
              ctx={ctx}
              alcance="por_reserva"
              onChange={cambiarGlobal}
              errores={errores}
              agotadas={agotadas}
              modoCompartido={modoCompartido}
              onAlternarModoCompartido={alternarModoCompartido}
            />
          </div>
        </section>
      ) : null}

      {/* Un acordeón por pasajero */}
      {pasajeros.map((pasajero) => {
        const progreso = avanceDe(ctx, pasajero.ref_cliente, modoCompartido);
        const abierto = expandido === pasajero.ref_cliente;
        const indice = pasajeros.findIndex((p) => p.ref_cliente === pasajero.ref_cliente);

        return (
          <section
            key={pasajero.ref_cliente}
            className="overflow-hidden rounded-2xl border border-border bg-card"
          >
            <button
              type="button"
              onClick={() => setExpandido(abierto ? null : pasajero.ref_cliente)}
              aria-expanded={abierto}
              aria-controls={`preguntas-${pasajero.ref_cliente}`}
              className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-foreground">
                  {pasajero.nombre || `Pasajero ${indice + 1}`}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {`${pasajero.categoria} · ${progreso.respondidos} de ${progreso.total} respondidos`}
                </span>
              </span>
              {progreso.respondidos >= progreso.total && progreso.total > 0 ? (
                <CircleCheck className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              ) : null}
              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                  abierto && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>

            {abierto ? (
              <div
                id={`preguntas-${pasajero.ref_cliente}`}
                className="border-t border-border px-4 py-4"
              >
                {progreso.total === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay preguntas que responder para {pasajero.categoria.toLowerCase()}s.
                  </p>
                ) : (
                  <FormularioDinamico
                    ctx={ctx}
                    alcance="por_pasajero"
                    refPasajero={pasajero.ref_cliente}
                    onChange={(campoId, valor) => cambiarPasajero(pasajero.ref_cliente, campoId, valor)}
                    errores={errores}
                    agotadas={agotadas}
                    filtrarCampos={filtroPasajero}
                    puedeCopiar={admiteCopia}
                    onCopiarAnterior={(campoId) => copiarDelAnterior(pasajero.ref_cliente, campoId)}
                  />
                )}
              </div>
            ) : null}
          </section>
        );
      })}

      {hayGlobales || pasajeros.length > 0 ? (
        <p className="flex items-start gap-2 rounded-xl border border-border bg-muted px-3 py-3 text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Las respuestas se guardan solas. Si algo no aparece, escríbenos y lo revisamos.
          </span>
        </p>
      ) : null}
    </div>
  );
}

/** Avance de un pasajero: cuántos campos visibles tiene y cuántos respondió. */
function avanceDe(
  ctx: ContextoMotor,
  refPasajero: string,
  modoCompartido: Record<string, boolean>,
): { total: number; respondidos: number } {
  const evaluados = evaluarCampos(ctx, refPasajero);
  const aplicables = evaluados.filter((evaluado) => {
    if (!evaluado.aplica || !evaluado.visible) return false;
    if (evaluado.campo.alcance === "por_pasajero") return true;
    return (
      evaluado.campo.alcance === "por_reserva" &&
      evaluado.campo.permite_por_pasajero === true &&
      modoCompartido[evaluado.campo.id] === false
    );
  });
  const respondidos = aplicables.filter((evaluado) => !esVacio(evaluado.valor)).length;
  return { total: aplicables.length, respondidos };
}
