# Banco de conversaciones e ideas de citas

## Alcance y autoría

Se incorporan 300 preguntas nuevas en español, agrupadas en 20 temas con 15 preguntas por tema. Se conservan las seis preguntas iniciales y las preguntas y respuestas creadas por los usuarios. Cada pregunta nueva conserva en PostgreSQL un identificador estable, una clave de banco, un nivel editorial y una referencia al enfoque que inspiró su tema.

La IA se utilizó para redactar y organizar contenido original a partir de conceptos revisados en fuentes de internet. No se copiaron las 36 preguntas de Aron ni cuestionarios comerciales de Gottman. La IA es una herramienta de elaboración, no una fuente de evidencia. El banco no es una escala psicológica validada y no calcula compatibilidad, diagnósticos o puntuaciones de relación.

## Marco teórico y fuentes primarias

| Enfoque | Aplicación editorial | Fuente |
|---|---|---|
| Conocimiento del mundo de la pareja, o mapas del amor | Interés por rutinas, gustos, historias, vínculos y cambios actuales. Las respuestas pueden cambiar; se pueden editar. | [The Gottman Institute: Build Love Maps](https://www.gottman.com/blog/build-love-maps/) |
| Apertura personal gradual y recíproca | Empezar por temas accesibles y ofrecer conversaciones progresivamente más personales. El artículo estudia una actividad estructurada; no valida este banco concreto. | [Aron et al. (1997), The Experimental Generation of Interpersonal Closeness](https://journals.sagepub.com/doi/10.1177/0146167297234003) |
| Teoría de la autodeterminación en relaciones | Preguntas sobre autonomía, capacidad, apoyo y conexión: expresar preferencias sin presión y acompañar metas propias y comunes. | [Center for Self-Determination Theory: Relationships](https://selfdeterminationtheory.org/topics/application-relationships/) |
| Reparación durante los desacuerdos | Conversar sobre pausas, disculpas, límites y formas de retomar un diálogo. Se evita presentar el conflicto como una prueba que se gana. | [The Gottman Institute: How to Make Repair Attempts](https://www.gottman.com/blog/make-repair-attempts-partner-feels-loved/) |
| Compartir acontecimientos positivos, o capitalización | Dar espacio a buenas noticias, esfuerzos y celebraciones, y preguntar cómo gusta recibir entusiasmo y reconocimiento. | [Gable et al. (2004), What do you do when things go right?](https://pubmed.ncbi.nlm.nih.gov/15301629/) |

Consulta de fuentes: 13 de noviembre de 2026. Las asociaciones de tema y fuente son decisiones editoriales de Chimuverse, no afirmaciones de que los autores formularon estas preguntas.

## Niveles y experiencia

- **Para empezar:** gustos, anécdotas y preferencias accesibles.
- **Para conocernos:** experiencias personales, necesidades y acuerdos cotidianos.
- **Para profundizar:** significado, límites, decisiones y conversaciones que requieren más confianza.

Los tres niveles tienen 100 preguntas cada uno. No representan dificultad clínica ni un orden obligatorio. Se pueden saltar preguntas o responder por turnos. La interfaz ofrece búsqueda sin depender de tildes, filtros por tema, nivel y estado de respuestas, y bloques de 24 tarjetas. Las referencias también están disponibles en la interfaz.

## Ideas de citas

Se incorporan 150 ideas compartidas pendientes, a partir de la unión de las dos imágenes aportadas por el usuario y propuestas originales. Se normalizaron equivalentes y se añadieron opciones de casa, sabores, cultura, naturaleza, creatividad, juegos, cuidado, escapadas, comunidad y proyectos. Los espacios abiertos de la primera imagen no se convirtieron en registros repetidos.

La duración y el presupuesto son estimaciones editoriales modificables, no precios investigados ni reservas. Los proyectos grandes se plantean como una conversación o planificación, sin asumir que la pareja quiera realizarlos. Las ideas se insertan sin reemplazar citas existentes y sin crear eventos, recordatorios ni invitaciones.

## De una cita al calendario

1. Cualquiera de los dos elige **Agendar cita** y ajusta inicio y final en su zona horaria.
2. `schedule_date` comprueba membresía, tipo de registro y fechas dentro de una transacción; bloquea la cita para impedir eventos duplicados por solicitudes concurrentes.
3. Se crea un evento compartido y se guarda `entries.calendar_event_id`. Las siguientes llamadas cambian ese evento, incluso cuando agenda la otra persona. Un evento enviado a la papelera se restaura al volver a agendarlo.
4. La cola automática existente exporta el evento cuando su propietario tiene conexión de Google Calendar y utiliza los dos correos configurados como invitados. Sin conexión, permanece guardado en la app y entra en la sincronización cuando el propietario conecte Calendar.
5. **Ver en el calendario** abre el evento y su mes. Registrar una idea o marcar una cita como vivida no crea una reserva ni borra su evento.

El banco de preguntas y el de citas son reproducibles con `npm run content:build` desde `backend`. `npm run content:check` valida cantidad, estructura, longitud, duplicados normalizados y que las migraciones correspondan a los archivos de contenido. Las claves estables y las comprobaciones de coincidencia evitan duplicar registros al repetir una carga.
