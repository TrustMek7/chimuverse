# Arranque de Chimuverse

## 1. Frontend

Requiere Node 22 y npm. No volver a generar Vite ni sobrescribir los entornos existentes.

```powershell
cd frontend
npm ci
npm run dev
```

Abrir `http://localhost:5173`. `frontend/.env.local` contiene las variables de `.env.example`: URL, clave publicable y URL de la aplicación. No existe modo de demostración ni login alternativo para ocultar la falta de configuración remota.

## 2. Supabase

En `backend/.env`, conservar las claves existentes y agregar:

```dotenv
SUPABASE_ACCESS_TOKEN=tu_personal_access_token
APP_URL=http://localhost:5173
GOOGLE_OAUTH_CLIENT_ID=tu_cliente_web.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=tu_client_secret
```

El Personal Access Token se crea en la configuración de la cuenta de Supabase. No es una Publishable key ni una Secret key del proyecto. El script lo lee sin imprimirlo.

```powershell
cd backend
npm ci
npm run deploy
# Incluir funciones, secretos y programación cada 15 minutos:
npm run deploy:all
```

Aplica únicamente migraciones pendientes y registra sus versiones. Configura redirecciones y habilita Google Auth si se proporcionaron sus credenciales. Al desplegar funciones, genera `GOOGLE_TOKEN_ENCRYPTION_KEY` y `CRON_SECRET` en el `.env` ignorado si faltaban; después configura secretos remotos por API. No cambiar la clave de cifrado con conexiones Google activas.

La lista de dos correos está en `202611130003_allowlist.sql`, en el esquema privado. Una tercera cuenta puede autenticarse en Google pero nunca recibe membresía ni acceso a datos; ve la pantalla sin acceso. No se crean contraseñas ni cuentas automáticamente.

Alternativa: configurar Supabase CLI (`supabase link`, `supabase db push`) y aplicar el mismo historial. No crear tablas manualmente sin migraciones.

## 3. Google Cloud

1. Crear cliente OAuth web y habilitar Calendar API.
2. Añadir ambas cuentas como usuarios de prueba si corresponde.
3. Registrar dos redirecciones distintas: `https://PROJECT_REF.supabase.co/auth/v1/callback` para login y `https://PROJECT_REF.supabase.co/functions/v1/calendar` para Calendar.
4. Configurar Client ID y Client Secret mediante el script o el proveedor Google de Supabase.
5. Cada persona entra y conecta Calendar por separado en Ajustes. Debe elegir la misma cuenta de Google con la que inició sesión.

Calendar solicita `openid email` para verificar identidad y `calendar.app.created` para usar solo un calendario creado por la aplicación. No lee otros calendarios. Hay que probar el flujo real con ambas cuentas antes de considerar validada la integración.

## 4. Validación

Desde `frontend/`:

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Desde `backend/`:

```powershell
npm test
npm run typecheck
npm run test:calendar
```

Las pruebas no modifican Supabase remoto. Playwright usa fixtures de transporte. PGlite ejecuta SQL real con roles y RLS. Calendar prueba contratos externos aislados; esos tests no sustituyen la autorización de Google.

## 5. Despliegue del frontend

Vercel: raíz `frontend`, build `npm run build`, salida `dist`. Configurar solo las variables públicas `VITE_`. `vercel.json` define el fallback SPA. Actualizar `APP_URL` al dominio real y volver a desplegar el backend para ajustar redirecciones y CORS.

## 6. Operación

- Ajustes → Datos exporta registros visibles en JSON y fotos en ZIP. No incluye datos privados de la pareja ni textos de cápsulas selladas.
- Papelera restaura registros; la purga automática a 30 días está desactivada. Completar tareas, metas y títulos no elimina su historial.
- `--schedule` configura pg_cron/pg_net cada 15 minutos, con secreto en Vault, para Calendar y recordatorios deduplicados de quests a 24/72 horas y eventos próximos.
- Correo y push siguen desactivados, según el handoff. Spotify/YouTube se usan mediante enlaces, sin conectar cuentas.
- Guardar exportaciones en almacenamiento personal cifrado. No subir backups al repositorio ni a artifacts de CI.

Referencias oficiales: [migraciones](https://supabase.com/docs/guides/deployment/database-migrations), [Google Auth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [scopes de Calendar](https://developers.google.com/workspace/calendar/api/auth), [sincronización incremental](https://developers.google.com/workspace/calendar/api/guides/sync).


Una vez conectado Calendar, Our Calendar exporta automáticamente sus eventos y cambios. Ya no hay casilla por evento. «Traer cambios de Google» permite importar al momento cambios hechos allí; el scheduler también reconcilia periódicamente. Daily Quests no se exporta.
