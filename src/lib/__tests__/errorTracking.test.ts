// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initErrorTracking, captureException, setTrackingUser } from '../errorTracking';

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
