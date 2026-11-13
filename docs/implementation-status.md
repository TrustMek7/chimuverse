# Estado de implementación — 13 noviembre 2026

## Código disponible

| Área | Implementado |
|---|---|
| Base y acceso | React/TypeScript/Vite/Tailwind v4; tokens y fuentes autoalojadas del handoff v2; sidebar, rail y navegación móvil; claro/oscuro; acceso Google PKCE y pantalla sin acceso. |
| Permisos | Lista privada de dos correos, máximo dos miembros, RLS, Storage privado, RPC transaccionales y roles de mínimo privilegio. |
| Daily Quests | Crear tareas individuales/compartidas, filtros, reporte, aprobación total/parcial, rechazo con motivo, estado Lo hablamos, notificaciones, promedios separados e historial inmutable. |
| Universo | Perfiles, gustos, preguntas propias, respuestas compartidas, comparación y trivia de respuestas reales. |
| Calendar | CRUD local, FullCalendar con zona horaria, fechas anuales, agenda, visibilidad y papelera. |
| Google Calendar | Edge Function con OAuth individual y PKCE, identidad comprobada, AES-GCM, refresh, calendario exclusivo, cursores/paginación, reintentos, ETags, conflictos, desconexión y scheduler. Pendiente validación con Google real. |
| Memory Vault | Compresión y EXIF de fecha, eliminación de GPS/metadatos, originales y miniaturas WebP, subida/reintento por archivo, fechas separadas, álbumes, timeline, URLs firmadas, descarga y papelera. |
| DevLog | Tipos de entrada, notas compartidas, diario privado, cápsulas selladas también para su autor y restauración de papelera. |
| Expansión | Citas y ruleta con vínculo al calendario, metas/hitos y vision board, watchlist con progreso e historial, ánimo semanal con notas privadas, finanzas/presupuestos/ahorros, deseos y soundtrack con exportación CSV. |
| Wrapped | Resumen anual calculado con datos compartidos; no agrega registros privados de la pareja. |
| Ajustes | Perfil, zona horaria, conexión Calendar, conflictos, exportación JSON/ZIP, papelera y cierre de sesión. |
| Calidad | Typecheck, build, Vitest, pruebas reales de SQL/RLS con PostgreSQL embebido, tests aislados de Calendar, Playwright escritorio/móvil y axe en ambos temas; workflow CI. |

## Activación pendiente en servicios externos

Validación local ejecutada: build de producción y typecheck correctos; 11 tests PostgreSQL/RLS, 6 tests Calendar, 5 unitarios y 6 de navegador (28 en total). Axe sin violaciones en acceso y dashboard en los temas revisados. Las pruebas SQL incluyen almacenamiento privado, notas de ánimo, cápsulas, restauración y recordatorios deduplicados.

La clave de servidor presente permite consultar la API de datos y Auth. La inspección encontró **Google Auth deshabilitado y cero usuarios**. No hay `SUPABASE_ACCESS_TOKEN` de administración disponible: las migraciones no están aplicadas al proyecto remoto y la Edge Function/scheduler no están desplegados.

Hace falta completar el token de administración y las credenciales OAuth en `backend/.env`, ejecutar el despliegue y autorizar las dos cuentas. Ver `getting-started.md`. El frontend no crea datos ficticios ni permite entrar saltándose Auth para ocultar esta dependencia.

No se declara listo para producción ni validada la sincronización real hasta completar esa configuración y probar ambos usuarios con Google.

## Límites explícitos

- Correo y push desactivados, como en el diseño. Integración Spotify/YouTube solo por enlaces.
- Papelera restaurable, sin purga automática activada; nada se elimina definitivamente sin esa configuración.
- Calendar externo admite eventos simples y recurrencia anual. Otras reglas de recurrencia se rechazan con un mensaje, evitando importarlas incorrectamente.
- No se ha publicado el frontend en Vercel ni se han enviado commits al remoto.
- Los tests de navegador usan datos de prueba y un transporte aislado; los tests de SQL usan las migraciones reales y RLS. No equivalen a un ensayo remoto con credenciales Google.
