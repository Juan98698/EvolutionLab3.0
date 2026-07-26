// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { AdminDashboard } from '../AdminDashboard';
import { ConfirmDialogProvider } from '../../../context/ConfirmDialogContext';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockSignOut = vi.fn().mockResolvedValue(undefined);
const adminProfile = { id: 'admin-1', nombre: 'Admin Root', rol: 'admin' };

vi.mock('../../../context/SupabaseContext', () => ({
  useSupabase: () => ({
    profile: adminProfile,
    signOut: mockSignOut,
  }),
}));

const mockUsers = [
  { id: 'admin-1', nombre: 'Admin Root', email: 'admin@evolutionlab.fit', rol: 'admin', created_at: '2026-01-01' },
  { id: 'trainer-1', nombre: 'Juan Perez', email: 'juan@coach.com', rol: 'entrenador', created_at: '2026-01-02' },
  { id: 'client-1', nombre: 'Ana Torres', email: 'ana@cliente.com', rol: 'cliente', created_at: '2026-01-03', entrenador_id: 'trainer-1' },
];

// El RPC de borrado es configurable por test para simular éxito o fallo.
let rpcImpl = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => {
      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockResolvedValue({ data: mockUsers, error: null });
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.update = vi.fn().mockReturnValue(chain);
      return chain;
    }),
    rpc: vi.fn((...args) => rpcImpl(...args)),
  },
}));

// AdminDashboard no usa useConfirm dentro de un modal complejo, pero sí useModalA11y
// en el modal de info de plan — no se abre en estos tests, así que no hace falta mock.

function renderAdminDashboard() {
  return render(
    <ConfirmDialogProvider>
      <AdminDashboard />
    </ConfirmDialogProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  rpcImpl = vi.fn().mockResolvedValue({ data: null, error: null });
  window.innerWidth = 1280; // fuerza el layout de escritorio (tiene selectores más estables)
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Render y datos
// ---------------------------------------------------------------------------

describe('AdminDashboard — carga y muestra usuarios', () => {
  it('muestra el estado de carga y luego la lista de usuarios con sus estadísticas', async () => {
    renderAdminDashboard();

    expect(screen.getByText(/Cargando usuarios del sistema/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    });

    expect(screen.getByText('Ana Torres')).toBeInTheDocument();
    // "Admin Root" aparece 2 veces: en el header ("Panel de Control — Admin Root")
    // y en su propia fila de la tabla.
    expect(screen.getAllByText('Admin Root').length).toBeGreaterThanOrEqual(2);

    // Estadísticas: 3 total, 1 admin, 1 entrenador, 1 cliente
    expect(screen.getByText('Total Usuarios').parentElement).toHaveTextContent('3');
    expect(screen.getByText('Administradores').parentElement).toHaveTextContent('1');
    expect(screen.getByText('Entrenadores').parentElement).toHaveTextContent('1');
    // "Clientes" aparece 2 veces: en la tarjeta de estadísticas y en el botón de filtro.
    // La tarjeta de estadísticas es la primera en el DOM.
    expect(screen.getAllByText('Clientes')[0].parentElement).toHaveTextContent('1');
  });

  it('filtra la lista al buscar por nombre o email', async () => {
    renderAdminDashboard();
    await screen.findByText('Juan Perez');

    const searchInput = screen.getByPlaceholderText('Buscar por nombre o email...');
    fireEvent.change(searchInput, { target: { value: 'ana@cliente' } });

    expect(screen.getByText('Ana Torres')).toBeInTheDocument();
    expect(screen.queryByText('Juan Perez')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Eliminar usuario — la operación más destructiva del componente
// ---------------------------------------------------------------------------

describe('AdminDashboard — eliminar usuario', () => {
  it('no muestra botón de eliminar en la propia fila del administrador', async () => {
    renderAdminDashboard();
    await screen.findByText('Juan Perez');

    // 3 usuarios cargados, pero el admin (usuario actual) no debe tener botón de eliminar —
    // solo debe haber uno por cada uno de los OTROS usuarios (Juan Perez, Ana Torres).
    const deleteButtons = screen.getAllByTitle('Eliminar usuario permanentemente');
    expect(deleteButtons).toHaveLength(2);
  });

  it('al cancelar el diálogo de confirmación, NO elimina al usuario ni llama al RPC', async () => {
    renderAdminDashboard();
    await screen.findByText('Juan Perez');

    const deleteButtons = screen.getAllByTitle('Eliminar usuario permanentemente');
    fireEvent.click(deleteButtons[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Juan Perez/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByText('Cancelar'));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(rpcImpl).not.toHaveBeenCalled();
    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
  });

  it('al confirmar, llama al RPC delete_user con el id correcto y quita al usuario de la lista', async () => {
    renderAdminDashboard();
    await screen.findByText('Juan Perez');

    const deleteButtons = screen.getAllByTitle('Eliminar usuario permanentemente');
    fireEvent.click(deleteButtons[0]); // primer botón visible = Juan Perez (admin no tiene botón)

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText('Eliminar'));

    await waitFor(() => {
      expect(rpcImpl).toHaveBeenCalledWith('delete_user', { target_user_id: 'trainer-1' });
    });

    await waitFor(() => {
      expect(screen.queryByText('Juan Perez')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/eliminado correctamente/i)).toBeInTheDocument();
  });

  it('si el RPC falla, muestra un error y NO quita al usuario de la lista', async () => {
    rpcImpl = vi.fn().mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    renderAdminDashboard();
    await screen.findByText('Juan Perez');

    const deleteButtons = screen.getAllByTitle('Eliminar usuario permanentemente');
    fireEvent.click(deleteButtons[0]);

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText('Eliminar'));

    await waitFor(() => {
      expect(screen.getByText(/Error al eliminar/i)).toBeInTheDocument();
    });

    // El usuario sigue en la lista porque la llamada falló
    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

describe('AdminDashboard — cerrar sesión', () => {
  it('pide confirmación antes de cerrar sesión, y no hace nada si se cancela', async () => {
    renderAdminDashboard();
    await screen.findByText('Juan Perez');

    fireEvent.click(screen.getByText('Salir'));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText('Cancelar'));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('al confirmar, cierra sesión y redirige a /login', async () => {
    renderAdminDashboard();
    await screen.findByText('Juan Perez');

    fireEvent.click(screen.getByText('Salir'));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });
});
