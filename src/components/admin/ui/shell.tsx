import type { ComponentProps, ReactNode } from "react";

import { AdminShell } from "@/components/admin/AdminShell";

import { Encabezado } from "./encabezado";

export interface ShellAdminProps {
  /** Título de la pantalla (lo renderiza la cabecera del panel). */
  titulo: string;
  /** Texto de apoyo bajo el título. */
  descripcion?: ReactNode;
  /** Acciones de la cabecera. */
  acciones?: ReactNode;
  /** Ruta de migas de pan (la renderiza `CabeceraAdmin`). */
  breadcrumb?: { label: string; to?: string }[];
  children: ReactNode;
}

/**
 * Envoltura del panel administrativo.
 *
 * Concentra en un solo punto el contacto con `AdminShell` y delega en él la
 * cabecera (título, migas y foco al entrar, Spec 3.9); añade la descripción de
 * apoyo y las acciones de la pantalla.
 */
export function ShellAdmin({
  titulo,
  descripcion,
  acciones,
  breadcrumb,
  children,
}: ShellAdminProps) {
  const props = { titulo, acciones, breadcrumb } as unknown as ComponentProps<typeof AdminShell>;

  return (
    <AdminShell {...props}>
      <Encabezado descripcion={descripcion} />
      {children}
    </AdminShell>
  );
}
