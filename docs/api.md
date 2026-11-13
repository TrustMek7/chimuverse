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


## Contratos implementados

- `report_task_progress(p_task_id, p_percent, p_note)` y `verify_task_progress(p_progress_id, p_decision, p_verified_percent, p_reason)` operan por RPC autenticada y dejan historial inmutable.
- `save_entry(p_data, p_content, p_id)` es la única escritura de colecciones y cuerpos. El servidor impone visibilidad, autoría y sellado de cápsulas; las notas de ánimo solo se leen por su autor.
- `trash_item(p_table, p_id, p_restore)` solo acepta `entries`, `photos` y `calendar_events` del usuario actual.
- `google_status()` entrega únicamente estado y última sincronización, sin tokens.
- Edge Function `/calendar`: POST con acciones `connect`, `sync`, `resolve`, `disconnect`, con JWT verificado en servidor. GET es el callback OAuth con state de un solo uso y PKCE. `scheduled` requiere secreto de cron, no un JWT de usuario.
- `calendar_service`, `consume_calendar_state`, `calendar_accounts` y `enqueue_reminders` son RPC de servicio: no están disponibles para clientes autenticados o anónimos.
- El frontend pagina las colecciones de 500 en 500, y usa RLS para todas las lecturas. Ver los nombres de columnas y restricciones reales en las migraciones.
