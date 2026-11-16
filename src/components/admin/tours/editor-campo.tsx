import * as React from "react";
import { Info } from "lucide-react";

import { Campo } from "@/components/admin/ui/campo";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AYUDA_ALCANCE,
  AYUDA_TIPO_CAMPO,
  CATEGORIAS,
  ETIQUETA_ALCANCE,
  ETIQUETA_CATEGORIA,
  ETIQUETA_TIPO_CAMPO,
} from "./tipos-campo";
import { EditorCondicion } from "./editor-condicion";
import { EditorOpciones } from "./editor-opciones";
import { generarIdCampo } from "./biblioteca-campos";
import type { ProblemaCampo } from "./validacion";
import type { AlcanceCampo, CampoDef, Categoria, PuntoSalida, TipoCampo } from "@/lib/domain/types";
import { TIPOS_SOPORTADOS, esCampoComida, esCampoPuntoSalida } from "@/lib/domain/form-engine";
import { formatTime } from "@/lib/format";
import { EnlaceAdmin } from "@/components/admin/ui/enlace";

export interface EditorCampoProps {
  campo: CampoDef;
  /** Todos los campos del formulario (para las dependencias). */
  campos: CampoDef[];
  /** `true` cuando el campo ya está publicado: id, tipo y alcance no se cambian. */
  bloqueado: boolean;
  /** Problemas de validación viva de este campo. */
  problemas: ProblemaCampo[];
  /** Catálogo global de puntos de salida (opciones del campo de abordaje). */
  puntosSalida?: PuntoSalida[] | undefined;
  /** Bandera global: la selección de comida está oculta para el cliente. */
  comidasDeshabilitadas?: boolean | undefined;
  onChange: (campo: CampoDef) => void;
}

/**
 * Editor de un campo del formulario (Spec 9.9).
 *
 * Un panel (escritorio) o una pantalla completa (móvil) con todas las
 * propiedades del campo. El `id` se autogenera del nombre y queda bloqueado
 * cuando la versión ya fue publicada.
 */
export function EditorCampo({
  campo,
  campos,
  bloqueado,
  problemas,
  puntosSalida,
  comidasDeshabilitadas = false,
  onChange,
}: EditorCampoProps) {
  const [idManual, setIdManual] = React.useState(false);
  const idBloqueantes = problemas.filter((problema) => problema.nivel === "bloqueante");
  const advertencias = problemas.filter((problema) => problema.nivel === "advertencia");

  const cambiarEtiqueta = (label: string) => {
    const siguiente: CampoDef = { ...campo, label };
    if (!bloqueado && !idManual) {
      siguiente.id = generarIdCampo(label);
    }
    onChange(siguiente);
  };

  const cambiarCategoria = (categoria: Categoria, marcada: boolean) => {
    const actuales = campo.aplica_a ?? [];
    const nuevas = marcada
      ? [...actuales, categoria]
      : actuales.filter((otra) => otra !== categoria);
    onChange({
      ...campo,
      aplica_a: nuevas.length === CATEGORIAS.length ? undefined : nuevas,
    });
  };

  return (
    <div className="space-y-5">
      <Campo
        id="campo-etiqueta"
        etiqueta="Etiqueta de la pregunta"
        ayuda="Es lo que el cliente lee. Escríbelo como una pregunta."
        requerido
      >
        {(props) => (
          <Input
            {...props}
            value={campo.label}
            onChange={(evento) => cambiarEtiqueta(evento.target.value)}
            placeholder="¿Necesita silla de ruedas?"
          />
        )}
      </Campo>

      <Campo
        id="campo-id"
        etiqueta="Identificador"
        ayuda={
          bloqueado
            ? "Este campo ya está publicado: su identificador no se puede cambiar."
            : "Se genera a partir del nombre. No lo cambies si ya hay respuestas guardadas."
        }
      >
        {(props) => (
          <Input
            {...props}
            value={campo.id}
            readOnly={bloqueado}
            onChange={(evento) => {
              setIdManual(true);
              onChange({ ...campo, id: evento.target.value });
            }}
            className={bloqueado ? "bg-muted" : undefined}
          />
        )}
      </Campo>

      <Campo id="campo-ayuda" etiqueta="Texto de ayuda" ayuda="Se muestra debajo de la etiqueta.">
        {(props) => (
          <Textarea
            {...props}
            value={campo.ayuda ?? ""}
            onChange={(evento) => onChange({ ...campo, ayuda: evento.target.value })}
            rows={2}
            placeholder="Cuéntanos si alguien del grupo necesita apoyo para moverse."
          />
        )}
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="campo-tipo"
          etiqueta="Tipo de pregunta"
          ayuda={
            bloqueado
              ? "El tipo no se puede cambiar en un campo ya publicado."
              : AYUDA_TIPO_CAMPO[campo.tipo]
          }
        >
          {(props) => (
            <Select
              value={campo.tipo}
              disabled={bloqueado}
              onValueChange={(valor) => onChange({ ...campo, tipo: valor as TipoCampo })}
            >
              <SelectTrigger {...props} className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_SOPORTADOS.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {ETIQUETA_TIPO_CAMPO[tipo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Campo>

        <Campo
          id="campo-alcance"
          etiqueta="Alcance de la respuesta"
          ayuda={
            bloqueado
              ? "El alcance no se puede cambiar en un campo ya publicado."
              : AYUDA_ALCANCE[campo.alcance]
          }
        >
          {(props) => (
            <Select
              value={campo.alcance}
              disabled={bloqueado}
              onValueChange={(valor) => onChange({ ...campo, alcance: valor as AlcanceCampo })}
            >
              <SelectTrigger {...props} className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="por_pasajero">{ETIQUETA_ALCANCE.por_pasajero}</SelectItem>
                <SelectItem value="por_reserva">{ETIQUETA_ALCANCE.por_reserva}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </Campo>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="campo-obligatorio"
            checked={campo.obligatorio}
            onCheckedChange={(estado) => onChange({ ...campo, obligatorio: estado === true })}
          />
          <Label htmlFor="campo-obligatorio" className="text-sm font-normal">
            Es obligatoria
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="campo-grupo-comida"
            checked={esCampoComida(campo)}
            onCheckedChange={(estado) => {
              if (estado === true) {
                onChange({ ...campo, grupo: "comida" });
                return;
              }
              const { grupo: _grupo, ...resto } = campo;
              onChange({ ...resto });
            }}
          />
          <Label htmlFor="campo-grupo-comida" className="text-sm font-normal">
            Es una selección de comida
          </Label>
        </div>

        {campo.alcance === "por_reserva" ? (
          <div className="flex items-center gap-2">
            <Checkbox
              id="campo-por-pasajero"
              checked={campo.permite_por_pasajero === true}
              onCheckedChange={(estado) =>
                onChange({ ...campo, permite_por_pasajero: estado === true })
              }
            />
            <Label htmlFor="campo-por-pasajero" className="text-sm font-normal">
              Permitir una respuesta por pasajero
            </Label>
          </div>
        ) : null}
      </div>

      {esCampoComida(campo) && comidasDeshabilitadas ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Esta pregunta está oculta para el cliente mientras la selección de comida esté
          deshabilitada en la configuración. Aquí se conserva y se puede seguir editando.
        </p>
      ) : null}

      <Campo
        id="campo-valor-defecto"
        etiqueta="Valor por defecto"
        ayuda="Se precarga la primera vez que el cliente ve la pregunta."
      >
        {(props) => (
          <Input
            {...props}
            value={campo.valor_defecto === undefined ? "" : String(campo.valor_defecto)}
            onChange={(evento) => {
              const texto = evento.target.value;
              if (texto === "") {
                const { valor_defecto: _omitido, ...resto } = campo;
                onChange({ ...resto });
                return;
              }
              onChange({ ...campo, valor_defecto: texto });
            }}
            placeholder="Texto que aparece precargado"
          />
        )}
      </Campo>

      {campo.alcance === "por_pasajero" ? (
        <fieldset className="space-y-2 rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-semibold text-foreground">
            Categorías a las que aplica
          </legend>
          <p className="text-xs text-muted-foreground">
            Si no marcas ninguna, la pregunta se hace a todas las categorías.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CATEGORIAS.map((categoria) => {
              const marcada = (campo.aplica_a ?? []).includes(categoria);
              return (
                <div key={categoria} className="flex items-start gap-2">
                  <Checkbox
                    id={`categoria-${categoria}`}
                    checked={marcada}
                    onCheckedChange={(estado) => cambiarCategoria(categoria, estado === true)}
                  />
                  <Label htmlFor={`categoria-${categoria}`} className="text-sm font-normal">
                    {ETIQUETA_CATEGORIA[categoria]}
                  </Label>
                </div>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {campo.tipo === "select" || campo.tipo === "multiselect" ? (
        esCampoPuntoSalida(campo) ? (
          <div className="rounded-xl border border-border p-3">
            <p className="text-sm font-semibold text-foreground">
              Opciones — catálogo de puntos de salida
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Este campo toma sus opciones del catálogo global de la agencia (no se editan aquí).
              Para crear, editar o quitar puntos:{" "}
              <EnlaceAdmin
                to="/admin/configuracion/puntos"
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Configuración → Puntos de salida
              </EnlaceAdmin>
              .
            </p>
            <ul className="mt-3 space-y-1.5">
              {(puntosSalida ?? [])
                .filter((punto) => punto.activo)
                .map((punto) => (
                  <li
                    key={punto.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                  >
                    <span className="font-medium text-foreground">{punto.nombre}</span>
                    <span className="text-xs text-muted-foreground">{formatTime(punto.hora)}</span>
                  </li>
                ))}
              {(puntosSalida ?? []).filter((punto) => punto.activo).length === 0 ? (
                <li className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  No hay puntos activos. Créalos en la configuración.
                </li>
              ) : null}
            </ul>
          </div>
        ) : (
          <div className="rounded-xl border border-border p-3">
            <p className="mb-2 text-sm font-semibold text-foreground">Opciones</p>
            <EditorOpciones
              opciones={campo.opciones ?? []}
              onChange={(opciones) => onChange({ ...campo, opciones })}
            />
          </div>
        )
      ) : null}

      {campo.tipo === "extra" ? (
        <div className="grid gap-4 rounded-xl border border-border p-3 sm:grid-cols-2">
          <Campo
            id="campo-precio"
            etiqueta="Precio por unidad (USD)"
            ayuda="Se suma al resumen de la reserva."
            requerido
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={campo.precio_usd ?? ""}
                onChange={(evento) => onChange({ ...campo, precio_usd: evento.target.value })}
                placeholder="10.00"
              />
            )}
          </Campo>

          <Campo
            id="campo-cantidad-max"
            etiqueta="Cantidad máxima"
            ayuda="Cuántas unidades puede pedir un grupo como máximo."
            requerido
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                min={1}
                inputMode="numeric"
                value={campo.cantidad_max ?? ""}
                onChange={(evento) => {
                  const texto = evento.target.value;
                  onChange({
                    ...campo,
                    cantidad_max: texto === "" ? undefined : Number(texto),
                  });
                }}
                placeholder="3"
              />
            )}
          </Campo>
        </div>
      ) : null}

      <div className="rounded-xl border border-border p-3">
        <EditorCondicion
          campo={campo}
          campos={campos}
          onChange={(visible_si) => {
            if (visible_si === undefined) {
              const { visible_si: _omitido, ...resto } = campo;
              onChange({ ...resto });
              return;
            }
            onChange({ ...campo, visible_si });
          }}
        />
      </div>

      {idBloqueantes.length > 0 || advertencias.length > 0 ? (
        <div className="space-y-2">
          {idBloqueantes.map((problema) => (
            <p
              key={`${problema.campo}-${problema.mensaje}`}
              className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{problema.mensaje}</span>
            </p>
          ))}
          {advertencias.map((problema) => (
            <p
              key={`${problema.campo}-${problema.mensaje}`}
              className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{problema.mensaje}</span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
