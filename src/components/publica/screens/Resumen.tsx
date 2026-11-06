import { useEffect, useMemo, useState } from "react";
import {
  BadgePercent,
  ChevronDown,
  CircleAlert,
  Pencil,
  Tag,
  TriangleAlert,
  Users,
} from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type {
  CampoDef,
  CodigoError,
  Respuesta,
  ResumenReserva,
} from "@/lib/domain/types";
import { formatBs, formatDate, formatUsd, plural } from "@/lib/format";

import { BadgeEstado, BotonWhatsApp, DialogoConfirmacion, EstadoBloqueante } from "../ui";
import type { ContextoReserva } from "../use-reserva";

export type ResultadoConfirmacion =
  | { ok: true }
  | {
      ok: false;
      codigo: CodigoError;
      mensaje: string;
      /** Nuevo total cuando el precio cambió (`409 PRECIO_CAMBIO`). */
      nuevoTotalUsd?: string | undefined;
    };

export interface ResumenProps {
  reserva: ContextoReserva;
  /** Resumen que calcula el servidor (autoridad del precio). */
  resumen: ResumenReserva | null;
  /** Definición del formulario, para leer las respuestas con su etiqueta. */
  campos?: CampoDef[] | undefined;
  cargando?: boolean | undefined;
  errorResumen?: string | null | undefined;
  /** Ir a otro paso a editar. */
  onEditar: (paso: string) => void;
  /** Aplicar un código promocional. */
  onAplicarPromo: (codigo: string) => Promise<{ ok: boolean; mensaje?: string | undefined }>;
  /** Quitar el código promocional aplicado. */
  onQuitarPromo: () => Promise<void>;
  /** Confirma el resumen. */
  onConfirmar: (
    totalVistoUsd: string,
    aceptaPolitica: boolean,
  ) => Promise<ResultadoConfirmacion>;
  registrarContinuar?: ((accion: () => void) => void) | undefined;
  confirmando?: boolean | undefined;
  /** Modo lectura: la reserva ya está confirmada. */
  soloLectura?: boolean | undefined;
  /** Reabre la edición (invalida la firma si aplica). */
  onReabrirEdicion?: (() => void) | undefined;
  telefonoWhatsapp?: string | undefined;
}

/**
 * P-05 — Resumen previo al pago.
 *
 * El precio lo calcula el servidor: aquí sólo se muestra (Spec §5, P-05).
 */
export function Resumen({
  reserva,
  resumen,
  campos = [],
  cargando,
  errorResumen,
  onEditar,
  onAplicarPromo,
  onQuitarPromo,
  onConfirmar,
  registrarContinuar,
  confirmando,
  soloLectura,
  onReabrirEdicion,
  telefonoWhatsapp,
}: ResumenProps) {
  const [aceptaPolitica, setAceptaPolitica] = useState(false);
  const [codigoAbierto, setCodigoAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [mensajePromo, setMensajePromo] = useState<string | null>(null);
  const [promoError, setPromoError] = useState(false);
  const [aplicandoPromo, setAplicandoPromo] = useState(false);
  const [dialogoPrecio, setDialogoPrecio] = useState<{ total: string } | null>(null);
  const [bloqueo, setBloqueo] = useState<{ codigo: CodigoError; mensaje: string } | null>(null);
  const [anuncio, setAnuncio] = useState("");

  const promocion = reserva.promocion;

  const total = resumen?.total_usd ?? reserva.total_usd;
  const totalBs = resumen?.total_bs_estimado ?? null;
  const tasa = resumen?.tasa_vigente ?? reserva.tasa_aplicada;

  const cuposPocos = typeof resumen?.cupos_restantes === "number" && resumen.cupos_restantes <= 5;

  const ejemploReembolso = useMemo(() => {
    const tramos = reserva.politica_cancelacion?.tramos;
    const fechaSalida = reserva.fecha?.fecha_salida;
    if (!tramos || tramos.length === 0 || !fechaSalida) return null;

    const salida = new Date(`${fechaSalida}T00:00:00Z`).getTime();
    const hoy = Date.now();
    const dias = Math.max(0, Math.ceil((salida - hoy) / 86_400_000));

    let tramo = tramos[tramos.length - 1];
    for (const candidato of tramos) {
      if (dias >= candidato.dias_desde_salida) tramo = candidato;
    }
    if (!tramo) return null;

    const porcentaje = tramo.porcentaje_reembolso;
    const monto = Number.parseFloat(total) * (porcentaje / 100);
    return {
      dias,
      tramo,
      porcentaje,
      monto: isNaN(monto) ? 0 : monto,
    };
  }, [reserva.fecha?.fecha_salida, reserva.politica_cancelacion?.tramos, total]);

  const confirmar = async (totalVisto: string) => {
    if (!aceptaPolitica) {
      setAnuncio("Debes aceptar la política de cancelación para continuar");
      document.getElementById("acepta-politica")?.focus();
      return;
    }
    setBloqueo(null);
    const resultado = await onConfirmar(totalVisto, aceptaPolitica);
    if (resultado.ok) return;

    if (resultado.codigo === "PRECIO_CAMBIO" && resultado.nuevoTotalUsd) {
      setDialogoPrecio({ total: resultado.nuevoTotalUsd });
      return;
    }
    if (resultado.codigo === "PROMO_INVALIDA") {
      setPromoError(true);
      setMensajePromo(resultado.mensaje);
      return;
    }
    setBloqueo({ codigo: resultado.codigo, mensaje: resultado.mensaje });
  };

  const continuar = () => {
    void confirmar(total);
  };

  useEffect(() => {
    registrarContinuar?.(continuar);
  });

  const aplicarCodigo = async () => {
    if (!codigo.trim()) return;
    setAplicandoPromo(true);
    setMensajePromo(null);
    setPromoError(false);
    const resultado = await onAplicarPromo(codigo.trim());
    setAplicandoPromo(false);
    if (resultado.ok) {
      setCodigo("");
      setMensajePromo("Código aplicado");
    } else {
      setPromoError(true);
      setMensajePromo(resultado.mensaje ?? "Ese código no se pudo aplicar");
    }
  };

  const quitarCodigo = async () => {
    setAplicandoPromo(true);
    await onQuitarPromo();
    setAplicandoPromo(false);
    setMensajePromo("Código quitado");
  };

  if (bloqueo) {
    if (bloqueo.codigo === "SIN_CUPO") {
      return (
        <EstadoBloqueante
          titulo="Ya no hay cupos suficientes para tu grupo"
          mensaje={
            <>
              <p>
                Tu reserva sigue intacta: no perdiste ningún dato. Pero la salida ya no tiene lugar
                para todas las personas del grupo.
              </p>
              <p className="mt-2">
                Puedes reducir el número de pasajeros o hablar con la agencia para buscarte otra
                salida.
              </p>
            </>
          }
          accion={{ etiqueta: "Editar número de pasajeros", onClick: () => onEditar("acompanantes") }}
          whatsappMensaje={`Hola, mi reserva ${reserva.ref_corta} necesita más cupos para la salida. ¿Me pueden ayudar?`}
          telefonoWhatsapp={telefonoWhatsapp}
          tono="aviso"
        />
      );
    }

    if (bloqueo.codigo === "OPCION_AGOTADA") {
      return (
        <EstadoBloqueante
          titulo="Una de tus opciones se agotó"
          mensaje={
            <p>
              {`${bloqueo.mensaje} Vuelve a las preguntas del tour y elige otra opción.`}
            </p>
          }
          accion={{ etiqueta: "Ir a las preguntas", onClick: () => onEditar("preguntas") }}
          telefonoWhatsapp={telefonoWhatsapp}
          tono="aviso"
        />
      );
    }

    if (
      bloqueo.codigo === "CORTE_VENTA_CUMPLIDO" ||
      bloqueo.codigo === "FECHA_CERRADA" ||
      bloqueo.codigo === "RESERVA_CERRADA"
    ) {
      return (
        <EstadoBloqueante
          titulo="Esta salida ya cerró"
          mensaje={<p>{bloqueo.mensaje}</p>}
          whatsappMensaje={`Hola, mi reserva ${reserva.ref_corta} corresponde a una salida que cerró. ¿Qué opciones tengo?`}
          telefonoWhatsapp={telefonoWhatsapp}
          tono="peligro"
        />
      );
    }

    return (
      <EstadoBloqueante
        titulo="No pudimos confirmar tu reserva"
        mensaje={<p>{bloqueo.mensaje}</p>}
        accion={{ etiqueta: "Reintentar", onClick: () => void confirmar(total) }}
        whatsappMensaje={`Hola, tuve un problema confirmando mi reserva ${reserva.ref_corta}.`}
        telefonoWhatsapp={telefonoWhatsapp}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p aria-live="assertive" className="sr-only">
        {anuncio}
      </p>

      {errorResumen ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {errorResumen}
        </p>
      ) : null}

      {cuposPocos ? (
        <p className="flex items-start gap-2 rounded-xl border border-chart-2/40 bg-chart-2/10 px-3 py-3 text-sm text-foreground">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {`Quedan ${plural(resumen?.cupos_restantes ?? 0, "cupo", "cupos")}. Esto no reserva nada todavía.`}
          </span>
        </p>
      ) : null}

      {/* Pasajeros */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="flex-1 text-base font-bold text-foreground">Pasajeros</h2>
          {!soloLectura ? (
            <button
              type="button"
              onClick={() => onEditar("acompanantes")}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              <span>Editar</span>
            </button>
          ) : null}
        </div>

        <ul className="mt-3 flex flex-col divide-y divide-border">
          {(resumen?.pasajeros ?? reserva.pasajeros).map((pasajero, indice) => (
            <li key={pasajero.ref_cliente} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">
                    {`${indice + 1}. ${pasajero.nombre || `Pasajero ${indice + 1}`}`}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {pasajero.categoria}
                    {pasajero.documento ? ` · ${maskDoc(pasajero.tipo_doc, pasajero.documento)}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-1">
                {Object.entries(pasajero.respuestas ?? {}).map(([campoId, valor]) => {
                  const campo = campos.find((c) => c.id === campoId);
                  const texto = valorLegible(campo, valor);
                  if (!texto) return null;
                  const esAlergia = Boolean(campo && /alergi|condici|medic/i.test(campo.label));
                  return (
                    <p
                      key={campoId}
                      className={
                        esAlergia
                          ? "text-xs font-semibold text-destructive"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {`${campo?.label ?? campoId}: ${texto}`}
                    </p>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Preguntas del tour */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-base font-bold text-foreground">Respuestas del tour</h2>
          {!soloLectura ? (
            <button
              type="button"
              onClick={() => onEditar("preguntas")}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              <span>Editar</span>
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex flex-col gap-1">
          {Object.entries(resumen?.respuestas_globales ?? reserva.respuestas_globales).map(
            ([campoId, valor]) => {
              const campo = campos.find((c) => c.id === campoId);
              const texto = valorLegible(campo, valor);
              if (!texto) return null;
              return (
                <p key={campoId} className="text-xs text-muted-foreground">
                  {`${campo?.label ?? campoId}: ${texto}`}
                </p>
              );
            },
          )}
          {Object.keys(resumen?.respuestas_globales ?? reserva.respuestas_globales).length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay respuestas generales.</p>
          ) : null}
        </div>
      </section>

      {/* Desglose de precios */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-base font-bold text-foreground">Detalle del precio</h2>

        {cargando && !resumen ? (
          <p className="mt-3 text-sm text-muted-foreground">Calculando el precio…</p>
        ) : null}

        {resumen && resumen.lineas.length > 0 ? (
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {resumen.lineas.map((linea, indice) => (
              <li key={`${linea.concepto}-${indice}`} className="flex items-start justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{linea.concepto}</span>
                  {linea.detalle ? (
                    <span className="block text-xs text-muted-foreground">{linea.detalle}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                  {formatUsd(linea.total_usd)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {resumen && Number.parseFloat(resumen.descuento_usd) > 0 ? (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <BadgePercent className="h-4 w-4 text-success" aria-hidden="true" />
              {promocion ? `Descuento ${promocion.codigo}` : "Descuento"}
            </span>
            <span className="text-sm font-bold tabular-nums text-success">
              {`-${formatUsd(resumen.descuento_usd)}`}
            </span>
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="text-base font-extrabold text-foreground">Total</span>
          <span className="text-right">
            <span className="block text-lg font-extrabold tabular-nums text-foreground">
              {formatUsd(total)}
            </span>
            {totalBs ? (
              <span className="block text-xs text-muted-foreground">
                {`${formatBs(totalBs)}${tasa ? ` · tasa ${tasa}` : ""}`}
              </span>
            ) : null}
          </span>
        </div>

        {totalBs ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Tasa de hoy; el monto exacto en Bs se fija al reportar tu pago.
          </p>
        ) : null}
      </section>

      {/* Código promocional */}
      <section className="rounded-2xl border border-border bg-card p-4">
        {promocion ? (
          <div className="flex flex-wrap items-center gap-3">
            <BadgeEstado etiqueta={`Código ${promocion.codigo}`} tono="exito" />
            <button
              type="button"
              onClick={() => void quitarCodigo()}
              disabled={aplicandoPromo || soloLectura}
              className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              Quitar código
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setCodigoAbierto((abierto) => !abierto)}
              aria-expanded={codigoAbierto}
              className="flex min-h-11 w-full items-center gap-2 text-left text-sm font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Tag className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1">¿Tienes un código?</span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${codigoAbierto ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>

            {codigoAbierto ? (
              <div className="mt-3 flex flex-col gap-2">
                <label htmlFor="codigo-promocional" className="text-sm font-semibold text-foreground">
                  Código promocional
                </label>
                <Input
                  id="codigo-promocional"
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="h-11 text-base uppercase"
                  value={codigo}
                  onChange={(evento) => setCodigo(evento.target.value)}
                />
                <button
                  type="button"
                  onClick={() => void aplicarCodigo()}
                  disabled={aplicandoPromo}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-input bg-card px-4 text-sm font-bold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {aplicandoPromo ? "Aplicando…" : "Aplicar código"}
                </button>
              </div>
            ) : null}
          </>
        )}

        {mensajePromo ? (
          <p
            className={`mt-2 text-xs font-medium ${promoError ? "text-destructive" : "text-success"}`}
          >
            {mensajePromo}
          </p>
        ) : null}
      </section>

      {/* Política de cancelación */}
      {reserva.politica_cancelacion && reserva.politica_cancelacion.tramos.length > 0 ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-base font-bold text-foreground">Política de cancelación</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {reserva.politica_cancelacion.tramos.map((tramo) => (
              <li key={tramo.dias_desde_salida} className="text-sm">
                <span className="font-semibold text-foreground">
                  {tramo.dias_desde_salida === 0
                    ? "Con menos de 24 h"
                    : `Hasta ${tramo.dias_desde_salida} días antes`}
                </span>
                <span className="block text-muted-foreground">
                  {`${tramo.descripcion} · ${tramo.porcentaje_reembolso} % de reembolso`}
                </span>
              </li>
            ))}
          </ul>

          {ejemploReembolso ? (
            <p className="mt-3 rounded-xl bg-secondary px-3 py-2 text-xs text-secondary-foreground">
              {`Ejemplo: si cancelas hoy (faltan ${ejemploReembolso.dias} días), te devolvemos ${ejemploReembolso.porcentaje}% del total, unos ${formatUsd(String(ejemploReembolso.monto))}.`}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Aceptación y confirmación */}
      {soloLectura ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Tu reserva está confirmada. Si necesitas cambiar algo, escríbenos y lo ajustamos.
          </p>
          {onReabrirEdicion ? (
            <button
              type="button"
              onClick={onReabrirEdicion}
              className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input bg-card px-4 text-sm font-bold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              <span>Editar mis datos</span>
            </button>
          ) : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-4">
          <Checkbox
            id="acepta-politica"
            checked={aceptaPolitica}
            onCheckedChange={(estado) => setAceptaPolitica(estado === true)}
            className="aspect-auto h-auto min-h-11 w-full grid-cols-[auto_1fr] items-center gap-3 rounded-xl border border-input px-3 py-3 text-left text-sm font-medium text-foreground data-[state=checked]:border-primary data-[state=checked]:bg-primary/5"
          >
            <span className="flex-1">Acepto la política de cancelación</span>
          </Checkbox>

          <button
            type="button"
            onClick={() => void confirmar(total)}
            disabled={confirmando}
            aria-busy={confirmando || undefined}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            {confirmando ? "Confirmando…" : "Confirmar y continuar"}
          </button>

          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Al confirmar reservamos tu cupo por 24 horas. Todavía no pagas nada.
            </span>
          </p>
        </section>
      )}

      <DialogoConfirmacion
        abierto={Boolean(dialogoPrecio)}
        onAbiertoChange={(abierto) => {
          if (!abierto) setDialogoPrecio(null);
        }}
        titulo="El precio cambió"
        descripcion={
          dialogoPrecio ? (
            <p>
              {`El total ahora es ${formatUsd(dialogoPrecio.total)}. ¿Continuar con este precio?`}
            </p>
          ) : undefined
        }
        etiquetaConfirmar="Continuar con el nuevo precio"
        onConfirmar={() => {
          const nuevoTotal = dialogoPrecio?.total;
          setDialogoPrecio(null);
          if (nuevoTotal) void confirmar(nuevoTotal);
        }}
      />

      <BotonWhatsApp
        telefono={telefonoWhatsapp}
        mensaje={`Hola, tengo una duda sobre mi reserva ${reserva.ref_corta}.`}
        etiqueta="¿Tienes dudas? Escríbenos"
        variante="contorno"
      />

      {reserva.fecha?.fecha_salida ? (
        <p className="text-center text-xs text-muted-foreground">
          {`Salida: ${formatDate(reserva.fecha.fecha_salida)}`}
        </p>
      ) : null}
    </div>
  );
}

/** Etiqueta legible de una respuesta del formulario. */
function valorLegible(campo: CampoDef | undefined, valor: Respuesta): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  if (typeof valor === "number") return String(valor);
  if (Array.isArray(valor)) {
    return valor.map((v) => (typeof v === "string" ? etiquetaOpcion(campo, v) : String(v))).join(", ");
  }
  return etiquetaOpcion(campo, valor);
}

function etiquetaOpcion(campo: CampoDef | undefined, valor: string): string {
  const opcion = campo?.opciones?.find((o) => o.valor === valor);
  return opcion ? opcion.label : valor;
}

/** Documento enmascarado: nunca se muestra en claro (SEG-05). */
function maskDoc(tipo: string, documento: string): string {
  const limpio = documento.replace(/\s+/g, "");
  if (limpio.length <= 4) return `${tipo}-****`;
  return `${tipo}-****${limpio.slice(-4)}`;
}
