// @vitest-environment happy-dom
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FoodSelectorModal } from '../FoodSelectorModal';

// Mock catalog
vi.mock('../../../data/foodCatalog', () => ({
  BASE_FOOD_CATALOG: [],
}));

// Mock nutritionEngine
const mockSearchOpenFoodFacts = vi.fn();
const mockGetCustomFoods = vi.fn().mockResolvedValue([]);
const mockSaveCustomFood = vi.fn();
const mockDeleteCustomFood = vi.fn();

vi.mock('../../../lib/nutritionEngine', async () => {
  const actual: any = await vi.importActual('../../../lib/nutritionEngine');
  return {
    ...actual,
    searchOpenFoodFacts: (...args: any[]) => mockSearchOpenFoodFacts(...args),
    getCustomFoods: (...args: any[]) => mockGetCustomFoods(...args),
    saveCustomFood: (...args: any[]) => mockSaveCustomFood(...args),
    deleteCustomFood: (...args: any[]) => mockDeleteCustomFood(...args),
  };
});

describe('Supermarket Search (FoodSelectorModal)', () => {
  const onAddFoodMock = vi.fn();
  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('debe renderizar el contenedor responsive y el botón Buscar en la pestaña Supermercado', async () => {
    render(
      <FoodSelectorModal
        isOpen={true}
        onClose={onCloseMock}
        mealName="Almuerzo"
        onAddFood={onAddFoodMock}
      />
    );

    // Cambiar a pestaña Supermercado
    const supermarketTabBtn = screen.getByRole('button', { name: /Supermercado/i });
    fireEvent.click(supermarketTabBtn);

    // Verificar que existen los elementos con sus clases dedicadas
    const searchRow = document.querySelector('.food-selector-supermarket-search-row');
    expect(searchRow).not.toBeNull();

    const inputWrapper = document.querySelector('.food-selector-supermarket-input-wrapper');
    expect(inputWrapper).not.toBeNull();

    const input = screen.getByPlaceholderText(/Escribe el nombre de la marca o producto/i);
    expect(input).toHaveClass('food-selector-supermarket-input');

    const searchBtn = screen.getByRole('button', { name: /Buscar/i });
    expect(searchBtn).toHaveClass('food-selector-supermarket-btn');
    expect(searchBtn).toBeDisabled(); // Deshabilitado porque query está vacío (<2 caracteres)
  });

  it('debe mostrar el botón de limpieza ✕ al escribir y permitir borrar el texto con un clic', async () => {
    render(
      <FoodSelectorModal
        isOpen={true}
        onClose={onCloseMock}
        mealName="Almuerzo"
        onAddFood={onAddFoodMock}
      />
    );

    const supermarketTabBtn = screen.getByRole('button', { name: /Supermercado/i });
    fireEvent.click(supermarketTabBtn);

    const input = screen.getByPlaceholderText(/Escribe el nombre de la marca o producto/i);

    // Al inicio no hay botón de limpieza
    expect(document.querySelector('.food-selector-supermarket-clear-btn')).toBeNull();

    // Escribir texto
    fireEvent.change(input, { target: { value: 'Zenú' } });

    // Ahora debe existir el botón ✕
    const clearBtn = document.querySelector('.food-selector-supermarket-clear-btn');
    expect(clearBtn).not.toBeNull();

    // Al hacer clic en ✕, el campo debe quedar vacío
    fireEvent.click(clearBtn!);
    expect(input).toHaveValue('');
    expect(document.querySelector('.food-selector-supermarket-clear-btn')).toBeNull();
  });

  it('debe ejecutar búsqueda automática tras debounce de 450ms cuando el usuario escribe >= 2 caracteres', async () => {
    mockSearchOpenFoodFacts.mockResolvedValueOnce([
      {
        id: 'off_zenu_1',
        nombre: 'Salchicha Tradicional Zenú',
        marca: 'Zenú',
        grupo: 'Mis Alimentos',
        cantidadBase: 100,
        unidad: 'gr',
        caloriasBase: 220,
        proteinaBase: 12,
        carbohidratosBase: 3,
        grasaBase: 18,
        fuente: 'Open Food Facts',
      },
    ]);

    render(
      <FoodSelectorModal
        isOpen={true}
        onClose={onCloseMock}
        mealName="Cena"
        onAddFood={onAddFoodMock}
      />
    );

    const supermarketTabBtn = screen.getByRole('button', { name: /Supermercado/i });
    fireEvent.click(supermarketTabBtn);

    const input = screen.getByPlaceholderText(/Escribe el nombre de la marca o producto/i);
    fireEvent.change(input, { target: { value: 'Zenú' } });

    // Aún no se debió llamar a la API antes de que pase el tiempo
    expect(mockSearchOpenFoodFacts).not.toHaveBeenCalled();

    // Avanzar temporizador 450ms
    await act(async () => {
      vi.advanceTimersByTime(450);
    });

    expect(mockSearchOpenFoodFacts).toHaveBeenCalledWith('Zenú');
  });

  it('debe ejecutar la búsqueda de inmediato al presionar el botón Buscar o Enter', async () => {
    mockSearchOpenFoodFacts.mockResolvedValue([
      {
        id: 'off_colanta_1',
        nombre: 'Leche Deslactosada Colanta',
        marca: 'Colanta',
        grupo: 'Mis Alimentos',
        cantidadBase: 100,
        unidad: 'gr',
        caloriasBase: 44,
        proteinaBase: 3.1,
        carbohidratosBase: 4.8,
        grasaBase: 1.5,
        fuente: 'Open Food Facts',
      },
    ]);

    render(
      <FoodSelectorModal
        isOpen={true}
        onClose={onCloseMock}
        mealName="Desayuno"
        onAddFood={onAddFoodMock}
      />
    );

    const supermarketTabBtn = screen.getByRole('button', { name: /Supermercado/i });
    fireEvent.click(supermarketTabBtn);

    const input = screen.getByPlaceholderText(/Escribe el nombre de la marca o producto/i);
    fireEvent.change(input, { target: { value: 'Colanta' } });

    const searchBtn = screen.getByRole('button', { name: /Buscar/i });
    expect(searchBtn).not.toBeDisabled();

    // Clic en Buscar ejecuta de inmediato sin esperar el debounce
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    expect(mockSearchOpenFoodFacts).toHaveBeenCalledWith('Colanta');
  });

  it('debe renderizar correctamente la tarjeta de producto con macros y marca', async () => {
    mockSearchOpenFoodFacts.mockResolvedValueOnce([
      {
        id: 'off_zenu_salchicha',
        nombre: 'Salchicha Manguera Zenú',
        marca: 'Zenú',
        grupo: 'Mis Alimentos',
        cantidadBase: 100,
        unidad: 'gr',
        caloriasBase: 240,
        proteinaBase: 13.5,
        carbohidratosBase: 2.5,
        grasaBase: 19.8,
        fuente: 'Open Food Facts',
      },
    ]);

    render(
      <FoodSelectorModal
        isOpen={true}
        onClose={onCloseMock}
        mealName="Almuerzo"
        onAddFood={onAddFoodMock}
      />
    );

    const supermarketTabBtn = screen.getByRole('button', { name: /Supermercado/i });
    fireEvent.click(supermarketTabBtn);

    const input = screen.getByPlaceholderText(/Escribe el nombre de la marca o producto/i);
    fireEvent.change(input, { target: { value: 'Zenú' } });

    const searchBtn = screen.getByRole('button', { name: /Buscar/i });
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    // Validar datos en pantalla
    expect(screen.getByText('Salchicha Manguera Zenú')).toBeInTheDocument();
    expect(screen.getByText('240 kcal')).toBeInTheDocument();
    expect(screen.getByText(/P: 13.5g/i)).toBeInTheDocument();
    expect(screen.getByText(/C: 2.5g/i)).toBeInTheDocument();
    expect(screen.getByText(/G: 19.8g/i)).toBeInTheDocument();
  });

  it('debe mostrar estado sin resultados con botón para crear personalizado si la búsqueda no arroja alimentos', async () => {
    mockSearchOpenFoodFacts.mockResolvedValueOnce([]);

    render(
      <FoodSelectorModal
        isOpen={true}
        onClose={onCloseMock}
        mealName="Snack"
        onAddFood={onAddFoodMock}
      />
    );

    const supermarketTabBtn = screen.getByRole('button', { name: /Supermercado/i });
    fireEvent.click(supermarketTabBtn);

    const input = screen.getByPlaceholderText(/Escribe el nombre de la marca o producto/i);
    fireEvent.change(input, { target: { value: 'ProductoInexistente99' } });

    const searchBtn = screen.getByRole('button', { name: /Buscar/i });
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    // Mensaje de sin resultados
    expect(screen.getByText(/No se encontraron alimentos para «ProductoInexistente99»/i)).toBeInTheDocument();

    // Botón para crear personalizado
    const createCustomBtn = screen.getByRole('button', {
      name: /\+ Crear «ProductoInexistente99» como Personalizado/i,
    });
    expect(createCustomBtn).toBeInTheDocument();

    // Al hacer clic, debe cambiar a pestaña personalizado con el nombre pre-llenado
    fireEvent.click(createCustomBtn);
    const nombreInput = screen.getByPlaceholderText(/Tostadas francesas/i);
    expect(nombreInput).toHaveValue('ProductoInexistente99');
  });
});
