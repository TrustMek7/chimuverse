# Google Calendar, OAuth y notificaciones

## Dos flujos diferentes
1. **Login:** Supabase Auth con proveedor Google. Solo los dos usuarios autorizados pueden acceder.
2. **Integración Google:** consentimiento incremental para Calendar (y Gmail si se decide). El login no garantiza permisos Calendar ni acceso offline.

## Google Cloud
- Un proyecto Google Cloud, cliente OAuth web, consent screen, redirect URIs exactos.
- Cada persona autoriza sus servicios individualmente; **no guardar contraseñas de Google**.
- Guardar refresh tokens cifrados del lado servidor y rotarlos/renovarlos de forma segura.
- Verificar políticas actuales de Google: scopes mínimos, modo testing (puede caducar refresh token), publicación y verificación según uso.

## Sincronización bidireccional (requisito)
- Modelo local de eventos + tabla de vínculos con IDs de Google por usuario/calendario.
- Al crear/editar localmente: trabajo idempotente de envío a Google; gestionar conflictos.
- Al cambiar en Google: sincronización incremental (sync tokens) y/o push notifications con endpoint público validado, renovación de canales y reconciliación periódica.
- Reintentos, rate limits, eventos eliminados, timezone, recurrencias y logs.
- **No copiar automáticamente reuniones privadas entre cuentas**: definir reglas de visibilidad y calendario destino.

## Notificaciones
- **Internas:** tabla `notifications` + Realtime; la persistencia es la fuente de verdad.
- **Email:** pendiente de decidir entre Gmail API, Apps Script u otro método. SMTP directo desde Edge Functions no debe asumirse disponible.
- **Push:** Web Push estándar (VAPID) con service worker propio; ver «Notificaciones push» en implementation-status.md.
- Configurar preferencias por persona, deduplicación, límites de frecuencia y logs de entrega.

## Variables y secretos
- Frontend: solo URL y clave publicable Supabase.
- Edge Functions: OAuth client secret, claves de cifrado, tokens, configuraciones del proveedor; usar secretos de Supabase.
- No poner tokens ni service-role en Git o variables `VITE_`.
