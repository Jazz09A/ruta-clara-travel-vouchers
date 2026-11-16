import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, CircleCheck, Info, Plus, Trash2 } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Categoria, FotoDocumento, Pasajero, TipoDocumento } from "@/lib/domain/types";
import { calcularCategorias } from "@/lib/domain/pricing";
import { MAX_FOTO_DOCUMENTO_MB, prepararFotoDocumento } from "@/lib/imagen";
import { cn } from "@/lib/utils";

import { BirthDateInput, Campo, DialogoConfirmacion, UploadArchivo } from "../ui";
import type { CategoriaConEdad } from "./Bienvenida";
import type { ContextoReserva } from "../use-reserva";

export interface AcompanantesProps {
  reserva: ContextoReserva;
  /** Fecha de salida (`YYYY-MM-DD`): define la categoría por edad. */
  fechaSalida: string | undefined;
  /** Rangos de edad y precio por categoría (del resumen del servidor). */
  categorias: CategoriaConEdad[];
  /** Máximo de pasajeros por reserva (`max_pasajeros_reserva`). */
  maxPasajeros: number;
  /** Qué documento exigen a los menores. */
  documentoMenores: "opcional" | "obligatorio" | "del_representante";
  /** Si el tour exige autorización de viaje para menores. */
  requiereAutorizacionMenores: boolean;
  /** Autoguardado: envía el reemplazo completo de pasajeros. */
  onGuardar: (pasajeros: Pasajero[]) => void | Promise<void>;
  onContinuar: () => void;
  registrarContinuar?: ((accion: () => void) => void) | undefined;
  erroresServidor?: Record<string, string> | undefined;
  errorServidor?: string | undefined;
}

const TIPOS_DOCUMENTO: { valor: TipoDocumento; etiqueta: string }[] = [
  { valor: "V", etiqueta: "Cédula (V)" },
  { valor: "E", etiqueta: "Cédula extranjera (E)" },
  { valor: "P", etiqueta: "Pasaporte (P)" },
  { valor: "OTRO", etiqueta: "Otro" },
];

interface ErroresPasajero {
  nombre?: string | undefined;
  documento?: string | undefined;
  fecha_nacimiento?: string | undefined;
  documento_imagen?: string | undefined;
}
function nuevoRef(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pas-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

/**
 * P-03 — Acompañantes.
 *
 * El titular es el pasajero 1 y aquí no se edita. La categoría de cada
 * pasajero se **calcula** con su edad a la fecha de salida: el cliente no
 * puede elegirla (Spec §5, P-03).
 */
export function Acompanantes({
  reserva,
  fechaSalida,
  categorias,
  maxPasajeros,
  documentoMenores,
  requiereAutorizacionMenores,
  onGuardar,
  onContinuar,
  registrarContinuar,
  erroresServidor,
  errorServidor,
}: AcompanantesProps) {
  const [pasajeros, setPasajeros] = useState<Pasajero[]>(() =>
    reserva.pasajeros.length > 0 ? reserva.pasajeros : [],
  );
  const [expandido, setExpandido] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, ErroresPasajero>>({});
  const [avisos, setAvisos] = useState<Record<string, string | undefined>>({});
  const [anuncio, setAnuncio] = useState("");
  const [errorDeclaracion, setErrorDeclaracion] = useState(false);
  const [declaraRepresentante, setDeclaraRepresentante] = useState(false);
  const [aEliminar, setAEliminar] = useState<Pasajero | null>(null);
  const [autorizaciones, setAutorizaciones] = useState<Record<string, string>>({});
  const anuncioRef = useRef<HTMLParagraphElement | null>(null);
  const inicializadoRef = useRef(false);

  // Fotos del documento de identidad aún no confirmadas por el servidor: se
  // envían en cada guardado (el servidor las guarda de forma idempotente)
  // hasta que responde con el id del archivo.
  const [fotos, setFotos] = useState<Record<string, FotoDocumento>>({});
  const [fotoPreview, setFotoPreview] = useState<Record<string, string>>({});
  const [fotoCargando, setFotoCargando] = useState<string | null>(null);
  const idAlElegirRef = useRef<Record<string, string | null>>({});

  const titular = pasajeros[0];
  const grupo = pasajeros.slice(1);

  const hayMenores = useMemo(
    () => pasajeros.some((pasajero) => categoriaDe(pasajero, categorias, fechaSalida) === "Niño"),
    [pasajeros, categorias, fechaSalida],
  );

  const completo = useMemo(
    () =>
      pasajeros.map((pasajero) =>
        estaCompleto(
          pasajero,
          categorias,
          fechaSalida,
          documentoMenores,
          Boolean(pasajero.documento_imagen_id) || Boolean(fotos[pasajero.ref_cliente]),
        ),
      ),
    [pasajeros, categorias, fechaSalida, documentoMenores, fotos],
  );

  // Refleja en la lista local las fotos que el servidor ya confirmó (para
  // que la validación y la insignia «Completo» las vean) y deja de
  // reenviarlas en los guardados siguientes.
  useEffect(() => {
    let cambioLista = false;
    const siguientes = pasajeros.map((pasajero) => {
      const idServidor =
        reserva.pasajeros.find((p) => p.ref_cliente === pasajero.ref_cliente)
          ?.documento_imagen_id ?? null;
      if (idServidor && idServidor !== (pasajero.documento_imagen_id ?? null)) {
        cambioLista = true;
        return { ...pasajero, documento_imagen_id: idServidor };
      }
      return pasajero;
    });
    if (cambioLista) setPasajeros(siguientes);

    setFotos((previos) => {
      const claves = Object.keys(previos);
      if (claves.length === 0) return previos;
      let cambio = false;
      const pendientes = { ...previos };
      for (const ref of claves) {
        const idServidor =
          reserva.pasajeros.find((p) => p.ref_cliente === ref)?.documento_imagen_id ?? null;
        if (idServidor && idServidor !== idAlElegirRef.current[ref]) {
          delete pendientes[ref];
          cambio = true;
        }
      }
      return cambio ? pendientes : previos;
    });
  }, [pasajeros, reserva.pasajeros]);

  // Se abre el primer pasajero incompleto (Spec §5, P-03).
  useEffect(() => {
    if (inicializadoRef.current) return;
    inicializadoRef.current = true;
    const indice = completo.findIndex((valor) => !valor);
    const objetivo = indice >= 0 ? pasajeros[indice] : undefined;
    if (objetivo) setExpandido(objetivo.ref_cliente);
  }, [completo, pasajeros]);

  /** Incluye las fotos pendientes de cada pasajero en el payload. */
  const conFotos = (lista: Pasajero[]): Pasajero[] =>
    lista.map((pasajero) => {
      const foto = fotos[pasajero.ref_cliente];
      return foto ? { ...pasajero, documento_imagen: foto } : pasajero;
    });

  const guardar = (lista: Pasajero[]) => {
    onGuardar(conFotos(lista));
  };

  /** Guarda de inmediato con la foto recién elegida (fuera del estado). */
  const guardarConFoto = (ref: string, foto: FotoDocumento) => {
    const lista = pasajeros.map((pasajero) => {
      const pendiente = pasajero.ref_cliente === ref ? foto : fotos[pasajero.ref_cliente];
      return pendiente ? { ...pasajero, documento_imagen: pendiente } : pasajero;
    });
    onGuardar(lista);
  };

  const elegirFoto = async (ref: string, archivo: File) => {
    setFotoCargando(ref);
    try {
      const foto = await prepararFotoDocumento(archivo);
      idAlElegirRef.current = {
        ...idAlElegirRef.current,
        [ref]: reserva.pasajeros.find((p) => p.ref_cliente === ref)?.documento_imagen_id ?? null,
      };
      setFotoPreview((previos) => ({ ...previos, [ref]: foto.data }));
      setFotos((previos) => ({ ...previos, [ref]: foto }));
      setErrores((previos) => ({
        ...previos,
        [ref]: { ...previos[ref], documento_imagen: undefined },
      }));
      guardarConFoto(ref, foto);
    } catch {
      setErrores((previos) => ({
        ...previos,
        [ref]: {
          ...previos[ref],
          documento_imagen: "No pudimos leer la foto. Tómala de nuevo",
        },
      }));
    } finally {
      setFotoCargando(null);
    }
  };

  /** Aplica un cambio y guarda el reemplazo completo de pasajeros. */
  const aplicar = (lista: Pasajero[]) => {
    setPasajeros(lista);
    guardar(lista);
  };

  const actualizarPasajero = (ref: string, cambios: Partial<Pasajero>) => {
    const siguiente = pasajeros.map((pasajero) => {
      if (pasajero.ref_cliente !== ref) return pasajero;
      return { ...pasajero, ...cambios } as Pasajero;
    });
    aplicar(siguiente);
  };

  const agregarPasajero = () => {
    if (pasajeros.length >= maxPasajeros) return;
    const nuevo: Pasajero = {
      ref_cliente: nuevoRef(),
      es_titular: false,
      nombre: "",
      tipo_doc: "V",
      documento: "",
      fecha_nacimiento: "",
      categoria: "Adulto",
      respuestas: {},
    };
    aplicar([...pasajeros, nuevo]);
    setExpandido(nuevo.ref_cliente);
  };

  const eliminarPasajero = (pasajero: Pasajero) => {
    aplicar(pasajeros.filter((p) => p.ref_cliente !== pasajero.ref_cliente));
    setAEliminar(null);
  };

  const validarPasajero = (pasajero: Pasajero): ErroresPasajero => {
    const resultado: ErroresPasajero = {};
    const categoria = categoriaDe(pasajero, categorias, fechaSalida);

    if (!pasajero.nombre.trim()) {
      resultado.nombre = "Escribe el nombre y apellido";
    }

    if (!pasajero.fecha_nacimiento) {
      resultado.fecha_nacimiento = "Elige la fecha de nacimiento";
    }

    const documentoExigido =
      categoria === "Niño" ? documentoMenores === "obligatorio" : categoria !== null;

    if (documentoExigido && !pasajero.documento.trim()) {
      resultado.documento =
        categoria === "Niño" ? "Escribe el documento del menor" : "Escribe el número de documento";
    }

    if (pasajero.documento.trim()) {
      const repetido = pasajeros.some(
        (otro) =>
          otro.ref_cliente !== pasajero.ref_cliente &&
          otro.documento.trim() !== "" &&
          otro.documento.trim().toLowerCase() === pasajero.documento.trim().toLowerCase(),
      );
      if (repetido) resultado.documento = "Este documento ya está en la reserva";
    }

    // Política: cada pasajero viaja con la foto de su documento de identidad.
    if (!pasajero.documento_imagen_id && !fotos[pasajero.ref_cliente]) {
      resultado.documento_imagen = "Sube la foto del documento de identidad";
    }

    return resultado;
  };

  /**
   * Nombres repetidos sin documento: aviso, no bloqueo (Spec §5, P-03).
   */
  const avisoPasajero = (pasajero: Pasajero): string | undefined => {
    if (!pasajero.nombre.trim()) return undefined;
    const repetido = pasajeros.some(
      (otro) =>
        otro.ref_cliente !== pasajero.ref_cliente &&
        otro.nombre.trim().toLowerCase() === pasajero.nombre.trim().toLowerCase() &&
        !otro.documento.trim() &&
        !pasajero.documento.trim(),
    );
    return repetido
      ? "Hay otro pasajero con el mismo nombre. Revisa que no sea la misma persona"
      : undefined;
  };

  const marcarTocado = (pasajero: Pasajero) => {
    setErrores((previos) => ({
      ...previos,
      [pasajero.ref_cliente]: validarPasajero(pasajero),
    }));
    setAvisos((previos) => ({
      ...previos,
      [pasajero.ref_cliente]: avisoPasajero(pasajero),
    }));
  };

  const continuar = async () => {
    const nuevosErrores: Record<string, ErroresPasajero> = {};
    let total = 0;
    let primerError: string | undefined;
    let primerCampo: keyof ErroresPasajero = "nombre";

    for (const pasajero of pasajeros) {
      const resultado = validarPasajero(pasajero);
      if (
        resultado.nombre ||
        resultado.documento ||
        resultado.fecha_nacimiento ||
        resultado.documento_imagen
      ) {
        nuevosErrores[pasajero.ref_cliente] = resultado;
        total += 1;
        if (!primerError) {
          primerError = pasajero.ref_cliente;
          primerCampo = resultado.nombre
            ? "nombre"
            : resultado.documento
              ? "documento"
              : resultado.fecha_nacimiento
                ? "fecha_nacimiento"
                : "documento_imagen";
          // El pasajero con error se expande para que se vea el problema (UX-16).
          setExpandido(pasajero.ref_cliente);
        }
      }
    }

    if (hayMenores && !declaraRepresentante) {
      total += 1;
      setErrorDeclaracion(true);
    } else {
      setErrorDeclaracion(false);
    }

    setErrores(nuevosErrores);

    if (total > 0) {
      setAnuncio(
        `Hay ${total} ${total === 1 ? "dato" : "datos"} por corregir${
          hayMenores && !declaraRepresentante ? ", y falta la declaración de los menores" : ""
        }`,
      );
      window.requestAnimationFrame(() => {
        if (primerError) {
          const idControl =
            primerCampo === "documento_imagen"
              ? `pasajero-${primerError}-foto`
              : `pasajero-${primerError}-nombre`;
          document.getElementById(idControl)?.focus();
        } else {
          document.getElementById("declara-representante")?.focus();
        }
      });
      return;
    }

    setAnuncio("");
    // Se espera el guardado (incluidas las fotos) antes de completar el paso:
    // si no, el servidor rechazaría el paso por falta de las fotos.
    await Promise.resolve(guardar(pasajeros));
    onContinuar();
  };

  useEffect(() => {
    registrarContinuar?.(continuar);
  });

  const alMaximo = pasajeros.length >= maxPasajeros;

  return (
    <div className="flex flex-col gap-4">
      <p ref={anuncioRef} aria-live="assertive" className="sr-only">
        {anuncio}
      </p>

      {errorServidor ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {errorServidor}
        </p>
      ) : null}

      {/* Contador de pasajeros */}
      <p className="text-sm font-semibold text-foreground">
        {`${pasajeros.length} de ${maxPasajeros} pasajeros`}
      </p>

      {/* Tarjetas de pasajeros */}
      <div className="flex flex-col gap-3">
        {pasajeros.map((pasajero, indice) => {
          const esTitular = pasajero.es_titular;
          const abierto = expandido === pasajero.ref_cliente;
          const erroresPasajero = errores[pasajero.ref_cliente];
          const categoria = categoriaDe(pasajero, categorias, fechaSalida);
          const esMenor = categoria === "Niño";

          return (
            <article
              key={pasajero.ref_cliente}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <button
                type="button"
                onClick={() => setExpandido(abierto ? null : pasajero.ref_cliente)}
                aria-expanded={abierto}
                aria-controls={`pasajero-cuerpo-${pasajero.ref_cliente}`}
                className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-foreground">
                    {esTitular
                      ? `${pasajero.nombre || "Titular"} (tú)`
                      : pasajero.nombre || `Pasajero ${indice + 1}`}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    {categoria === "Infante" ? (
                      <span className="font-semibold text-success">Sin costo</span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      {completo[indice] ? (
                        <>
                          <CircleCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                          <span className="text-success">Completo</span>
                        </>
                      ) : (
                        "Faltan datos"
                      )}
                    </span>
                  </span>
                </span>
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
                  id={`pasajero-cuerpo-${pasajero.ref_cliente}`}
                  className="flex flex-col gap-4 border-t border-border px-4 py-4"
                >
                  {esTitular ? (
                    <p className="rounded-xl bg-secondary px-3 py-2 text-sm text-secondary-foreground">
                      Estos son tus datos de titular. Si necesitas cambiarlos, vuelve al paso
                      anterior.
                    </p>
                  ) : null}

                  <Campo
                    id={`pasajero-${pasajero.ref_cliente}-nombre`}
                    etiqueta="Nombre y apellido"
                    error={erroresPasajero?.nombre}
                    aviso={avisos[pasajero.ref_cliente]}
                    requerido={!esTitular}
                  >
                    {(aria) => (
                      <Input
                        {...aria}
                        type="text"
                        autoComplete="name"
                        className="h-11 text-base"
                        value={pasajero.nombre}
                        disabled={esTitular}
                        onChange={(evento) =>
                          actualizarPasajero(pasajero.ref_cliente, { nombre: evento.target.value })
                        }
                        onBlur={() => marcarTocado(pasajero)}
                      />
                    )}
                  </Campo>

                  <Campo
                    id={`pasajero-${pasajero.ref_cliente}-fecha-anio`}
                    etiqueta="Fecha de nacimiento"
                    error={erroresPasajero?.fecha_nacimiento}
                    requerido={!esTitular}
                  >
                    {() => (
                      <BirthDateInput
                        id={`pasajero-${pasajero.ref_cliente}-fecha`}
                        valor={pasajero.fecha_nacimiento}
                        disabled={esTitular}
                        requerido={!esTitular}
                        onChange={(valor) =>
                          actualizarPasajero(pasajero.ref_cliente, { fecha_nacimiento: valor })
                        }
                        onBlur={() => marcarTocado(pasajero)}
                      />
                    )}
                  </Campo>

                  {/* Menores de 5 años: gratis y viajan en piernas de su
                      representante (no se muestran categorías). */}
                  {categoria === "Infante" ? (
                    <p className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm font-semibold text-foreground">
                      <Info className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      <span>Sin costo · viaja en piernas de su representante</span>
                    </p>
                  ) : null}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Campo
                      id={`pasajero-${pasajero.ref_cliente}-tipo-doc`}
                      etiqueta="Tipo de documento"
                    >
                      {(aria) => (
                        <Select
                          value={pasajero.tipo_doc}
                          disabled={esTitular}
                          onValueChange={(valor: string) => {
                            const tipo =
                              TIPOS_DOCUMENTO.find((t) => t.valor === valor)?.valor ?? "V";
                            actualizarPasajero(pasajero.ref_cliente, {
                              tipo_doc: tipo,
                              documento: "",
                            });
                          }}
                        >
                          <SelectTrigger
                            id={aria.id}
                            aria-describedby={aria["aria-describedby"]}
                            className="h-11"
                          >
                            <SelectValue placeholder="Elige el tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIPOS_DOCUMENTO.map((tipo) => (
                              <SelectItem key={tipo.valor} value={tipo.valor}>
                                {tipo.etiqueta}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </Campo>

                    <Campo
                      id={`pasajero-${pasajero.ref_cliente}-documento`}
                      etiqueta="Número de documento"
                      ayuda={
                        esMenor && documentoMenores === "opcional"
                          ? "Para los menores el documento es opcional."
                          : undefined
                      }
                      error={erroresPasajero?.documento}
                      requerido={!esTitular && categoria !== "Niño"}
                    >
                      {(aria) => (
                        <Input
                          {...aria}
                          type="text"
                          inputMode={
                            pasajero.tipo_doc === "V" || pasajero.tipo_doc === "E"
                              ? "numeric"
                              : "text"
                          }
                          autoComplete="off"
                          className="h-11 text-base"
                          value={pasajero.documento}
                          disabled={esTitular}
                          onChange={(evento) =>
                            actualizarPasajero(pasajero.ref_cliente, {
                              documento:
                                pasajero.tipo_doc === "V" || pasajero.tipo_doc === "E"
                                  ? evento.target.value.replace(/\D/g, "").slice(0, 10)
                                  : evento.target.value.slice(0, 20),
                            })
                          }
                          onBlur={() => marcarTocado(pasajero)}
                        />
                      )}
                    </Campo>
                  </div>

                  {/* Foto del documento de identidad (política de la agencia) */}
                  <div className="flex flex-col gap-1.5">
                    <UploadArchivo
                      id={`pasajero-${pasajero.ref_cliente}-foto`}
                      etiqueta="Foto del documento de identidad"
                      ayuda="Toma una foto legible de la cédula o el pasaporte (o adjunta un PDF). Es obligatoria para todos los pasajeros."
                      acepta="image/jpeg,image/png,image/webp,application/pdf"
                      maxMB={MAX_FOTO_DOCUMENTO_MB}
                      captura="environment"
                      cargando={fotoCargando === pasajero.ref_cliente}
                      nombreArchivo={
                        fotos[pasajero.ref_cliente]?.nombre ??
                        (pasajero.documento_imagen_id ? "Foto del documento" : undefined)
                      }
                      previewUrl={fotoPreview[pasajero.ref_cliente]}
                      error={erroresPasajero?.documento_imagen}
                      onSeleccionar={(archivo) => void elegirFoto(pasajero.ref_cliente, archivo)}
                    />
                    {fotos[pasajero.ref_cliente] ? (
                      <p className="text-xs text-muted-foreground">Enviando la foto…</p>
                    ) : pasajero.documento_imagen_id ? (
                      <p className="text-xs font-medium text-success">Foto del documento lista ✓</p>
                    ) : null}
                  </div>

                  {esMenor && requiereAutorizacionMenores ? (
                    <div className="rounded-xl border border-border bg-muted px-3 py-3">
                      <p className="text-sm font-semibold text-foreground">
                        Autorización de viaje del menor
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {autorizaciones[pasajero.ref_cliente]
                          ? `Documento recibido: ${autorizaciones[pasajero.ref_cliente]}. Lo revisaremos antes de la salida.`
                          : "Adjunta la autorización firmada por el representante legal."}
                      </p>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        className="sr-only"
                        id={`autorizacion-${pasajero.ref_cliente}`}
                        onChange={(evento) => {
                          const archivo = evento.target.files?.[0];
                          evento.target.value = "";
                          if (!archivo) return;
                          setAutorizaciones((previos) => ({
                            ...previos,
                            [pasajero.ref_cliente]: archivo.name,
                          }));
                        }}
                      />
                      <label
                        htmlFor={`autorizacion-${pasajero.ref_cliente}`}
                        className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-input bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {autorizaciones[pasajero.ref_cliente]
                          ? "Cambiar archivo"
                          : "Adjuntar autorización"}
                      </label>
                    </div>
                  ) : null}

                  {!esTitular ? (
                    <button
                      type="button"
                      onClick={() => setAEliminar(pasajero)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-destructive/40 px-4 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      <span>Eliminar pasajero</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {/* Agregar pasajero */}
      {alMaximo ? (
        <p className="flex items-start gap-2 rounded-xl border border-chart-2/40 bg-chart-2/10 px-3 py-3 text-sm text-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {`Llegaste al máximo de ${maxPasajeros} pasajeros. Para grupos mayores, contáctanos por WhatsApp.`}
          </span>
        </p>
      ) : null}

      <button
        type="button"
        onClick={agregarPasajero}
        disabled={alMaximo}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-card px-4 text-sm font-bold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        <span>Agregar pasajero</span>
      </button>

      {/* Declaración de representante legal */}
      {hayMenores ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <Checkbox
            id="declara-representante"
            checked={declaraRepresentante}
            onCheckedChange={(estado) => setDeclaraRepresentante(estado === true)}
            className="aspect-auto h-auto min-h-11 w-full grid-cols-[auto_1fr] items-center gap-3 rounded-xl border border-input px-3 py-3 text-left text-sm font-medium text-foreground data-[state=checked]:border-primary data-[state=checked]:bg-primary/5"
          >
            <span className="flex-1">Declaro ser el representante legal de los menores</span>
          </Checkbox>
          {errorDeclaracion ? (
            <p className="mt-1 text-xs font-medium text-destructive">
              Debes aceptar esta declaración para continuar.
            </p>
          ) : null}
        </section>
      ) : null}

      <DialogoConfirmacion
        abierto={Boolean(aEliminar)}
        onAbiertoChange={(abierto) => {
          if (!abierto) setAEliminar(null);
        }}
        titulo="Eliminar pasajero"
        descripcion={
          aEliminar
            ? `Se borrarán los datos de ${aEliminar.nombre || "este pasajero"}. Esto no se puede deshacer.`
            : undefined
        }
        etiquetaConfirmar="Eliminar pasajero"
        onConfirmar={() => {
          if (aEliminar) eliminarPasajero(aEliminar);
        }}
        destructivo
      />
    </div>
  );
}

/** Categoría calculada por la edad a la fecha de salida. */
function categoriaDe(
  pasajero: Pasajero,
  categorias: CategoriaConEdad[],
  fechaSalida: string | undefined,
): Categoria | null {
  if (!pasajero.fecha_nacimiento || !fechaSalida) return null;
  return calcularCategorias(categorias, fechaSalida, pasajero.fecha_nacimiento);
}

/** ¿Están todos los datos del pasajero? */
function estaCompleto(
  pasajero: Pasajero,
  categorias: CategoriaConEdad[],
  fechaSalida: string | undefined,
  documentoMenores: "opcional" | "obligatorio" | "del_representante",
  tieneFotoDocumento: boolean,
): boolean {
  if (!pasajero.nombre.trim()) return false;
  if (!pasajero.fecha_nacimiento) return false;
  const categoria = categoriaDe(pasajero, categorias, fechaSalida);
  const documentoExigido =
    categoria === "Niño" ? documentoMenores === "obligatorio" : categoria !== null;
  if (documentoExigido && !pasajero.documento.trim()) return false;
  if (!tieneFotoDocumento) return false;
  return true;
}

function maxPasajosEnTexto(max: number): string {
  return max === 1 ? "1" : String(max);
}
