# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.
El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [1.1.0](https://github.com/Jazz09A/ruta-clara-travel-vouchers/compare/v1.0.0...v1.1.0) (2026-11-26)


### Features

* **auth:** onboarding del primer administrador (/admin/setup) ([f39b21f](https://github.com/Jazz09A/ruta-clara-travel-vouchers/commit/f39b21fd0b50b2c64c0fabfc3611d59423b50e26))
* **auth:** onboarding del primer administrador en /admin/setup ([2707944](https://github.com/Jazz09A/ruta-clara-travel-vouchers/commit/270794403912f90c7eec30ba1ec09a2fae1229a7))
* **auth:** rol Administrador (AD) en el panel ([d0a1e40](https://github.com/Jazz09A/ruta-clara-travel-vouchers/commit/d0a1e409d882c8cfb79640b698d9949b8d6b3ca5))
* **auth:** rol Administrador (AD) en el panel ([d818b13](https://github.com/Jazz09A/ruta-clara-travel-vouchers/commit/d818b1357cbe22570a90670bdf6f0c06cc11c582))
* **brand:** rebranding a Escapate Tours con logo oficial ([557670b](https://github.com/Jazz09A/ruta-clara-travel-vouchers/commit/557670b35977a0aa38f85eaa38804eddc3a15ad8))
* implement Ruta Clara plan (1/5 WhatsApp hour notice, 2/5 voucher on signing, 3/5 0% cancellation, 4/5 breakfast flavors, 5/5 payment at link creation) ([1f2c9f6](https://github.com/Jazz09A/ruta-clara-travel-vouchers/commit/1f2c9f65e149f9f3e1624cfad24bc8a723a0ab5c))
* puntos de salida por pasajero, desayuno y correcciones de voucher ([393cada](https://github.com/Jazz09A/ruta-clara-travel-vouchers/commit/393cada10d9b22bceb0bb38b75c3c3d7bf9865f3))
* **reservas:** puntos de salida por pasajero, desayuno y correcciones de voucher ([5e289c4](https://github.com/Jazz09A/ruta-clara-travel-vouchers/commit/5e289c4e477246e2862a704e77cce06214684d3f))
* **voucher:** recortar firma escaneada y aumentar tamaño en voucher ([2c31238](https://github.com/Jazz09A/ruta-clara-travel-vouchers/commit/2c312383335bd23c4895ab067397f11487983f14))


### Bug Fixes

* **ci:** preset node-server en el CD y ssh por el puerto 2222 ([ba44369](https://github.com/Jazz09A/ruta-clara-travel-vouchers/commit/ba443692d582c921f3791664d836fa82dcbe3214))
* **config:** botón Guardar firma no hacía nada tras drag & drop ([3ec3725](https://github.com/Jazz09A/ruta-clara-travel-vouchers/commit/3ec372526e5542a0048c900655e79bf68d4afc2c))
* **config:** guardar firma de empresa fallaba tras arrastrar la imagen ([8d5d3e8](https://github.com/Jazz09A/ruta-clara-travel-vouchers/commit/8d5d3e8f3de51fad067efad21e3a6b0474200471))
* **reservas:** auto-selección de ciudad activa + e2e y CI alineados ([60ed3b8](https://github.com/Jazz09A/ruta-clara-travel-vouchers/commit/60ed3b8e5f3b1d4d7b00abc74be4a9d46e4a1005))


### Performance Improvements

* **sesion:** refresh de token compartido entre pestañas + lazy en imágenes ([3fe409e](https://github.com/Jazz09A/ruta-clara-travel-vouchers/commit/3fe409ed4084917ffab4c079d8c160556b0de2e6))
* **sesion:** refresh de token compartido entre pestañas + lazy en imágenes ([a73c4a2](https://github.com/Jazz09A/ruta-clara-travel-vouchers/commit/a73c4a2bbbe5564265c254e0002009e6ada435fa))

## [1.0.0] - 2026-11-23

Primera versión estable del panel y la app pública de Escapate Tours.

### Añadido

- Flujo público de reserva completo: enlace por tour, datos del titular y
  acompañantes, formulario dinámico, firma y voucher PDF con QR de
  verificación.
- Panel administrativo: dashboard, reservas, pagos, salidas, tours,
  clientes, reportes y configuración (métodos de pago, tasas, políticas,
  plantillas, promos, puntos de salida, usuarios, firma de empresa).
- Onboarding del primer administrador en `/admin/setup` (sin registro
  abierto).
- Autenticación con access token en memoria + refresh por cookie HttpOnly,
  roles y permisos, aviso de inactividad y renovación silenciosa.
- Catálogo de tours por documento (`catalogo-escapate.json`) con asistente
  de alta en el panel.
- Exportaciones XLSX asincrónicas y vouchers PDF generados en worker.
- Marca Escapate Tours: logo oficial en panel, flujo público, voucher y
  favicon.

### Cambiado

- Rebranding completo de «Ruta Clara» a «Escapate Tours».
