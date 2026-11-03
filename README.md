# Ruta Clara Travel Vouchers

| App | Usuario | Prioridad de dispositivo | Ruta base |

| --- | --- | --- | --- |

| **App pública** | Cliente (titular) por enlace único | Móvil (Android gama media, Safari iOS). Escritorio funciona, no se optimiza | `/r/{token}`, `/v/{verif_token}` |

| **Panel admin** | SA, OP, VAL, GU | Móvil usable (el validador y el guía lo usan en la calle), pero el trabajo pesado es en escritorio | `/admin/...` |

Sistema web con dos caras: un **panel administrativo (CRM)** y un **formulario público mobile-first** al que el cliente llega desde un enlace enviado por WhatsApp. Automatiza todo el ciclo de una reserva para una agencia especializada en **Full Days** y **Fines de Semana**: registro del titular y su grupo, respuestas a preguntas específicas del tour (almuerzos, alergias, punto de abordaje), firma digital de términos, reporte de pago, validación administrativa y emisión de un voucher PDF con código QR.

**App pública**

| Ruta | Pantalla |

| --- | --- |

| `/r/{token}` | Entrada única del cliente. Resuelve el estado y muestra la pantalla que corresponda (P-01 a P-13) |

| `/v/{verif_token}` | Verificación de QR (P-14), sin token de enlace |

| `/descarga/voucher?t=...` | Redirección de descarga firmada (P-15) |

| `*` | 404 amable con botón «Contactar por WhatsApp» |

**Panel admin** (todas exigen sesión; el menú se filtra por permisos)

| Ruta | Pantalla | Roles |

| --- | --- | --- |

| `/admin/login`, `/admin/2fa`, `/admin/recuperar`, `/admin/restablecer` | A-01 a A-03 | pública |

| `/admin` | Dashboard (A-04) | SA, OP, VAL |

| `/admin/reservas` | Tablero + lista (A-05) | OP, VAL, SA |

| `/admin/reservas/nueva` | Crear enlace (A-06) | OP, SA |

| `/admin/reservas/{id}` | Detalle de reserva (A-07) | OP, VAL, SA |

| `/admin/pagos` | Cola del validador (A-08) | VAL, SA |

| `/admin/pagos/{id}` | Revisión de pago (A-09) | VAL, SA |

| `/admin/salidas` | Calendario de fechas (A-10) | todos |

| `/admin/salidas/{id}` | Detalle de salida, manifiesto, cocina (A-11) | todos (según rol) |

| `/admin/tours`, `/admin/tours/{id}` | Catálogo y edición (A-12) | SA (lectura: todos) |

| `/admin/tours/{id}/formulario` | Constructor de formulario (A-13) | SA |

| `/admin/clientes`, `/admin/clientes/{id}` | Clientes (A-14) | OP, SA |

| `/admin/reportes` | Reportes y exportaciones (A-15) | SA y parcial |

| `/admin/configuracion/...` | Config, tasa, métodos de pago, términos, plantillas, políticas, promos, usuarios (A-16) | SA |

| `/admin/auditoria` | Auditoría (A-17) | SA |






no se tienen que hacer todas las pantallas, comienza con una en app publica y app admin, de manera que despues se continue, toma esto como contexto de que es la app y mas o menos que deberia llevar y sigue la imagen del modelo del crm que se quiere

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/54da03b8-c3e1-418f-9dc8-3e8f5136621a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
