import { describe, expect, it } from "vitest";

import {
  FORMULARIO_VACIO,
  MIN_PASSWORD,
  reglasPassword,
  validarAgencia,
  validarCuenta,
  type FormularioInstalacion,
} from "@/lib/onboarding";

/**
 * Reglas del onboarding del primer arranque.
 *
 * Se verifica el porqué de cada regla: son las mismas que aplica el backend,
 * y el formulario no debe dejar pasar al paso siguiente lo que el servidor
 * va a rechazar.
 */

const cuentaValida: FormularioInstalacion = {
  ...FORMULARIO_VACIO,
  nombre: "Ana Pérez",
  correo: "ana@miagencia.com",
  password: "una-clave-larga-123",
  confirmar: "una-clave-larga-123",
};

describe("reglas del onboarding", () => {
  it("acepta una cuenta bien formada", () => {
    expect(validarCuenta(cuentaValida)).toEqual({});
  });

  it("exige el nombre del administrador", () => {
    const errores = validarCuenta({ ...cuentaValida, nombre: " " });
    expect(errores.nombre).toBeTruthy();
  });

  it("rechaza un correo mal formado", () => {
    expect(validarCuenta({ ...cuentaValida, correo: "ana@sin-punto" }).correo).toBeTruthy();
    expect(validarCuenta({ ...cuentaValida, correo: "" }).correo).toBeTruthy();
  });

  it("exige una contraseña de 10 caracteres o más", () => {
    const corta = "corta1234";
    const errores = validarCuenta({
      ...cuentaValida,
      password: corta,
      confirmar: corta,
    });
    expect(errores.password).toContain(String(MIN_PASSWORD));
  });

  it("exige que la contraseña se repita igual", () => {
    const errores = validarCuenta({ ...cuentaValida, confirmar: "otra-clave-distinta" });
    expect(errores.confirmar).toBeTruthy();
  });

  it("exige el nombre de la agencia", () => {
    expect(validarAgencia({ ...FORMULARIO_VACIO }).agenciaNombre).toBeTruthy();
    expect(validarAgencia({ ...FORMULARIO_VACIO, agenciaNombre: "Mi Agencia" })).toEqual({});
  });

  it("acepta el correo de la agencia vacío, pero no mal formado", () => {
    expect(
      validarAgencia({ ...FORMULARIO_VACIO, agenciaNombre: "Mi Agencia" }).agenciaEmail,
    ).toBeUndefined();
    expect(
      validarAgencia({ ...FORMULARIO_VACIO, agenciaNombre: "Mi Agencia", agenciaEmail: "nope" })
        .agenciaEmail,
    ).toBeTruthy();
  });

  it("muestra las reglas de la contraseña según lo que se escribe", () => {
    const reglas = reglasPassword("abc123");
    expect(reglas).toHaveLength(3);
    expect(reglas.find((r) => r.texto.includes("letra"))?.cumple).toBe(true);
    expect(reglas.find((r) => r.texto.includes("número"))?.cumple).toBe(true);
    expect(reglas.find((r) => r.texto.includes(String(MIN_PASSWORD)))?.cumple).toBe(false);
  });
});
