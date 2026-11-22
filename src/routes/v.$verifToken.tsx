import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Users,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { MARCA } from "@/lib/brand";
import { esApiError } from "@/lib/domain/api";
import { verificarQR } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { EstadoBloqueante } from "@/components/publica/screens/EstadoBloqueante";
import { useTituloPantalla } from "@/components/publica/ui/hooks";

export const Route = createFileRoute("/v/$verifToken")({
  head: () => ({
    meta: [
      { title: "Verificación de QR · Ruta Clara" },
      { name: "description", content: "Verificación pública de reserva para el guía." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: VerificacionQR,
  notFoundComponent: NotFoundQR,
  errorComponent: ErrorQR,
});

function VerificacionQR() {
  const { verifToken } = Route.useParams();
  useTituloPantalla(`Verificación · ${MARCA.nombre}`);

  const consulta = useQuery({
    queryKey: ["verificacion-qr", verifToken],
    queryFn: () => verificarQR(verifToken),
    retry: false,
  });

  if (consulta.isPending) {
    return <EstadoCargando />;
  }
  if (consulta.isError) {
    throw consulta.error;
  }

  const r = consulta.data;
  const datos: DatosQR = {
    codigo: r.codigo,
    titular: r.titular_parcial,
    tour: r.tour,
    fecha: formatDate(r.fecha),
    pasajeros: r.pasajeros,
    estado: estadoQR(r.estado),
  };

  return <EstadoQR datos={datos} />;
}

function estadoQR(estado: string): EstadoQR {
  switch (estado) {
    case "confirmada":
      return "CONFIRMADA";
    case "completada":
      return "COMPLETADA";
    case "cancelada":
    case "expirada":
      return "CANCELADA";
    default:
      return "CANCELADA";
  }
}

function EstadoCargando() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" aria-hidden="true" />
        <p className="mt-4 text-sm text-muted-foreground">Verificando código…</p>
      </div>
    </div>
  );
}

function EstadoQR({ datos }: { datos: DatosQR }) {
  const estadoInfo = infoEstado(datos.estado);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        {/* Icono de estado grande */}
        <div
          className={`mx-auto grid h-24 w-24 place-items-center rounded-full ${
            estadoInfo.tono === "exito"
              ? "bg-success/10 text-success"
              : estadoInfo.tono === "error"
                ? "bg-destructive/10 text-destructive"
                : "bg-warning/10 text-warning"
          }`}
        >
          {estadoInfo.icono}
        </div>

        {/* Título de estado */}
        <h1 className="mt-6 text-center text-2xl font-extrabold tracking-tight text-foreground">
          {estadoInfo.titulo}
        </h1>

        {/* Tarjeta con datos de la reserva */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="space-y-4">
            {/* Código */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Código</span>
              <span className="text-sm font-bold text-foreground">{datos.codigo}</span>
            </div>

            {/* Titular (nombre parcial) */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Titular</span>
              <span className="text-sm font-semibold text-foreground">{datos.titular}</span>
            </div>

            {/* Tour */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tour</span>
              <span className="text-sm font-semibold text-foreground">{datos.tour}</span>
            </div>

            {/* Fecha */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Fecha</span>
              <span className="text-sm font-semibold text-foreground">{datos.fecha}</span>
            </div>

            {/* Pasajeros */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-4 w-4" aria-hidden="true" />
                Pasajeros
              </span>
              <span className="text-sm font-semibold text-foreground">{datos.pasajeros}</span>
            </div>
          </div>
        </div>

        {/* Mensaje adicional según estado */}
        {estadoInfo.mensaje && (
          <p className="mt-4 text-center text-sm text-muted-foreground">{estadoInfo.mensaje}</p>
        )}

        {/* Botón de acción si aplica */}
        {estadoInfo.accion && (
          <button
            type="button"
            onClick={estadoInfo.accion.onClick}
            className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {estadoInfo.accion.etiqueta}
          </button>
        )}
      </div>
    </div>
  );
}

function NotFoundQR() {
  useTituloPantalla(`Código no encontrado · ${MARCA.nombre}`);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <EstadoBloqueante
          titulo="Código no encontrado"
          mensaje={<p>Este código de verificación no existe o ya no es válido.</p>}
          tono="aviso"
        />
      </div>
    </div>
  );
}

function ErrorQR({ error, reset }: ErrorComponentProps) {
  useTituloPantalla(`Error de verificación · ${MARCA.nombre}`);
  console.error(error);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <EstadoBloqueante
          titulo="No pudimos verificar el código"
          mensaje={
            <p>Hubo un error al verificar. Revisa tu conexión y vuelve a escanear el código QR.</p>
          }
          accion={{ etiqueta: "Reintentar", onClick: reset }}
          tono="aviso"
        />
      </div>
    </div>
  );
}

// --- Mock data para demo --------------------------------------------------

type EstadoQR = "CONFIRMADA" | "COMPLETADA" | "CANCELADA" | "REPROGRAMADA" | "FECHA_CANCELADA";

interface DatosQR {
  codigo: string;
  titular: string;
  tour: string;
  fecha: string;
  pasajeros: number;
  estado: EstadoQR;
}

type InfoEstado = {
  tono: "exito" | "error" | "warning";
  icono: React.ReactNode;
  titulo: string;
  mensaje: string;
  accion?: { etiqueta: string; onClick: () => void };
};

function infoEstado(estado: EstadoQR): InfoEstado {
  switch (estado) {
    case "CONFIRMADA":
      return {
        tono: "exito" as const,
        icono: <CheckCircle2 className="h-12 w-12" aria-hidden="true" />,
        titulo: "Reserva válida",
        mensaje: "El cliente puede abordar.",
      };
    case "COMPLETADA":
      return {
        tono: "exito" as const,
        icono: <CheckCircle2 className="h-12 w-12" aria-hidden="true" />,
        titulo: "Reserva completada",
        mensaje: "El cliente ya viajó.",
      };
    case "CANCELADA":
      return {
        tono: "error" as const,
        icono: <XCircle className="h-12 w-12" aria-hidden="true" />,
        titulo: "Reserva cancelada",
        mensaje: "Esta reserva fue cancelada. El cliente no puede abordar.",
      };
    case "REPROGRAMADA":
      return {
        tono: "warning" as const,
        icono: <Clock className="h-12 w-12" aria-hidden="true" />,
        titulo: "Reserva reprogramada",
        mensaje: "La salida cambió de fecha. Verifica la nueva fecha con el cliente.",
      };
    case "FECHA_CANCELADA":
      return {
        tono: "error" as const,
        icono: <AlertTriangle className="h-12 w-12" aria-hidden="true" />,
        titulo: "Salida cancelada",
        mensaje: "Esta salida fue cancelada por la agencia. El cliente no puede abordar.",
      };
  }
}
