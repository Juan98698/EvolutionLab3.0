// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { SupabaseProvider, useSupabase } from '../SupabaseContext';

// Mock Supabase Client and Auth listeners
let authCallback: any = null;
const mockSubscription = {
  unsubscribe: vi.fn(),
};

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((cb) => {
        authCallback = cb;
        return { data: { subscription: mockSubscription } };
      }),
      signOut: vi.fn().mockResolvedValue({ error: null })
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'test-user-id', rol: 'cliente', entrenador_id: null },
            error: null
          })
        }))
      }))
    }))
  }
}));

const TestConsumer = () => {
  const { user, profile, isAuthenticated, isTrainer, isSoloClient, loading, signOut } = useSupabase();
  if (loading) return <span data-testid="loading-state">loading...</span>;
  return (
    <div>
      <span data-testid="auth-state">{isAuthenticated ? 'logged-in' : 'logged-out'}</span>
      <span data-testid="user-email">{user?.email || 'no-email'}</span>
      <span data-testid="profile-role">{profile?.rol || 'no-role'}</span>
      <span data-testid="is-solo">{isSoloClient ? 'yes' : 'no'}</span>
      <span data-testid="is-trainer">{isTrainer ? 'yes' : 'no'}</span>
      <button data-testid="sign-out-btn" onClick={signOut}>Sign Out</button>
    </div>
  );
};

describe('SupabaseContext Provider', () => {
  beforeEach(() => {
    localStorage.clear();
    mockSubscription.unsubscribe.mockClear();
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
    expect(localStorage.getItem('pwa_user_profile')).toBeNull();
  });
});
