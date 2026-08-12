// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { Login } from '../Login';

// ─── Mock: react-router-dom ────────────────────────────────────────────────
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ search: '', pathname: '/login', hash: '' }),
  useNavigate: () => vi.fn(),
}));

// ─── Mock: Supabase Context ────────────────────────────────────────────────
vi.mock('../../../context/SupabaseContext', () => ({
  useSupabase: () => ({
    isAuthenticated: false,
    isTrainer: false,
    loading: false,
  }),
}));

// ─── Mock: Supabase Client ──────────────────────────────────────────────────
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

describe('Login Component - UX & Validation Features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('muestra la advertencia de correo no válido cuando el formato de email es incorrecto', () => {
    render(<Login />);
    const emailInput = screen.getByLabelText(/Correo Electrónico/i) as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'correoinvalido' } });
    fireEvent.blur(emailInput);

    expect(screen.getByText(/⚠️ Formato de correo no válido/i)).toBeTruthy();
  });

  it('valida un correo con formato correcto (ej: usuario@gmail.com) sin mostrar advertencias', () => {
    render(<Login />);
    const emailInput = screen.getByLabelText(/Correo Electrónico/i) as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'usuario@gmail.com' } });
    fireEvent.blur(emailInput);

    expect(screen.queryByText(/⚠️ Formato de correo no válido/i)).toBeNull();
  });

  it('renderiza el campo Confirmar Contraseña al cambiar al modo de registro', () => {
    render(<Login />);
    const registerBtn = screen.getByRole('button', { name: /¿NO TIENES CUENTA\? REGÍSTRATE GRATIS/i });
    fireEvent.click(registerBtn);

    expect(screen.getByLabelText(/Confirmar Contraseña/i)).toBeTruthy();
  });

  it('muestra la alerta de que las contraseñas no coinciden en el formulario de registro', () => {
    render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: /¿NO TIENES CUENTA\? REGÍSTRATE GRATIS/i }));

    const passInput = screen.getByLabelText(/^Contraseña \(Mín\. 6 caracteres\)/i);
    const confirmInput = screen.getByLabelText(/Confirmar Contraseña/i);

    fireEvent.change(passInput, { target: { value: 'clave123' } });
    fireEvent.change(confirmInput, { target: { value: 'claveDiferente' } });
    fireEvent.blur(confirmInput);

    expect(screen.getByText(/⚠️ Las contraseñas no coinciden/i)).toBeTruthy();
  });

  it('muestra la confirmación verde cuando ambas contraseñas coinciden exactamente', () => {
    render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: /¿NO TIENES CUENTA\? REGÍSTRATE GRATIS/i }));

    const passInput = screen.getByLabelText(/^Contraseña \(Mín\. 6 caracteres\)/i);
    const confirmInput = screen.getByLabelText(/Confirmar Contraseña/i);

    fireEvent.change(passInput, { target: { value: 'clave123' } });
    fireEvent.change(confirmInput, { target: { value: 'clave123' } });
    fireEvent.blur(confirmInput);

    expect(screen.getByText(/✓ Las contraseñas coinciden/i)).toBeTruthy();
  });

  it('bloquea el registro si las contraseñas no coinciden y muestra error', async () => {
    render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: /¿NO TIENES CUENTA\? REGÍSTRATE GRATIS/i }));

    const nameInput = screen.getByLabelText(/Nombre Completo/i);
    const emailInput = screen.getByLabelText(/Correo Electrónico/i);
    const passInput = screen.getByLabelText(/^Contraseña \(Mín\. 6 caracteres\)/i);
    const confirmInput = screen.getByLabelText(/Confirmar Contraseña/i);

    fireEvent.change(nameInput, { target: { value: 'Atleta Prueba' } });
    fireEvent.change(emailInput, { target: { value: 'atleta@gmail.com' } });
    fireEvent.change(passInput, { target: { value: 'clave123' } });
    fireEvent.change(confirmInput, { target: { value: 'claveErrada' } });

    const submitBtn = screen.getByRole('button', { name: /REGISTRARSE/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Las contraseñas no coinciden/i)).toBeTruthy();
  });
});
