import * as React from "react";
import { TriangleAlert } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface PaisTelefono {
  /** Codigo de pais sin signo, tal como lo usa E.164 (p. ej. `58`). */
  codigo: string;
  /** Prefijo con signo (p. ej. `+58`). */
  prefijo: string;
  /** Nombre del pais en espanol. */
  nombre: string;
}

/** Paises frecuentes de la agencia (Spec 3.2). */
export const PAISES_TELEFONO: PaisTelefono[] = [
  { codigo: "58", prefijo: "+58", nombre: "Venezuela" },
  { codigo: "57", prefijo: "+57", nombre: "Colombia" },
  { codigo: "51", prefijo: "+51", nombre: "Peru" },
  { codigo: "593", prefijo: "+593", nombre: "Ecuador" },
  { codigo: "56", prefijo: "+56", nombre: "Chile" },
  { codigo: "54", prefijo: "+54", nombre: "Argentina" },
  { codigo: "34", prefijo: "+34", nombre: "Espana" },
  { codigo: "52", prefijo: "+52", nombre: "Mexico" },
  { codigo: "1", prefijo: "+1", nombre: "Estados Unidos" },
];

const PAIS_POR_DEFECTO = PAISES_TELEFONO[0] as PaisTelefono;

/** Detecta el pais a partir de un numero con prefijo internacional. */
export function detectarPais(valor: string): PaisTelefono | null {
  const digitos = (valor || "").replace(/\D/g, "");
  if (!digitos) return null;

  // Se prueba el prefijo mas largo primero (p. ej. `593` antes que `58`).
  const candidatos = [...PAISES_TELEFONO].sort((a, b) => b.codigo.length - a.codigo.length);
  for (const pais of candidatos) {
    if (digitos.startsWith(pais.codigo)) return pais;
  }
  return null;
}

export interface PhoneInputProps {
  /** Telefono en formato E.164 (p. ej. `+584121234567`). */
  value: string;
  /** Se llama con el telefono en E.164. */
  onChange: (valorE164: string) => void;
  /** Etiqueta del campo. */
  label?: string | undefined;
  /** `id` del input. */
  htmlFor?: string | undefined;
  /** Texto de ayuda bajo el campo. */
  ayuda?: string | undefined;
  /** Error en lenguaje de persona. */
  error?: string | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  name?: string | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
}

/**
 * C-05 · Telefono con selector de pais.
 *
 * El `onChange` entrega siempre el numero en E.164 (`+584121234567`). Pegar un
 * numero con prefijo internacional cambia solo el pais y el numero se reparte
 * entre el selector y el campo (Spec 3.2).
 */
export function PhoneInput({
  value,
  onChange,
  label,
  htmlFor = "telefono",
  ayuda,
  error,
  disabled = false,
  required = false,
  name,
  placeholder = "412 1234567",
  className,
}: PhoneInputProps) {
  const [codigoPais, setCodigoPais] = React.useState<string>(
    () => detectarPais(value)?.codigo ?? PAIS_POR_DEFECTO.codigo,
  );

  // Si el valor cambia desde fuera (precarga del servidor), se sincroniza el pais.
  React.useEffect(() => {
    const detectado = detectarPais(value);
    if (detectado && detectado.codigo !== codigoPais) {
      setCodigoPais(detectado.codigo);
    }
    // Solo reacciona a cambios del valor externo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const pais =
    PAISES_TELEFONO.find((p) => p.codigo === codigoPais) ?? (PAIS_POR_DEFECTO as PaisTelefono);

  const digitos = (value || "").replace(/\D/g, "");
  const tienePrefijo = (value || "").trim().startsWith("+");
  const numeroNacional = tienePrefijo ? digitos.slice(pais.codigo.length) : digitos;

  const manejarCambioPais = React.useCallback(
    (nuevoCodigo: string) => {
      setCodigoPais(nuevoCodigo);
      const nacional = tienePrefijo ? digitos.slice(pais.codigo.length) : digitos;
      onChange(nuevoCodigo ? `+${nuevoCodigo}${nacional}` : nacional);
    },
    [digitos, onChange, pais.codigo, tienePrefijo],
  );

  const manejarCambioNumero = React.useCallback(
    (bruto: string) => {
      const soloDigitos = bruto.replace(/\D/g, "");
      let codigo = pais.codigo;
      let nacional = soloDigitos;

      // Si el usuario pega un numero internacional completo, se respeta su pais.
      if (bruto.trim().startsWith("+")) {
        const detectado = detectarPais(bruto);
        if (detectado) {
          codigo = detectado.codigo;
          nacional = soloDigitos.slice(codigo.length);
          if (codigo !== pais.codigo) setCodigoPais(codigo);
        }
      }

      onChange(nacional ? `+${codigo}${nacional}` : "");
    },
    [onChange, pais.codigo],
  );

  const idAyuda = React.useId();
  const idError = React.useId();
  const descritos = [ayuda ? idAyuda : null, error ? idError : null]
    .filter((valor): valor is string => valor !== null)
    .join(" ");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
          {!required ? (
            <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>
          ) : null}
        </Label>
      ) : null}

      <div className="flex items-stretch gap-2">
        <Select value={pais.codigo} onValueChange={manejarCambioPais} disabled={disabled}>
          <SelectTrigger
            className="h-11 w-[112px] shrink-0"
            aria-label="Codigo de pais del telefono"
          >
            <SelectValue>{pais.prefijo}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PAISES_TELEFONO.map((opcion) => (
              <SelectItem key={opcion.codigo} value={opcion.codigo}>
                {opcion.prefijo} · {opcion.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          id={htmlFor}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={numeroNacional}
          onChange={(evento) => manejarCambioNumero(evento.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={descritos || undefined}
          className={cn("h-11 flex-1", error && "border-red-500 focus-visible:ring-red-500")}
        />
      </div>

      {ayuda ? (
        <p id={idAyuda} className="text-xs leading-snug text-muted-foreground">
          {ayuda}
        </p>
      ) : null}

      {error ? (
        <p
          id={idError}
          className="flex items-start gap-1.5 text-xs leading-snug text-red-700 dark:text-red-300"
        >
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
