# Backend de Chimuverse

Supabase PostgreSQL + RLS, Auth Google, Storage privado y Edge Function `calendar` con OAuth, sincronización bidireccional y recordatorios programables.

```powershell
npm ci
npm test
npm run typecheck
npm run test:calendar
```

Los tests SQL ejecutan migraciones reales con roles y RLS en PostgreSQL embebido (PGlite). No requieren Docker ni tocan el proyecto remoto. Los tests de Calendar sustituyen el transporte externo.

Completar `.env` desde `.env.example` y seguir [la guía de arranque](../docs/getting-started.md):

```powershell
npm run deploy
npm run deploy:all
```

El script requiere un Personal Access Token `SUPABASE_ACCESS_TOKEN`. La clave `SUPABASE_SECRET_KEY` permite usar la API, pero no aplicar migraciones. Cada migración se aplica y registra dentro de una transacción, sin recrear tablas ni borrar datos. Los secretos de funciones se configuran mediante Management API, sin incluirlos en React ni en argumentos de shell. No cambiar la clave de cifrado de tokens con conexiones activas.
