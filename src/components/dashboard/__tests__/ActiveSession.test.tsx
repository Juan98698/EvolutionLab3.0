// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import ActiveSession from '../ActiveSession';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ dayIndex: '0' }),
  useNavigate: () => mockNavigate,
}));

// Mock Supabase client
const mockInsert = vi.fn().mockResolvedValue({ data: { id: 123 }, error: null });
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ data: null, error: null })
});
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'test@example.com' }
          }
        }
      })
    },
    from: vi.fn((table) => {
      if (table === 'sesiones_historial' || table === 'sesiones_ejercicios') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 123 }, error: null })
            })
          })
        };
      }
      if (table === 'planes') {
        const chain: any = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.single = vi.fn().mockResolvedValue({ data: { id: 'test-plan-id', datos_plan: {} }, error: null });
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'test-plan-id', datos_plan: {} }, error: null });
        return {
          update: mockUpdate,
          ...chain
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) })
      };
    })
  }
}));

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn()
}));

describe('ActiveSession Component', () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockClear();
    mockInsert.mockClear();
    mockUpdate.mockClear();

    // Mock window alert
    global.window.alert = vi.fn();

    // Mock vibration API
    global.navigator.vibrate = vi.fn() as any;

    // Load mock plan in localStorage
    const mockPlan = {
      id: 'test-plan-id',
      periodizationConfig: { enabled: true },
      trainingDays: [
        {
          name: 'Día 1: Pecho',
          exercises: [
            {
              nombre: 'Press banco plano con barra',
              grupo_muscular: 'Pecho',
              variables: {
                'series de trabajo': '2',
                'repeticiones': '10',
                'peso': '60',
                'descanso': '180',
                'rir': '1-2'
              },
              video_url: 'https://example.com/video.mp4',
              image_url: 'https://example.com/image.png',
              description: 'Recuéstate en el banco con los pies apoyados...'
            }
          ]
        }
      ]
    };
    localStorage.setItem('pwa_client_plan', JSON.stringify(mockPlan));
  });

  it('should render active exercise details from the plan', () => {
    render(<ActiveSession />);

    // Check title and objective variables
    expect(screen.getByText('Press banco plano con barra')).toBeDefined();
    expect(screen.getByText(/pecho/i)).toBeDefined();
    expect(screen.getByText('2 series · 10 reps objetivo · RIR 1-2')).toBeDefined();

    // Check input ghost placeholders
    const weightInputs = screen.getAllByPlaceholderText('60');
    expect(weightInputs).toHaveLength(2);

    const repsInputs = screen.getAllByPlaceholderText('10');
    expect(repsInputs).toHaveLength(2);
  });

  it('should open and close the Execution Guide modal', () => {
    render(<ActiveSession />);

    // Open guide modal
    const guideBtn = screen.getByText('Guía Teórica');
    fireEvent.click(guideBtn);

    // Verify modal content
    expect(screen.getByText('Guía de Ejecución')).toBeDefined();
    expect(screen.getByText('Recuéstate en el banco con los pies apoyados...')).toBeDefined();

    // Close using the "Entendido" button
    const closeBtn = screen.getByText('Entendido');
    fireEvent.click(closeBtn);

    // Verify modal is closed (no longer in document or hidden)
    expect(screen.queryByText('Guía de Ejecución')).toBeNull();
  });

  it('should complete series, render feedback options, and submit session successfully', async () => {
    render(<ActiveSession />);

    // Complete series 1
    const checkBtn1 = screen.getByLabelText('Marcar serie 1 como completada');
    fireEvent.click(checkBtn1);

    // Verify timer starts (displays "Descanso: 2:59" or "3:00")
    expect(screen.getByText(/Descanso:/i)).toBeDefined();

    // Complete series 2
    const checkBtn2 = screen.getByLabelText('Marcar serie 2 como completada');
    fireEvent.click(checkBtn2);

    // Both series are done -> Feedback options (Estímulo & Recuperación) should appear
    expect(screen.getByText('¿Cómo fue este ejercicio?')).toBeDefined();
    expect(screen.getByText('Estímulo')).toBeDefined();
    expect(screen.getByText('Recuperación (Al llegar)')).toBeDefined();

    // Select feedback values
    const goodStimBtn = screen.getByText('💪 Bueno');
    fireEvent.click(goodStimBtn);

    const recoveredRecBtn = screen.getByText('✅ Llegué Recuperado');
    fireEvent.click(recoveredRecBtn);

    // Click "Finalizar sesión"
    const finalizeBtn = screen.getByText('✅ Finalizar sesión');
    await act(async () => {
      fireEvent.click(finalizeBtn);
    });

    // Verify redirect and cache write
    expect(mockNavigate).toHaveBeenCalledWith('/session/complete', expect.any(Object));
    expect(localStorage.getItem('sobrecarga_v5')).not.toBeNull();
  });
});
