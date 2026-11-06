import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  LayoutDashboard,
  QrCode,
  ScanLine,
  Smartphone,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ruta Clara · Demo del sistema de reservas" },
      {
        name: "description",
        content:
          "Demo local del CRM de reservas de Ruta Clara: panel administrativo y formulario público del cliente.",
      },
    ],
  }),
  component: Portada,
});

interface EnlaceDemo {
  etiqueta: string;
  descripcion: string;
  to: string;
  tono: "normal" | "alerta";
}

const CLIENTE: EnlaceDemo[] = [
  {
    etiqueta: "Reserva nueva (bienvenida)",
    descripcion: "P-01 · el cliente empieza el registro",
    to: "/r/demo1",
    tono: "normal",
  },
  {
    etiqueta: "Continuar en Preguntas",
    descripcion: "P-04 · el cliente vuelve al enlace y retoma",
    to: "/r/demo-enregistro",
    tono: "normal",
  },
  {
    etiqueta: "Listo para firmar",
    descripcion: "P-06/P-07 · términos y firma",
    to: "/r/demo-firma",
    tono: "normal",
  },
  {
    etiqueta: "Pendiente de pago",
    descripcion: "P-08 · instrucciones y reporte de pago",
    to: "/r/demo-pago",
    tono: "normal",
  },
  {
    etiqueta: "Cupo por vencer (1 h 30)",
    descripcion: "P-08 · banner de advertencia del hold",
    to: "/r/demo-ventana",
    tono: "alerta",
  },
  {
    etiqueta: "Cupo por vencer (25 min)",
    descripcion: "P-08 · banner de urgencia con cuenta regresiva",
    to: "/r/demo-pago-urgente",
    tono: "alerta",
  },
  {
    etiqueta: "Pago en verificación",
    descripcion: "P-09 · la validación está en curso",
    to: "/r/demo-verif",
    tono: "normal",
  },
  {
    etiqueta: "Reserva confirmada",
    descripcion: "P-13 · voucher descargable",
    to: "/r/demo-confirmada",
    tono: "normal",
  },
  {
    etiqueta: "Reserva cancelada",
    descripcion: "P-12 · reserva cerrada",
    to: "/r/demo-cancelada",
    tono: "alerta",
  },
  {
    etiqueta: "Reserva expirada",
    descripcion: "P-12 · el cupo se liberó por vencer el hold",
    to: "/r/demo-expirada",
    tono: "alerta",
  },
  {
    etiqueta: "Enlace vencido",
    descripcion: "P-10 · el enlace caducó sin iniciarse",
    to: "/r/demo-enlace-vencido",
    tono: "alerta",
  },
  {
    etiqueta: "Enlace inválido",
    descripcion: "P-11 · el enlace no existe",
    to: "/r/demo-inexistente",
    tono: "alerta",
  },
];

const QR: EnlaceDemo[] = [
  {
    etiqueta: "QR válido",
    descripcion: "P-14 · reserva confirmada",
    to: "/v/qr-confirmada",
    tono: "normal",
  },
  {
    etiqueta: "QR cancelado",
    descripcion: "P-14 · el estado se ve inconfundible",
    to: "/v/qr-cancelada",
    tono: "alerta",
  },
  {
    etiqueta: "QR reprogramado",
    descripcion: "P-14 · la salida cambió de fecha",
    to: "/v/qr-reprogramada",
    tono: "normal",
  },
  {
    etiqueta: "QR no encontrado",
    descripcion: "P-14 · código inexistente",
    to: "/v/qr-inexistente",
    tono: "alerta",
  },
];

function TarjetaEnlace({ e }: { e: EnlaceDemo }) {
  return (
    <Link
      to={e.to}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
          e.tono === "alerta" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
        }`}
      >
        {e.tono === "alerta" ? (
          <TriangleAlert className="h-4 w-4" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{e.etiqueta}</span>
        <span className="block truncate text-xs text-muted-foreground">{e.descripcion}</span>
      </span>
    </Link>
  );
}

function Portada() {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-brand px-5 pb-24 pt-10 text-primary-foreground">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20">
              <span className="h-3.5 w-3.5 rounded-full bg-white" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">Ruta Clara</span>
          </div>
          <h1 className="mt-5 text-3xl font-extrabold leading-tight md:text-4xl">
            Sistema de reservas · demo local
          </h1>
          <p className="mt-2 max-w-2xl text-sm opacity-90 md:text-base">
            CRM, formularios dinámicos y reservas para una agencia de Full Days y Fines de Semana.
            Esta demo corre sin backend: toda la lógica de negocio (cupos, precios, estados,
            pagos) está simulada en el navegador.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-white/15 px-3 py-1.5">Sin backend</span>
            <span className="rounded-full bg-white/15 px-3 py-1.5">Mobile-first</span>
            <span className="rounded-full bg-white/15 px-3 py-1.5">Estado, cupos y precios del servidor</span>
          </div>
        </div>
      </div>

      <div className="mx-auto -mt-16 max-w-5xl px-4 pb-16">
        <div className="grid gap-4 md:grid-cols-2">
          <Link
            to="/admin/login"
            className="flex items-center gap-4 rounded-2xl bg-card p-5 shadow-card transition-colors hover:bg-accent/40"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <LayoutDashboard className="h-6 w-6" />
            </span>
            <span className="flex-1">
              <span className="block text-base font-bold">Panel administrativo</span>
              <span className="block text-sm text-muted-foreground">
                Reservas, pagos, salidas, tours, configuración y auditoría
              </span>
            </span>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </Link>

          <div className="flex items-center gap-4 rounded-2xl bg-card p-5 shadow-card">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </span>
            <span className="flex-1">
              <span className="block text-base font-bold">Entrar por enlace de cliente</span>
              <span className="block text-sm text-muted-foreground">
                Abre cualquiera de los escenarios de abajo
              </span>
            </span>
            <Smartphone className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>

        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <Smartphone className="h-4 w-4" /> App del cliente
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada enlace abre la app pública en un estado distinto de la reserva.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CLIENTE.map((e) => (
              <TarjetaEnlace key={e.to} e={e} />
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <ScanLine className="h-4 w-4" /> Verificación de QR
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pantalla pública que usa el guía en la calle. Nunca muestra documentos ni contacto.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {QR.map((e) => (
              <TarjetaEnlace key={e.to} e={e} />
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-card p-5 shadow-card">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h3 className="mt-2 font-bold">Cupos y hold</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              El cupo se retiene al registrar y se libera al vencer. El servidor manda: el cliente
              solo muestra.
            </p>
          </div>
          <div className="rounded-2xl bg-card p-5 shadow-card">
            <QrCode className="h-5 w-5 text-primary" />
            <h3 className="mt-2 font-bold">Formulario dinámico</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Almuerzos, alergias y extras con costo, con versionado y snapshot por reserva.
            </p>
          </div>
          <div className="rounded-2xl bg-card p-5 shadow-card">
            <TriangleAlert className="h-5 w-5 text-primary" />
            <h3 className="mt-2 font-bold">Estados claros</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Un QR cancelado no se puede confundir con uno válido: icono, texto y estructura.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
