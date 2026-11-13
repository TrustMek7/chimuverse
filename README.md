# Chimuverse ♡

**Un universo que construimos juntos.** Aplicación web privada para José Luis y Glenny Shinderly. Nombre de trabajo del saludo: *Chimuelitos*.

> Estado: documentación y estructura inicial. **No hay aplicación funcional todavía.** Diseño, colores y componentes visuales pendientes (se trabajarán posteriormente con Claude Design).

## Stack acordado
- React + TypeScript + Vite; Tailwind CSS
- React Router, TanStack Query, React Hook Form + Zod
- Supabase PostgreSQL, Auth con Google, Storage, Realtime y Edge Functions
- FullCalendar + Google Calendar API para sincronización bidireccional
- Correo: Gmail API o Apps Script, **por decidir**; push futuro
- Vitest + Playwright; Vercel + Supabase; GitHub monorepo

## Documentación
1. [Requerimientos y alcance](docs/requirements.md)
2. [Arquitectura y seguridad](docs/architecture.md)
3. [Base de datos](docs/database.md)
4. [Integraciones de Google y notificaciones](docs/integrations.md)
5. [API y funciones](docs/api.md)
6. [Roadmap](docs/roadmap.md)
7. [Decisiones abiertas](docs/decisions.md)
8. [Guía de arranque](docs/getting-started.md)

## Para empezar
1. Crear repositorio privado en GitHub y subir este contenido.
2. Leer `docs/getting-started.md` y crear el proyecto Vite dentro de `apps/web`.
3. Crear proyecto Supabase, configurar Google OAuth y **restringir acceso a los dos usuarios**.
4. Crear las migraciones versionadas y políticas RLS antes de almacenar datos reales.
5. Implementar primero login, perfiles y tareas.

La carpeta `apps/web` es un **placeholder**: este ZIP no contiene un frontend generado ni dependencias instaladas. Los comandos de inicialización están en la guía.

## Reglas de colaboración
- Una rama por funcionalidad (`feature/...`), PR revisado por la otra persona.
- Nunca subir `.env`, secretos, tokens OAuth, claves de servicio ni fotos privadas.
- Mantener documentación y migraciones actualizadas junto con cada cambio.
