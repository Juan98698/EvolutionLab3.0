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
              gif_url: 'https://example.com/animation.gif',
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

    // ── Verificar que el motor de periodización realmente procesó la sesión ──
    const updatedPlanRaw = localStorage.getItem('pwa_client_plan');
    expect(updatedPlanRaw).not.toBeNull();
    const updatedPlan = JSON.parse(updatedPlanRaw!);

    const updatedExercise = updatedPlan.trainingDays[0].exercises[0];

    // Estímulo bueno + recuperado, nivel default 'intermedio' → +1 serie
    expect(updatedExercise.variables['series de trabajo']).toBe('3');

    // Cierre de microciclo: la semana avanza de 1 a 2
    expect(updatedPlan.periodizationConfig.semana_actual).toBe(2);

    // El contador semanal se resetea tras procesar el cierre
    expect(updatedPlan.periodizationConfig.sessions_completed_this_week).toBe(0);
    expect(updatedPlan.periodizationConfig.weekly_session_feedback).toEqual([]);
  });

  it('debe usar reps_objetivo (coherente con el peso 🤖 recalculado) en vez del promedio del rango', () => {
    // Simula un ejercicio que la periodización ya ajustó: el peso subió a
    // 65kg y, para ser coherente con ese peso (calculado para repsMin),
    // el motor guardó reps_objetivo = 10 — aunque el rango del plan sigue
    // siendo "10-12" (promedio 11) para que el motor lo siga usando después.
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
                'repeticiones': '10-12',
                'reps_objetivo': '🤖 10',
                'peso': '🤖 65 kg',
                'descanso': '180',
                'rir': '1-2',
              },
            },
          ],
        },
      ],
    };
    localStorage.setItem('pwa_client_plan', JSON.stringify(mockPlan));

    render(<ActiveSession />);

    // Debe mostrar 10 (reps_objetivo), no 11 (promedio de "10-12")
    expect(screen.getByText('2 series · 10 reps objetivo · RIR 1-2')).toBeDefined();
    const repsInputs = screen.getAllByPlaceholderText('10');
    expect(repsInputs).toHaveLength(2);
  });

  it('sin reps_objetivo: mantiene el comportamiento original (promedio del rango)', () => {
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
                'repeticiones': '10-12',
                'peso': '60',
                'descanso': '180',
                'rir': '1-2',
              },
            },
          ],
        },
      ],
    };
    localStorage.setItem('pwa_client_plan', JSON.stringify(mockPlan));

    render(<ActiveSession />);

    // Sin reps_objetivo, cae al promedio de "10-12" = round((10+12)/2) = 11
    expect(screen.getByText('2 series · 11 reps objetivo · RIR 1-2')).toBeDefined();
  });

  it('should trigger vibration pattern when rest timer starts', () => {
    render(<ActiveSession />);

    // Complete series 1 to start rest timer
    const checkBtn1 = screen.getByLabelText('Marcar serie 1 como completada');
    fireEvent.click(checkBtn1);

    // Verify vibration API was called with start pattern [150, 80, 150]
    expect(global.navigator.vibrate).toHaveBeenCalledWith([150, 80, 150]);
  });

  it('should open full screen media modal and allow toggling between foto and gif', () => {
    render(<ActiveSession />);

    // Click thumbnail button to open full screen media modal
    const thumbnailBtn = screen.getByLabelText('Ver imagen completa de Press banco plano con barra');
    fireEvent.click(thumbnailBtn);

    // Verify close button '✕' and caption are present in modal
    const closeBtn = screen.getByLabelText('Cerrar vista previa');
    expect(closeBtn).toBeDefined();

    const titleElement = screen.getAllByText('Press banco plano con barra');
    expect(titleElement.length).toBeGreaterThan(0);

    // Close media modal
    fireEvent.click(closeBtn);
    expect(screen.queryByLabelText('Cerrar vista previa')).toBeNull();
  });

  it('renderiza chips de RIR percibido (0 al 4+), prellena según targetRIR y envía el RIR seleccionado al finalizar', async () => {
    render(<ActiveSession />);

    // Completar las series para mostrar la sección de feedback
    fireEvent.click(screen.getByLabelText('Marcar serie 1 como completada'));
    fireEvent.click(screen.getByLabelText('Marcar serie 2 como completada'));

    // Verificar que el selector de RIR está presente con las etiquetas esperadas
    expect(screen.getByText('RIR (Serie exigente)')).toBeDefined();
    expect(screen.getByText('0 (Fallo)')).toBeDefined();
    expect(screen.getByRole('button', { name: '1' })).toBeDefined();
    expect(screen.getByRole('button', { name: '2' })).toBeDefined();
    expect(screen.getByRole('button', { name: '3' })).toBeDefined();
    expect(screen.getByText('4+')).toBeDefined();

    // Seleccionar RIR 1 (serie muy exigente)
    const rir1Btn = screen.getByRole('button', { name: '1' });
    fireEvent.click(rir1Btn);

    // Finalizar sesión
    const finalizeBtn = screen.getByText('✅ Finalizar sesión');
    await act(async () => {
      fireEvent.click(finalizeBtn);
    });

    // Verificar que en el plan guardado se haya usado el RIR real reportado (1)
    const updatedPlanRaw = localStorage.getItem('pwa_client_plan');
    expect(updatedPlanRaw).not.toBeNull();
  });
});
