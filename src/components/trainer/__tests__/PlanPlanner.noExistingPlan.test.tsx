// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PlanPlanner } from '../PlanPlanner';
import { ConfirmDialogProvider } from '../../../context/ConfirmDialogContext';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ clienteId: 'trainer-id' }), // el entrenador planificando SU PROPIA rutina
  useNavigate: () => vi.fn(),
}));

vi.mock('../../../context/SupabaseContext', () => ({
  useSupabase: () => ({
    profile: { id: 'trainer-id', nombre_completo: 'Coach Trainer' }
  })
}));

vi.mock('react-chartjs-2', () => ({
  Radar: () => <div data-testid="mock-radar" />
}));

vi.mock('./GuidedPlanSetup', () => ({
  GuidedPlanSetup: () => <div data-testid="mock-guided-setup" />
}));

const mockProfile = {
  id: 'trainer-id',
  nombre: 'Coach Trainer',
  nombre_completo: 'Coach Trainer',
  rol: 'entrenador'
};

vi.mock('../../../lib/supabaseClient', () => {
  return {
    supabase: {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
      from: vi.fn((table) => {
        const tableChain: any = {};
        tableChain.select = vi.fn().mockReturnValue(tableChain);
        tableChain.eq = vi.fn().mockReturnValue(tableChain);
        tableChain.order = vi.fn().mockReturnValue(tableChain);

        tableChain.limit = vi.fn().mockImplementation((_num) => {
          return new Promise((resolve) => {
            setTimeout(() => {
              if (table === 'planes') {
                resolve({ data: [], error: null });
              } else {
                resolve({ data: [], error: null });
              }
            }, 20);
          });
        });

        tableChain.maybeSingle = vi.fn().mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => {
              if (table === 'profiles') {
                resolve({ data: mockProfile, error: null });
              } else if (table === 'planes') {
                // Escenario real: el entrenador nunca creó un plan para su
                // propia rutina — no existe ninguna fila en `planes` todavía.
                resolve({ data: null, error: null });
              } else {
                resolve({ data: null, error: null });
              }
            }, 20);
          });
        });
        tableChain.single = tableChain.maybeSingle;
        tableChain.insert = vi.fn().mockResolvedValue({ data: { id: 'new-plan-id' }, error: null });
        tableChain.update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) });

        return tableChain;
      }),
      channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }))
    }
  };
});

describe('PlanPlanner: primer uso sin plan existente ("Planificar Mi Rutina")', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('evolution_guided_plan_v1_trainer-id', 'true');
  });

  afterEach(cleanup);

  it('debe mostrar los 7 campos de variables (peso, series, rir, etc.) por ejercicio aunque no exista un plan guardado todavía', async () => {
    render(
      <ConfirmDialogProvider>
        <PlanPlanner />
      </ConfirmDialogProvider>
    );
    await screen.findByText('PLANIFICADOR DE RUTINA');

    const variablesRows = document.querySelectorAll('.variables-row');
    expect(variablesRows.length).toBeGreaterThan(0);

    // Cada fila de variables debe tener las 7 definidas en DEFAULT_VARS
    variablesRows.forEach((row) => {
      expect(row.children.length).toBe(7);
    });

    expect(screen.getAllByText('SERIES DE TRABAJO').length).toBeGreaterThan(0);
    expect(screen.getAllByText('REPETICIONES').length).toBeGreaterThan(0);
    expect(screen.getAllByText('RIR').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PESO(KG)').length).toBeGreaterThan(0);
  });
});
