import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import * as React from "react";
import { Clock3, Filter, RefreshCw, Search, TriangleAlert } from "lucide-react";

import { AdminShell } from "@/components/admin/AdminShell";
import { usePermiso } from "@/components/admin/sesion";
import {
  FilaPagoCola,
  BadgePago,
  calcularDiferencia,
  formatearMonto,
} from "@/components/admin/pagos";
import { EmptyState } from "@/components/core/EmptyState";
import { ErrorState } from "@/components/core/ErrorState";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { ETIQUETA_METODO_PAGO, formatRelative } from "@/lib/format";
import type { FiltroPagos } from "@/lib/domain/api";
import type { Pago, Reserva } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/pagos/")({
  head: () => ({
    meta: [
      { title: "Pagos · Escapate Tours" },
      {
        name: "description",
        content: "Historial de pagos registrados de las reservas.",
      },
    ],
  }),
  component: HistorialPagos,
});

/** Minutos a partir de los cuales el pago más antiguo se resalta. */
const UMBRAL_ANTIGUEDAD_MIN = 120;

/** Pagos que se piden en cada página. */
const LIMITE_PAGINA = 20;

const FILTROS_ESTADO: { valor: string; etiqueta: string }[] = [
  { valor: "aprobado", etiqueta: "Aprobados" },
  { valor: "reportado", etiqueta: "Reportados (acuse del cliente)" },
  { valor: "rechazado", etiqueta: "Rechazados" },
  { valor: "correccion_solicitada", etiqueta: "Corrección solicitada" },
  { valor: "anulado", etiqueta: "Anulados" },
  { valor: "todos", etiqueta: "Todos" },
];

function HistorialPagos() {
  const puedeVer = usePermiso("pagos.ver");

  const [filtroEstado, setFiltroEstado] = React.useState("todos");
  const [busqueda, setBusqueda] = React.useState("");
  const [busquedaAplicada, setBusquedaAplicada] = React.useState("");

  // Búsqueda con retardo de 300 ms y mínimo de 2 caracteres (UX-26).
  React.useEffect(() => {
    const id = window.setTimeout(() => {
      const limpia = busqueda.trim();
      setBusquedaAplicada(limpia.length >= 2 ? limpia : "");
    }, 300);
    return () => window.clearTimeout(id);
  }, [busqueda]);

  const consulta = useInfiniteQuery({
    queryKey: ["admin", "pagos", filtroEstado, busquedaAplicada],
    queryFn: ({ pageParam }) => {
      const filtros: FiltroPagos = {
        ...(filtroEstado !== "todos" ? { estado: filtroEstado } : {}),
        ...(busquedaAplicada ? { busqueda: busquedaAplicada } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
        limite: LIMITE_PAGINA,
      };
      return api.admin.pagos(filtros);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (ultimaPagina) => ultimaPagina.next_cursor ?? undefined,
    enabled: puedeVer,
  });

  const pagos = React.useMemo<(Pago & { reserva: Reserva })[]>(
    () => consulta.data?.pages.flatMap((pagina) => pagina.items) ?? [],
    [consulta.data],
  );

  const antiguedadDe = (pago: Pago): number =>
    Math.max(0, Math.round((Date.now() - new Date(pago.creado_en).getTime()) / 60000));

  const masAntiguo = pagos.length > 0 ? pagos[0] : undefined;
  const masAntiguoResaltable =
    masAntiguo !== undefined && antiguedadDe(masAntiguo) > UMBRAL_ANTIGUEDAD_MIN;

  if (!puedeVer) {
    return (
      <AdminShell titulo="Pagos">
        <ErrorState
          titulo="No tienes permiso para ver los pagos"
          mensaje="Tu rol no incluye la consulta de pagos. Pídele a un administrador que te habilite el acceso."
        />
      </AdminShell>
    );
  }

  const hayFiltros = filtroEstado !== "todos" || busquedaAplicada !== "";

  return (
    <AdminShell
      titulo="Pagos"
      breadcrumb={[{ label: "Pagos" }]}
      acciones={
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            void consulta.refetch();
          }}
          aria-busy={consulta.isFetching || undefined}
        >
          <RefreshCw
            className={cn("h-4 w-4", consulta.isFetching && "animate-spin")}
            aria-hidden="true"
          />
          <span>Actualizar</span>
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Los pagos se registran ya aprobados (sin cola de validación) desde la reserva. Aquí
          consulta el historial completo, incluidos los acuses que reporta el cliente.
        </p>

        <section
          aria-label="Filtros del historial de pagos"
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filtro-estado" className="text-sm font-medium">
                <span className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Estado del pago</span>
                </span>
              </Label>
              <Select
                value={filtroEstado}
                onValueChange={(valor: string) => setFiltroEstado(valor)}
              >
                <SelectTrigger id="filtro-estado" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTROS_ESTADO.map((filtro) => (
                    <SelectItem key={filtro.valor} value={filtro.valor}>
                      {filtro.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filtro-busqueda" className="text-sm font-medium">
                <span className="flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Buscar por referencia o reserva</span>
                </span>
              </Label>
              <Input
                id="filtro-busqueda"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="ZL-884512, VJ-2026-00010…"
                autoComplete="off"
                className="h-11"
                aria-describedby="filtro-busqueda-ayuda"
              />
              <p id="filtro-busqueda-ayuda" className="text-xs text-muted-foreground">
                Con 2 caracteres o más. La búsqueda espera 300 ms antes de consultar.
              </p>
            </div>
          </div>

          {hayFiltros ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Filtros activos:</span>
              {filtroEstado !== "todos" ? (
                <button
                  type="button"
                  onClick={() => setFiltroEstado("todos")}
                  className="min-h-9 rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground"
                >
                  {`Estado: ${FILTROS_ESTADO.find((f) => f.valor === filtroEstado)?.etiqueta ?? filtroEstado}`}
                  <span className="sr-only">Quitar filtro de estado</span>
                </button>
              ) : null}
              {busquedaAplicada ? (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  className="min-h-9 rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground"
                >
                  {`Búsqueda: ${busquedaAplicada}`}
                  <span className="sr-only">Quitar búsqueda</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        <div role="status" aria-live="polite" className="sr-only">
          {consulta.isFetching
            ? "Actualizando el historial de pagos"
            : `${pagos.length} pagos en la lista`}
        </div>

        {consulta.isLoading ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            {[0, 1, 2].map((indice) => (
              <div
                key={indice}
                className="h-32 animate-pulse rounded-2xl border border-border bg-card"
              />
            ))}
          </div>
        ) : null}

        {consulta.isError ? (
          <ErrorState
            titulo="No pudimos cargar el historial de pagos"
            mensaje="Revisa tu conexión e inténtalo de nuevo."
            onReintentar={() => {
              void consulta.refetch();
            }}
          />
        ) : null}

        {!consulta.isLoading && !consulta.isError && pagos.length === 0 ? (
          <EmptyState
            variante={hayFiltros ? "sin-resultados" : "vacio"}
            titulo={
              hayFiltros
                ? "No encontramos pagos con estos filtros"
                : "Todavía no hay pagos registrados"
            }
            descripcion={
              hayFiltros
                ? "Prueba con otro estado o limpia la búsqueda para ver todo el historial."
                : "Registra los pagos desde la reserva; aparecerán aquí."
            }
            accion={
              hayFiltros
                ? {
                    etiqueta: "Limpiar filtros",
                    onClick: () => {
                      setFiltroEstado("todos");
                      setBusqueda("");
                    },
                  }
                : undefined
            }
          />
        ) : null}

        {pagos.length > 0 ? (
          <>
            {/* Móvil: lista de tarjetas (UX-21) */}
            <ul className="flex flex-col gap-3 md:hidden">
              {pagos.map((pago, indice) => (
                <FilaPagoCola
                  key={pago.id}
                  pago={pago}
                  antiguedadMin={antiguedadDe(pago)}
                  destacado={masAntiguoResaltable && indice === 0}
                />
              ))}
            </ul>

            {/* Escritorio: tabla real con encabezados de alcance (UX-22) */}
            <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Reserva</TableHead>
                    <TableHead scope="col">Titular</TableHead>
                    <TableHead scope="col">Método</TableHead>
                    <TableHead scope="col" className="text-right">
                      Esperado
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Reportado
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Diferencia
                    </TableHead>
                    <TableHead scope="col">Antigüedad</TableHead>
                    <TableHead scope="col">Estado</TableHead>
                    <TableHead scope="col">Alertas</TableHead>
                    <TableHead scope="col">
                      <span className="sr-only">Acción</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagos.map((pago, indice) => {
                    const conReserva = pago;
                    const titular = conReserva.reserva.pasajeros.find(
                      (pasajero) => pasajero.es_titular,
                    );
                    const diferencia = calcularDiferencia({
                      esperadoUsd: conReserva.reserva.saldo_usd,
                      reportado: pago.monto,
                      moneda: pago.moneda,
                      tasa: pago.tasa,
                    });
                    const destacado = masAntiguoResaltable && indice === 0;
                    return (
                      <TableRow
                        key={pago.id}
                        className={cn(destacado && "bg-amber-50 dark:bg-amber-500/10")}
                      >
                        <TableCell className="font-semibold">
                          {conReserva.reserva.codigo}
                          <span className="block text-xs font-normal text-muted-foreground">
                            {conReserva.reserva.ref_corta}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="block max-w-40 truncate">
                            {titular?.nombre || "Sin titular"}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {ETIQUETA_METODO_PAGO[pago.metodo] ?? pago.metodo}
                          <span className="block text-xs text-muted-foreground">
                            {pago.referencia}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatearMonto(conReserva.reserva.saldo_usd, "USD")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatearMonto(pago.monto, pago.moneda)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            !diferencia.hayDiferencia
                              ? "text-emerald-700 dark:text-emerald-300"
                              : diferencia.esSignificativa
                                ? "text-amber-800 dark:text-amber-200"
                                : "",
                          )}
                        >
                          {diferencia.diferencia !== null
                            ? formatearMonto(diferencia.diferencia, pago.moneda)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <Clock3
                              className="h-3.5 w-3.5 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <span>{formatRelative(pago.creado_en)}</span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <BadgePago estado={pago.estado} />
                        </TableCell>
                        <TableCell>
                          {pago.alertas.length > 0 ? (
                            <ul className="flex flex-col gap-1">
                              {pago.alertas.map((alerta) => (
                                <li
                                  key={`${alerta.codigo}-${alerta.mensaje}`}
                                  className="flex items-start gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200"
                                >
                                  <TriangleAlert
                                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span>{alerta.mensaje}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin alertas</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link
                            to="/admin/pagos/$id"
                            params={{ id: pago.id }}
                            className="inline-flex min-h-11 items-center justify-center rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                          >
                            Ver
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {consulta.hasNextPage ? (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={consulta.isFetchingNextPage}
                  aria-busy={consulta.isFetchingNextPage || undefined}
                  onClick={() => {
                    void consulta.fetchNextPage();
                  }}
                >
                  {consulta.isFetchingNextPage ? "Cargando…" : "Cargar más"}
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}
