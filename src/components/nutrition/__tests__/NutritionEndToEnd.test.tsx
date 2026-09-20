// @vitest-environment happy-dom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NutritionPlannerModal } from '../NutritionPlannerModal';
import { AthleteNutritionCard } from '../../dashboard/AthleteNutritionCard';
import AnthropometryModal from '../../trainer/modals/AnthropometryModal';
import { Profile, ValoracionAntropometrica } from '../../../types/database.types';
import { NutritionPlan, NutritionDay, Meal, FoodGroup } from '../../../types/nutrition.types';

// Mock Supabase
let currentTable = '';
const mockSupabaseData: { remotePlan: any; remoteValuation: any } = {
  remotePlan: null,
  remoteValuation: null,
};

vi.mock('../../../lib/supabaseClient', () => {
  const mockQuery = () => {
    const obj: any = {};
    obj.select = vi.fn().mockReturnValue(obj);
    obj.eq = vi.fn().mockReturnValue(obj);
    obj.order = vi.fn().mockReturnValue(obj);
    obj.limit = vi.fn().mockReturnValue(obj);
    obj.insert = vi.fn().mockReturnValue(obj);
    obj.update = vi.fn().mockReturnValue(obj);
    obj.single = vi.fn().mockImplementation(() => Promise.resolve({ data: { id: 'plan-new-id' }, error: null }));
    obj.maybeSingle = vi.fn().mockImplementation(() => {
      const data = currentTable === 'valoraciones_antropometricas' ? mockSupabaseData.remoteValuation : mockSupabaseData.remotePlan;
      return Promise.resolve({ data, error: null });
    });
    obj.upsert = vi.fn().mockImplementation((plan: any) => {
      mockSupabaseData.remotePlan = plan;
      return Promise.resolve({ error: null });
    });
    obj.then = (resolve: any) => Promise.resolve({ data: mockSupabaseData.remotePlan, error: null }).then(resolve);
    return obj;
  };

  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'trainer-uuid' } } }),
      },
      from: vi.fn((table: string) => {
        currentTable = table;
        return mockQuery();
      }),
    },
  };
});

// Mock SupabaseContext
vi.mock('../../../context/SupabaseContext', () => ({
  useSupabase: () => ({
    user: { id: 'athlete-123' },
    profile: {
      id: 'athlete-123',
      email: 'atleta@test.com',
      nombre: 'Camila Rodriguez',
      rol: 'cliente',
    },
  }),
}));

// Mock html2canvas y jspdf
vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mockpdfdata'),
    height: 1000,
    width: 800,
  }),
}));

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 210 } },
    addImage: vi.fn(),
    save: vi.fn(),
  })),
}));

// Mock IndexedDbStore
const mockIdb: Record<string, any> = {};
vi.mock('../../../lib/indexedDbStore', () => ({
  idbSet: vi.fn(async (key: string, value: any) => {
    mockIdb[key] = value;
  }),
  idbGet: vi.fn(async (key: string) => {
    return mockIdb[key] || null;
  }),
}));

const mockAthlete: Profile = {
  id: 'athlete-123',
  email: 'atleta@test.com',
  nombre: 'Camila Rodriguez',
  rol: 'cliente',
  modalidad: 'remoto',
  objetivo: 'Ganancia Muscular',
};

const mockTrainer: Profile = {
  id: 'trainer-uuid',
  email: 'coach@test.com',
  nombre: 'Coach Carlos',
  rol: 'entrenador',
};

const mockValuation: ValoracionAntropometrica = {
  id: 'val-1',
  cliente_id: 'athlete-123',
  entrenador_id: 'trainer-uuid',
  fecha: '2026-09-20',
  peso: 70,
  estatura: 175,
  edad: 26,
  metodo: 'Yuhasz',
  genero: 'femenino',
  bmr: 1550,
  tdee: 2100,
  target_calorias: 2400,
  ajuste_calorico_pct: 14.3,
  macros: {
    proteina: { gPerKg: 2.0, grams: 140, calories: 560, percentage: 23.3 },
    carbohidratos: { gPerKg: 4.0, grams: 280, calories: 1120, percentage: 46.7 },
    grasa: { gPerKg: 1.1, grams: 80, calories: 720, percentage: 30.0 },
  },
};

describe('Nutrition & Diet Planning End-to-End Suite', () => {
  beforeEach(() => {
    mockSupabaseData.remotePlan = null;
    for (const key in mockIdb) delete mockIdb[key];
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders NutritionPlannerModal and inherits target calories & macros from anthropometry valuation', async () => {
    const showToast = vi.fn();
    render(
      <NutritionPlannerModal
        isOpen={true}
        onClose={vi.fn()}
        atleta={mockAthlete}
        initialValuation={mockValuation}
        trainerProfile={mockTrainer}
        showToast={showToast}
      />
    );

    // Should display athlete name in header
    expect(screen.getAllByText(/Camila Rodriguez/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/NUTRICIÓN & DIETAS/i)).toBeInTheDocument();

    // Should display target calories & protein inherited from valuation
    expect(screen.getAllByText(/2400/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/140/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/280/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/80/i).length).toBeGreaterThan(0);
  });

  it('autonomously queries valoraciones_antropometricas by fecha and populates macros when initialValuation is undefined', async () => {
    mockSupabaseData.remoteValuation = mockValuation;

    render(
      <NutritionPlannerModal
        isOpen={true}
        onClose={vi.fn()}
        atleta={mockAthlete}
        initialValuation={null}
        trainerProfile={mockTrainer}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText(/2400/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/140/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/280/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/80/i).length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/Valoración Antropométrica \(2026-09-20\)/i)).toBeInTheDocument();
  });

  it('allows agile meal operations: adding Pre-Entreno meal, editing time, and deleting a meal', async () => {
    const showToast = vi.fn();
    render(
      <NutritionPlannerModal
        isOpen={true}
        onClose={vi.fn()}
        atleta={mockAthlete}
        initialValuation={mockValuation}
        trainerProfile={mockTrainer}
        showToast={showToast}
      />
    );

    // 1. Añadir comida rápida Pre-Entreno
    const addPreEntrenoBtn = screen.getByText(/\+ Pre-Entreno/i);
    fireEvent.click(addPreEntrenoBtn);

    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('Pre-Entreno'),
      'success'
    );

    // Debe existir un input con el nombre "Pre-Entreno"
    const preEntrenoInputs = screen.getAllByDisplayValue('Pre-Entreno');
    expect(preEntrenoInputs.length).toBeGreaterThan(0);

    // 2. Modificar horario de una comida
    const timeInputs = screen.getAllByTitle(/Modificar horario de la comida/i);
    expect(timeInputs.length).toBeGreaterThan(0);

    // 3. Eliminar una comida
    const deleteButtons = screen.getAllByTitle(/Eliminar comida/i);
    expect(deleteButtons.length).toBeGreaterThan(0);
    fireEvent.click(deleteButtons[0]);

    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('eliminada'),
      'info'
    );
  });

  it('allows day navigation and viewing meal blocks in NutritionPlannerModal', async () => {
    render(
      <NutritionPlannerModal
        isOpen={true}
        onClose={vi.fn()}
        atleta={mockAthlete}
        initialValuation={mockValuation}
        trainerProfile={mockTrainer}
      />
    );

    expect(screen.getByText(/LUNES/i)).toBeInTheDocument();
    expect(screen.getByText(/MARTES/i)).toBeInTheDocument();

    const martesBtn = screen.getByText(/MARTES/i);
    fireEvent.click(martesBtn);

    // Default meals (Desayuno, Almuerzo, etc.) each have an add food button
    expect(screen.getAllByText(/Agregar Alimento/i).length).toBeGreaterThan(0);
  });

  it('allows saving plan to Supabase and IndexedDB', async () => {
    const showToast = vi.fn();
    render(
      <NutritionPlannerModal
        isOpen={true}
        onClose={vi.fn()}
        atleta={mockAthlete}
        initialValuation={mockValuation}
        trainerProfile={mockTrainer}
        showToast={showToast}
      />
    );

    const saveButton = screen.getByText(/GUARDAR PLAN/i);
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('guardado exitosamente'),
        'success'
      );
    });

    const { idbSet } = await import('../../../lib/indexedDbStore');
    expect(idbSet).toHaveBeenCalled();
  });

  it('renders AnthropometryModal with "DISEÑAR PLAN CON ESTOS MACROS" button and triggers callback', async () => {
    const onOpenNutritionPlan = vi.fn();

    render(
      <AnthropometryModal
        isOpen={true}
        onClose={vi.fn()}
        atleta={mockAthlete}
        trainerProfile={mockTrainer}
        showToast={vi.fn()}
        onOpenNutritionPlan={onOpenNutritionPlan}
      />
    );

    const planButton = screen.getByText(/DISEÑAR PLAN CON ESTOS MACROS/i);
    expect(planButton).toBeInTheDocument();

    fireEvent.click(planButton);

    expect(onOpenNutritionPlan).toHaveBeenCalledWith(
      mockAthlete,
      expect.objectContaining({
        peso: expect.any(Number),
      })
    );
  });

  it('AthleteNutritionCard renders and allows athlete to toggle meal item completion', async () => {
    const defaultMeal: Meal = {
      id: 'meal-1',
      nombre: 'Desayuno Proteico',
      horario: '08:00',
      orden: 1,
      foods: [
        {
          id: 'item-1',
          foodId: 'avena-hojuelas',
          nombre: 'Avena en hojuelas',
          grupo: 'Cereales y Tubérculos' as FoodGroup,
          cantidad: 80,
          cantidadBase: 100,
          unidad: 'g',
          proteina: 10.4,
          carbohidratos: 53.6,
          grasa: 5.6,
          calorias: 304,
          completado: false,
        },
      ],
    };

    const buildDay = (key: any, label: string): NutritionDay => ({
      id: `day-${key}`,
      diaSemana: key,
      nombre: label,
      meals: [defaultMeal],
    });

    const planWithFood: NutritionPlan = {
      id: 'plan-xyz',
      cliente_id: 'athlete-123',
      entrenador_id: 'trainer-uuid',
      activo: true,
      modo: 'semanal',
      nombre: 'Plan Ganancia Muscular',
      objetivo: 'Ganancia Muscular',
      target_calorias: 2400,
      target_proteina_g: 140,
      target_carbohidratos_g: 280,
      target_grasa_g: 80,
      ajuste_calorico_pct: 10,
      datos_plan: {
        modo: 'semanal',
        vigenciaDias: 30,
        days: {
          lunes: buildDay('lunes', 'Lunes'),
          martes: buildDay('martes', 'Martes'),
          miercoles: buildDay('miercoles', 'Miércoles'),
          jueves: buildDay('jueves', 'Jueves'),
          viernes: buildDay('viernes', 'Viernes'),
          sabado: buildDay('sabado', 'Sábado'),
          domingo: buildDay('domingo', 'Domingo'),
        },
      },
    };

    mockSupabaseData.remotePlan = planWithFood;

    render(<AthleteNutritionCard clienteId="athlete-123" />);

    await waitFor(() => {
      expect(screen.getByText(/MI DIETA/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Plan Ganancia Muscular/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Avena en hojuelas/i).length).toBeGreaterThan(0);
    });

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes.length).toBeGreaterThan(0);
    const checkbox = checkboxes[0];
    expect(checkbox.checked).toBe(false);

    // Click the row containing the food item
    const foodItemElement = screen.getAllByText(/Avena en hojuelas/i)[0];
    fireEvent.click(foodItemElement);

    await waitFor(() => {
      expect(checkbox.checked).toBe(true);
    });
  });
});
