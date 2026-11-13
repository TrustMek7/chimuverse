# Arquitectura inicial

## Decisión
**Monorepo, no monolito desplegado**. React/Vite como sitio estático; Supabase como backend administrado (Postgres, Auth, Storage, Realtime, Edge Functions). No NestJS ni Django al inicio.

```text
React (Vercel) --> Supabase Auth (Google login)
     |                |
     +--> Supabase Postgres (RLS) / Storage (privado) / Realtime
     +--> Edge Functions (JWT + permisos) --> Google Calendar / correo
                         |
                    tareas programadas / sincronización
```

## Responsabilidades
- **Frontend:** navegación, formularios, vistas, estado de consultas, validación UX.
- **Postgres + RLS:** persistencia, aislamiento por `space_id`, restricciones, operaciones transaccionales (RPC si conviene).
- **Edge Functions:** OAuth externo, cifrado/renovación de tokens, APIs Google, trabajos privilegiados, notificaciones.
- **Storage:** buckets privados; URLs firmadas con caducidad y permisos.

## Seguridad y escalabilidad
- Supabase Auth con Google como proveedor de login; Google Calendar requiere scopes y consentimientos adicionales.
- **No basta filtrar correos en React**: lista autorizada y membresías aplicadas en servidor/DB; revisar políticas RLS en todas las tablas.
- No guardar client secrets, refresh tokens ni service role en Vite. Secretos solo en entorno de funciones.
- Idempotencia para notificaciones/sync, paginación, índices, límites de tamaño de fotos, backups y observabilidad.
- El ORM no es necesario; migraciones SQL versionadas con Supabase CLI.
- Monorepo permite despliegue independiente de web y funciones.

## Estructura prevista
- `apps/web`: React + Vite + Tailwind
- `supabase/migrations`: SQL versionado
- `supabase/functions`: Edge Functions
- `packages/shared`: tipos/validaciones compartidas cuando haga falta
- `docs`: decisiones y contratos

## Diseño
**No definir paleta, tipografía ni componentes visuales todavía.** Se trabajará posteriormente con Claude Design.
