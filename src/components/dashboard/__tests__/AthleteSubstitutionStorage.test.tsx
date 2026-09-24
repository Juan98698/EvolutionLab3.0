// @vitest-environment happy-dom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AthleteNutritionCard } from '../AthleteNutritionCard';
import { NutritionPlan } from '../../../types/nutrition.types';

let mockRemotePlan: any = null;

const mockSupabaseUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
  then: vi.fn().mockResolvedValue({ error: null }),
});

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: mockRemotePlan, error: null })),
      then: (resolve: any) => Promise.resolve({ data: mockRemotePlan, error: null }).then(resolve),
      update: (...args: any[]) => mockSupabaseUpdate(...args),
    })),
  },
}));

vi.mock('../../../context/SupabaseContext', () => ({
  useSupabase: () => ({
    user: { id: 'athlete-storage-id' },
    profile: {
      id: 'athlete-storage-id',
      nombre: 'Lorena Gamboa Hernandez',
      rol: 'cliente',
    },
  }),
}));

describe('Sustitución de Alimentos del Atleta con Persistencia Segura (Zero-Corruption)', () => {
  const todayIndex = new Date().getDay();
  const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const currentDayKey = dayNames[todayIndex];

  const createSamplePlan = (): NutritionPlan => ({
    id: 'plan-master-1',
    cliente_id: 'athlete-storage-id',
    entrenador_id: 'trainer-1',
    activo: true,
    modo: 'semanal',
    nombre: 'Plan Semanal de Competencia',
    target_calorias: 2200,
    target_proteina_g: 150,
    target_carbohidratos_g: 250,
    target_grasa_g: 65,
    datos_plan: {
      modo: 'semanal',
      days: {
        [currentDayKey]: {
          id: `day-${currentDayKey}`,
          diaSemana: currentDayKey as any,
          nombre: currentDayKey.toUpperCase(),
          meals: [
            {
              id: 'm-almuerzo-1',
              nombre: 'Almuerzo',
              horario: '13:00',
              orden: 1,
              foods: [
                {
                  id: 'food-chicken-orig',
                  foodId: 'chick-1',
                  nombre: 'Pechuga de pollo',
                  grupo: 'Carnes y Aves',
                  cantidad: 150,
                  cantidadBase: 100,
                  unidad: 'gr',
                  calorias: 160,
                  proteina: 33,
                  carbohidratos: 0,
                  grasa: 2.5,
                  completado: false,
                },
              ],
            },
          ],
        },
      },
      equivalencias: {
        'pechuga de pollo': [
          {
            foodId: 'tilapia-approved-1',
            nombre: 'Filete de Tilapia Blanca',
            grupo: 'Pescados y Mariscos',
            cantidad: 165,
            unidad: 'gr',
            calorias: 158,
            proteina: 33,
            carbohidratos: 0,
            grasa: 2.8,
            deltaCaloriasPct: -1,
            activo: true,
          },
        ],
      },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockRemotePlan = createSamplePlan();
  });

  afterEach(() => {
    cleanup();
  });

  it('permite al atleta sustituir por hoy: se persiste en localStorage y NO modifica datos_plan en Supabase', async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const expectedStorageKey = `athlete_nutrition_subs_athlete-storage-id_${todayStr}`;

    render(<AthleteNutritionCard clienteId="athlete-storage-id" defaultExpanded={true} />);

    // Esperar a que cargue el plan
    await waitFor(() => {
      expect(screen.getAllByText(/Pechuga de pollo/i).length).toBeGreaterThan(0);
    });

    // Abrir modal de sustitución con el botón "Sustituir"
    const substituteBtn = screen.getByRole('button', { name: /Sustituir/i });
    fireEvent.click(substituteBtn);

    // Debe abrirse el modal mostrando la Tilapia
    await waitFor(() => {
      expect(screen.getByText(/SUSTITUCIÓN DE ALIMENTO/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Filete de Tilapia Blanca/i).length).toBeGreaterThan(0);
    });

    // Presionar "Usar este reemplazo hoy"
    const applyBtn = screen.getByRole('button', { name: /Usar este reemplazo hoy/i });
    fireEvent.click(applyBtn);

    // 1. Debe guardarse en localStorage bajo la clave de la fecha actual
    await waitFor(() => {
      const stored = localStorage.getItem(expectedStorageKey);
      expect(stored).not.toBeNull();
      expect(stored).toContain('Filete de Tilapia Blanca');
    });

    // 2. En la interfaz se muestra el alimento sustituido
    await waitFor(() => {
      expect(screen.getAllByText(/Filete de Tilapia Blanca/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Sustituido hoy/i)).toBeInTheDocument();
    });

    // 3. CRÍTICO: Ningún llamado a Supabase update modificó datos_plan con esta sustitución
    expect(mockSupabaseUpdate).not.toHaveBeenCalled();
  });
});
