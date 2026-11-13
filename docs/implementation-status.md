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

Validación local ejecutada: build de producción y typecheck correctos; 15 tests PostgreSQL/RLS, 7 tests Calendar, 4 tests YouTube, 10 unitarios y 14 de navegador (50 en total). Axe sin violaciones en acceso y dashboard en los temas revisados. Las pruebas SQL incluyen almacenamiento privado, notas de ánimo, cápsulas, restauración y recordatorios deduplicados.

El token de administración ya está configurado. Se aplicaron las ocho migraciones al proyecto remoto, se desplegaron las funciones Calendar y YouTube y se programaron sincronización/recordatorios cada 15 minutos. Antes del despliegue se guardó una instantánea cifrada del catálogo y datos públicos: el proyecto tenía cero tablas públicas y cero usuarios. La copia está fuera de Git y no incluye Auth ni objetos Storage.

Cliente OAuth importado desde JSON y ambas redirecciones validadas. Google Auth ya está habilitado; las credenciales también están desplegadas para Calendar. Pendiente que las dos personas inicien sesión y autoricen sus conexiones en el navegador. Ver `getting-started.md`.

No se declara listo para producción ni validada la sincronización real hasta completar esa configuración y probar ambos usuarios con Google.

## Límites explícitos

- Correo y push desactivados. Spotify continúa por enlaces. El usuario amplió YouTube a conexión individual e importación/exportación y sincronización de playlists; implementada con OAuth separado, una playlist común por espacio, importación desde el canal propietario, exportación de canciones compartidas, altas/bajas directas en YouTube y lectura automática cada minuto. Las invitaciones nativas por correo no están disponibles en la API; se activa colaboración por enlace en YouTube. Pendiente consentimiento real y registrar el callback OAuth.
- Papelera restaurable, sin purga automática activada; nada se elimina definitivamente sin esa configuración.
- Calendar admite recurrencia diaria, semanal, mensual y anual; conserva reglas personalizadas de Google y sus excepciones. La edición de una única ocurrencia desde la app no está disponible: las acciones indican claramente que afectan a la serie.
- No se ha publicado el frontend en Vercel ni se han enviado commits al remoto.
- Los tests de navegador usan datos de prueba y un transporte aislado; los tests de SQL usan las migraciones reales y RLS. No equivalen a un ensayo remoto con credenciales Google.


## Exportación automática de Our Calendar

Migración `202611130006_automatic_calendar.sql` desplegada: los cambios locales se encolan en servidor y pg_net llama a la función inmediatamente después del commit. La cola mantiene generaciones para no perder ediciones concurrentes; los imports desde Google no se vuelven a exportar. Las cuentas ya conectadas quedan activadas sin volver a autorizar. El cron de 15 minutos conserva la reconciliación y los reintentos.

Se verificó el envío inmediato con la conexión real, sin crear eventos de prueba ni modificar títulos: se encoló un trabajo y se comprobó su procesamiento automático. Daily Quests queda separado. Las series semanales, fechas finales, series sin límite y excepciones importadas de Google están implementadas.


## Series compartidas e invitados

La migración 007 conserva reglas RFC5545 y zonas horarias. La interfaz expande únicamente el rango visible, por lo que Nunca no genera miles de filas. Ambas personas pueden ver los eventos; se quitó Solo yo del calendario. Google recibe a los dos correos autorizados como invitados con sendUpdates=all al crear o actualizar un evento; la aceptación depende de la configuración de cada cuenta. No se crean ni envían invitaciones sintéticas durante las pruebas.


## Playlist común de YouTube

Migración 008 y Edge Function `youtube`. Ambas personas pueden editar la misma playlist en Chimuverse mediante el token cifrado del propietario; no se envían credenciales al navegador. OAuth con PKCE, estado de un uso, identidad del correo comprobada y scope `youtube.force-ssl`, separado del login y Calendar. Se puede crear una playlist no listada (el enlace permite verla) o privada (solo el propietario la ve en YouTube), o importar una de su propio canal. La app lee directamente YouTube cada minuto y permite actualizar al instante. Altas/bajas se escriben inmediatamente y las bajas requieren confirmación. Exportar canciones locales incluye solo registros compartidos, con enlace válido de YouTube y sin duplicados; nunca exporta canciones privadas. Límite de 50 altas por exportación y 5000 elementos por playlist. No se elimina la playlist externa al desconectar.

La API no expone invitaciones de colaboradores por correo: se configura una vez en YouTube mediante Compartir → Invitar colaboradores. Desde Chimuverse ambos ya tienen acceso a editar por su membresía. La desconexión elimina la credencial local sin revocación global de Google, para no invalidar Calendar cuando se comparte cliente OAuth. Puede revocarse el acceso completo desde la cuenta Google.

No se han creado playlists reales ni enviado invitaciones durante las pruebas. Falta el consentimiento interactivo de Google del propietario para crear la playlist real; no se puede sustituir con el token de login o Calendar.

Despliegue YouTube verificado: ocho migraciones remotas, endpoint público rechaza solicitudes anónimas (401), Calendar conserva su scheduler sin fallos. Snapshot público cifrado realizado antes de la migración 008. El JSON OAuth local aún no contiene el callback de YouTube; debe añadirse en Google Cloud.


## Contraste y estados del panel YouTube

Se reforzó la separación entre el fondo cálido y las tarjetas blancas, los bordes y el texto secundario; en oscuro se elevaron las superficies y se aclararon sus bordes. Los estados vacíos son más compactos, con fondo violeta suave y borde sólido. Los tokens de la app son una adaptación del prototipo aprobada por el usuario.

En Nuestro soundtrack, sin conexión ni playlist se muestra el aviso de conectar; conectado sin playlist aparecen crear/importar. Con una playlist activa se ocultan los controles de conexión y creación, incluso para la pareja que no ha conectado su cuenta. Las opciones de conectar/desconectar quedan disponibles en Ajustes. Cuando falta o caduca la conexión del propietario se muestra el aviso de reconexión, sin exigir la conexión de la otra persona. La ayuda de colaboración en YouTube queda plegada.


## Espacio compartido sin visibilidad individual

Migración 009: convierte a compartidos todos los registros y fotos existentes, impone defaults/triggers/constraints compartidos y normaliza escrituras de clientes antiguos. Las notas de ánimo son legibles para ambos, igual que las finanzas; los presupuestos suman los registros de los dos. La UI elimina filtros y selectores «Solo yo», y el tipo de visibilidad solo admite compartido o cápsula. YouTube crea playlists no listadas y elimina la opción visible solo al propietario. Las cápsulas conservan su fecha de apertura; siguen vigentes membresía, secretos de servidor, autoría, papelera y bloqueo de terceros. Los tests prueban la conversión de datos previos y el rechazo de accesos externos.

## Banco de preguntas e ideas de citas

Migraciones 010 a 012, aplicadas en Supabase el 13 de noviembre de 2026: 300 preguntas en 20 temas y tres niveles, con fuentes editoriales, más 150 ideas de citas compartidas y pendientes. Se conservaron las preguntas, respuestas y citas creadas por los usuarios. Universo permite buscar sin tildes y filtrar por tema, nivel y estado. En Citas se puede elegir una idea y agendarla con `schedule_date`, que crea o reutiliza un único evento compartido del calendario, o marcarla como vivida. Detalle y fuentes en [universe-content-framework.md](universe-content-framework.md). `npm run verify:deployment` comprueba `seeded_questions=300` y `seeded_dates=150`.
