import { useId, useMemo } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface PaisTelefono {
  codigo: string;
  nombre: string;
  prefijo: string;
}

/**
 * Países frecuentes para una agencia who's en Venezuela. El selector es
 * extensible: el cliente siempre ve el prefijo internacional (Spec §3.2).
 */
export const PAISES_TELEFONO: PaisTelefono[] = [
  { codigo: "VE", nombre: "Venezuela", prefijo: "58" },
  { codigo: "CO", nombre: "Colombia", prefijo: "57" },
  { codigo: "EC", nombre: "Ecuador", prefijo: "593" },
  { codigo: "PE", nombre: "Perú", prefijo: "51" },
  { codigo: "CL", nombre: "Chile", prefijo: "56" },
  { codigo: "AR", nombre: "Argentina", prefijo: "54" },
  { codigo: "US", nombre: "Estados Unidos", prefijo: "1" },
  { codigo: "ES", nombre: "España", prefijo: "34" },
];

export const PAIS_TELEFONO_POR_DEFECTO: PaisTelefono = {
  codigo: "VE",
  nombre: "Venezuela",
  prefijo: "58",
};

export interface PhoneInputProps {
  id?: string | undefined;
  /** Número completo en formato E.164, por ejemplo `+584121234567`. */
  valor: string;
  onChange: (valor: string) => void;
  onBlur?: (() => void) | undefined;
  etiqueta?: string | undefined;
  ayuda?: string | undefined;
  error?: string | undefined;
  requerido?: boolean | undefined;
  deshabilitado?: boolean | undefined;
  className?: string | undefined;
}

function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** Separa el prefijo del país del número nacional (prefijo más largo primero). */
function descomponer(valor: string): { pais: PaisTelefono; nacional: string } {
  const digitos = soloDigitos(valor);
  let elegido: PaisTelefono = PAIS_TELEFONO_POR_DEFECTO;
  for (const pais of PAISES_TELEFONO) {
    if (digitos.startsWith(pais.prefijo) && pais.prefijo.length > elegido.prefijo.length) {
      elegido = pais;
    }
  }
  return { pais: elegido, nacional: digitos.slice(elegido.prefijo.length) };
}

/**
 * Teléfono con selector de país (C-05 / Spec §3.2).
 *
 * El valor vive siempre como E.164 (`+584121234567`) para que el servidor
 * reciba un dato único; lo que se escribe se va normalizando al vuelo.
 */
export function PhoneInput({
  id,
  valor,
  onChange,
  onBlur,
  etiqueta,
  ayuda,
  error,
  requerido,
  deshabilitado,
  className,
}: PhoneInputProps) {
  const generado = useId();
  const idFinal = id ?? generado;
  const { pais, nacional } = useMemo(() => descomponer(valor), [valor]);

  const descritoPor =
    [ayuda ? `${idFinal}-ayuda` : null, error ? `${idFinal}-error` : null]
      .filter((v): v is string => v !== null)
      .join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {etiqueta ? (
        <label htmlFor={`${idFinal}-numero`} className="text-sm font-semibold text-foreground">
          {etiqueta}
          {requerido === false ? (
            <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>
          ) : null}
        </label>
      ) : null}

      <div className="flex gap-2">
        <Select
          value={pais.codigo}
          disabled={deshabilitado}
          onValueChange={(codigo: string) => {
            const nuevo = PAISES_TELEFONO.find((p) => p.codigo === codigo);
            if (!nuevo) return;
            onChange(`+${nuevo.prefijo}${nacional}`);
          }}
        >
          <SelectTrigger
            aria-label="País del teléfono"
            className="w-[9.5rem] shrink-0"
            disabled={deshabilitado}
          >
            <SelectValue>{`+${pais.prefijo}`}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PAISES_TELEFONO.map((p) => (
              <SelectItem key={p.codigo} value={p.codigo}>
                {`+${p.prefijo} · ${p.nombre}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          id={`${idFinal}-numero`}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="412 1234567"
          className="h-11 text-base"
          value={nacional}
          disabled={deshabilitado}
          aria-invalid={error ? true : undefined}
          aria-required={requerido ? true : undefined}
          aria-describedby={descritoPor}
          onChange={(evento) => {
            const digitos = soloDigitos(evento.target.value).slice(0, 15);
            onChange(`+${pais.prefijo}${digitos}`);
          }}
          onBlur={onBlur}
        />
      </div>

      {ayuda ? (
        <p id={`${idFinal}-ayuda`} className="text-xs leading-relaxed text-muted-foreground">
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p id={`${idFinal}-error`} className="text-xs font-medium leading-relaxed text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
