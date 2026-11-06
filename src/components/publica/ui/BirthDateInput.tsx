import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MESES = [
  { valor: 1, label: "Enero" },
  { valor: 2, label: "Febrero" },
  { valor: 3, label: "Marzo" },
  { valor: 4, label: "Abril" },
  { valor: 5, label: "Mayo" },
  { valor: 6, label: "Junio" },
  { valor: 7, label: "Julio" },
  { valor: 8, label: "Agosto" },
  { valor: 9, label: "Septiembre" },
  { valor: 10, label: "Octubre" },
  { valor: 11, label: "Noviembre" },
  { valor: 12, label: "Diciembre" },
];

/** Número de días de un mes, considerando años bisiestos. */
export function diasDelMes(mes: number, anio: number): number {
  if (mes === 2) {
    const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
    return bisiesto ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(mes)) return 30;
  return 31;
}

function descomponer(iso: string): { dia: string; mes: string; anio: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) {
    return { dia: "", mes: "", anio: "" };
  }
  const [a = "", m = "", d = ""] = (iso || "").split("-");
  return {
    dia: d ? String(Number.parseInt(d, 10)).padStart(2, "0") : "",
    mes: m ? String(Number.parseInt(m, 10)).padStart(2, "0") : "",
    anio: a ?? "",
  };
}

export interface BirthDateInputProps {
  id?: string | undefined;
  /** Fecha en formato `YYYY-MM-DD`. Cadena vacía si aún no se eligió. */
  valor?: string | undefined;
  value?: string | undefined;
  onChange: (valor: string, edad?: number | null) => void;
  onBlur?: (() => void) | undefined;
  etiqueta?: string | undefined;
  label?: string | undefined;
  ayuda?: string | undefined;
  error?: string | undefined;
  requerido?: boolean | undefined;
  required?: boolean | undefined;
  deshabilitado?: boolean | undefined;
  disabled?: boolean | undefined;
  /** Edad calculada, mostrada como ayuda contextual ("34 años"). */
  edad?: number | null | undefined;
  anioMin?: number | undefined;
  anioMax?: number | undefined;
  className?: string | undefined;
}

/**
 * Selector de día / mes / año (C-04 / Spec §3.2).
 *
 * No se usa el datepicker nativo: en móvil obliga a navegar décadas hacia
 * atrás. El año se escribe con teclado numérico.
 */
export function BirthDateInput({
  id,
  valor,
  value,
  onChange,
  onBlur,
  etiqueta,
  label,
  ayuda,
  error,
  requerido,
  required,
  deshabilitado,
  disabled,
  edad,
  anioMin = 1900,
  anioMax,
  className,
}: BirthDateInputProps) {
  const generado = useId();
  const idFinal = id ?? generado;

  const fechaProp = valor ?? value ?? "";
  const estaDeshabilitado = Boolean(deshabilitado ?? disabled);
  const esRequerido = Boolean(requerido ?? required);
  const etiquetaFinal = etiqueta ?? label;
  const anioMaximo = anioMax ?? new Date().getFullYear();

  const inicial = useMemo(() => descomponer(fechaProp), [fechaProp]);
  const [dia, setDia] = useState<string>(inicial.dia);
  const [mes, setMes] = useState<string>(inicial.mes);
  const [anio, setAnio] = useState<string>(inicial.anio);

  // Rastrea el último valor ISO emitido para no sobrescribir el estado local
  // con la respuesta del padre mientras se escribe el año dígito a dígito.
  const refEmitido = useRef<string | null>(fechaProp || null);

  useEffect(() => {
    if (fechaProp === refEmitido.current) return;
    const externo = descomponer(fechaProp);
    setDia(externo.dia);
    setMes(externo.mes);
    setAnio(externo.anio);
    refEmitido.current = fechaProp;
  }, [fechaProp]);

  const refOnChange = useRef(onChange);
  useEffect(() => {
    refOnChange.current = onChange;
  });

  const notificar = (nuevoDia: string, nuevoMes: string, nuevoAnio: string) => {
    const a = Number.parseInt(nuevoAnio, 10);
    const m = Number.parseInt(nuevoMes, 10);
    const d = Number.parseInt(nuevoDia, 10);

    const esAnioValido = /^\d{4}$/.test(nuevoAnio) && a >= anioMin && a <= anioMaximo;
    const esMesValido = m >= 1 && m <= 12;
    const maxDias = esMesValido ? diasDelMes(m, esAnioValido ? a : 2024) : 31;
    const esDiaValido = d >= 1 && d <= maxDias;

    const nuevaFecha =
      esAnioValido && esMesValido && esDiaValido
        ? `${nuevoAnio}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
        : "";

    if (nuevaFecha !== refEmitido.current) {
      refEmitido.current = nuevaFecha;
      refOnChange.current(nuevaFecha);
    }
  };

  const diasMaximos = useMemo(() => {
    const m = Number.parseInt(mes, 10);
    const a = /^\d{4}$/.test(anio) ? Number.parseInt(anio, 10) : 2024;
    return m >= 1 && m <= 12 ? diasDelMes(m, a) : 31;
  }, [mes, anio]);

  const descritoPor =
    [ayuda ? `${idFinal}-ayuda` : null, error ? `${idFinal}-error` : null]
      .filter((v): v is string => v !== null)
      .join(" ") || undefined;

  let textoEdad: string | null = null;
  if (edad !== undefined && edad !== null) {
    if (edad === 0) {
      textoEdad = "Tienes menos de 1 año.";
    } else if (edad === 1) {
      textoEdad = "Tienes 1 año.";
    } else {
      textoEdad = `Tienes ${edad} años.`;
    }
  }

  const ayudaFinal = textoEdad
    ? `${ayuda ? `${ayuda}. ` : ""}${textoEdad}`
    : ayuda;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {etiquetaFinal ? (
        <label htmlFor={`${idFinal}-anio`} className="text-sm font-semibold text-foreground">
          {etiquetaFinal}
          {!esRequerido ? (
            <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>
          ) : null}
        </label>
      ) : null}

      <div className="grid grid-cols-[4.5rem_1fr_6rem] gap-2">
        <Select
          value={dia || undefined}
          disabled={estaDeshabilitado}
          onValueChange={(nuevoDia: string) => {
            setDia(nuevoDia);
            notificar(nuevoDia, mes, anio);
          }}
        >
          <SelectTrigger aria-label="Día" className="h-11" disabled={estaDeshabilitado}>
            <SelectValue placeholder="Día" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: diasMaximos }, (_, i) => i + 1).map((d) => {
              const val = String(d).padStart(2, "0");
              return (
                <SelectItem key={val} value={val}>
                  {val}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Select
          value={mes || undefined}
          disabled={estaDeshabilitado}
          onValueChange={(nuevoMes: string) => {
            setMes(nuevoMes);
            const mesNum = Number.parseInt(nuevoMes, 10);
            const aNum = /^\d{4}$/.test(anio) ? Number.parseInt(anio, 10) : 2024;
            const maxDias = diasDelMes(mesNum, aNum);
            const dNum = Number.parseInt(dia, 10);
            let diaAjustado = dia;
            if (dNum > maxDias) {
              diaAjustado = String(maxDias).padStart(2, "0");
              setDia(diaAjustado);
            }
            notificar(diaAjustado, nuevoMes, anio);
          }}
        >
          <SelectTrigger aria-label="Mes" className="h-11" disabled={estaDeshabilitado}>
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            {MESES.map((m) => (
              <SelectItem key={m.valor} value={String(m.valor).padStart(2, "0")}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          id={`${idFinal}-anio`}
          type="text"
          inputMode="numeric"
          autoComplete="bday-year"
          placeholder="AAAA"
          maxLength={4}
          className="h-11 text-base"
          value={anio}
          disabled={estaDeshabilitado}
          aria-invalid={error ? true : undefined}
          aria-required={esRequerido ? true : undefined}
          aria-describedby={descritoPor}
          onChange={(evento) => {
            const digitos = evento.target.value.replace(/\D/g, "").slice(0, 4);
            setAnio(digitos);
            const a = Number.parseInt(digitos, 10);
            const m = Number.parseInt(mes, 10);
            let diaAjustado = dia;
            if (m >= 1 && m <= 12 && /^\d{4}$/.test(digitos)) {
              const maxDias = diasDelMes(m, a);
              if (Number.parseInt(dia, 10) > maxDias) {
                diaAjustado = String(maxDias).padStart(2, "0");
                setDia(diaAjustado);
              }
            }
            notificar(diaAjustado, mes, digitos);
          }}
          onBlur={onBlur}
        />
      </div>

      {ayudaFinal ? (
        <p id={`${idFinal}-ayuda`} className="text-xs leading-relaxed text-muted-foreground">
          {ayudaFinal}
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
