import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  MoreVertical,
  ShoppingCart,
  Wallet,
  Bus,
  Clock,
  TrendingUp,
  Users,
  MessageSquare,
  Calendar,
  Plus,
  LoaderCircle,
} from "lucide-react";
import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { api } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/format";
import { useSesion } from "@/components/admin/sesion";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Panel de reservas" },
      { name: "description", content: "Resumen de reservas, pagos y salidas de la agencia." },
      { property: "og:title", content: "Dashboard · Panel de reservas" },
      {
        property: "og:description",
        content: "Resumen de reservas, pagos y salidas de la agencia.",
      },
    ],
  }),
  component: Dashboard,
});

type Seg = { label: string; value: number; color: string; dot: string };

function Gauge({ segs, icon: Icon }: { segs: Seg[]; icon: typeof Bus }) {
  const total = segs.reduce((a, s) => a + s.value, 0);
  const r = 52,
    c = Math.PI * r,
    gap = 3;
  let acc = 0;
  return (
    <div className="relative h-[80px] w-[140px] shrink-0">
      <svg viewBox="0 0 140 80" className="h-full w-full">
        {segs.map((s) => {
          const len = (s.value / total) * c;
          const el = (
            <path
              key={s.label}
              d="M 18 70 A 52 52 0 0 1 122 70"
              fill="none"
              stroke={s.color}
              strokeWidth="16"
              strokeDasharray={`${Math.max(len - gap, 0)} ${c}`}
              strokeDashoffset={-acc}
            />
          );
          acc += len;
          return el;
        })}
        <path d="M 38 70 A 32 32 0 0 1 102 70" fill="var(--accent)" />
      </svg>
      <Icon className="absolute bottom-1 left-1/2 h-6 w-6 -translate-x-1/2 text-primary" />
    </div>
  );
}

const segsOf = (v: [number, number, number, number]): Seg[] => [
  { label: "Full Day", value: v[0], color: "var(--chart-1)", dot: "bg-chart-1" },
  { label: "Fin de semana", value: v[1], color: "var(--chart-2)", dot: "bg-chart-2" },
  { label: "Grupos", value: v[2], color: "var(--chart-3)", dot: "bg-chart-3" },
  { label: "Promo", value: v[3], color: "var(--chart-4)", dot: "bg-chart-4" },
];

const MESES_CORTOS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function Dashboard() {
  const [range, setRange] = useState("30 días");
  const { usuario } = useSesion();

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.admin.dashboard(),
  });

  // Calcular KPIs dinámicamente desde los datos de la API
  const kpis = dashboardData
    ? [
        {
          title: "Reservas",
          value: dashboardData.reservas_por_estado.reduce((acc, r) => acc + r.total, 0).toString(),
          delta: "+0%",
          icon: ShoppingCart,
          segs: segsOf([
            dashboardData.reservas_por_estado.find((r) => r.estado === "confirmada")?.total ?? 0,
            dashboardData.reservas_por_estado.find((r) => r.estado === "en_registro")?.total ?? 0,
            dashboardData.reservas_por_estado.find((r) => r.estado === "completada")?.total ?? 0,
            dashboardData.reservas_por_estado.find((r) => r.estado === "pendiente_pago")?.total ??
              0,
          ]),
        },
        {
          title: "Ingresos",
          value: `$${Number.parseFloat(dashboardData.ingresos_mes_usd).toLocaleString("es-VE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
          delta: "+0%",
          icon: Wallet,
          segs: segsOf([
            Math.round(Number.parseFloat(dashboardData.ingresos_mes_usd) * 0.5),
            Math.round(Number.parseFloat(dashboardData.ingresos_mes_usd) * 0.25),
            Math.round(Number.parseFloat(dashboardData.ingresos_mes_usd) * 0.15),
            Math.round(Number.parseFloat(dashboardData.ingresos_mes_usd) * 0.1),
          ]),
        },
        {
          title: "Pasajeros",
          value: dashboardData.ocupacion_proximas
            .reduce((acc, o) => acc + o.vendidos, 0)
            .toString(),
          delta: "+0%",
          icon: Users,
          segs: segsOf([
            Math.round(
              dashboardData.ocupacion_proximas.reduce((acc, o) => acc + o.vendidos, 0) * 0.3,
            ),
            Math.round(
              dashboardData.ocupacion_proximas.reduce((acc, o) => acc + o.vendidos, 0) * 0.45,
            ),
            Math.round(
              dashboardData.ocupacion_proximas.reduce((acc, o) => acc + o.vendidos, 0) * 0.15,
            ),
            Math.round(
              dashboardData.ocupacion_proximas.reduce((acc, o) => acc + o.vendidos, 0) * 0.1,
            ),
          ]),
        },
        {
          title: "Pagos por validar",
          value: dashboardData.pagos_por_verificar[0]?.total.toString() ?? "0",
          delta:
            dashboardData.pagos_por_verificar[0]?.mas_antiguo_min &&
            dashboardData.pagos_por_verificar[0].mas_antiguo_min > 0
              ? `${dashboardData.pagos_por_verificar[0].mas_antiguo_min} min`
              : "0",
          icon: Clock,
          segs: segsOf([
            Math.round((dashboardData.pagos_por_verificar[0]?.total ?? 0) * 0.4),
            Math.round((dashboardData.pagos_por_verificar[0]?.total ?? 0) * 0.3),
            Math.round((dashboardData.pagos_por_verificar[0]?.total ?? 0) * 0.2),
            Math.round((dashboardData.pagos_por_verificar[0]?.total ?? 0) * 0.1),
          ]),
        },
      ]
    : [];

  const salidas =
    dashboardData?.ocupacion_proximas.slice(0, 3).map((o) => ({
      hora: formatTime(o.hora),
      tour: o.tour,
      fecha: formatDate(o.fecha),
      pax: o.vendidos,
      cupo: o.total,
      pend: o.retenidos,
    })) ?? [];

  const atencion = dashboardData?.requiere_atencion.slice(0, 4) ?? [];

  return (
    <AdminShell
      titulo="Inicio"
      breadcrumb={[{ label: "Panel" }]}
      acciones={
        <Link
          to="/admin/reservas/nueva"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nueva reserva
        </Link>
      }
    >
      <p className="mb-6 text-sm font-semibold text-foreground">
        {usuario?.nombre ? `Bienvenido, ${usuario.nombre.split(" ")[0]}` : "Bienvenido"}
      </p>
      <p className="-mt-4 mb-6 text-sm text-muted-foreground">
        Resumen de reservas y actividad de la agencia
      </p>
      <div className="mb-4 flex items-center gap-1 rounded-xl border border-border bg-card p-1 text-sm lg:hidden">
        {["12 meses", "30 días", "7 días", "Hoy"].map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-lg px-3 py-1.5 font-semibold ${range === r ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}
          >
            {r}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {kpis.map((k) => (
              <div key={k.title} className="rounded-2xl bg-card p-5 shadow-card">
                <div className="flex items-start gap-5">
                  <Gauge segs={k.segs} icon={k.icon} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{k.title}</p>
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="mt-1 flex items-baseline gap-3">
                      <span className="text-3xl font-extrabold text-primary">{k.value}</span>
                      <span className="flex items-center gap-1 text-sm font-semibold text-success">
                        <TrendingUp className="h-4 w-4" /> {k.delta}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {k.segs.map((s) => (
                    <span
                      key={s.label}
                      className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-xs font-semibold"
                    >
                      <span className={`h-2 w-2 rounded-full ${s.dot}`} /> {s.label}
                      <span className="text-muted-foreground">{s.value.toLocaleString("es")}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <div className="rounded-2xl bg-card p-5 shadow-card xl:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold">Estadísticas de reservas</h2>
                <span className="text-xs text-muted-foreground">Últimos 12 meses</span>
              </div>
              <VentasPorMes datos={dashboardData?.ventas_por_mes ?? []} />
            </div>

            <div className="rounded-2xl bg-card p-5 shadow-card">
              <h2 className="mb-4 font-bold">Requiere atención</h2>
              <div className="flex flex-col gap-3">
                {atencion.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Todo al día</p>
                ) : (
                  atencion.map((a) => {
                    const esReserva = a.tipo === "pago" || a.tipo === "reserva";
                    const clase =
                      "flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-accent/50";
                    const contenido = (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{a.titulo}</p>
                          <p className="truncate text-xs text-muted-foreground">{a.detalle}</p>
                        </div>
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${a.severidad === "alta" ? "bg-destructive" : a.severidad === "media" ? "bg-warning" : "bg-muted-foreground"}`}
                        />
                      </>
                    );
                    return esReserva ? (
                      <Link
                        key={a.id}
                        to="/admin/reservas/$id"
                        params={{ id: a.entidad_id }}
                        className={clase}
                      >
                        {contenido}
                      </Link>
                    ) : (
                      <div key={a.id} className={clase}>
                        {contenido}
                      </div>
                    );
                  })
                )}
                <Link
                  to="/admin/pagos"
                  className="rounded-xl bg-brand py-2.5 text-center text-sm font-semibold text-primary-foreground"
                >
                  Ir a la cola de pagos
                </Link>
              </div>
            </div>
          </div>

          <h2 className="mb-3 mt-8 font-bold">Próximas salidas</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {salidas.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-3 text-center py-4">
                No hay próximas salidas programadas
              </p>
            ) : (
              salidas.map((s) => (
                <div
                  key={s.tour}
                  className="rounded-2xl border border-primary/15 bg-accent/60 p-4 shadow-card backdrop-blur"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-card px-2 py-0.5 text-xs font-semibold text-primary">
                      {s.fecha}
                    </span>
                    <MoreVertical className="h-4 w-4 text-primary" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-primary">{s.hora}</p>
                  <p className="text-lg font-extrabold leading-tight text-primary">{s.tour}</p>
                  <div className="mt-3 h-1.5 rounded-full bg-card">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(s.pax / s.cupo) * 100}%` }}
                    />
                  </div>
                  <div className="mt-3 flex gap-2 text-xs font-semibold text-primary">
                    <span className="flex items-center gap-1 rounded-md bg-card px-2 py-1">
                      <Users className="h-3 w-3" />
                      {s.pax}/{s.cupo}
                    </span>
                    <span className="flex items-center gap-1 rounded-md bg-card px-2 py-1">
                      <MessageSquare className="h-3 w-3" />
                      {s.pend} pend.
                    </span>
                    <span className="flex items-center gap-1 rounded-md bg-card px-2 py-1">
                      <Calendar className="h-3 w-3" />
                      Manifiesto
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </AdminShell>
  );
}

/** Ventas aprobadas por mes (últimos 12 meses, datos reales del backend). */
function VentasPorMes({
  datos,
}: {
  datos: { mes: string; total_usd: string; reservas: number }[];
}) {
  const maximo = Math.max(1, ...datos.map((d) => Number(d.total_usd)));
  return (
    <div className="flex h-56 items-end gap-2">
      {datos.map((d) => {
        const pct = Math.max((Number(d.total_usd) / maximo) * 100, 4);
        const mesLabel = MESES_CORTOS[Number(d.mes.slice(5, 7)) - 1] ?? d.mes;
        return (
          <div
            key={d.mes}
            className="group relative flex h-full flex-1 flex-col justify-end"
            title={`${d.mes}: $${Number(d.total_usd).toLocaleString("es-VE")} · ${d.reservas} reservas`}
          >
            <div
              className="w-full rounded-t-md bg-chart-1 transition-opacity group-hover:opacity-80"
              style={{ height: `${pct}%` }}
            />
            <span className="mt-1 text-center text-[10px] text-muted-foreground">{mesLabel}</span>
          </div>
        );
      })}
    </div>
  );
}
