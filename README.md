# Evolution Lab 3.0

Plataforma de planificación y seguimiento de entrenamiento para entrenadores y atletas independientes. React, TypeScript, Vite y Supabase.

Requiere Node 22.12 o superior. Instalar con `npm ci`, configurar las variables de `.env.example` en `.env.local` y ejecutar `npm run dev`.

Consultar [arquitectura, migraciones y comprobaciones](docs/implementation-foundation.md) antes de desplegar. El frontend actualizado requiere las migraciones nuevas; estas no se aplican automáticamente sobre la base remota.

El [cierre de hallazgos](docs/finding-closure.md) recoge las correcciones, las verificaciones remotas y las comprobaciones que deben realizarse al publicar. La dirección visual y las capturas están en [diseño Estudio](docs/studio-design.md).

Comprobaciones: `npm run typecheck`, `npm run lint`, `npm run test:run` y `npm run build`. Los flujos del navegador se ejecutan con `npm run test:e2e` y usan un servidor exclusivo con datos simulados.

Los informes de auditoría de junio de 2026 son históricos y no representan la cobertura ni las funciones actuales.
