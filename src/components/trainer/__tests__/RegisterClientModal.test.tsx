// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import RegisterClientModal from '../modals/RegisterClientModal';

// Mock hook useModalA11y
vi.mock('../../../hooks/useModalA11y', () => ({
  useModalA11y: () => ({ current: null }),
}));

// Mock Supabase y Context
const mockUser = { id: 'trainer-id-123', email: 'trainer@example.com' };
const mockProfile = {
  id: 'trainer-id-123',
  nombre: 'Coach Juan',
  rol: 'entrenador',
  suscripcion_plan: 'iniciacion',
  marca: { nombre_display: 'Evolution Lab' },
};

let mockRPCResponse = { data: 'client-id-999', error: null };

vi.mock('@supabase/supabase-js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    createClient: vi.fn(() => ({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { user: { id: 'new-client-999' } },
          error: null,
        }),
      },
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    })),
  };
});

vi.mock('../../../context/SupabaseContext', () => ({
  useSupabase: () => ({
    user: mockUser,
    profile: mockProfile,
  }),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve(mockRPCResponse)),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { suscripcion_plan: 'iniciacion' }, error: null }),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn().mockImplementation((cb) => cb({ data: [], error: null })),
    })),
    auth: {
      signUp: vi.fn().mockResolvedValue({
        data: { user: { id: 'new-client-999' } },
        error: null,
      }),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockRPCResponse = { data: 'client-id-999', error: null };
});

afterEach(cleanup);

describe('RegisterClientModal Component', () => {
  it('no renderiza nada cuando isOpen es false', () => {
    render(
      <RegisterClientModal
        isOpen={false}
        onClose={vi.fn()}
        profile={mockProfile as any}
        clientes={[]}
        fetchClientes={vi.fn()}
        showToast={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renderiza el modal con el formulario de nuevo atleta cuando isOpen es true', () => {
    render(
      <RegisterClientModal
        isOpen={true}
        onClose={vi.fn()}
        profile={mockProfile as any}
        clientes={[]}
        fetchClientes={vi.fn()}
        showToast={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/AGREGAR ATLETA/i)).toBeInTheDocument();
  });

  it('valida el dominio del correo electrónico y rechaza emails no permitidos', async () => {
    const showToast = vi.fn();

    render(
      <RegisterClientModal
        isOpen={true}
        onClose={vi.fn()}
        profile={mockProfile as any}
        clientes={[]}
        fetchClientes={vi.fn()}
        showToast={showToast}
      />
    );

    const nameInput = screen.getByPlaceholderText(/Ej. Juan Manuel Cardona/i);
    const emailInput = screen.getByPlaceholderText(/ejemplo@correo.com/i);
    const passInput = screen.getByPlaceholderText(/Min. 6 caracteres/i);
    const goalInput = screen.getByPlaceholderText(/Ej. Hipertrofia general/i);

    fireEvent.change(nameInput, { target: { value: 'Carlos Gómez' } });
    fireEvent.change(emailInput, { target: { value: 'carlos@empresa-ficticia.com' } });
    fireEvent.change(passInput, { target: { value: '123456' } });
    fireEvent.change(goalInput, { target: { value: 'Hipertrofia' } });

    const submitBtn = screen.getByRole('button', { name: /Confirmar y Guardar/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.stringMatching(/Error al registrar: Por favor ingresa un correo electrónico real/i),
        'error'
      );
    });
  });

  it('cierra el modal al hacer clic en el botón de cerrar (×)', () => {
    const onClose = vi.fn();

    render(
      <RegisterClientModal
        isOpen={true}
        onClose={onClose}
        profile={mockProfile as any}
        clientes={[]}
        fetchClientes={vi.fn()}
        showToast={vi.fn()}
      />
    );

    const closeBtn = screen.getByRole('button', { name: '×' });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
