// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerPwaServiceWorker } from '../pwaRegistration';

describe('registerPwaServiceWorker', () => {
  const originalSW = navigator.serviceWorker;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistrations: vi.fn().mockResolvedValue([]),
        ready: Promise.resolve(),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalSW,
      configurable: true,
      writable: true,
    });
  });

  it('no invoca el loader ni arroja error si serviceWorker no está soportado en navigator', async () => {
    // Simular navegador o webview sin soporte de Service Worker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const loaderMock = vi.fn();
    await registerPwaServiceWorker(loaderMock);

    expect(loaderMock).not.toHaveBeenCalled();
  });

  it('no arroja TypeError si el loader retorna undefined (caso Vite preloadError preventDefault)', async () => {
    const loaderMock = vi.fn().mockResolvedValue(undefined);

    // No debe lanzar 'Cannot destructure property registerSW of undefined'
    await expect(registerPwaServiceWorker(loaderMock)).resolves.toBeUndefined();
    expect(loaderMock).toHaveBeenCalledTimes(1);
  });

  it('no arroja error si el módulo no contiene la función registerSW', async () => {
    const loaderMock = vi.fn().mockResolvedValue({ someOtherExport: true });

    await expect(registerPwaServiceWorker(loaderMock)).resolves.toBeUndefined();
    expect(loaderMock).toHaveBeenCalledTimes(1);
  });

  it('captura limpiamente fallos de red o rechazos de promesa sin generar unhandled rejection', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loaderMock = vi.fn().mockRejectedValue(new Error('Failed to fetch dynamically imported module'));

    await expect(registerPwaServiceWorker(loaderMock)).resolves.toBeUndefined();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No se pudo inicializar el Service Worker PWA'),
      expect.any(Error)
    );
    consoleWarnSpy.mockRestore();
  });

  it('registra el Service Worker de forma inmediata y programa comprobaciones periódicas cuando el módulo es válido', async () => {
    const mockUpdateSW = vi.fn().mockReturnValue(Promise.resolve());
    const mockRegisterSW = vi.fn().mockReturnValue(mockUpdateSW);
    const loaderMock = vi.fn().mockResolvedValue({ registerSW: mockRegisterSW });

    await registerPwaServiceWorker(loaderMock);

    expect(mockRegisterSW).toHaveBeenCalledWith({ immediate: true });

    // Avanzar temporizador 30 minutos
    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(mockUpdateSW).toHaveBeenCalledWith(false);

    // Simular visibilidad activa
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(mockUpdateSW).toHaveBeenCalledWith(false);
  });
});
