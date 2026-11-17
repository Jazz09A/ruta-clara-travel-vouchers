import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, ListChecks, Save, Settings2, Plus, Trash2, Edit } from "lucide-react";

import { DialogoActivar } from "@/components/admin/tours/dialogo-activar";
import { useRequisitosTour } from "@/components/admin/tours/use-requisitos";
import { DialogoFecha } from "@/components/admin/tours/dialogo-fecha";
import { DialogoTarifa } from "@/components/admin/tours/dialogo-tarifa";
import { ContadorCupos } from "@/components/admin/tours/contador-cupos";
import { EditorTour } from "@/components/admin/tours/editor-tour";
import { Aviso } from "@/components/admin/ui/avisos";
import { DialogoMotivo } from "@/components/admin/ui/dialogo-motivo";
import { EstadoBadge } from "@/components/admin/ui/estado";
import { EstadoError } from "@/components/admin/ui/estado-error";
import { Seccion } from "@/components/admin/ui/seccion";
import { ShellAdmin } from "@/components/admin/ui/shell";
import { SinPermiso, usePermisoAdmin } from "@/components/admin/ui/permisos";
import { BotonCargar } from "@/components/core/BotonCargar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ETIQUETA_TIPO_TOUR, formatDate, formatTime, formatUsd } from "@/lib/format";
import type { DocumentoPunto, FechaTour, Tarifa, Tour } from "@/lib/domain/types";
import { api } from "@/lib/api";

export const Route = createFileRoute("/admin/tours/$id")({
  head: () => ({
    meta: [
      { title: "Tour · Panel de reservas" },
      { name: "description", content: "Ficha del tour: datos, salidas y tarifas." },
    ],
  }),
  component: FichaTour,
});

function FichaTour() {
  const { id } = Route.useParams() as { id: string };
  const puedeVer = usePermisoAdmin("tours.ver");
  const puedeEditar = usePermisoAdmin("tours.editar");
  const queryClient = useQueryClient();

  const [borrador, setBorrador] = React.useState<Tour | null>(null);
  const [mensaje, setMensaje] = React.useState("");
  const [problema, setProblema] = React.useState("");
  const [tourActivar, setTourActivar] = React.useState<Tour | null>(null);
  const [bloqueos, setBloqueos] = React.useState<string[]>([]);
  const [tourArchivar, setTourArchivar] = React.useState<Tour | null>(null);
  const [motivo, setMotivo] = React.useState("");
  const [fechaEdicion, setFechaEdicion] = React.useState<FechaTour | null>(null);
  const [fechaAbierta, setFechaAbierta] = React.useState(false);
  const [errorFecha, setErrorFecha] = React.useState("");
  const [tarifaEdicion, setTarifaEdicion] = React.useState<Tarifa | null>(null);
  const [tarifaAbierta, setTarifaAbierta] = React.useState(false);
  const [errorTarifa, setErrorTarifa] = React.useState("");

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["admin", "tour", id],
    queryFn: () => api.admin.tour(id),
    enabled: puedeVer,
  });

  // Los requisitos de activación los calcula el servidor.
  const requisitos = useRequisitosTour(id);

  const { data: todosTours } = useQuery({
    queryKey: ["admin", "tours"],
    queryFn: () => api.admin.tours(),
    enabled: puedeVer,
    staleTime: 60_000,
  });

  const { data: configuracion } = useQuery({
    queryKey: ["admin", "configuracion"],
    queryFn: () => api.admin.configuracion(),
    enabled: puedeVer,
  });

  React.useEffect(() => {
    if (data?.tour) setBorrador(data.tour);
  }, [data?.tour]);

  const refrescar = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "tour", id] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "tours"] });
  };

  const guardar = useMutation({
    mutationFn: (tour: Tour) => api.admin.guardarTour(tour.id, tour),
    onSuccess: async () => {
      setMensaje("Guardamos los datos del tour.");
      setProblema("");
      await refrescar();
    },
    onError: (fallo) => {
      setProblema(fallo instanceof Error ? fallo.message : "No pudimos guardar el tour.");
    },
  });

  // El horario de recogida es **por tour**: se guarda aparte del resto.
  const guardarPuntos = useMutation({
    mutationFn: (puntos: DocumentoPunto[]) => api.admin.guardarPuntos(id, puntos),
    onSuccess: async () => {
      await refrescar();
    },
    onError: (fallo) => {
      setProblema(fallo instanceof Error ? fallo.message : "No pudimos guardar los puntos.");
    },
  });

  const activar = useMutation({
    mutationFn: (tourId: string) => api.admin.cambiarEstadoTour(tourId, { estado: "activo" }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        setBloqueos(resultado.bloqueos);
        return;
      }
      setBloqueos([]);
      setTourActivar(null);
      setMensaje("Tour activado.");
      await refrescar();
    },
    onError: (fallo) => {
      setProblema(fallo instanceof Error ? fallo.message : "No pudimos activar el tour.");
    },
  });

  const archivar = useMutation({
    mutationFn: (tourId: string) => api.admin.cambiarEstadoTour(tourId, { estado: "archivado" }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        setBloqueos(resultado.bloqueos);
        return;
      }
      setBloqueos([]);
      setTourArchivar(null);
      setMotivo("");
      setMensaje("Tour archivado.");
      await refrescar();
    },
    onError: (fallo) => {
      setProblema(fallo instanceof Error ? fallo.message : "No pudimos archivar el tour.");
    },
  });

  const guardarFecha = useMutation({
    mutationFn: (datos: {
      id?: string;
      tour_id: string;
      fecha_salida: string;
      hora_salida: string;
      cupos_total: number;
      corte_venta_horas: number;
      estado: FechaTour["estado"];
    }) => api.admin.guardarFecha(datos),
    onSuccess: async () => {
      setFechaAbierta(false);
      setFechaEdicion(null);
      setErrorFecha("");
      setMensaje("Guardamos la salida.");
      await refrescar();
    },
    onError: (fallo) => {
      setErrorFecha(fallo instanceof Error ? fallo.message : "No pudimos guardar la salida.");
    },
  });

  const guardarTarifa = useMutation({
    mutationFn: (datos: Partial<Tarifa> & { id?: string }) => api.admin.guardarTarifa(datos),
    onSuccess: async () => {
      setTarifaAbierta(false);
      setTarifaEdicion(null);
      setErrorTarifa("");
      setMensaje("Guardamos la tarifa.");
      await refrescar();
    },
    onError: (fallo) => {
      setErrorTarifa(fallo instanceof Error ? fallo.message : "No pudimos guardar la tarifa.");
    },
  });

  const eliminarTarifa = useMutation({
    mutationFn: (id: string) => api.admin.eliminarTarifa(id),
    onSuccess: async () => {
      setMensaje("Eliminamos la tarifa.");
      await refrescar();
    },
    onError: (fallo) => {
      setProblema(fallo instanceof Error ? fallo.message : "No pudimos eliminar la tarifa.");
    },
  });

  const cerrarFecha = useMutation({
    mutationFn: (idFecha: string) => api.admin.cerrarFecha(idFecha, { expirar_pendientes: true }),
    onSuccess: async () => {
      setMensaje("Cerramos la salida. Las reservas pendientes quedaron expiradas.");
      await refrescar();
    },
    onError: (fallo) => {
      setProblema(fallo instanceof Error ? fallo.message : "No pudimos cerrar la salida.");
    },
  });

  // Familias ya usadas en el catálogo (sugerencias del editor).
  const familias = React.useMemo(() => {
    const set = new Set<string>();
    for (const otro of todosTours ?? []) {
      if (otro.familia) set.add(otro.familia);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [todosTours]);

  const tour = data?.tour ?? borrador;
  const fechas = data?.fechas ?? [];
  const tarifas = data?.tarifas ?? [];

  const hayCambios =
    borrador !== null &&
    data !== undefined &&
    JSON.stringify(borrador) !== JSON.stringify(data.tour);

  return (
    <ShellAdmin
      titulo={tour ? tour.nombre : "Tour"}
      descripcion={
        tour
          ? `${ETIQUETA_TIPO_TOUR[tour.tipo]} · creado el ${formatDate(tour.fecha_creacion.slice(0, 10))}`
          : "Cargando los datos del tour…"
      }
      breadcrumb={[
        { label: "Panel", to: "/admin" },
        { label: "Tours", to: "/admin/tours" },
        { label: tour?.nombre ?? "Tour" },
      ]}
      acciones={
        <>
          {puedeEditar && tour ? (
            <>
              {tour.estado === "borrador" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    setBloqueos([]);
                    setTourActivar(tour);
                  }}
                >
                  Activar
                </Button>
              ) : null}
              {tour.estado !== "archivado" ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 text-destructive"
                  onClick={() => {
                    setBloqueos([]);
                    setMotivo("");
                    setTourArchivar(tour);
                  }}
                >
                  Archivar
                </Button>
              ) : null}
            </>
          ) : null}
        </>
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

      {!puedeVer ? (
        <SinPermiso permiso="tours.ver" accion="ver la ficha de un tour" />
      ) : isError ? (
        <EstadoError error={error} onReintentar={() => void refetch()} />
      ) : isPending || !tour || !borrador ? (
        <div className="space-y-3" aria-hidden="true">
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : (
        <Tabs defaultValue="datos">
          <TabsList className="w-full">
            <TabsTrigger value="datos" className="min-h-11 flex-1 px-2 text-xs sm:text-sm">
              Datos del tour
            </TabsTrigger>
            <TabsTrigger value="fechas" className="min-h-11 flex-1 px-2 text-xs sm:text-sm">
              Fechas de salida
            </TabsTrigger>
            <TabsTrigger value="tarifas" className="min-h-11 flex-1 px-2 text-xs sm:text-sm">
              Tarifas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="datos">
            <Seccion
              titulo="Ficha del tour"
              descripcion="Datos que ve el cliente y datos que usa la agencia para operar."
              acciones={
                puedeEditar ? (
                  <BotonCargar
                    cargando={guardar.isPending}
                    bloqueado={!hayCambios}
                    motivoBloqueo={hayCambios ? undefined : "No hay cambios que guardar."}
                    onClick={() => guardar.mutate(borrador)}
                    className="min-h-11"
                  >
                    <Save aria-hidden="true" />
                    Guardar cambios
                  </BotonCargar>
                ) : undefined
              }
            >
              <div className="mb-4 flex items-center gap-2">
                <EstadoBadge estado={tour.estado} />
              </div>

              <EditorTour
                tour={borrador}
                onChange={setBorrador}
                politicas={configuracion?.politicas ?? []}
                terminos={configuracion?.terminos ?? []}
                puedeEditar={puedeEditar}
                familias={familias}
                guardandoPuntos={guardarPuntos.isPending}
                onGuardarPuntos={(puntos) => guardarPuntos.mutate(puntos)}
              />
            </Seccion>
          </TabsContent>

          <TabsContent value="fechas">
            <Seccion
              titulo="Fechas de salida"
              descripcion="Cada salida tiene su fecha, hora, cupos y corte de venta."
              acciones={
                puedeEditar ? (
                  <Button
                    type="button"
                    onClick={() => {
                      setFechaEdicion(null);
                      setErrorFecha("");
                      setFechaAbierta(true);
                    }}
                    className="min-h-11"
                  >
                    <CalendarPlus aria-hidden="true" />
                    Nueva salida
                  </Button>
                ) : undefined
              }
            >
              {fechas.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Este tour todavía no tiene salidas programadas.
                </p>
              ) : (
                <ul className="space-y-3">
                  {fechas.map((fecha) => {
                    const tarifasFecha = tarifas.filter((t) => t.fecha_tour_id === fecha.id);
                    return (
                      <li
                        key={fecha.id}
                        className="rounded-xl border border-border p-3 md:flex md:items-start md:justify-between md:gap-4"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">
                            {formatDate(fecha.fecha_salida)} · {formatTime(fecha.hora_salida)}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Corte de venta: {fecha.corte_venta_horas} h antes de la salida
                            {tarifasFecha.length > 0
                              ? ` · ${tarifasFecha.length} categorías con tarifa`
                              : ""}
                          </p>
                          <div className="mt-2">
                            <EstadoBadge estado={fecha.estado} />
                          </div>
                        </div>

                        <div className="mt-3 md:mt-0 md:shrink-0">
                          <ContadorCupos
                            total={fecha.cupos_total}
                            vendidos={fecha.cupos_vendidos}
                            retenidos={fecha.cupos_retenidos}
                          />
                        </div>

                        {puedeEditar ? (
                          <div className="mt-3 flex flex-wrap gap-2 md:mt-0 md:shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-h-11"
                              onClick={() => {
                                setFechaEdicion(fecha);
                                setErrorFecha("");
                                setFechaAbierta(true);
                              }}
                            >
                              <Settings2 aria-hidden="true" />
                              Editar
                            </Button>
                            {fecha.estado === "publicada" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="min-h-11"
                                onClick={() => cerrarFecha.mutate(fecha.id)}
                                disabled={cerrarFecha.isPending}
                              >
                                Cerrar venta
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Seccion>
          </TabsContent>

          <TabsContent value="tarifas">
            <Seccion
              titulo="Tarifas por categoría"
              descripcion="Precio en dólares que se cobra a cada pasajero según su edad al momento de la salida."
              acciones={
                puedeEditar ? (
                  <Button
                    type="button"
                    onClick={() => {
                      setTarifaEdicion(null);
                      setErrorTarifa("");
                      setTarifaAbierta(true);
                    }}
                    className="min-h-11"
                  >
                    <Plus aria-hidden="true" />
                    Nueva tarifa
                  </Button>
                ) : undefined
              }
            >
              <div className="overflow-x-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Salida</TableHead>
                      <TableHead scope="col">Categoría</TableHead>
                      <TableHead scope="col">Edad</TableHead>
                      <TableHead scope="col" className="text-right">
                        Precio (USD)
                      </TableHead>
                      {puedeEditar ? (
                        <TableHead scope="col" className="text-right">
                          Acciones
                        </TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fechas.flatMap((fecha) =>
                      tarifas
                        .filter((tarifa) => tarifa.fecha_tour_id === fecha.id)
                        .map((tarifa) => (
                          <TableRow key={tarifa.id}>
                            <TableCell>
                              {formatDate(fecha.fecha_salida)} · {formatTime(fecha.hora_salida)}
                            </TableCell>
                            <TableCell>{tarifa.categoria}</TableCell>
                            <TableCell>
                              {tarifa.edad_min} a {tarifa.edad_max} años
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatUsd(tarifa.precio_usd)}
                            </TableCell>
                            {puedeEditar ? (
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setTarifaEdicion(tarifa);
                                      setErrorTarifa("");
                                      setTarifaAbierta(true);
                                    }}
                                    className="min-h-8"
                                  >
                                    <Edit className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => eliminarTarifa.mutate(tarifa.id)}
                                    disabled={eliminarTarifa.isPending}
                                    className="min-h-8 text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                </div>
                              </TableCell>
                            ) : null}
                          </TableRow>
                        )),
                    )}
                  </TableBody>
                </Table>
              </div>
            </Seccion>
          </TabsContent>
        </Tabs>
      )}

      <DialogoActivar
        abierto={tourActivar !== null}
        onAbiertoChange={(abierto) => {
          if (!abierto) {
            setTourActivar(null);
            setBloqueos([]);
          }
        }}
        tour={tourActivar}
        requisitos={requisitos.data?.requisitos ?? []}
        cargandoRequisitos={requisitos.isPending}
        bloqueos={bloqueos}
        activando={activar.isPending}
        onConfirmar={() => {
          if (tourActivar) activar.mutate(tourActivar.id);
        }}
      />

      <DialogoMotivo
        abierto={tourArchivar !== null}
        onAbiertoChange={(abierto) => {
          if (!abierto) {
            setTourArchivar(null);
            setMotivo("");
            setBloqueos([]);
          }
        }}
        titulo={`Archivar ${tourArchivar?.nombre ?? "tour"}`}
        descripcion="El tour deja de aparecer en el catálogo público, pero se conserva su historial."
        etiquetaConfirmar="Archivar tour"
        motivo={motivo}
        onMotivoChange={setMotivo}
        onConfirmar={() => {
          if (tourArchivar) archivar.mutate(tourArchivar.id);
        }}
        destructivo
        cargando={archivar.isPending}
        extra={
          bloqueos.length > 0 ? (
            <ul className="space-y-1">
              {bloqueos.map((bloqueo) => (
                <li
                  key={bloqueo}
                  className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {bloqueo}
                </li>
              ))}
            </ul>
          ) : null
        }
      />

      <DialogoFecha
        abierto={fechaAbierta}
        onAbiertoChange={(abierto) => {
          setFechaAbierta(abierto);
          if (!abierto) setFechaEdicion(null);
        }}
        fecha={fechaEdicion}
        guardando={guardarFecha.isPending}
        error={errorFecha === "" ? undefined : errorFecha}
        onGuardar={(datos) =>
          guardarFecha.mutate({
            ...datos,
            tour_id: id,
          })
        }
      />

      <DialogoTarifa
        abierto={tarifaAbierta}
        onAbiertoChange={(abierto) => {
          setTarifaAbierta(abierto);
          if (!abierto) setTarifaEdicion(null);
        }}
        tarifa={tarifaEdicion}
        fechas={fechas.map((fecha) => ({
          id: fecha.id,
          etiqueta: `${formatDate(fecha.fecha_salida)} · ${formatTime(fecha.hora_salida)}`,
        }))}
        guardando={guardarTarifa.isPending}
        error={errorTarifa === "" ? undefined : errorTarifa}
        onGuardar={(datos) => guardarTarifa.mutate(datos)}
      />
    </ShellAdmin>
  );
}
