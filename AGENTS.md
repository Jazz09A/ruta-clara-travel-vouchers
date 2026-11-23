<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

<!-- DEVIN:BEGIN -->

## Notas del proyecto (Devin)

- **Dos repositorios separados**: el frontend es este repo; el backend NestJS
  vive en `../backend` (repo propio, hacer commits por separado).
- **Gestor de paquetes: pnpm** (nada de npm/bun). Ambos repos llevan
  `packageManager` en `package.json` y `pnpm-lock.yaml`; usa siempre
  `pnpm install --frozen-lockfile` en CI.
- Backend dev: `cd ../backend && pnpm seed && pnpm start:dev`
  (API en `http://localhost:3001/api/v1`, SQLite en `data/dev.sqlite`).
- Verificación frontend: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm build`.
- Verificación backend: `pnpm typecheck`, `pnpm test`, `pnpm build`.
- **Flujo de ramas**: `feature/*` → PR a `staging`; `staging` → PR a `main`
  (producción). `main` está protegida: solo por PR y con todos los checks
  verdes. Producción se despliega solo al mergear a `main` (ver
  `.github/workflows/`).
- 2FA está fuera del flujo de auth (frontend, backend y seeds). No
  reintroducirlo sin pedido explícito. Recuperación de contraseña sigue
  oculta en la UI.
- Archivos privados: storage abstraction en `backend/src/modules/archivos/storage/`
  (local con URLs firmadas HMAC en dev, S3-compatible en prod). Nunca servir
  archivos por rutas estáticas públicas.
- Vouchers y exportaciones XLSX se generan async vía `outbox_evento` +
  `JobsService` (tick 60 s en dev).
- El alta de tours usa el **documento de tour** (la forma de
  `backend/catalogo-escapate.json`): `backend/src/modules/catalogo/documento.ts`
  es la lógica compartida entre el panel y el importador por CLI. La hora de
  recogida es **por tour** (`tour_punto_abordaje`), no la del catálogo global.
- Los requisitos para activar un tour los calcula el servidor
  (`GET /adminfx/tours/{id}/requisitos`); el panel sólo los muestra.

<!-- DEVIN:END -->
