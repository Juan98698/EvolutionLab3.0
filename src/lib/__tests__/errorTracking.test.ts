// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initErrorTracking, captureException, setTrackingUser, sentryBeforeSend } from '../errorTracking';
import { ChunkLoadError } from '../chunkRecovery';

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn((cb) => cb({ setTag: vi.fn(), setExtra: vi.fn() })),
  setUser: vi.fn(),
}));

describe('errorTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inicializa sin lanzar error en modo local si no hay VITE_SENTRY_DSN', () => {
    expect(() => initErrorTracking()).not.toThrow();
  });

  it('registra excepciones en la consola localmente', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('Test local error');

    captureException(err, { label: 'TestBoundary' });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ErrorTracking · TestBoundary]',
      err,
      ''
    );
    consoleErrorSpy.mockRestore();
  });

  it('permite actualizar el usuario rastreado o limpiarlo con null', () => {
    expect(() => setTrackingUser({ id: 'u123', email: 'test@example.com', rol: 'trainer' })).not.toThrow();
    expect(() => setTrackingUser(null)).not.toThrow();
  });
});

describe('sentryBeforeSend', () => {
  const makeEvent = () => ({ tags: { existing: 'x' } } as any);
  const setOnline = (value: boolean) =>
    Object.defineProperty(navigator, 'onLine', { value, configurable: true });

  afterEach(() => {
    setOnline(true);
  });

  it('descarta el ruido del script inyectado por Instagram (webkit.messageHandlers)', () => {
    const err = new TypeError("undefined is not an object (evaluating 'window.webkit.messageHandlers')");
    expect(sentryBeforeSend(makeEvent(), { originalException: err })).toBeNull();
  });

  it('descarta errores cuyo stack viene de sendDataToNative / sendPageHideMessage', () => {
    const err = new Error('algo');
    err.stack = 'Error: algo\n at sendDataToNative (https://x/:1:1142)';
    expect(sentryBeforeSend(makeEvent(), { originalException: err })).toBeNull();
  });

  it('descarta errores de registerSW', () => {
    const err = new TypeError("Cannot destructure property 'registerSW' of 'undefined'");
    expect(sentryBeforeSend(makeEvent(), { originalException: err })).toBeNull();
  });

  it('agrupa ChunkLoadError bajo una huella fija y lo etiqueta, conservando las etiquetas previas', () => {
    const event = makeEvent();
    const result = sentryBeforeSend(event, { originalException: new ChunkLoadError() });

    expect(result).not.toBeNull();
    expect(result!.fingerprint).toEqual(['chunk-load-error']);
    expect(result!.tags).toEqual({ existing: 'x', chunk_load_error: 'true' });
  });

  it('descarta ChunkLoadError cuando el usuario está sin conexión (es un fallo de red, no de la app)', () => {
    setOnline(false);
    expect(sentryBeforeSend(makeEvent(), { originalException: new ChunkLoadError() })).toBeNull();
  });

  it('deja pasar un error normal sin modificarlo', () => {
    const event = makeEvent();
    const result = sentryBeforeSend(event, { originalException: new Error('fallo real de la app') });

    expect(result).toBe(event);
    expect(result!.fingerprint).toBeUndefined();
  });

  it('deja pasar eventos sin excepción original', () => {
    const event = makeEvent();
    expect(sentryBeforeSend(event, undefined)).toBe(event);
  });
});
