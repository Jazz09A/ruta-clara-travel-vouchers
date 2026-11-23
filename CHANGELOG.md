# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.
El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

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
