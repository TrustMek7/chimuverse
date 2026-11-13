# Chimuverse: handoff de diseño v1

Dirección visual **«Constelación doméstica»**. Diseño de referencia y prototipo navegable:

- Lienzo compartido: https://claude.ai/artifact/BYMrgdMYkhFahu3KFM4rKi (se abre con «cualquiera con el enlace»).
- Fuentes del prototipo: `design/prototipo/project/*.dc.html` y `design/prototipo/project/chimu.css`. La hoja `chimu.css` contiene los valores exactos de cada componente y estado.
- Tokens para Tailwind v4: `design/handoff/tokens.css`. Mismos valores que `chimu.css`, con los nombres de `docs/design.md` §2.8.

Este documento sustituye las secciones visuales de `docs/design.md` (paleta, tipografía y nombres de color de persona). La arquitectura de rutas, los componentes y las reglas de backend de ese documento siguen vigentes, salvo donde se indica aquí.

## 1. Dirección visual (resumen)

1. **Estrellas con significado.** El motivo astronómico solo se usa donde transmite información: la constelación del día (Inicio), los estados de quest, los estados vacíos (constelación sin encender), el acceso y Wrapped. Nunca se usa como decoración en fondos de contenido.
2. **Dos voces.** José Luis = violeta (`primary`), Glenny = rosa (`accent-ink`), siempre con iniciales. No hay fotos de perfil reales.
3. **Reportado ≠ verificado.** Reportado se dibuja como relleno rayado ámbar y verificado como relleno sólido verde. Cada barra lleva su etiqueta y su porcentaje.
4. **La privacidad se ve.** Todo lo que puede ser personal lleva `VisibilityPill` con icono y texto.
5. **Cielo solo donde importa.** En el tema claro, el único bloque oscuro (`night`) es el resumen del día. Wrapped y Acceso son «noche» completa.

## 2. Tokens

Ver `tokens.css`. Puntos clave:

| Grupo | Valores |
|---|---|
| Fuentes | Fraunces 500–700 (títulos, `opsz` auto), Figtree 400–800 (UI y contenido), Caveat 600 (solo pies de polaroid y notas, ≥ 20 px). Autoalojadas con `@fontsource`; el prototipo usa Google Fonts solo para previsualizar. |
| Escala | 12/16 · 14/20 · 16/24 · 18/25 · 22/29 · 28/34 · 36/41 · 48/52. En móvil el h1 baja a 32 y no se usa display. |
| Espaciado | Base 4. Gutter de página: 16 px (móvil) · 24 (md) · 40 (lg+). Contenido: máx. 1240 px. Separación entre bloques: 24–32 px; dentro de tarjetas, 12–16 px. |
| Radios | 8 (sm) · 12 (inputs) · 16 (ítems de lista) · 20 (tarjetas) · 24 (diálogos y hojas) · 28 (cielo) · pill (botones, chips) |
| Sombras | `shadow-1` (ítem activo), `shadow-2` (popovers), `shadow-3` (diálogos, toasts), `shadow-polaroid` |
| Breakpoints | `sm 640` · `md 768` (rail de iconos de 72 px) · `lg 1024` (sidebar de 272 px) · `xl 1280` · `2xl 1440` |
| Foco | `outline: 3px solid var(--color-focus); outline-offset: 2px` en `:focus-visible` |

**Contraste verificado (AA)** sobre `bg` claro: ver §10 (valores v2). `accent` (#FF7BA8) **no** se usa como color de texto. En oscuro todos los pares de texto superan 7:1. Hay que volver a verificar con axe en la implementación.

## 3. Iconografía

`lucide-react`, `strokeWidth={1.8}`, tamaños 16 / 20 / 24 / 32. Correspondencia con el prototipo: home→`House`, quests→`ListChecks`, calendar→`Calendar`, orbit→`Orbit`, image→`Image`, book→`BookOpen`, heart→`Heart`, target→`Target`, film→`Clapperboard`, smile→`Smile`, wallet→`Wallet`, gift→`Gift`, music→`Music`, sparkle→`Sparkles`, bell→`Bell`, lock→`Lock`, users→`Users`, swap→`ArrowLeftRight`, cloud-off→`CloudOff`, cloud-ok→`CloudCheck`, hourglass→`Hourglass`, shuffle→`Shuffle`.

Los **glifos de estado** son propios (SVG en `chimu.css`, clases `.i-st-*`): círculo punteado (pendiente), medio círculo (en progreso), círculo con tres puntos (por verificar), círculo con X (rechazada) y estrella llena (completada). Exportarlos como componentes `StatusGlyph`.

Logo: dos puntos (violeta y rosa) unidos por un arco punteado, con una estrella dorada. SVG en línea en `Sidebar.dc.html`; exportar como `Logo.tsx` (24 / 32 px, más favicon).

## 4. Navegación

- **Grupos:** Inicio · Nuestro día (Daily Quests, Our Calendar) · Nosotros (Nuestro Universo, Mood Tracker) · Recuerdos (Memory Vault, DevLog of Us, Our Wrapped) · Experiencias (Date Planner) · Entretenimiento (Watchlist, Wishlist & Soundtrack) · Creciendo (Goals & Dreams, Our Finances). Ajustes va en el pie de la barra lateral.
- **Escritorio (lg+):** barra lateral de 272 px (`bg-sunk`), con el ítem activo en `surface` + `shadow-1` + `aria-current="page"` e icono en `primary`. Barra superior: fecha, tema, campana con punto (`aria-label="Notificaciones, N sin leer"`) y par de avatares.
- **Móvil (< md):** barra inferior de 5 elementos (Inicio · Día · **Crear** · Recuerdos · Más), cada uno de 54 px de alto, con el indicador activo arriba. «Día» tiene pestañas internas (Daily Quests | Calendario). «Crear» abre una hoja inferior. «Más» lista el resto de módulos con los mismos grupos, además de Notificaciones y Cerrar sesión. En los detalles se oculta la barra inferior y se muestra «Atrás».
- **Tablet (md):** rail de 72 px solo con iconos y tooltip. No se diseñó una pantalla específica; se deriva de la barra lateral.

## 5. Componentes (variantes y estados)

| Componente | Variantes | Estados / reglas |
|---|---|---|
| `Button` | primary · secondary · ghost · ok · danger · night; sm 36 (solo con puntero fino) · md 44 | hover, active (1 px abajo), focus-visible, disabled (opacidad .5), loading (`aria-busy` + spinner + texto «Guardando…») |
| `IconButton` | igual, 44×44 | `aria-label` obligatorio |
| `StatusPill` | pending · progress · review · rejected · done | glifo + texto + color. Review dice «Te toca verificar» o «Esperando a {pareja}» según quién reportó |
| `DualProgress` | grande (14 px, dos filas) · compacta (6 px, superpuesta) | `role="group"` + 2 × `role="meter"` |
| `VisibilityPill` / `VisibilityPicker` | Solo yo · Compartido · Cápsula(fecha) | el selector es `SegmentedControl`; por defecto, **Solo yo** |
| `SyncStatus` | off · run · ok · err · conflict | icono + texto; `run` gira (sin giro con reduce-motion) |
| `SegmentedControl` | normal · fill (móvil, 44 px) | `aria-pressed` o radiogroup |
| `Choice` | botón seleccionable (responsable, tipo, filtros) | `aria-pressed`; borde + fondo `primary-soft` |
| `TextField` / `TextArea` / `Select` / `DateField` | — | label visible, error con icono vinculado por `aria-describedby`, `aria-invalid`, borde `st-rejected`; deshabilitado en `bg-sunk`. 16 px en móvil (evita el zoom de iOS) |
| `Dialog` (escritorio) / `Sheet` (móvil) | — | radio 24, scrim `rgba(21,17,29,.48)`, botón «Cerrar» visible, `Esc`, foco atrapado |
| `Toast` | — | `ink` sobre `bg`, abajo al centro, 3 s, `role="status"` |
| `Banner` | info · warn · err · ok | icono + texto + acción opcional |
| `EmptyState` | — | constelación sin encender (3 puntos) + título + texto + 1 CTA |
| `Skeleton` | línea · bloque · avatar | `aria-busy` en el contenedor; sin animación con reduce-motion |
| `Avatar` / `AvatarPair` | 24 · 32 · 56 · 80 | iniciales; JL=violeta, GS=rosa |
| `Polaroid` | — | marco #FFFEFB, 10 px por los lados y arriba, pie con Caveat; rotación determinista de −2.5° a 2° según el id (0° con reduce-motion) |
| `SkyPanel` | — | fondo `night` con 6 puntos de estrella en CSS; texto `on-night` |

## 6. Comportamientos clave

### Daily Quests
- Estados: `pending` → (reporte) `review` → aprobar: `progress` (si < 100) o `done` (si 100) · aprobar parcial: `progress` con verificado ≤ reportado · rechazar: `rejected` (el verificado no cambia) → volver a reportar.
- **Quien reporta nunca ve los botones Aprobar/Rechazar**: ve el banner «Esperando a {pareja}» con candado. En las quests compartidas, verifica quien no hizo el reporte. Se debe imponer también en el backend (RPC + CHECK, como en `docs/design.md` §9.3).
- Validación: título de 3 a 80 caracteres; el nuevo reporte debe ser mayor que el verificado actual; el motivo de rechazo es obligatorio (≥ 10 caracteres). La nota del reporte es opcional (máx. 280).
- Filtros: Todas · Mías · Compartidas · Por verificar (contador = reportes que me toca verificar).
- Historial inmutable, del más reciente al más antiguo: creada / reportó X % / verificó X % / verificó X de Y % / rechazó + motivo.

### Inicio
- Orden en escritorio: saludo → [cielo «La constelación de hoy» (2/3) + «Te toca» (1/3)] → [próximo evento / fecha especial (ticket) · recuerdo de hace un año (polaroid) · pregunta del día + escribir nota].
- Orden en móvil: saludo → «Te toca» → cielo compacto → ticket → pregunta → recuerdo.
- Los totales del cielo son promedios del día: reportado = media de los % reportados; verificado = media de los % verificados.
- El recuerdo destacado solo usa fotos **compartidas**.

### Calendar
- Semana de lunes a domingo, `es-PE`, hora de Lima. Mes en escritorio y Agenda (lista por día) en móvil y como vista accesible.
- Tipos: Compartido · Fecha especial (anual) · Recordatorio · Solo yo (borde punteado + candado). El tipo por defecto de un evento nuevo es **Solo yo**.
- Google Calendar: **conexión individual desde Ajustes o desde el banner**, nunca al iniciar sesión. Solo se sincroniza un calendario propio llamado «Chimuverse». «Añadir también a mi Google Calendar» está desactivado por defecto y deshabilitado si no hay conexión.
- Conflicto: comparación lado a lado con los campos distintos resaltados → Mantener Chimuverse · Usar la de Google · Decidir después.

### Memory Vault
- Agrupado por **fecha del recuerdo**. La fecha de subida es automática y de solo lectura. Si no hay EXIF, la fecha del recuerdo es obligatoria.
- Subida: progreso por archivo, error con reintento individual. Visibilidad por defecto: **Solo yo**.

### DevLog
- Tipos: hicimos · nos pasó · aprendimos · acordamos (anillo `primary` y se fija en «Acuerdos vigentes») · nota para la pareja (siempre compartida) · cápsula (fecha de apertura futura obligatoria; contenido sellado hasta esa fecha, incluso para quien la escribió; el título puede ocultarse).
- Las entradas privadas de la otra persona no existen en la interfaz (no se muestran como «ocultas»).

### Movimiento
- 120 ms para hover y pulsación, 200 ms para menús y pestañas, 320 ms para hojas y diálogos; `ease-out` al entrar.
- Ruleta: 1.2 s. Con reduce-motion, el resultado aparece directamente.

## 7. Recursos exportables

| Recurso | Dónde |
|---|---|
| Tokens (Tailwind v4) | `design/handoff/tokens.css` |
| CSS de referencia de componentes | `design/prototipo/project/chimu.css` |
| Logo, glifos de estado y constelación | SVG en línea en `Sidebar.dc.html`, `chimu.css` (`.i-st-*`) e `InicioDesktop.dc.html` |
| Marcadores de foto | `.ph-*` en `chimu.css`. **Son solo marcadores**; se reemplazan por fotos reales (URL firmadas) |
| Datos de ejemplo | Dentro de cada `.dc.html` (`SEED`, `EV`, etc.). Ficticios |

## 8. Supuestos (valor más privado cuando la decisión está abierta)

1. Fotos nuevas del Vault: **Solo yo** por defecto (en `docs/design.md` eran «Compartido»). Hay un ajuste para cambiar el valor por defecto.
2. Entradas del DevLog y registros de ánimo: **Solo yo**. El ánimo se comparte por registro y solo el estado, nunca la nota.
3. Eventos nuevos: **Solo yo** por defecto. Free/busy compartido: apagado.
4. Finanzas personales: privadas; la pareja no ve ni los totales salvo que se active un ajuste.
5. Ideas de regalo en Wishlist: pueden ser «Solo yo» para no arruinar la sorpresa.
6. La respuesta de la pareja en Universo está oculta hasta que respondes. Es una regla de juego, no de seguridad.
7. Notificaciones por correo: **no disponibles**; se muestran como «Próximamente» y no se pueden activar.
8. Spotify/YouTube: solo enlaces y exportación CSV/JSON; no hay conexión de cuentas.
9. El usuario actual del prototipo es José Luis; todas las pantallas se reflejan para Glenny.
10. Zona horaria America/Lima, formato es-PE y moneda PEN.

## 9. Pendientes (no implementado ni simulado como funcional)

- **La integración con Google Calendar es simulada en el prototipo**: los estados (desconectado, sincronizando, sincronizado, error, conflicto) son visuales. Queda por definir: OAuth incremental, creación del calendario «Chimuverse», estrategia de conflictos, reintentos y tokens.
- Verificaciones de quests y subida de fotos: el prototipo no guarda nada.
- Faltan por diseñar: rail de tablet (md), onboarding (`/bienvenida`), 404, banner de sin conexión, papelera, detalle de viaje, editor de gustos, creación de preguntas propias y estado «Lo hablamos» (2 o más rechazos seguidos), propuesto en `docs/design.md`.
- Resto de pantallas en tema oscuro: los tokens ya existen, pero solo Inicio y Wrapped se revisaron visualmente.
- Validar el contraste con axe en ambos temas una vez implementado.
- Decisiones de producto: quién verifica las quests compartidas cuando ambos reportan, retención de la papelera y límites de almacenamiento.

## 10. Revisión v2: más color y movimiento (13 nov 2026)

Cambios aplicados tras la primera revisión («se ve opaco y lineal»):

- **Paleta más viva.** Primario violeta eléctrico `#6B45D8`, rosa `#B8255E`/`#FF7BA8`, oro `#F5B83D` y fondo crema más claro `#FFF8F1`. Hay cuatro acentos nuevos, uno por grupo de navegación: coral (Nuestro día), turquesa (Experiencias), cielo (Entretenimiento) y lima (Creciendo). Nosotros usa el rosa, Recuerdos el violeta e Inicio el oro.
- **Degradado de marca** `#6B45D8 → #C2389A` solo en el CTA primario, los toasts, el botón «Crear» y el nombre del saludo (texto con degradado). Blanco sobre ambos extremos ≥ 4.6:1.
- **Barra lateral nocturna.** Cielo `#1E1638` con estrellas y halos coral y turquesa; cada ícono va en el color de su grupo. El ítem activo lleva una barra luminosa a la izquierda y una estrella que titila. Los tokens se redefinen dentro de `.side` (ink claro), así que los hijos no necesitan estilos propios.
- **Barra inferior flotante** con radio 26 px y desenfoque. «Crear» es un botón elevado con degradado (gira 90° al pasar el cursor) y el ítem activo tiene una píldora del color de su grupo.
- **Fondos cálidos.** Halos radiales muy suaves (coral, turquesa y rosa, opacidad de 6 a 13 %) en `.main` y en el teléfono.
- **Animaciones** (todas se desactivan con `prefers-reduced-motion`):
  - Entrada escalonada de bloques: subida de 16 px, 0.6 s, +70 ms por bloque. La sidebar entra deslizándose.
  - Barras de progreso que crecen al entrar; el rayado de «Reportado» se desplaza (fluye) porque está pendiente; «Verificado» es sólido.
  - Cielo: estrellas que titilan, líneas punteadas de la constelación en movimiento, anillos de «por verificar» girando y estrella completada con brillo.
  - Hover: tarjetas que se elevan 3 px, polaroids que se enderezan y suben, la tarjeta de la pregunta que se inclina, iconos que giran o se desplazan.
  - Diálogos con *pop*, hojas que suben, toasts que aparecen desde abajo y el contador de la sidebar con rebote.
- Contrastes nuevos sobre `#FFF8F1`: ink 15:1, primary 5.5:1, accent-ink 5.8:1, coral-ink 5.4:1, teal-ink 5.6:1, sky-ink 6.4:1, st-done 4.8:1 y st-rejected 5.1:1. Hay que volver a verificarlos con axe.
