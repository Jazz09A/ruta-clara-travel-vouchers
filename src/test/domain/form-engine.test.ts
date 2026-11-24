import { describe, expect, it } from "vitest";
import type { CampoDef, TipoCampo } from "@/lib/domain/types";
import {
  aplicarValorDefecto,
  campoAplicaA,
  campoVisibleParaCampo,
  esCampoComida,
  esCampoPuntoSalida,
  esVisible,
  evaluarCampos,
  evaluarCondicion,
  limpiarCampoOcultado,
  limpiarRespuestasAlOcultar,
  mergeGlobalYPasajero,
  opcionesDisponibles,
  TIPOS_SOPORTADOS,
  validarCampo,
  validarDependencias,
  validarFormulario,
  valoresPorCampo,
  type ContextoMotor,
} from "@/lib/domain/form-engine";

// ---------------------------------------------------------------------------
// Definición de prueba (PRD 10.2)
// ---------------------------------------------------------------------------

const almuerzo: CampoDef = {
  id: "almuerzo",
  label: "Selección de almuerzo",
  tipo: "select",
  alcance: "por_pasajero",
  obligatorio: true,
  aplica_a: ["Adulto", "Tercera Edad", "Niño"],
  opciones: [
    { valor: "pescado", label: "Pescado frito", cupo: 20 },
    { valor: "pollo", label: "Pollo a la canasta" },
    { valor: "vegetariano", label: "Vegetariano" },
  ],
};

const tieneAlergias: CampoDef = {
  id: "tiene_alergias",
  label: "¿Tiene alergias o condiciones médicas?",
  tipo: "checkbox",
  alcance: "por_pasajero",
  obligatorio: false,
};

const detalleAlergias: CampoDef = {
  id: "detalle_alergias",
  label: "Describa cuáles",
  tipo: "text",
  alcance: "por_pasajero",
  obligatorio: true,
  visible_si: { campo: "tiene_alergias", igual_a: true },
};

const puntoAbordaje: CampoDef = {
  id: "punto_abordaje",
  label: "Punto de abordaje",
  tipo: "select",
  alcance: "por_reserva",
  obligatorio: true,
  opciones: [
    { valor: "altamira", label: "Altamira, 5:00 a. m." },
    { valor: "petare", label: "Petare, 5:30 a. m." },
  ],
};

const toldo: CampoDef = {
  id: "toldo",
  label: "Alquiler de toldo",
  tipo: "extra",
  alcance: "por_reserva",
  obligatorio: false,
  precio_usd: "10.00",
  cantidad_max: 3,
};

function contextoBase(): ContextoMotor {
  return {
    campos: [almuerzo, tieneAlergias, detalleAlergias, puntoAbordaje, toldo],
    globales: { punto_abordaje: "altamira" },
    porPasajero: {
      p1: { almuerzo: "pescado", tiene_alergias: false },
      p2: { almuerzo: "pollo", tiene_alergias: true, detalle_alergias: "Mariscos" },
    },
    categorias: { p1: "Adulto", p2: "Niño" },
  };
}

function campoPorId(ctx: ContextoMotor, id: string) {
  const encontrado = ctx.campos.find((c) => c.id === id);
  if (!encontrado) throw new Error(`Campo no encontrado: ${id}`);
  return encontrado;
}

// ---------------------------------------------------------------------------

describe("motor de formularios — aplicabilidad", () => {
  it("un campo por pasajero sólo aplica a las categorías indicadas", () => {
    const menuInfantil: CampoDef = {
      id: "menu_infantil",
      label: "Menú infantil",
      tipo: "text",
      alcance: "por_pasajero",
      obligatorio: false,
      aplica_a: ["Niño"],
    };
    const ctx: ContextoMotor = {
      ...contextoBase(),
      campos: [...contextoBase().campos, menuInfantil],
    };

    expect(campoAplicaA(menuInfantil, "Niño")).toBe(true);
    expect(campoAplicaA(menuInfantil, "Adulto")).toBe(false);
    expect(campoAplicaA(menuInfantil, "Infante")).toBe(false);

    const paraAdulto = evaluarCampos(ctx, "p1").find((e) => e.campo.id === "menu_infantil");
    const paraNino = evaluarCampos(ctx, "p2").find((e) => e.campo.id === "menu_infantil");
    expect(paraAdulto?.aplica).toBe(false);
    expect(paraNino?.aplica).toBe(true);
  });

  it("un campo sin aplica_a aplica a todas las categorías", () => {
    expect(campoAplicaA(tieneAlergias, "Adulto")).toBe(true);
    expect(campoAplicaA(tieneAlergias, "Infante")).toBe(true);
  });

  it("un campo por reserva aplica a todos los pasajeros", () => {
    const evaluados = evaluarCampos(contextoBase(), "p1");
    const punto = evaluados.find((e) => e.campo.id === "punto_abordaje");
    expect(punto?.aplica).toBe(true);
    expect(punto?.valor).toBe("altamira");
  });

  it("en el ámbito global sólo aplican los campos por reserva", () => {
    const evaluados = evaluarCampos(contextoBase());
    const porReserva = evaluados.filter((e) => e.campo.alcance === "por_reserva");
    const porPasajero = evaluados.filter((e) => e.campo.alcance === "por_pasajero");
    expect(porReserva.every((e) => e.aplica)).toBe(true);
    expect(porPasajero.every((e) => !e.aplica)).toBe(true);
    expect(porReserva.map((e) => e.campo.id)).toEqual(["punto_abordaje", "toldo"]);
  });
});

describe("motor de formularios — visibilidad condicional", () => {
  it("igual_a muestra el campo sólo cuando la respuesta coincide", () => {
    const ctx = contextoBase();
    expect(evaluarCampos(ctx, "p1").find((e) => e.campo.id === "detalle_alergias")?.visible).toBe(
      false,
    );
    expect(evaluarCampos(ctx, "p2").find((e) => e.campo.id === "detalle_alergias")?.visible).toBe(
      true,
    );
  });

  it("en muestra el campo cuando el valor está en la lista", () => {
    const campo: CampoDef = {
      id: "menu_tipo",
      label: "¿Qué menú prefieres?",
      tipo: "text",
      alcance: "por_pasajero",
      obligatorio: false,
      visible_si: { campo: "almuerzo", en: ["pescado", "pollo"] },
    };
    const ctx: ContextoMotor = { ...contextoBase(), campos: [...contextoBase().campos, campo] };
    expect(evaluarCampos(ctx, "p1").find((e) => e.campo.id === "menu_tipo")?.visible).toBe(true);
    expect(evaluarCampos(ctx, "p2").find((e) => e.campo.id === "menu_tipo")?.visible).toBe(true);

    const vegetariano = {
      ...ctx,
      porPasajero: { ...ctx.porPasajero, p1: { almuerzo: "vegetariano" } },
    };
    expect(evaluarCampos(vegetariano, "p1").find((e) => e.campo.id === "menu_tipo")?.visible).toBe(
      false,
    );
  });

  it("distinto_de oculta el campo cuando el valor coincide", () => {
    const campo: CampoDef = {
      id: "sin_pescado",
      label: "¿Alergia a mariscos?",
      tipo: "text",
      alcance: "por_pasajero",
      obligatorio: false,
      visible_si: { campo: "almuerzo", distinto_de: "pescado" },
    };
    const ctx: ContextoMotor = { ...contextoBase(), campos: [...contextoBase().campos, campo] };
    expect(evaluarCampos(ctx, "p1").find((e) => e.campo.id === "sin_pescado")?.visible).toBe(false);
    expect(evaluarCampos(ctx, "p2").find((e) => e.campo.id === "sin_pescado")?.visible).toBe(true);
  });

  it("no_vacio considera vacío el texto vacío, el array vacío y false", () => {
    expect(evaluarCondicion({ campo: "x", no_vacio: true }, {})).toBe(false);
    expect(evaluarCondicion({ campo: "x", no_vacio: true }, { x: "" })).toBe(false);
    expect(evaluarCondicion({ campo: "x", no_vacio: true }, { x: [] })).toBe(false);
    expect(evaluarCondicion({ campo: "x", no_vacio: true }, { x: false })).toBe(false);
    expect(evaluarCondicion({ campo: "x", no_vacio: true }, { x: "algo" })).toBe(true);
    expect(evaluarCondicion({ campo: "x", no_vacio: true }, { x: 0 })).toBe(true);
  });

  it("la condición se evalúa contra las respuestas del mismo pasajero", () => {
    const ctx = contextoBase();
    // p1 no tiene alergias; p2 sí. El campo de p1 no debe heredar la respuesta de p2.
    expect(campoVisibleParaCampo("detalle_alergias", ctx, "p1")).toBe(false);
    expect(campoVisibleParaCampo("detalle_alergias", ctx, "p2")).toBe(true);
    expect(esVisible(campoPorId(ctx, "detalle_alergias"), ctx.porPasajero["p1"] ?? {})).toBe(false);
  });
});

describe("motor de formularios — dependencias inválidas", () => {
  it("detecta un campo por reserva que depende de uno por pasajero", () => {
    const detalleGlobal: CampoDef = {
      id: "detalle_global",
      label: "Detalle global",
      tipo: "text",
      alcance: "por_reserva",
      obligatorio: false,
      visible_si: { campo: "tiene_alergias", igual_a: true },
    };
    const ctx: ContextoMotor = {
      ...contextoBase(),
      campos: [...contextoBase().campos, detalleGlobal],
    };

    const errores = validarDependencias(ctx.campos);
    expect(errores).toHaveLength(1);
    expect(errores[0]?.campo).toBe("detalle_global");
    expect(errores[0]?.mensaje).toContain("Detalle global");
    expect(errores[0]?.mensaje).toContain("por cada pasajero");

    // Fail-open: el campo se sigue mostrando para no romper la pantalla.
    const evaluados = evaluarCampos(ctx, "p1");
    expect(evaluados.find((e) => e.campo.id === "detalle_global")?.visible).toBe(true);
  });

  it("permite que un campo por pasajero dependa de uno global con permite_por_pasajero", () => {
    const conPermiso: CampoDef = {
      ...puntoAbordaje,
      permite_por_pasajero: true,
    };
    const campoPasajero: CampoDef = {
      id: "hora_llegada",
      label: "¿Hora de llegada?",
      tipo: "text",
      alcance: "por_pasajero",
      obligatorio: false,
      visible_si: { campo: "punto_abordaje", no_vacio: true },
    };
    const errores = validarDependencias([conPermiso, campoPasajero]);
    expect(errores).toHaveLength(0);
  });

  it("detecta un campo por pasajero que depende de uno global sin permiso", () => {
    const campoPasajero: CampoDef = {
      id: "hora_llegada",
      label: "¿Hora de llegada?",
      tipo: "text",
      alcance: "por_pasajero",
      obligatorio: false,
      visible_si: { campo: "punto_abordaje", no_vacio: true },
    };
    const errores = validarDependencias([puntoAbordaje, campoPasajero]);
    expect(errores).toHaveLength(1);
    expect(errores[0]?.campo).toBe("hora_llegada");
  });
});

describe("motor de formularios — limpieza de respuestas", () => {
  it("elimina la respuesta del campo ocultado sin mutar el contexto", () => {
    const ctx = contextoBase();
    const limpias = limpiarRespuestasAlOcultar(ctx, "detalle_alergias", "p2");
    expect(limpias["detalle_alergias"]).toBeUndefined();
    expect(limpias["almuerzo"]).toBe("pollo");
    // El contexto original sigue intacto.
    expect(ctx.porPasajero["p2"]?.["detalle_alergias"]).toBe("Mariscos");
  });

  it("limpia el ámbito global cuando el campo es por reserva", () => {
    const ctx = contextoBase();
    const limpias = limpiarRespuestasAlOcultar(ctx, "punto_abordaje", "p1");
    expect(limpias["punto_abordaje"]).toBeUndefined();
    expect(ctx.globales["punto_abordaje"]).toBe("altamira");
  });

  it("limpiarCampoOcultado devuelve el contexto completo sin el campo", () => {
    const ctx = contextoBase();
    const limpio = limpiarCampoOcultado(ctx, "detalle_alergias", "p2");
    expect(limpio.porPasajero["p2"]?.["detalle_alergias"]).toBeUndefined();
    expect(limpio.porPasajero["p2"]?.["almuerzo"]).toBe("pollo");
    expect(ctx.porPasajero["p2"]?.["detalle_alergias"]).toBe("Mariscos");
  });
});

describe("motor de formularios — opciones agotadas", () => {
  it("marca el campo como agotado y bloquea continuar", () => {
    const ctx: ContextoMotor = { ...contextoBase(), agotadas: { "almuerzo:pescado": true } };
    const evaluados = evaluarCampos(ctx, "p1");
    const almuerzoEvaluado = evaluados.find((e) => e.campo.id === "almuerzo");
    expect(almuerzoEvaluado?.agotada).toBe(true);
    expect(almuerzoEvaluado?.valor).toBe("pescado");

    const resultado = validarCampo(almuerzo, "pescado", { "almuerzo:pescado": true });
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toBe("Esta opción se agotó. Elige otra");
  });

  it("opcionesDisponibles marca sólo las opciones agotadas", () => {
    const opciones = opcionesDisponibles(almuerzo, { "almuerzo:pescado": true });
    expect(opciones).toHaveLength(3);
    expect(opciones.find((o) => o.valor === "pescado")?.agotada).toBe(true);
    expect(opciones.find((o) => o.valor === "pollo")?.agotada).toBe(false);
  });

  it("una opción ya elegida que se agotó bloquea el formulario", () => {
    const ctx: ContextoMotor = { ...contextoBase(), agotadas: { "almuerzo:pescado": true } };
    const resultado = validarFormulario(ctx);
    expect(resultado.ok).toBe(false);
    expect(resultado.errores.some((e) => e.mensaje === "Esta opción se agotó. Elige otra")).toBe(
      true,
    );
  });

  it("una opción agotada que el cliente no eligió no bloquea el formulario", () => {
    const ctx: ContextoMotor = { ...contextoBase(), agotadas: { "almuerzo:vegetariano": true } };
    const resultado = validarFormulario(ctx);
    expect(resultado.ok).toBe(true);
  });
});

describe("motor de formularios — valores por defecto", () => {
  it("precarga el valor por defecto sólo en la primera aparición", () => {
    const conDefecto: CampoDef = {
      ...toldo,
      valor_defecto: 1,
    };
    const ctx: ContextoMotor = {
      ...contextoBase(),
      campos: [...contextoBase().campos, conDefecto],
    };

    const primera = aplicarValorDefecto(ctx);
    expect(primera.globales["toldo"]).toBe(1);
    expect(ctx.globales["toldo"]).toBeUndefined();

    const segunda = aplicarValorDefecto(primera);
    expect(segunda.globales["toldo"]).toBe(1);

    // Si el cliente lo cambia, no se vuelve a imponer el default.
    const cambiado = { ...segunda, globales: { ...segunda.globales, toldo: 3 } };
    const tercera = aplicarValorDefecto(cambiado);
    expect(tercera.globales["toldo"]).toBe(3);
  });

  it("no aplica el default a una categoría a la que el campo no aplica", () => {
    const conDefecto: CampoDef = { ...almuerzo, valor_defecto: "pollo" };
    const ctx: ContextoMotor = {
      ...contextoBase(),
      campos: [...contextoBase().campos, conDefecto],
      porPasajero: { p1: {}, p2: {} },
      categorias: { p1: "Adulto", p2: "Infante" },
    };
    const conDefectoAplicado = aplicarValorDefecto(ctx);
    expect(conDefectoAplicado.porPasajero["p1"]?.["almuerzo"]).toBe("pollo");
    expect(conDefectoAplicado.porPasajero["p2"]?.["almuerzo"]).toBeUndefined();
  });
});

describe("motor de formularios — validación por tipo", () => {
  it("text: exige contenido y respeta max_length", () => {
    const texto: CampoDef = { ...detalleAlergias, tipo: "text", obligatorio: true };
    expect(validarCampo(texto, "   ", {}).ok).toBe(false);
    expect(validarCampo(texto, "   ", {}).mensaje).toBe(
      "Esta pregunta es obligatoria: «Describa cuáles»",
    );
    expect(validarCampo(texto, "Mariscos", {}).ok).toBe(true);
    const largo = "a".repeat(501);
    expect(validarCampo(texto, largo, {}).ok).toBe(false);
    expect(validarCampo(texto, largo, {}).mensaje).toBe("Escribe máximo 500 caracteres");
    // Un campo opcional vacío no es un error.
    const opcional: CampoDef = { ...texto, obligatorio: false };
    expect(validarCampo(opcional, "", {})).toEqual({ ok: true });
  });

  it("textarea: admite hasta 1000 caracteres", () => {
    const area: CampoDef = { ...detalleAlergias, tipo: "textarea", obligatorio: false };
    expect(validarCampo(area, "a".repeat(1000), {}).ok).toBe(true);
    expect(validarCampo(area, "a".repeat(1001), {}).ok).toBe(false);
  });

  it("select: el valor debe estar en las opciones", () => {
    expect(validarCampo(almuerzo, "pescado", {}).ok).toBe(true);
    const inválido = validarCampo(almuerzo, "sushi", {});
    expect(inválido.ok).toBe(false);
    expect(inválido.mensaje).toBe("Elige una de las opciones disponibles");
  });

  it("multiselect: sin repetidos y sólo con opciones de la lista", () => {
    const multi: CampoDef = { ...almuerzo, tipo: "multiselect", obligatorio: false };
    expect(validarCampo(multi, ["pescado", "pollo"], {}).ok).toBe(true);
    const repetido = validarCampo(multi, ["pescado", "pescado"], {});
    expect(repetido.ok).toBe(false);
    expect(repetido.mensaje).toBe("No repitas la misma opción");
    const fuera = validarCampo(multi, ["sushi"], {});
    expect(fuera.ok).toBe(false);
    expect(fuera.mensaje).toBe("Elige solo opciones de la lista");
  });

  it("checkbox: sólo admite booleanos", () => {
    expect(validarCampo(tieneAlergias, true, {}).ok).toBe(true);
    expect(validarCampo(tieneAlergias, false, {}).ok).toBe(true);
    const invalido = validarCampo(tieneAlergias, "sí", {});
    expect(invalido.ok).toBe(false);
    expect(invalido.mensaje).toBe("Indica sí o no");
  });

  it("number: respeta min, max y step", () => {
    const numero: CampoDef = {
      id: "numero_huesos",
      label: "¿Número de huesos de pollo?",
      tipo: "number",
      alcance: "por_pasajero",
      obligatorio: false,
      min: 1,
      max: 5,
      step: 1,
    };
    expect(validarCampo(numero, 3, {}).ok).toBe(true);
    expect(validarCampo(numero, 0, {}).ok).toBe(false);
    expect(validarCampo(numero, 9, {}).ok).toBe(false);
    expect(validarCampo(numero, 2.5, {}).ok).toBe(false);
    expect(validarCampo(numero, "tres", {}).ok).toBe(false);
  });

  it("date: exige una fecha YYYY-MM-DD válida", () => {
    const fecha: CampoDef = { ...detalleAlergias, tipo: "date", obligatorio: false };
    expect(validarCampo(fecha, "2026-12-14", {}).ok).toBe(true);
    const invalida = validarCampo(fecha, "2026-13-40", {});
    expect(invalida.ok).toBe(false);
    expect(invalida.mensaje).toBe("Escribe una fecha válida, por ejemplo 2026-12-14");
  });

  it("extra: entero entre 0 y cantidad_max", () => {
    expect(validarCampo(toldo, 0, {}).ok).toBe(true);
    expect(validarCampo(toldo, 3, {}).ok).toBe(true);
    const exceso = validarCampo(toldo, 5, {});
    expect(exceso.ok).toBe(false);
    expect(exceso.mensaje).toBe("La cantidad máxima es 3");
    const negativo = validarCampo(toldo, -1, {});
    expect(negativo.ok).toBe(false);
    expect(negativo.mensaje).toBe("La cantidad no puede ser menos de 0");
  });

  it("un tipo no soportado en un campo obligatorio bloquea con un mensaje claro", () => {
    const desconocido: CampoDef = {
      id: "archivo",
      label: "Sube tu documento",
      tipo: "archivo" as unknown as TipoCampo,
      alcance: "por_pasajero",
      obligatorio: true,
    };
    const ctx: ContextoMotor = {
      ...contextoBase(),
      campos: [...contextoBase().campos, desconocido],
    };
    const resultado = validarFormulario(ctx);
    const error = resultado.errores.find((e) => e.campo === "archivo");
    expect(resultado.ok).toBe(false);
    expect(error?.mensaje).toBe("Hay una pregunta que no se puede mostrar. Contáctanos");
    expect(TIPOS_SOPORTADOS).not.toContain("archivo");
  });
});

describe("motor de formularios — validación del formulario completo", () => {
  it("exige los campos obligatorios visibles y aplicables", () => {
    const ctx: ContextoMotor = {
      ...contextoBase(),
      porPasajero: {
        p1: { tiene_alergias: false },
        p2: { almuerzo: "pollo", tiene_alergias: true, detalle_alergias: "Mariscos" },
      },
    };
    const resultado = validarFormulario(ctx);
    expect(resultado.ok).toBe(false);
    const almuerzoP1 = resultado.errores.find(
      (e) => e.campo === "almuerzo" && e.pasajero_ref === "p1",
    );
    expect(almuerzoP1?.mensaje).toBe("Esta pregunta es obligatoria: «Selección de almuerzo»");
    // p2 respondió todo.
    expect(resultado.errores.some((e) => e.pasajero_ref === "p2")).toBe(false);
  });

  it("no exige un campo obligatorio que está oculto", () => {
    const ctx = contextoBase();
    // detalle_alergias es obligatorio pero sólo aplica cuando hay alergias.
    const resultado = validarFormulario(ctx);
    expect(resultado.errores.some((e) => e.campo === "detalle_alergias")).toBe(false);
    expect(resultado.ok).toBe(true);
  });

  it("no exige a un pasajero un campo que no le aplica", () => {
    const menuInfantil: CampoDef = {
      id: "menu_infantil",
      label: "Menú infantil",
      tipo: "text",
      alcance: "por_pasajero",
      obligatorio: true,
      aplica_a: ["Niño"],
    };
    const ctx: ContextoMotor = {
      ...contextoBase(),
      campos: [...contextoBase().campos, menuInfantil],
    };
    const resultado = validarFormulario(ctx);
    expect(
      resultado.errores.some((e) => e.campo === "menu_infantil" && e.pasajero_ref === "p1"),
    ).toBe(false);
    expect(
      resultado.errores.some((e) => e.campo === "menu_infantil" && e.pasajero_ref === "p2"),
    ).toBe(true);
  });
});

describe("motor de formularios — merge de valores", () => {
  it("el valor por pasajero tiene prioridad sobre el global cuando el campo lo permite", () => {
    const conPermiso: CampoDef = { ...puntoAbordaje, permite_por_pasajero: true };
    const ctx: ContextoMotor = {
      ...contextoBase(),
      campos: [...contextoBase().campos, conPermiso],
      porPasajero: { ...contextoBase().porPasajero, p1: { punto_abordaje: "petare" } },
    };
    expect(mergeGlobalYPasajero(conPermiso, ctx.globales, ctx.porPasajero, "p1")).toBe("petare");
    expect(mergeGlobalYPasajero(conPermiso, ctx.globales, ctx.porPasajero, "p2")).toBe("altamira");
  });

  it("valoresPorCampo une lo global con lo de cada pasajero", () => {
    const merged = valoresPorCampo(contextoBase());
    expect(merged["punto_abordaje"]).toBe("altamira");
    expect(merged["detalle_alergias"]).toBe("Mariscos");
  });
});

// ---------------------------------------------------------------------------
// Edge cases: condiciones degeneradas, undefined hostil y defaults raros.
// ---------------------------------------------------------------------------

describe("edge cases — evaluarCondicion", () => {
  it("una condición sin operadores se cumple (fail-open)", () => {
    // Documentado: resultados vacío → return true.
    expect(evaluarCondicion({ campo: "x" } as never, {})).toBe(true);
  });

  it("igual_a: null coincide con un campo ausente (undefined → null)", () => {
    expect(evaluarCondicion({ campo: "fantasma", igual_a: null }, {})).toBe(true);
    expect(evaluarCondicion({ campo: "fantasma", igual_a: null }, { fantasma: "x" })).toBe(false);
    // null explícito también coincide.
    expect(evaluarCondicion({ campo: "x", igual_a: null }, { x: null })).toBe(true);
  });

  it("en con valor no-array se trata como lista vacía", () => {
    expect(evaluarCondicion({ campo: "x", en: "a" as never }, { x: "a" })).toBe(false);
    expect(evaluarCondicion({ campo: "x", en: [] }, { x: "a" })).toBe(false);
  });

  it("varios operadores se combinan con AND", () => {
    const cond = { campo: "x", igual_a: true, no_vacio: true };
    expect(evaluarCondicion(cond, { x: true })).toBe(true);
    expect(evaluarCondicion(cond, { x: false })).toBe(false);
    expect(evaluarCondicion(cond, { x: "" })).toBe(false);
  });

  it("distinto_de con campo ausente se cumple salvo que pida null", () => {
    expect(evaluarCondicion({ campo: "x", distinto_de: "a" }, {})).toBe(true);
    expect(evaluarCondicion({ campo: "x", distinto_de: null }, {})).toBe(false);
  });

  it("los arrays se comparan por orden y longitud", () => {
    expect(evaluarCondicion({ campo: "x", igual_a: ["a", "b"] }, { x: ["a", "b"] })).toBe(true);
    expect(evaluarCondicion({ campo: "x", igual_a: ["a", "b"] }, { x: ["b", "a"] })).toBe(false);
    expect(evaluarCondicion({ campo: "x", igual_a: ["a"] }, { x: ["a", "b"] })).toBe(false);
  });
});

describe("edge cases — visibilidad y dependencias", () => {
  it("visible_si a un campo inexistente evalúa contra las respuestas igual", () => {
    const campo: CampoDef = {
      id: "condicional",
      label: "Condicional",
      tipo: "text",
      alcance: "por_pasajero",
      obligatorio: false,
      visible_si: { campo: "no_existe", no_vacio: true },
    };
    const ctx: ContextoMotor = {
      ...contextoBase(),
      campos: [...contextoBase().campos, campo],
      porPasajero: {
        ...contextoBase().porPasajero,
        p1: { ...contextoBase().porPasajero["p1"], no_existe: "valor" },
      },
    };
    // La dependencia no está en campos pero la respuesta existe → visible.
    expect(evaluarCampos(ctx, "p1").find((e) => e.campo.id === "condicional")?.visible).toBe(true);
    // p2 no tiene la respuesta → oculta.
    expect(evaluarCampos(ctx, "p2").find((e) => e.campo.id === "condicional")?.visible).toBe(false);
  });

  it("campoVisibleParaCampo devuelve false para un id inexistente", () => {
    expect(campoVisibleParaCampo("no_existe", contextoBase(), "p1")).toBe(false);
  });

  it("esCampoComida reconoce grupo y los ids legados", () => {
    const base = {
      id: "x",
      label: "x",
      tipo: "text" as const,
      alcance: "por_pasajero" as const,
      obligatorio: false,
    };
    expect(esCampoComida({ ...base, grupo: "comida" })).toBe(true);
    expect(esCampoComida({ ...base, id: "almuerzo" })).toBe(true);
    expect(esCampoComida({ ...base, id: "menu_infantil" })).toBe(true);
    expect(esCampoComida({ ...base, id: "almuerzo2" })).toBe(false);
    // grupo distinto de "comida" → false (cast: el tipo sólo admite "comida").
    expect(esCampoComida({ ...base, grupo: "postre" as unknown as "comida" })).toBe(false);
  });

  it("esCampoPuntoSalida reconoce fuente explícita y la convención de id", () => {
    const base = {
      id: "x",
      label: "x",
      tipo: "text" as const,
      alcance: "por_reserva" as const,
      obligatorio: false,
    };
    expect(esCampoPuntoSalida({ ...base, fuente: "puntos_salida" })).toBe(true);
    expect(esCampoPuntoSalida({ ...base, id: "punto_abordaje" })).toBe(true);
    expect(esCampoPuntoSalida({ ...base, fuente: "otra" })).toBe(false);
    expect(esCampoPuntoSalida({ ...base, id: "punto_llegada" })).toBe(false);
  });
});

describe("edge cases — mergeGlobalYPasajero", () => {
  it("un campo por_pasajero ignora el global aunque exista", () => {
    // Documentado: el global no es respaldo para campos por_pasajero.
    const ctx = contextoBase();
    ctx.globales = { ...ctx.globales, almuerzo: "pescado" };
    const valor = mergeGlobalYPasajero(almuerzo, ctx.globales, { p9: {} }, "p9");
    expect(valor).toBeNull();
  });

  it("un null explícito del pasajero no cae al global", () => {
    const conPermiso: CampoDef = { ...puntoAbordaje, permite_por_pasajero: true };
    const valor = mergeGlobalYPasajero(
      conPermiso,
      { punto_abordaje: "altamira" },
      { p1: { punto_abordaje: null } },
      "p1",
    );
    expect(valor).toBeNull();
  });

  it("sin respuesta propia ni global devuelve null", () => {
    expect(mergeGlobalYPasajero(puntoAbordaje, {}, {}, "p1")).toBeNull();
  });
});

describe("edge cases — limpieza de respuestas", () => {
  it("un campoOcultadoId inexistente se trata como por_pasajero", () => {
    const ctx = contextoBase();
    const limpias = limpiarRespuestasAlOcultar(ctx, "no_existe", "p1");
    expect(limpias).toEqual({ ...ctx.porPasajero["p1"] });
    // Y limpiarCampoOcultado devuelve el contexto intacto si no hay clave.
    const limpio = limpiarCampoOcultado(ctx, "no_existe", "p1");
    expect(limpio).toBe(ctx); // misma referencia: nada que limpiar
  });

  it("limpiarCampoOcultado de un campo por_reserva también limpia copias por pasajero", () => {
    const ctx: ContextoMotor = {
      ...contextoBase(),
      porPasajero: {
        p1: { punto_abordaje: "petare", almuerzo: "pescado" },
        p2: { almuerzo: "pollo" },
      },
    };
    const limpio = limpiarCampoOcultado(ctx, "punto_abordaje", "p1");
    expect(limpio.globales["punto_abordaje"]).toBeUndefined();
    expect(limpio.porPasajero["p1"]?.["punto_abordaje"]).toBeUndefined();
    expect(limpio.porPasajero["p1"]?.["almuerzo"]).toBe("pescado");
  });
});

describe("edge cases — validarCampo con valores hostiles", () => {
  it("undefined NUNCA es vacío: un opcional con undefined falla igual", () => {
    // Documentado: esValorVacio sólo reconoce null como vacío; undefined
    // cae al switch del tipo y produce error aunque el campo sea opcional.
    expect(
      validarCampo({ ...detalleAlergias, tipo: "text", obligatorio: false }, undefined as never, {})
        .ok,
    ).toBe(false);
    expect(validarCampo({ ...almuerzo, obligatorio: false }, undefined as never, {}).ok).toBe(
      false,
    );
    expect(validarCampo(tieneAlergias, undefined as never, {}).ok).toBe(false);
  });

  it("number: NaN e Infinity se rechazan; step 0 acepta cualquier valor", () => {
    const numero: CampoDef = {
      id: "n",
      label: "n",
      tipo: "number",
      alcance: "por_pasajero",
      obligatorio: false,
      min: 1,
      max: 10,
      step: 1,
    };
    expect(validarCampo(numero, NaN, {}).ok).toBe(false);
    expect(validarCampo(numero, Infinity, {}).ok).toBe(false);
    expect(validarCampo(numero, -0, {}).ok).toBe(false); // -0 < min 1

    const sinPaso: CampoDef = { ...numero, step: 0 };
    expect(validarCampo(sinPaso, 3.14159, {}).ok).toBe(true); // step 0 = todo vale
  });

  it("number: min > max hace imposible cualquier valor válido", () => {
    const imposible: CampoDef = {
      id: "n",
      label: "n",
      tipo: "number",
      alcance: "por_pasajero",
      obligatorio: false,
      min: 10,
      max: 1,
    };
    expect(validarCampo(imposible, 5, {}).ok).toBe(false);
    expect(validarCampo(imposible, 10, {}).ok).toBe(false);
    expect(validarCampo(imposible, 0, {}).ok).toBe(false);
  });

  it("date: rechaza fechas sin padding y días inexistentes", () => {
    const fecha: CampoDef = { ...detalleAlergias, tipo: "date", obligatorio: false };
    expect(validarCampo(fecha, "2026-2-3", {}).ok).toBe(false); // sin padding
    expect(validarCampo(fecha, "2026-02-30", {}).ok).toBe(false); // día inexistente
    expect(validarCampo(fecha, "2026-02-29", {}).ok).toBe(false); // 2026 no bisiesto
    expect(validarCampo(fecha, "2024-02-29", {}).ok).toBe(true); // bisiesto
  });

  it("extra: exige entero no negativo; 1.5 y NaN fallan", () => {
    expect(validarCampo(toldo, 1.5, {}).ok).toBe(false);
    expect(validarCampo(toldo, NaN, {}).ok).toBe(false);
    expect(validarCampo(toldo, Number.MAX_SAFE_INTEGER, {}).ok).toBe(false); // > cantidad_max
    const sinMax: CampoDef = { ...toldo, cantidad_max: undefined };
    expect(validarCampo(sinMax, 999, {}).ok).toBe(true);
  });

  it("multiselect: miembros no-string y duplicados no contiguos", () => {
    const multi: CampoDef = { ...almuerzo, tipo: "multiselect", obligatorio: false };
    expect(validarCampo(multi, ["pescado", 1] as never, {}).ok).toBe(false);
    expect(validarCampo(multi, ["pescado", "pollo", "pescado"], {}).ok).toBe(false);
  });

  it("select: un valor numérico se rechaza aunque no sea string", () => {
    expect(validarCampo({ ...almuerzo, obligatorio: false }, 5 as never, {}).ok).toBe(false);
  });
});

describe("edge cases — validarFormulario", () => {
  it("un campo global con permite_por_pasajero valida SÓLO a quienes respondieron", () => {
    const conPermiso: CampoDef = {
      ...puntoAbordaje,
      permite_por_pasajero: true,
      obligatorio: true,
    };
    const ctx: ContextoMotor = {
      ...contextoBase(),
      campos: [...contextoBase().campos, conPermiso],
      // p3 existe en categorias pero NUNCA respondió el campo → no se valida.
      categorias: { p1: "Adulto", p2: "Niño", p3: "Adulto" },
      porPasajero: {
        ...contextoBase().porPasajero,
        p1: { ...contextoBase().porPasajero["p1"], punto_abordaje: "petare" },
      },
    };
    const resultado = validarFormulario(ctx);
    // Sólo p1 tiene valor por pasajero → se valida a p1; p3 escapa de la validación.
    expect(resultado.errores.filter((e) => e.campo === "punto_abordaje")).toHaveLength(0);
  });

  it("un pasajero en porPasajero sin categoría nunca se valida", () => {
    const ctx: ContextoMotor = {
      ...contextoBase(),
      // p9 responde pero no tiene categoría → el loop itera ctx.categorias.
      porPasajero: { ...contextoBase().porPasajero, p9: {} },
    };
    const resultado = validarFormulario(ctx);
    expect(resultado.errores.some((e) => e.pasajero_ref === "p9")).toBe(false);
  });
});

describe("edge cases — opcionesDisponibles y defaults", () => {
  it("campo sin opciones devuelve lista vacía; agotada propia se respeta", () => {
    const sinOpciones: CampoDef = { ...toldo };
    expect(opcionesDisponibles(sinOpciones)).toEqual([]);

    const conAgotada: CampoDef = {
      ...almuerzo,
      opciones: [{ valor: "pescado", label: "Pescado", agotada: true }],
    };
    expect(opcionesDisponibles(conAgotada)[0]?.agotada).toBe(true);
  });

  it("valor_defecto null/false/0 se aplican y marcan el campo como aplicado", () => {
    const conNull: CampoDef = { ...toldo, valor_defecto: null };
    const ctx: ContextoMotor = {
      ...contextoBase(),
      campos: [...contextoBase().campos, conNull],
    };
    const aplicado = aplicarValorDefecto(ctx);
    // null quedó "aplicado": globales tiene la clave y defaultsAplicados la lista.
    expect("toldo" in aplicado.globales).toBe(true);
    expect(aplicado.defaultsAplicados).toContain("toldo");
  });

  it("valor_defecto con forma inválida se normaliza a null", () => {
    const invalido: CampoDef = { ...toldo, valor_defecto: { raro: true } };
    const ctx: ContextoMotor = {
      ...contextoBase(),
      campos: [...contextoBase().campos, invalido],
    };
    const aplicado = aplicarValorDefecto(ctx);
    expect(aplicado.globales["toldo"]).toBeNull();

    // Array con no-strings también se normaliza a null.
    const arrayRaro: CampoDef = { ...toldo, id: "otro", valor_defecto: [1, "a"] };
    const aplicado2 = aplicarValorDefecto({
      ...contextoBase(),
      campos: [arrayRaro],
    });
    expect(aplicado2.globales["otro"]).toBeNull();
  });

  it("valor_defecto array de strings se copia (no comparte referencia)", () => {
    const valores = ["a", "b"];
    const campo: CampoDef = {
      id: "multi",
      label: "multi",
      tipo: "multiselect",
      alcance: "por_reserva",
      obligatorio: false,
      valor_defecto: valores,
    };
    const aplicado = aplicarValorDefecto({ ...contextoBase(), campos: [campo] });
    expect(aplicado.globales["multi"]).toEqual(["a", "b"]);
    expect(aplicado.globales["multi"]).not.toBe(valores);
  });
});
