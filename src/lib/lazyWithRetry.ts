import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import { ChunkLoadError, reloadOnceForStaleChunk } from './chunkRecovery';

/**
 * Reemplazo de `React.lazy` que sobrevive a chunks desactualizados.
 *
 * Problema que resuelve: con `vite:preloadError` cancelado, un `import()` fallido
 * resuelve `undefined` y `React.lazy` lanza `TypeError: Cannot read properties of
 * undefined (reading 'default')`, un error críptico que además llegaba a Sentry sin
 * contexto.
 *
 * Comportamiento:
 *  - Módulo válido → se usa normalmente.
 *  - Falla (rechaza o resuelve sin `default`) → se recarga la página una sola vez.
 *    Mientras tanto la promesa queda pendiente, así que Suspense mantiene el splash
 *    en pantalla en lugar de mostrar un error que desaparecería al recargar.
 *  - Si ya se recargó hace poco (o no se puede recargar) → lanza `ChunkLoadError`,
 *    que el ErrorBoundary muestra con botón de reintentar y Sentry agrupa bajo un
 *    nombre claro.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(async () => {
    let cause: unknown;

    try {
      const mod = await factory();
      if (mod && typeof mod === 'object' && mod.default) {
        return mod;
      }
      cause = new Error('El módulo importado no expone un export default válido.');
    } catch (error) {
      cause = error;
    }

    if (reloadOnceForStaleChunk()) {
      // Promesa que nunca resuelve: Suspense sigue mostrando el fallback hasta que
      // la recarga reemplace la página.
      return new Promise<never>(() => {});
    }

    throw new ChunkLoadError(undefined, cause);
  });
}
