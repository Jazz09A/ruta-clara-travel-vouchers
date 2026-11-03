import { createFileRoute } from "@tanstack/react-router";
import { MoreVertical, ShoppingCart, Wallet, Bus, Clock, TrendingUp, Users, MessageSquare, Calendar } from "lucide-react";
import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Panel de reservas" },
      { name: "description", content: "Resumen de reservas, pagos y salidas de la agencia." },
      { property: "og:title", content: "Dashboard · Panel de reservas" },
      { property: "og:description", content: "Resumen de reservas, pagos y salidas de la agencia." },
    ],
  }),
  component: Dashboard,
});

type Seg = { label: string; value: number; color: string; dot: string };

function Gauge({ segs, icon: Icon }: { segs: Seg[]; icon: typeof Bus }) {
  const total = segs.reduce((a, s) => a + s.value, 0);
  const r = 52, c = Math.PI * r, gap = 3;
  let acc = 0;
  return (
    <div className="relative h-[80px] w-[140px] shrink-0">
      <svg viewBox="0 0 140 80" className="h-full w-full">
        {segs.map((s) => {
          const len = (s.value / total) * c;
          const el = (
            <path key={s.label} d="M 18 70 A 52 52 0 0 1 122 70" fill="none" stroke={s.color} strokeWidth="16"
              strokeDasharray={`${Math.max(len - gap, 0)} ${c}`} strokeDashoffset={-acc} />
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

const kpis = [
  { title: "Reservas", value: "245", delta: "+3,4%", icon: ShoppingCart, segs: segsOf([98, 78, 44, 24]) },
  { title: "Ingresos", value: "$12.480", delta: "+8,1%", icon: Wallet, segs: segsOf([5970, 4661, 1200, 649]) },
  { title: "Pasajeros", value: "332", delta: "+1,4%", icon: Users, segs: segsOf([102, 152, 46, 33]) },
  { title: "Pagos por validar", value: "7", delta: "-2", icon: Clock, segs: segsOf([3, 2, 1, 1]) },
];

const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const bars = Array.from({ length: 48 }, (_, i) => {
  const base = 120 + Math.sin(i / 5) * 30 + i * 2.2;
  return [base * 0.5, base * 0.25, base * 0.15, base * 0.1] as [number, number, number, number];
});

const salidas = [
  { hora: "05:30", tour: "Full Day Los Roques", fecha: "Sáb 7 nov", pax: 38, cupo: 40, pend: 2 },
  { hora: "06:00", tour: "Fin de semana Mérida", fecha: "Vie 13 nov", pax: 22, cupo: 30, pend: 5 },
  { hora: "06:30", tour: "Full Day Colonia Tovar", fecha: "Dom 8 nov", pax: 41, cupo: 45, pend: 0 },
];

const pagos = [
  { cliente: "María Pérez", tour: "Los Roques", monto: "$240", metodo: "Pago móvil", hace: "12 min" },
  { cliente: "José Rodríguez", tour: "Mérida", monto: "$580", metodo: "Zelle", hace: "34 min" },
  { cliente: "Ana Gómez", tour: "Colonia Tovar", monto: "$90", metodo: "Transferencia", hace: "1 h" },
];

function Dashboard() {
  const [range, setRange] = useState("30 días");
  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Bienvenido, Manuel</h1>
          <p className="text-sm text-muted-foreground">Resumen de reservas y actividad de la agencia</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 text-sm">
          {["12 meses", "30 días", "7 días", "Hoy"].map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1.5 font-semibold ${range === r ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

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
                <span key={s.label} className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-xs font-semibold">
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
          <div className="flex h-56 items-end gap-[3px]">
            {bars.map((b, i) => (
              <div key={i} className="relative flex h-full flex-1 flex-col justify-end">
                <div className="absolute inset-x-0 bottom-0 rounded-t-sm bg-chart-5/60" style={{ height: `${(b.reduce((a, x) => a + x, 0) / 300) * 100 + 8}%` }} />
                <div className="relative bg-chart-4" style={{ height: `${(b[3] / 300) * 100}%` }} />
                <div className="relative bg-chart-3" style={{ height: `${(b[2] / 300) * 100}%` }} />
                <div className="relative bg-chart-2" style={{ height: `${(b[1] / 300) * 100}%` }} />
                <div className="relative rounded-t-sm bg-chart-1" style={{ height: `${(b[0] / 300) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            {months.map((m) => <span key={m}>{m}</span>)}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold">
            {segsOf([0, 0, 0, 0]).map((s) => (
              <span key={s.label} className="flex items-center gap-1.5"><span className={`h-2 w-4 rounded ${s.dot}`} />{s.label}</span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-card p-5 shadow-card">
          <h2 className="mb-4 font-bold">Pagos por validar</h2>
          <div className="flex flex-col gap-3">
            {pagos.map((p) => (
              <div key={p.cliente} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                  {p.cliente.split(" ").map((w) => w[0]).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.cliente}</p>
                  <p className="text-xs text-muted-foreground">{p.tour} · {p.metodo}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{p.monto}</p>
                  <p className="text-xs text-muted-foreground">{p.hace}</p>
                </div>
              </div>
            ))}
            <button className="rounded-xl bg-brand py-2.5 text-sm font-semibold text-primary-foreground">Ir a la cola de pagos</button>
          </div>
        </div>
      </div>

      <h2 className="mb-3 mt-8 font-bold">Próximas salidas</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {salidas.map((s) => (
          <div key={s.tour} className="rounded-2xl border border-primary/15 bg-accent/60 p-4 shadow-card backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-card px-2 py-0.5 text-xs font-semibold text-primary">{s.fecha}</span>
              <MoreVertical className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-3 text-sm font-bold text-primary">{s.hora}</p>
            <p className="text-lg font-extrabold leading-tight text-primary">{s.tour}</p>
            <div className="mt-3 h-1.5 rounded-full bg-card">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(s.pax / s.cupo) * 100}%` }} />
            </div>
            <div className="mt-3 flex gap-2 text-xs font-semibold text-primary">
              <span className="flex items-center gap-1 rounded-md bg-card px-2 py-1"><Users className="h-3 w-3" />{s.pax}/{s.cupo}</span>
              <span className="flex items-center gap-1 rounded-md bg-card px-2 py-1"><MessageSquare className="h-3 w-3" />{s.pend} pend.</span>
              <span className="flex items-center gap-1 rounded-md bg-card px-2 py-1"><Calendar className="h-3 w-3" />Manifiesto</span>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
