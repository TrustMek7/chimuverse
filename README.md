# Chimuverse ♡

**Un universo que construimos juntos.** Aplicación web privada para José Luis y Glenny Shinderly. Nombre de trabajo del saludo: *Chimuelitos*.

> Estado: aplicación implementada con el diseño v2 de `design/`. La activación remota de Supabase y Google requiere completar credenciales de administración y OAuth. Ver [estado de implementación](docs/implementation-status.md).

## Stack acordado
- React + TypeScript + Vite; Tailwind CSS
- React Router, TanStack Query, React Hook Form + Zod
- Supabase PostgreSQL, Auth con Google, Storage, Realtime y Edge Functions
- FullCalendar + Google Calendar API para sincronización bidireccional
- Correo: Gmail API o Apps Script, **por decidir**; push futuro
- Vitest + Playwright; despliegues separados de frontend en Vercel y backend en Supabase

## Separación de código y entornos

```text
frontend/                 React + Vite + Tailwind
  .env.local              URL y clave publicable para el navegador (ignorado)
  .env.example            Plantilla pública del frontend
backend/                  Lógica de servidor y base de datos
  .env                    Credenciales de servidor (ignorado)
  .env.example            Plantilla sin secretos reales
  supabase/functions/     Edge Functions y operaciones privilegiadas
  supabase/migrations/    SQL y políticas RLS
docs/                     Guías, arquitectura y diseño
```

Cada parte tendrá su instalación y despliegue independiente. Vercel debe usar `frontend/` como raíz; los archivos de `backend/` no forman parte del bundle web. El frontend nunca importa archivos ni credenciales del backend. Compartir un repositorio no publica los archivos de entorno: Git los ignora y las claves privadas solo se cargan en servidor.

## Documentación
1. [Requerimientos y alcance](docs/requirements.md)
2. [Arquitectura y seguridad](docs/architecture.md)
3. [Base de datos](docs/database.md)
4. [Integraciones de Google y notificaciones](docs/integrations.md)
5. [API y funciones](docs/api.md)
6. [Roadmap](docs/roadmap.md)
7. [Decisiones abiertas](docs/decisions.md)
8. [Guía de arranque](docs/getting-started.md)
9. [Configuración de Supabase y Google OAuth](docs/supabase-setup.md)

## Para empezar

```powershell
cd frontend
npm ci
npm run dev
```

Para configurar la base de datos, Google y el despliegue, seguir [la guía de arranque](docs/getting-started.md). Los entornos existentes se conservan; los secretos no se suben a Git.

Diseño: [handoff v2](design/handoff/HANDOFF.md). Estado de módulos y dependencias externas: [implementación](docs/implementation-status.md).

## Reglas de colaboración
- Una rama por funcionalidad (`feature/...`), PR revisado por la otra persona.
- Nunca subir `.env`, secretos, tokens OAuth, claves de servicio ni fotos privadas.
- Mantener documentación y migraciones actualizadas junto con cada cambio.
