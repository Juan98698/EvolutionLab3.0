// @vitest-environment happy-dom
import React, { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { lazyWithRetry } from '../lazyWithRetry';
import {
  ChunkLoadError,
  CHUNK_RELOAD_KEY,
  __resetChunkRecoveryForTests,
} from '../chunkRecovery';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

const Ok: React.FC = () => <div>contenido real</div>;

const renderLazy = (Lazy: React.ComponentType, onError?: (e: Error) => void) =>
  render(
    <ErrorBoundary label="test" onError={onError} fallback={<div>fallo recuperable</div>}>
      <Suspense fallback={<div>cargando</div>}>
        <Lazy />
      </Suspense>
    </ErrorBoundary>
  );

describe('lazyWithRetry', () => {
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetChunkRecoveryForTests();
    sessionStorage.clear();
    reload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      configurable: true,
      writable: true,
    });
    // React y el ErrorBoundary loguean los errores esperados; se silencian para no ensuciar la salida.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renderiza el componente cuando el import funciona', async () => {
    const Lazy = lazyWithRetry(() => Promise.resolve({ default: Ok }));
    renderLazy(Lazy);

    expect(await screen.findByText('contenido real')).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it('import() que resuelve undefined (preloadError cancelado): recarga una vez y mantiene el splash, sin error', async () => {
    // Es exactamente lo que hace Vite 5 al cancelar vite:preloadError con preventDefault().
    const Lazy = lazyWithRetry(() => Promise.resolve(undefined as any));
    const onError = vi.fn();
    renderLazy(Lazy, onError);

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.getByText('cargando')).toBeInTheDocument();
    expect(screen.queryByText('fallo recuperable')).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('import() que rechaza: también recarga una vez y mantiene el splash', async () => {
    const Lazy = lazyWithRetry(() => Promise.reject(new Error('Failed to fetch dynamically imported module')));
    const onError = vi.fn();
    renderLazy(Lazy, onError);

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.getByText('cargando')).toBeInTheDocument();
    expect(onError).not.toHaveBeenCalled();
  });

  it('si ya se recargó hace poco: muestra un ChunkLoadError explícito (no el TypeError de React.lazy)', async () => {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    const Lazy = lazyWithRetry(() => Promise.resolve(undefined as any));
    const onError = vi.fn();
    renderLazy(Lazy, onError);

    expect(await screen.findByText('fallo recuperable')).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();

    const reported = onError.mock.calls[0][0] as Error;
    expect(reported).toBeInstanceOf(ChunkLoadError);
    expect(reported.name).toBe('ChunkLoadError');
    expect(reported.message).not.toContain("reading 'default'");
  });

  it('varios chunks fallando a la vez disparan una sola recarga y ningún error', async () => {
    const LazyA = lazyWithRetry(() => Promise.resolve(undefined as any));
    const LazyB = lazyWithRetry(() => Promise.reject(new Error('network')));
    const onError = vi.fn();

    render(
      <ErrorBoundary label="test" onError={onError} fallback={<div>fallo recuperable</div>}>
        <Suspense fallback={<div>cargando</div>}>
          <LazyA />
          <LazyB />
        </Suspense>
      </ErrorBoundary>
    );

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(onError).not.toHaveBeenCalled();
    expect(screen.getByText('cargando')).toBeInTheDocument();
  });
});
