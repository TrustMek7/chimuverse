# Arranque técnico paso a paso

## Requisitos
Node.js LTS, npm, Git, cuenta GitHub, cuenta Supabase, Google Cloud (cuando implementen OAuth). Supabase CLI opcionalmente vía `npx supabase`.

## 1. Inicializar frontend (carpeta vacía)
Desde la raíz del repositorio:
```bash
npm create vite@latest apps/web -- --template react-ts
cd apps/web
npm install
npm install @supabase/supabase-js react-router-dom @tanstack/react-query react-hook-form zod @hookform/resolvers
npm install tailwindcss @tailwindcss/vite
npm install -D vitest @testing-library/react @testing-library/jest-dom @playwright/test
```
Seguir la guía vigente de Tailwind para Vite (plugin `@tailwindcss/vite`) y crear la configuración mínima. No elegir paleta ni sistema visual todavía.

## 2. Variables
Crear `apps/web/.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` del proyecto. Ver plantilla raíz `.env.example`. **Nunca usar service_role ni Google client secret en frontend.**

## 3. Supabase
```bash
# Desde la raíz (si todavía no hay configuración local)
npx supabase init
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```
La carpeta `supabase/` ya existe; `init` puede pedir confirmación o detectar configuración previa. Versionar migraciones con `npx supabase migration new <nombre>` y probarlas en entorno local antes de aplicarlas. No crear tablas manualmente solo en producción.

## 4. Google OAuth
Configurar proveedor Google en Supabase Auth, redirect URIs, y restringir el acceso a los dos miembros mediante controles del servidor y RLS. Calendar requiere permisos adicionales y un flujo OAuth seguro separado o ampliado.

## 5. Despliegue
- Vercel: root directory `apps/web`, build `npm run build`, output `dist`, variables `VITE_` públicas.
- Supabase: migraciones y Edge Functions desplegadas con CLI; secretos de funciones configurados en Supabase.
- Configurar fallback SPA para rutas React si se usa React Router.

## 6. GitHub
```bash
git init
git add .
git commit -m "chore: bootstrap Chimuverse documentation"
git branch -M main
git remote add origin https://github.com/USUARIO/chimuverse.git
git push -u origin main
```
Crear el repositorio vacío en GitHub primero. Evitar subir credenciales reales. Verificar `git status` antes de hacer push.

## 7. Primer issue sugerido
`feat(auth): iniciar sesión con Google y restringir acceso a dos cuentas`, con tests de acceso no autorizado.
