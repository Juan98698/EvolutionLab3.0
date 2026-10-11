// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../Login';
import * as inAppBrowserModule from '../../../lib/inAppBrowser';
import { supabase } from '../../../lib/supabaseClient';

vi.mock('../../../context/SupabaseContext', () => ({
  useSupabase: () => ({
    user: null,
    profile: null,
    loading: false,
    isAuthenticated: false,
    isTrainer: false,
    isAdmin: false,
    isSoloClient: false,
    needsRoleSelection: false,
    completeRoleSelection: vi.fn(),
    refreshProfile: vi.fn(),
    signOut: vi.fn(),
  }),
}));

describe('Login Component - In-App Browser Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('muestra aviso bajo el botón de Google e impide invocar OAuth dentro de Instagram', async () => {
    vi.spyOn(inAppBrowserModule, 'isInAppBrowser').mockReturnValue(true);
    const oauthSpy = vi.spyOn(supabase.auth, 'signInWithOAuth');

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    // Debe mostrar la advertencia visual
    expect(screen.getByText(/Google no permite entrar dentro de Instagram\/Facebook/i)).toBeInTheDocument();

    // Al hacer clic en el botón de Google, no debe invocar signInWithOAuth
    const googleBtn = screen.getByRole('button', { name: /CONTINUAR CON GOOGLE/i });
    fireEvent.click(googleBtn);

    expect(oauthSpy).not.toHaveBeenCalled();

    // Debe mostrar el mensaje de error explicativo
    await waitFor(() => {
      expect(
        screen.getByText(/Google bloquea el inicio de sesión dentro de Instagram y Facebook por seguridad/i)
      ).toBeInTheDocument();
    });
  });
});
