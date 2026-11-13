# Diseño de Chimuverse: guía para quien implementa

Diseño de alta fidelidad con la dirección visual **«Constelación doméstica»**. Está pensado para implementarse con React + TypeScript + Vite, Tailwind CSS v4 y Supabase.

- **Prototipo navegable:** https://claude.ai/artifact/BYMrgdMYkhFahu3KFM4rKi (pulsa ▷ Play para recorrerlo).
- **Usuario de los mockups:** José Luis. Las pantallas de Glenny son simétricas.

## Orden de lectura

1. **`handoff/HANDOFF.md`**: la especificación. Léela entera antes de escribir código. La sección 10 describe la revisión v2 (paleta viva, barra lateral nocturna y animaciones), que sustituye a lo que contradiga en las secciones anteriores.
2. **`handoff/tokens.css`**: tokens de Tailwind v4 (`@theme` + `[data-theme="dark"]`). Cópialo a `frontend/src/styles/` e impórtalo después de `@import "tailwindcss";`.
3. **`prototipo/project/chimu.css`**: la referencia exacta de cada componente, estado, icono y animación. Al final está el bloque «v2», con la barra lateral nocturna, la barra inferior flotante, los hovers y los `@keyframes cv-*`. Llévalo a componentes y utilidades; no lo copies como hoja global sin revisarlo.
4. **`prototipo/project/*.dc.html`**: cada pantalla, con su maquetación, textos, datos de ejemplo (`SEED`, `EV`…) y lógica de interacción en la clase `Component`. Úsalas como referencia: **no se abren sueltas en el navegador**, porque dependen del runtime del lienzo (`support.js`), que no está en el repo.

## Mapa de pantallas → rutas

| Archivo | Ruta (ver `docs/design.md` §3.1) |
|---|---|
| `Acceso.dc.html`, `AccesoMovil.dc.html` | `/entrar`, `/sin-acceso` |
| `InicioDesktop.dc.html`, `InicioMovil.dc.html`, `InicioOscuro.dc.html` | `/` |
| `QuestsDesktop.dc.html`, `QuestsMovil.dc.html` | `/dia/quests`, `/dia/quests/:id` |
| `Calendario.dc.html`, `CalendarioMovil.dc.html` | `/dia/calendario` |
| `Universo.dc.html` | `/nosotros/universo` (pestañas Perfiles · Preguntas · Comparar · Trivia) |
| `Animo.dc.html` | `/nosotros/animo` |
| `Vault.dc.html` | `/recuerdos/vault`, `/recuerdos/viajes`, `/recuerdos/linea-de-tiempo` |
| `DevLog.dc.html` | `/recuerdos/devlog`, `/recuerdos/capsulas` |
| `Wrapped.dc.html` | `/recuerdos/wrapped/:year` |
| `Citas.dc.html` | `/experiencias/citas` |
| `Watchlist.dc.html`, `Deseos.dc.html` | `/ocio/watchlist`, `/ocio/soundtrack` y `/ocio/deseos` |
| `Metas.dc.html`, `Finanzas.dc.html` | `/creciendo/metas`, `/creciendo/finanzas` |
| `Ajustes.dc.html` | `/ajustes/*` |
| `Mas.dc.html` | hoja «Más» y notificaciones en móvil |
| `Sidebar.dc.html` | componente `AppShell` / `Sidebar` |
| `Sistema.dc.html`, `Handoff.dc.html`, `Main.dc.html` | documentación visual (no son rutas) |

## Orden sugerido de construcción

1. Tokens, fuentes autoalojadas (`@fontsource/fraunces`, `figtree`, `caveat`) y `ThemeProvider` (`data-theme`).
2. `AppShell`: barra lateral nocturna (lg+), rail (md) y barra inferior flotante (< md).
3. Primitivos: `Button`, `IconButton`, `TextField`, `SegmentedControl`, `Choice`, `StatusPill`, `VisibilityPill`/`VisibilityPicker`, `DualProgress`, `SyncStatus`, `Dialog`/`Sheet`, `Toast`, `Banner`, `EmptyState`, `Skeleton`, `Avatar`, `Polaroid`, `SkyPanel`.
4. Acceso → Inicio → Daily Quests (flujo completo de reporte y verificación).
5. El resto de módulos, en el orden de `docs/design.md` §9.5.

## Reglas que no se negocian

- Nadie puede verificar su propio reporte: la interfaz oculta el botón **y** el backend lo impide.
- «Reportado» y «Verificado» se muestran siempre por separado.
- Todo lo que puede ser personal empieza en **Solo yo** y muestra su visibilidad con icono y texto.
- Iniciar sesión con Google **no** conecta Google Calendar.
- El estado nunca se comunica solo con color, y todas las animaciones respetan `prefers-reduced-motion`.
- Nada de lo simulado en el prototipo (sincronización con Google, subidas, correo) se presenta como funcional hasta que exista.
