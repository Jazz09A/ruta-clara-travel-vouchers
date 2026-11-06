import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";

import { tienePermiso, type Permiso } from "@/lib/domain/types";
import { useSesion } from "@/components/admin/auth/sesion";

export function usePermisoAdmin(permiso: Permiso): boolean {
  const { usuario } = useSesion();
  if (!usuario) return true;
  return tienePermiso(usuario.rol, permiso);
}

export interface SinPermisoProps {
  permiso: Permiso;
  accion?: string | undefined;
}

export function SinPermiso({ permiso, accion }: SinPermisoProps) {
  const { usuario } = useSesion();
  const rol = usuario?.rol ?? null;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-semibold">No tienes permiso para esta sección</p>
        <p className="text-sm leading-relaxed">
          {accion
            ? `Tu rol (${rol ?? "sin sesión"}) no puede ${accion}. Pídeselo a un superadministrador si necesitas acceso.`
            : `Tu rol (${rol ?? "sin sesión"}) no tiene el permiso «${permiso}».`}
        </p>
      </div>
    </div>
  );
}

export function useCargaInicial(isPending: boolean, hayDatos: boolean): boolean {
  return React.useMemo(() => isPending && !hayDatos, [isPending, hayDatos]);
}

export function normalizarBusqueda(texto: string): string {
  return texto.trim().toLowerCase();
}

export function pareceDocumento(texto: string): boolean {
  const limpio = texto.replace(/\D/g, "");
  return limpio.length >= 5 && limpio === texto.trim();
}

export function descargarTexto(nombre: string, contenido: string, tipo = "text/csv;charset=utf-8"): void {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

export function escaparCsv(valor: string): string {
  if (/[",\n;]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

export function aCsv(encabezados: string[], filas: string[][]): string {
  const lineas = [encabezados.map(escaparCsv).join(",")];
  for (const fila of filas) {
    lineas.push(fila.map(escaparCsv).join(","));
  }
  return lineas.join("\n");
}
