# Ruta Clara · CRM de reservas

Sistema de reservas de una agencia de viajes especializada en **Full Days** y
**Fines de Semana**: panel administrativo (CRM) y formulario público
mobile-first al que el cliente entra desde un enlace enviado por WhatsApp.
Registro del titular y su grupo, preguntas del tour (almuerzos, alergias,
punto de abordaje), firma digital de términos, reporte de pago, validación
administrativa y emisión del voucher en PDF.

El frontend consume el **backend NestJS real** ubicado en `../backend`
(`http://localhost:3001/api/v1`). La lógica de negocio —máquina de estados,
cuentos, precios, idempotencia, versionado optimista— vive en el servidor;
el cliente solo muestra (`src/lib/domain/api.ts` define el contrato).

> El mock en `src/lib/mock/` se conserva para pruebas unitarias y como
> referencia del contrato; no es la fuente de datos en desarrollo.

---

## Cómo ejecutarlo

```bash
# 1. Backend (una sola vez, o cuando cambie el schema)
cd ../backend
ppnpm install --frozen-lockfile
pnpm seed        # datos demo: usuarios, catálogo, fechas, tarifas
pnpm start:dev   # API en http://localhost:3001/api/v1

# 2. Frontend
cd ruta-clara-travel-vouchers
ppnpm install --frozen-lockfile
pnpm dev         # http://localhost:8080 (o el puerto que indique Vite)
```

Otros comandos:

```bash
pnpm lint      # eslint
pnpm typecheck # tsc --noEmit
pnpm test      # vitest
pnpm build     # build de producción
pnpm preview   # sirve el build
```

> El gestor de paquetes es **pnpm** en ambos repos (nada de npm ni bun).

### Credenciales de la demo (solo desarrollo)

Las credenciales de demostración se muestran en `/admin/login` **únicamente
en desarrollo** (`import.meta.env.DEV`); en producción el login es limpio.

| Rol                 | Correo                   | Contraseña | Puede                                |
| ------------------- | ------------------------ | ---------- | ------------------------------------ |
| Superadministradora | `admin@rutaclara.ve`     | `demo1234` | Todo                                 |
| Operadora           | `operador@rutaclara.ve`  | `demo1234` | Enlaces, reservas, pagos en efectivo |
| Validador           | `validador@rutaclara.ve` | `demo1234` | Aprobar / rechazar pagos             |
| Guía                | `guia@rutaclara.ve`      | `demo1234` | Manifiesto y cocina (solo lectura)   |

> **2FA está desactivado** del flujo de autenticación (login, rutas, seeds y
> UI). Las columnas `dos_fa_activo`/`totp_secret_enc` permanecen en la base
> por compatibilidad pero no participan en auth.
>
> Los enlaces de "recuperar/restablecer contraseña" están **ocultos** hasta
> que exista proveedor de correo; los endpoints del backend quedan como
> placeholders.

### Entrada y rutas principales

| Ruta             | Descripción                                                                          |
| ---------------- | ------------------------------------------------------------------------------------ |
| `/`              | Entrada admin: autenticado → `/admin`; sin sesión → `/admin/login`                   |
| `/admin/login`   | Login (sin 2FA; credenciales demo solo en dev)                                       |
| `/admin`         | Panel: dashboard, reservas, pagos, salidas, tours, clientes, reportes, configuración |
| `/r/:token`      | Formulario público de reserva (enlace enviado al cliente)                            |
| `/v/:verifToken` | Verificación pública del QR del voucher                                              |

---

## Funciones implementadas sobre el backend

- **Vouchers en PDF**: al aprobarse el pago completo, la máquina de estados
  confirma la reserva, asigna el código `VJ-AAAA-NNNNN` y encola
  `voucher.generar`. El worker genera el PDF con Playwright, lo sube al
  storage privado y registra `Archivo` + `Voucher.archivo_id`. Las descargas
  usan URLs firmadas con expiración. Regeneración crea una nueva versión y
  reemplaza la vigente; cancelar la reserva invalida el voucher y el QR
  reporta la cancelación.
- **Exportaciones XLSX asíncronas**: `POST /exportaciones` encola el job;
  el worker genera el workbook con `exceljs`, lo sube como archivo privado
  (`proposito='exportacion'`, expiración 24 h) y el frontend hace polling del
  estado en `/admin/reportes`. Tipos: `reservas`, `tours`, `clientes`,
  `pagos`, `pasajeros_tour`, `manifest`, `cocina`.
- **Archivos privados**: abstracción `ArchivoStorage` con adaptador local
  (dev/tests, URLs firmadas HMAC servidas por `GET /archivos/local/*`) y
  adaptador S3-compatible (producción, URLs firmadas del bucket).
- **CRUD admin**: el panel consume `/adminfx/*`, que delega las mutaciones
  sensibles en los servicios de dominio (`ReservasService`, `PagosService`,
  `FechasService`, `ToursService`).

---

## Arquitectura

```
src/
  lib/
    domain/          Lógica de dominio pura (sin React, sin red)
      types.ts         Contratos de dominio (Reserva, Pasajero, CampoDef, Pago…)
      api.ts           Contrato de la API + clase ApiError
      form-engine.ts   Motor de formularios dinámicos (alcance, visible_si, agotadas)
      pricing.ts       Cálculo de precio (subtotal + extras − descuentos)
      state-machine.ts Transiciones de la reserva (T1–T11)
      validators.ts    Validación de titular, documento, teléfono, edad
    mock/            "Servidor" simulado en memoria (solo tests)
      seed.ts          Datos semilla deterministas
      db.ts            Estado en memoria + índices por id
      api.ts           Implementación de la API (cupos, hold, idempotencia, conflictos)
    api/index.ts     Cliente HTTP real → backend NestJS (ApiSurface)
    format.ts        Formateadores (dinero es-VE, fechas, teléfono, enmascarado)
    brand.ts         Identidad de la agencia y rutas
    i18n/es.ts       Diccionario de textos compartidos
    hooks/           use-conexion, use-cuenta-regresiva, use-copiar, use-media-query
  components/
    core/            Componentes compartidos (C-01..C-30 del Spec)
    publica/         App pública: layout, pantallas P-01..P-15, form-engine
    admin/           Panel administrativo: shell, auth, reservas, pagos, salidas, tours
  routes/            Rutas de TanStack Router (file-based)
  test/              Pruebas: dominio, semilla y flujo completo del backend simulado
```

### Decisiones de diseño

| Decisión                                       | Motivo                                                                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **El servidor manda; el cliente solo muestra** | Regla del PRD §11 y del Spec (FD-06). El cliente sugiere; el servidor calcula precio, categoría, cupos y estados.                            |
| **`paso_actual` decide la pantalla**           | No existen URLs por paso: se evita saltarse pasos y estados incoherentes (Spec §4.2).                                                        |
| **Formularios versionados con snapshot**       | Una reserva conserva el formulario con el que respondió aunque el tour se edite (RF-3.7).                                                    |
| **Dinero como string decimal**                 | Nunca `number` de punto flotante. Las sumas usan helpers en `src/lib/format.ts`.                                                             |
| **Zona horaria `America/Caracas`**             | Todos los instantes se muestran en la zona de la agencia, no en la del dispositivo (FD-08).                                                  |
| **`exactOptionalPropertyTypes` relajado**      | Radix/shadcn no declaran `disabled?: boolean \| undefined` y toda la app comparte props opcionales. `noUncheckedIndexedAccess` sigue activo. |

### Reglas de la interfaz que sí se respetan

- **Mobile-first**: viewport mínimo 360×640, una columna, objetivos táctiles de 44 px, acción principal anclada abajo.
- **El estado nunca se comunica solo con color**: siempre icono + texto.
- **El cliente nunca ve un código técnico**: los errores se traducen a lenguaje de persona, junto al campo que falla.
- **Nunca se pierde lo escrito**: autoguardado con debounce, cola de escrituras (una en vuelo) y aviso de «Sin conexión».
- **Una intención, una `Idempotency-Key`**: la clave se genera al pulsar y se reutiliza al reintentar.
- **`version` en cada escritura**: ante `409 VERSION_DESACTUALIZADA` se recarga, se fusiona y se avisa.
- **Nada sensible en el almacenamiento del navegador**: el token del enlace sale de la URL de inmediato y vive en memoria + `sessionStorage`; los documentos nunca se guardan en `localStorage`.

---

## Pruebas

```bash
pnpm test
```

| Archivo                                 | Qué cubre                                                                                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/test/domain/form-engine.test.ts`   | Alcance, `visible_si`, limpieza, opciones agotadas, defaults                                                                              |
| `src/test/domain/pricing.test.ts`       | Subtotal por categoría, extras, descuentos, saldo                                                                                         |
| `src/test/domain/state-machine.test.ts` | Transiciones permitidas y prohibidas                                                                                                      |
| `src/test/domain/validators.test.ts`    | Documento, teléfono, correo, edad, duplicados                                                                                             |
| `src/test/mock/seed.test.ts`            | Integridad de los datos semilla (referencias, tarifas, snapshots)                                                                         |
| `src/test/mock/api.test.ts`             | **Flujo completo**: enlace → titular → acompañantes → preguntas → resumen → firma → pago → validación → voucher, más los caminos de error |

---

## Documentos de origen

- `../PRD v2.0 — Sistema CRM, Formularios Dinámicos y Reservas para Agencia de Viajes.md`
- `../Spec Frontend — CRM, Formularios Dinámicos y Reservas.md`
- `../Spec Backend — CRM, Formularios Dinámicos y Reservas.md`
