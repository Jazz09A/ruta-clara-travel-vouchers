import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { MARCA } from "@/lib/brand";
import { esApiError } from "@/lib/domain/api";
import { EstadoBloqueante } from "@/components/publica/screens/EstadoBloqueante";
import { useTituloPantalla } from "@/components/publica/ui/hooks";

export const Route = createFileRoute("/descarga/voucher")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      t: typeof search["t"] === "string" ? search["t"] : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Descargando voucher · Ruta Clara" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DescargaVoucher,
  errorComponent: ErrorDescarga,
});

function DescargaVoucher() {
  useTituloPantalla(`Descargando voucher · ${MARCA.nombre}`);

  // La descarga real la sirve el backend (`/api/v1/public/voucher/:id/descarga`)
  // y el voucher ya entrega esa URL absoluta. Esta ruta sólo queda para enlaces
  // antiguos, que ya no son válidos.
  return <ErrorTokenInvalido />;
}

function ErrorTokenInvalido() {
  useTituloPantalla(`Enlace no válido · ${MARCA.nombre}`);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <EstadoBloqueante
          titulo="Este enlace ya no es válido"
          mensaje={
            <p>
              El enlace de descarga expiró o la reserva ya no está activa. Pide un nuevo enlace a la
              agencia.
            </p>
          }
          tono="aviso"
        />
      </div>
    </div>
  );
}

function ErrorDescarga({ error }: ErrorComponentProps) {
  useTituloPantalla(`Error de descarga · ${MARCA.nombre}`);
  console.error(error);

  let mensaje = "No pudimos preparar tu descarga. Vuelve a intentarlo desde tu reserva.";

  if (esApiError(error)) {
    if (error.codigo === "ENLACE_VENCIDO" || error.status === 410) {
      mensaje =
        "Este enlace de descarga ya expiró. Vuelve a tu reserva y solicita un nuevo enlace.";
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <EstadoBloqueante
          titulo="No pudimos descargar el voucher"
          mensaje={<p>{mensaje}</p>}
          tono="aviso"
        />
      </div>
    </div>
  );
}
