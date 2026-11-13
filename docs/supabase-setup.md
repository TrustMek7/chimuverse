# Configuración de Supabase para Chimuverse

Frontend: React + TypeScript + Vite y **Tailwind CSS**. Backend: Supabase.

## 1. Crear el proyecto

No hace falta conectar GitHub. Puedes crear tu cuenta de Supabase con correo y contraseña. El proveedor Google de la aplicación se configura después y es independiente de cómo entres al dashboard de Supabase.

1. Entrar en https://supabase.com/dashboard y crear un proyecto llamado Chimuverse.
2. Elegir una región cercana a los usuarios y guardar la contraseña de PostgreSQL en un gestor de contraseñas.
3. Esperar a que termine el aprovisionamiento.
4. Copiar Project URL y Publishable key desde Connect o la configuración del proyecto. Las claves se administran en Settings → API Keys.
5. Anotar el project ref (identificador que aparece en la URL del dashboard).

## 2. Variables del frontend

Crear `frontend/.env.local`:

```dotenv
VITE_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_APP_URL=http://localhost:5173
```

Las variables VITE_ llegan al navegador. Nunca poner aquí la contraseña de PostgreSQL, secret key, service_role, Google Client Secret o refresh tokens. El archivo está ignorado por Git.

### Variables del backend

La lógica de servidor y las migraciones viven en `backend/`. Crear `backend/.env` tomando como referencia `backend/.env.example`:

```dotenv
SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

Este archivo es exclusivo del servidor y está ignorado por Git. No agregar `VITE_` a las claves privadas ni cargar `backend/.env` desde Vite. Cada Edge Function declarará las variables que necesita; en producción se configuran como secretos de Supabase, no mediante el despliegue del frontend.

## 3. Redirecciones de autenticación

En Authentication → URL Configuration:

- Site URL: `http://localhost:5173`
- Redirect URLs: `http://localhost:5173/auth/callback`

Cuando exista el dominio de producción, cambiar Site URL y añadir su callback exacto. Mantener localhost solo si se seguirá usando para desarrollo. La ruta `/auth/callback` será parte de la implementación del frontend.

## 4. Google OAuth para iniciar sesión

1. En Supabase, Authentication → Sign In / Providers → Google, copiar el callback mostrado. Habitualmente es `https://TU_PROJECT_REF.supabase.co/auth/v1/callback`.
2. En Google Cloud Console, crear o seleccionar un proyecto.
3. Configurar Google Auth Platform: nombre Chimuverse, correo de soporte y audiencia adecuada. Para cuentas personales o de dominios diferentes, usar audiencia External; Internal solo corresponde a una organización Workspace compatible.
4. Si la aplicación está en modo de pruebas, añadir ambas cuentas en Audience → Test users cuando la configuración lo requiera.
5. Crear un cliente OAuth de tipo Web application.
6. Añadir el callback copiado de Supabase en Authorized redirect URIs. Este callback es distinto del callback del frontend.
7. Guardar Client ID y Client Secret en el proveedor Google de Supabase y habilitarlo.
8. El login solo necesita identidad básica. Los permisos de Calendar se solicitarán posteriormente mediante un flujo separado.

## 5. Acceso exclusivo a dos personas

El proyecto todavía no está listo para datos reales solo por activar Google. La implementación incluirá lista autorizada en servidor, membresías y RLS. La lista de test users de Google y los filtros en React no sustituyen esos permisos.

Antes de probar con datos reales, deben estar aplicadas las migraciones y configurada la lista de las dos direcciones exactas. Se comprobará que una tercera cuenta no puede leer ni escribir datos y que nadie puede aprobar su propio avance.

## 6. Aplicar migraciones cuando estén disponibles

Desde la raíz del repositorio, entrar primero en `backend/`. Los siguientes comandos usan `backend/supabase/` como directorio del proyecto Supabase:

```powershell
cd backend
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

No ejecutar todavía `db push`: las migraciones iniciales están pendientes de implementación. No crear tablas manuales que se desvíen de las migraciones versionadas. El inicio de sesión del CLI y la contraseña se introducen localmente cuando los solicite la herramienta.

## 7. Validación al terminar la implementación

- Ambos usuarios pueden iniciar sesión y editar únicamente los datos que les correspondan.
- Un usuario ajeno no puede acceder a datos mediante la API, aunque conozca la URL y la clave publicable.
- La verificación de tareas impide autoaprobaciones en la base de datos.
- Los buckets de recuerdos son privados y utilizan URLs firmadas temporales.
- Los errores de autenticación se muestran sin revelar secretos.
- Calendar no se considera configurado por haber habilitado Google login.

## Referencias oficiales

- Claves: https://supabase.com/docs/guides/api/api-keys
- Redirecciones: https://supabase.com/docs/guides/auth/redirect-urls
- Google: https://supabase.com/docs/guides/auth/social-sign-in/auth-google

Esta guía cubre la preparación del proyecto. Los comandos de migración y aprovisionamiento se actualizarán junto con la implementación real.
