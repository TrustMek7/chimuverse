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

## Notificaciones en el celular y la computadora

Chimuverse avisa con notificaciones del sistema (Web Push), aunque la app esté cerrada. Se activan **una vez por dispositivo** desde la tarjeta de Inicio («Activar notificaciones») o desde **Ajustes → Perfil → Notificaciones en tus dispositivos**. Allí también se ven y se quitan los dispositivos activos. Cerrar sesión desactiva los avisos en ese dispositivo.

Los permisos son **por sitio**: permitir Chimuverse no permite a ninguna otra web. Si tu navegador bloquea las notificaciones de todos los sitios, ninguna web puede pedir permiso (el navegador responde «bloqueado» sin preguntar), así que hay que agregar Chimuverse a mano a la lista de permitidos.

### Android (Chrome)
1. Abre Chimuverse y toca **Activar notificaciones** → **Permitir**. No hace falta instalarla, aunque se recomienda (menú ⋮ → **Agregar a pantalla principal**).
2. Si sale «bloqueadas»: Chrome → ⋮ → **Configuración → Configuración de sitios → Notificaciones** → agrega o permite la dirección de Chimuverse.
3. Si no aparecen: Ajustes de Android → **Apps → Chrome → Notificaciones** activadas, y «No molestar» apagado.

### iPhone / iPad (iOS 16.4 o posterior)
1. Abre Chimuverse en **Safari** → **Compartir** → **Agregar a inicio**. En una pestaña de Safari los avisos no funcionan; es una regla de Apple.
2. Abre Chimuverse **desde el ícono** del inicio y toca **Activar notificaciones** → **Permitir**.
3. Si no aparecen: Ajustes de iOS → **Notificaciones → Chimuverse** (aparece como una app aparte), y Modo Concentración desactivado.

### Windows (Chrome o Edge)
1. Toca **Activar notificaciones** → **Permitir**.
2. Si sale «bloqueadas» y tu navegador está en «No permitir que los sitios envíen notificaciones»: en `chrome://settings/content/notifications`, en **Con permiso para enviar notificaciones**, toca **Añadir** y escribe la dirección de Chimuverse (en desarrollo, `http://localhost:5173`; `127.0.0.1` cuenta como otro sitio). Recarga.
3. Si llegan al centro de actividades (Win + A en Windows 10, Win + N en Windows 11) pero no saltan:
   - **Configuración → Sistema → Notificaciones y acciones → Google Chrome** → activa **Mostrar banners de notificación**.
   - Apaga el **Asistente de concentración** (y revisa sus reglas automáticas).
   - Reinicia el navegador.
4. El navegador tiene que estar abierto, aunque sea en segundo plano. Con todas las ventanas cerradas, los avisos llegan al volver a abrirlo.

### macOS (Chrome o Safari 16+)
1. Toca **Activar notificaciones** → **Permitir**.
2. Si no aparecen: **Ajustes del Sistema → Notificaciones → Google Chrome / Safari** → permitir, y Modo Concentración apagado.

Detalles técnicos y de seguridad: [implementación → Notificaciones push](docs/implementation-status.md#notificaciones-push).

## Reglas de colaboración
- Una rama por funcionalidad (`feature/...`), PR revisado por la otra persona.
- Nunca subir `.env`, secretos, tokens OAuth, claves de servicio ni fotos privadas.
- Mantener documentación y migraciones actualizadas junto con cada cambio.
