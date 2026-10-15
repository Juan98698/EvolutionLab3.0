// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import ActiveSession from '../ActiveSession';
import { computeBlockTags } from '../../../lib/exerciseBlockUtils';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ dayIndex: '0' }),
  useNavigate: () => mockNavigate,
}));

// Mock Supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'atleta@example.com' }
          }
        }
      })
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 123 }, error: null })
        })
      })
    }))
  }
}));

describe('Preconfigured Superset Flow in ActiveSession', () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockClear();

    global.window.alert = vi.fn();
    global.navigator.vibrate = vi.fn() as any;

    // Rutina idéntica a la del entrenador reportada por el usuario:
    // A1: Jalón al pecho polea (3 series, 12 reps, descanso individual 60s, block_rest 90s, transition_rest 10s)
    // A2: Extensión de codo (3 series, 12 reps, descanso individual 60s, block_rest 90s, transition_rest 10s)
    const mockPlanWithSuperset = {
      id: 'plan-superset-coach',
      trainingDays: [
        {
          id: 'day-1',
          name: 'Día 1: Espalda y Tríceps',
          exercises: [
            {
              id: 'ex-jalon',
              nombre: 'Jalon al pecho polea',
              grupo_muscular: 'Espalda',
              block_id: 'block_superset_espalda_triceps',
              block_rest: 90,
              transition_rest: 10,
              variables: {
                'series de trabajo': '3',
                'repeticiones': '12',
                'peso': '30',
                'descanso': '60',
                'rir': '1'
              }
            },
            {
              id: 'ex-extension',
              nombre: 'Extension de codo con polea',
              grupo_muscular: 'Tríceps',
              block_id: 'block_superset_espalda_triceps',
              block_rest: 90,
              transition_rest: 10,
              variables: {
                'series de trabajo': '3',
                'repeticiones': '12',
                'peso': '20',
                'descanso': '60',
                'rir': '1'
              }
            },
            {
              id: 'ex-remo',
              nombre: 'Remo Gironda',
              grupo_muscular: 'Espalda',
              variables: {
                'series de trabajo': '3',
                'repeticiones': '10',
                'peso': '45',
                'descanso': '90',
                'rir': '2'
              }
            }
          ]
        }
      ]
    };

    localStorage.setItem('pwa_client_plan', JSON.stringify(mockPlanWithSuperset));
  });

  it('calcula correctamente las etiquetas A1 y A2 a partir del block_id programado por el entrenador', () => {
    const raw = JSON.parse(localStorage.getItem('pwa_client_plan')!);
    const tags = computeBlockTags(raw.trainingDays[0].exercises);

    expect(tags['ex-jalon']).toBe('A1');
    expect(tags['ex-extension']).toBe('A2');
    expect(tags['ex-remo']).toBeUndefined(); // Serie estándar sin bloque
  });

  it('al cargar en ActiveSession, activa automáticamente el modo Súper Serie y muestra el badge A1', async () => {
    render(<ActiveSession />);

    // El badge A1 debe estar visible arriba del nombre del ejercicio
    await waitFor(() => {
      expect(screen.getByText('⚡ A1')).toBeInTheDocument();
    });

    // El nombre del primer ejercicio es Jalón al pecho polea
    expect(screen.getByText('Jalon al pecho polea')).toBeInTheDocument();

    // El botón superior muestra que la Súper Serie ya está ACTIVA (sin necesidad de tocar nada manualmente)
    expect(screen.getByText(/Súper Serie Activa/i)).toBeInTheDocument();
  });

  it('al completar la serie 1 de A1, transiciona automáticamente a A2 e inicia la transición rápida de 10s', async () => {
    render(<ActiveSession />);

    await waitFor(() => {
      expect(screen.getByText('Jalon al pecho polea')).toBeInTheDocument();
    });

    // Marcar la serie 1 de Jalón al pecho como completada
    const checkBtn1 = screen.getByRole('button', { name: /Marcar serie 1 como completada/i });
    fireEvent.click(checkBtn1);

    // Debe mostrar la transición rápida ('🔄 Cambia ahora') y el tiempo de transición (10s), no el descanso total (60s)
    await waitFor(() => {
      expect(screen.getByText(/Cambia ahora/i)).toBeInTheDocument();
      expect(screen.getByText(/0:10/i)).toBeInTheDocument();
    });

    // La pantalla debe haber cambiado automáticamente al segundo ejercicio (A2: Extension de codo con polea)
    expect(screen.getByText('Extension de codo con polea')).toBeInTheDocument();
    expect(screen.getByText('⚡ A2')).toBeInTheDocument();
  });

  it('al completar la serie 1 de A2, transiciona de vuelta a A1 con el descanso de ronda de 90s', async () => {
    render(<ActiveSession />);

    await waitFor(() => {
      expect(screen.getByText('Jalon al pecho polea')).toBeInTheDocument();
    });

    // 1. Completar serie 1 de A1 -> pasa a A2
    const checkA1_set1 = screen.getByRole('button', { name: /Marcar serie 1 como completada/i });
    fireEvent.click(checkA1_set1);

    await waitFor(() => {
      expect(screen.getByText('Extension de codo con polea')).toBeInTheDocument();
    });

    // 2. Completar serie 1 de A2 -> termina la ronda 1
    const checkA2_set1 = screen.getByRole('button', { name: /Marcar serie 1 como completada/i });
    fireEvent.click(checkA2_set1);

    // Debe activarse el temporizador de 'Descanso de ronda' con los 90 segundos configurados en el bloque
    await waitFor(() => {
      expect(screen.getByText(/Descanso de ronda/i)).toBeInTheDocument();
      expect(screen.getByText(/1:30/i)).toBeInTheDocument();
    });

    // Y el puntero debe regresar automáticamente a A1 (Jalon al pecho polea) para ejecutar la Serie 2
    expect(screen.getByText('Jalon al pecho polea')).toBeInTheDocument();
    expect(screen.getByText('⚡ A1')).toBeInTheDocument();
  });
});
