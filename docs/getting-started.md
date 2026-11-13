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
- El correo de respaldo usa Gmail (ver al final). El push web se activa desde Inicio en cada dispositivo (en iPhone, instalando la app en el inicio). Spotify usa enlaces. YouTube cuenta con conexión OAuth y playlist común (ver la guía al final).
- Guardar exportaciones en almacenamiento personal cifrado. No subir backups al repositorio ni a artifacts de CI.

Referencias oficiales: [migraciones](https://supabase.com/docs/guides/deployment/database-migrations), [Google Auth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [scopes de Calendar](https://developers.google.com/workspace/calendar/api/auth), [sincronización incremental](https://developers.google.com/workspace/calendar/api/guides/sync).


Una vez conectado Calendar, Our Calendar exporta automáticamente sus eventos y cambios. Ya no hay casilla por evento. «Traer cambios de Google» permite importar al momento cambios hechos allí; el scheduler también reconcilia periódicamente. Daily Quests no se exporta.


Our Calendar siempre es compartido. En Repetición se elige frecuencia, días e intervalo; Finaliza ofrece Nunca, fecha incluida o número de repeticiones. Editar serie y Eliminar serie afectan a todas sus fechas. Los cambios se exportan automáticamente e incluyen a los dos correos autorizados como invitados en Google; cada persona podría tener que aceptar la invitación según sus ajustes.


## Conectar YouTube y crear nuestra playlist

1. En el proyecto de Google Cloud habilitar YouTube Data API v3. En Google Auth Platform → Acceso a los datos añadir `https://www.googleapis.com/auth/youtube.force-ssl`. Mantener los dos correos autorizados como usuarios de prueba.
2. En Clientes → cliente de aplicación web → URI de redireccionamiento autorizado añadir `https://xlzttaqjajnjukikvcyj.supabase.co/functions/v1/youtube`. Es una redirección, no un origen JavaScript. No quitar las URI existentes de login y Calendar.
3. Por defecto se reutilizan `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET` de `backend/.env`. También se admite cliente separado mediante `YOUTUBE_OAUTH_CLIENT_ID` y `YOUTUBE_OAUTH_CLIENT_SECRET`. Para importar su JSON, guardarlo como `backend/.env.youtube-oauth.json` (ignorado por Git), ejecutar `node scripts/import-youtube-oauth.mjs` desde backend y después `npm run deploy:all`. Ningún secreto lleva prefijo VITE_.
4. En Ajustes → Conexiones o Nuestro soundtrack pulsar Conectar mi YouTube. Aceptar el permiso con el mismo correo del login. La cuenta necesita tener canal de YouTube.
5. Elegir Crear nuestra playlist en YouTube. La opción No listada permite verla a cualquiera con el enlace; Privada la mantiene visible solo para el propietario en YouTube. Ambos miembros pueden editar desde Chimuverse usando la conexión del propietario. También se puede importar una playlist existente de su propio canal.
6. Si desean editar también desde YouTube, usar playlist no listada y, desde la cuenta propietaria, abrir YouTube → playlist → Compartir → Invitar colaboradores y compartir el enlace con la otra persona. La API de YouTube no permite invitar directamente a los dos correos. La otra cuenta debe aceptar el enlace.
7. Añadir o quitar canciones en el panel actualiza YouTube inmediatamente. Los cambios externos aparecen al actualizar o en un minuto mientras el panel esté abierto. Exportar canciones compartidas añade sus enlaces de YouTube sin duplicados; las canciones locales privadas y Spotify quedan fuera. Una exportación interrumpida puede añadir algunas canciones: actualizar antes de repetir conserva lo ya añadido.

El scope permite más operaciones que las que usa la app; no existe un scope oficial limitado a una sola playlist. Desconectar quita la credencial guardada sin borrar la playlist. Revocar el cliente desde Google puede afectar también Calendar si comparten cliente OAuth. Documentación: https://developers.google.com/youtube/data/reference/rest/v3/playlists y https://support.google.com/youtube/answer/6109639.


Actualización de uso: todos los registros y fotos se comparten automáticamente entre los dos, incluidos los anteriores. Ya no hay opción «Solo yo». Las cápsulas esperan su apertura. Las nuevas playlists son no listadas y pueden verse con el enlace; queda eliminada la opción de creación privada de la guía anterior.


## Conectar Gmail para avisos por correo

El correo es el respaldo de las notificaciones push. Cada aviso se envía por correo solo a quien **no tenga ningún dispositivo con push activo**. Sale del Gmail de su pareja; si la pareja no conectó el suyo, sale de su propio Gmail hacia sí mismo. Si nadie conectó Gmail, no se envía nada.

1. En el proyecto de Google Cloud habilitar **Gmail API**. En Google Auth Platform → Acceso a los datos añadir `https://www.googleapis.com/auth/gmail.send`. Mantener los dos correos como usuarios de prueba.
2. En Clientes → cliente de aplicación web → URI de redireccionamiento autorizado añadir `https://xlzttaqjajnjukikvcyj.supabase.co/functions/v1/mail`. No quitar las URI existentes de login, Calendar y YouTube.
3. Usa `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET`. Desplegar con `npm run deploy:all` desde backend; eso aplica la migración 014, registra `mail_function_url` y publica la función `mail`.
4. Cada persona: Ajustes → Conexiones → **Conectar mi Gmail**, con el mismo correo del login. Google mostrará el permiso «Enviar correo electrónico en tu nombre». Es el único que se pide: la app no puede leer, buscar ni borrar correo.
5. Con la app en modo *Testing* en Google, los permisos sensibles caducan a los 7 días. Si un envío falla, Ajustes muestra el error y el botón **Reconectar Gmail**. Para evitarlo, publicar la app OAuth «En producción» sin verificar (Google lo permite para pocos usuarios, mostrando la advertencia de app no verificada).

Desconectar quita solo la credencial de Gmail guardada; Calendar y YouTube siguen igual.


## Checklist para publicar en Vercel

1. **Frontend en Vercel:** raíz `frontend`, build `npm run build`, salida `dist`. Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_APP_URL` (la URL de Vercel). `vercel.json` ya sirve `sw.js` sin caché y el manifiesto de la PWA.
2. **`APP_URL` en `backend/.env`** con la URL de Vercel (por ejemplo `https://chimuverse.vercel.app`, sin `/` final). Hoy no está definida y se usa `http://localhost:5173`. De ella dependen:
   - el `site_url` y las redirecciones de Auth;
   - el CORS de las funciones `youtube` y `mail`;
   - el regreso de los OAuth de Calendar, YouTube y Gmail;
   - los enlaces «Abrir en Chimuverse» de los correos;
   - el remitente VAPID del push.
3. Desde `backend`: `npm run backup`, luego `npm run deploy:all` y `npm run verify:deployment`. La verificación debe mostrar las migraciones aplicadas y que `push` y `mail` rechazan envíos sin firma (401).
4. **Google Cloud:**
   - Origen JavaScript autorizado: la URL de Vercel.
   - Las URI de redireccionamiento de Supabase (`/auth/v1/callback`, `/functions/v1/calendar`, `/functions/v1/youtube`, `/functions/v1/mail`) no cambian.
   - Scopes en Acceso a los datos: Calendar, `youtube.force-ssl` y `gmail.send`.
5. **En cada dispositivo:** abrir la URL de Vercel y activar las notificaciones desde Inicio. Los permisos son por sitio: lo activado en `localhost` no pasa a Vercel. Si el navegador tiene «No permitir» para todos los sitios, agregar la URL de Vercel a «Con permiso para enviar notificaciones» (ver README).
6. **Gmail:** cada uno, en Ajustes → Conexiones → Conectar mi Gmail.

## Respaldos

- `npm run backup` (en `backend/`): copia cifrada de los datos (tablas públicas).
- `npm run backup:photos`: copia cifrada e incremental de las fotos del álbum en `backend/backups/photos/`. Para recuperarlas: `npm run backup:photos -- --restore <carpeta>`.
- Guarda `BACKUP_ENCRYPTION_KEY` (está en `backend/.env`) en un lugar seguro aparte: sin esa clave las copias no se pueden abrir.
