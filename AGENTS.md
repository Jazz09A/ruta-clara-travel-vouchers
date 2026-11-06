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
- Backend dev: `cd ../backend && npm run seed && npm run start:dev`
  (API en `http://localhost:3001/api/v1`, SQLite en `data/dev.sqlite`).
- Verificación frontend: `npm run test`, `npm run lint`, `npm run build`.
- Verificación backend: `npm run typecheck`, `npm run build`.
- 2FA está fuera del flujo de auth (frontend, backend y seeds). No
  reintroducirlo sin pedido explícito. Recuperación de contraseña sigue
  oculta en la UI.
- Archivos privados: storage abstraction en `backend/src/modules/archivos/storage/`
  (local con URLs firmadas HMAC en dev, S3-compatible en prod). Nunca servir
  archivos por rutas estáticas públicas.
- Vouchers y exportaciones XLSX se generan async vía `outbox_evento` +
  `JobsService` (tick 60 s en dev).
<!-- DEVIN:END -->
