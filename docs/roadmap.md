# Roadmap de implementación

## Fase 0 — Base técnica
- [ ] Crear repositorio privado, protección de rama y PRs.
- [ ] Inicializar React + Vite + TypeScript y Tailwind.
- [ ] Configurar Supabase CLI, proyecto y variables locales.
- [ ] Configurar Supabase Auth Google y lista autorizada de dos usuarios.
- [ ] Crear tablas mínimas `profiles`, `spaces`, `space_members` y RLS.
- [ ] Configurar CI para lint, typecheck y tests.

## Fase 1 — Primer flujo vertical
- [ ] Login → perfil → dashboard funcional sin estilo final.
- [ ] Preguntas y respuestas de Nuestro Universo.
- [ ] Daily Quests: crear, reportar avance, aprobar/rechazar, métricas.
- [ ] Pruebas de permisos: un usuario no puede aprobar su propio avance.

## Fase 2 — Calendario y notificaciones
- [ ] Calendario local con FullCalendar.
- [ ] OAuth Google Calendar individual para ambos.
- [ ] Sincronización bidireccional con pruebas de conflicto/reintento.
- [ ] Notificaciones internas persistidas + Realtime.
- [ ] Elegir e implementar envío de correo.

## Fase 3 — Recuerdos
- [ ] Storage privado y subida de fotos.
- [ ] Fechas de captura vs subida; viajes y timeline.
- [ ] Diario digital y notas.

## Fase 4 — Expansión
- [ ] Date Planner, Goals & Dreams, Watchlist.
- [ ] Mood Tracker, Our Finances, Wishlist & Soundtrack.
- [ ] Our Wrapped (resumen anual).

## Definición de terminado por feature
- [ ] Validaciones y permisos probados.
- [ ] Tests mínimos y estados de error/carga.
- [ ] Migración y documentación actualizadas.
- [ ] PR revisado por la otra persona.
