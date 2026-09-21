// @vitest-environment happy-dom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NutritionPlannerModal } from '../NutritionPlannerModal';
import { FoodSelectorModal } from '../FoodSelectorModal';
import { CopyDayModal } from '../CopyDayModal';
import { Profile, ValoracionAntropometrica } from '../../../types/database.types';

// Mock catalog data for testing using vi.hoisted
const { mockSampleCatalog, mockCustomFoods } = vi.hoisted(() => ({
  mockSampleCatalog: [
    {
      id: 'food-pollo-1',
      nombre: 'Pechuga de Pollo a la Plancha',
      grupo: 'Carnes y Derivados' as const,
      subgrupo: 'Aves',
      cantidadBase: 100,
      unidad: 'gr',
      caloriasBase: 165,
      proteinaBase: 31,
      carbohidratosBase: 0,
      grasaBase: 3.6,
      fuente: 'oficial' as const,
    },
    {
      id: 'food-arroz-1',
      nombre: 'Arroz Blanco Cocido',
      grupo: 'Cereales y Derivados' as const,
      subgrupo: 'Arroz',
      cantidadBase: 100,
      unidad: 'gr',
      caloriasBase: 130,
      proteinaBase: 2.7,
      carbohidratosBase: 28.2,
      grasaBase: 0.3,
      fuente: 'oficial' as const,
    },
    {
      id: 'food-aceite-1',
      nombre: 'Aceite de Oliva Extra Virgen',
      grupo: 'Grasas y Aceites' as const,
      cantidadBase: 14,
      unidad: 'ml',
      caloriasBase: 119,
      proteinaBase: 0,
      carbohidratosBase: 0,
      grasaBase: 13.5,
      fuente: 'oficial' as const,
    },
  ],
  mockCustomFoods: [
    {
      id: 'custom-1',
      nombre: 'Batido Proteico Casero',
      grupo: 'Mis Alimentos' as const,
      cantidadBase: 250,
      unidad: 'ml',
      caloriasBase: 280,
      proteinaBase: 35,
      carbohidratosBase: 20,
      grasaBase: 5,
      fuente: 'personalizado' as const,
      esPersonalizado: true,
    },
  ],
}));

// Mock food catalog dynamic import
vi.mock('../../../data/foodCatalog', () => ({
  BASE_FOOD_CATALOG: mockSampleCatalog,
}));

// Mock nutritionEngine functions
vi.mock('../../../lib/nutritionEngine', async () => {
  const actual: any = await vi.importActual('../../../lib/nutritionEngine');
  return {
    ...actual,
    getCustomFoods: vi.fn().mockResolvedValue(mockCustomFoods),
    saveCustomFood: vi.fn().mockImplementation(async (food: any) => ({
      ...food,
      id: 'custom-new-id',
      esPersonalizado: true,
    })),
    deleteCustomFood: vi.fn().mockResolvedValue(true),
    searchOpenFoodFacts: vi.fn().mockResolvedValue([
      {
        id: 'off-1',
        nombre: 'Yogurt Griego Natural Colanta',
        grupo: 'Lácteos y Derivados',
        marca: 'Colanta',
        cantidadBase: 100,
        unidad: 'gr',
        caloriasBase: 80,
        proteinaBase: 10,
        carbohidratosBase: 4,
        grasaBase: 2.5,
        fuente: 'openfoodfacts',
      },
    ]),
  };
});

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
    obj.single = vi.fn().mockImplementation(() => Promise.resolve({ data: { id: 'plan-test-id' }, error: null }));
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

// Mock html2canvas & jspdf
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
  peso: 68,
  estatura: 172,
  edad: 26,
  metodo: 'Yuhasz',
  genero: 'femenino',
  bmr: 1500,
  tdee: 2000,
  target_calorias: 2300,
  ajuste_calorico_pct: 15,
  macros: {
    proteina: { gPerKg: 2.0, grams: 136, calories: 544, percentage: 23.7 },
    carbohidratos: { gPerKg: 4.0, grams: 272, calories: 1088, percentage: 47.3 },
    grasa: { gPerKg: 1.0, grams: 68, calories: 612, percentage: 26.6 },
  },
};

describe('Nutrition Planner & Food Selector Mobile Responsiveness Test Suite', () => {
  beforeEach(() => {
    mockSupabaseData.remotePlan = null;
    for (const key in mockIdb) delete mockIdb[key];
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('NutritionPlannerModal Responsive Structure', () => {
    it('renders with all required mobile-responsive layout CSS classes', () => {
      const { container } = render(
        <NutritionPlannerModal
          isOpen={true}
          onClose={vi.fn()}
          atleta={mockAthlete}
          initialValuation={mockValuation}
          trainerProfile={mockTrainer}
        />
      );

      // Modal window backdrop & container
      expect(container.querySelector('.nutrition-modal-backdrop')).toBeInTheDocument();
      expect(container.querySelector('.nutrition-modal-window')).toBeInTheDocument();

      // Responsive header components
      expect(container.querySelector('.nutrition-header-top')).toBeInTheDocument();
      expect(container.querySelector('.nutrition-header-top-row1')).toBeInTheDocument();
      expect(container.querySelector('.nutrition-header-actions')).toBeInTheDocument();
      expect(container.querySelectorAll('.nutrition-header-action-btn').length).toBeGreaterThan(0);

      // Macro monitor responsive grid & calories top-level column
      expect(container.querySelector('.nutrition-macro-grid')).toBeInTheDocument();
      expect(container.querySelector('.nutrition-macro-calorias-col')).toBeInTheDocument();

      // Days horizontal scroll bar
      expect(container.querySelector('.nutrition-days-bar')).toBeInTheDocument();
      expect(container.querySelector('.nutrition-days-scroll')).toBeInTheDocument();
      expect(container.querySelector('.nutrition-copy-day-btn')).toBeInTheDocument();

      // Meal card headers
      expect(container.querySelectorAll('.nutrition-meal-header').length).toBeGreaterThan(0);
      expect(container.querySelectorAll('.nutrition-meal-header-row1').length).toBeGreaterThan(0);
      expect(container.querySelectorAll('.nutrition-meal-header-row2').length).toBeGreaterThan(0);

      // Sticky responsive footer
      expect(container.querySelector('.nutrition-footer-bar')).toBeInTheDocument();
      expect(container.querySelector('.nutrition-footer-actions')).toBeInTheDocument();
      expect(container.querySelector('.nutrition-footer-btn-save')).toBeInTheDocument();
      expect(container.querySelector('.nutrition-footer-btn-pdf')).toBeInTheDocument();
    });

    it('renders food items inside meals with 2-tier responsive classes (top & bottom)', async () => {
      const initialPlan = {
        cliente_id: mockAthlete.id,
        nombre: 'Plan Test',
        activo: true,
        modo: 'semanal' as const,
        target_calorias: 2300,
        target_proteina_g: 136,
        target_carbohidratos_g: 272,
        target_grasa_g: 68,
        datos_plan: {
          modo: 'semanal' as const,
          days: {
            lunes: {
              id: 'd1',
              diaSemana: 'lunes' as const,
              nombre: 'Lunes',
              meals: [
                {
                  id: 'm1',
                  nombre: 'Desayuno',
                  horario: '08:00',
                  foods: [
                    {
                      id: 'f1',
                      nombre: 'Avena con Proteína y Almendras',
                      grupo: 'Cereales y Derivados' as const,
                      cantidad: 120,
                      cantidadBase: 100,
                      unidad: 'gr',
                      calorias: 450,
                      proteina: 32,
                      carbohidratos: 55,
                      grasa: 11,
                    },
                  ],
                },
              ],
            },
          },
        },
      };

      mockSupabaseData.remotePlan = initialPlan;

      const { container } = render(
        <NutritionPlannerModal
          isOpen={true}
          onClose={vi.fn()}
          atleta={mockAthlete}
          initialValuation={mockValuation}
          trainerProfile={mockTrainer}
        />
      );

      // Food item container and its 2-tier mobile rows
      await waitFor(() => {
        expect(container.querySelector('.nutrition-food-item-row')).toBeInTheDocument();
      });

      const foodItemRow = container.querySelector('.nutrition-food-item-row');
      const rowTop = foodItemRow?.querySelector('.nutrition-food-row-top');
      expect(rowTop).toBeInTheDocument();
      expect(rowTop).toHaveTextContent('Avena con Proteína y Almendras');

      const rowBottom = foodItemRow?.querySelector('.nutrition-food-row-bottom');
      expect(rowBottom).toBeInTheDocument();
      expect(rowBottom).toHaveTextContent('450 kcal');
      expect(rowBottom).toHaveTextContent('P: 32g');
    });
  });

  describe('FoodSelectorModal Responsive Layout & Interactions', () => {
    it('renders with mobile-responsive modal window, compact tabs, and search bar', async () => {
      const onAddFood = vi.fn();
      const onClose = vi.fn();

      const { container } = render(
        <FoodSelectorModal
          isOpen={true}
          onClose={onClose}
          mealName="Almuerzo"
          onAddFood={onAddFood}
        />
      );

      // Container & Modal window
      expect(container.querySelector('.nutrition-modal-backdrop')).toBeInTheDocument();
      expect(container.querySelector('.food-selector-modal-window')).toBeInTheDocument();

      // Mobile source tab labels
      expect(screen.getByRole('button', { name: /Catálogo/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Supermercado/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Crear/i })).toBeInTheDocument();

      // Responsive search row & category selector
      expect(container.querySelector('.food-selector-search-row')).toBeInTheDocument();
      expect(container.querySelector('.food-selector-search-select')).toBeInTheDocument();
    });

    it('populates available categories including 46 groups + "Mis Alimentos" + "Todos"', async () => {
      render(
        <FoodSelectorModal
          isOpen={true}
          onClose={vi.fn()}
          mealName="Almuerzo"
          onAddFood={vi.fn()}
        />
      );

      // Wait for catalog and custom foods to load
      await waitFor(() => {
        expect(screen.getByText(/Pechuga de Pollo a la Plancha/i)).toBeInTheDocument();
      });

      // Category select dropdown should contain Todos and custom foods
      const categorySelect = screen.getByTitle(/Filtrar por categoría o grupo de alimentos/i) as HTMLSelectElement;
      expect(categorySelect).toBeInTheDocument();

      const optionValues = Array.from(categorySelect.options).map((opt) => opt.value);
      expect(optionValues).toContain('Todos');
      expect(optionValues).toContain('Mis Alimentos');
      expect(optionValues).toContain('Aves');
      expect(optionValues).toContain('Arroz');
      expect(optionValues).toContain('Grasas y Aceites');
    });

    it('filters catalog items when selecting a specific category or "Mis Alimentos"', async () => {
      render(
        <FoodSelectorModal
          isOpen={true}
          onClose={vi.fn()}
          mealName="Almuerzo"
          onAddFood={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Pechuga de Pollo a la Plancha/i)).toBeInTheDocument();
      });

      const categorySelect = screen.getByTitle(/Filtrar por categoría o grupo de alimentos/i);

      // Filter by "Mis Alimentos"
      fireEvent.change(categorySelect, { target: { value: 'Mis Alimentos' } });

      await waitFor(() => {
        expect(screen.getByText(/Batido Proteico Casero/i)).toBeInTheDocument();
        expect(screen.queryByText(/Pechuga de Pollo a la Plancha/i)).not.toBeInTheDocument();
      });

      // Filter by "Aves"
      fireEvent.change(categorySelect, { target: { value: 'Aves' } });

      await waitFor(() => {
        expect(screen.getByText(/Pechuga de Pollo a la Plancha/i)).toBeInTheDocument();
        expect(screen.queryByText(/Arroz Blanco Cocido/i)).not.toBeInTheDocument();
      });
    });

    it('renders food items using responsive card classes, reveals bottom action bar on selection, and adds food to meal', async () => {
      const onAddFood = vi.fn();
      const onClose = vi.fn();

      const { container } = render(
        <FoodSelectorModal
          isOpen={true}
          onClose={onClose}
          mealName="Almuerzo"
          onAddFood={onAddFood}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Pechuga de Pollo a la Plancha/i)).toBeInTheDocument();
      });

      // Item cards must use responsive layout classes
      const itemCard = container.querySelector('.food-selector-item-card');
      expect(itemCard).toBeInTheDocument();
      expect(itemCard?.querySelector('.food-selector-card-top')).toBeInTheDocument();
      expect(itemCard?.querySelector('.food-selector-card-bottom')).toBeInTheDocument();

      // Click to select food
      fireEvent.click(screen.getByText(/Pechuga de Pollo a la Plancha/i));

      // Bottom bar must appear with responsive classes
      await waitFor(() => {
        expect(container.querySelector('.food-selector-bottom-bar')).toBeInTheDocument();
        expect(container.querySelector('.food-selector-bottom-btn')).toBeInTheDocument();
      });

      // Adjust portion
      const portionInput = screen.getByRole('spinbutton');
      fireEvent.change(portionInput, { target: { value: '200' } });

      // Click "+ AGREGAR A ALMUERZO"
      const addBtn = container.querySelector('.food-selector-bottom-btn') as HTMLButtonElement;
      expect(addBtn).toBeInTheDocument();
      fireEvent.click(addBtn);

      expect(onAddFood).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Pechuga de Pollo a la Plancha',
          cantidad: 200,
          calorias: 330, // 165 * 2
          proteina: 62, // 31 * 2
        })
      );
      expect(onClose).toHaveBeenCalled();
    });

    it('supports Open Food Facts supermarket search and renders responsive result cards', async () => {
      const { container } = render(
        <FoodSelectorModal
          isOpen={true}
          onClose={vi.fn()}
          mealName="Desayuno"
          onAddFood={vi.fn()}
        />
      );

      // Switch to Supermercado tab
      const supermarketTab = screen.getByRole('button', { name: /Supermercado/i });
      fireEvent.click(supermarketTab);

      const offInput = screen.getByPlaceholderText(/Escribe el nombre de la marca o producto/i);
      fireEvent.change(offInput, { target: { value: 'Colanta' } });

      const searchBtn = screen.getByRole('button', { name: /Buscar/i });
      fireEvent.click(searchBtn);

      await waitFor(() => {
        expect(screen.getByText(/Yogurt Griego Natural Colanta/i)).toBeInTheDocument();
      });

      // Open Food card should also have responsive card top and bottom classes
      const offCard = container.querySelector('.food-selector-item-card');
      expect(offCard).toBeInTheDocument();
      expect(offCard?.querySelector('.food-selector-card-top')).toBeInTheDocument();
      expect(offCard?.querySelector('.food-selector-card-bottom')).toBeInTheDocument();
    });
  });

  describe('CopyDayModal Responsive Optimization', () => {
    it('renders with responsive viewport constraints and handles day copy selection', () => {
      const onConfirmCopy = vi.fn();
      const onClose = vi.fn();

      render(
        <CopyDayModal
          isOpen={true}
          onClose={onClose}
          sourceDayKey="lunes"
          sourceDayLabel="Lunes"
          onConfirmCopy={onConfirmCopy}
        />
      );

      expect(screen.getByText(/COPIAR DÍA/i)).toBeInTheDocument();
      expect(screen.getByText(/Seleccionar Todos/i)).toBeInTheDocument();

      // Click "Seleccionar Todos"
      fireEvent.click(screen.getByText(/Seleccionar Todos/i));

      // Click "COPIAR A 6 DÍA(S)"
      const copyBtn = screen.getByText(/COPIAR A 6 DÍA\(S\)/i);
      fireEvent.click(copyBtn);

      expect(onConfirmCopy).toHaveBeenCalledWith(
        expect.arrayContaining(['martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'])
      );
      expect(onClose).toHaveBeenCalled();
    });
  });
});
