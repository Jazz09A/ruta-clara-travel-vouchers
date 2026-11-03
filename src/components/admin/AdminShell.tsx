import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard, Ticket, CreditCard, CalendarDays, Map, Users, BarChart3,
  Settings, ShieldCheck, Search, Bell, Menu,
} from "lucide-react";
import { useState } from "react";

const nav = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/admin", active: true },
  { label: "Reservas", icon: Ticket },
  { label: "Pagos", icon: CreditCard, badge: 7 },
  { label: "Salidas", icon: CalendarDays },
  { label: "Tours", icon: Map },
  { label: "Clientes", icon: Users },
];
const bottom = [
  { label: "Reportes", icon: BarChart3 },
  { label: "Configuración", icon: Settings },
  { label: "Auditoría", icon: ShieldCheck },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-8 flex items-center gap-2 px-2 pt-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand">
            <span className="h-3 w-3 rounded-full bg-chart-2" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">FULLDAY<span className="text-primary">CRM</span></span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((n) => (
            <button
              key={n.label}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${n.active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}
            >
              <n.icon className={`h-4 w-4 ${n.active ? "text-primary" : ""}`} />
              {n.label}
              {n.badge && (
                <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{n.badge}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="flex flex-col gap-1 border-t border-sidebar-border pt-4">
          {bottom.map((n) => (
            <button key={n.label} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent">
              <n.icon className="h-4 w-4" /> {n.label}
            </button>
          ))}
          <Link to="/r/$token" params={{ token: "demo" }} className="mt-2 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground">
            Ver formulario del cliente →
          </Link>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:px-8">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Menú"><Menu className="h-5 w-5" /></button>
          <div className="ml-auto flex w-full max-w-sm items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            <Search className="h-4 w-4" /> <span className="flex-1">Buscar reserva, cliente…</span>
            <kbd className="hidden rounded bg-muted px-1.5 text-xs sm:block">⌘K</kbd>
          </div>
          <button className="relative grid h-9 w-9 place-items-center rounded-xl border border-border bg-card" aria-label="Notificaciones">
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-chart-2" />
          </button>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-primary-foreground">MA</div>
        </header>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
