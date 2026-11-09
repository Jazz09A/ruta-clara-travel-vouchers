import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, limpiarAccessToken, tokenAccesoActual } from "@/lib/api";
import { ApiError } from "@/lib/domain/api";

/**
 * Cliente del onboarding contra el API real.
 *
 * Lo que importa aquí es el contrato del auto-login: tras el alta, el access
 * token tiene que quedar en memoria (si no, la sesión no existe y el usuario
 * vuelve al login) y el error 409 del servidor debe llegar tipado.
 */

function respuesta(status: number, cuerpo: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => cuerpo,
    headers: { get: () => null },
  } as unknown as Response;
}

describe("cliente del onboarding", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    limpiarAccessToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    limpiarAccessToken();
  });

  it("consulta si la instalación necesita onboarding", async () => {
    fetchMock.mockResolvedValueOnce(respuesta(200, { requiere_onboarding: true }));

    const estado = await api.setup.estado();

    expect(estado.requiere_onboarding).toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/setup/estado");
  });

  it("deja la sesión lista tras el alta: guarda el token en memoria", async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta(200, {
        access_token: "access-nuevo",
        refresh_token: "refresh-nuevo",
        usuario: {
          id: "u1",
          nombre: "Ana Pérez",
          correo: "ana@miagencia.com",
          roles: ["superadmin"],
          activo: true,
        },
      }),
    );

    const { usuario } = await api.setup.iniciar({
      nombre: "Ana Pérez",
      correo: "ana@miagencia.com",
      password: "una-clave-larga-123",
      agencia: { nombre: "Mi Agencia" },
    });

    // El token en memoria es lo que permite usar el panel sin volver a entrar.
    expect(tokenAccesoActual()).toBe("access-nuevo");
    expect(usuario.correo).toBe("ana@miagencia.com");
    expect(usuario.rol).toBe("SA");

    const [url, opciones] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("/setup/iniciar");
    expect(opciones.method).toBe("POST");
    expect(JSON.parse(String(opciones.body))).toMatchObject({
      correo: "ana@miagencia.com",
      agencia: { nombre: "Mi Agencia" },
    });
  });

  it("propaga el 409 cuando la instalación ya tiene administrador", async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta(409, {
        codigo: "SETUP_YA_COMPLETADO",
        mensaje: "La configuración inicial ya fue completada.",
      }),
    );

    await expect(
      api.setup.iniciar({
        nombre: "Ana",
        correo: "ana@miagencia.com",
        password: "una-clave-larga-123",
        agencia: { nombre: "Mi Agencia" },
      }),
    ).rejects.toMatchObject({ codigo: "SETUP_YA_COMPLETADO", status: 409 });
  });

  it("traduce el error del servidor a ApiError", async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta(422, { codigo: "VALIDACION", mensaje: "Datos inválidos" }),
    );

    const fallo = await api.setup.estado().catch((e: unknown) => e);

    expect(fallo).toBeInstanceOf(ApiError);
    expect((fallo as ApiError).codigo).toBe("VALIDACION");
  });
});
