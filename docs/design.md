# Chimuverse — Diseño de producto e interfaz v0.1

> **Autoría y procedencia.** Este documento lo redactó **Claude Code (Claude Opus 5.5) como consultor de diseño**, a partir de `README.md` y `docs/*.md`. **No se produjo con Claude Design** (ver §0). Es una propuesta implementable para Codex; paleta, tipografía y componentes pueden reemplazarse si más adelante se trabaja en Claude Design, sin cambiar la arquitectura de componentes ni las reglas de privacidad.
>
> Fecha: 2026-11-12. Estado: propuesta para revisión de José Luis y Glenny.

---

## 0. Estado de Claude Design (bloqueo documentado)

| Verificación | Resultado |
|---|---|
| Qué es | Claude Design es un producto de Anthropic (beta, planes de pago) en `claude.ai/design` y en la app de escritorio. Desde Claude Code se accede con las skills `/design` (crear/editar/sincronizar proyectos de diseño) y `/design-sync` (llevar un design system local a Claude Design). |
| Skills `/design` o `/design-sync` en esta sesión | **No disponibles.** No aparecen entre las skills cargadas; `~/.claude/plugins/installed_plugins.json` está vacío. |
| Herramienta `DesignSync` | Existe en la sesión, pero su contrato dice que **solo debe usarse dentro de `/design-sync` iniciado por la persona usuaria**. Además solo lee y escribe *design systems*; no genera pantallas. **No se usó.** |
| ¿Se puede instalar? | No es un plugin que se instale con un comando. Según la documentación pública, si faltan las skills hay que ejecutar `/update` y **abrir una sesión nueva** de Claude Code, con una cuenta de plan de pago con Claude Design activado. Son acciones de la persona usuaria en la CLI; un agente no puede hacerlas desde dentro de la sesión. |
| Aviso adicional | La propia descripción de la herramienta indica que **Claude Design independiente (`claude.ai/design`) cierra el 14-12-2026** y que "ahora vive en Claude". Conviene que cualquier trabajo futuro se haga en la versión integrada en Claude. |

**Qué se entrega en su lugar:** este documento (diseño escrito y especificación implementable). Está estructurado como tokens + componentes para poder llevarlo después a Claude Design con `/design-sync` si se desea.

**Para usar Claude Design después (lo hacen las personas, no el agente):**
1. En la CLI de Claude Code: `/update`, cerrar sesión y abrir una nueva.
2. Comprobar que existen `/design` y `/design-sync` y que el plan de la cuenta incluye Claude Design.
3. Cuando exista `frontend/src/styles/tokens.css` y los componentes base, ejecutar `/design-sync` para crear el design system "Chimuverse" y luego iterar las pantallas con `/design`.

---

## 1. Principios de diseño

1. **Íntimo, no corporativo.** Es un espacio de dos personas: lenguaje en segunda persona plural ("nuestro día", "lo que aprendimos"), microcopias cálidas y sin gamificación agresiva.
2. **La privacidad se ve.** Todo contenido que pueda ser personal muestra **siempre** un indicador de visibilidad (`Solo yo` / `Compartido` / `Cápsula`). La opción por defecto es la más privada.
3. **Dos voces, una pantalla.** Cada dato muestra de quién es (avatar o inicial más color de persona). Lo reportado y lo verificado nunca se mezclan visualmente.
4. **Móvil primero, escritorio cómodo.** Uso diario en el teléfono (quests, ánimo, fotos); planificación en escritorio (calendario, finanzas, wrapped).
5. **Nada se pierde.** Completar, rechazar o archivar nunca borra el historial; la interfaz siempre ofrece "ver historial".
6. **Calma.** Animaciones cortas, sin confeti obligatorio y respetando `prefers-reduced-motion`.

### Identidad visual (propuesta original)
Concepto **"Constelación doméstica"**: cada recuerdo, tarea o meta es una estrella pequeña del universo que construyen juntos. Fondo crema cálido de día y cielo nocturno violeta de noche. Motivo gráfico: puntos y líneas finas que unen dos puntos (las dos personas). Se usa con moderación en encabezados, estados vacíos y el logo. No se usan personajes ni recursos de terceros.

Logo de trabajo: tipográfico, `Chimuverse` en la fuente display, con un `♡` pequeño que hace de "estrella" sobre la `i`. Isotipo: dos puntos unidos por un arco (SVG propio, 24×24 y 32×32, más favicon).

---

## 2. Design tokens

Se implementan como **variables CSS** consumidas por Tailwind v4 (`@theme`). Tema claro ("día") y oscuro ("noche"); por defecto se sigue `prefers-color-scheme` y se puede fijar en Ajustes.

### 2.1 Color — semánticos

Los contrastes son aproximados y están calculados para texto normal sobre `bg`. **Codex debe verificarlos con una herramienta** (axe o el validador del navegador) antes de cerrar.

| Token | Día | Noche | Uso | Contraste objetivo |
|---|---|---|---|---|
| `--color-bg` | `#FBF7F2` | `#15121F` | Fondo de la app | — |
| `--color-surface` | `#FFFFFF` | `#1F1A2E` | Tarjetas, hojas | — |
| `--color-surface-2` | `#F3ECE4` | `#2A2440` | Zonas hundidas, inputs | — |
| `--color-border` | `#E4D9CC` | `#3B3355` | Bordes y separadores (no informativos) | — |
| `--color-border-strong` | `#8A7F99` | `#7D7398` | Bordes de inputs y controles | ≥ 3:1 (no texto) |
| `--color-text` | `#2A2238` | `#F2EDF7` | Texto principal | ≥ 12:1 |
| `--color-text-muted` | `#5E5470` | `#B7AECB` | Texto secundario | ≥ 6:1 |
| `--color-primary` | `#6B4FA0` | `#B9A3F0` | Acciones principales, foco, enlaces | ≥ 4.5:1 con `on-primary` |
| `--color-on-primary` | `#FFFFFF` | `#1A1528` | Texto sobre primary | — |
| `--color-primary-soft` | `#ECE5F7` | `#2F2750` | Fondos seleccionados | — |
| `--color-accent` | `#B83A52` | `#F08A9C` | Corazón, momentos especiales, aniversarios | ≥ 4.5:1 como texto |
| `--color-accent-soft` | `#FBE6EA` | `#3A2030` | Fondo de destacados | — |
| `--color-success` | `#2F7D5B` | `#7FD1A8` | Verificado, sincronizado | ≥ 4.5:1 |
| `--color-warning` | `#9A6200` | `#F2C46D` | Pendiente de verificación, conflictos | ≥ 4.5:1 |
| `--color-danger` | `#B3261E` | `#FF8A80` | Errores, rechazado, borrar | ≥ 4.5:1 |
| `--color-info` | `#2B5FA8` | `#8FB8F2` | Info, sincronizando | ≥ 4.5:1 |
| `--color-focus` | `#6B4FA0` | `#D2C4FA` | Anillo de foco | ≥ 3:1 contra el fondo |

Para cada estado (`success`, `warning`, `danger`, `info`) hay además un `*-soft` de fondo (día: tinte al 10 %; noche: tinte al 18 % sobre `surface`).

### 2.2 Color — personas

Cada miembro tiene un color de identidad que **siempre va acompañado de avatar o inicial**; el color nunca es el único indicador.

| Token | Día | Noche | Asignación |
|---|---|---|---|
| `--color-person-a` | `#2F6F8F` (azul petróleo) | `#7CC3E3` | Primer miembro creado |
| `--color-person-b` | `#A0527A` (malva) | `#E7A2C6` | Segundo miembro |

Cada quien puede intercambiarlo en Ajustes → Perfil (de una lista de 6 colores validados). Se guarda en `profiles.accent_color`. Es un dato cosmético y no afecta la privacidad.

### 2.3 Color — grupos de navegación (solo decorativo)

| Grupo | Token | Día | Icono (lucide) |
|---|---|---|---|
| Nuestro día | `--hue-day` | `#C77A1E` | `sun` |
| Nosotros | `--hue-us` | `#A0527A` | `heart` |
| Recuerdos | `--hue-memories` | `#6B4FA0` | `images` |
| Entretenimiento | `--hue-fun` | `#2F6F8F` | `clapperboard` |
| Experiencias | `--hue-plans` | `#2F7D5B` | `map-pin` |
| Creciendo | `--hue-grow` | `#7A6A2E` | `sprout` |

Se usan en el icono del grupo, en una franja de 4 px del encabezado de página y en las ilustraciones de estados vacíos. **Nunca como fondo de texto.**

### 2.4 Tipografía

Fuentes con licencia OFL, **autoalojadas con `@fontsource`** (sin Google Fonts CDN, para no filtrar visitas a terceros).

| Rol | Familia | Pesos | Fallback |
|---|---|---|---|
| Display (títulos, logo, números grandes) | **Fraunces** (variable, `opsz`) | 600, 700 | `Georgia, serif` |
| Texto y UI | **Nunito** | 400, 600, 700 | `system-ui, sans-serif` |
| Mono (DevLog, fechas técnicas, exportaciones) | **JetBrains Mono** | 400 | `ui-monospace, monospace` |

| Token | Tamaño / interlineado | Uso |
|---|---|---|
| `text-xs` | 12 / 16 | Metadatos, leyendas (mínimo absoluto) |
| `text-sm` | 14 / 20 | Texto secundario, chips |
| `text-base` | 16 / 24 | Cuerpo (mínimo en inputs móviles, evita el zoom de iOS) |
| `text-lg` | 18 / 28 | Títulos de tarjeta |
| `text-xl` | 20 / 28 | Subtítulos de sección |
| `text-2xl` | 24 / 32 | Título de página en móvil |
| `text-3xl` | 30 / 36 | Título de página en escritorio |
| `text-4xl` | 36 / 40 | Números de Wrapped, hero del inicio |

Longitud de línea máxima para lectura (DevLog y cápsulas): `65ch`.

### 2.5 Espaciado, radios, sombras, capas

- **Espaciado:** base de 4 px (la escala de Tailwind por defecto). Padding de página: 16 px en móvil, 24 px en tablet y 32 px en escritorio. Separación entre tarjetas: 12 px en móvil y 16 px en escritorio.
- **Radios:** `--radius-sm 6px` (chips, inputs pequeños), `--radius-md 10px` (botones, inputs), `--radius-lg 16px` (tarjetas), `--radius-xl 24px` (hojas, modales), `--radius-full`.
- **Sombras (día):** `--shadow-1: 0 1px 2px rgb(42 34 56 / .06), 0 1px 3px rgb(42 34 56 / .08)`; `--shadow-2: 0 4px 12px rgb(42 34 56 / .10)`; `--shadow-polaroid: 0 2px 6px rgb(42 34 56 / .14)`. En noche se sustituyen las sombras por un borde `--color-border` y un `surface` más claro.
- **z-index:** `base 0`, `sticky 10`, `nav 20`, `dropdown 30`, `sheet 40`, `modal 50`, `toast 60`.

### 2.6 Movimiento

| Token | Valor | Uso |
|---|---|---|
| `--dur-fast` | 120 ms | hover, pulsación |
| `--dur-base` | 200 ms | aparición de menús, tabs |
| `--dur-slow` | 320 ms | hojas y modales |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | entradas |
| `--ease-in` | `cubic-bezier(.4,0,1,1)` | salidas |

Con `prefers-reduced-motion: reduce`, todas las duraciones pasan a 0 o 1 ms y se desactivan el giro de la ruleta, el parallax y las celebraciones.

### 2.7 Breakpoints y layout

| Nombre | Mínimo | Layout |
|---|---|---|
| base | 0 (diseñar a 360 px) | Barra inferior; 1 columna |
| `sm` | 640 | Barra inferior; 2 columnas en grids |
| `md` | 768 | **Rail lateral de 72 px** (solo iconos y tooltip); sin barra inferior |
| `lg` | 1024 | **Sidebar de 248 px** con etiquetas; plegable a rail |
| `xl` | 1280 | Contenido máximo de 1200 px; panel lateral contextual opcional de 320 px |

### 2.8 Implementación (Tailwind v4)

`frontend/src/styles/tokens.css`:

```css
@import "tailwindcss";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme {
  --font-display: "Fraunces", Georgia, serif;
  --font-sans: "Nunito", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --color-bg: #FBF7F2;
  --color-surface: #FFFFFF;
  --color-surface-2: #F3ECE4;
  --color-border: #E4D9CC;
  --color-border-strong: #8A7F99;
  --color-text: #2A2238;
  --color-text-muted: #5E5470;
  --color-primary: #6B4FA0;
  --color-on-primary: #FFFFFF;
  --color-primary-soft: #ECE5F7;
  --color-accent: #B83A52;
  --color-accent-soft: #FBE6EA;
  --color-success: #2F7D5B;
  --color-warning: #9A6200;
  --color-danger: #B3261E;
  --color-info: #2B5FA8;
  --color-focus: #6B4FA0;
  --color-person-a: #2F6F8F;
  --color-person-b: #A0527A;

  --radius-sm: 6px;  --radius-md: 10px;  --radius-lg: 16px;  --radius-xl: 24px;
}

[data-theme="dark"] {
  --color-bg: #15121F;
  --color-surface: #1F1A2E;
  --color-surface-2: #2A2440;
  --color-border: #3B3355;
  --color-border-strong: #7D7398;
  --color-text: #F2EDF7;
  --color-text-muted: #B7AECB;
  --color-primary: #B9A3F0;
  --color-on-primary: #1A1528;
  --color-primary-soft: #2F2750;
  --color-accent: #F08A9C;
  --color-accent-soft: #3A2030;
  --color-success: #7FD1A8;
  --color-warning: #F2C46D;
  --color-danger: #FF8A80;
  --color-info: #8FB8F2;
  --color-focus: #D2C4FA;
  --color-person-a: #7CC3E3;
  --color-person-b: #E7A2C6;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; scroll-behavior: auto !important; }
}
```

Script en línea en `index.html` que, antes de pintar, lee `localStorage['chimu-theme']` (`light|dark|system`) y aplica `data-theme` para evitar el parpadeo. En `localStorage` **solo** se guardan la preferencia de tema y el estado del sidebar; nunca datos de contenido.

---

## 3. Arquitectura de información y navegación

### 3.1 Mapa de rutas (React Router)

Slugs en español. Todas las rutas, salvo las de `/auth`, requieren sesión **y** membresía en el espacio (`RequireMember`).

| Ruta | Pantalla | Fase |
|---|---|---|
| `/entrar` | Login | 0 |
| `/sin-acceso` | Acceso denegado | 0 |
| `/bienvenida` | Onboarding (perfil, zona horaria, color) | 1 |
| `/` | Inicio ("Hoy en Chimuverse") | 1 |
| `/dia/quests` · `/dia/quests/:id` | Daily Quests: lista y detalle | 1 |
| `/dia/quests/verificar` | Bandeja de verificación | 1 |
| `/dia/calendario` · `?vista=mes|semana|agenda` | Our Calendar | 2 |
| `/dia/calendario/evento/:id` | Detalle o edición de evento | 2 |
| `/nosotros/universo` · `/nosotros/universo/:userId` | Perfiles y gustos | 1 |
| `/nosotros/universo/preguntas` · `/preguntas/:id` | Preguntas temáticas | 1 |
| `/nosotros/universo/comparar` | Comparador | 1 |
| `/nosotros/universo/trivia` | Trivia | 1b |
| `/nosotros/animo` | Mood Tracker | 4 |
| `/recuerdos/vault` · `/recuerdos/vault/foto/:id` | Memory Vault | 3 |
| `/recuerdos/viajes` · `/recuerdos/viajes/:id` | Viajes y álbumes | 3 |
| `/recuerdos/linea-de-tiempo` | Timeline | 3 |
| `/recuerdos/devlog` · `/recuerdos/devlog/:id` · `/recuerdos/devlog/nuevo` | DevLog of Us | 3 |
| `/recuerdos/capsulas` | Cápsulas del tiempo | 3 |
| `/recuerdos/wrapped/:year` | Our Wrapped | 4 |
| `/ocio/watchlist` | Watchlist | 4 |
| `/ocio/soundtrack` · `/ocio/deseos` | Wishlist & Soundtrack | 4 |
| `/experiencias/citas` · `/experiencias/citas/:id` | Date Planner | 4 |
| `/creciendo/metas` · `/creciendo/metas/:id` | Goals & Dreams | 4 |
| `/creciendo/finanzas` | Our Finances | 4 |
| `/notificaciones` | Centro de notificaciones | 2 |
| `/ajustes/perfil` · `/ajustes/privacidad` · `/ajustes/notificaciones` · `/ajustes/integraciones` · `/ajustes/datos` · `/ajustes/apariencia` | Ajustes | 1–3 |
| `*` | 404 amable | 0 |

Los módulos de fases futuras **no aparecen en la navegación** hasta que existan, controlados con un *feature flag* en `src/config/modules.ts` (`enabled: boolean`). No se muestran pantallas de "próximamente".

### 3.2 Navegación en escritorio (`lg+`)

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│ ✦ Chimuverse │  [⌘K Buscar…]                         🔔 2   (JL)(GS) ▾ │  ← TopBar 64px
│              ├──────────────────────────────────────────────────────────┤
│ ⌂ Inicio     │  ▌Nuestro día                                            │
│              │  Daily Quests                         [+ Nueva quest]    │  ← PageHeader
│ NUESTRO DÍA  │  ──────────────────────────────────────────────────────  │
│ ☼ Quests  3  │                                                          │
│ ▦ Calendario │   (contenido)                                            │
│ NOSOTROS     │                                                          │
│ ♡ Universo   │                                                          │
│ RECUERDOS    │                                                          │
│ ▣ Vault      │                                                          │
│ ✎ DevLog     │                                                          │
│ …            │                                                          │
│──────────────│                                                          │
│ ⚙ Ajustes    │                                                          │
│ « Plegar     │                                                          │
└──────────────┴──────────────────────────────────────────────────────────┘
```

- Sidebar con encabezados de grupo (`text-xs`, mayúsculas, `text-muted`) y contadores (badge) para pendientes **propios** (por ejemplo, verificaciones que me tocan).
- TopBar: buscador (`⌘K` / `Ctrl+K`, *command palette* para saltar a módulos y crear elementos; la búsqueda de contenido llega en fase 3), campana de notificaciones con contador, par de avatares que abre un menú (Perfil, Apariencia, Cerrar sesión).
- El ítem activo usa fondo `primary-soft`, texto `primary` y `aria-current="page"`.

### 3.3 Navegación en móvil (`< md`)

```
┌──────────────────────────────┐
│ Daily Quests        🔔  (JL) │  ← TopBar 56px: título + campana + avatar
├──────────────────────────────┤
│                              │
│         contenido            │
│                              │
├──────────────────────────────┤
│  ⌂     ☼     (+)    ▣    ≡   │  ← BottomNav 64px + safe-area
│Inicio  Día  Crear Recuerdos Más
└──────────────────────────────┘
```

- **Inicio**, **Día** (con tabs internas Quests | Calendario), **Crear** (botón central que abre una hoja de creación rápida: Quest, Evento, Foto, Entrada de DevLog, y más adelante Ánimo y Gasto), **Recuerdos** (tabs Vault | Viajes | DevLog), **Más** (hoja con el resto de módulos agrupados, Notificaciones y Ajustes).
- La barra inferior se oculta al hacer scroll hacia abajo y reaparece al subir. **No se oculta** mientras hay un input con foco ni si el usuario activó "reducir movimiento" (en ese caso queda fija).
- Las pantallas de detalle muestran una flecha "Atrás" en la TopBar y ocultan la BottomNav.

### 3.4 Tablet (`md`–`lg`)

Rail lateral de 72 px con iconos y tooltips (más etiqueta visible al enfocar), sin barra inferior. El botón "Crear" pasa a la parte superior del rail.

---

## 4. Componentes

Ubicación: `frontend/src/components/ui/` (primitivos) y `frontend/src/components/domain/` (específicos de módulo). Accesibilidad de los primitivos: **Radix UI Primitives** (Dialog, Popover, DropdownMenu, Tabs, Switch, Tooltip, RadioGroup), con estilos propios en Tailwind. Iconos: `lucide-react`. Ambos son MIT/ISC y sin costo.

### 4.1 Primitivos

| Componente | Variantes / props | Estados | Notas a11y |
|---|---|---|---|
| `Button` | `variant: primary | secondary | ghost | danger | link`; `size: sm(32) | md(40) | lg(48)`; `loading`, `iconLeft/Right`, `fullWidth` | default, hover, active, focus-visible, disabled, loading | Alto mínimo de 44 px en móvil (`md` sube a 44 bajo `md`). Con `loading`: `aria-busy`, spinner con texto oculto "Guardando…" y el ancho se mantiene |
| `IconButton` | igual que Button + `label` obligatorio | igual | `aria-label` obligatorio, tooltip con el mismo texto |
| `TextField` / `TextArea` | `label`, `hint`, `error`, `maxLength` con contador | default, focus, error, disabled, readOnly | `label` siempre visible (nunca solo placeholder); error vinculado con `aria-describedby`; `aria-invalid` |
| `Select` / `Combobox` | nativo en móvil, Radix en escritorio | igual | |
| `DateField` / `DateTimeField` | `<input type="date|datetime-local">` nativo + formato `es-PE` | igual | Muestra la zona horaria del usuario debajo ("Hora de Lima") |
| `Checkbox`, `Switch`, `RadioGroup` | | on/off/indeterminate, disabled | Switch con texto de estado al lado |
| `SegmentedControl` | 2–4 opciones | | Implementado como `radiogroup` |
| `Tabs` | `underline | pill` | | Radix Tabs; sincroniza con `?tab=` en la URL |
| `Card` | `padding: sm | md`, `interactive` | hover, focus (si es interactive) | Si es clicable, se usa un `<a>`/`<button>` real que la cubre, no `div onClick` |
| `Badge` / `StatusPill` | `tone: neutral | primary | success | warning | danger | info` + icono | | El icono y el texto siempre acompañan al color |
| `Avatar` / `AvatarPair` | `size: 24 |32 | 40 | 64`; imagen o inicial sobre color de persona | cargando, fallback | `alt` = nombre visible |
| `Dialog` | `size: sm | md | lg` | | Foco atrapado, `Esc` cierra, foco vuelve al disparador |
| `Sheet` | `side: bottom` (móvil) / `right` (escritorio) | | Se arrastra para cerrar **y** tiene botón "Cerrar" visible |
| `Toast` | `success | error | info` + acción opcional ("Deshacer") | | Región `aria-live="polite"` (errores: `assertive`); 5 s, pausa con hover/foco |
| `Skeleton` | línea, bloque, avatar, polaroid | | `aria-hidden`; el contenedor tiene `aria-busy="true"` |
| `EmptyState` | ilustración (constelación del grupo), título, texto, CTA | | |
| `ErrorState` | `kind: network | permission | notFound | unknown`, `onRetry` | | Mensaje humano + "Reintentar" + código corto para soporte (sin datos privados) |
| `OfflineBanner` | | | Aparece arriba con `navigator.onLine === false`; las mutaciones se deshabilitan |
| `ConfirmDialog` | `destructive` | | Botón de confirmar con verbo concreto ("Mover a la papelera"), nunca "Sí" |
| `VisibilityPill` | `private | shared | capsule(unlockAt)` | | Texto siempre visible: "Solo yo", "Compartido", "Cápsula · se abre el 14 feb 2027". Icono `lock` / `users` / `hourglass` |
| `VisibilityPicker` | SegmentedControl con las opciones permitidas por módulo | | Por defecto **Solo yo** (ver decisiones) |
| `PersonTag` | avatar 20 + nombre | | Indica autor o responsable |

### 4.2 Componentes de dominio

| Componente | Descripción |
|---|---|
| `QuestCard` | Título, responsable (`PersonTag` o "Compartida"), vencimiento, `DualProgress` y `StatusPill`. Acción principal según el rol: *Reportar avance* (si soy responsable) o *Verificar* (si hay un reporte del otro pendiente). |
| `DualProgress` | **Dos barras apiladas** con etiqueta: "Reportado 80 %" (relleno con rayado diagonal en el color de quien reporta) y "Verificado 60 %" (relleno sólido `success`). Si no hay verificación: "Sin verificar" en `text-muted`. Lectores de pantalla: `role="group"` con dos `role="meter"` y `aria-valuetext`. |
| `ProgressReportSheet` | Slider de 0–100 en pasos de 5 + input numérico sincronizado, nota opcional (280), adjuntar foto (fase 3). |
| `VerificationSheet` | Muestra el reporte (quién, cuándo, %, nota). Acciones: **Aprobar** (verified = reported), **Aprobar parcial** (slider ≤ reportado), **Rechazar** (motivo obligatorio, mínimo 10 caracteres). **Solo se renderiza si `verifier_id ≠ reported_by`**, y además el backend lo impone. |
| `QuestHistory` | Timeline de reportes y verificaciones con autor, hora y motivo. |
| `CalendarView` | Envoltura de FullCalendar (`dayGridMonth`, `timeGridWeek`, `listWeek`). En móvil, vista por defecto `listWeek` (agenda). Color del evento = dueño (persona A, B o compartido = `primary`). |
| `EventForm` | Título, todo el día, inicio y fin, zona horaria (solo lectura con enlace a ajustes), descripción, **"Sincronizar con Google"** por persona (switch visible solo si esa persona conectó Calendar), recordatorio. |
| `SyncStatusBadge` | `synced` ✓ / `pending` ↻ / `error` ⚠ / `conflict` ⇄ / `not_connected` ○ con texto. Al hacer clic: popover con la última sincronización y "Reintentar". |
| `ConflictCard` | Comparación lado a lado "En Chimuverse" vs "En Google (de {persona})", resaltando solo los campos que difieren. Acciones: *Mantener Chimuverse*, *Usar versión de Google*, *Editar manualmente*. |
| `BusyBlock` | Bloque gris rayado "Ocupado/a" sin título, para el free/busy compartido opcionalmente (ver decisiones). |
| `PolaroidCard` | Imagen (miniatura 480 px, `object-fit: cover`, relación 1:1) con marco blanco (8 px arriba y a los lados, 32 px abajo), leyenda manuscrita opcional en Nunito 600 y fecha del recuerdo. En la grilla, rotación aleatoria determinista de −2° a 2° según el id (0° con reduced motion o en la vista "Ordenada"). |
| `PhotoUploader` | Zona de arrastre + botón "Elegir fotos" (abre la cámara o la galería en móvil). Cola con progreso por archivo. Antes de subir: lee EXIF `DateTimeOriginal`, **elimina el EXIF (incluido el GPS)**, redimensiona y genera la miniatura (ver decisiones). Pide confirmar o editar "Fecha del recuerdo" para el lote. |
| `Lightbox` | Pantalla completa, navegación con flechas o deslizamiento, `Esc` cierra, metadatos (fecha del recuerdo, fecha de subida, viaje, quién la subió). |
| `TimelineRail` | Línea vertical con hitos por mes; agrupa fotos, entradas de DevLog, viajes y eventos especiales. |
| `JournalComposer` | Tipo de entrada (`Hicimos`, `Nos pasó`, `Aprendimos`, `Acordamos`, `Nota para ti`, `Cápsula`), editor de texto plano con markdown ligero (negrita, cursiva, listas), fecha del suceso, `VisibilityPicker`, y fecha de apertura si es Cápsula. Borrador autoguardado **solo en memoria de sesión** (`sessionStorage`); se avisa al salir con cambios. |
| `CapsuleCard` | Sobre cerrado con cuenta regresiva; no muestra contenido ni título hasta la fecha (el título se puede mostrar si el autor lo marca como "título visible"). |
| `QuestionCard` / `AnswerCompare` | Pregunta + respuestas de ambos. La respuesta del otro queda **oculta hasta que yo responda** ("Responde para ver la de Glenny"); es una regla de juego, no de seguridad. |
| `Roulette` | Rueda SVG con hasta 12 segmentos (si hay más, selección aleatoria previa). Botón "Girar"; resultado anunciado en `aria-live`. Con reduced motion muestra el resultado directo con un *fade*. |
| `NotificationItem` | Icono del módulo, texto, hora relativa y punto de no leído; marca como leída al abrirla. |
| `ModuleHeader` | Franja de color del grupo, icono, título, descripción corta (opcional) y acciones. |

---

## 5. Pantallas

Cada pantalla tiene: propósito, layout en escritorio y móvil, contenido y estados. Los estados globales (§6) aplican a todas.

### 5.1 Login (`/entrar`)

- **Propósito:** iniciar sesión con Google.
- **Layout:** centrado; logo, frase "Un universo que construimos juntos", botón "Continuar con Google" (estilo Button `secondary` con el logo de Google, siguiendo sus guías de marca), texto pequeño: "Solo para José Luis y Glenny". Fondo con constelación sutil (SVG estático).
- **Escritorio:** tarjeta de 400 px centrada. **Móvil:** pantalla completa, botón anclado a 24 px del borde inferior.
- **Estados:** cargando (botón con loading tras el clic), error de OAuth ("No pudimos conectar con Google. Intenta de nuevo."), sesión expirada (banner info).
- No se piden scopes de Calendar aquí, solo login (consentimiento incremental posterior).

### 5.2 Acceso denegado (`/sin-acceso`)

- Mensaje: "Esta cuenta no tiene acceso a Chimuverse." Muestra el correo usado **solo a la propia persona** (viene de su sesión), botón "Usar otra cuenta" (cierra sesión y vuelve a `/entrar`).
- Nunca revela quiénes son las cuentas autorizadas.

### 5.3 Onboarding (`/bienvenida`)

Tres pasos con indicador "Paso 1 de 3":
1. **Cómo te llamamos:** nombre visible y avatar (subir foto opcional o inicial).
2. **Tu zona horaria:** detectada con `Intl.DateTimeFormat().resolvedOptions().timeZone`, editable (combobox de zonas IANA). Formato de fecha `es-PE`.
3. **Tu color:** elegir el color de persona (preview con avatar).

Al terminar → `/`. Se puede omitir a partir del paso 2 (se usan los valores detectados).

### 5.4 Inicio — "Hoy en Chimuverse" (`/`)

**Escritorio (`lg`), 2 columnas (8/4):**

```
┌─ Buenos días, José Luis ✦ ──────────────────────────────┬─────────────────────┐
│ Jueves 12 de noviembre · Hora de Lima                   │  Próximamente ♡     │
│                                                         │  ─────────────────  │
│ ┌ Para verificar (2) ─────────────────────────────────┐ │  14 nov · Cena      │
│ │ Glenny reportó 80% en "Leer 20 páginas"   [Verificar]│ │  20 nov · 2 años ♡  │
│ │ Glenny reportó 100% en "Llamar al banco"  [Verificar]│ │  [Ver calendario]  │
│ └──────────────────────────────────────────────────────┘ │                     │
│ ┌ Mis quests de hoy ──────────────────────────────────┐ │  Nota para ti       │
│ │ ☐ Correr 5k        Reportado 0%   [Reportar]        │ │  "Te dejé algo en   │
│ │ ◐ Estudiar SQL     Rep. 50% · Ver. 50%              │ │   el DevLog ✎"      │
│ └──────────────────────────────────────────────────────┘ │                     │
│ ┌ Un recuerdo de hace 1 año ───────────────────────────┐ │  Pregunta del día   │
│ │ [polaroid] Arequipa, 12 nov 2025                     │ │  ¿Playa o montaña?  │
│ └──────────────────────────────────────────────────────┘ │  [Responder]        │
└─────────────────────────────────────────────────────────┴─────────────────────┘
```

**Móvil:** una columna en este orden de prioridad: Para verificar → Mis quests de hoy → Próximos eventos (3) → Pregunta del día → Nota para ti → Recuerdo.

- Cada bloque se oculta si está vacío, salvo "Mis quests de hoy", que muestra un EmptyState con CTA "Crear quest".
- "Un recuerdo de hace N" solo aparece si hay fotos **compartidas** de esa fecha.
- Las secciones de módulos futuros no aparecen hasta que estén activas.

### 5.5 Daily Quests — lista (`/dia/quests`)

- **Filtros (tabs):** `Hoy` | `Pendientes de verificar` | `Todas` | `Historial`. Chips adicionales: Responsable (Yo / {Pareja} / Compartida).
- **Escritorio:** lista de `QuestCard` en 1 columna (máx. 760 px) + panel lateral derecho (`xl`) con métricas de la semana: % verificado promedio por persona y racha.
- **Móvil:** lista; botón "+" en la BottomNav o un FAB contextual "Nueva quest".
- **Crear o editar quest (Sheet o Dialog):** título (requerido, 3–80), descripción (opcional, 500), responsable (`Yo`, `{Pareja}`, `Compartida`), recurrencia (`Una vez`, `Diaria`, `Días específicos`), fecha y hora límite opcional. Con Zod: `title.min(3).max(80)`.
- **Estados de quest (StatusPill):**

| Estado | Pill | Significado |
|---|---|---|
| `pending` | neutral "Por hacer" | Sin reportes |
| `awaiting_verification` | warning "Esperando a {pareja}" / "Te toca verificar" | Último reporte sin verificar |
| `verified` | success "Verificada {n} %" | Última verificación aprobada (total o parcial) |
| `rejected` | danger "Rechazada" + motivo | El responsable debe corregir o volver a reportar |
| `in_talk` | info "Lo hablamos" | 2 o más rechazos consecutivos del mismo ciclo (ver decisiones) |
| `archived` | neutral "Archivada" | Solo visible en Historial |

### 5.6 Daily Quests — detalle (`/dia/quests/:id`)

- Encabezado: título, responsable, recurrencia, `StatusPill`.
- `DualProgress` grande.
- Acciones según el rol (botones primarios):
  - Responsable: **Reportar avance** (abre `ProgressReportSheet`).
  - La otra persona, con un reporte pendiente: **Verificar** (abre `VerificationSheet`).
  - Ambos: Editar, Archivar (con confirmación; no borra).
- `QuestHistory` debajo.
- **Móvil:** acciones en una barra inferior fija sobre el safe area.
- Si la verificación falla en el servidor por autoaprobación (no debería pasar, porque el botón no existe): toast de error "No puedes verificar tu propio avance" y se refresca la consulta.

### 5.7 Bandeja de verificación (`/dia/quests/verificar`)

Lista solo de reportes **de la pareja** pendientes de mi verificación, del más antiguo al más reciente. Cada ítem abre el `VerificationSheet` en línea. EmptyState: "Todo al día ✦".

### 5.8 Our Calendar (`/dia/calendario`)

**Escritorio:**
```
┌ Our Calendar ─────────────── [Hoy] [‹] [›]  noviembre 2026   [Mes|Semana|Agenda]  [+ Evento] ┐
│ Filtros: ☑ Compartidos ☑ Míos ☑ De Glenny  ☐ Ocupado (free/busy)      Google: JL ✓  GS ⚠   │
│ ┌──────────────────────────── FullCalendar ─────────────────────────────────────────────┐   │
│ │                                                                                       │   │
│ └───────────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Móvil:** la vista por defecto es Agenda (lista agrupada por día); un selector de mes compacto arriba (tira de 7 días deslizable) y un botón "Mes" que abre la vista mensual en pantalla completa.
- **Indicadores de conexión:** chips por persona `SyncStatusBadge` ("Google de José Luis: sincronizado hace 3 min"). Si yo no he conectado: CTA "Conectar mi Google Calendar" → `/ajustes/integraciones`.
- **Fechas especiales** (aniversarios, cumpleaños): evento de tipo `special` con icono de corazón y color `accent`, recurrencia anual.
- **Detalle de evento** (Sheet a la derecha en escritorio, pantalla completa en móvil): título, fecha y hora en **mi** zona horaria (si la del evento difiere: "19:00 en Lima · 20:00 en tu zona"), descripción, creador, estado de sincronización por persona, historial de cambios (versión), acciones Editar y Eliminar (confirmación: "¿Eliminar también de los Google Calendar sincronizados?" con detalle por persona).
- **Conflictos:** banner `warning` arriba del calendario "1 evento con cambios en conflicto" → lista de `ConflictCard`.
- **Accesibilidad:** FullCalendar tiene soporte de teclado limitado, así que **la vista Agenda es la alternativa accesible equivalente** y está siempre disponible; el foco va al primer evento del día actual.

### 5.9 Nuestro Universo (`/nosotros/universo`)

- **Tabs:** `Perfiles` | `Preguntas` | `Comparar` | `Trivia`.
- **Perfiles:** dos tarjetas lado a lado en escritorio y apiladas en móvil: avatar 64, nombre, "Gustos" en chips por categoría (Comida, Música, Películas, Lugares, Hobbies, Otros). Editar mis gustos: Sheet con listas de chips (añadir con Enter y quitar con ×).
- **Preguntas:** categorías como tarjetas (Infancia, Futuro, Preferencias, Hipotéticas, Personalizadas). Detalle: `QuestionCard` con mi respuesta (textarea) y la de la pareja oculta hasta responder. Pueden crear preguntas propias.
- **Comparar:** tabla de 2 columnas por categoría con marcas "Coincidimos ✦" cuando un chip o respuesta coincide (comparación exacta normalizada; sin IA).
- **Trivia (fase 1b):** el sistema toma respuestas de la pareja y genera "¿Qué respondió Glenny a…?" con 3 opciones (la real + 2 distractores de otras respuestas). Puntaje simple e historial.

### 5.10 Memory Vault (`/recuerdos/vault`)

**Escritorio:**
```
┌ Memory Vault ─────────────────────────────── [Ordenada|Polaroid]  [Subir fotos] ┐
│ Tabs: Todas · Viajes · Línea de tiempo         Filtro: año ▾  viaje ▾  persona ▾│
│ ── Noviembre 2026 ──────────────────────────────────────────────────────────── │
│ [▢] [▢] [▢] [▢] [▢]                                                             │
│ ── Octubre 2026 ────────────────────────────────────────────────────────────── │
│ [▢] [▢] [▢]                                                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- Agrupada por **mes de la fecha del recuerdo** (`captured_at`), no por fecha de subida. Grilla de 5 columnas (`xl`), 4 (`lg`), 3 (`md`) y 2 (móvil). Scroll infinito por páginas de 48 elementos.
- **Subida:** `PhotoUploader` en un Dialog (escritorio) o Sheet (móvil). Por lote: fecha del recuerdo (prellenada desde EXIF; si no hay EXIF: "Sin fecha detectada; elige una"), viaje (opcional, combobox o "Crear viaje"), leyenda, visibilidad (`Compartido` por defecto en Vault, porque es el álbum común; ver decisiones). Progreso por archivo con reintento individual.
- **Detalle (`/foto/:id`):** Lightbox con metadatos; editar fecha del recuerdo, leyenda o viaje; "Mover a la papelera".
- **Viajes (`/recuerdos/viajes`):** tarjetas con portada, título, rango de fechas y conteo. El detalle muestra encabezado (portada a todo ancho, título, fechas), grilla de fotos del viaje y entradas del DevLog en ese rango.
- **Línea de tiempo:** `TimelineRail` por año y mes, con fotos, viajes, entradas compartidas del DevLog y eventos especiales.
- Las imágenes se sirven con **URLs firmadas de corta duración** (ver decisiones); `<img loading="lazy" decoding="async">` con `width`/`height` para evitar saltos de layout.

### 5.11 DevLog of Us (`/recuerdos/devlog`)

- Estética de "bitácora": fechas en JetBrains Mono (`2026-11-12`), tipo de entrada como etiqueta tipo commit (`hicimos:`, `aprendimos:`, `acordamos:`); el contenido va en Nunito para que se lea bien.
- **Lista:** feed cronológico inverso, filtros por tipo y autor, `VisibilityPill` en cada entrada. Las entradas privadas de la pareja **no existen** para mí (no se muestran ni como "oculta").
- **"Acordamos"** se destaca con borde `primary` y se puede fijar ("Acuerdos vigentes" arriba).
- **Nueva entrada:** `JournalComposer` en página completa en móvil y en Dialog grande en escritorio.
- **Notas para ti:** tipo `Nota para ti`, siempre compartidas y dirigidas a la pareja; generan notificación interna.
- **Cápsulas (`/recuerdos/capsulas`):** `CapsuleCard` con fecha de apertura; el contenido no se entrega al cliente antes de la fecha (lo impone RLS). Al abrirse: notificación "Se abrió una cápsula de José Luis ✦".

### 5.12 Centro de notificaciones (`/notificaciones`)

En escritorio: popover desde la campana (las 10 últimas) + página completa. En móvil: página. Agrupado por "Hoy", "Esta semana" y "Antes". Acción "Marcar todo como leído". Cada tipo enlaza a su recurso. Actualización en vivo por Realtime; el contador se actualiza sin recargar.

### 5.13 Ajustes

| Sección | Contenido |
|---|---|
| Perfil | Nombre, avatar, color, zona horaria, idioma (solo `es` en MVP) |
| Apariencia | Tema (Sistema / Día / Noche), densidad de grilla de fotos, reducir movimiento (además del ajuste del sistema operativo) |
| Privacidad | Visibilidad por defecto del DevLog y del Mood (por defecto: Solo yo), compartir ánimo automáticamente (off), compartir free/busy de mi calendario (off), compartir totales de mis finanzas (off) |
| Notificaciones | Por tipo: interna (siempre on) / correo (off por defecto; disponible cuando se implemente) / resumen diario por correo (hora) |
| Integraciones | Google Calendar: estado, cuenta conectada (correo enmascarado solo para mí), calendario destino "Chimuverse", última sincronización, errores recientes (sin detalles privados), botones **Conectar**, **Sincronizar ahora** y **Desconectar** (con explicación de lo que pasa con los eventos ya copiados) |
| Datos | Exportar mis datos (JSON y ZIP de fotos), Papelera (30 días), información de almacenamiento usado del espacio |

---

## 6. Estados transversales

| Estado | Tratamiento |
|---|---|
| **Cargando inicial** | Skeleton con la forma del contenido (no spinners de página completa). Más de 10 s: texto "Está tardando más de lo normal…" + Reintentar |
| **Cargando acción** | Botón con `loading`; los controles del formulario quedan deshabilitados |
| **Actualización optimista** | Solo en acciones reversibles y no sensibles (marcar como leído, mover en la watchlist). **No** en verificación de quests ni en finanzas |
| **Vacío** | `EmptyState` con constelación del grupo, frase cálida y CTA principal |
| **Error de red** | `ErrorState network` en el bloque afectado (no en toda la página) + toast si fue una mutación; TanStack Query reintenta 2 veces las consultas, nunca las mutaciones |
| **Sin permiso (RLS 403 o 0 filas)** | `ErrorState permission`: "No tienes acceso a esto." Nunca indica si el recurso existe |
| **No encontrado** | 404 amable con enlace a Inicio |
| **Sin conexión** | `OfflineBanner`; lectura desde la caché de Query; botones de crear o editar deshabilitados con tooltip "Sin conexión" |
| **Sesión expirada** | Redirigir a `/entrar?volver=<ruta>`; tras el login, volver a la ruta |
| **Sincronización Google** | `SyncStatusBadge` + banner de conflictos o errores en Calendario e Integraciones |
| **Formulario con cambios** | Confirmación al salir ("Tienes cambios sin guardar") |
| **Éxito** | Toast breve; tras crear, navegar al recurso o cerrar la hoja y resaltarlo 1 s |

---

## 7. Accesibilidad (objetivo WCAG 2.2 AA)

- `<html lang="es">`, títulos de página únicos (`document.title = "{Pantalla} · Chimuverse"`), un `h1` por pantalla y jerarquía de encabezados coherente.
- Enlace "Saltar al contenido" como primer elemento enfocable.
- **Foco visible:** `outline: 2px solid var(--color-focus); outline-offset: 2px` en `:focus-visible` para todos los interactivos. Nunca `outline: none` sin reemplazo.
- **Objetivos táctiles:** mínimo 44×44 px en móvil (WCAG 2.5.8 pide 24; usamos 44 por comodidad).
- **Color:** contraste ≥ 4.5:1 para texto y ≥ 3:1 para componentes y bordes de inputs. El estado nunca se comunica solo con color (pill = icono + texto; progreso = etiqueta numérica).
- **Formularios:** labels visibles, errores en texto junto al campo, resumen de errores con foco al enviar si hay más de uno, `autocomplete` apropiado.
- **Movimiento:** se respeta `prefers-reduced-motion` y el ajuste propio; sin autoplay de video o audio; embeds de YouTube y Spotify bajo demanda (clic para cargar).
- **Imágenes:** `alt` = leyenda si existe; si no, "Foto del {fecha del recuerdo}{, viaje X}". Las decorativas llevan `alt=""`.
- **Dinámico:** toasts y resultados de ruleta en `aria-live`; contador de notificaciones con texto oculto "3 sin leer".
- **Teclado:** todo operable; `Esc` cierra overlays; flechas en Tabs, RadioGroup y Lightbox; atajos (`⌘K`, `N` para nueva en la lista actual) documentados en un Dialog "Atajos" (`?`), desactivables.
- **Zoom:** usable al 200 % y a 320 px de ancho sin scroll horizontal (excepto la vista semanal del calendario, que tiene la Agenda como alternativa).
- **Pruebas:** `@axe-core/playwright` en los E2E de cada pantalla, sin violaciones `serious` ni `critical`; revisión manual con NVDA (Windows) y VoiceOver (iOS) antes de cerrar cada fase.

---

## 8. Contenido y microcopias

- Español neutro con toque local (es-PE). Tuteo. Formato de fecha largo "jueves 12 de noviembre" y corto "12 nov"; hora en 24 h; moneda `PEN` con `Intl.NumberFormat('es-PE', {style:'currency', currency:'PEN'})` (configurable).
- Nombres de módulo: se conservan los nombres de marca en inglés (Daily Quests, Memory Vault, DevLog of Us, Our Wrapped) como títulos; las acciones y textos van en español.
- Ejemplos:
  - Vacío en Quests: "Nada por aquí todavía. ¿Qué quieren lograr hoy?" → [Crear quest]
  - Verificación pendiente: "Glenny reportó 80 % en «Leer 20 páginas». ¿Lo confirmas?"
  - Rechazo (placeholder del motivo): "Cuéntale qué faltó, con cariño ♡"
  - Error genérico: "Algo salió mal de nuestro lado. Intenta de nuevo en un momento."
- Los textos van en `src/i18n/es.ts` (objeto plano tipado), aunque solo haya un idioma, para que no queden cadenas sueltas.

---

## 9. Especificación implementable (para Codex)

### 9.1 Estructura de carpetas sugerida (`frontend/src`)

```
app/            router.tsx, providers.tsx (QueryClient, Auth, Theme), RequireMember.tsx
components/ui/  Button.tsx, TextField.tsx, Dialog.tsx, Sheet.tsx, Toast.tsx, …
components/domain/ quests/, calendar/, vault/, devlog/, universe/, notifications/
features/       <módulo>/{api.ts, hooks.ts, schemas.ts, pages/*.tsx}
layouts/        AppShell.tsx (Sidebar|Rail|BottomNav según breakpoint), AuthLayout.tsx
lib/            supabase.ts, dates.ts (zona horaria), images.ts (resize/EXIF), signedUrls.ts
config/         modules.ts (feature flags + metadatos de navegación)
i18n/           es.ts
styles/         tokens.css, fonts.css
```

### 9.2 Contrato de navegación (`config/modules.ts`)

```ts
export type ModuleId = 'home'|'quests'|'calendar'|'universe'|'mood'|'vault'|'trips'|'devlog'|'wrapped'
  |'watchlist'|'soundtrack'|'dates'|'goals'|'finances';
export type NavGroup = 'day'|'us'|'memories'|'fun'|'plans'|'grow';
export interface ModuleDef { id: ModuleId; group?: NavGroup; label: string; path: string;
  icon: string /* nombre lucide */; enabled: boolean; mobileTab?: 'home'|'day'|'memories'; }
```

Sidebar, Rail, la hoja "Más", la hoja "Crear" y la command palette se generan desde esta lista. Un módulo con `enabled:false` no tiene ruta registrada.

### 9.3 Reglas de UI que dependen del backend (no solo de la UI)

| Regla | UI | Debe imponerse también en |
|---|---|---|
| No autoverificar | No se muestra "Verificar" si `report.reported_by === me` | RPC `verify_task_progress` + CHECK/trigger `verifier_id <> reported_by` |
| Contenido privado | No se pide ni se muestra | RLS `visibility = 'shared' OR author_id = auth.uid()` |
| Cápsula | Cuenta regresiva | RLS `author_id = auth.uid() OR (visibility='capsule' AND unlock_at <= now())` |
| Ánimo y finanzas personales | Toggle de compartir | RLS por `owner_id` + `share_enabled`; totales compartidos solo vía RPC agregada |
| Fotos | URL firmada | Bucket privado + políticas de Storage por membresía |

### 9.4 Criterios de aceptación de diseño por pantalla (comunes)

1. Se renderiza a 360, 768, 1024 y 1440 px sin scroll horizontal.
2. Tiene estados de carga, vacío, error y sin permiso implementados y cubiertos por pruebas de componentes (Vitest + Testing Library).
3. Pasa axe sin violaciones serious ni critical en tema día y noche.
4. Todos los textos vienen de `i18n/es.ts`.
5. Navegable por teclado de extremo a extremo (prueba Playwright con `Tab` / `Enter`).
6. Cualquier contenido con visibilidad muestra `VisibilityPill`.

### 9.5 Orden de construcción sugerido de UI

1. Tokens, fuentes, `ThemeProvider`, `AppShell` responsive y primitivos (Button, TextField, Dialog, Sheet, Toast, Skeleton, EmptyState, ErrorState).
2. Login, Sin acceso, Onboarding, Inicio (con bloques de Quests).
3. Quests (lista, detalle, report, verify, bandeja) + `DualProgress`.
4. Universo.
5. Calendario local → Integraciones → estados de sincronización y conflictos.
6. Vault, Viajes, Timeline → DevLog y Cápsulas.
7. Módulos P2–P4 reutilizando Card, Roulette, VisibilityPicker y Timeline.

---

## 10. Módulos P2–P4 (diseño resumido)

| Módulo | Pantalla principal | Componentes clave | Notas |
|---|---|---|---|
| **Date Planner** | Tabs `Ideas` (grilla de tarjetas por categoría: Casa, Restaurante, Salida, Fiesta, Aire libre, Otra) · `Programadas` · `Historial` | Card, Roulette (filtrable por categoría o presupuesto), EventForm | "Programar" crea un `calendar_event` vinculado; al pasar la fecha pide "¿Cómo estuvo?" (rating 1–5 + nota, que va al historial) |
| **Goals & Dreams** | Columnas `Mías` · `Juntos` · `De {pareja}` (escritorio) o tabs (móvil); vision board en masonry de imágenes y frases | Card con progreso, lista de hitos con checkboxes, `goal_updates` como timeline | Las metas individuales tienen visibilidad propia (Solo yo / Compartida) |
| **Watchlist** | Tabs `Pendientes` · `Viendo` · `Completadas`; filtro por tipo (Serie, Película, Videojuego) | Card con portada (URL o subida), Roulette sobre Pendientes | Completar = cambio de estado + `completed_at`; aparece en Completadas, nunca se borra |
| **Mood Tracker** | Selector rápido de 5 estados (iconos + texto: Genial, Bien, Normal, Bajo, Difícil) + nota opcional; calendario de calor mensual; tendencia de 30 días | Heatmap accesible (tabla con los valores alternativa) | Privado por defecto; la pareja ve solo entradas compartidas, con texto "{pareja} compartió cómo se siente" |
| **Our Finances** | Resumen del mes (ingresos, egresos, ahorro) por ámbito `Mío` · `Compartido`; lista de movimientos; presupuestos con barra | Formulario de movimiento (monto, tipo, categoría, fijo / variable / extra, ámbito) | Personal = privado; la pareja solo ve totales si se activa el toggle |
| **Wishlist & Soundtrack** | Deseos (Deseo, Necesidad, Regalo) con prioridad; Playlists con pistas (título, artista, enlaces) | Card de enlace con "Cargar reproductor" bajo demanda | Exportar CSV y JSON desde la cabecera de cada lista |
| **Our Wrapped** | Historia vertical de "diapositivas" por año: fotos del año, quests verificadas, citas, top de la watchlist, acuerdos | Slides con números grandes (Fraunces), navegación con flechas o deslizamiento, sin autoplay | Solo usa datos compartidos; se genera al pedirlo (sin datos privados de nadie) |

---

## 11. Supuestos de este diseño

Ninguno de estos supuestos cambia la privacidad ni expone datos; todos son reversibles.

- Idioma único español (es-PE); zona horaria por defecto la detectada en el navegador (probablemente `America/Lima`), editable.
- Moneda por defecto PEN, configurable.
- Los nombres "José Luis" y "Glenny" de los mockups se toman de `profiles.display_name` y nunca se escriben en el código.
- Fuentes autoalojadas: sin peticiones a CDNs de terceros.
- Paleta y tipografía son **propuesta**; cambiarlas solo implica editar `tokens.css` y `fonts.css`.
