# Modelo de datos inicial (propuesta)

No es un esquema SQL definitivo. Validar reglas y relaciones antes de crear migraciones.

| Entidad | Campos orientativos / relaciones |
|---|---|
| profiles | id = auth.users.id, display_name, avatar_path |
| spaces | id, name |
| space_members | space_id, user_id, role; máximo 2 miembros en Chimuverse |
| questions / answers | question_id, category, respondent_id, answer |
| tasks | id, space_id, title, assignee_id, due_at, status |
| task_progress | task_id, reported_by, reported_percent, note, created_at |
| task_verifications | progress_id, verifier_id, status, verified_percent, created_at |
| calendar_events | id, space_id, title, start_at, end_at, source, version |
| google_connections | user_id, scopes, encrypted_refresh_token, expires_at, status |
| calendar_event_links | event_id, user_id, google_calendar_id, google_event_id, etag |
| sync_cursors | user_id, calendar_id, sync_token, channel_expiry, last_sync_at |
| photos | id, space_id, storage_path, captured_at, uploaded_at, trip_id? |
| trips | id, space_id, title, start_date, end_date |
| journal_entries | id, space_id, author_id, visibility, occurred_at, content |
| watchlist_items | id, space_id, kind, status, completed_at |
| goals / goal_updates | space_id, owner_id?, progress, updates |
| transactions / budgets | space_id, owner_id?, amount, type, category |
| wishlist_items | space_id, owner_id, title, link, priority |
| playlists / tracks | space_id, title, artist, external_links |
| mood_entries | user_id, mood, recorded_on, share_enabled |
| notifications | recipient_id, kind, payload, read_at, dedupe_key |
| notification_deliveries | notification_id, channel, status, attempts |

## Reglas
- Todas las entidades compartidas incluyen `space_id`; autorizar membresía mediante RLS.
- Campos privados por usuario con permisos separados; no suponer que todo es visible a la pareja.
- Timestamps UTC; zona horaria del usuario para visualización.
- Fotos en Storage, **solo rutas/metadatos en Postgres**.
- Al completar watchlist cambiar estado, no hacer DELETE.
- Avance reportado y verificado son valores diferentes; la verificación no puede ser autoaprobada.
- Tokens externos cifrados y accesibles solo a funciones privilegiadas, nunca al cliente.
- Índices recomendados: `space_id`, `user_id`, `due_at`, `start_at`, `created_at`; unicidad en vínculos externos.
