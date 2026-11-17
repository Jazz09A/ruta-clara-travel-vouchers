import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Filter, Map as MapIcon, Plus, Search, X } from "lucide-react";

import { DialogoActivar } from "@/components/admin/tours/dialogo-activar";
import { useRequisitosTour } from "@/components/admin/tours/use-requisitos";
import { AsistenteTour } from "@/components/admin/tours/asistente-tour";
import { EstadoBadge } from "@/components/admin/ui/estado";
import { EstadoError } from "@/components/admin/ui/estado-error";
import { Aviso } from "@/components/admin/ui/avisos";
import { DialogoMotivo } from "@/components/admin/ui/dialogo-motivo";
import { EmptyState } from "@/components/core/EmptyState";
import { EnlaceAdmin } from "@/components/admin/ui/enlace";
import { Seccion } from "@/components/admin/ui/seccion";
import { ShellAdmin } from "@/components/admin/ui/shell";
import { useIrA } from "@/components/admin/ui/navegacion";
import { usePermisoAdmin, SinPermiso } from "@/components/admin/ui/permisos";
import { Button } from "@/components/ui/button";
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ETIQUETA_TIPO_TOUR, formatDate } from "@/lib/format";
import type { EstadoTour, TipoTour, Tour } from "@/lib/domain/types";
import { api } from "@/lib/api";

export const Route = createFileRoute("/admin/tours/")({
  head: () => ({
    meta: [
      { title: "Tours · Panel de reservas" },
      {
        name: "description",
        content: "Catálogo de tours de la agencia: borradores, activos y archivados.",
      },
    ],
  }),
  component: CatalogoTours,
});

const ESTADOS: { valor: EstadoTour; texto: string }[] = [
  { valor: "borrador", texto: "Borrador" },
  { valor: "activo", texto: "Activo" },
  { valor: "archivado", texto: "Archivado" },
];

const TIPOS: { valor: TipoTour; texto: string }[] = [
  { valor: "full_day", texto: "Full Day" },
  { valor: "fin_de_semana", texto: "Fin de semana" },
  { valor: "multi_dia", texto: "Multi-día" },
];

interface ResumenSalidas {
  proxima: string | null;
  salidas: number;
}

function CatalogoTours() {
  const puedeVer = usePermisoAdmin("tours.ver");
  const puedeEditar = usePermisoAdmin("tours.editar");
  const queryClient = useQueryClient();
  const irA = useIrA();

  const [busqueda, setBusqueda] = React.useState("");
  const [estado, setEstado] = React.useState<"" | EstadoTour>("");
  const [tipo, setTipo] = React.useState<"" | TipoTour>("");
  const [filtrosAbiertos, setFiltrosAbiertos] = React.useState(false);

  const [tourActivar, setTourActivar] = React.useState<Tour | null>(null);
  const [bloqueos, setBloqueos] = React.useState<string[]>([]);
  const [tourArchivar, setTourArchivar] = React.useState<Tour | null>(null);
  const [motivo, setMotivo] = React.useState("");
  const [mensaje, setMensaje] = React.useState("");
  const [problema, setProblema] = React.useState("");
  const [asistenteAbierto, setAsistenteAbierto] = React.useState(false);

  // Los requisitos de activación los calcula el servidor.
  const requisitos = useRequisitosTour(tourActivar?.id ?? null);

  const {
    data: tours,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "tours"],
    queryFn: () => api.admin.tours(),
    enabled: puedeVer,
  });

  const { data: salidas } = useQuery({
    queryKey: ["admin", "salidas"],
    queryFn: () => api.admin.salidas(),
    enabled: puedeVer,
  });

  const resumenPorTour = React.useMemo(() => {
    const mapa = new Map<string, ResumenSalidas>();
    const hoy = new Date().toISOString().slice(0, 10);
    for (const salida of salidas ?? []) {
      if (salida.fecha < hoy) continue;
      const actual = mapa.get(salida.tour) ?? { proxima: null, salidas: 0 };
      mapa.set(salida.tour, {
        salidas: actual.salidas + 1,
        proxima:
          actual.proxima === null || salida.fecha < actual.proxima ? salida.fecha : actual.proxima,
      });
    }
    return mapa;
  }, [salidas]);

  const filtrados = React.useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return (tours ?? [])
      .filter((tour) => (estado === "" ? true : tour.estado === estado))
      .filter((tour) => (tipo === "" ? true : tour.tipo === tipo))
      .filter((tour) => (texto === "" ? true : tour.nombre.toLowerCase().includes(texto)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [tours, estado, tipo, busqueda]);

  const filtrosActivos = [estado, tipo, busqueda.trim()].filter((valor) => valor !== "").length;

  const refrescar = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "tours"] });
  };

  const activar = useMutation({
    mutationFn: (id: string) => api.admin.cambiarEstadoTour(id, { estado: "activo" }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        setBloqueos(resultado.bloqueos);
        return;
      }
      setBloqueos([]);
      setTourActivar(null);
      setMensaje("Tour activado. Ya aparece en el catálogo público.");
      await refrescar();
    },
    onError: (fallo) => {
      setProblema(fallo instanceof Error ? fallo.message : "No pudimos activar el tour.");
    },
  });

  const duplicar = useMutation({
    mutationFn: (id: string) => api.admin.duplicarTour(id),
    onSuccess: async (copia) => {
      setMensaje(`Creamos la copia «${copia.nombre}». Edítala y publícala cuando esté lista.`);
      await refrescar();
    },
    onError: (fallo) => {
      setProblema(fallo instanceof Error ? fallo.message : "No pudimos duplicar el tour.");
    },
  });

  const archivar = useMutation({
    mutationFn: (id: string) => api.admin.cambiarEstadoTour(id, { estado: "archivado" }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        setBloqueos(resultado.bloqueos);
        return;
      }
      setBloqueos([]);
      setTourArchivar(null);
      setMotivo("");
      setMensaje("Tour archivado. Dejó de aparecer en el catálogo público.");
      await refrescar();
    },
    onError: (fallo) => {
      setProblema(fallo instanceof Error ? fallo.message : "No pudimos archivar el tour.");
    },
  });

  /** El alta de tours es un asistente: el catálogo es la fuente de verdad. */
  const abrirAsistente = () => setAsistenteAbierto(true);
  const limpiarFiltros = () => {
    setBusqueda("");
    setEstado("");
    setTipo("");
  };

  return (
    <ShellAdmin
      titulo="Tours"
      descripcion="Catálogo de tours de la agencia. Un tour activo puede recibir reservas; uno archivado se conserva para consultar su histórico."
      breadcrumb={[{ label: "Panel", to: "/admin" }, { label: "Tours" }]}
      acciones={
        puedeEditar ? (
          <Button type="button" onClick={abrirAsistente} className="min-h-11">
            <Plus aria-hidden="true" />
            Nuevo tour
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

      <Seccion
        titulo="Catálogo"
        descripcion={`${filtrados.length} ${filtrados.length === 1 ? "tour" : "tours"} en la lista`}
        acciones={
          <Button
            type="button"
            variant="outline"
            onClick={() => setFiltrosAbiertos(true)}
            className="min-h-11 lg:hidden"
          >
            <Filter aria-hidden="true" />
            Filtros{filtrosActivos > 0 ? ` (${filtrosActivos})` : ""}
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="buscar-tour" className="text-sm">
              Buscar por nombre
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="buscar-tour"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Por ejemplo: Los Roques"
                className="min-h-11 pl-9"
              />
            </div>
          </div>

          <div className="hidden gap-3 lg:flex lg:flex-wrap">
            <div className="w-48">
              <Label htmlFor="filtro-estado" className="text-sm">
                Estado
              </Label>
              <Select
                value={estado === "" ? "todos" : estado}
                onValueChange={(valor) => setEstado(valor === "todos" ? "" : (valor as EstadoTour))}
              >
                <SelectTrigger id="filtro-estado" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  {ESTADOS.map((item) => (
                    <SelectItem key={item.valor} value={item.valor}>
                      {item.texto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-48">
              <Label htmlFor="filtro-tipo" className="text-sm">
                Tipo
              </Label>
              <Select
                value={tipo === "" ? "todos" : tipo}
                onValueChange={(valor) => setTipo(valor === "todos" ? "" : (valor as TipoTour))}
              >
                <SelectTrigger id="filtro-tipo" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  {TIPOS.map((item) => (
                    <SelectItem key={item.valor} value={item.valor}>
                      {item.texto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filtrosActivos > 0 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={limpiarFiltros}
                className="min-h-11 self-end"
              >
                <X aria-hidden="true" />
                Limpiar filtros
              </Button>
            ) : null}
          </div>

          {filtrosActivos > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label="Filtros activos">
              {busqueda.trim() !== "" ? (
                <li>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setBusqueda("")}
                    className="min-h-11"
                  >
                    «{busqueda.trim()}»
                    <X aria-hidden="true" />
                  </Button>
                </li>
              ) : null}
              {estado !== "" ? (
                <li>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setEstado("")}
                    className="min-h-11"
                  >
                    {ESTADOS.find((item) => item.valor === estado)?.texto ?? estado}
                    <X aria-hidden="true" />
                  </Button>
                </li>
              ) : null}
              {tipo !== "" ? (
                <li>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setTipo("")}
                    className="min-h-11"
                  >
                    {TIPOS.find((item) => item.valor === tipo)?.texto ?? tipo}
                    <X aria-hidden="true" />
                  </Button>
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </Seccion>

      <div className="mt-4">
        {!puedeVer ? (
          <SinPermiso permiso="tours.ver" accion="ver el catálogo de tours" />
        ) : isError ? (
          <EstadoError error={error} onReintentar={() => void refetch()} />
        ) : isPending ? (
          <div className="space-y-2" aria-hidden="true">
            <div className="h-24 animate-pulse rounded-2xl bg-muted" />
            <div className="h-24 animate-pulse rounded-2xl bg-muted" />
          </div>
        ) : filtrados.length === 0 ? (
          <EmptyState
            variante={filtrosActivos > 0 ? "sin-resultados" : "vacio"}
            titulo={
              filtrosActivos > 0 ? "No encontramos tours con estos filtros" : "Todavía no hay tours"
            }
            descripcion={
              filtrosActivos > 0
                ? "Prueba con otro nombre o quita los filtros activos."
                : "Crea el primer tour para empezar a vender salidas."
            }
            accion={
              filtrosActivos > 0
                ? { etiqueta: "Limpiar filtros", onClick: limpiarFiltros }
                : puedeEditar
                  ? { etiqueta: "Crear el primer tour", onClick: abrirAsistente }
                  : undefined
            }
          />
        ) : (
          <>
            {/* Móvil: tarjetas (UX-21) */}
            <ul className="space-y-3 lg:hidden">
              {filtrados.map((tour) => {
                const resumen = resumenPorTour.get(tour.nombre);
                return (
                  <li
                    key={tour.id}
                    className="rounded-2xl border border-border bg-card p-4 shadow-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <EnlaceAdmin
                          to={`/admin/tours/${tour.id}`}
                          className="text-base font-bold text-foreground underline-offset-2 hover:underline"
                        >
                          {tour.nombre}
                        </EnlaceAdmin>
                        <p className="text-xs text-muted-foreground">
                          {ETIQUETA_TIPO_TOUR[tour.tipo]}
                        </p>
                      </div>
                      <EstadoBadge estado={tour.estado} />
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                      {resumen && resumen.proxima
                        ? `Próxima salida: ${formatDate(resumen.proxima)}`
                        : "Sin salidas programadas"}
                    </p>

                    {puedeEditar ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => duplicar.mutate(tour.id)}
                          disabled={duplicar.isPending}
                          className="min-h-11"
                        >
                          <Copy aria-hidden="true" />
                          Duplicar
                        </Button>
                        {tour.estado === "borrador" ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setBloqueos([]);
                              setTourActivar(tour);
                            }}
                            className="min-h-11"
                          >
                            <MapIcon aria-hidden="true" />
                            Activar
                          </Button>
                        ) : null}
                        {tour.estado !== "archivado" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setBloqueos([]);
                              setMotivo("");
                              setTourArchivar(tour);
                            }}
                            className="min-h-11 text-destructive"
                          >
                            Archivar
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {/* Escritorio: tabla real (UX-22) */}
            <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-card lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Tour</TableHead>
                    <TableHead scope="col">Tipo</TableHead>
                    <TableHead scope="col">Estado</TableHead>
                    <TableHead scope="col">Próxima salida</TableHead>
                    <TableHead scope="col" className="text-right">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((tour) => {
                    const resumen = resumenPorTour.get(tour.nombre);
                    return (
                      <TableRow key={tour.id}>
                        <TableCell>
                          <EnlaceAdmin
                            to={`/admin/tours/${tour.id}`}
                            className="font-semibold text-foreground underline-offset-2 hover:underline"
                          >
                            {tour.nombre}
                          </EnlaceAdmin>
                        </TableCell>
                        <TableCell>{ETIQUETA_TIPO_TOUR[tour.tipo]}</TableCell>
                        <TableCell>
                          <EstadoBadge estado={tour.estado} />
                        </TableCell>
                        <TableCell>
                          {resumen && resumen.proxima ? formatDate(resumen.proxima) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {puedeEditar ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => duplicar.mutate(tour.id)}
                                disabled={duplicar.isPending}
                                className="min-h-11"
                              >
                                <Copy aria-hidden="true" />
                                Duplicar
                              </Button>
                              {tour.estado === "borrador" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => {
                                    setBloqueos([]);
                                    setTourActivar(tour);
                                  }}
                                  className="min-h-11"
                                >
                                  Activar
                                </Button>
                              ) : null}
                              {tour.estado !== "archivado" ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setBloqueos([]);
                                    setMotivo("");
                                    setTourArchivar(tour);
                                  }}
                                  className="min-h-11 text-destructive"
                                >
                                  Archivar
                                </Button>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Solo lectura</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {/* Hoja inferior de filtros en móvil (UX-24) */}
      <Sheet open={filtrosAbiertos} onOpenChange={setFiltrosAbiertos}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>Refina la lista de tours.</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="filtro-estado-movil">Estado</Label>
              <Select
                value={estado === "" ? "todos" : estado}
                onValueChange={(valor) => setEstado(valor === "todos" ? "" : (valor as EstadoTour))}
              >
                <SelectTrigger id="filtro-estado-movil" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  {ESTADOS.map((item) => (
                    <SelectItem key={item.valor} value={item.valor}>
                      {item.texto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filtro-tipo-movil">Tipo</Label>
              <Select
                value={tipo === "" ? "todos" : tipo}
                onValueChange={(valor) => setTipo(valor === "todos" ? "" : (valor as TipoTour))}
              >
                <SelectTrigger id="filtro-tipo-movil" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  {TIPOS.map((item) => (
                    <SelectItem key={item.valor} value={item.valor}>
                      {item.texto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={limpiarFiltros} className="min-h-11">
              Limpiar filtros
            </Button>
            <Button type="button" onClick={() => setFiltrosAbiertos(false)} className="min-h-11">
              Ver {filtrados.length} tours
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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

      <AsistenteTour
        abierto={asistenteAbierto}
        onAbiertoChange={setAsistenteAbierto}
        onCreado={async (tour) => {
          setMensaje(
            `Creamos «${tour.nombre}». Revisa los requisitos y actívalo cuando esté listo.`,
          );
          await refrescar();
          irA(`/admin/tours/${tour.id}`);
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
        descripcion="El tour deja de aparecer en el catálogo público, pero se conserva su historial. Si tiene salidas futuras publicadas, no se puede archivar."
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
    </ShellAdmin>
  );
}
