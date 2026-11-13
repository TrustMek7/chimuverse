# Frontend de Chimuverse

React 19, TypeScript, Vite, Tailwind v4, React Router, TanStack Query y Supabase. Diseño: [handoff v2](../design/handoff/HANDOFF.md).

```powershell
npm ci
npm run dev
```

Conservar `.env.local`. Su plantilla es `.env.example`. Solo contiene URL y clave publicable; no importa secretos del backend.

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Requiere las migraciones de backend aplicadas y Google Auth habilitado. No hay datos ficticios ni bypass de autenticación en producción. Las fixtures de Playwright solo existen en `e2e/`.

Vercel: raíz `frontend`, build `npm run build`, salida `dist`; fallback SPA y cabeceras en `vercel.json`.
