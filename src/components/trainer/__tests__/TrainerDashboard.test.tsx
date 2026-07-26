// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { TrainerDashboard } from '../TrainerDashboard';
import { ConfirmDialogProvider } from '../../../context/ConfirmDialogContext';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/trainer', search: '' }),
}));

const mockSignOut = vi.fn().mockResolvedValue(undefined);
const mockRefreshProfile = vi.fn();
const trainerProfile = { id: 'trainer-1', nombre: 'Coach Trainer', rol: 'entrenador' };

vi.mock('../../../context/SupabaseContext', () => ({
  useSupabase: () => ({
    profile: trainerProfile,
    signOut: mockSignOut,
    refreshProfile: mockRefreshProfile,
  }),
}));

const mockClientes = [
  { id: 'client-1', nombre: 'Ana Torres', email: 'ana@cliente.com', rol: 'cliente' },
  { id: 'client-2', nombre: 'Luis Gomez', email: 'luis@cliente.com', rol: 'cliente' },
];

const mockFetchClientes = vi.fn();
vi.mock('../../../hooks/trainer/useTrainerClients', () => ({
  useTrainerClients: () => ({
    clientes: mockClientes,
    setClientes: vi.fn(),
    loading: false,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    filteredClientes: mockClientes,
    clientesLogros: {},
    clientesRachas: {},
    activePlanDays: '4 Días / Sem',
    fetchClientes: mockFetchClientes,
  }),
}));

const mockFetchAuditoria = vi.fn();
vi.mock('../../../hooks/trainer/useTrainerAudits', () => ({
  useTrainerAudits: () => ({
    actividades: [],
    alertasClientes: {},
    loadingAuditoria: false,
    fetchAuditoria: mockFetchAuditoria,
    mostRecentSessionIds: new Set(),
    aplanadosEjercicios: [],
    availableExercisesForFilter: [],
    filasFiltradasProgresion: [],
    selectedAnalysisClient: 'all',
    setSelectedAnalysisClient: vi.fn(),
    selectedAnalysisExercise: 'all',
    setSelectedAnalysisExercise: vi.fn(),
    auditViewMode: 'cronologica',
    setAuditViewMode: vi.fn(),
    expandedActividades: {},
    setExpandedActividades: vi.fn(),
  }),
}));

vi.mock('../../../hooks/trainer/useTrainerSubscription', () => ({
  useTrainerSubscription: () => ({
    paymentLoading: false,
    trainerSubscription: { plan: 'free', estado: 'activo', expira_at: null },
    setTrainerSubscription: vi.fn(),
    handleMercadoPagoCheckout: vi.fn(),
    isTrainerExpired: false,
  }),
}));

// Mocks de los tabs: stand-ins simples para verificar CUÁL se monta, sin
// arrastrar su lógica interna (que no es responsabilidad de este archivo).
vi.mock('../tabs/TrainerClientsTab', () => ({
  default: () => <div data-testid="mock-clients-tab">Tab Atletas (mock)</div>,
}));
vi.mock('../tabs/TrainerAuditsTab', () => ({
  default: () => <div data-testid="mock-audits-tab">Tab Auditoría (mock)</div>,
}));
vi.mock('../TrainerAlertsHub', () => ({
  default: () => <div data-testid="mock-alerts-hub" />,
}));

function renderTrainerDashboard() {
  return render(
    <ConfirmDialogProvider>
      <TrainerDashboard />
    </ConfirmDialogProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Marca al entrenador como ya "onboarded" para que el OnboardingModal no
  // tape la pantalla en estos tests — igual que un entrenador real y activo.
  localStorage.setItem(`evolution_trainer_onboarded_v1_${trainerProfile.id}`, 'true');
  localStorage.setItem(`evolution_sandbox_guide_v1_${trainerProfile.id}`, 'true');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Cambio de pestañas — acá vivía el bug real que arreglamos (Auditoría no
// se veía porque le faltaba una prop). Estos tests protegen contra que
// vuelva a pasar lo mismo, en cualquier dirección.
// ---------------------------------------------------------------------------

describe('TrainerDashboard — cambio de pestañas Atletas / Auditoría', () => {
  it('muestra la pestaña de Atletas por defecto, y NO la de Auditoría', async () => {
    renderTrainerDashboard();

    expect(await screen.findByTestId('mock-clients-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-audits-tab')).not.toBeInTheDocument();
  });

  it('al hacer click en "Auditoría / Sesiones", muestra esa pestaña y oculta la de Atletas', async () => {
    renderTrainerDashboard();
    await screen.findByTestId('mock-clients-tab');

    fireEvent.click(screen.getByText('Auditoría / Sesiones'));

    expect(await screen.findByTestId('mock-audits-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-clients-tab')).not.toBeInTheDocument();
  });

  it('al volver a hacer click en "Atletas", vuelve a mostrar esa pestaña y oculta Auditoría', async () => {
    renderTrainerDashboard();
    await screen.findByTestId('mock-clients-tab');

    fireEvent.click(screen.getByText('Auditoría / Sesiones'));
    await screen.findByTestId('mock-audits-tab');

    fireEvent.click(screen.getByText('Atletas'));

    expect(await screen.findByTestId('mock-clients-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-audits-tab')).not.toBeInTheDocument();
  });

  it('nunca muestra ambas pestañas al mismo tiempo', async () => {
    renderTrainerDashboard();
    await screen.findByTestId('mock-clients-tab');

    fireEvent.click(screen.getByText('Auditoría / Sesiones'));
    await screen.findByTestId('mock-audits-tab');

    // Justo la aserción que hubiera detectado el bug original: ambos NUNCA
    // deberían coexistir en el DOM al mismo tiempo.
    expect(screen.queryByTestId('mock-clients-tab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-audits-tab')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

describe('TrainerDashboard — cerrar sesión', () => {
  it('pide confirmación antes de cerrar sesión, y no hace nada si se cancela', async () => {
    renderTrainerDashboard();
    await screen.findByTestId('mock-clients-tab');

    fireEvent.click(screen.getByText('Salir'));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText('Cancelar'));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith('/login');
  });

  it('al confirmar, cierra sesión y redirige a /login', async () => {
    renderTrainerDashboard();
    await screen.findByTestId('mock-clients-tab');

    fireEvent.click(screen.getByText('Salir'));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });
});

// ---------------------------------------------------------------------------
// Render general
// ---------------------------------------------------------------------------

describe('TrainerDashboard — renderizado general', () => {
  it('muestra el nombre del entrenador logueado', async () => {
    renderTrainerDashboard();
    await screen.findByTestId('mock-clients-tab');

    // Aparece más de una vez (header "Entrenador: X" y atribución "Por X" más abajo).
    expect(screen.getAllByText('Coach Trainer').length).toBeGreaterThan(0);
  });
});
