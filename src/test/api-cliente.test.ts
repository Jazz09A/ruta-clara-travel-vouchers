import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __setAccessToken,
  api,
  limpiarAccessToken,
  tokenAccesoActual,
  verificarQR,
} from "@/lib/api/index";
import { ApiError } from "@/lib/domain/api";

/**
 * Cliente HTTP real (`src/lib/api/index.ts`) con `fetch` stubbeado:
 * transporte, mapeo de errores problem-details, refresh de sesión
 * single-flight y reintento con el token rotado.
 */

function respuesta(
  status: number,
  cuerpo?: unknown,
  opts: { json?: boolean; headers?: Record<string, string> } = {},
): Response {
  const esJson = opts.json !== false && cuerpo !== undefined;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => opts.headers?.[k] ?? null },
    json: async () => {
      if (!esJson) throw new SyntaxError("not json");
      return cuerpo;
    },
  } as unknown as Response;
}

function urlDeLlamada(call: unknown[]): string {
  return String((call[0] as RequestInfo | URL).toString());
}

function headersDeLlamada(call: unknown[]): Record<string, string> {
  return ((call[1] as RequestInit | undefined)?.headers ?? {}) as Record<string, string>;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  limpiarAccessToken();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("transporte — peticiones públicas", () => {
  it("reserva pública envía X-Enlace-Token y parsea el JSON", async () => {
    fetchMock.mockResolvedValue(respuesta(200, { reserva: { id: "r1" } }));
    const resultado = await api.publica.reserva("tok123");

    expect(urlDeLlamada(fetchMock.mock.calls[0]!)).toContain("/public/reserva");
    expect(headersDeLlamada(fetchMock.mock.calls[0]!)["X-Enlace-Token"]).toBe("tok123");
    expect(resultado).toEqual({ reserva: { id: "r1" } });
  });

  it("los parámetros undefined, vacíos y false se omiten de la query", async () => {
    fetchMock.mockResolvedValue(respuesta(200, { items: [] }));
    await api.admin.clientes({ busqueda: "ana" });
    expect(urlDeLlamada(fetchMock.mock.calls[0]!)).toContain("busqueda=ana");

    fetchMock.mockClear();
    fetchMock.mockResolvedValue(respuesta(200, { items: [] }));
    await api.admin.clientes({ busqueda: "" });
    expect(urlDeLlamada(fetchMock.mock.calls[0]!)).not.toContain("busqueda");
  });

  it("una respuesta 204 devuelve undefined sin intentar parsear JSON", async () => {
    fetchMock.mockResolvedValue(respuesta(204));
    const resultado = await api.admin.configuracion();
    expect(resultado).toBeUndefined();
  });
});

describe("transporte — mapeo de errores", () => {
  it("un problem-details se traduce a ApiError con todos sus campos", async () => {
    fetchMock.mockResolvedValue(
      respuesta(422, {
        codigo: "VALIDACION",
        mensaje: "Revisa los datos",
        detalles: [{ campo: "nombre", mensaje: "Obligatorio" }],
        request_id: "req-123",
        data: { extra: 1 },
      }),
    );

    const error = await api.publica.reserva("x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(422);
    expect(apiError.codigo).toBe("VALIDACION");
    expect(apiError.detalles).toEqual([{ campo: "nombre", mensaje: "Obligatorio" }]);
    expect(apiError.requestId).toBe("req-123");
    expect(apiError.data).toEqual({ extra: 1 });
  });

  it("un cuerpo de error no-JSON produce defaults sin romper", async () => {
    fetchMock.mockResolvedValue(respuesta(500, "<html>error</html>", { json: false }));
    const error = await api.publica.reserva("x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(500);
    expect(apiError.codigo).toBe("ERROR_INTERNO");
    expect(apiError.message).toBe("Error 500");
  });

  it("request_id cae al header x-request-id cuando el cuerpo no lo trae", async () => {
    fetchMock.mockResolvedValue(
      respuesta(
        404,
        { codigo: "NO_ENCONTRADO", mensaje: "No existe" },
        {
          headers: { "x-request-id": "hdr-456" },
        },
      ),
    );
    const error = await api.publica.reserva("x").catch((e: unknown) => e);
    expect((error as ApiError).requestId).toBe("hdr-456");
  });
});

describe("sesión admin — refresh y reintento", () => {
  it("un 401 admin dispara refresh y reintenta con el token nuevo", async () => {
    __setAccessToken("viejo");
    fetchMock
      .mockResolvedValueOnce(respuesta(401, { codigo: "NO_AUTENTICADO", mensaje: "expiró" }))
      .mockResolvedValueOnce(respuesta(200, { access_token: "nuevo" }))
      .mockResolvedValueOnce(
        respuesta(200, {
          usuario: { id: "u1", nombre: "A", correo: "a@b.c", roles: ["operador"] },
        }),
      );

    const resultado = await api.admin.yo();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(urlDeLlamada(fetchMock.mock.calls[1]!)).toContain("/auth/refresh");
    // El reintento lleva el token NUEVO, no el viejo.
    expect(headersDeLlamada(fetchMock.mock.calls[2]!)["Authorization"]).toBe("Bearer nuevo");
    expect(tokenAccesoActual()).toBe("nuevo");
    expect(resultado.usuario.rol).toBe("OP");
  });

  it("dos 401 concurrentes comparten UN solo refresh (single-flight)", async () => {
    __setAccessToken("viejo");
    let refreshCalls = 0;
    fetchMock.mockImplementation((input: unknown) => {
      const url = String(input);
      if (url.includes("/auth/refresh")) {
        refreshCalls += 1;
        return Promise.resolve(respuesta(200, { access_token: "nuevo" }));
      }
      // Primera respuesta de cada endpoint admin: 401; luego 200.
      const esReintento = fetchMock.mock.calls.filter((c) => String(c[0]) === url).length > 1;
      return Promise.resolve(
        esReintento ? respuesta(200, { ok: true }) : respuesta(401, { codigo: "X", mensaje: "x" }),
      );
    });

    await Promise.all([api.admin.configuracion(), api.admin.tours()]);
    expect(refreshCalls).toBe(1);
  });

  it("si el refresh falla, el 401 original se propaga", async () => {
    __setAccessToken("viejo");
    fetchMock
      .mockResolvedValueOnce(respuesta(401, { codigo: "NO_AUTENTICADO", mensaje: "expiró" }))
      .mockResolvedValueOnce(
        respuesta(401, { codigo: "NO_AUTENTICADO", mensaje: "refresh muerto" }),
      );

    const error = await api.admin.yo().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2); // sin reintento
  });

  it("un 401 en endpoint público NO intenta refresh", async () => {
    fetchMock.mockResolvedValue(respuesta(401, { codigo: "X", mensaje: "x" }));
    await api.publica.reserva("tok").catch(() => undefined);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(urlDeLlamada(fetchMock.mock.calls[0]!)).not.toContain("/auth/refresh");
  });

  it("renovar() con refresh fallido lanza NO_AUTENTICADO", async () => {
    fetchMock.mockResolvedValue(respuesta(401, {}));
    const error = await api.admin.renovar().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).codigo).toBe("NO_AUTENTICADO");
  });

  it("sin access token el header Authorization no se envía", async () => {
    fetchMock.mockResolvedValue(respuesta(200, { items: [] }));
    await api.admin.configuracion();
    const headers = headersDeLlamada(fetchMock.mock.calls[0]!);
    expect(headers["Authorization"]).toBeUndefined();
  });
});

describe("login y mapeo de usuario", () => {
  it("login guarda el access token; respuesta sin token lanza ERROR_INTERNO", async () => {
    fetchMock.mockResolvedValue(
      respuesta(200, {
        access_token: "abc123",
        refresh_token: "r",
        usuario: { id: "u", nombre: "A", correo: "a@b.c", roles: ["superadmin"] },
      }),
    );
    await api.admin.login({ correo: "a@b.c", password: "x" });
    expect(tokenAccesoActual()).toBe("abc123");

    limpiarAccessToken();
    fetchMock.mockResolvedValue(respuesta(200, { usuario: {} }));
    const error = await api.admin
      .login({ correo: "a@b.c", password: "x" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(500);
  });

  it("usuarioFe mapea roles desconocidos a OP y dos_fa con variantes", async () => {
    __setAccessToken("t");
    fetchMock.mockResolvedValue(
      respuesta(200, {
        id: "u",
        nombre: "X",
        correo: "x@y.z",
        roles: ["rol_inventado"],
        dos_factores_activo: true,
      }),
    );
    const { usuario } = await api.admin.yo();
    expect(usuario.rol).toBe("OP");
    expect(usuario.dos_factores_activo).toBe(true);
    expect(usuario.activo).toBe(true);
  });
});

describe("utilidades", () => {
  it("verificarQR codifica el token en la ruta", async () => {
    fetchMock.mockResolvedValue(respuesta(200, { codigo: "VJ", estado: "confirmada" }));
    await verificarQR("tok/en raro");
    expect(urlDeLlamada(fetchMock.mock.calls[0]!)).toContain("/public/verificar/tok%2Fen%20raro");
  });
});
