# Registro de decisiones

## Confirmadas
- Nombre: **Chimuverse**; proyecto privado para José Luis y Glenny Shinderly.
- Frontend y backend separados en `frontend/` y `backend/`, con entornos y despliegues independientes en el repositorio actual. React + Vite + TypeScript, Tailwind.
- Supabase: PostgreSQL, Auth con Google, Storage, Realtime y Edge Functions.
- Sin Django/NestJS ni backend dedicado en MVP.
- Google Calendar: sincronización bidireccional, cuentas conectadas individualmente.
- Diseño visual: handoff v2 de `design/`, dirección Constelación doméstica.
- Privacidad inicial Solo yo para registros personales; notas para la pareja compartidas de forma explícita.
- Verifica siempre quien no reportó; aprobación parcial, rechazo con motivo y nuevos reportes con historial.
- Calendar usa un calendario exclusivo de la app, conexión individual y resolución explícita de conflictos.

- Con Google Calendar conectado, crear/editar/borrar/restaurar eventos en Our Calendar los exporta automáticamente desde el servidor. No se exportan Daily Quests.
- El aviso y el botón de conectar se ocultan al estar conectado. La acción manual «Traer cambios de Google» queda para cambios hechos allí.

## Pendientes
- Proveedor de correo: Gmail API vs Apps Script (o alternativa).
- Spotify/YouTube: solo enlaces y CSV en MVP; permisos de API futuros.
- Dominio, hosting final, presupuestos y límites de almacenamiento.
- Retención y backups automáticos de fotos/datos personales. La exportación manual ya está implementada.
