// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';

// ─── Mock: react-router-dom ────────────────────────────────────────────────
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ search: '', pathname: '/dashboard' }),
  useNavigate: () => vi.fn(),
}));

// ─── Mock: canvas-confetti ─────────────────────────────────────────────────
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

// ─── Mock: push notifications ─────────────────────────────────────────────
vi.mock('../../../lib/pushNotifications', () => ({
  subscribirNotificacionesPush: vi.fn().mockResolvedValue(false),
  verificarSuscripcionPushActiva: vi.fn().mockResolvedValue(false),
}));

// ─── Mock: dynamic fonts ──────────────────────────────────────────────────
vi.mock('../../../lib/dynamicFonts', () => ({
  loadBrandFonts: vi.fn(),
}));

// ─── Mock: sessions lib ────────────────────────────────────────────────────
vi.mock('../../../lib/sessions', () => ({
  loadAthleteSessions: vi.fn().mockResolvedValue([]),
  readSessionsFromCache: vi.fn().mockReturnValue([]),
  flattenSessionsForOverload: vi.fn().mockReturnValue([]),
  resolveOverloadRules: vi.fn().mockReturnValue([]),
  resolveOverloadConfig: vi.fn().mockReturnValue({}),
  SESSIONS_UPDATED_EVENT: 'sessions-updated',
  SESSIONS_SYNC_FAILED_EVENT: 'sessions-sync-failed',
}));

// ─── Supabase mock factory ─────────────────────────────────────────────────
function makeSupa() {
  const ch = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
  const chain = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    then: vi.fn().mockResolvedValue({}),
  });
  return {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'a@b.com' } } } }) },
    from: vi.fn(() => chain()),
    channel: vi.fn().mockReturnValue(ch),
    removeChannel: vi.fn(),
  };
}

// ─── SupabaseContext mock ──────────────────────────────────────────────────
const BASE_PROFILE = { id: 'u1', nombre: 'Atleta Test', rol: 'cliente', vigencia_dias: 9999, fecha_inicio: null, entrenador_id: null };

let mockCtx = {
  user: { id: 'u1', email: 'a@b.com' } as any,
  profile: { ...BASE_PROFILE } as any,
  isSoloClient: false,
  refreshProfile: vi.fn(),
};

vi.mock('../../../context/SupabaseContext', () => ({
  useSupabase: () => mockCtx,
}));

let mockSupa = makeSupa();
vi.mock('../../../lib/supabaseClient', () => ({ get supabase() { return mockSupa; } }));

// ─── Imports after mocks ───────────────────────────────────────────────────
import { AthleteDashboard } from '../AthleteDashboard';
import { ConfirmDialogProvider } from '../../../context/ConfirmDialogContext';

// Wrapper obligatorio porque AthleteNavbar usa useConfirm()
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
);

// ─── Plan fixture ─────────────────────────────────────────────────────────
const PLAN = {
  portada: { planName: 'Plan Test', userName: 'Atleta Test', startDate: '2099-01-01', whatsappLink: '', instagramLink: '' },
  trainingDays: [{
    id: 'd1', name: 'Día A',
    exercises: [
      { id: 'e1', nombre: 'Sentadilla', variables: {}, video_url: '', image_url: '', gif_url: '' },
      { id: 'e2', nombre: 'Press banca', variables: {}, video_url: '', image_url: '', gif_url: '' },
      { id: 'e3', nombre: 'Peso muerto', variables: {}, video_url: '', image_url: '', gif_url: '' },
    ],
  }],
  globalVariables: [],
};

beforeEach(() => {
  localStorage.clear();
  mockCtx = { user: { id: 'u1', email: 'a@b.com' } as any, profile: { ...BASE_PROFILE } as any, isSoloClient: false, refreshProfile: vi.fn() };
  mockSupa = makeSupa();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ─── Tests ────────────────────────────────────────────────────────────────
describe('AthleteDashboard — smoke tests', () => {

  it('renderiza sin crashear con plan en caché local', async () => {
    localStorage.setItem('pwa_client_plan', JSON.stringify(PLAN));
    await act(async () => { render(<AthleteDashboard />, { wrapper: Wrapper }); });
    expect(document.body).toBeTruthy();
    expect(screen.queryByText(/error inesperado/i)).toBeNull();
  });

  it('renderiza sin crashear cuando el usuario no tiene plan', async () => {
    await act(async () => { render(<AthleteDashboard />, { wrapper: Wrapper }); });
    expect(document.body).toBeTruthy();
    expect(screen.queryByText(/error inesperado/i)).toBeNull();
  });

  it('muestra pantalla de plan expirado cuando la vigencia vencio', async () => {
    localStorage.setItem('pwa_client_plan', JSON.stringify(PLAN));
    const past = new Date();
    past.setDate(past.getDate() - 100);
    mockCtx = { ...mockCtx, profile: { ...BASE_PROFILE, vigencia_dias: 30, fecha_inicio: past.toISOString().split('T')[0] } as any };
    await act(async () => { render(<AthleteDashboard />, { wrapper: Wrapper }); });
    expect(screen.getByText(/plan ha finalizado|fin de su vigencia|SERVICIO TEMPORALMENTE INACTIVO/i)).toBeTruthy();
  });

  it('monta sin crashear para atleta autonomo sin plan', async () => {
    mockCtx = { ...mockCtx, isSoloClient: true };
    await act(async () => { render(<AthleteDashboard />, { wrapper: Wrapper }); });
    expect(document.body).toBeTruthy();
    expect(screen.queryByText(/error inesperado/i)).toBeNull();
  });

});

describe('AthleteDashboard — navegación por tabs móviles', () => {

  it('arranca en el tab "Hoy" cuando no hay tab guardado en localStorage', async () => {
    localStorage.setItem('pwa_client_plan', JSON.stringify(PLAN));
    await act(async () => { render(<AthleteDashboard />, { wrapper: Wrapper }); });

    expect(screen.getByRole('button', { name: 'Hoy' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Plan' }).getAttribute('aria-current')).toBeNull();
  });

  it('restaura el tab guardado en localStorage al montar', async () => {
    localStorage.setItem('pwa_client_plan', JSON.stringify(PLAN));
    localStorage.setItem('pwa_active_mobile_tab', 'progreso');
    await act(async () => { render(<AthleteDashboard />, { wrapper: Wrapper }); });

    expect(screen.getByRole('button', { name: 'Progreso' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Hoy' }).getAttribute('aria-current')).toBeNull();
  });

  it('ignora un valor inválido en localStorage y cae al tab "Hoy" por defecto', async () => {
    localStorage.setItem('pwa_client_plan', JSON.stringify(PLAN));
    localStorage.setItem('pwa_active_mobile_tab', 'un-tab-que-no-existe');
    await act(async () => { render(<AthleteDashboard />, { wrapper: Wrapper }); });

    expect(screen.getByRole('button', { name: 'Hoy' }).getAttribute('aria-current')).toBe('page');
  });

  it('al clickear un tab, se actualiza el tab activo y se persiste en localStorage', async () => {
    localStorage.setItem('pwa_client_plan', JSON.stringify(PLAN));
    await act(async () => { render(<AthleteDashboard />, { wrapper: Wrapper }); });

    expect(screen.getByRole('button', { name: 'Hoy' }).getAttribute('aria-current')).toBe('page');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Plan' }));
    });

    expect(screen.getByRole('button', { name: 'Plan' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Hoy' }).getAttribute('aria-current')).toBeNull();
    expect(localStorage.getItem('pwa_active_mobile_tab')).toBe('plan');
  });

  it('no muestra badge de notificaciones en el tab Alertas cuando no hay notificaciones visibles', async () => {
    localStorage.setItem('pwa_client_plan', JSON.stringify(PLAN));
    await act(async () => { render(<AthleteDashboard />, { wrapper: Wrapper }); });

    expect(screen.queryByLabelText(/^\d+ alertas$/i)).toBeNull();
  });

});
