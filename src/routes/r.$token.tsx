import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, MapPin, Clock, Users, Check, ChevronRight, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/r/$token")({
  head: () => ({
    meta: [
      { title: "Completa tu reserva · Full Day" },
      { name: "description", content: "Registra a tu grupo y confirma tu reserva en minutos." },
      { property: "og:title", content: "Completa tu reserva · Full Day" },
      { property: "og:description", content: "Registra a tu grupo y confirma tu reserva en minutos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicEntry,
});

const steps = ["Titular", "Grupo", "Preguntas", "Términos", "Pago"];

function PublicEntry() {
  const [started, setStarted] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-brand px-5 pb-20 pt-8 text-primary-foreground">
        <div className="mx-auto max-w-md">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Tu reserva · #FD-2481</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight">Full Day Los Roques</h1>
          <p className="mt-1 text-sm opacity-90">Hola María, te reservamos 4 cupos. Completa tus datos para confirmar.</p>
        </div>
      </div>

      <div className="mx-auto -mt-14 max-w-md px-4 pb-10">
        <div className="rounded-2xl bg-card p-5 shadow-card">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info icon={CalendarDays} label="Fecha" value="Sáb 7 nov 2026" />
            <Info icon={Clock} label="Salida" value="05:30 a.m." />
            <Info icon={MapPin} label="Abordaje" value="Por elegir" />
            <Info icon={Users} label="Cupos" value="4 personas" />
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-accent px-4 py-3">
            <span className="text-sm font-semibold text-accent-foreground">Total a pagar</span>
            <span className="text-xl font-extrabold text-primary">$240</span>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-card p-5 shadow-card">
          <h2 className="font-bold">Pasos para confirmar</h2>
          <ol className="mt-4 flex flex-col gap-3">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${i === 0 && started ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-semibold">{s}</span>
                {i === 0 && started ? <Check className="h-4 w-4 text-success" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </li>
            ))}
          </ol>
        </div>

        {started ? (
          <form className="mt-5 flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-card" onSubmit={(e) => e.preventDefault()}>
            <h2 className="font-bold">Datos del titular</h2>
            {["Nombre y apellido", "Cédula", "Teléfono (WhatsApp)", "Correo electrónico"].map((f) => (
              <label key={f} className="flex flex-col gap-1 text-sm font-medium">
                {f}
                <input className="h-12 rounded-xl border border-input bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring" />
              </label>
            ))}
            <button className="mt-2 h-12 rounded-xl bg-brand font-semibold text-primary-foreground">Continuar</button>
          </form>
        ) : (
          <button onClick={() => setStarted(true)} className="mt-5 h-14 w-full rounded-2xl bg-brand text-base font-bold text-primary-foreground shadow-card">
            Comenzar registro
          </button>
        )}

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" /> Enlace personal y seguro. No lo compartas.
        </p>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 text-primary" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}
