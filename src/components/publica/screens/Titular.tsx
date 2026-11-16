import { useEffect, useMemo, useRef, useState } from "react";
import { CircleCheck, Pencil } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import type { DatosTitular } from "@/lib/domain/api";
import type { FotoDocumento, TipoDocumento } from "@/lib/domain/types";
import {
  edadEn,
  formatFechaNacimiento,
  isValidEmail,
  isValidPhone,
  suggestEmail,
} from "@/lib/format";
import { MAX_FOTO_DOCUMENTO_MB, prepararFotoDocumento } from "@/lib/imagen";

import { BirthDateInput, Campo, PhoneInput, UploadArchivo } from "../ui";
import type { ContextoReserva } from "../use-reserva";

export interface TitularProps {
  reserva: ContextoReserva;
  /** Token del enlace (para el autocompletado por documento). */
  token: string;
  /** Fecha de salida (`YYYY-MM-DD`): define la edad y la categoría. */
  fechaSalida: string | undefined;
  /** Autoguardado del borrador (se llama al salir de un campo). */
  onGuardar: (datos: DatosTitular) => void | Promise<void>;
  /** Continúa al paso siguiente. */
  onContinuar: () => void;
  /**
   * Permite que la barra de acción del shell dispare el «Continuar» de esta
   * pantalla (el shell no conoce la validación).
   */
  registrarContinuar?: ((accion: () => void) => void) | undefined;
  /** Errores del servidor mapeados por campo (UX-16). */
  erroresServidor?: Record<string, string> | undefined;
  /** Mensaje de error del servidor (red o negocio). */
  errorServidor?: string | undefined;
  guardando?: boolean | undefined;
}

interface EstadoFormulario {
  nombre: string;
  tipo_doc: TipoDocumento;
  documento: string;
  fecha_nacimiento: string;
  telefono: string;
  correo: string;
  contacto_emergencia_nombre: string;
  contacto_emergencia_telefono: string;
}

const TIPOS_DOCUMENTO: { valor: TipoDocumento; etiqueta: string }[] = [
  { valor: "V", etiqueta: "Cédula (V)" },
  { valor: "E", etiqueta: "Cédula extranjera (E)" },
  { valor: "P", etiqueta: "Pasaporte (P)" },
  { valor: "OTRO", etiqueta: "Otro" },
];

const ESTADO_VACIO: EstadoFormulario = {
  nombre: "",
  tipo_doc: "V",
  documento: "",
  fecha_nacimiento: "",
  telefono: "",
  correo: "",
  contacto_emergencia_nombre: "",
  contacto_emergencia_telefono: "",
};

/** Id del control real de cada campo (para enfocar el primer error). */
const ID_CONTROL: Record<keyof EstadoFormulario, string> = {
  nombre: "titular-nombre",
  tipo_doc: "titular-tipo-doc",
  documento: "titular-documento",
  fecha_nacimiento: "titular-fecha-nacimiento-anio",
  telefono: "titular-telefono-numero",
  correo: "titular-correo",
  contacto_emergencia_nombre: "titular-emergencia-nombre",
  contacto_emergencia_telefono: "titular-emergencia-telefono-numero",
};

type Errores = Partial<Record<keyof EstadoFormulario | "documento_imagen", string>>;

/** Un valor enmascarado nunca se reenvía (UX-20). */
function estaEnmascarado(valor: string): boolean {
  return valor.includes("*");
}

/**
 * P-02 — Datos del titular.
 *
 * Es la única pantalla donde se piden los datos de contacto: el resto del
 * grupo no los necesita (Spec §5, P-02).
 */
export function Titular({
  reserva,
  token,
  fechaSalida,
  onGuardar,
  onContinuar,
  registrarContinuar,
  erroresServidor,
  errorServidor,
  guardando,
}: TitularProps) {
  const titularInicial = reserva.pasajeros[0];
  const [formulario, setFormulario] = useState<EstadoFormulario>(() => ({
    ...ESTADO_VACIO,
    nombre: titularInicial?.nombre ?? "",
    tipo_doc: titularInicial?.tipo_doc ?? "V",
    documento: titularInicial?.documento ?? "",
    fecha_nacimiento: titularInicial?.fecha_nacimiento ?? "",
  }));

  // El servidor devuelve los valores sensibles enmascarados: se muestran en
  // sólo lectura hasta que el cliente decide cambiarlos.
  const [documentoEnmascarado, setDocumentoEnmascarado] = useState(
    () => Boolean(titularInicial?.documento) && estaEnmascarado(titularInicial?.documento ?? ""),
  );
  const [fechaEnmascarada, setFechaEnmascarada] = useState(
    () =>
      Boolean(titularInicial?.fecha_nacimiento) &&
      estaEnmascarado(titularInicial?.fecha_nacimiento ?? ""),
  );

  const [errores, setErrores] = useState<Errores>({});
  const [tocados, setTocados] = useState<Partial<Record<keyof EstadoFormulario, boolean>>>({});
  const [anuncio, setAnuncio] = useState("");

  // ── Autocompletado por documento (reservas anteriores) ────────────────
  // Al escribir un documento válido, con un poco de espera, se busca entre
  // los pasajeros de CUALQUIER reserva anterior. Sólo se rellenan campos
  // vacíos: nunca se sobrescribe lo que ya escribió el usuario (ni valores
  // enmascarados) y, si algo se rellena, se avisa para que lo revise.
  const [avisoCompletado, setAvisoCompletado] = useState(false);
  const formRef = useRef(formulario);
  const consultaDocRef = useRef<string | null>(null);

  useEffect(() => {
    formRef.current = formulario;
  }, [formulario]);

  useEffect(() => {
    if (documentoEnmascarado) return;
    const documento = formulario.documento.trim();
    const esValido =
      formulario.tipo_doc === "V" || formulario.tipo_doc === "E"
        ? /^\d{5,10}$/.test(documento)
        : /^[A-Za-z0-9-]{4,20}$/.test(documento);
    if (!esValido) return;
    const clave = `${formulario.tipo_doc}:${documento}`;
    if (consultaDocRef.current === clave) return;
    const timer = window.setTimeout(() => {
      consultaDocRef.current = clave;
      void (async () => {
        try {
          const r = await api.publica.datosPorDocumento(token, {
            tipo_doc: formulario.tipo_doc,
            documento,
          });
          if (!r.encontrado || !r.datos) return;
          const datos = r.datos;
          const actual = formRef.current;
          const siguiente: EstadoFormulario = { ...actual };
          let cambio = false;
          const rellenar = (
            campo: Exclude<keyof EstadoFormulario, "tipo_doc">,
            valor: string | null | undefined,
          ) => {
            if (!actual[campo] && valor) {
              siguiente[campo] = valor;
              cambio = true;
            }
          };
          rellenar("nombre", datos.nombre);
          rellenar("fecha_nacimiento", datos.fecha_nacimiento);
          rellenar("telefono", datos.telefono);
          rellenar("correo", datos.correo);
          rellenar("contacto_emergencia_nombre", datos.contacto_emergencia_nombre);
          rellenar("contacto_emergencia_telefono", datos.contacto_emergencia_telefono);
          if (!cambio) return;
          setFormulario(siguiente);
          // Los campos rellenados dejan de estar en falta.
          setErrores((previos) => {
            const copia = { ...previos };
            (Object.keys(siguiente) as (keyof EstadoFormulario)[]).forEach((campo) => {
              if (siguiente[campo] && siguiente[campo] !== actual[campo]) delete copia[campo];
            });
            return copia;
          });
          setAvisoCompletado(true);
        } catch {
          // El autocompletado es un detalle: si falla, el formulario sigue igual.
        }
      })();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [formulario.documento, formulario.tipo_doc, documentoEnmascarado, token]);

  // Foto del documento de identidad (política de la agencia): mientras
  // `fotoPendiente` exista se envía en cada guardado (el servidor la guarda
  // de forma idempotente) hasta que responda con el id del archivo.
  const [fotoPendiente, setFotoPendiente] = useState<FotoDocumento | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoCargando, setFotoCargando] = useState(false);
  const idAlElegirRef = useRef<string | null>(null);
  const idFotoServidor = titularInicial?.documento_imagen_id ?? null;
  // ¿La foto elegida ya está confirmada por el servidor?
  const fotoSubida =
    idFotoServidor !== null && (fotoPendiente === null || idFotoServidor !== idAlElegirRef.current);

  // El servidor confirmó la foto: deja de reenviarla.
  useEffect(() => {
    if (fotoPendiente && idFotoServidor && idFotoServidor !== idAlElegirRef.current) {
      setFotoPendiente(null);
    }
  }, [fotoPendiente, idFotoServidor]);

  const elegirFoto = async (archivo: File) => {
    setFotoCargando(true);
    try {
      const foto = await prepararFotoDocumento(archivo);
      idAlElegirRef.current = idFotoServidor;
      setFotoPreview(foto.data);
      setFotoPendiente(foto);
      setErrores((previos) => ({ ...previos, documento_imagen: undefined }));
      guardarBorrador(foto);
    } catch {
      setErrores((previos) => ({
        ...previos,
        documento_imagen: "No pudimos leer la foto. Tómala de nuevo",
      }));
    } finally {
      setFotoCargando(false);
    }
  };

  const edad = useMemo(
    () =>
      formulario.fecha_nacimiento && fechaSalida
        ? edadEn(formulario.fecha_nacimiento, fechaSalida)
        : null,
    [formulario.fecha_nacimiento, fechaSalida],
  );

  const sugerenciaCorreo = useMemo(
    () => (formulario.correo ? suggestEmail(formulario.correo) : null),
    [formulario.correo],
  );

  const avisoEmergenciaIgual =
    formulario.contacto_emergencia_telefono.length > 0 &&
    formulario.contacto_emergencia_telefono === formulario.telefono;

  const actualizar = (campo: keyof EstadoFormulario, valor: string) => {
    setFormulario((previo) => {
      const siguiente: EstadoFormulario = { ...previo };
      if (campo === "tipo_doc") {
        siguiente.tipo_doc = valor as TipoDocumento;
      } else {
        siguiente[campo] = valor;
      }
      return siguiente;
    });
    // Una vez que el campo tiene error se revalida al escribir (UX-13).
    if (errores[campo]) {
      setErrores((previos) => ({
        ...previos,
        [campo]: validarCampo(campo, valor, formulario, fechaSalida),
      }));
    }
  };

  /**
   * Datos que se envían: los valores enmascarados no se reenvían (UX-20).
   * La foto viaja sólo mientras el servidor no la confirme (o la elegida
   * recién en esta llamada, para que el envío no dependa del estado).
   */
  const datosParaEnviar = (foto?: FotoDocumento | null): DatosTitular => {
    const base: DatosTitular = {
      nombre: formulario.nombre.trim(),
      tipo_doc: formulario.tipo_doc,
      documento: documentoEnmascarado ? "" : formulario.documento.trim(),
      fecha_nacimiento: fechaEnmascarada ? "" : formulario.fecha_nacimiento,
      telefono: formulario.telefono,
      correo: formulario.correo.trim().toLowerCase(),
      contacto_emergencia_nombre: formulario.contacto_emergencia_nombre.trim(),
      contacto_emergencia_telefono: formulario.contacto_emergencia_telefono,
    };
    const aEnviar = foto !== undefined ? foto : fotoPendiente;
    return aEnviar ? { ...base, documento_imagen: aEnviar } : base;
  };

  const guardarBorrador = (foto?: FotoDocumento | null) => onGuardar(datosParaEnviar(foto));

  const marcarTocado = (campo: keyof EstadoFormulario) => {
    setTocados((previos) => ({ ...previos, [campo]: true }));
    setErrores((previos) => ({
      ...previos,
      [campo]: validarCampo(campo, formulario[campo], formulario, fechaSalida),
    }));
    // Al salir del campo se guarda (UX-45).
    guardarBorrador();
  };

  const continuar = async () => {
    const nuevosErrores: Errores = {};
    for (const campo of Object.keys(ESTADO_VACIO) as (keyof EstadoFormulario)[]) {
      const mensaje = validarCampo(campo, formulario[campo], formulario, fechaSalida);
      if (mensaje) nuevosErrores[campo] = mensaje;
    }

    // Política: cada pasajero viaja con la foto de su documento de identidad.
    if (!fotoSubida && !fotoPendiente) {
      nuevosErrores.documento_imagen = "Sube la foto del documento de identidad";
    }

    setErrores(nuevosErrores);
    setTocados(
      Object.keys(ESTADO_VACIO).reduce(
        (previos, campo) => ({ ...previos, [campo]: true }),
        {} as Partial<Record<keyof EstadoFormulario, boolean>>,
      ),
    );

    const camposConError = (Object.keys(nuevosErrores) as (keyof Errores)[]).filter((campo) =>
      Boolean(nuevosErrores[campo]),
    );

    if (camposConError.length > 0) {
      setAnuncio(
        `Hay ${camposConError.length} ${camposConError.length === 1 ? "campo" : "campos"} por corregir`,
      );
      // El foco y el scroll van al primer campo con error (UX-15).
      const primero = camposConError[0];
      if (primero) {
        window.requestAnimationFrame(() => {
          const idControl =
            primero === "documento_imagen"
              ? "titular-foto-documento"
              : ID_CONTROL[primero as keyof EstadoFormulario];
          const control = document.getElementById(idControl);
          const alterno =
            document.getElementById(`${idControl}-cambiar`) ??
            document.getElementById(`titular-${String(primero)}-cambiar`);
          const elemento = control ?? alterno;
          elemento?.scrollIntoView({ block: "center", behavior: "smooth" });
          elemento?.focus();
        });
      }
      return;
    }

    setAnuncio("");
    // Se espera el guardado (incluida la foto) antes de completar el paso:
    // si no, el servidor rechazaría el paso por falta de la foto.
    await Promise.resolve(guardarBorrador());
    onContinuar();
  };

  // La barra de acción del shell dispara esta misma acción.
  useEffect(() => {
    registrarContinuar?.(continuar);
  });

  const error = (campo: keyof EstadoFormulario): string | undefined =>
    errores[campo] ?? erroresServidor?.[campo];

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

      {avisoCompletado ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm text-foreground"
        >
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <span>Completamos tus datos de una reserva anterior. Revísalos antes de continuar.</span>
        </p>
      ) : null}

      <Campo id="titular-nombre" etiqueta="Nombre y apellido" error={error("nombre")} requerido>
        {(aria) => (
          <Input
            {...aria}
            type="text"
            autoComplete="name"
            className="h-11 text-base"
            value={formulario.nombre}
            onChange={(evento) => actualizar("nombre", evento.target.value)}
            onBlur={() => marcarTocado("nombre")}
          />
        )}
      </Campo>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo id="titular-tipo-doc" etiqueta="Tipo de documento" requerido>
          {(aria) => (
            <Select
              value={formulario.tipo_doc}
              onValueChange={(valor: string) => {
                const tipo = TIPOS_DOCUMENTO.find((t) => t.valor === valor)?.valor ?? "V";
                setFormulario((previo) => ({ ...previo, tipo_doc: tipo, documento: "" }));
                setErrores((previos) => ({ ...previos, documento: undefined }));
              }}
            >
              <SelectTrigger
                id={aria.id}
                aria-required={aria["aria-required"]}
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
          id="titular-documento"
          etiqueta="Número de documento"
          error={error("documento")}
          requerido
        >
          {() =>
            documentoEnmascarado ? (
              <div className="flex items-center gap-2 rounded-xl border border-input bg-muted px-3 py-2">
                <span className="flex-1 font-mono text-base font-semibold text-foreground">
                  {formulario.documento}
                </span>
                <button
                  type="button"
                  id="titular-documento-cambiar"
                  onClick={() => {
                    setDocumentoEnmascarado(false);
                    actualizar("documento", "");
                  }}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  <span>Cambiar</span>
                </button>
              </div>
            ) : (
              <Input
                id="titular-documento"
                type="text"
                inputMode={
                  formulario.tipo_doc === "V" || formulario.tipo_doc === "E" ? "numeric" : "text"
                }
                autoComplete="off"
                aria-invalid={error("documento") ? true : undefined}
                aria-required
                className="h-11 text-base"
                value={formulario.documento}
                onChange={(evento) =>
                  actualizar(
                    "documento",
                    formulario.tipo_doc === "V" || formulario.tipo_doc === "E"
                      ? evento.target.value.replace(/\D/g, "").slice(0, 10)
                      : evento.target.value.slice(0, 20),
                  )
                }
                onBlur={() => marcarTocado("documento")}
              />
            )
          }
        </Campo>
      </div>

      {/* Foto del documento de identidad (política de la agencia) */}
      <div className="flex flex-col gap-1.5">
        <UploadArchivo
          id="titular-foto-documento"
          etiqueta="Foto del documento de identidad"
          ayuda="Toma una foto legible de la cédula o el pasaporte (o adjunta un PDF). Es obligatoria: verifica que los datos sean reales."
          acepta="image/jpeg,image/png,image/webp,application/pdf"
          maxMB={MAX_FOTO_DOCUMENTO_MB}
          captura="environment"
          cargando={fotoCargando}
          nombreArchivo={fotoPendiente?.nombre ?? (fotoSubida ? "Foto del documento" : undefined)}
          previewUrl={fotoPreview ?? undefined}
          error={errores.documento_imagen}
          onSeleccionar={(archivo) => void elegirFoto(archivo)}
        />
        {fotoSubida ? (
          <p className="text-xs font-medium text-success">Foto del documento lista ✓</p>
        ) : fotoPendiente ? (
          <p className="text-xs text-muted-foreground">Enviando la foto…</p>
        ) : null}
      </div>

      <Campo
        id="titular-fecha-nacimiento-anio"
        etiqueta="Fecha de nacimiento"
        ayuda="La usamos para calcular tu tarifa y confirmar que puedes hacer la reserva."
        error={error("fecha_nacimiento")}
        requerido
      >
        {() =>
          fechaEnmascarada ? (
            <div className="flex items-center gap-2 rounded-xl border border-input bg-muted px-3 py-2">
              <span className="flex-1 text-base font-semibold text-foreground">
                {formatFechaNacimiento(formulario.fecha_nacimiento)}
              </span>
              <button
                type="button"
                id="titular-fecha-nacimiento-cambiar"
                onClick={() => {
                  setFechaEnmascarada(false);
                  actualizar("fecha_nacimiento", "");
                }}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                <span>Cambiar</span>
              </button>
            </div>
          ) : (
            <BirthDateInput
              id="titular-fecha-nacimiento"
              valor={formulario.fecha_nacimiento}
              edad={edad}
              requerido
              onChange={(valor) => actualizar("fecha_nacimiento", valor)}
              onBlur={() => marcarTocado("fecha_nacimiento")}
            />
          )
        }
      </Campo>

      <PhoneInput
        id="titular-telefono"
        valor={formulario.telefono}
        etiqueta="Teléfono (WhatsApp)"
        ayuda="Te escribimos por aquí si hay cambios en tu salida."
        error={error("telefono")}
        requerido
        onChange={(valor) => actualizar("telefono", valor)}
        onBlur={() => {
          marcarTocado("telefono");
        }}
      />

      <Campo
        id="titular-correo"
        etiqueta="Correo electrónico"
        ayuda="Aquí te enviamos la confirmación y tu voucher."
        error={error("correo")}
        aviso={sugerenciaCorreo ? `¿Quisiste decir ${sugerenciaCorreo}?` : undefined}
        requerido
      >
        {(aria) => (
          <Input
            {...aria}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            className="h-11 text-base"
            value={formulario.correo}
            onChange={(evento) => actualizar("correo", evento.target.value)}
            onBlur={() => marcarTocado("correo")}
          />
        )}
      </Campo>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-base font-bold text-foreground">Contacto de emergencia</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Alguien de confianza al que podamos llamar si pasa algo durante el viaje.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <Campo
            id="titular-emergencia-nombre"
            etiqueta="Nombre del contacto"
            error={error("contacto_emergencia_nombre")}
            requerido
          >
            {(aria) => (
              <Input
                {...aria}
                type="text"
                autoComplete="name"
                className="h-11 text-base"
                value={formulario.contacto_emergencia_nombre}
                onChange={(evento) => actualizar("contacto_emergencia_nombre", evento.target.value)}
                onBlur={() => marcarTocado("contacto_emergencia_nombre")}
              />
            )}
          </Campo>

          <PhoneInput
            id="titular-emergencia-telefono"
            valor={formulario.contacto_emergencia_telefono}
            etiqueta="Teléfono del contacto"
            error={error("contacto_emergencia_telefono")}
            ayuda={avisoEmergenciaIgual ? "Es mejor un contacto distinto de ti" : undefined}
            requerido
            onChange={(valor) => actualizar("contacto_emergencia_telefono", valor)}
            onBlur={() => {
              marcarTocado("contacto_emergencia_telefono");
            }}
          />
        </div>
      </section>

      {guardando ? <p className="text-xs text-muted-foreground">Guardando tus datos…</p> : null}
    </div>
  );
}

/**
 * Validación de un campo del titular. Devuelve el mensaje en lenguaje de
 * persona (Spec §3.3) o `undefined` si el valor es válido.
 */
function validarCampo(
  campo: keyof EstadoFormulario,
  valor: string,
  formulario: EstadoFormulario,
  fechaSalida: string | undefined,
): string | undefined {
  switch (campo) {
    case "nombre": {
      if (!valor.trim()) return "Escribe tu nombre y apellido";
      if (valor.trim().split(/\s+/).length < 2) return "Escribe tu nombre y tu apellido";
      return undefined;
    }
    case "documento": {
      if (!valor.trim()) return "Escribe el número de tu documento";
      if (formulario.tipo_doc === "V" || formulario.tipo_doc === "E") {
        if (!/^\d{5,10}$/.test(valor.trim())) {
          return "Escribe sólo los números de tu cédula";
        }
      } else if (!/^[A-Za-z0-9-]{4,20}$/.test(valor.trim())) {
        return "Revisa el número de tu documento";
      }
      return undefined;
    }
    case "fecha_nacimiento": {
      if (!valor) return "Elige tu fecha de nacimiento";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "Elige tu fecha de nacimiento";
      const nacimiento = new Date(`${valor}T00:00:00Z`).getTime();
      if (Number.isNaN(nacimiento)) return "Elige tu fecha de nacimiento";
      if (nacimiento > Date.now()) return "Tu fecha de nacimiento no puede ser futura";
      if (fechaSalida) {
        const edad = edadEn(valor, fechaSalida);
        if (edad !== null && edad < 18) {
          return "El titular debe ser mayor de 18 años. Pide a un adulto responsable que haga la reserva";
        }
      }
      return undefined;
    }
    case "telefono": {
      if (!valor.trim()) return "Escribe tu teléfono";
      if (!isValidPhone(valor)) {
        return "Escribe un teléfono válido, por ejemplo +58 412 1234567";
      }
      return undefined;
    }
    case "correo": {
      if (!valor.trim()) return "Escribe tu correo electrónico";
      if (!isValidEmail(valor)) return "Revisa tu correo: por ejemplo maria@correo.com";
      return undefined;
    }
    case "contacto_emergencia_nombre": {
      if (!valor.trim()) return "Escribe el nombre de tu contacto de emergencia";
      return undefined;
    }
    case "contacto_emergencia_telefono": {
      if (!valor.trim()) return "Escribe el teléfono de tu contacto de emergencia";
      if (!isValidPhone(valor)) {
        return "Escribe un teléfono válido, por ejemplo +58 412 1234567";
      }
      return undefined;
    }
    case "tipo_doc":
      return undefined;
    default:
      return undefined;
  }
}
