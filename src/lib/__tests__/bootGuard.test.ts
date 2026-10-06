// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * public/boot-guard.js es un script clásico (no un módulo), así que se evalúa
 * igual que lo haría el navegador: como código suelto contra `window`.
 */
const guardSource = readFileSync(resolve(__dirname, '../../../public/boot-guard.js'), 'utf8');

const OVERLAY = '#evolab-boot-guard';
const runGuard = () => new Function(guardSource)();

const setHealthyApp = () => {
  document.body.classList.add('auth-ready');
  const root = document.getElementById('root')!;
  root.innerHTML = '<div id="app-content">hola</div>';
};

describe('boot-guard.js (red de seguridad contra pantalla en blanco)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.className = '';
    document.body.innerHTML = '<div id="root"></div>';
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (window as any).__evolabBootGuard;
  });

  it('no muestra el aviso antes de que pase el tiempo de gracia', () => {
    runGuard();
    vi.advanceTimersByTime(5000);
    expect(document.querySelector(OVERLAY)).toBeNull();
  });

  it('muestra el aviso si la app nunca queda lista (React no montó)', () => {
    runGuard();
    vi.advanceTimersByTime(9000);
    expect(document.querySelector(OVERLAY)).not.toBeNull();
    expect(document.querySelector(OVERLAY)?.textContent).toContain('Reparar y recargar');
  });

  it('muestra el aviso si la app está "lista" pero #root quedó vacío', () => {
    document.body.classList.add('auth-ready');
    runGuard();
    vi.advanceTimersByTime(9000);
    expect(document.querySelector(OVERLAY)).not.toBeNull();
  });

  it('no muestra nada si la app cargó bien', () => {
    setHealthyApp();
    runGuard();
    vi.advanceTimersByTime(20000);
    expect(document.querySelector(OVERLAY)).toBeNull();
  });

  it('el aviso desaparece solo cuando la app termina de cargar (red lenta, no fallo)', () => {
    runGuard();
    vi.advanceTimersByTime(9000);
    expect(document.querySelector(OVERLAY)).not.toBeNull();

    setHealthyApp();
    vi.advanceTimersByTime(1500);
    expect(document.querySelector(OVERLAY)).toBeNull();
  });

  it('registra el último error global y lo muestra en el aviso', () => {
    runGuard();
    window.dispatchEvent(new ErrorEvent('error', { message: 'boom: módulo roto' }));
    vi.advanceTimersByTime(9000);

    expect((window as any).__evolabBootGuard.getLastError()).toBe('boom: módulo roto');
    expect(document.querySelector(OVERLAY)?.textContent).toContain('boom: módulo roto');
  });

  describe('botón "Reparar y recargar"', () => {
    it('desregistra el service worker y borra cachés SIN tocar localStorage (conserva sesión)', async () => {
      vi.useRealTimers(); // la reparación usa promesas; con timers falsos se complica sin ganar nada

      const unregister = vi.fn().mockResolvedValue(true);
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { getRegistrations: vi.fn().mockResolvedValue([{ unregister }, { unregister }]) },
        configurable: true,
        writable: true,
      });
      const deleteCache = vi.fn().mockResolvedValue(true);
      Object.defineProperty(window, 'caches', {
        value: { keys: vi.fn().mockResolvedValue(['precache-v1', 'runtime']), delete: deleteCache },
        configurable: true,
        writable: true,
      });
      const reload = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload },
        configurable: true,
        writable: true,
      });

      localStorage.setItem('sb-proyecto-auth-token', 'token-valido');
      localStorage.setItem('pwa_user_profile', '{"id":"u1"}');

      runGuard();
      await (window as any).__evolabBootGuard.repair(false);
      await vi.waitFor(() => expect(reload).toHaveBeenCalled());

      expect(unregister).toHaveBeenCalledTimes(2);
      expect(deleteCache).toHaveBeenCalledWith('precache-v1');
      expect(deleteCache).toHaveBeenCalledWith('runtime');
      expect(localStorage.getItem('sb-proyecto-auth-token')).toBe('token-valido');
      expect(localStorage.getItem('pwa_user_profile')).toBe('{"id":"u1"}');
    });

    it('la reparación "dura" sí limpia localStorage', async () => {
      vi.useRealTimers();

      const reload = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload },
        configurable: true,
        writable: true,
      });
      localStorage.setItem('sb-proyecto-auth-token', 'token-valido');

      runGuard();
      (window as any).__evolabBootGuard.repair(true);
      await vi.waitFor(() => expect(reload).toHaveBeenCalled());

      expect(localStorage.getItem('sb-proyecto-auth-token')).toBeNull();
    });
  });
});
