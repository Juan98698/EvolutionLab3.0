# Evolution Lab 3.0

PWA de entrenamiento y nutrición para atletas y entrenadores: planes periodizados,
registro de sesiones offline-first, progresión automática, antropometría,
planes nutricionales con PDF y suscripciones con MercadoPago.

**Stack:** React 18 + TypeScript + Vite, Supabase (Auth + Postgres + RLS),
funciones serverless de Vercel (`api/`), Sentry, Vitest y Playwright.

## Puesta en marcha

```bash
npm ci
cp .env.example .env.local   # o crea .env.local con las variables de abajo
npm run dev
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo de Vite |
| `npm run build` | `tsc` + build de producción en `dist/` |
| `npm run lint` | ESLint con 0 warnings permitidos |
| `npx vitest run` | Tests unitarios (lo mismo que corre el CI) |
| `npm run test:e2e` | Tests E2E y de regresión visual con Playwright |
| `npm run build:analyze` | Build + reporte de tamaño de bundles en `dist/stats.html` |

## Variables de entorno

**Frontend** (prefijo `VITE_`, quedan públicas en el bundle):

| Variable | Uso |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima de Supabase |
| `VITE_VAPID_PUBLIC_KEY` | Clave pública para notificaciones push |
| `VITE_SENTRY_DSN` | Opcional: reporte de errores en Sentry (sin ella solo se registra en consola) |

**Servidor** (`api/`, configurarlas en Vercel; nunca en el frontend):

| Variable | Uso |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Webhook de pagos y push (salta RLS) |
| `MERCADOPAGO_ACCESS_TOKEN` | Crear preferencias y consultar pagos |
| `MERCADOPAGO_WEBHOOK_SECRET` | Validar la firma `x-signature` del webhook (obligatoria) |
| `MERCADOPAGO_WEBHOOK_URL` | Opcional: URL del webhook si no es `https://<host>/api/mercadopago-webhook` |
| `MERCADOPAGO_SANDBOX` / `MERCADOPAGO_TEST_BUYER_EMAIL` | Opcional: modo pruebas |
| `APP_PRODUCTION_ORIGIN` | Dominio de producción (p. ej. `https://evolutionlab.fit`). Es a donde MercadoPago devuelve al usuario |
| `EXTRA_ALLOWED_ORIGINS` | Opcional: otros dominios permitidos, separados por coma |
| `VAPID_PRIVATE_KEY` | Clave privada para enviar notificaciones push |

## Estructura

```
api/                 Funciones serverless (pagos, push, búsqueda de alimentos)
  _lib/              Utilidades compartidas (auth, planes y precios)
public/              Estáticos, service worker de push y boot-guard.js
src/components/      UI por área: auth, dashboard, trainer, nutrition, admin…
src/lib/             Lógica de dominio: sesiones offline, periodización, nutrición…
src/context/         Contextos de React (sesión de Supabase, diálogos)
supabase/migrations/ Migraciones de base de datos (fechadas)
e2e/                 Tests de Playwright y capturas de referencia
```

## Base de datos

Las migraciones nuevas van en `supabase/migrations/` con prefijo de fecha
(`YYYYMMDD_descripcion.sql`). Los `supabase_*.sql` de la raíz son el historial
anterior (setup inicial y migraciones v2–v15) y se conservan como referencia.

## CI

`.github/workflows/ci.yml` corre en cada push y PR a `main`: `tsc`, lint,
tests unitarios, build y, después, Playwright dentro de la imagen oficial
(las capturas de referencia deben generarse con esa misma imagen; ver
`update-snapshots.yml`).
