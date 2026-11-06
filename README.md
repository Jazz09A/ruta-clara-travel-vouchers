# Ruta Clara · CRM de reservas (demo frontend)

Demo **local y sin backend** del sistema de reservas de una agencia de viajes especializada en
**Full Days** y **Fines de Semana**.

Implementa el flujo completo descrito en el **PRD v2.0** y el **Spec Frontend**: un panel
administrativo (CRM) y un formulario público mobile-first al que el cliente entra desde un enlace
enviado por WhatsApp. Registro del titular y su grupo, preguntas del tour (almuerzos, alergias,
punto de abordaje), firma digital de términos, reporte de pago, validación administrativa y emisión
del voucher.

> **No hay backend.** Toda la lógica de negocio —máquina de estados, cupos, hold, precios,
> idempotencia, versionado optimista— está simulada **en el navegador** (`src/lib/mock/`), aplicando
> la misma regla del PRD: *el servidor manda; el cliente solo muestra*.

---

## Cómo ejecutarlo

```bash
bun install
bun run dev      # http://localhost:5173
```

Otros comandos:

```bash
bun run test     # vitest (127 pruebas)
bun run lint     # eslint
bun run build    # build de producción
bun run preview  # sirve el build
```

### Credenciales de la demo

| Rol | Correo | Contraseña | Puede |
| --- | --- | --- | --- |
| Superadministradora | `admin@rutaclara.ve` | `demo1234` | Todo (2FA: `123456`) |
| Operadora | `operador@rutaclara.ve` | `demo1234` | Enlaces, reservas, pagos en efectivo |
| Validador | `validador@rutaclara.ve` | `demo1234` | Aprobar / rechazar pagos |
| Guía | `guia@rutaclara.ve` | `demo1234` | Manifiesto y cocina (solo lectura) |

### Escenarios del cliente

La portada (`/`) es un lanzador de escenarios. Cada enlace abre la app pública en un estado
distinto de la reserva:

| Enlace | Estado | Pantalla |
| --- | --- | --- |
| `/r/demo1` | Enlace creado | P-01 Bienvenida |
| `/r/demo-enregistro` | En registro (preguntas) | P-04 Preguntas |
| `/r/demo-firma` | Pendiente de firma | P-07 Términos → P-06 Firma |
| `/r/demo-pago` | Pendiente de pago (hold de 23 h) | P-08 Instrucciones de pago |
| `/r/demo-ventana` | Hold de 1 h 30 | P-08 con banner de advertencia |
| `/r/demo-pago-urgente` | Hold de 25 min | P-08 con cuenta regresiva de urgencia |
| `/r/demo-verif` | Pago en verificación | P-09 |
| `/r/demo-confirmada` | Confirmada | P-13 Voucher |
| `/r/demo-cancelada` | Cancelada | P-12 Reserva cerrada |
| `/r/demo-expirada` | Expirada | P-12 Reserva cerrada |
| `/r/demo-enlace-vencido` | Enlace caducado | P-10 Enlace vencido |
| `/r/demo-inexistente` | — | P-11 Enlace inválido |

Verificación pública del QR (la que usa el guía en la calle):
`/v/qr-confirmada`, `/v/qr-cancelada`, `/v/qr-reprogramada`, `/v/qr-completada`.

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
    mock/            "Servidor" simulado en memoria
      seed.ts          Datos semilla deterministas (tours, fechas, reservas, pagos)
      db.ts            Estado en memoria + índices por id
      api.ts           Implementación de la API (cupos, hold, idempotencia, conflictos)
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

| Decisión | Motivo |
| --- | --- |
| **Sin backend**: la API se simula en `src/lib/mock/` | La demo debe arrancar sola, sin dependencias externas. `src/lib/domain/api.ts` define el contrato; sustituir la simulación por un cliente HTTP real solo requiere reimplementar `src/lib/mock/api.ts`. |
| **El servidor calcula precio, categoría, cupos y estados** | Regla del PRD §11 y del Spec (FD-06). El cliente sugiere; el servidor manda. |
| **`paso_actual` decide la pantalla** | No existen URLs por paso: se evita saltarse pasos y estados incoherentes (Spec §4.2). |
| **Formularios versionados con snapshot** | Una reserva conserva el formulario con el que respondió aunque el tour se edite (RF-3.7). |
| **Dinero como string decimal** | Nunca `number` de punto flotante. Las sumas usan helpers en `src/lib/format.ts`. |
| **Zona horaria `America/Caracas`** | Todos los instantes se muestran en la zona de la agencia, no en la del dispositivo (FD-08). |
| **`exactOptionalPropertyTypes` relajado** | Radix/shadcn no declaran `disabled?: boolean \| undefined` y toda la app comparte props opcionales. `noUncheckedIndexedAccess` sigue activo: es la comprobación que evita bugs reales. |

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
bun run test
```

| Archivo | Qué cubre |
| --- | --- |
| `src/test/domain/form-engine.test.ts` | Alcance, `visible_si`, limpieza, opciones agotadas, defaults |
| `src/test/domain/pricing.test.ts` | Subtotal por categoría, extras, descuentos, saldo |
| `src/test/domain/state-machine.test.ts` | Transiciones permitidas y prohibidas |
| `src/test/domain/validators.test.ts` | Documento, teléfono, correo, edad, duplicados |
| `src/test/mock/seed.test.ts` | Integridad de los datos semilla (referencias, tarifas, snapshots) |
| `src/test/mock/api.test.ts` | **Flujo completo**: enlace → titular → acompañantes → preguntas → resumen → firma → pago → validación → voucher, más los caminos de error |

---

## Documentos de origen

- `../PRD v2.0 — Sistema CRM, Formularios Dinámicos y Reservas para Agencia de Viajes.md`
- `../Spec Frontend — CRM, Formularios Dinámicos y Reservas.md`
- `../Spec Backend — CRM, Formularios Dinámicos y Reservas.md`
