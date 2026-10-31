// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import {
  usePaymentReturn,
  isPaymentReflected,
  PAYMENT_POLL_INTERVAL_MS,
  PAYMENT_POLL_TIMEOUT_MS,
} from '../usePaymentReturn';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-31T02:00:00Z').getTime();

let mockProfile: any = null;
const mockRefreshProfile = vi.fn();

vi.mock('../../context/SupabaseContext', () => ({
  useSupabase: () => ({ profile: mockProfile, refreshProfile: mockRefreshProfile }),
}));

const MESSAGES = { success: 'Plan activado', cancel: 'Pago cancelado' };
const showToast = vi.fn();

const Probe: React.FC = () => {
  usePaymentReturn(showToast, MESSAGES);
  const location = useLocation();
  return <div data-testid="search">{location.search}</div>;
};

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Probe />
    </MemoryRouter>
  );
}

/** Perfil tal como lo deja el webhook: vencimiento = aprobación + 30 días. */
function paidProfile(plan: string, approvedAt: number) {
  return {
    suscripcion_plan: plan,
    suscripcion_estado: 'activo',
    suscripcion_expira_at: new Date(approvedAt + 30 * DAY).toISOString(),
  };
}

describe('isPaymentReflected', () => {
  it('true cuando el webhook acaba de activar el plan pagado', () => {
    expect(isPaymentReflected(paidProfile('premium', NOW - 60_000) as any, 'premium', NOW)).toBe(true);
  });

  it('false en una renovación mientras el perfil conserva el vencimiento anterior', () => {
    expect(isPaymentReflected(paidProfile('premium', NOW - 25 * DAY) as any, 'premium', NOW)).toBe(false);
  });

  it('false si el plan activo es otro', () => {
    expect(isPaymentReflected(paidProfile('iniciacion', NOW) as any, 'premium', NOW)).toBe(false);
  });

  it('false si la suscripción no está activa o no hay perfil', () => {
    expect(isPaymentReflected({ ...paidProfile('premium', NOW), suscripcion_estado: 'expirado' } as any, 'premium', NOW)).toBe(false);
    expect(isPaymentReflected({ suscripcion_plan: 'free', suscripcion_expira_at: null } as any, 'premium', NOW)).toBe(false);
    expect(isPaymentReflected(null, 'premium', NOW)).toBe(false);
  });
});

describe('usePaymentReturn', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockProfile = { suscripcion_plan: 'free', suscripcion_estado: 'activo', suscripcion_expira_at: null };
    mockRefreshProfile.mockReset();
    showToast.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('no anuncia "activado" hasta que el perfil refleja el pago', async () => {
    const view = renderAt('/dashboard?payment_success=true&plan=premium');

    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Confirmando'), 'info');
    expect(showToast).not.toHaveBeenCalledWith(MESSAGES.success, 'success');
    expect(mockRefreshProfile).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('search').textContent).toBe('');

    // Sigue gratuito: se vuelve a leer el perfil cada pocos segundos
    await act(async () => { vi.advanceTimersByTime(PAYMENT_POLL_INTERVAL_MS * 2); });
    expect(mockRefreshProfile).toHaveBeenCalledTimes(3);
    expect(showToast).not.toHaveBeenCalledWith(MESSAGES.success, 'success');

    // Llega el webhook: el perfil ya tiene el plan pagado
    mockProfile = paidProfile('premium', NOW);
    view.rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Probe />
      </MemoryRouter>
    );
    expect(showToast).toHaveBeenCalledWith(MESSAGES.success, 'success');

    // Y deja de sondear
    const calls = mockRefreshProfile.mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(PAYMENT_POLL_INTERVAL_MS * 3); });
    expect(mockRefreshProfile.mock.calls.length).toBe(calls);
  });

  it('avisa si la activación tarda demasiado y deja de sondear', async () => {
    renderAt('/dashboard?payment_success=true&plan=premium');

    await act(async () => { vi.advanceTimersByTime(PAYMENT_POLL_TIMEOUT_MS + PAYMENT_POLL_INTERVAL_MS); });

    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('tardando'), 'info');
    expect(showToast).not.toHaveBeenCalledWith(MESSAGES.success, 'success');

    const calls = mockRefreshProfile.mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(PAYMENT_POLL_INTERVAL_MS * 3); });
    expect(mockRefreshProfile.mock.calls.length).toBe(calls);
  });

  it('en una renovación espera el vencimiento nuevo, no el plan que ya tenía', async () => {
    mockProfile = paidProfile('premium', NOW - 25 * DAY);
    renderAt('/dashboard?payment_success=true&plan=premium');

    expect(showToast).not.toHaveBeenCalledWith(MESSAGES.success, 'success');
    await act(async () => { vi.advanceTimersByTime(PAYMENT_POLL_INTERVAL_MS); });
    expect(mockRefreshProfile).toHaveBeenCalledTimes(2);
  });

  it('pago pendiente: informa sin anunciar activación ni sondear', async () => {
    renderAt('/dashboard?payment_success=pending&plan=premium');

    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('pendiente'), 'info');
    await act(async () => { vi.advanceTimersByTime(PAYMENT_POLL_INTERVAL_MS * 3); });
    expect(mockRefreshProfile).not.toHaveBeenCalled();
    expect(screen.getByTestId('search').textContent).toBe('');
  });

  it('pago cancelado: muestra el mensaje y limpia la URL', () => {
    renderAt('/dashboard?payment_cancel=true');

    expect(showToast).toHaveBeenCalledWith(MESSAGES.cancel, 'info');
    expect(mockRefreshProfile).not.toHaveBeenCalled();
    expect(screen.getByTestId('search').textContent).toBe('');
  });

  it('sin parámetros de pago no hace nada', () => {
    renderAt('/dashboard');
    expect(showToast).not.toHaveBeenCalled();
    expect(mockRefreshProfile).not.toHaveBeenCalled();
  });
});
