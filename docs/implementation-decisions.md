# Chimuverse — Recomendaciones sobre decisiones pendientes

> **Autoría:** Claude Code (Claude Opus 5.5) como consultor, 2026-11-12. **No se produjo con Claude Design** (bloqueo documentado en `docs/design.md` §0).
> **Estado:** recomendaciones. Cada una debe ser **aceptada por José Luis y Glenny** antes de pasar a `docs/decisions.md` → "Confirmadas". Codex puede implementar siguiendo estas recomendaciones, salvo indicación contraria.
>
> Convenciones:
> - **[Verificar]** = depende de políticas o cuotas de terceros (Google, Supabase, Vercel) que pueden cambiar; hay que comprobarlas en la documentación oficial vigente antes de implementar.
> - **Privacidad:** cuando no hay decisión humana, el valor por defecto es **siempre el más privado**. Ninguna recomendación hace visible a la pareja algo que su autor no compartió de forma explícita.

---

## Resumen ejecutivo

| # | Pendiente (`decisions.md`) | Recomendación corta |
|---|---|---|
| D1 | Proveedor de correo | **MVP sin correo** (solo notificaciones internas). Fase 2: **Google Apps Script** como relé autenticado con HMAC y contenido mínimo. Gmail API descartada para MVP. |
| D2 | Privacidad de calendarios laborales | **Nunca leer calendarios personales o laborales.** Se sincroniza solo un calendario dedicado "Chimuverse" en cada cuenta. Free/busy opcional, desactivado, y sin títulos. |
| D3 | Conflictos y calendario destino | Destino = calendario secundario "Chimuverse" creado por la app. Chimuverse es la fuente de verdad; un conflicto real genera un registro y se resuelve a mano. Sincronización incremental + cron en fase 2a; push en fase 2b. |
| D4 | Quién reporta, quién valida, desacuerdos | Reporta el responsable (en las compartidas, cualquiera); valida **siempre la otra persona**. Aprobación total o parcial, o rechazo con motivo. Sin autoaprobación ni aprobación automática. Con 2 rechazos seguidos → estado "Lo hablamos". |
| D5 | Visibilidad de finanzas, diarios y ánimo | **Privado por defecto** en los tres. Compartir es explícito por entrada o mediante un toggle. Cápsulas bloqueadas por RLS hasta su fecha. Finanzas personales: la pareja solo ve totales si se activa el toggle. |
| D6 | Spotify / YouTube | Solo enlaces + exportación CSV/JSON. Sin OAuth. Embeds solo al hacer clic (`youtube-nocookie`). |
| D7 | Dominio, hosting, presupuesto, almacenamiento | Vercel Hobby + Supabase Free + subdominio `*.vercel.app`. Costo 0. Fotos comprimidas en el cliente (lado largo de 2560 px) con miniatura. Monitorear el uso de Storage. |
| D8 | Retención, exportación, backups | Papelera de 30 días (soft delete) y nada se borra al completar. Exportación JSON + ZIP de fotos. Backup mensual cifrado **local** por las propias personas; nunca en GitHub. |
| D9 (nuevo) | Lista autorizada | Tabla `allowed_emails` + Auth Hook *before user created* + RLS por `space_members`. |
| D10 (nuevo) | Fotos y metadatos | Leer la fecha EXIF y **eliminar todo el EXIF (GPS incluido)** antes de subir. URLs firmadas de 10 min. |

---

## D1. Proveedor de correo

**Contexto:** `integrations.md` descarta asumir SMTP desde Edge Functions; las opciones son Gmail API o Apps Script.

**Recomendación:**
1. **MVP (fases 0–1): sin correo.** Las notificaciones internas (`notifications` + Realtime) son la fuente de verdad. Bastan para dos personas que usan la app a diario.
2. **Fase 2: Google Apps Script como relé de correo.**
   - Una de las dos personas crea un proyecto Apps Script con su cuenta, desplegado como *Web App* ("Ejecutar como: yo"; "Acceso: cualquiera", porque Supabase no tiene sesión de Google; la autenticación se hace con firma).
   - La Edge Function `send-notification-email` envía `POST {to, template, params, ts, nonce}` firmado con **HMAC-SHA256** usando un secreto compartido (`EMAIL_RELAY_SECRET` en los secretos de Supabase y en *Script Properties*). El script rechaza firmas inválidas, `ts` con más de 5 min de antigüedad y `nonce` repetidos (CacheService).
   - El script **solo envía a las dos direcciones autorizadas**, guardadas en Script Properties; ignora cualquier `to` distinto. Así un secreto filtrado no permite enviar spam a terceros.
   - **Contenido mínimo:** el correo nunca incluye texto privado (ni diario, ni ánimo, ni montos, ni títulos de eventos). Ejemplo: "Tienes 2 verificaciones pendientes en Chimuverse → [Abrir]".
   - Por defecto, **resumen diario** (una vez al día a la hora configurada), no un correo por evento. Deduplicación con `notification_deliveries(dedupe_key)`.
   - Cuotas: Apps Script con cuenta personal tiene un límite diario bajo de destinatarios (del orden de 100 al día) **[Verificar]**, más que suficiente para dos personas.
3. **Por qué no Gmail API en MVP:** exige el scope `gmail.send` (sensible), guardar y renovar otro refresh token, y ampliar la pantalla de consentimiento; añade riesgo para un beneficio que Apps Script ya da.
4. **Alternativa futura:** si compran un dominio, un proveedor transaccional con plan gratuito (por ejemplo Resend) llamado por HTTP desde la Edge Function. No requiere cambios de UI.

**Impacto en el diseño:** Ajustes → Notificaciones muestra los toggles de correo en estado deshabilitado ("Disponible pronto") hasta la fase 2. Todos están **apagados** por defecto.

---

## D2. Privacidad de calendarios (incluidos los laborales)

**Recomendación (ordenada de más a menos privada; se implementa todo lo marcado con ✅):**

- ✅ **No leer nunca los calendarios existentes** (principal, laboral ni otros). La app solo crea y gestiona su propio calendario secundario **"Chimuverse"** en cada cuenta Google.
  - Scope recomendado: `https://www.googleapis.com/auth/calendar.app.created` (acceso solo a calendarios creados por la app) **[Verificar disponibilidad y comportamiento vigentes]**. Si no sirviera, usar `calendar.events` y limitarse por código a ese calendario, documentándolo como riesgo.
- ✅ **Los eventos compartidos de Chimuverse se copian al calendario "Chimuverse"** de cada persona que active "Sincronizar con mi Google" (por persona y por evento; activado por defecto solo para el creador).
- ✅ **Free/busy opcional, desactivado por defecto.** Si una persona lo activa en Ajustes → Privacidad, se consulta `freebusy.query` (scope `calendar.freebusy` **[Verificar]**) sobre los calendarios que **ella** elija, y la pareja solo ve bloques "Ocupado/a" **sin título, descripción, invitados ni ubicación**. Esos bloques **no se guardan** en Postgres: se piden al vuelo desde una Edge Function y se cachean como máximo 15 min en memoria.
- ❌ No copiar reuniones laborales ni eventos privados entre cuentas en ningún caso.
- ❌ No pedir scopes de Calendar en el login; se usa consentimiento incremental desde Ajustes → Integraciones.

**Pantalla de consentimiento de Google:** al usar un scope sensible, en modo *Testing* los refresh tokens caducan a los ~7 días **[Verificar]**. Recomendación: publicar la app en estado **"In production" sin verificar**. Con menos de 100 usuarios, Google lo permite mostrando la advertencia de "app no verificada", que ambos aceptan una vez **[Verificar]**. Si se prefiere quedarse en Testing, la UI debe mostrar el estado `needs_reauth` y el botón "Reconectar", que ya están en el diseño.

---

## D3. Estrategia de sincronización y conflictos

**Modelo:**
- `calendar_events` (fuente de verdad, con `version int` incremental por edición local y `updated_at`).
- `calendar_event_links (event_id, user_id, google_calendar_id, google_event_id, etag, synced_version, last_synced_at, status)`, con unicidad en `(user_id, google_event_id)` y en `(event_id, user_id)`.
- `sync_conflicts (id, event_id, user_id, local_snapshot jsonb, remote_snapshot jsonb, created_at, resolved_at, resolution)`.
- `sync_errors (id, user_id, operation, code, attempts, next_retry_at, created_at)`. **Sin payloads con datos privados ni tokens.**

**Flujo saliente (Chimuverse → Google):**
1. Una edición local incrementa `version` y encola un trabajo `push(event_id, user_id)` con idempotencia por `(event_id, user_id, version)`.
2. La Edge Function hace `insert` o `patch` con `If-Match: etag`. Si Google responde `412` (cambió remotamente), se trae la versión remota y se aplica la regla de conflicto.

**Flujo entrante (Google → Chimuverse):**
- **Fase 2a:** cron cada 10 min (Supabase Cron / `pg_cron` + `pg_net` llamando a la función) **[Verificar en plan Free]** con `events.list` + `syncToken` sobre el calendario "Chimuverse" de cada persona. Un `410 Gone` hace un full sync de ese calendario.
- **Fase 2b:** push notifications (`events.watch`) hacia una Edge Function pública que valida `X-Goog-Channel-Token` y renueva los canales antes de que expiren. El cron se mantiene como reconciliación cada hora.

**Regla de conflicto:**
| Caso | Resultado |
|---|---|
| Cambió solo Google (`synced_version == version`) | Se aplica a local, `version++`, y se propaga a la otra persona |
| Cambió solo local | Se empuja a Google |
| Cambiaron ambos y los campos difieren | Se crea `sync_conflict`; **local se mantiene** mientras tanto; se notifica al usuario dueño del link; se resuelve con `ConflictCard` |
| Cambiaron ambos con el mismo resultado | Se marca como sincronizado y no hay conflicto |
| Borrado en el Google de una persona | **Solo se rompe el vínculo de esa persona** y se notifica: "Quitaste «Cena» de tu Google Calendar. ¿Eliminarlo también de Chimuverse?" No se borra para la pareja |
| Borrado en Chimuverse | Soft delete local + borrado en los calendarios "Chimuverse" vinculados |

**Recurrencias:** MVP con RRULE simple creada en Chimuverse (diaria, semanal, anual). Las ediciones de una instancia hechas en Google se importan como excepción si es trivial; si no, se registran como conflicto. Recurrencias complejas: fuera del MVP.

**Zona horaria:** se guardan `start_at` y `end_at` en UTC + `timezone` IANA del evento; los eventos de todo el día se guardan como `date`, no como timestamp.

**Reintentos:** backoff exponencial (1, 5, 15 y 60 min, máximo 5 intentos) y luego `status=error` visible en la UI con "Reintentar". Se respetan `429` y `Retry-After`.

**Tokens:** refresh tokens cifrados (AES-GCM con clave en secretos de funciones) en `google_connections`, tabla **sin políticas RLS para `authenticated`** (solo service role desde las funciones). OAuth con `state` firmado + PKCE.

---

## D4. Reporte y validación de Daily Quests

| Regla | Detalle |
|---|---|
| Quién reporta | Quest individual: solo el responsable. Quest compartida: cualquiera de los dos; cada reporte registra `reported_by` |
| Quién valida | **Siempre el miembro que no hizo ese reporte.** CHECK/trigger: `verifier_id <> (SELECT reported_by FROM task_progress WHERE id = progress_id)` |
| Opciones del verificador | Aprobar (verified = reported) · Aprobar parcial (0 ≤ verified < reported) · Rechazar (motivo obligatorio, ≥ 10 caracteres) |
| Reporte nuevo con uno pendiente | El reporte anterior pasa a `superseded` (queda en el historial); solo se verifica el último |
| Métricas | El % verificado de la quest = `verified_percent` de la última verificación aprobada. El % reportado = último reporte. Se muestran por separado |
| Rechazos | El responsable ve el motivo y puede volver a reportar. **Con 2 rechazos consecutivos en el mismo ciclo**, la quest pasa a `in_talk` ("Lo hablamos"): se sigue pudiendo reportar y verificar, pero la UI sugiere registrar un acuerdo en el DevLog |
| Sin respuesta | **No hay aprobación automática** (rompería la regla de verificación cruzada). Recordatorio interno a las 24 h y otro a las 72 h (deduplicados) |
| Edición tras verificar | No se editan reportes ni verificaciones; se agregan nuevos registros (append-only). El historial es inmutable |
| Quests recurrentes | Cada ocurrencia (día) es un ciclo independiente: `task_occurrences(task_id, occurs_on)`, y los reportes cuelgan de la ocurrencia |

**Implementación:** RPC `verify_task_progress(progress_id, decision, verified_percent, reason)` con `SECURITY DEFINER`, que valida la membresía, la regla de no autoaprobación, `verified ≤ reported` y la presencia del motivo; escribe la verificación y la notificación en la misma transacción.

---

## D5. Visibilidad de finanzas, diarios y ánimo

| Dato | Valor por defecto | Opciones | Cómo se impone |
|---|---|---|---|
| **DevLog / diario** | `private` (Solo yo) | `private`, `shared`, `capsule` (con `unlock_at`) | RLS: `author_id = auth.uid() OR visibility = 'shared' OR (visibility = 'capsule' AND unlock_at <= now())`. El ajuste "visibilidad por defecto del DevLog" lo puede cambiar cada persona para sí misma |
| **Notas para ti** | `shared` (es su propósito; la UI lo indica antes de enviar) | — | Tipo de entrada `note_for_partner`, siempre compartida |
| **Ánimo** | Privado | Compartir por entrada; toggle "Compartir automáticamente" (off) | RLS: `user_id = auth.uid() OR share_enabled` |
| **Finanzas personales** | Privado (`owner_id` = yo, `scope='personal'`) | Toggle "Compartir mis totales mensuales" (off) | RLS por `owner_id`. Totales compartidos solo vía RPC `monthly_totals(space_id, month)`, que devuelve sumas por persona **solo si esa persona activó el toggle** (nunca las filas) |
| **Finanzas compartidas** | Visibles a ambos (`scope='shared'`) | — | RLS por membresía del espacio |
| **Fotos (Vault)** | `shared` | `shared`, `private` | Vault se definió como álbum común; el uploader muestra "Compartido" de forma visible y se puede cambiar a "Solo yo" antes de subir. *Si prefieren privado por defecto aquí también, basta cambiar una constante; no afecta el esquema* |
| **Metas individuales** | `private` | `private`, `shared` | RLS por `owner_id` / `visibility` |
| **Respuestas a preguntas** | Compartidas (son el propósito del módulo) | — | La regla "ver la respuesta del otro tras responder" es UX, no seguridad |

**Cápsulas:** el título también queda oculto salvo que el autor marque "título visible". El servidor no entrega `content` antes de `unlock_at` (RLS, no solo UI). `unlock_at` no se puede adelantar después de crear la cápsula (trigger); sí se puede posponer.

**Wrapped:** solo agrega datos `shared` (o del propio usuario en su vista personal); nunca incluye entradas privadas de la pareja.

---

## D6. Spotify / YouTube

- MVP: solo enlaces (`external_links jsonb` con `{provider, url}`), validados con una lista permitida de dominios (`open.spotify.com`, `music.youtube.com`, `www.youtube.com`, `youtu.be`).
- Sin OAuth ni APIs de terceros.
- Embeds **solo tras clic** ("Cargar reproductor"), usando `youtube-nocookie.com` para YouTube, para no cargar cookies ni rastreadores de terceros por defecto.
- Exportación CSV y JSON generada en el cliente.
- Futuro: importación desde Spotify Web API con OAuth individual. Requiere su propia revisión de privacidad.

---

## D7. Dominio, hosting, presupuesto y almacenamiento

- **Hosting:** Vercel Hobby (uso personal, no comercial) + Supabase Free. **Costo: 0.** **[Verificar términos vigentes]**
- **Dominio:** usar `chimuverse.vercel.app` (o similar) al inicio. Comprar un dominio es opcional y solo hace falta si después quieren correo transaccional desde un dominio propio (D1). La decisión y la compra son de ustedes.
- **Riesgo conocido:** los proyectos Supabase Free pueden pausarse tras ~7 días sin actividad **[Verificar]**. Con uso diario no debería pasar; si pasa, se reactiva desde el panel.
- **Almacenamiento** (el plan Free ronda 1 GB de Storage **[Verificar]**):
  - Compresión en el cliente: lado largo máximo de **2560 px**, JPEG o WebP con calidad ~0.82, más una miniatura de **480 px**. Esto deja ~0.4–0.8 MB por foto, es decir, ~1 000–2 000 fotos en el plan gratuito.
  - Original de más de 25 MB: se rechaza con un mensaje. Formatos: JPEG, PNG, WebP, HEIC (convertido en el cliente si el navegador puede; si no, se pide exportar como JPEG).
  - Las transformaciones de imagen de Supabase no se usan (no están en el plan Free **[Verificar]**); las miniaturas se generan en el cliente.
  - Ajustes → Datos muestra el uso aproximado (suma de `photos.size_bytes`) y avisa al llegar al 80 %.
- **Límites de abuso:** máximo 50 fotos por lote; políticas de Storage que restringen la ruta a `space_id/` y el tamaño máximo.

---

## D8. Retención, exportación y backups

- **Nada se borra al completar** (watchlist, quests, metas: solo cambia el estado).
- **Borrado del usuario:** soft delete (`deleted_at`) → Papelera durante 30 días → purga definitiva con una función programada (incluye el objeto en Storage).
- **Exportación (Ajustes → Datos):**
  - "Exportar mis datos": JSON con todo lo que **yo** puedo ver (mis datos privados + los compartidos), sin datos privados de la pareja.
  - "Descargar fotos": ZIP generado en el cliente a partir de URLs firmadas, por álbum o año para no saturar la memoria.
- **Backups:**
  - El plan Free no ofrece backups descargables ni PITR **[Verificar]**.
  - Recomendación: **cada mes, una de las dos personas** ejecuta localmente `npx supabase db dump --data-only` + la exportación de fotos, **cifra** el resultado (por ejemplo con 7-Zip AES-256 o `age`) y lo guarda en su almacenamiento personal.
  - **No** guardar dumps en GitHub, ni en artifacts de GitHub Actions, ni en ningún lugar compartido sin cifrar.
  - Se documentará un script `scripts/backup.ps1` / `.sh` que solo funciona con credenciales locales.
- **Logs:** sin contenido privado; se retienen 30 días.

---

## D9. Lista autorizada (nuevo, refuerza lo ya acordado)

- Tabla `allowed_emails(email citext primary key)` sin acceso desde el cliente.
- **Supabase Auth Hook "before user created"** que rechaza los correos que no estén en la lista **[Verificar disponibilidad en plan Free]**. Respaldo si no estuviera disponible: trigger en `auth.users` que no crea `space_members`; con eso, RLS deja a esa cuenta sin acceso a nada y la UI muestra `/sin-acceso`.
- `space_members` con restricción de máximo 2 miembros (trigger).
- La UI **nunca** lista los correos autorizados.

---

## D10. Fotos y metadatos (nuevo)

- Antes de subir: leer `DateTimeOriginal` (librería `exifr`, MIT) para `captured_at` y luego **re-codificar la imagen en canvas**, lo que elimina todo el EXIF, incluidos el GPS y el modelo de cámara.
- Si en el futuro quieren ubicación, se guardará como texto manual ("Arequipa") en el viaje o la foto, nunca coordenadas automáticas.
- Bucket `photos` privado; ruta `{space_id}/{photo_id}/{full|thumb}.webp`; URLs firmadas con caducidad de **10 min**, renovadas por TanStack Query (`staleTime` 8 min).
- `photos`: añadir `size_bytes`, `width`, `height`, `captured_at_source ('exif'|'manual')`, `uploaded_by`, `visibility`, `deleted_at`.

---

## Supuestos usados (ninguno reduce la privacidad ni expone datos)

1. Ambas personas usan cuentas Google personales (no Workspace con políticas de administrador). Si alguna fuera Workspace, el admin podría bloquear apps no verificadas; se resolvería en ese momento.
2. Zona horaria principal `America/Lima` y moneda PEN como valores por defecto **editables**; detectados en el navegador cuando sea posible.
3. El volumen esperado es bajo (2 usuarios, < 5 000 fotos en varios años), así que los planes gratuitos alcanzan.
4. Las cuotas y políticas marcadas **[Verificar]** son las conocidas a la fecha y deben confirmarse en la documentación oficial antes de implementarse.
5. Donde no había decisión humana, se eligió la opción más privada. La única excepción son las fotos de Vault (`shared` por defecto), porque el módulo se definió como álbum común; la elección se ve en el uploader y se cambia con una constante.

## Qué queda para decisión humana (no lo puede decidir el consultor)

- Aceptar o ajustar cada recomendación D1–D10 y moverla a `docs/decisions.md`.
- Si se compra un dominio y cuál.
- Quién de los dos es dueño del proyecto Apps Script (D1) y de los backups mensuales (D8).
- Si se quiere activar Claude Design más adelante (requiere `/update`, una sesión nueva y un plan con acceso; ver `docs/design.md` §0).
