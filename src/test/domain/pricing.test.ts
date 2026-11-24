import { describe, expect, it } from "vitest";
import type { Categoria } from "@/lib/domain/types";
import {
  calcularCategorias,
  calcularPrecio,
  calcularPrecioAdministrado,
  detectarOpcionesAgotadas,
  totalBs,
  type EntradaCalculo,
  type EntradaCalculoAdministrado,
} from "@/lib/domain/pricing";

const tarifas = [
  { categoria: "Adulto" as Categoria, precio_usd: "50.00" },
  { categoria: "Niño" as Categoria, precio_usd: "30.00" },
];

const camposExtra = [
  { id: "toldo", label: "Alquiler de toldo", precio_usd: "10.00", cantidad_max: 3 },
];

function entradaBase(): EntradaCalculo {
  return {
    pasajeros: [
      { categoria: "Adulto", respuestas: {} },
      { categoria: "Adulto", respuestas: {} },
      { categoria: "Niño", respuestas: {} },
    ],
    tarifas,
    camposExtra,
    respuestasGlobales: {},
  };
}

describe("precio — subtotal por categoría", () => {
  it("agrupa una línea por categoría usada", () => {
    const resultado = calcularPrecio(entradaBase());
    expect(resultado.subtotal_usd).toBe("130.00");
    expect(resultado.lineas).toHaveLength(2);

    const adultos = resultado.lineas.find((l) => l.concepto === "Adulto");
    expect(adultos?.cantidad).toBe(2);
    expect(adultos?.precio_usd).toBe("50.00");
    expect(adultos?.total_usd).toBe("100.00");
    expect(adultos?.detalle).toContain("2 pasajeros");

    const ninos = resultado.lineas.find((l) => l.concepto === "Niño");
    expect(ninos?.cantidad).toBe(1);
    expect(ninos?.total_usd).toBe("30.00");
    expect(ninos?.detalle).toContain("1 pasajero");
  });

  it("sin pasajeros el total es cero", () => {
    const resultado = calcularPrecio({ ...entradaBase(), pasajeros: [] });
    expect(resultado.total_usd).toBe("0.00");
    expect(resultado.lineas).toHaveLength(0);
  });

  it("avisa y trata como cero cuando la categoría no tiene tarifa", () => {
    const entrada = entradaBase();
    entrada.pasajeros.push({ categoria: "Infante", respuestas: {} });
    const resultado = calcularPrecio(entrada);
    expect(resultado.advertencias).toHaveLength(1);
    expect(resultado.advertencias[0]).toContain("Infante");
    expect(resultado.subtotal_usd).toBe("130.00");
  });
});

describe("precio — adicionales por ítems con costo", () => {
  it("suma el extra global por cantidad", () => {
    const entrada = entradaBase();
    entrada.respuestasGlobales = { toldo: 2 };
    const resultado = calcularPrecio(entrada);

    const toldo = resultado.lineas.find((l) => l.concepto === "Alquiler de toldo");
    expect(toldo?.cantidad).toBe(2);
    expect(toldo?.precio_usd).toBe("10.00");
    expect(toldo?.total_usd).toBe("20.00");
    expect(resultado.adicionales_usd).toBe("20.00");
    expect(resultado.total_usd).toBe("150.00");
  });

  it("suma el extra respondido por cada pasajero", () => {
    const entrada = entradaBase();
    entrada.pasajeros = [
      { categoria: "Adulto", respuestas: { toldo: 1 } },
      { categoria: "Adulto", respuestas: { toldo: 1 } },
      { categoria: "Niño", respuestas: {} },
    ];
    const resultado = calcularPrecio(entrada);
    expect(resultado.adicionales_usd).toBe("20.00");
    expect(resultado.total_usd).toBe("150.00");
  });

  it("avisa cuando la cantidad supera el máximo permitido", () => {
    const entrada = entradaBase();
    entrada.respuestasGlobales = { toldo: 5 };
    const resultado = calcularPrecio(entrada);
    expect(resultado.advertencias.some((a) => a.includes("Alquiler de toldo"))).toBe(true);
  });

  it("un extra con cantidad cero no genera línea", () => {
    const entrada = entradaBase();
    entrada.respuestasGlobales = { toldo: 0 };
    const resultado = calcularPrecio(entrada);
    expect(resultado.lineas.find((l) => l.concepto === "Alquiler de toldo")).toBeUndefined();
    expect(resultado.adicionales_usd).toBe("0.00");
  });
});

describe("precio — descuentos", () => {
  it("aplica un descuento por porcentaje", () => {
    const resultado = calcularPrecio({
      ...entradaBase(),
      promocion: { tipo: "porcentaje", valor: 10 },
    });
    expect(resultado.descuento_usd).toBe("13.00");
    expect(resultado.total_usd).toBe("117.00");
  });

  it("aplica un descuento por monto", () => {
    const resultado = calcularPrecio({
      ...entradaBase(),
      promocion: { tipo: "monto", valor: 20 },
    });
    expect(resultado.descuento_usd).toBe("20.00");
    expect(resultado.total_usd).toBe("110.00");
  });

  it("el total nunca queda negativo", () => {
    const resultado = calcularPrecio({
      ...entradaBase(),
      promocion: { tipo: "monto", valor: 500 },
    });
    expect(resultado.total_usd).toBe("0.00");
    expect(resultado.descuento_usd).toBe("130.00");
  });

  it("sin promoción el descuento es cero", () => {
    const resultado = calcularPrecio(entradaBase());
    expect(resultado.descuento_usd).toBe("0.00");
    expect(resultado.total_usd).toBe("130.00");
  });
});

describe("precio — saldo pendiente", () => {
  it("descuenta lo ya pagado", () => {
    const resultado = calcularPrecio({ ...entradaBase(), saldoPrevio: "50.00" });
    expect(resultado.total_usd).toBe("130.00");
    expect(resultado.saldo_usd).toBe("80.00");
  });

  it("el saldo nunca es negativo", () => {
    const resultado = calcularPrecio({ ...entradaBase(), saldoPrevio: "200.00" });
    expect(resultado.saldo_usd).toBe("0.00");
  });

  it("sin saldo previo el saldo es el total", () => {
    const resultado = calcularPrecio(entradaBase());
    expect(resultado.saldo_usd).toBe("130.00");
  });
});

describe("precio — tasa de cambio", () => {
  it("convierte a bolívares con la tasa vigente", () => {
    expect(totalBs("130.00", "36.50")).toBe("4745.00");
  });

  it("sin tasa vigente no hay equivalente en bolívares", () => {
    expect(totalBs("130.00", null)).toBeNull();
  });
});

describe("precio — categoría por edad", () => {
  const tarifasEdad = [
    { categoria: "Adulto" as Categoria, edad_min: 18, edad_max: 120, precio_usd: "50.00" },
    { categoria: "Niño" as Categoria, edad_min: 3, edad_max: 11, precio_usd: "30.00" },
  ];

  it("encuentra la categoría según la edad en la fecha de salida", () => {
    expect(calcularCategorias(tarifasEdad, "2026-12-14", "2015-05-10")).toBe("Niño");
    expect(calcularCategorias(tarifasEdad, "2026-12-14", "1990-01-01")).toBe("Adulto");
  });

  it("devuelve null si ninguna tarifa cubre la edad", () => {
    expect(calcularCategorias(tarifasEdad, "2026-12-14", "2024-01-01")).toBeNull();
    expect(calcularCategorias(tarifasEdad, "2026-12-14", "")).toBeNull();
  });
});

describe("precio administrado — líneas y ajustes del admin", () => {
  function entradaAdmin(): EntradaCalculoAdministrado {
    return {
      pasajeros: [{ categoria: "Adulto" }, { categoria: "Adulto" }, { categoria: "Niño" }],
      tarifas,
    };
  }

  it("sin líneas ni ajustes el total es solo la base de tarifas", () => {
    const resultado = calcularPrecioAdministrado(entradaAdmin());
    expect(resultado.subtotal_usd).toBe("130.00");
    expect(resultado.total_usd).toBe("130.00");
    expect(resultado.saldo_usd).toBe("130.00");
  });

  it("suma las líneas extra gestionadas por el admin (toldos)", () => {
    const resultado = calcularPrecioAdministrado({
      ...entradaAdmin(),
      lineas: [{ concepto: "Alquiler de toldo", cantidad: 2, precio_unit_usd: "10.00" }],
    });
    expect(resultado.adicionales_usd).toBe("20.00");
    expect(resultado.total_usd).toBe("150.00");
    const toldo = resultado.lineas.find((l) => l.concepto === "Alquiler de toldo");
    expect(toldo?.total_usd).toBe("20.00");
  });

  it("ignora líneas con cantidad cero o negativa", () => {
    const resultado = calcularPrecioAdministrado({
      ...entradaAdmin(),
      lineas: [{ concepto: "Toldo", cantidad: 0, precio_unit_usd: "10.00" }],
    });
    expect(resultado.adicionales_usd).toBe("0.00");
    expect(resultado.total_usd).toBe("130.00");
  });

  it("aplica descuentos y recargos manuales con motivo", () => {
    const resultado = calcularPrecioAdministrado({
      ...entradaAdmin(),
      ajustes: [
        { tipo: "descuento", monto_usd: "30.00", motivo: "Convenio familiar" },
        { tipo: "recargo", monto_usd: "5.00", motivo: "Traslado extra" },
      ],
    });
    // base 130 + recargo 5 − descuento 30 = 105
    expect(resultado.adicionales_usd).toBe("5.00");
    expect(resultado.descuento_usd).toBe("30.00");
    expect(resultado.total_usd).toBe("105.00");
  });

  it("el total nunca queda negativo aunque el descuento supere la base", () => {
    const resultado = calcularPrecioAdministrado({
      ...entradaAdmin(),
      ajustes: [{ tipo: "descuento", monto_usd: "500.00", motivo: "Cortesía" }],
    });
    expect(resultado.total_usd).toBe("0.00");
  });

  it("descuenta lo ya pagado del saldo", () => {
    const resultado = calcularPrecioAdministrado({
      ...entradaAdmin(),
      lineas: [{ concepto: "Toldo", cantidad: 1, precio_unit_usd: "20.00" }],
      saldoPrevio: "100.00",
    });
    expect(resultado.total_usd).toBe("150.00");
    expect(resultado.saldo_usd).toBe("50.00");
  });

  it("avisa cuando una categoría no tiene tarifa", () => {
    const resultado = calcularPrecioAdministrado({
      pasajeros: [{ categoria: "Infante" }],
      tarifas,
    });
    expect(resultado.advertencias).toHaveLength(1);
    expect(resultado.total_usd).toBe("0.00");
  });
});

describe("precio — opciones agotadas", () => {
  it("marca las opciones cuyo cupo se agotó", () => {
    const agotadas = detectarOpcionesAgotadas(
      [
        { campo_id: "almuerzo", opcion: "pescado", cupo: 20, agotados: 20 },
        { campo_id: "almuerzo", opcion: "pollo", cupo: 20, agotados: 5 },
      ],
      { almuerzo: "pescado" },
    );
    expect(agotadas["almuerzo:pescado"]).toBe(true);
    expect(agotadas["almuerzo:pollo"]).toBeUndefined();
  });

  it("no marca nada cuando no hay cupos agotados", () => {
    const agotadas = detectarOpcionesAgotadas(
      [{ campo_id: "almuerzo", opcion: "pescado", cupo: 20, agotados: 3 }],
      { almuerzo: "pescado" },
    );
    expect(agotadas).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Edge cases: cantidades hostiles, descuentos extremos y cupos en el límite.
// ---------------------------------------------------------------------------

describe("edge cases — cantidad de extras", () => {
  it("un global en 0 gana sobre los valores por pasajero (los ignora)", () => {
    const entrada = entradaBase();
    entrada.respuestasGlobales = { toldo: 0 };
    entrada.pasajeros = [
      { categoria: "Adulto", respuestas: { toldo: 2 } },
      { categoria: "Adulto", respuestas: { toldo: 1 } },
    ];
    const resultado = calcularPrecio(entrada);
    expect(resultado.adicionales_usd).toBe("0.00");
    expect(resultado.total_usd).toBe("100.00"); // solo las 2 tarifas
  });

  it("un global vacío o no numérico cae a la suma por pasajero", () => {
    for (const global of ["", "   ", "abc", NaN, Infinity, true] as const) {
      const entrada = entradaBase();
      entrada.respuestasGlobales = { toldo: global as never };
      entrada.pasajeros = [{ categoria: "Adulto", respuestas: { toldo: 2 } }];
      const resultado = calcularPrecio(entrada);
      expect(resultado.adicionales_usd, `global=${String(global)}`).toBe("20.00");
    }
  });

  it("cantidades string, negativas, fraccionarias y booleanas", () => {
    const con = (valor: unknown) => {
      const entrada = entradaBase();
      entrada.respuestasGlobales = { toldo: valor as never };
      return calcularPrecio(entrada);
    };
    expect(con("2").adicionales_usd).toBe("20.00");
    expect(con("2.5").adicionales_usd).toBe("25.00"); // fracción permitida
    expect(con(-3).adicionales_usd).toBe("0.00"); // cantidad <= 0 no genera línea
    expect(con(1.5).lineas.find((l) => l.concepto === "Alquiler de toldo")?.cantidad).toBe(1.5);
  });
});

describe("edge cases — promociones y saldo", () => {
  it("un porcentaje mayor a 100 se topa en la base (total 0)", () => {
    const resultado = calcularPrecio({
      ...entradaBase(),
      promocion: { tipo: "porcentaje", valor: 150 },
    });
    expect(resultado.descuento_usd).toBe("130.00");
    expect(resultado.total_usd).toBe("0.00");
  });

  it("un descuento negativo actúa como recargo (documentado)", () => {
    // No hay validación de signo: -10% resta un descuento negativo.
    const resultado = calcularPrecio({
      ...entradaBase(),
      promocion: { tipo: "porcentaje", valor: -10 },
    });
    expect(resultado.descuento_usd).toBe("-13.00");
    expect(resultado.total_usd).toBe("143.00");
  });

  it("saldo previo basura o negativo se sanea a cero", () => {
    expect(calcularPrecio({ ...entradaBase(), saldoPrevio: "abc" }).saldo_usd).toBe("130.00");
    // Un saldo negativo AUMENTA el saldo pendiente (documentado).
    const negativo = calcularPrecio({ ...entradaBase(), saldoPrevio: "-50.00" });
    expect(negativo.saldo_usd).toBe("180.00");
  });
});

describe("edge cases — precio administrado", () => {
  function entradaAdmin(): EntradaCalculoAdministrado {
    return {
      pasajeros: [{ categoria: "Adulto" }, { categoria: "Adulto" }],
      tarifas,
    };
  }

  it("cantidad fraccionaria se redondea hacia abajo", () => {
    const resultado = calcularPrecioAdministrado({
      ...entradaAdmin(),
      lineas: [{ concepto: "Toldo", cantidad: 2.7, precio_unit_usd: "10.00" }],
    });
    const linea = resultado.lineas.find((l) => l.concepto === "Toldo");
    expect(linea?.cantidad).toBe(2);
    expect(linea?.total_usd).toBe("20.00");
  });

  it("cantidad NaN produce una línea con total NaN que no suma al adicional", () => {
    // BUG documentado: Math.max(0, Math.floor(NaN)) = NaN, NaN <= 0 es false,
    // así que se crea la línea; pero addDecimals sanea "NaN" a 0.00.
    const resultado = calcularPrecioAdministrado({
      ...entradaAdmin(),
      lineas: [{ concepto: "Toldo", cantidad: NaN, precio_unit_usd: "10.00" }],
    });
    const linea = resultado.lineas.find((l) => l.concepto === "Toldo");
    expect(linea).toBeDefined();
    expect(linea?.total_usd).toBe("NaN");
    expect(resultado.adicionales_usd).toBe("0.00");
    expect(resultado.total_usd).toBe("100.00"); // solo las 2 tarifas Adulto
  });

  it("un ajuste con tipo desconocido cae a la rama de recargo", () => {
    const resultado = calcularPrecioAdministrado({
      ...entradaAdmin(),
      ajustes: [{ tipo: "otro" as never, monto_usd: "10.00", motivo: "Raro" }],
    });
    expect(resultado.adicionales_usd).toBe("10.00");
    expect(resultado.lineas.find((l) => l.concepto === "Raro")?.detalle).toBe(
      "Recargo administrativo",
    );
  });

  it("un motivo de sólo espacios usa la etiqueta por defecto", () => {
    const resultado = calcularPrecioAdministrado({
      ...entradaAdmin(),
      ajustes: [
        { tipo: "descuento", monto_usd: "5.00", motivo: "   " },
        { tipo: "recargo", monto_usd: "5.00" },
      ],
    });
    expect(resultado.lineas.find((l) => l.concepto === "Descuento")).toBeDefined();
    expect(resultado.lineas.find((l) => l.concepto === "Recargo")).toBeDefined();
  });
});

describe("edge cases — categorías y tasa", () => {
  const tarifasEdad = [
    { categoria: "Adulto" as Categoria, edad_min: 18, edad_max: 120, precio_usd: "50.00" },
    { categoria: "Niño" as Categoria, edad_min: 3, edad_max: 11, precio_usd: "30.00" },
  ];

  it("en rangos solapados gana la primera tarifa", () => {
    const solapadas = [
      { categoria: "VIP" as Categoria, edad_min: 0, edad_max: 200 },
      { categoria: "Adulto" as Categoria, edad_min: 18, edad_max: 120 },
    ];
    expect(calcularCategorias(solapadas, "2026-12-14", "1990-01-01")).toBe("VIP");
  });

  it("la edad en los bordes exactos min/max entra en la categoría", () => {
    // Nacido el 14-12-1990 → 36 años el 14-12-2026 (bordes Adulto 18..120).
    expect(calcularCategorias(tarifasEdad, "2026-12-14", "1990-12-14")).toBe("Adulto");
    // Recién cumplió 18 ese día también es Adulto.
    expect(calcularCategorias(tarifasEdad, "2026-12-14", "2008-12-14")).toBe("Adulto");
    // Un día antes de cumplir 18 sigue sin categoría.
    expect(calcularCategorias(tarifasEdad, "2026-12-14", "2008-12-15")).toBeNull();
  });

  it("fecha de salida inválida devuelve null", () => {
    expect(calcularCategorias(tarifasEdad, "no-fecha", "1990-01-01")).toBeNull();
  });

  it("tasa cero, negativa o basura devuelve null", () => {
    expect(totalBs("100.00", "0")).toBeNull();
    expect(totalBs("100.00", "-5")).toBeNull();
    expect(totalBs("100.00", "abc")).toBeNull();
    expect(totalBs("100.00", "")).toBeNull();
    // Coma decimal sí se acepta (toDecimalString la normaliza).
    expect(totalBs("100.00", "36,50")).toBe("3650.00");
  });
});

describe("edge cases — opciones agotadas", () => {
  it("cupo 0 con agotados 0 ya está agotado", () => {
    const agotadas = detectarOpcionesAgotadas(
      [{ campo_id: "toldo", opcion: "si", cupo: 0, agotados: 0 }],
      {},
    );
    expect(agotadas["toldo:si"]).toBe(true);
  });

  it("agotados por encima del cupo también marca agotado", () => {
    const agotadas = detectarOpcionesAgotadas(
      [{ campo_id: "toldo", opcion: "si", cupo: 5, agotados: 9 }],
      {},
    );
    expect(agotadas["toldo:si"]).toBe(true);
  });

  it("respuestas con valores no-string se ignoran", () => {
    const agotadas = detectarOpcionesAgotadas(
      [
        { campo_id: "c1", opcion: "1", cupo: 1, agotados: 1 },
        { campo_id: "c2", opcion: "true", cupo: 1, agotados: 1 },
      ],
      {
        c1: 1, // number: no matchea "c1:1"
        c2: true, // boolean
        c3: ["a", 2, null], // array mixto
      } as never,
    );
    expect(agotadas["c1:1"]).toBe(true); // viene del cupo, no de la respuesta
    expect(agotadas["c2:true"]).toBe(true); // idem
    expect(Object.keys(agotadas)).toHaveLength(2);
  });

  it("una opción con ':' en el nombre puede colisionar de clave (documentado)", () => {
    // campo "a" + opción "b:c" y campo "a:b" + opción "c" producen "a:b:c".
    const agotadas = detectarOpcionesAgotadas(
      [
        { campo_id: "a", opcion: "b:c", cupo: 1, agotados: 1 },
        { campo_id: "a:b", opcion: "c", cupo: 10, agotados: 0 },
      ],
      { "a:b": "c" }, // el cliente eligió "c" en el campo "a:b" (no agotado)
    );
    // Las dos opciones producen la MISMA clave "a:b:c": el segundo cupo
    // (no agotado) sobrescribe el estado en estadoPorOpcion, pero la primera
    // ya dejó la marca en `agotadas` → queda reportada como agotada.
    expect(agotadas["a:b:c"]).toBe(true);
  });
});
