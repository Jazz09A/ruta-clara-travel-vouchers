import * as React from "react";
import { CircleCheckBig, Fingerprint, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import type { Firma } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Panel de **firma** de la reserva (A-07).
 *
 * Muestra los metadatos de la firma y el resultado de la verificación de
 * integridad. El estado nunca se comunica solo con color: hay icono + texto.
 */

export interface PanelFirmaProps {
  /** Firma de la reserva, si existe. */
  firma: Firma | undefined;
  className?: string | undefined;
}

export function PanelFirma({ firma, className }: PanelFirmaProps) {
  const [verImagen, setVerImagen] = React.useState(false);

  if (!firma) {
    return (
      <section
        aria-label="Firma de la reserva"
        className={cn("flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-card", className)}
      >
        <h2 className="text-sm font-bold text-foreground">Firma</h2>
        <p className="text-sm text-muted-foreground">
          El titular todavía no ha firmado los términos y condiciones.
        </p>
      </section>
    );
  }

  const alterada = firma.integridad !== "ok";

  return (
    <section
      aria-label="Firma de la reserva"
      className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground">Firma</h2>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            alterada
              ? "border-red-600/30 bg-red-500/10 text-red-800 dark:text-red-300"
              : "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
          )}
        >
          {alterada ? (
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <CircleCheckBig className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>{alterada ? "Integridad alterada" : "Integridad verificada"}</span>
        </span>
      </header>

      {alterada ? (
        <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
          La firma no coincide con el hash registrado. No confíes en este documento y pide una
          nueva firma al titular.
        </p>
      ) : null}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Firmada</dt>
          <dd className="text-sm font-medium text-foreground">{formatDateTime(firma.firmada_en)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Trazos</dt>
          <dd className="text-sm font-medium tabular-nums text-foreground">
            {String(firma.n_trazos)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Duración</dt>
          <dd className="text-sm font-medium tabular-nums text-foreground">
            {`${(firma.duracion_ms / 1000).toFixed(1)} s`}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Dirección IP</dt>
          <dd className="text-sm font-medium text-foreground">{firma.ip}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Navegador</dt>
          <dd className="truncate text-sm font-medium text-foreground">{firma.user_agent}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Versión de términos</dt>
          <dd className="truncate text-sm font-medium text-foreground">{firma.version_terminos_id}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={() => setVerImagen(true)}
        >
          <Fingerprint className="h-4 w-4" aria-hidden="true" />
          <span>Ver imagen de la firma</span>
        </Button>
        <span className="font-mono text-[11px] text-muted-foreground">
          {`hash ${firma.hash_imagen.slice(0, 16)}…`}
        </span>
      </div>

      <Dialog open={verImagen} onOpenChange={setVerImagen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Imagen de la firma</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {`Firmada el ${formatDateTime(firma.firmada_en)}. La imagen contiene datos personales.`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-40 items-center justify-center rounded-2xl border border-border bg-muted/60 p-4">
            {firma.preview ? (
              <img
                src={`data:image/png;base64,${firma.preview}`}
                alt={`Firma de la reserva ${firma.id}`}
                className="max-h-72 w-auto max-w-full object-contain"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay una imagen de la firma disponible en esta demostración.
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Consultar la firma queda registrado en la auditoría del panel.
          </p>
        </DialogContent>
      </Dialog>
    </section>
  );
}
