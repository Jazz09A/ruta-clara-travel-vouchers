import { useQuery } from "@tanstack/react-query";
import { CreditCard, Search, Ticket, User, LoaderCircle, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useNavegarAdmin } from "@/components/admin/auth/sesion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatUsd } from "@/lib/format";
import { api } from "@/lib/api";

/**
 * Búsqueda global del panel (Spec §9.1).
 *
 * Busca reservas por nombre, teléfono, referencia interna, código, ref. corta
 * y documento exacto; clientes; y pagos por referencia. Los resultados se
 * agrupan por tipo. Atajo: `/` o `⌘K`.
 */

export interface BuscadorGlobalProps {
  abierto: boolean;
  onAbiertoCambia: (abierto: boolean) => void;
}

interface ResultadosBusqueda {
  reservas: { id: string; codigo: string; ref_corta: string; titular: string; total_usd: string }[];
  clientes: { id: string; nombre: string; documento_enmascarado: string; telefono: string }[];
  pagos: { id: string; referencia: string; monto: string; reserva: string }[];
}

const MINIMO_CARACTERES = 2;
const DEBOUNCE_MS = 300;

export function BuscadorGlobal({ abierto, onAbiertoCambia }: BuscadorGlobalProps) {
  const [texto, setTexto] = useState("");
  const [consulta, setConsulta] = useState("");
  const navegar = useNavegarAdmin();

  // Atajo de teclado: "/" o "⌘K" / "Ctrl+K".
  useEffect(() => {
    function alPulsar(evento: KeyboardEvent) {
      if (evento.key === "Escape") return;
      const destino = evento.target as HTMLElement | null;
      const etiqueta = destino?.tagName?.toLowerCase();
      const editando =
        etiqueta === "input" || etiqueta === "textarea" || destino?.isContentEditable === true;
      if (editando) return;
      if (evento.key === "/" || ((evento.metaKey || evento.ctrlKey) && evento.key.toLowerCase() === "k")) {
        evento.preventDefault();
        onAbiertoCambia(true);
      }
    }
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [onAbiertoCambia]);

  // Debounce de 300 ms.
  useEffect(() => {
    const temporizador = setTimeout(() => setConsulta(texto.trim()), DEBOUNCE_MS);
    return () => clearTimeout(temporizador);
  }, [texto]);

  const activa = consulta.length >= MINIMO_CARACTERES;

  const busqueda = useQuery({
    queryKey: ["admin", "busqueda-global", consulta],
    enabled: activa,
    staleTime: 30_000,
    queryFn: async (): Promise<ResultadosBusqueda> => {
      const [reservas, clientes, pagos] = await Promise.allSettled([
        api.admin.reservas({ busqueda: consulta, limite: 5 }),
        api.admin.clientes({ busqueda: consulta }),
        api.admin.pagos({ busqueda: consulta, limite: 5 }),
      ]);

      return {
        reservas:
          reservas.status === "fulfilled"
            ? reservas.value.items.map((reserva) => ({
                id: reserva.id,
                codigo: reserva.codigo,
                ref_corta: reserva.ref_corta,
                titular:
                  reserva.pasajeros.find((pasajero) => pasajero.es_titular)?.nombre ??
                  reserva.referencia_interna ??
                  "Sin titular",
                total_usd: reserva.total_usd,
              }))
            : [],
        clientes:
          clientes.status === "fulfilled"
            ? clientes.value.items.map((cliente) => ({
                id: cliente.id,
                nombre: cliente.nombre,
                documento_enmascarado: cliente.documento_enmascarado,
                telefono: cliente.telefono,
              }))
            : [],
        pagos:
          pagos.status === "fulfilled"
            ? pagos.value.items.map((pago) => ({
                id: pago.id,
                referencia: pago.referencia,
                monto: pago.monto,
                reserva: pago.reserva?.ref_corta ?? "",
              }))
            : [],
      };
    },
  });

  const hayResultados = useMemo(() => {
    const datos = busqueda.data;
    if (!datos) return false;
    return (
      datos.reservas.length + datos.clientes.length + datos.pagos.length > 0
    );
  }, [busqueda.data]);

  function cerrar() {
    onAbiertoCambia(false);
    setTexto("");
    setConsulta("");
  }

  function ir(destino: string) {
    cerrar();
    navegar(destino);
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => onAbiertoCambia(true)}
        aria-label="Buscar reservas, clientes y pagos"
        className="min-h-11 justify-center px-3 lg:w-72 lg:justify-start lg:gap-2 lg:px-3"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="hidden text-sm text-muted-foreground lg:inline">
          Buscar reserva, cliente…
        </span>
        <kbd className="ml-auto hidden rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground lg:inline">
          ⌘K
        </kbd>
      </Button>

      <Dialog open={abierto} onOpenChange={(valor) => (valor ? onAbiertoCambia(true) : cerrar())}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Buscar en el panel</DialogTitle>
            <DialogDescription>
              Reserva por nombre, teléfono, referencia interna, código o documento; también
              clientes y pagos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                autoFocus
                value={texto}
                onChange={(evento) => setTexto(evento.target.value)}
                placeholder="Escribe al menos 2 caracteres"
                aria-label="Buscar en el panel"
                className="h-11 pl-9"
              />
            </div>

            <div aria-live="polite" className="min-h-24">
              {!activa ? (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                  Escribe al menos 2 caracteres para buscar.
                </p>
              ) : busqueda.isPending ? (
                <p className="flex items-center justify-center gap-2 px-1 py-6 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Buscando…
                </p>
              ) : busqueda.isError ? (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                  No pudimos completar la búsqueda. Inténtalo de nuevo.
                </p>
              ) : !hayResultados ? (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                  No encontramos nada con «{consulta}».
                </p>
              ) : (
                <div className="max-h-[50vh] space-y-4 overflow-y-auto">
                  <GrupoBusqueda
                    titulo="Reservas"
                    icono={Ticket}
                    vacio={busqueda.data?.reservas.length === 0}
                  >
                    {(busqueda.data?.reservas ?? []).map((reserva) => (
                      <button
                        key={reserva.id}
                        type="button"
                        onClick={() => ir(`/admin/reservas?busqueda=${encodeURIComponent(reserva.ref_corta)}`)}
                        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{reserva.titular}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {reserva.ref_corta || reserva.codigo} · {formatUsd(reserva.total_usd)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </GrupoBusqueda>

                  <GrupoBusqueda
                    titulo="Clientes"
                    icono={User}
                    vacio={busqueda.data?.clientes.length === 0}
                  >
                    {(busqueda.data?.clientes ?? []).map((cliente) => (
                      <button
                        key={cliente.id}
                        type="button"
                        onClick={() => ir(`/admin/clientes?busqueda=${encodeURIComponent(cliente.nombre)}`)}
                        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{cliente.nombre}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {cliente.documento_enmascarado} · {cliente.telefono}
                          </span>
                        </span>
                      </button>
                    ))}
                  </GrupoBusqueda>

                  <GrupoBusqueda
                    titulo="Pagos"
                    icono={CreditCard}
                    vacio={busqueda.data?.pagos.length === 0}
                  >
                    {(busqueda.data?.pagos ?? []).map((pago) => (
                      <button
                        key={pago.id}
                        type="button"
                        onClick={() => ir(`/admin/pagos?busqueda=${encodeURIComponent(pago.referencia)}`)}
                        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{pago.referencia}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {pago.reserva ? `${pago.reserva} · ` : ""}
                            {formatUsd(pago.monto)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </GrupoBusqueda>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GrupoBusqueda({
  titulo,
  icono: Icono,
  vacio,
  children,
}: {
  titulo: string;
  icono: LucideIcon;
  vacio: boolean;
  children: ReactNode;
}) {
  if (vacio) return null;
  return (
    <section>
      <h3 className="mb-1 flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Icono className="h-3.5 w-3.5" aria-hidden="true" />
        {titulo}
      </h3>
      <div className="flex flex-col gap-0.5">{children}</div>
    </section>
  );
}
