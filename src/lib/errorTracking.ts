/**
 * errorTracking.ts
 *
 * Capa de abstracción para el monitoreo de errores en producción.
 *
 * Por qué existe este módulo:
 *   ErrorBoundary.tsx ya tiene un hook `componentDidCatch` con el comentario
 *   "punto único para enganchar un servicio de error tracking en el futuro".
 *   Este módulo ES ese punto único: centraliza toda la lógica de inicialización
 *   y reporte para que ErrorBoundary (y cualquier otro lugar) nunca necesite
 *   importar el SDK de Sentry directamente.
 *
 * Cómo activar Sentry:
 *   1. `npm install @sentry/react` (o `@sentry/browser`)
 *   2. Agregar VITE_SENTRY_DSN=<tu-dsn> a .env.local (o a las env vars de Vercel)
 *   3. Descomentar el bloque `SENTRY_INTEGRATION` de abajo — todo lo demás
 *      ya está conectado.
 *
 * En desarrollo, o si VITE_SENTRY_DSN no está configurado, todas las
 * funciones son no-ops silenciosas (excepto `captureException`, que también
 * escribe en console.error para no perder información durante el desarrollo).
 */

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface ErrorContext {
  /** Etiqueta del ErrorBoundary que atrapó el error (ej. "ActiveSession"). */
  label?: string;
  /** Stack del árbol de componentes React en el momento del error. */
  componentStack?: string | null;
  /** Metadatos adicionales a adjuntar al evento. */
  extra?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Estado interno del módulo
// ---------------------------------------------------------------------------

let _initialized = false;

// ---------------------------------------------------------------------------
// SENTRY_INTEGRATION
// Para activar Sentry, descomenta este bloque e instala @sentry/react.
// ---------------------------------------------------------------------------
//
// import * as Sentry from '@sentry/react';
//
// function _initSentry(): void {
//   const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
//   if (!dsn) return;
//
//   Sentry.init({
//     dsn,
//     environment: import.meta.env.MODE,
//     // Muestra las URLs de source maps solo en producción.
//     // release: import.meta.env.VITE_APP_VERSION,
//     // Solo enviar el 10% de las sesiones de replay en producción.
//     // replaysSessionSampleRate: 0.1,
//     // replaysOnErrorSampleRate: 1.0,
//     integrations: [
//       Sentry.browserTracingIntegration(),
//     ],
//     tracesSampleRate: 0.2,
//   });
// }
//
// function _captureSentry(error: Error, context?: ErrorContext): void {
//   Sentry.withScope((scope) => {
//     if (context?.label) scope.setTag('boundary', context.label);
//     if (context?.componentStack) scope.setExtra('componentStack', context.componentStack);
//     if (context?.extra) {
//       Object.entries(context.extra).forEach(([k, v]) => scope.setExtra(k, v));
//     }
//     Sentry.captureException(error);
//   });
// }
//
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Inicializa el servicio de error tracking.
 *
 * Debe llamarse UNA SOLA VEZ al arrancar la aplicación (en main.tsx), antes
 * de montar el árbol de React.
 *
 * Si VITE_SENTRY_DSN no está definida, esta función es un no-op.
 */
export function initErrorTracking(): void {
  if (_initialized) return;
  _initialized = true;

  const dsn = (import.meta as any).env?.VITE_SENTRY_DSN as string | undefined;

  if (dsn) {
    // ── Descomentar cuando se instale @sentry/react ──
    // _initSentry();
    console.info('[ErrorTracking] Sentry DSN detectado. Descomenta el bloque SENTRY_INTEGRATION en errorTracking.ts y ejecuta `npm install @sentry/react` para activar el monitoreo.');
  } else {
    // En desarrollo o sin DSN configurado: modo silencioso.
    // Todos los errores siguen siendo capturados por ErrorBoundary y
    // escritos en console.error; simplemente no se envían a un servicio remoto.
    if ((import.meta as any).env?.DEV) {
      console.info('[ErrorTracking] Sin VITE_SENTRY_DSN configurado — operando en modo local (console.error solamente).');
    }
  }
}

/**
 * Reporta una excepción al servicio de monitoreo configurado.
 *
 * Llamar desde `ErrorBoundary.componentDidCatch` (y de cualquier otro lugar
 * donde se quiera reportar un error fuera de los límites de React, como
 * un `catch` en un fetch crítico).
 *
 * En desarrollo o sin DSN, sigue escribiendo en `console.error` para no
 * perder información; en producción con Sentry activo, envía el evento al
 * dashboard.
 */
export function captureException(error: Error, context?: ErrorContext): void {
  // Siempre loguear localmente para no perder nada en desarrollo.
  const prefix = context?.label ? `[ErrorTracking · ${context.label}]` : '[ErrorTracking]';
  console.error(prefix, error, context?.componentStack ?? '');

  // ── Con Sentry activo: reemplazar el console.error de arriba por _captureSentry ──
  // const dsn = (import.meta as any).env?.VITE_SENTRY_DSN as string | undefined;
  // if (dsn && _initialized) {
  //   _captureSentry(error, context);
  // }
}

/**
 * Enriquece el contexto global del usuario en el servicio de monitoreo.
 *
 * Llamar después de que el usuario haga login con su perfil real, para que
 * los reportes en Sentry muestren quién experimentó el error.
 *
 * Es un no-op si Sentry no está configurado.
 */
export function setTrackingUser(user: { id: string; email?: string; rol?: string } | null): void {
  if (!user) {
    // ── Con Sentry: Sentry.setUser(null); ──
    return;
  }
  // ── Con Sentry: Sentry.setUser({ id: user.id, email: user.email, rol: user.rol }); ──
  // No-op hasta que se instale el SDK.
  void user; // evitar warning de TS de variable no usada
}
