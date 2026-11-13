# Arquitectura inicial

## Decisión
**Frontend y backend en carpetas y despliegues independientes.** `frontend/` contiene React/Vite como sitio estático; `backend/` contiene la lógica de servidor, migraciones y funciones de Supabase (Postgres, Auth, Storage, Realtime, Edge Functions). No NestJS ni Django al inicio. Ambos se conservan en el repositorio actual; esta separación no implica crear dos repositorios Git.

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
- La raíz de compilación de Vite y de despliegue en Vercel es exclusivamente `frontend/`.
- `frontend/.env.local` contiene solo configuración pública `VITE_`; `backend/.env` contiene credenciales privadas sin prefijo `VITE_`. No hay archivo de entorno compartido en la raíz.
- Las funciones verifican identidad y permisos antes de usar credenciales privilegiadas. La clave secreta no sustituye la autorización de cada operación.

## Estructura prevista
- `frontend`: React + Vite + Tailwind
- `backend/supabase/migrations`: SQL versionado
- `backend/supabase/functions`: Edge Functions
- `frontend/.env.example`: plantilla de configuración pública
- `backend/.env.example`: plantilla de configuración del servidor
- `docs`: decisiones y contratos

## Diseño
**No definir paleta, tipografía ni componentes visuales todavía.** Se trabajará posteriormente con Claude Design.
