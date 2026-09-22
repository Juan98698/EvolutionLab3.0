// @vitest-environment happy-dom
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FoodSelectorModal } from '../FoodSelectorModal';

// Mock catalog
vi.mock('../../../data/foodCatalog', () => ({
  BASE_FOOD_CATALOG: [],
}));

// Mock nutritionEngine
const mockGetCustomFoods = vi.fn().mockResolvedValue([]);
const mockSaveCustomFood = vi.fn();
const mockDeleteCustomFood = vi.fn();

vi.mock('../../../lib/nutritionEngine', async () => {
  const actual: any = await vi.importActual('../../../lib/nutritionEngine');
  return {
    ...actual,
    getCustomFoods: (...args: any[]) => mockGetCustomFoods(...args),
    saveCustomFood: (...args: any[]) => mockSaveCustomFood(...args),
    deleteCustomFood: (...args: any[]) => mockDeleteCustomFood(...args),
    searchOpenFoodFacts: vi.fn().mockResolvedValue([]),
  };
});

describe('FoodSelectorModal — Unidades de Medida en Creación de Alimentos', () => {
  const onAddFoodMock = vi.fn();
  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderModalInCreateTab = () => {
    render(
      <FoodSelectorModal
        isOpen={true}
        onClose={onCloseMock}
        mealName="Desayuno"
        onAddFood={onAddFoodMock}
      />
    );

    // Navegar a la pestaña '✍️ Crear'
    const createTabBtn = screen.getByRole('button', { name: /Crear/i });
    fireEvent.click(createTabBtn);

    const unitSelect = screen.getByRole('combobox');
    const baseAmountInput = screen.getByDisplayValue('100');

    return { unitSelect, baseAmountInput };
  };

  it('debe contener todas las unidades requeridas: cucharadita, tableta, vaso, sobre, capsula junto con las previas', () => {
    const { unitSelect } = renderModalInCreateTab();

    const expectedUnits = [
      { value: 'gr', label: 'Gramos (gr)' },
      { value: 'ml', label: 'Mililitros (ml)' },
      { value: 'u', label: 'Unidad (u)' },
      { value: 'Tajada', label: 'Tajada' },
      { value: 'scoop', label: 'Scoop' },
      { value: 'cucharada', label: 'Cucharada' },
      { value: 'cucharadita', label: 'Cucharadita' },
      { value: 'Taza', label: 'Taza' },
      { value: 'vaso', label: 'Vaso' },
      { value: 'tableta', label: 'Tableta' },
      { value: 'sobre', label: 'Sobre' },
      { value: 'capsula', label: 'Cápsula' },
    ];

    const options = Array.from(unitSelect.querySelectorAll('option')).filter(
      (opt) => (opt as HTMLOptionElement).style.display !== 'none'
    );

    expectedUnits.forEach(({ value, label }) => {
      const match = options.find((opt) => opt.value === value);
      expect(match, `Opción con value="${value}" debe estar presente en el select`).toBeDefined();
      expect(match?.textContent).toBe(label);
    });
  });

  it('debe adaptar la cantidad base a 1 al seleccionar unidades discretas (tableta, capsula, sobre, etc.) y volver a 100 con gr o ml', () => {
    const { unitSelect } = renderModalInCreateTab();

    // Estado inicial en gr: 100
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();

    // 1. Cambiar a tableta -> debe cambiar a 1
    fireEvent.change(unitSelect, { target: { value: 'tableta' } });
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();

    // 2. Cambiar a capsula -> permanece en 1
    fireEvent.change(unitSelect, { target: { value: 'capsula' } });
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();

    // 3. Cambiar a sobre -> permanece en 1
    fireEvent.change(unitSelect, { target: { value: 'sobre' } });
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();

    // 4. Cambiar a cucharadita -> permanece en 1
    fireEvent.change(unitSelect, { target: { value: 'cucharadita' } });
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();

    // 5. Cambiar a vaso -> permanece en 1
    fireEvent.change(unitSelect, { target: { value: 'vaso' } });
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();

    // 6. Cambiar de nuevo a ml -> debe restaurar a 100
    fireEvent.change(unitSelect, { target: { value: 'ml' } });
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();

    // 7. Cambiar de nuevo a gr -> permanece en 100
    fireEvent.change(unitSelect, { target: { value: 'gr' } });
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
  });

  it('permite crear y guardar un suplemento en cápsula con su unidad correspondiente', async () => {
    const { unitSelect } = renderModalInCreateTab();

    // Llenar formulario
    const nameInput = screen.getByPlaceholderText(/Tostadas francesas/i);
    fireEvent.change(nameInput, { target: { value: 'Omega 3 Ultra Puro' } });

    // Seleccionar cápsula
    fireEvent.change(unitSelect, { target: { value: 'capsula' } });
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();

    const calInput = screen.getByPlaceholderText('Auto');
    fireEvent.change(calInput, { target: { value: '9' } });

    const macroInputs = screen.getAllByPlaceholderText('0');
    // macroInputs[0] = proteina, [1] = carbos, [2] = grasa
    fireEvent.change(macroInputs[2], { target: { value: '1.0' } });

    const mockSavedFood = {
      id: 'custom_omega3',
      nombre: 'Omega 3 Ultra Puro',
      grupo: 'Mis Alimentos',
      cantidadBase: 1,
      unidad: 'capsula',
      caloriasBase: 9,
      proteinaBase: 0,
      carbohidratosBase: 0,
      grasaBase: 1.0,
      esPersonalizado: true,
      fuente: 'Personalizado',
    };
    mockSaveCustomFood.mockResolvedValueOnce(mockSavedFood);

    const submitBtn = screen.getByRole('button', { name: /GUARDAR ALIMENTO EN MI BIBLIOTECA/i });
    const form = submitBtn.closest('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(mockSaveCustomFood).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Omega 3 Ultra Puro',
        unidad: 'capsula',
        cantidadBase: 1,
        caloriasBase: 9,
      })
    );
  });
});
