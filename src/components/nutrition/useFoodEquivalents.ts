import { useState, useCallback } from 'react';
import {
  MealFoodItem,
  FoodItem,
  FoodEquivalentOption,
} from '../../types/nutrition.types';
import {
  getAutomaticEquivalents,
  normalizeFoodSearchText,
  calculateEquivalentPortion,
} from '../../lib/nutritionEngine';

export interface UseFoodEquivalentsReturn {
  isModalOpen: boolean;
  targetFood: MealFoodItem | null;
  currentEquivalents: FoodEquivalentOption[];
  openEquivalentsModal: (
    food: MealFoodItem,
    savedEquivalentsMap?: Record<string, FoodEquivalentOption[]>
  ) => void;
  closeEquivalentsModal: () => void;
  toggleOptionActive: (index: number) => void;
  updateOptionQuantity: (index: number, newQty: number, candidateFood?: FoodItem) => void;
  addCustomOption: (candidate: FoodItem) => void;
  removeOption: (index: number) => void;
  resetToAutomatic: () => void;
  addOptionDirect: (option: FoodEquivalentOption) => void;
  clearOptions: () => void;
  getActiveOptionsForFood: (
    food: MealFoodItem,
    savedEquivalentsMap?: Record<string, FoodEquivalentOption[]>
  ) => FoodEquivalentOption[];
}

export function useFoodEquivalents(): UseFoodEquivalentsReturn {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [targetFood, setTargetFood] = useState<MealFoodItem | null>(null);
  const [currentEquivalents, setCurrentEquivalents] = useState<FoodEquivalentOption[]>([]);

  const getActiveOptionsForFood = useCallback(
    (
      food: MealFoodItem,
      savedEquivalentsMap?: Record<string, FoodEquivalentOption[]>
    ): FoodEquivalentOption[] => {
      if (!food || !food.nombre) return [];
      const key = normalizeFoodSearchText(food.nombre);
      if (savedEquivalentsMap && Array.isArray(savedEquivalentsMap[key])) {
        return savedEquivalentsMap[key];
      }
      return getAutomaticEquivalents(food);
    },
    []
  );

  const openEquivalentsModal = useCallback(
    (
      food: MealFoodItem,
      savedEquivalentsMap?: Record<string, FoodEquivalentOption[]>
    ) => {
      setTargetFood(food);
      const options = getActiveOptionsForFood(food, savedEquivalentsMap);
      setCurrentEquivalents(options);
      setIsModalOpen(true);
    },
    [getActiveOptionsForFood]
  );

  const closeEquivalentsModal = useCallback(() => {
    setIsModalOpen(false);
    setTargetFood(null);
    setCurrentEquivalents([]);
  }, []);

  const toggleOptionActive = useCallback((index: number) => {
    setCurrentEquivalents((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, activo: !opt.activo } : opt))
    );
  }, []);

  const updateOptionQuantity = useCallback(
    (index: number, newQty: number, candidateFood?: FoodItem) => {
      if (newQty <= 0) return;
      setCurrentEquivalents((prev) =>
        prev.map((opt, i) => {
          if (i !== index) return opt;
          const foodBase = candidateFood || {
            cantidadBase: 100,
            caloriasBase: Math.round((opt.calorias / (opt.cantidad || 1)) * 100),
            proteinaBase: (opt.proteina / (opt.cantidad || 1)) * 100,
            carbohidratosBase: (opt.carbohidratos / (opt.cantidad || 1)) * 100,
            grasaBase: (opt.grasa / (opt.cantidad || 1)) * 100,
          };
          const base = foodBase.cantidadBase > 0 ? foodBase.cantidadBase : 100;
          const ratio = newQty / base;
          const newCal = Math.round(foodBase.caloriasBase * ratio);
          const targetCal = targetFood?.calorias || 1;
          const deltaPct = Math.round(((newCal - targetCal) / targetCal) * 100);

          return {
            ...opt,
            cantidad: newQty,
            calorias: newCal,
            proteina: Math.round(foodBase.proteinaBase * ratio * 10) / 10,
            carbohidratos: Math.round(foodBase.carbohidratosBase * ratio * 10) / 10,
            grasa: Math.round(foodBase.grasaBase * ratio * 10) / 10,
            deltaCaloriasPct: deltaPct,
          };
        })
      );
    },
    [targetFood]
  );

  const addCustomOption = useCallback(
    (candidate: FoodItem) => {
      if (!targetFood || !candidate) return;
      // Permitimos hasta ±100% para opciones manuales agregadas explícitamente por el entrenador (criterio profesional)
      const option = calculateEquivalentPortion(targetFood, candidate, 100);
      if (option) {
        setCurrentEquivalents((prev) => {
          // Si ya existía, activarlo
          const exists = prev.some((p) => String(p.foodId) === String(candidate.id));
          if (exists) {
            return prev.map((p) =>
              String(p.foodId) === String(candidate.id) ? { ...p, activo: true } : p
            );
          }
          return [...prev, { ...option, esPersonalizado: true, activo: true }];
        });
      }
    },
    [targetFood]
  );

  const removeOption = useCallback((index: number) => {
    setCurrentEquivalents((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const resetToAutomatic = useCallback(() => {
    if (!targetFood) return;
    const autos = getAutomaticEquivalents(targetFood);
    setCurrentEquivalents(autos);
  }, [targetFood]);

  const addOptionDirect = useCallback((option: FoodEquivalentOption) => {
    setCurrentEquivalents((prev) => {
      const optNorm = normalizeFoodSearchText(option.nombre);
      const exists = prev.some(
        (p) =>
          String(p.foodId) === String(option.foodId) ||
          normalizeFoodSearchText(p.nombre) === optNorm
      );
      if (exists) {
        return prev.map((p) =>
          String(p.foodId) === String(option.foodId) ||
          normalizeFoodSearchText(p.nombre) === optNorm
            ? { ...p, activo: true }
            : p
        );
      }
      return [...prev, { ...option, activo: true }];
    });
  }, []);

  const clearOptions = useCallback(() => {
    setCurrentEquivalents([]);
  }, []);

  return {
    isModalOpen,
    targetFood,
    currentEquivalents,
    openEquivalentsModal,
    closeEquivalentsModal,
    toggleOptionActive,
    updateOptionQuantity,
    addCustomOption,
    removeOption,
    resetToAutomatic,
    addOptionDirect,
    clearOptions,
    getActiveOptionsForFood,
  };
}
