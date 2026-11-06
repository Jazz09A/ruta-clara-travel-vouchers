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
import { edadEn } from "@/lib/format";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** Numero de dias de un mes, considerando anos bisiestos. */
export function diasDelMes(mes: number, anio: number): number {
  if (mes === 2) {
    const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
    return bisiesto ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(mes)) return 30;
  return 31;
}

function completar(valor: number): string {
  return String(valor).padStart(2, "0");
}

/** Fecha de hoy segun el calendario que ve el usuario (`YYYY-MM-DD`). */
function hoyIso(): string {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${completar(ahora.getMonth() + 1)}-${completar(ahora.getDate())}`;
}

function descomponer(iso: string): { dia: number; mes: number; anio: number } {
  const [anio = "", mes = "", dia = ""] = (iso || "").split("-");
  return {
    dia: Number.parseInt(dia, 10) || 0,
    mes: Number.parseInt(mes, 10) || 0,
    anio: Number.parseInt(anio, 10) || 0,
  };
}

export interface BirthDateInputProps {
  /** Fecha de nacimiento en `YYYY-MM-DD`. */
  value: string;
  /** Se llama con la fecha en ISO y la edad calculada. */
  onChange: (fechaISO: string, edad: number | null) => void;
  /** Etiqueta del campo. */
  label?: string | undefined;
  /** `id` del control principal (usado por la etiqueta). */
  htmlFor?: string | undefined;
  /** Texto de ayuda bajo el campo. */
  ayuda?: string | undefined;
  /** Error en lenguaje de persona. */
  error?: string | undefined;
  /**
   * Fecha de salida del tour: la edad se calcula a ese dia en lugar de hoy
   * (Spec P-02: «el titular debe ser mayor de 18 anos»).
   */
  fechaSalida?: string | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  /** Anio maximo seleccionable. Por defecto, el anio en curso. */
  anioMax?: number | undefined;
  /** Anio minimo seleccionable. Por defecto 1900. */
  anioMin?: number | undefined;
  className?: string | undefined;
}

/**
 * C-04 · Selector de fecha de nacimiento (dia / mes / anio).
 *
 * No usa el *datepicker* nativo: en movil obliga a navegar decades hacia
 * atras (Spec 3.2). El anio se teclea con teclado numerico y la edad se
 * calcula y se muestra como texto.
 */
export function BirthDateInput({
  value,
  onChange,
  label = "Fecha de nacimiento",
  htmlFor = "fecha-nacimiento",
  ayuda,
  error,
  fechaSalida,
  disabled = false,
  required = false,
  anioMax,
  anioMin = 1900,
  className,
}: BirthDateInputProps) {
  const anioMaximo = anioMax ?? new Date().getFullYear();

  const inicial = React.useMemo(() => descomponer(value), [value]);
  const [dia, setDia] = React.useState(inicial.dia);
  const [mes, setMes] = React.useState(inicial.mes);
  const [anio, setAnio] = React.useState(inicial.anio > 0 ? String(inicial.anio) : "");

  // Sincroniza con el valor externo (precarga del servidor o reseteo).
  // Si el valor es el que emitio este propio componente, no se toca el estado
  // local: de lo contrario, escribir el ano se borraria al primer digito.
  const refEmitido = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (value === refEmitido.current) return;
    const externo = descomponer(value);
    setDia(externo.dia);
    setMes(externo.mes);
    setAnio(externo.anio > 0 ? String(externo.anio) : "");
  }, [value]);

  const refOnChange = React.useRef(onChange);
  React.useEffect(() => {
    refOnChange.current = onChange;
  });

  const anioNum = Number.parseInt(anio, 10) || 0;
  const maximoDia = diasDelMes(mes, anioNum);
  const diaEfectivo = Math.min(dia, maximoDia);

  const completo =
    /^\d{4}$/.test(anio) && anioNum >= anioMin && anioNum <= anioMaximo && mes >= 1 && mes <= 12 && dia >= 1;

  const fechaISO = completo
    ? `${anio}-${completar(mes)}-${completar(diaEfectivo)}`
    : "";

  const edad = fechaISO ? edadEn(fechaISO, fechaSalida ?? hoyIso()) : null;

  React.useEffect(() => {
    refEmitido.current = fechaISO;
    refOnChange.current(fechaISO, edad);
  }, [fechaISO, edad]);

  const idAyuda = React.useId();
  const idError = React.useId();
  const descritos = [ayuda ? idAyuda : null, error ? idError : null]
    .filter((valor): valor is string => valor !== null)
    .join(" ");

  const opcionesDia = React.useMemo(
    () => Array.from({ length: maximoDia }, (_, indice) => indice + 1),
    [maximoDia],
  );

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} id={`${htmlFor}-label`} className="text-sm font-medium text-foreground">
        {label}
        {!required ? <span className="ml-1 font-normal text-muted-foreground">(opcional)</span> : null}
      </Label>

      <div
        role="group"
        aria-labelledby={`${htmlFor}-label`}
        className="grid grid-cols-[1fr_1.4fr_1.2fr] gap-2"
      >
        <Select
          value={dia > 0 ? String(dia) : ""}
          onValueChange={(valor) => setDia(Number.parseInt(valor, 10))}
          disabled={disabled}
        >
          <SelectTrigger id={htmlFor} className="h-11" aria-label="Dia de nacimiento">
            <SelectValue placeholder="Dia" />
          </SelectTrigger>
          <SelectContent>
            {opcionesDia.map((opcion) => (
              <SelectItem key={opcion} value={String(opcion)}>
                {opcion}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={mes > 0 ? String(mes) : ""}
          onValueChange={(valor) => setMes(Number.parseInt(valor, 10))}
          disabled={disabled}
        >
          <SelectTrigger className="h-11" aria-label="Mes de nacimiento">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            {MESES.map((nombre, indice) => (
              <SelectItem key={nombre} value={String(indice + 1)}>
                {nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="text"
          inputMode="numeric"
          autoComplete="bday-year"
          maxLength={4}
          value={anio}
          onChange={(evento) => {
            const digitos = evento.target.value.replace(/\D/g, "").slice(0, 4);
            setAnio(digitos);
          }}
          placeholder="Año"
          disabled={disabled}
          aria-label="Año de nacimiento"
          aria-invalid={error ? true : undefined}
          aria-describedby={descritos || undefined}
          className={cn("h-11", error && "border-red-500 focus-visible:ring-red-500")}
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

      {edad !== null ? (
        <p className="text-xs font-medium text-muted-foreground">
          {edad === 0 ? "Menos de 1 ano" : `${edad} ${edad === 1 ? "ano" : "anos"}`}
        </p>
      ) : null}
    </div>
  );
}
