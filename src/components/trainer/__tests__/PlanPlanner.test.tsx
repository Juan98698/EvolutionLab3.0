// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PlanPlanner } from '../PlanPlanner';

// Mock Router
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ clienteId: 'test-client-id' }),
  useNavigate: () => mockNavigate,
}));

// Mock Supabase Context
vi.mock('../../../context/SupabaseContext', () => ({
  useSupabase: () => ({
    profile: { id: 'trainer-id', nombre_completo: 'Coach Trainer' }
  })
}));

// Mock Chart Radar
vi.mock('react-chartjs-2', () => ({
  Radar: () => <div data-testid="mock-radar" />
}));

// Mock GuidedPlanSetup
vi.mock('./GuidedPlanSetup', () => ({
  GuidedPlanSetup: () => <div data-testid="mock-guided-setup" />
}));

// Mock Supabase database responses
const mockPlan = {
  id: 'plan-id',
  cliente_id: 'test-client-id',
  activo: true,
  datos_plan: {
    portada: {
      userName: 'Juan Perez',
      userGoal: 'Hipertrofia',
      startDate: '2026-06-30',
      planVigenciaPlan: '28',
      trainerName: 'Coach Trainer',
      whatsappLink: '',
      instagramLink: '',
      globalNote: 'Nota global de prueba'
    },
    globalVariables: [
      { id: 'series de trabajo', label: 'SERIES DE TRABAJO', type: 'text', defaultValue: '3' },
      { id: 'repeticiones', label: 'REPETICIONES', type: 'text', defaultValue: '10' }
    ],
    trainingDays: [
      {
        name: 'Lunes: Empuje',
        exercises: [
          {
            nombre: 'Press de banca plano con barra',
            grupo_muscular: 'Pecho',
            variables: {
              'series de trabajo': '3',
              'repeticiones': '10'
            }
          }
        ]
      }
    ],
    weeklyTargets: {}
  }
};

const mockProfile = {
  id: 'test-client-id',
  nombre: 'Juan Perez',
  nombre_completo: 'Juan Perez',
  rol: 'cliente'
};

vi.mock('../../../lib/supabaseClient', () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } })
      },
      from: vi.fn((table) => {
        const tableChain: any = {};
        tableChain.select = vi.fn().mockReturnValue(tableChain);
        tableChain.eq = vi.fn().mockReturnValue(tableChain);
        tableChain.order = vi.fn().mockReturnValue(tableChain);
        
        tableChain.maybeSingle = vi.fn().mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => {
              if (table === 'profiles') {
                resolve({ data: mockProfile, error: null });
              } else if (table === 'planes') {
                resolve({ data: mockPlan, error: null });
              } else {
                resolve({ data: null, error: null });
              }
            }, 20);
          });
        });
        tableChain.single = tableChain.maybeSingle;

        tableChain.insert = vi.fn().mockResolvedValue({ data: { id: 'new-plan-id' }, error: null });
        tableChain.update = vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        });

        return tableChain;
      }),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      }))
    }
  };
});

describe('PlanPlanner Component', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('evolution_guided_plan_v1_trainer-id', 'true');
    mockNavigate.mockClear();
  });

  afterEach(cleanup);

  it('should render loading state initially, then render planner workspace once resolved', async () => {
    render(<PlanPlanner />);

    // Initially shows loader
    expect(screen.getByText('Cargando Planificador de Rutina...')).toBeDefined();

    // Resolves and displays title and athlete name
    const title = await screen.findByText('PLANIFICADOR DE RUTINA');
    expect(title).toBeDefined();
    expect(screen.getByText('Juan Perez')).toBeDefined();
  });

  // FIX: planes antiguos sin `id` en trainingDays no deben generar el warning
  // "Each child in a list should have a unique key prop" — confirma que la
  // normalización de carga (línea ~970 de PlanPlanner.tsx) asigna un id
  // de respaldo cuando el plan guardado no lo trae.
  it('plan sin day.id (formato legacy): no genera warning de React keys', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<PlanPlanner />);
    await screen.findByText('PLANIFICADOR DE RUTINA');

    const keyWarnings = consoleErrorSpy.mock.calls.filter(call =>
      typeof call[0] === 'string' && call[0].includes('unique "key" prop')
    );
    expect(keyWarnings.length).toBe(0);

    consoleErrorSpy.mockRestore();
  });
});
