// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ChunkLoadError,
  CHUNK_RELOAD_KEY,
  CHUNK_RELOAD_COOLDOWN_MS,
  reloadOnceForStaleChunk,
  __resetChunkRecoveryForTests,
} from '../chunkRecovery';

describe('chunkRecovery', () => {
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('recarga la página y devuelve true la primera vez', () => {
    expect(reloadOnceForStaleChunk(1_000_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBe('1000000');
  });

  it('con una recarga en curso devuelve true sin volver a recargar (varios chunks fallando a la vez)', () => {
    expect(reloadOnceForStaleChunk(1_000_000)).toBe(true);
    expect(reloadOnceForStaleChunk(1_000_100)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('no recarga si ya se recargó dentro de la ventana de enfriamiento (evita bucles)', () => {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1000000');

    expect(reloadOnceForStaleChunk(1_000_000 + CHUNK_RELOAD_COOLDOWN_MS - 1)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('permite recargar de nuevo una vez pasada la ventana de enfriamiento', () => {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1000000');

    expect(reloadOnceForStaleChunk(1_000_000 + CHUNK_RELOAD_COOLDOWN_MS + 1)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('si sessionStorage no está disponible NO recarga a ciegas (evita bucle infinito)', () => {
    // Modo privado estricto / WebViews restringidos: cualquier acceso lanza SecurityError.
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
    });

    expect(reloadOnceForStaleChunk()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('ChunkLoadError es identificable por nombre y conserva la causa original', () => {
    const cause = new Error('boom');
    const error = new ChunkLoadError(undefined, cause);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ChunkLoadError');
    expect(error.message).toContain('No se pudo cargar');
    expect(error.cause).toBe(cause);
  });
});
