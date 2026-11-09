import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Settings,
  DollarSign,
  CreditCard,
  FileText,
  MessageSquare,
  Shield,
  Tag,
  PenTool,
  Users,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/configuracion/")({
  head: () => ({
    meta: [
      { title: "Configuración · Panel" },
      { name: "description", content: "Configuración general, métodos de pago, términos y usuarios." },
    ],
  }),
  component: Configuracion,
});

const seccionesConfig = [
  {
    id: "general",
    titulo: "Configuración general",
    descripcion: "Hold, abono, retención y otros ajustes",
    icono: Settings,
    ruta: "/admin/configuracion/general",
  },
  {
    id: "tasa",
    titulo: "Tasa de cambio",
    descripcion: "Tasa USD/Bs vigente e historial",
    icono: DollarSign,
    ruta: "/admin/configuracion/tasa",
  },
  {
    id: "metodos",
    titulo: "Métodos de pago",
    descripcion: "Cuentas bancarias, Zelle, Pago Móvil",
    icono: CreditCard,
    ruta: "/admin/configuracion/metodos",
  },
  {
    id: "terminos",
    titulo: "Términos y condiciones",
    descripcion: "Versiones publicadas y editor",
    icono: FileText,
    ruta: "/admin/configuracion/terminos",
  },
  {
    id: "plantillas",
    titulo: "Plantillas de mensaje",
    descripcion: "Correos y WhatsApp automáticos",
    icono: MessageSquare,
    ruta: "/admin/configuracion/plantillas",
  },
  {
    id: "politicas",
    titulo: "Políticas de cancelación",
    descripcion: "Tramos y porcentajes de reembolso",
    icono: Shield,
    ruta: "/admin/configuracion/politicas",
  },
  {
    id: "promos",
    titulo: "Códigos promocionales",
    descripcion: "Descuentos y promociones",
    icono: Tag,
    ruta: "/admin/configuracion/promos",
  },
  {
    id: "firma",
    titulo: "Firma de la empresa",
    descripcion: "Imagen de firma digital",
    icono: PenTool,
    ruta: "/admin/configuracion/firma",
  },
  {
    id: "usuarios",
    titulo: "Usuarios y permisos",
    descripcion: "Equipo, roles y accesos",
    icono: Users,
    ruta: "/admin/configuracion/usuarios",
  },
];

function Configuracion() {
  return (
    <AdminShell
      titulo="Configuración"
      breadcrumb={[{ label: "Panel", to: "/admin" }, { label: "Configuración" }]}
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          Ajustes generales del sistema, métodos de pago y usuarios.
        </p>

        {/* Grid de secciones */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {seccionesConfig.map((seccion) => (
            <TarjetaSeccion key={seccion.id} seccion={seccion} />
          ))}
        </div>
      </div>
    </AdminShell>
  );
}

function TarjetaSeccion({ seccion }: { seccion: (typeof seccionesConfig)[0] }) {
  const Icono = seccion.icono;

  return (
    <Link
      to={seccion.ruta}
      className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icono className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-foreground">{seccion.titulo}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{seccion.descripcion}</p>
        </div>
      </div>
    </Link>
  );
}
