# Backend de Chimuverse

Supabase es el backend administrado. No se añade un servidor NestJS o Django.

- `supabase/migrations/`: esquema, restricciones y políticas RLS.
- `supabase/functions/`: operaciones privilegiadas, integraciones Google y notificaciones.
- `.env`: configuración local exclusiva del servidor; plantilla sin credenciales en `.env.example`.

Ejecutar el CLI de Supabase desde esta carpeta. Configurar cada secreto de producción en el entorno de las Edge Functions cuando se implementen; el archivo `.env` local no se sube como parte del frontend.

Toda operación privilegiada debe validar identidad y permisos. Nunca devolver claves de servidor en respuestas ni registrarlas en logs. El frontend puede usar directamente Supabase Auth y las tablas protegidas por RLS con su clave publicable.

Todavía no hay migraciones ni funciones implementadas. Ver [configuración de Supabase](../docs/supabase-setup.md) y [arquitectura](../docs/architecture.md).
