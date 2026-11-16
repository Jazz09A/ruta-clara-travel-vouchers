import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, History, Plus, Rocket, Save, Trash2 } from "lucide-react";

import { EditorCampo } from "@/components/admin/tours/editor-campo";
import { ListaCampos } from "@/components/admin/tours/lista-campos";
import { VisorFormulario } from "@/components/admin/tours/visor-formulario";
import { BIBLIOTECA_CAMPOS, generarIdCampo } from "@/components/admin/tours/biblioteca-campos";
import {
  compararVersiones,
  validarDefinicion,
  type ProblemaCampo,
} from "@/components/admin/tours/validacion";
import {
  AYUDA_TIPO_CAMPO,
  CATEGORIAS,
  ETIQUETA_CATEGORIA,
  ETIQUETA_TIPO_CAMPO,
} from "@/components/admin/tours/tipos-campo";
import { Aviso } from "@/components/admin/ui/avisos";
import { DialogoMotivo } from "@/components/admin/ui/dialogo-motivo";
import { EnlaceAdmin } from "@/components/admin/ui/enlace";
import { EstadoBadge } from "@/components/admin/ui/estado";
import { EstadoError } from "@/components/admin/ui/estado-error";
import { Seccion } from "@/components/admin/ui/seccion";
import { ShellAdmin } from "@/components/admin/ui/shell";
import { SinPermiso, usePermisoAdmin } from "@/components/admin/ui/permisos";
import { BotonCargar } from "@/components/core/BotonCargar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useEsEscritorio } from "@/lib/hooks/use-media-query";
import { useEstadoGuardado } from "@/lib/hooks/use-conexion";
import { TIPOS_SOPORTADOS, esCampoComida, esCampoPuntoSalida } from "@/lib/domain/form-engine";
import type { CampoDef, Categoria, Formulario, Respuesta, TipoCampo } from "@/lib/domain/types";
import { formatTime } from "@/lib/format";
import { api } from "@/lib/api";

export const Route = createFileRoute("/admin/tours/$id/formulario")({
  head: () => ({
    meta: [
      { title: "Constructor de formularios · Panel de reservas" },
      {
        name: "description",
        content: "Edita, previsualiza y publica el formulario dinámico de un tour.",
      },
    ],
  }),
  component: ConstructorFormulario,
});

type Modo = "editar" | "preview";

function ConstructorFormulario() {
  const { id } = Route.useParams() as { id: string };
  const puedeVer = usePermisoAdmin("tours.ver");
  const puedeEditar = usePermisoAdmin("formularios.editar");
  const esEscritorio = useEsEscritorio();
  const queryClient = useQueryClient();

  const [modo, setModo] = React.useState<Modo>("editar");
  const [campos, setCampos] = React.useState<CampoDef[]>([]);
  const [preparado, setPreparado] = React.useState(false);
  const [seleccionado, setSeleccionado] = React.useState<string | null>(null);
  const [erroresServidor, setErroresServidor] = React.useState<ProblemaCampo[]>([]);
  const [mensaje, setMensaje] = React.useState("");
  const [problema, setProblema] = React.useState("");

  const [agregarAbierto, setAgregarAbierto] = React.useState(false);
  const [eliminarAbierto, setEliminarAbierto] = React.useState(false);
  const [motivoEliminar, setMotivoEliminar] = React.useState("");

  const [respuestas, setRespuestas] = React.useState<Record<string, Respuesta>>({});
  const [categoria, setCategoria] = React.useState<Categoria>("Adulto");
  const [pasajeros, setPasajeros] = React.useState(1);

  const {
    estado: estadoGuardado,
    marcarGuardando,
    marcarGuardado,
    marcarError,
  } = useEstadoGuardado();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["admin", "formulario", id],
    queryFn: () => api.admin.formulario(id),
    enabled: puedeVer,
    retry: false,
  });

  // Flags globales del formulario y catálogo de puntos de salida.
  const { data: configDatos } = useQuery({
    queryKey: ["configuracion", "general"],
    queryFn: () => api.admin.configuracion(),
    staleTime: 60_000,
  });
  const { data: puntosSalida = [] } = useQuery({
    queryKey: ["puntos-salida"],
    queryFn: () => api.admin.puntosSalida(),
    staleTime: 60_000,
  });
  const comidasDeshabilitadas = configDatos?.config.comidas_deshabilitadas ?? true;

  const formulario: Formulario | null = data?.formulario ?? null;

  React.useEffect(() => {
    if (!data || preparado) return;
    setCampos(formulario?.definicion.campos ?? []);
    setPreparado(true);
  }, [data, preparado, formulario]);

  const problemas = React.useMemo<ProblemaCampo[]>(
    () => [...validarDefinicion(campos), ...erroresServidor],
    [campos, erroresServidor],
  );

  const bloqueantes = problemas.filter((problemaCampo) => problemaCampo.nivel === "bloqueante");
  const advertencias = problemas.filter((problemaCampo) => problemaCampo.nivel === "advertencia");

  const guardarFormulario = useMutation({
    mutationFn: (datos: { campos: CampoDef[] }) =>
      api.admin.guardarFormulario(id, {
        definicion: { campos: datos.campos },
      }),
    onSuccess: (resultado) => {
      marcarGuardado();
      setErroresServidor(resultado.errores);
    },
    onError: () => marcarError(),
  });

  // Guardado automático (con retardo para no escribir en cada tecla).
  React.useEffect(() => {
    if (!preparado || modo !== "editar") return;
    const temporizador = setTimeout(() => {
      marcarGuardando();
      guardarFormulario.mutate({ campos });
    }, 900);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campos, preparado, modo]);

  const campoSeleccionado = campos.find((campo) => campo.id === seleccionado) ?? null;

  /**
   * La vista previa muestra el formulario tal como lo verá el cliente: sin la
   * comida deshabilitada y con las opciones de punto de salida tomadas del
   * catálogo global.
   */
  const camposVistaPrevia = React.useMemo(() => {
    let lista = campos;
    if (comidasDeshabilitadas) lista = lista.filter((campo) => !esCampoComida(campo));
    return lista.map((campo) =>
      esCampoPuntoSalida(campo)
        ? {
            ...campo,
            opciones: puntosSalida
              .filter((punto) => punto.activo)
              .map((punto) => ({
                valor: punto.clave,
                label: `${punto.nombre}, ${formatTime(punto.hora)}`,
              })),
          }
        : campo,
    );
  }, [campos, comidasDeshabilitadas, puntosSalida]);

  const moverCampo = (idCampo: string, destino: number) => {
    setCampos((previos) => {
      const indice = previos.findIndex((campo) => campo.id === idCampo);
      if (indice < 0) return previos;
      const copia = [...previos];
      const [quitado] = copia.splice(indice, 1);
      if (!quitado) return previos;
      const limite = Math.max(0, Math.min(destino, copia.length));
      copia.splice(limite, 0, quitado);
      return copia;
    });
  };

  const actualizarCampo = (campo: CampoDef) => {
    setCampos((previos) => previos.map((otro) => (otro.id === campo.id ? campo : otro)));
  };

  const agregarCampo = (nuevo: CampoDef) => {
    setCampos((previos) => [...previos, nuevo]);
    setSeleccionado(nuevo.id);
    setAgregarAbierto(false);
  };

  const eliminarCampo = () => {
    if (!seleccionado) return;
    setCampos((previos) => previos.filter((campo) => campo.id !== seleccionado));
    setSeleccionado(null);
    setEliminarAbierto(false);
    setMensaje("Quitamos la pregunta del formulario.");
  };

  const vistaPrevia = (
    <VisorFormulario
      campos={camposVistaPrevia}
      respuestas={respuestas}
      categoria={categoria}
      refPasajero="pasajero-1"
      onRespuesta={(campoId, valor) =>
        setRespuestas((previos) => ({ ...previos, [campoId]: valor }))
      }
    />
  );

  return (
    <ShellAdmin
      titulo="Constructor de formularios"
      descripcion="Define las preguntas que verá el cliente al reservar este tour."
      breadcrumb={[
        { label: "Panel", to: "/admin" },
        { label: "Tours", to: "/admin/tours" },
        { label: "Ficha del tour", to: `/admin/tours/${id}` },
        { label: "Formulario" },
      ]}
      acciones={
        puedeEditar ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => {
              if (bloqueantes.length > 0) {
                setProblema("Corrige los errores bloqueantes antes de continuar.");
                return;
              }
              setMensaje("Formulario guardado correctamente.");
            }}
          >
            <Save aria-hidden="true" />
            Guardar
          </Button>
        ) : undefined
      }
    >
      {mensaje ? (
        <Aviso
          tono="exito"
          titulo={mensaje}
          className="mb-4"
          acciones={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMensaje("")}
              className="min-h-11"
            >
              Entendido
            </Button>
          }
        />
      ) : null}

      {problema ? (
        <Aviso
          tono="peligro"
          titulo={problema}
          className="mb-4"
          acciones={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setProblema("")}
              className="min-h-11"
            >
              Entendido
            </Button>
          }
        />
      ) : null}

      {comidasDeshabilitadas ? (
        <Aviso tono="aviso" titulo="La selección de comida está deshabilitada" className="mb-4">
          <span>
            Las preguntas de comida (almuerzo, menús) no se le piden al cliente mientras la bandera
            global esté apagada: aquí siguen visibles y editables, marcadas como «Comida». Se
            reactivan desde{" "}
            <EnlaceAdmin
              to="/admin/configuracion/general"
              className="font-semibold underline underline-offset-4"
            >
              Configuración → General
            </EnlaceAdmin>
            . Nada se borra.
          </span>
        </Aviso>
      ) : null}

      {!puedeVer ? (
        <SinPermiso permiso="tours.ver" accion="ver el formulario de un tour" />
      ) : isError ? (
        <EstadoError
          error={error}
          titulo="Este tour todavía no tiene formulario"
          onReintentar={() => void refetch()}
        />
      ) : isPending || !preparado ? (
        <div className="space-y-3" aria-hidden="true">
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
          <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : (
        <Tabs value={modo} onValueChange={(valor) => setModo(valor as Modo)}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="editar" className="min-h-11">
              Editar
            </TabsTrigger>
            <TabsTrigger value="preview" className="min-h-11">
              <Eye aria-hidden="true" />
              Vista previa
            </TabsTrigger>
          </TabsList>

          {/* ---------------- Editar ---------------- */}
          <TabsContent value="editar">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p
                role="status"
                aria-live="polite"
                className="text-xs font-semibold text-muted-foreground"
              >
                {estadoGuardado === "guardando"
                  ? "Guardando el borrador…"
                  : estadoGuardado === "guardado"
                    ? "Borrador guardado"
                    : estadoGuardado === "sin-conexion"
                      ? "Sin conexión — se guardará al reconectar"
                      : "No pudimos guardar el borrador. Reintenta"}
              </p>
              <span className="text-xs text-muted-foreground">
                {formulario ? "Formulario existente" : "Nuevo formulario"}
              </span>
            </div>

            {bloqueantes.length > 0 || advertencias.length > 0 ? (
              <div className="mb-4 space-y-2">
                {bloqueantes.map((problemaCampo) => (
                  <p
                    key={`${problemaCampo.campo}-${problemaCampo.mensaje}`}
                    className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  >
                    <span className="font-semibold">Bloqueante:</span> {problemaCampo.mensaje}
                  </p>
                ))}
                {advertencias.map((problemaCampo) => (
                  <p
                    key={`${problemaCampo.campo}-${problemaCampo.mensaje}`}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
                  >
                    <span className="font-semibold">Advertencia:</span> {problemaCampo.mensaje}
                  </p>
                ))}
              </div>
            ) : null}

            <div className={esEscritorio ? "grid gap-4 lg:grid-cols-2" : "space-y-4"}>
              <Seccion
                titulo="Preguntas del formulario"
                descripcion="El orden es el orden en que el cliente las ve."
                acciones={
                  puedeEditar ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAgregarAbierto(true)}
                      className="min-h-11"
                    >
                      <Plus aria-hidden="true" />
                      Agregar campo
                    </Button>
                  ) : undefined
                }
              >
                <ListaCampos
                  campos={campos}
                  seleccionado={seleccionado}
                  onSeleccionar={setSeleccionado}
                  onMover={moverCampo}
                  onAgregar={puedeEditar ? () => setAgregarAbierto(true) : undefined}
                  comidasDeshabilitadas={comidasDeshabilitadas}
                />
              </Seccion>

              {esEscritorio ? (
                <Seccion
                  titulo={campoSeleccionado ? campoSeleccionado.label : "Editor de la pregunta"}
                  descripcion={
                    campoSeleccionado
                      ? "Los cambios se guardan solos en el borrador."
                      : "Elige una pregunta de la lista para editarla."
                  }
                  acciones={
                    campoSeleccionado && puedeEditar ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setEliminarAbierto(true)}
                        className="min-h-11 text-destructive"
                      >
                        <Trash2 aria-hidden="true" />
                        Quitar
                      </Button>
                    ) : undefined
                  }
                >
                  {campoSeleccionado ? (
                    <EditorCampo
                      campo={campoSeleccionado}
                      campos={campos}
                      bloqueado={false}
                      puntosSalida={puntosSalida}
                      comidasDeshabilitadas={comidasDeshabilitadas}
                      problemas={problemas.filter(
                        (problemaCampo) => problemaCampo.campo === campoSeleccionado.id,
                      )}
                      onChange={actualizarCampo}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Selecciona una pregunta para ver sus propiedades.
                    </p>
                  )}
                </Seccion>
              ) : null}
            </div>
          </TabsContent>

          {/* ---------------- Vista previa ---------------- */}
          <TabsContent value="preview">
            <Seccion
              titulo="Vista previa del formulario"
              descripcion="Se muestra tal como lo verá el cliente, con el mismo motor de evaluación. No se guarda nada."
            >
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="preview-categoria">Categoría del pasajero</Label>
                  <Select
                    value={categoria}
                    onValueChange={(valor) => setCategoria(valor as Categoria)}
                  >
                    <SelectTrigger id="preview-categoria" className="min-h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((item) => (
                        <SelectItem key={item} value={item}>
                          {ETIQUETA_CATEGORIA[item]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="preview-pasajeros">Pasajeros simulados</Label>
                  <Select
                    value={String(pasajeros)}
                    onValueChange={(valor) => setPasajeros(Number.parseInt(valor, 10) || 1)}
                  >
                    <SelectTrigger id="preview-pasajeros" className="min-h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((cantidad) => (
                        <SelectItem key={cantidad} value={String(cantidad)}>
                          {cantidad} {cantidad === 1 ? "pasajero" : "pasajeros"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div
                className={
                  esEscritorio
                    ? "rounded-2xl border border-border p-4"
                    : "mx-auto max-w-[380px] rounded-[2rem] border-4 border-slate-800 bg-background p-4 shadow-xl"
                }
              >
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Preguntas para {pasajeros} {pasajeros === 1 ? "pasajero" : "pasajeros"}
                </p>
                {vistaPrevia}
              </div>
            </Seccion>
          </TabsContent>

          {/* ---------------- Versiones ---------------- */}
          <TabsContent value="versiones">
            <Seccion
              titulo="Versiones publicadas"
              descripcion="Las versiones publicadas no se pueden editar. Para cambiar algo, edita el borrador y publica una versión nueva."
            >
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th scope="col" className="px-3 py-2 text-left font-semibold">
                        Versión
                      </th>
                      <th scope="col" className="px-3 py-2 text-left font-semibold">
                        Estado
                      </th>
                      <th scope="col" className="px-3 py-2 text-left font-semibold">
                        Publicada
                      </th>
                      <th scope="col" className="px-3 py-2 text-left font-semibold">
                        Autor
                      </th>
                      <th scope="col" className="px-3 py-2 text-left font-semibold">
                        Preguntas
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {versiones.map((version) => (
                      <tr key={version.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-semibold">{version.version}</td>
                        <td className="px-3 py-2">
                          <EstadoBadge estado={version.estado} />
                        </td>
                        <td className="px-3 py-2">
                          {version.publicada_en
                            ? new Date(version.publicada_en).toLocaleDateString("es-VE")
                            : "—"}
                        </td>
                        <td className="px-3 py-2">{version.autor ?? "—"}</td>
                        <td className="px-3 py-2">{version.definicion.campos.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="version-a">Versión base</Label>
                  <Select value={versionComparadaA} onValueChange={setVersionComparadaA}>
                    <SelectTrigger id="version-a" className="min-h-11">
                      <SelectValue placeholder="Elige una versión" />
                    </SelectTrigger>
                    <SelectContent>
                      {versiones.map((version) => (
                        <SelectItem key={version.id} value={String(version.version)}>
                          Versión {version.version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="version-b">Versión a comparar</Label>
                  <Select value={versionComparadaB} onValueChange={setVersionComparadaB}>
                    <SelectTrigger id="version-b" className="min-h-11">
                      <SelectValue placeholder="Elige una versión" />
                    </SelectTrigger>
                    <SelectContent>
                      {versiones.map((version) => (
                        <SelectItem key={version.id} value={String(version.version)}>
                          Versión {version.version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {comparacion ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground">Diferencias</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>
                      {comparacion.agregados.length} preguntas agregadas,{" "}
                      {comparacion.quitados.length} quitadas y {comparacion.cambiados.length}{" "}
                      modificadas.
                    </li>
                  </ul>

                  {comparacion.agregados.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Agregadas
                      </p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {comparacion.agregados.map((campo) => (
                          <li key={campo.id}>• {campo.label}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {comparacion.quitados.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Quitadas
                      </p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {comparacion.quitados.map((campo) => (
                          <li key={campo.id}>• {campo.label}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {comparacion.cambiados.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Modificadas
                      </p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {comparacion.cambiados.map((cambio) => (
                          <li key={cambio.id}>
                            • {cambio.etiqueta}: {cambio.cambios.join(", ")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Elige dos versiones para ver qué cambió entre ellas.
                </p>
              )}
            </Seccion>
          </TabsContent>
        </Tabs>
      )}

      {/* ---------------- Agregar campo ---------------- */}
      <Dialog open={agregarAbierto} onOpenChange={setAgregarAbierto}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Agregar una pregunta</DialogTitle>
            <DialogDescription>
              Elige el tipo de respuesta o inserta una pregunta de la biblioteca.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Biblioteca de preguntas</p>
              <ul className="space-y-2">
                {BIBLIOTECA_CAMPOS.map((item) => (
                  <li key={item.clave}>
                    <button
                      type="button"
                      onClick={() => agregarCampo(item.crear())}
                      className="w-full rounded-xl border border-border px-3 py-2 text-left hover:bg-accent"
                    >
                      <span className="block text-sm font-semibold text-foreground">
                        {item.nombre}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {item.descripcion}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Empezar de cero</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {TIPOS_SOPORTADOS.map((tipo) => (
                  <li key={tipo}>
                    <button
                      type="button"
                      onClick={() =>
                        agregarCampo({
                          id: generarIdCampo(ETIQUETA_TIPO_CAMPO[tipo]),
                          label: "",
                          tipo: tipo as TipoCampo,
                          alcance: "por_pasajero",
                          obligatorio: false,
                        })
                      }
                      className="w-full rounded-xl border border-border px-3 py-2 text-left hover:bg-accent"
                    >
                      <span className="block text-sm font-semibold text-foreground">
                        {ETIQUETA_TIPO_CAMPO[tipo]}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {AYUDA_TIPO_CAMPO[tipo]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAgregarAbierto(false)}
              className="min-h-11"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Eliminar pregunta ---------------- */}
      <DialogoMotivo
        abierto={eliminarAbierto}
        onAbiertoChange={(abierto) => {
          setEliminarAbierto(abierto);
          if (!abierto) setMotivoEliminar("");
        }}
        titulo="Quitar la pregunta del borrador"
        descripcion="La pregunta deja de mostrarse en el borrador. Si ya estaba publicada, el servidor bloqueará la publicación hasta que la restaures."
        etiquetaConfirmar="Quitar pregunta"
        motivo={motivoEliminar}
        onMotivoChange={setMotivoEliminar}
        onConfirmar={eliminarCampo}
        destructivo
      />

      {/* ---------------- Publicar ---------------- */}
      <Dialog open={publicarAbierto} onOpenChange={setPublicarAbierto}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Publicar la versión {versionBorrador}
            </DialogTitle>
            <DialogDescription>
              Los clientes que ya están registrándose seguirán con la versión anterior; las nuevas
              reservas usarán esta versión.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p>
              <span className="font-semibold">{campos.length}</span> preguntas en esta versión.
            </p>

            {publicada ? (
              <p className="text-muted-foreground">
                La versión publicada hoy es la {publicada.version}. Los campos publicados no se
                pueden quitar ni cambiar de tipo o de alcance.
              </p>
            ) : null}

            {advertencias.length > 0 ? (
              <div className="space-y-2">
                {advertencias.map((problemaCampo) => (
                  <p
                    key={`${problemaCampo.campo}-${problemaCampo.mensaje}`}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
                  >
                    {problemaCampo.mensaje}
                  </p>
                ))}
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="confirmar-advertencias"
                    checked={confirmoAdvertencias}
                    onCheckedChange={(estado) => setConfirmoAdvertencias(estado === true)}
                  />
                  <Label htmlFor="confirmar-advertencias" className="text-sm font-normal">
                    Confirmo los cambios de etiquetas y las advertencias.
                  </Label>
                </div>
              </div>
            ) : null}

            {bloqueantes.length > 0 ? (
              <ul className="space-y-1">
                {bloqueantes.map((problemaCampo) => (
                  <li
                    key={`${problemaCampo.campo}-${problemaCampo.mensaje}`}
                    className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive"
                  >
                    {problemaCampo.mensaje}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPublicarAbierto(false)}
              disabled={publicar.isPending}
              className="min-h-11"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => publicar.mutate()}
              disabled={
                publicar.isPending ||
                bloqueantes.length > 0 ||
                (advertencias.length > 0 && !confirmoAdvertencias)
              }
              aria-busy={publicar.isPending || undefined}
              className="min-h-11"
            >
              {publicar.isPending ? "Publicando…" : "Publicar versión"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Editor en móvil ---------------- */}
      {!esEscritorio ? (
        <Sheet
          open={campoSeleccionado !== null}
          onOpenChange={(abierto) => {
            if (!abierto) setSeleccionado(null);
          }}
        >
          <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Editar la pregunta</SheetTitle>
              <SheetDescription>
                {campoSeleccionado?.label || "Escribe la etiqueta de la pregunta."}
              </SheetDescription>
            </SheetHeader>

            <div className="py-4">
              {campoSeleccionado ? (
                <EditorCampo
                  campo={campoSeleccionado}
                  campos={campos}
                  bloqueado={Boolean(publicada)}
                  puntosSalida={puntosSalida}
                  comidasDeshabilitadas={comidasDeshabilitadas}
                  problemas={problemas.filter(
                    (problemaCampo) => problemaCampo.campo === campoSeleccionado.id,
                  )}
                  onChange={actualizarCampo}
                />
              ) : null}
            </div>

            {campoSeleccionado && puedeEditar ? (
              <div className="flex gap-2 pb-4">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 flex-1"
                  onClick={() => setEliminarAbierto(true)}
                >
                  <Trash2 aria-hidden="true" />
                  Quitar
                </Button>
                <Button
                  type="button"
                  className="min-h-11 flex-1"
                  onClick={() => setSeleccionado(null)}
                >
                  <Save aria-hidden="true" />
                  Listo
                </Button>
              </div>
            ) : null}
          </SheetContent>
        </Sheet>
      ) : null}
    </ShellAdmin>
  );
}
