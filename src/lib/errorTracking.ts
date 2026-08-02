/**
 * errorTracking.ts
 *
 * Capa de abstracción para el monitoreo de errores en producción.
 * Integrated with @sentry/react.
 */

import * as Sentry from '@sentry/react';

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

function _initSentry(dsn: string): void {
  Sentry.init({
    dsn,
    environment: (import.meta as any).env?.MODE || 'development',
    tracesSampleRate: 0.2,
    ignoreErrors: [
      // Errores de scripts inyectados por navegadores in-app (Instagram, TikTok, Facebook en iOS)
      "undefined is not an object (evaluating 'window.webkit.messageHandlers')",
      "undefined is not an object (evaluating 'a.webkit.messageHandlers')",
      "webkit.messageHandlers",
      "sendDataToNative",
      "sendPageHideMessage",
      // Recargas dinámicas de chunks desactualizados de Vite
      "Failed to fetch dynamically imported module",
      "Importing a module script failed"
    ],
    beforeSend(event, hint) {
      const error = hint?.originalException;
      if (error && typeof error === 'object') {
        const message = String((error as any).message || '');
        const stack = String((error as any).stack || '');
        if (
          message.includes('webkit.messageHandlers') ||
          stack.includes('sendDataToNative') ||
          stack.includes('sendPageHideMessage')
        ) {
          return null; // Ignorar en Sentry (ruido de script inyectado de terceros)
        }
      }
      return event;
    }
  });
  console.info('[ErrorTracking] Sentry inicializado exitosamente.');
}

function _captureSentry(error: Error, context?: ErrorContext): void {
  Sentry.withScope((scope) => {
    if (context?.label) scope.setTag('boundary', context.label);
    if (context?.componentStack) scope.setExtra('componentStack', context.componentStack);
    if (context?.extra) {
      Object.entries(context.extra).forEach(([k, v]) => scope.setExtra(k, v));
    }
    Sentry.captureException(error);
  });
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Inicializa el servicio de error tracking.
 *
 * Debe llamarse UNA SOLA VEZ al arrancar la aplicación (en main.tsx), antes
 * de montar el árbol de React.
 *
 * Si VITE_SENTRY_DSN no está definida, opera silenciosamente en modo local.
 */
export function initErrorTracking(): void {
  if (_initialized) return;
  _initialized = true;

  const dsn = (import.meta as any).env?.VITE_SENTRY_DSN as string | undefined;

  if (typeof window !== 'undefined') {
    (window as any).captureException = captureException;

    // Polyfill defensivo para navegadores in-app de iOS (Instagram/Meta/TikTok).
    // Instagram inyecta scripts (sendDataToNative / sendPageHideMessage) que asumen
    // que window.webkit.messageHandlers siempre existe. Si no existe, lanza TypeError global.
    try {
      if (!(window as any).webkit) {
        (window as any).webkit = {};
      }
      if (!(window as any).webkit.messageHandlers) {
        (window as any).webkit.messageHandlers = new Proxy({}, {
          get: () => ({ postMessage: () => {} })
        });
      }
    } catch {
      // Ignorar en entornos donde window.webkit esté congelado
    }
  }

  if (dsn) {
    _initSentry(dsn);
  } else {
    if ((import.meta as any).env?.DEV) {
      console.info('[ErrorTracking] Sin VITE_SENTRY_DSN configurado — operando en modo local (console.error solamente).');
    }
  }
}

/**
 * Reporta una excepción al servicio de monitoreo configurado.
 *
 * Llamar desde `ErrorBoundary.componentDidCatch` (y de cualquier otro lugar
 * donde se quiera reportar un error fuera de los límites de React).
 */
export function captureException(error: Error, context?: ErrorContext): void {
  // Siempre loguear localmente para no perder nada en desarrollo.
  const prefix = context?.label ? `[ErrorTracking · ${context.label}]` : '[ErrorTracking]';
  console.error(prefix, error, context?.componentStack ?? '');

  const dsn = (import.meta as any).env?.VITE_SENTRY_DSN as string | undefined;
  if (dsn && _initialized) {
    _captureSentry(error, context);
  }
}

/**
 * Enriquece el contexto global del usuario en Sentry.
 */
export function setTrackingUser(user: { id: string; email?: string; rol?: string } | null): void {
  const dsn = (import.meta as any).env?.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || !_initialized) return;

  if (!user) {
    Sentry.setUser(null);
  } else {
    Sentry.setUser({ id: user.id, email: user.email, username: user.rol });
  }
}
