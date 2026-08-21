// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { SupabaseProvider, useSupabase } from '../SupabaseContext';

// Mock Supabase Client and Auth listeners
let authCallback: any = null;
const mockSubscription = {
  unsubscribe: vi.fn(),
};

let mockProfileResponse: any = {
  data: { id: 'test-user-id', rol: 'cliente', suscripcion_plan: 'free', entrenador_id: null },
  error: null
};

let mockRpcResponse: any = {
  data: { id: 'test-user-id', rol: 'entrenador', suscripcion_plan: 'free' },
  error: null
};
let mockRpcShouldReject = false;

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((cb) => {
        authCallback = cb;
        return { data: { subscription: mockSubscription } };
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            user_metadata: { full_name: 'Test Athlete' },
            app_metadata: { provider: 'google' }
          }
        }
      })
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(mockProfileResponse))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'test-user-id', rol: 'entrenador', suscripcion_plan: 'free' },
              error: null
            })
          }))
        }))
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'test-user-id', rol: 'entrenador', suscripcion_plan: 'free' },
            error: null
          })
        }))
      }))
    })),
    rpc: vi.fn((_fnName, _args) =>
      mockRpcShouldReject
        ? Promise.reject(new Error('network error'))
        : Promise.resolve(mockRpcResponse)
    )
  }
}));

const TestConsumer = () => {
  const {
    user,
    profile,
    isAuthenticated,
    isTrainer,
    isSoloClient,
    needsRoleSelection,
    completeRoleSelection,
    loading,
    signOut
  } = useSupabase();
  const [roleError, setRoleError] = React.useState<string | null>(null);

  if (loading) return <span data-testid="loading-state">loading...</span>;
  return (
    <div>
      <span data-testid="auth-state">{isAuthenticated ? 'logged-in' : 'logged-out'}</span>
      <span data-testid="user-email">{user?.email || 'no-email'}</span>
      <span data-testid="profile-role">{profile?.rol || 'no-role'}</span>
      <span data-testid="is-solo">{isSoloClient ? 'yes' : 'no'}</span>
      <span data-testid="is-trainer">{isTrainer ? 'yes' : 'no'}</span>
      <span data-testid="needs-role-selection">{needsRoleSelection ? 'yes' : 'no'}</span>
      <span data-testid="role-error">{roleError || 'no-error'}</span>
      <button
        data-testid="choose-trainer-btn"
        onClick={() => {
          setRoleError(null);
          completeRoleSelection('entrenador', { whatsapp: '+1234', instagram: 'coach' }).catch(
            (err: any) => setRoleError(err.message || 'error desconocido')
          );
        }}
      >
        Choose Trainer
      </button>
      <button data-testid="sign-out-btn" onClick={signOut}>Sign Out</button>
    </div>
  );
};

describe('SupabaseContext Provider', () => {
  beforeEach(() => {
    localStorage.clear();
    mockSubscription.unsubscribe.mockClear();
    mockProfileResponse = {
      data: { id: 'test-user-id', rol: 'cliente', suscripcion_plan: 'free', entrenador_id: null },
      error: null
    };
    mockRpcResponse = {
      data: { id: 'test-user-id', rol: 'entrenador', suscripcion_plan: 'free' },
      error: null
    };
    mockRpcShouldReject = false;
  });

  afterEach(cleanup);

  it('should initialize loading state and then resolve unauthenticated session', async () => {
    render(
      <SupabaseProvider>
        <TestConsumer />
      </SupabaseProvider>
    );

    // Initial state before event is triggered is loading
    expect(screen.getByTestId('loading-state')).toBeDefined();
    expect(screen.queryByTestId('auth-state')).toBeNull();

    // Trigger initial unauthenticated session event
    await act(async () => {
      authCallback('INITIAL_SESSION', null);
    });

    expect(screen.queryByTestId('loading-state')).toBeNull();
    expect(screen.getByTestId('auth-state').textContent).toBe('logged-out');
    expect(screen.getByTestId('user-email').textContent).toBe('no-email');
  });

  it('should resolve session and profile on SIGNED_IN event', async () => {
    render(
      <SupabaseProvider>
        <TestConsumer />
      </SupabaseProvider>
    );

    const mockUser = { id: 'test-user-id', email: 'test@example.com' };
    const mockSession = { user: mockUser };

    // Trigger auth state change event
    await act(async () => {
      await authCallback('INITIAL_SESSION', mockSession);
    });

    expect(screen.getByTestId('auth-state').textContent).toBe('logged-in');
    expect(screen.getByTestId('user-email').textContent).toBe('test@example.com');
    expect(screen.getByTestId('profile-role').textContent).toBe('cliente');
    expect(screen.getByTestId('is-solo').textContent).toBe('yes');
    expect(screen.getByTestId('needs-role-selection').textContent).toBe('no');
  });

  it('should flag needsRoleSelection = yes for new Google OAuth user with onboarding_completado = false', async () => {
    // suscripcion_plan viene siempre en 'free' desde el trigger (DEFAULT de columna),
    // nunca null — por eso la señal real es onboarding_completado, no suscripcion_plan.
    mockProfileResponse = {
      data: { id: 'test-user-id', nombre: 'Nuevo Atleta', rol: 'cliente', suscripcion_plan: 'free', onboarding_completado: false },
      error: null
    };

    render(
      <SupabaseProvider>
        <TestConsumer />
      </SupabaseProvider>
    );

    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      app_metadata: { provider: 'google' }
    };
    const mockSession = { user: mockUser };

    await act(async () => {
      await authCallback('INITIAL_SESSION', mockSession);
    });

    expect(screen.getByTestId('auth-state').textContent).toBe('logged-in');
    expect(screen.getByTestId('needs-role-selection').textContent).toBe('yes');
  });

  it('should complete role selection and update profile state', async () => {
    mockProfileResponse = {
      data: { id: 'test-user-id', nombre: 'Nuevo Atleta', rol: 'cliente', suscripcion_plan: 'free', onboarding_completado: false },
      error: null
    };

    render(
      <SupabaseProvider>
        <TestConsumer />
      </SupabaseProvider>
    );

    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      app_metadata: { provider: 'google' }
    };
    const mockSession = { user: mockUser };

    await act(async () => {
      await authCallback('INITIAL_SESSION', mockSession);
    });

    expect(screen.getByTestId('needs-role-selection').textContent).toBe('yes');

    // Choose Trainer
    const chooseTrainerBtn = screen.getByTestId('choose-trainer-btn');
    await act(async () => {
      fireEvent.click(chooseTrainerBtn);
    });

    expect(screen.getByTestId('needs-role-selection').textContent).toBe('no');
    expect(screen.getByTestId('is-trainer').textContent).toBe('yes');
  });

  it('should surface a real error and keep needsRoleSelection = yes when the RPC fails (no fake local success)', async () => {
    mockProfileResponse = {
      data: { id: 'test-user-id', nombre: 'Nuevo Atleta', rol: 'cliente', suscripcion_plan: 'free', onboarding_completado: false },
      error: null
    };
    // Simula el escenario real: el RPC falla (red, o RLS bloqueando en algún entorno).
    mockRpcShouldReject = true;

    render(
      <SupabaseProvider>
        <TestConsumer />
      </SupabaseProvider>
    );

    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      app_metadata: { provider: 'google' }
    };
    const mockSession = { user: mockUser };

    await act(async () => {
      await authCallback('INITIAL_SESSION', mockSession);
    });

    expect(screen.getByTestId('needs-role-selection').textContent).toBe('yes');

    const chooseTrainerBtn = screen.getByTestId('choose-trainer-btn');
    await act(async () => {
      fireEvent.click(chooseTrainerBtn);
    });

    // El error debe llegar al llamador (no quedar silencioso)...
    expect(screen.getByTestId('role-error').textContent).not.toBe('no-error');
    // ...y el estado no debe fingir que el onboarding se completó: el
    // modal debe seguir mostrándose para que el usuario pueda reintentar,
    // y el rol NO debe cambiar en el estado local sin haberse persistido.
    expect(screen.getByTestId('needs-role-selection').textContent).toBe('yes');
    expect(screen.getByTestId('is-trainer').textContent).toBe('no');
    expect(screen.getByTestId('profile-role').textContent).toBe('cliente');
  });

  it('should clear data on signOut', async () => {
    render(
      <SupabaseProvider>
        <TestConsumer />
      </SupabaseProvider>
    );

    const mockUser = { id: 'test-user-id', email: 'test@example.com' };
    const mockSession = { user: mockUser };

    // Trigger signed in
    await act(async () => {
      await authCallback('INITIAL_SESSION', mockSession);
    });

    expect(screen.getByTestId('auth-state').textContent).toBe('logged-in');

    // Click sign out
    const signOutBtn = screen.getByTestId('sign-out-btn');
    await act(async () => {
      fireEvent.click(signOutBtn);
    });

    expect(screen.getByTestId('auth-state').textContent).toBe('logged-out');
    expect(screen.getByTestId('user-email').textContent).toBe('no-email');
    expect(screen.getByTestId('needs-role-selection').textContent).toBe('no');
    expect(localStorage.getItem('pwa_user_profile')).toBeNull();
  });

  it('should handle token expiration (SIGNED_OUT event) and update authentication state to false', async () => {
    render(
      <SupabaseProvider>
        <TestConsumer />
      </SupabaseProvider>
    );

    const mockUser = { id: 'test-user-id', email: 'test@example.com' };
    const mockSession = { user: mockUser };

    // Login first
    await act(async () => {
      await authCallback('INITIAL_SESSION', mockSession);
    });
    expect(screen.getByTestId('auth-state').textContent).toBe('logged-in');

    // Simulate token expiration / sign out event
    await act(async () => {
      await authCallback('SIGNED_OUT', null);
    });

    expect(screen.getByTestId('auth-state').textContent).toBe('logged-out');
    expect(screen.getByTestId('user-email').textContent).toBe('no-email');
  });

  it('should end loading state after 6s safety timeout if initialization is delayed', async () => {
    vi.useFakeTimers();

    render(
      <SupabaseProvider>
        <TestConsumer />
      </SupabaseProvider>
    );

    // Initially loading
    expect(screen.getByTestId('loading-state')).toBeDefined();

    // Advance virtual timers by 6 seconds (6000ms)
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    // Loading should be forced to false, turning loading off and showing unauthenticated view
    expect(screen.queryByTestId('loading-state')).toBeNull();
    expect(screen.getByTestId('auth-state').textContent).toBe('logged-out');

    vi.useRealTimers();
  });
});
