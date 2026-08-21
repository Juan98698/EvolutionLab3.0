// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { RoleSelectionModal } from '../RoleSelectionModal';

const mockCompleteRoleSelection = vi.fn();
const mockUser = {
  id: 'test-oauth-user-id',
  email: 'testuser@gmail.com',
  user_metadata: {
    full_name: 'Juan Pérez',
    name: 'Juan Pérez'
  }
};

vi.mock('../../../context/SupabaseContext', () => ({
  useSupabase: () => ({
    user: mockUser,
    completeRoleSelection: mockCompleteRoleSelection,
    profile: {
      id: 'test-oauth-user-id',
      email: 'testuser@gmail.com',
      nombre: 'Nuevo Atleta',
      rol: 'cliente',
      suscripcion_plan: null
    }
  })
}));

describe('RoleSelectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('renders initial greetings and role selection cards', () => {
    render(<RoleSelectionModal />);

    expect(screen.getByText(/¡Hola, Juan Pérez!/i)).toBeDefined();
    expect(screen.getByText(/¿Cómo deseas utilizar/i)).toBeDefined();
    expect(screen.getByTestId('role-athlete-btn')).toBeDefined();
    expect(screen.getByTestId('role-trainer-btn')).toBeDefined();

    const confirmBtn = screen.getByTestId('confirm-role-btn') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
  });

  it('allows selecting athlete role and submitting', async () => {
    mockCompleteRoleSelection.mockResolvedValueOnce(undefined);
    const onComplete = vi.fn();

    render(<RoleSelectionModal onComplete={onComplete} />);

    const athleteBtn = screen.getByTestId('role-athlete-btn');
    fireEvent.click(athleteBtn);

    const confirmBtn = screen.getByTestId('confirm-role-btn') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockCompleteRoleSelection).toHaveBeenCalledWith('cliente', {
        nombre: 'Juan Pérez'
      });
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it('allows selecting trainer role with custom branding inputs', async () => {
    mockCompleteRoleSelection.mockResolvedValueOnce(undefined);
    const onComplete = vi.fn();

    render(<RoleSelectionModal onComplete={onComplete} />);

    const trainerBtn = screen.getByTestId('role-trainer-btn');
    fireEvent.click(trainerBtn);

    // Trainer extra fields should appear
    expect(screen.getByTestId('trainer-name-input')).toBeDefined();
    expect(screen.getByTestId('trainer-whatsapp-input')).toBeDefined();
    expect(screen.getByTestId('trainer-instagram-input')).toBeDefined();

    fireEvent.change(screen.getByTestId('trainer-name-input'), {
      target: { value: 'Coach Juan' }
    });
    fireEvent.change(screen.getByTestId('trainer-whatsapp-input'), {
      target: { value: '+57 300 9876543' }
    });
    fireEvent.change(screen.getByTestId('trainer-instagram-input'), {
      target: { value: '@coachjuan' }
    });

    const confirmBtn = screen.getByTestId('confirm-role-btn') as HTMLButtonElement;
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockCompleteRoleSelection).toHaveBeenCalledWith('entrenador', {
        nombre: 'Coach Juan',
        whatsapp: '+57 300 9876543',
        instagram: 'coachjuan'
      });
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it('displays error message when completeRoleSelection fails', async () => {
    mockCompleteRoleSelection.mockRejectedValueOnce(new Error('Fallo de conexión en Supabase'));

    render(<RoleSelectionModal />);

    const athleteBtn = screen.getByTestId('role-athlete-btn');
    fireEvent.click(athleteBtn);

    const confirmBtn = screen.getByTestId('confirm-role-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/Fallo de conexión en Supabase/i)).toBeDefined();
    });
  });
});
