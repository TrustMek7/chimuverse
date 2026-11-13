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

Validación local ejecutada: build de producción y typecheck correctos; 13 tests PostgreSQL/RLS, 7 tests Calendar, 10 unitarios y 10 de navegador (40 en total). Axe sin violaciones en acceso y dashboard en los temas revisados. Las pruebas SQL incluyen almacenamiento privado, notas de ánimo, cápsulas, restauración y recordatorios deduplicados.

El token de administración ya está configurado. Se aplicaron las siete migraciones al proyecto remoto, se desplegó la función Calendar y se programaron sincronización/recordatorios cada 15 minutos. Antes del despliegue se guardó una instantánea cifrada del catálogo y datos públicos: el proyecto tenía cero tablas públicas y cero usuarios. La copia está fuera de Git y no incluye Auth ni objetos Storage.

Cliente OAuth importado desde JSON y ambas redirecciones validadas. Google Auth ya está habilitado; las credenciales también están desplegadas para Calendar. Pendiente que las dos personas inicien sesión y autoricen sus conexiones en el navegador. Ver `getting-started.md`.

No se declara listo para producción ni validada la sincronización real hasta completar esa configuración y probar ambos usuarios con Google.

## Límites explícitos

- Correo y push desactivados. Spotify continúa por enlaces. El usuario amplió YouTube a conexión individual e importación/exportación y sincronización de playlists; esa integración aún está pendiente de implementar.
- Papelera restaurable, sin purga automática activada; nada se elimina definitivamente sin esa configuración.
- Calendar admite recurrencia diaria, semanal, mensual y anual; conserva reglas personalizadas de Google y sus excepciones. La edición de una única ocurrencia desde la app no está disponible: las acciones indican claramente que afectan a la serie.
- No se ha publicado el frontend en Vercel ni se han enviado commits al remoto.
- Los tests de navegador usan datos de prueba y un transporte aislado; los tests de SQL usan las migraciones reales y RLS. No equivalen a un ensayo remoto con credenciales Google.


## Exportación automática de Our Calendar

Migración `202611130006_automatic_calendar.sql` desplegada: los cambios locales se encolan en servidor y pg_net llama a la función inmediatamente después del commit. La cola mantiene generaciones para no perder ediciones concurrentes; los imports desde Google no se vuelven a exportar. Las cuentas ya conectadas quedan activadas sin volver a autorizar. El cron de 15 minutos conserva la reconciliación y los reintentos.

Se verificó el envío inmediato con la conexión real, sin crear eventos de prueba ni modificar títulos: se encoló un trabajo y se comprobó su procesamiento automático. Daily Quests queda separado. Las series semanales, fechas finales, series sin límite y excepciones importadas de Google están implementadas.


## Series compartidas e invitados

La migración 007 conserva reglas RFC5545 y zonas horarias. La interfaz expande únicamente el rango visible, por lo que Nunca no genera miles de filas. Ambas personas pueden ver los eventos; se quitó Solo yo del calendario. Google recibe a los dos correos autorizados como invitados con sendUpdates=all al crear o actualizar un evento; la aceptación depende de la configuración de cada cuenta. No se crean ni envían invitaciones sintéticas durante las pruebas.
