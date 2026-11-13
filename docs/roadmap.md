# Roadmap y validación

El código implementado se detalla en [estado de implementación](implementation-status.md). Una casilla de código no implica que el servicio remoto esté configurado.

## Base

- [x] React + Vite + TypeScript + Tailwind, fuentes y diseño v2.
- [x] Supabase CLI, entornos separados, migraciones y RLS.
- [x] Lista de dos cuentas autorizadas, máximo dos miembros.
- [x] CI, build, typecheck, pruebas SQL, Calendar y navegador.
- [x] Aplicar migraciones en Supabase remoto.
- [x] Habilitar Google Auth con credenciales OAuth.
- [ ] Probar acceso y consentimiento real con ambas cuentas.

## Nuestro día y nosotros

- [x] Login, perfil y dashboard conectados a Supabase.
- [x] Preguntas, respuestas, comparación y trivia.
- [x] Quests: crear, reportar, aprobar/rechazar/parcial, historial y métricas.
- [x] Reglas de no autoaprobación y aislamiento probadas en PostgreSQL.
- [x] Calendario local, agenda, fechas anuales y zona horaria.
- [x] OAuth Calendar individual, cifrado, sincronización, conflictos y reintentos.
- [x] Notificaciones persistentes, Realtime y recordatorios deduplicados.
- [x] Desplegar función/scheduler.
- [ ] Validar sincronización real con las dos cuentas tras configurar OAuth.
- [x] Push web (PWA) en celular y escritorio, con estado en Inicio y dispositivos en Ajustes.
- [x] Correo de respaldo por Gmail (gmail.send) cuando no hay push.
- [ ] Push: preferencias por tipo de aviso y horario de silencio.

## Recuerdos y expansión

- [x] Storage privado, fotos comprimidas, EXIF de fecha y eliminación de GPS.
- [x] Captura/subida separadas, viajes, timeline, descarga y reintentos.
- [x] Diario, notas, privacidad y cápsulas selladas en servidor.
- [x] Citas, metas/hitos/vision board, watchlist e historial.
- [x] Ánimo con nota privada, finanzas/presupuestos/ahorros, deseos y soundtrack.
- [x] Wrapped con datos compartidos.
- [x] Exportaciones JSON/CSV/ZIP y papelera restaurable.
- [ ] Activar purga de papelera y política de backups automáticos tras decidir retención.

## Salida a producción

- [ ] Ensayo remoto con ambos usuarios y una tercera cuenta sin acceso.
- [ ] Comprobar subidas, descarga privada y Calendar contra servicios reales.
- [ ] Configurar Vercel/dominio y las redirecciones definitivas.
- [ ] Revisión del usuario y PR/push cuando se solicite.
