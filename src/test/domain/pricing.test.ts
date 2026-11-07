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
