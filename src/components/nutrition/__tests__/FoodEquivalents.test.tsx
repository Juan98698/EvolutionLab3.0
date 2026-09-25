// @vitest-environment happy-dom
import { render, screen, fireEvent, renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { FoodEquivalentsConfigModal } from '../FoodEquivalentsConfigModal';
import { useFoodEquivalents } from '../useFoodEquivalents';
import { MealFoodItem, FoodItem, FoodEquivalentOption } from '../../../types/nutrition.types';

describe('Sistema de Alimentos Equivalentes para el Entrenador', () => {
  afterEach(() => {
    cleanup();
  });
  const sampleTargetChicken: MealFoodItem = {
    id: 'food-chicken-1',
    foodId: 'chick-101',
    nombre: 'Pechuga de pollo',
    grupo: 'Carnes y Aves',
    cantidad: 150,
    cantidadBase: 100,
    unidad: 'gr',
    calorias: 160,
    proteina: 33,
    carbohidratos: 0,
    grasa: 2.5,
  };

  const sampleInitialEquivalents: FoodEquivalentOption[] = [
    {
      foodId: 'tilapia-1',
      nombre: 'Filete de Tilapia',
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
    {
      foodId: 'beef-1',
      nombre: 'Lomo fino de res magro',
      grupo: 'Carnes y Aves',
      cantidad: 140,
      unidad: 'gr',
      calorias: 170,
      proteina: 33.6,
      carbohidratos: 0,
      grasa: 4,
      deltaCaloriasPct: 6,
      activo: true,
    },
    {
      foodId: 'eggwhites-1',
      nombre: 'Claras de huevo',
      grupo: 'Huevos',
      cantidad: 300,
      unidad: 'gr',
      calorias: 150,
      proteina: 33,
      carbohidratos: 2.1,
      grasa: 0.6,
      deltaCaloriasPct: -6,
      activo: false, // Desactivado inicialmente
    },
  ];

  describe('1. Hook useFoodEquivalents', () => {
    it('abre el modal y genera sugerencias automáticas si no hay mapa guardado', () => {
      const { result } = renderHook(() => useFoodEquivalents());

      act(() => {
        result.current.openEquivalentsModal(sampleTargetChicken);
      });

      expect(result.current.isModalOpen).toBe(true);
      expect(result.current.targetFood?.nombre).toBe('Pechuga de pollo');
      expect(result.current.currentEquivalents.length).toBeGreaterThan(0);
      // Todas las opciones automáticas deben tener delta <= 10%
      for (const opt of result.current.currentEquivalents) {
        expect(Math.abs(opt.deltaCaloriasPct)).toBeLessThanOrEqual(10);
      }
    });

    it('permite alternar el estado activo (aprobar/vetar) de una opción', () => {
      const { result } = renderHook(() => useFoodEquivalents());

      act(() => {
        result.current.openEquivalentsModal(sampleTargetChicken, {
          'pechuga de pollo': sampleInitialEquivalents,
        });
      });

      // El índice 0 es Tilapia (activo: true)
      expect(result.current.currentEquivalents[0].activo).toBe(true);

      // Alternar a inactivo
      act(() => {
        result.current.toggleOptionActive(0);
      });
      expect(result.current.currentEquivalents[0].activo).toBe(false);

      // Alternar de vuelta a activo
      act(() => {
        result.current.toggleOptionActive(0);
      });
      expect(result.current.currentEquivalents[0].activo).toBe(true);
    });

    it('permite ajustar la cantidad manualmente y recalcula las calorías y el delta', () => {
      const { result } = renderHook(() => useFoodEquivalents());

      act(() => {
        result.current.openEquivalentsModal(sampleTargetChicken, {
          'pechuga de pollo': sampleInitialEquivalents,
        });
      });

      // Actualizar cantidad de tilapia de 165g a 200g
      act(() => {
        result.current.updateOptionQuantity(0, 200);
      });

      expect(result.current.currentEquivalents[0].cantidad).toBe(200);
      expect(result.current.currentEquivalents[0].calorias).toBeGreaterThan(158);
    });

    it('permite agregar un alimento personalizado y restablecer a sugeridos', () => {
      const { result } = renderHook(() => useFoodEquivalents());

      act(() => {
        result.current.openEquivalentsModal(sampleTargetChicken, {
          'pechuga de pollo': sampleInitialEquivalents,
        });
      });

      const customSalmon: FoodItem = {
        id: 'salmon-custom',
        nombre: 'Salmón a la plancha',
        grupo: 'Pescados y Mariscos',
        cantidadBase: 100,
        unidad: 'gr',
        caloriasBase: 190,
        proteinaBase: 25,
        carbohidratosBase: 0,
        grasaBase: 10,
      };

      act(() => {
        result.current.addCustomOption(customSalmon);
      });

      expect(
        result.current.currentEquivalents.some((e) => e.nombre.includes('Salmón'))
      ).toBe(true);

      // Restablecer a automáticos
      act(() => {
        result.current.resetToAutomatic();
      });

      expect(result.current.currentEquivalents.length).toBeGreaterThan(0);
    });
  });

  describe('2. Componente FoodEquivalentsConfigModal', () => {
    it('renderiza la cabecera del alimento prescrito con su macro dominante', () => {
      render(
        <FoodEquivalentsConfigModal
          isOpen={true}
          onClose={vi.fn()}
          targetFood={sampleTargetChicken}
          equivalents={sampleInitialEquivalents}
          onToggleActive={vi.fn()}
          onUpdateQuantity={vi.fn()}
          onRemoveOption={vi.fn()}
          onAddCustomOption={vi.fn()}
          onResetToAutomatic={vi.fn()}
          onSave={vi.fn()}
        />
      );

      expect(screen.getByText(/EQUIVALENTES & SUSTITUCIONES/i)).toBeInTheDocument();
      expect(screen.getByText(/Dominante: proteina/i)).toBeInTheDocument();
      expect(screen.getByText(/Pechuga de pollo \(150 gr\)/i)).toBeInTheDocument();
      expect(screen.getByText('Filete de Tilapia')).toBeInTheDocument();
      expect(screen.getByText('Lomo fino de res magro')).toBeInTheDocument();
    });

    it('permite al entrenador desmarcar y guardar equivalentes aprobados', () => {
      const handleToggle = vi.fn();
      const handleSave = vi.fn();

      render(
        <FoodEquivalentsConfigModal
          isOpen={true}
          onClose={vi.fn()}
          targetFood={sampleTargetChicken}
          equivalents={sampleInitialEquivalents}
          onToggleActive={handleToggle}
          onUpdateQuantity={vi.fn()}
          onRemoveOption={vi.fn()}
          onAddCustomOption={vi.fn()}
          onResetToAutomatic={vi.fn()}
          onSave={handleSave}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(3);

      // Desmarcar primera opción
      fireEvent.click(checkboxes[0]);
      expect(handleToggle).toHaveBeenCalledWith(0);

      // Presionar Guardar
      const saveBtn = screen.getByRole('button', { name: /Guardar para este Alimento/i });
      fireEvent.click(saveBtn);

      expect(handleSave).toHaveBeenCalledWith('pechuga de pollo', sampleInitialEquivalents);
    });

    it('muestra el contador exacto de opciones activas y el botón alternar todas', () => {
      const handleToggleAll = vi.fn();

      const { rerender } = render(
        <FoodEquivalentsConfigModal
          isOpen={true}
          onClose={vi.fn()}
          targetFood={sampleTargetChicken}
          equivalents={sampleInitialEquivalents} // 2 activos, 1 inactivo
          onToggleActive={vi.fn()}
          onToggleAllActive={handleToggleAll}
          onUpdateQuantity={vi.fn()}
          onRemoveOption={vi.fn()}
          onAddCustomOption={vi.fn()}
          onResetToAutomatic={vi.fn()}
          onSave={vi.fn()}
        />
      );

      // Debe mostrar 2 activas de 3 totales en el título y subtítulo
      expect(screen.getByText(/Opciones Aprobadas para el PDF \(2\)/i)).toBeInTheDocument();
      expect(screen.getByText(/2 de 3 activas/i)).toBeInTheDocument();

      // Al haber activas, el botón debe ser "Desactivar todos en PDF"
      const toggleAllBtn = screen.getByRole('button', { name: /Desactivar todos en PDF/i });
      expect(toggleAllBtn).toBeInTheDocument();
      fireEvent.click(toggleAllBtn);
      expect(handleToggleAll).toHaveBeenCalledWith(false);

      // Ahora simular que todas están inactivas
      const allInactiveEquivalents = sampleInitialEquivalents.map((e) => ({ ...e, activo: false }));
      rerender(
        <FoodEquivalentsConfigModal
          isOpen={true}
          onClose={vi.fn()}
          targetFood={sampleTargetChicken}
          equivalents={allInactiveEquivalents}
          onToggleActive={vi.fn()}
          onToggleAllActive={handleToggleAll}
          onUpdateQuantity={vi.fn()}
          onRemoveOption={vi.fn()}
          onAddCustomOption={vi.fn()}
          onResetToAutomatic={vi.fn()}
          onSave={vi.fn()}
        />
      );

      // El contador debe mostrar (0) y "0 de 3 activas"
      expect(screen.getByText(/Opciones Aprobadas para el PDF \(0\)/i)).toBeInTheDocument();
      expect(screen.getByText(/0 de 3 activas/i)).toBeInTheDocument();

      // Debe mostrar el botón para reactivar todos
      const activateAllBtn = screen.getByRole('button', { name: /Activar todos en PDF/i });
      expect(activateAllBtn).toBeInTheDocument();
      fireEvent.click(activateAllBtn);
      expect(handleToggleAll).toHaveBeenCalledWith(true);
    });
  });
});
