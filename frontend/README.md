# Frontend de Chimuverse

React + TypeScript + Vite y Tailwind CSS. Aplicación pendiente del diseño y de su implementación.

- Configuración pública en `.env.local`; plantilla en `.env.example`.
- Solo URL de Supabase y clave publicable. La sesión y RLS limitan el acceso de cada usuario.
- No importar archivos de `../backend`, cargar su entorno ni incluir sus secretos en el bundle.
- Raíz de despliegue en Vercel: `frontend`; salida prevista: `dist`.
- Instalación y comandos: [guía de arranque](../docs/getting-started.md).
