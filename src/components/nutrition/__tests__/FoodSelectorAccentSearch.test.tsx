// @vitest-environment happy-dom
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FoodSelectorModal } from '../FoodSelectorModal';

vi.mock('../../../lib/nutritionEngine', async () => {
  const actual: any = await vi.importActual('../../../lib/nutritionEngine');
  return {
    ...actual,
    getCustomFoods: vi.fn().mockResolvedValue([]),
    searchOpenFoodFacts: vi.fn().mockResolvedValue([]),
  };
});

describe('FoodSelectorModal — Búsqueda Insensible a Acentos y Diacríticos con Catálogo Real', () => {
  const mockOnClose = vi.fn();
  const mockOnAddFood = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const setupModal = async () => {
    render(
      <FoodSelectorModal
        isOpen={true}
        onClose={mockOnClose}
        mealName="Desayuno"
        onAddFood={mockOnAddFood}
      />
    );

    const searchInput = await screen.findByPlaceholderText(/Buscar alimento/i);
    // Esperar a que el catálogo de 1740 alimentos termine de cargar
    await waitFor(
      () => {
        expect(screen.queryByText(/Cargando catálogo oficial/i)).toBeNull();
      },
      { timeout: 4000 }
    );
    return searchInput;
  };

  it('encuentra "Café con leche" buscando "cafe" sin tilde y "café" con tilde', async () => {
    const searchInput = await setupModal();

    // 1. Buscar "cafe" sin tilde
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'cafe' } });
    });
    expect(screen.getAllByText(/Café con leche/i).length).toBeGreaterThan(0);

    // 2. Buscar "café" con tilde
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'café' } });
    });
    expect(screen.getAllByText(/Café con leche/i).length).toBeGreaterThan(0);
  });

  it('encuentra tanto "Atun Van Camps" como "Atún, enlatado en agua" buscando "atun" o "atún"', async () => {
    const searchInput = await setupModal();

    // 1. Buscar "atun" sin acento
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'atun' } });
    });
    expect(screen.getAllByText(/Atún, enlatado en agua/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Atun Van Camps/i).length).toBeGreaterThan(0);

    // 2. Buscar "ATÚN" en mayúsculas y con acento
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'ATÚN' } });
    });
    expect(screen.getAllByText(/Atún, enlatado en agua/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Atun Van Camps/i).length).toBeGreaterThan(0);
  });

  it('encuentra "Jamón de cerdo Viandé" buscando "jamon" sin acento', async () => {
    const searchInput = await setupModal();

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'jamon' } });
    });

    expect(screen.getAllByText(/Jamón de cerdo/i).length).toBeGreaterThan(0);
  });

  it('encuentra "Salchichón Zenú" buscando por marca o texto con y sin acento ("zenu" y "zenú")', async () => {
    const searchInput = await setupModal();

    // Buscar "zenu" sin acento
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'zenu' } });
    });
    expect(screen.getAllByText(/Salchichón Zenú/i).length).toBeGreaterThan(0);

    // Buscar "Zenú" con acento
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Zenú' } });
    });
    expect(screen.getAllByText(/Salchichón Zenú/i).length).toBeGreaterThan(0);
  });

  it('permite búsqueda multi-término independiente del orden ("salado mani" y "mani salado")', async () => {
    const searchInput = await setupModal();

    // Buscar "salado mani"
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'salado mani' } });
    });
    expect(screen.getAllByText(/Maní Salado/i).length).toBeGreaterThan(0);

    // Buscar "mani salado"
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'mani salado' } });
    });
    expect(screen.getAllByText(/Maní Salado/i).length).toBeGreaterThan(0);
  });
});
