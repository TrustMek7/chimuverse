# Contratos iniciales (borrador)

Con Supabase, las operaciones CRUD sencillas pueden usar cliente `supabase-js` con RLS. Las operaciones privilegiadas o transaccionales deben ir por RPC/Edge Functions.

| Operación | Mecanismo sugerido |
|---|---|
| Leer/editar perfil | Tabla `profiles` con RLS |
| Preguntas/respuestas | Tablas con RLS |
| Crear/consultar tareas | Tablas con RLS |
| Aprobar/rechazar avance | RPC transaccional o Edge Function `verify-task-progress` |
| Fotos | Storage privado + tabla `photos` |
| Eventos internos | Tabla `calendar_events` |
| Iniciar OAuth Calendar | Edge Function `google-calendar-connect` |
| Callback OAuth | Edge Function `google-calendar-callback` |
| Sincronizar Calendar | Edge Function `google-calendar-sync` + scheduler |
| Notificación interna | Tabla `notifications` + Realtime |
| Enviar correo | Edge Function `send-notification-email` (proveedor pendiente) |

## Convenciones
- Validar JWT y membresía del espacio en toda operación privilegiada.
- Contratos tipados, errores consistentes, logs sin tokens ni información privada.
- Funciones externas idempotentes y con protección contra duplicados.
- No exponer endpoints OAuth sin validación de `state` y PKCE cuando aplique.
