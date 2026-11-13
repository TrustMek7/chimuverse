# Chimuverse — Catálogo de funcionalidades v0.1

Documento de guía de implementación, **no especificación formal cerrada**. Dos usuarios privados. Diseño visual vigente: `design/handoff/HANDOFF.md` (v2).

## Navegación conceptual (editable)
- **Nuestro día:** Daily Quests, Our Calendar
- **Nosotros:** Nuestro Universo, Mood Tracker
- **Recuerdos:** Memory Vault, DevLog of Us, Our Wrapped
- **Entretenimiento:** Watchlist, música de Wishlist & Soundtrack
- **Experiencias:** Date Planner, wishlist de planes
- **Creciendo:** Goals & Dreams, Our Finances

## P1 — Esenciales (MVP)
### M01 Nuestro Universo
- Perfiles y gustos individuales; preguntas temáticas; respuestas; comparador de preferencias; trivia de pareja.
### M03 Daily Quests
- Tareas diarias individuales/compartidas, avance reportado, **verificación cruzada por la otra persona**, porcentaje reportado y verificado separados, historial.
- No permitir que una persona apruebe su propio avance. Definir procedimiento para rechazos/correcciones.
### M04 Our Calendar
- Fechas especiales, eventos y horarios compartidos, recordatorios.
- **Sincronización real bidireccional con Google Calendar** para las dos cuentas, con OAuth individual; gestionar cambios, conflictos, tokens y fallos. Fasear su implementación sin eliminarla del alcance.
### M08 Memory Vault
- Fotos estilo Polaroid (solo orientación funcional, no diseño definitivo), fecha del recuerdo automática o manual y fecha de subida separada; viajes con álbum propio; timeline.
### M09 DevLog of Us
- Diario de lo que hicieron, les pasó, aprendieron y acordaron; notas para el otro; cápsula del tiempo.

## P2 — Importantes
### M05 Date Planner
- Ideas de citas (casa, restaurantes, fiestas, etc.), programación opcional y editable, ruleta aleatoria, historial; vínculo a Calendar.
### M06 Goals & Dreams
- Metas individuales y conjuntas, objetivos/hitos, progreso, vision board.
### M11 Watchlist
- Series, películas y videojuegos pendientes; en progreso y completados; ruleta. Al completar **sale de pendientes pero se conserva en historial**.

## P3 — Complementarios
### M02 Mood Tracker
- Estado de ánimo diario, historial, tendencias; compartir voluntariamente.
### M07 Our Finances
- Ingresos/egresos fijos, variables y extras; presupuestos, ahorros individuales y compartidos; privacidad por decidir.
### M12 Wishlist & Soundtrack
- Deseos, necesidades, regalos; playlists propias, enlaces Spotify/YouTube y exportación CSV/JSON. Sincronización externa opcional posterior.

## P4 — Evolución
### M10 Our Wrapped
- Resumen anual, estadísticas compartidas, momentos destacados; conservar timestamps e historial desde MVP.

## Reglas transversales
- Acceso exclusivo a dos cuentas autorizadas; datos privados por defecto.
- Permisos diferenciados por usuario y espacio compartido; RLS en tablas accesibles desde cliente.
- Notificaciones internas para eventos relevantes; correo y push a definir, preferencias y evitar duplicados.
- Exportación de datos y copias de seguridad; accesibilidad móvil; zona horaria configurable.
- No borrar registros históricos al marcarlos como completados.

## Criterios de salida MVP (orientativos)
- Ambos inician sesión con Google y nadie fuera de la lista autorizada accede a datos.
- Cada uno puede editar su perfil y responder preguntas.
- Una tarea reportada solo se vuelve verificada tras aprobación de la otra persona.
- Eventos se pueden crear, editar y visualizar; integración Calendar bidireccional probada con las dos cuentas antes de declarar completo el módulo.
- Fotos privadas con fecha del recuerdo y álbum por viaje; diario con entradas persistentes.
- Se registran errores de sincronización y hay reintentos controlados.
