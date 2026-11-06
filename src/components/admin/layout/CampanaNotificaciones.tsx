import { useQuery } from "@tanstack/react-query";
import { Bell, CalendarDays, CreditCard, Info, Ticket, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { useNavegarAdmin } from "@/components/admin/auth/sesion";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatRelative } from "@/lib/format";
import { api } from "@/lib/api";
import type { Notificacion, TipoNotificacion } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Campana de notificaciones (Spec §9.1).
 *
 * Contador de no leídas, lista agrupada por tipo y «Marcar como leída».
 * Al hacer clic se lleva a la sección de la entidad.
 */

const ETIQUETA_TIPO: Record<TipoNotificacion, string> = {
  pago: "Pagos",
  reserva: "Reservas",
  salida: "Salidas",
  sistema: "Sistema",
};

const ICONO_TIPO: Record<TipoNotificacion, LucideIcon> = {
  pago: CreditCard,
  reserva: Ticket,
  salida: CalendarDays,
  sistema: Info,
};

const RUTA_TIPO: Record<TipoNotificacion, string> = {
  pago: "/admin/pagos",
  reserva: "/admin/reservas",
  salida: "/admin/salidas",
  sistema: "/admin",
};

const ORDEN_TIPOS: TipoNotificacion[] = ["pago", "reserva", "salida", "sistema"];

export function CampanaNotificaciones() {
  const navegar = useNavegarAdmin();
  const [abierto, setAbierto] = useState(false);
  const [leidasLocal, setLeidasLocal] = useState<Record<string, boolean>>({});

  const consulta = useQuery({
    queryKey: ["admin", "notificaciones"],
    queryFn: () => api.admin.notificaciones(),
    staleTime: 60_000,
    retry: 1,
  });

  const notificaciones = useMemo<Notificacion[]>(
    () =>
      (consulta.data ?? []).map((notificacion) => ({
        ...notificacion,
        leida: notificacion.leida || leidasLocal[notificacion.id] === true,
      })),
    [consulta.data, leidasLocal],
  );

  const sinLeer = notificaciones.filter((notificacion) => !notificacion.leida).length;

  const grupos = useMemo(() => {
    return ORDEN_TIPOS.map((tipo) => ({
      tipo,
      items: notificaciones.filter((notificacion) => notificacion.tipo === tipo),
    })).filter((grupo) => grupo.items.length > 0);
  }, [notificaciones]);

  function marcarTodas() {
    const nuevas: Record<string, boolean> = {};
    notificaciones.forEach((notificacion) => {
      nuevas[notificacion.id] = true;
    });
    setLeidasLocal(nuevas);
  }

  function abrir(notificacion: Notificacion) {
    setLeidasLocal((previo) => ({ ...previo, [notificacion.id]: true }));
    setAbierto(false);
    const destino = notificacion.entidad_id
      ? `${RUTA_TIPO[notificacion.tipo]}?id=${encodeURIComponent(notificacion.entidad_id)}`
      : RUTA_TIPO[notificacion.tipo];
    navegar(destino);
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative min-h-11 min-w-11"
          aria-label={
            sinLeer > 0 ? `Notificaciones (${sinLeer} sin leer)` : "Notificaciones"
          }
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {sinLeer > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
              {sinLeer > 99 ? "99+" : sinLeer}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-bold">Notificaciones</p>
          <button
            type="button"
            onClick={marcarTodas}
            disabled={sinLeer === 0}
            className="rounded text-xs font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-50"
          >
            Marcar como leída
          </button>
        </div>

        <div aria-live="polite" className="max-h-[60vh] overflow-y-auto">
          {consulta.isPending ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : consulta.isError ? (
            <div className="space-y-3 px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                No pudimos cargar las notificaciones.
              </p>
              <Button variant="outline" onClick={() => void consulta.refetch()}>
                Reintentar
              </Button>
            </div>
          ) : grupos.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No hay notificaciones por ahora.
            </p>
          ) : (
            grupos.map((grupo) => {
              const Icono = ICONO_TIPO[grupo.tipo];
              return (
                <section key={grupo.tipo}>
                  <h3 className="flex items-center gap-2 bg-muted/50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    <Icono className="h-3.5 w-3.5" aria-hidden="true" />
                    {ETIQUETA_TIPO[grupo.tipo]}
                  </h3>
                  <ul>
                    {grupo.items.map((notificacion) => (
                      <li key={notificacion.id}>
                        <button
                          type="button"
                          onClick={() => abrir(notificacion)}
                          className={cn(
                            "flex w-full min-h-11 flex-col gap-0.5 border-b border-border/60 px-4 py-2.5 text-left hover:bg-muted",
                            notificacion.leida ? "opacity-60" : "",
                          )}
                        >
                          <span className="text-sm font-semibold text-foreground">
                            {notificacion.titulo}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {notificacion.detalle}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatRelative(notificacion.fecha)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
