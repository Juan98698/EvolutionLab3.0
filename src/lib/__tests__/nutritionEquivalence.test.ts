import { describe, it, expect } from 'vitest';
import {
  getDominantMacro,
  calculateEquivalentPortion,
  getAutomaticEquivalents,
  getUniquePrescribedFoods,
  getGroupedEquivalentsSuggestions,
} from '../nutritionEngine';
import { MealFoodItem, FoodItem, NutritionPlan } from '../../types/nutrition.types';

describe('Motor de Alimentos Equivalentes y Sustituciones Nutricionales', () => {
  const sampleChicken: MealFoodItem = {
    id: 'm-f-1',
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
  };

  const sampleTilapia: FoodItem = {
    id: 'tilapia-1',
    nombre: 'Filete de Tilapia',
    grupo: 'Pescados y Mariscos',
    cantidadBase: 100,
    unidad: 'gr',
    caloriasBase: 96,
    proteinaBase: 20.1,
    carbohidratosBase: 0,
    grasaBase: 1.7,
  };

  const sampleCheeseFatty: FoodItem = {
    id: 'cheese-1',
    nombre: 'Queso Gouda Maduro',
    grupo: 'Lácteos y Quesos',
    cantidadBase: 100,
    unidad: 'gr',
    caloriasBase: 356,
    proteinaBase: 25,
    carbohidratosBase: 2.2,
    grasaBase: 27.4,
  };

  const sampleRice: MealFoodItem = {
    id: 'm-f-2',
    foodId: 'rice-1',
    nombre: 'Arroz blanco cocido',
    grupo: 'Cereales y Tubérculos',
    cantidad: 200,
    cantidadBase: 100,
    unidad: 'gr',
    calorias: 260,
    proteina: 4.8,
    carbohidratos: 56.4,
    grasa: 0.6,
  };

  const samplePotato: FoodItem = {
    id: 'potato-1',
    nombre: 'Papa común cocida',
    grupo: 'Cereales y Tubérculos',
    cantidadBase: 100,
    unidad: 'gr',
    caloriasBase: 77,
    proteinaBase: 2,
    carbohidratosBase: 17.5,
    grasaBase: 0.1,
  };

  describe('1. getDominantMacro — Detección con Fallback Determinista', () => {
    it('detecta proteína en pechuga de pollo y pescado blanco', () => {
      expect(getDominantMacro(sampleChicken)).toBe('proteina');
      expect(getDominantMacro(sampleTilapia)).toBe('proteina');
    });

    it('detecta carbohidratos en arroz blanco y papa', () => {
      expect(getDominantMacro(sampleRice)).toBe('carbohidratos');
      expect(getDominantMacro(samplePotato)).toBe('carbohidratos');
    });

    it('detecta grasas en aceites puros', () => {
      const oliveOil: FoodItem = {
        id: 'oil-1',
        nombre: 'Aceite de oliva virgen extra',
        grupo: 'Grasas y Frutos Secos',
        cantidadBase: 100,
        unidad: 'ml',
        caloriasBase: 884,
        proteinaBase: 0,
        carbohidratosBase: 0,
        grasaBase: 100,
      };
      expect(getDominantMacro(oliveOil)).toBe('grasa');
    });

    it('aplica fallback determinista a alimentos mixtos (ej. almendras)', () => {
      const almonds: FoodItem = {
        id: 'almond-1',
        nombre: 'Almendras naturales',
        grupo: 'Grasas y Frutos Secos',
        cantidadBase: 100,
        unidad: 'gr',
        caloriasBase: 579,
        proteinaBase: 21.2, // 21.2 * 4 = 84.8 kcal
        carbohidratosBase: 21.6, // 21.6 * 4 = 86.4 kcal
        grasaBase: 49.9, // 49.9 * 9 = 449.1 kcal (dominante!)
      };
      expect(getDominantMacro(almonds)).toBe('grasa');
    });
  });

  describe('2. calculateEquivalentPortion — Filtro Duro de Tolerancia Calórica (±10%)', () => {
    it('acepta tilapia como equivalente de pechuga de pollo dentro de la tolerancia calórica', () => {
      const equiv = calculateEquivalentPortion(sampleChicken, sampleTilapia, 10);
      expect(equiv).not.toBeNull();
      expect(equiv?.cantidad).toBeGreaterThan(150);
      expect(equiv?.cantidad).toBeLessThan(180);
      // Proteína debe ser muy cercana a los 33g prescritos
      expect(Math.abs(equiv!.proteina - sampleChicken.proteina)).toBeLessThanOrEqual(2);
      // Calorías deben estar dentro del ±10%
      expect(Math.abs(equiv!.deltaCaloriasPct)).toBeLessThanOrEqual(10);
    });

    it('RECHAZA terminantemente el queso graso como equivalente de pechuga de pollo por exceso calórico (>10%)', () => {
      // 150g de pollo son 160 kcal con 33g de proteína.
      // Para igualar 33g de proteína con queso gouda (25% P, 27.4% G, 356 kcal/100g)
      // se necesitarían ~132g de queso = ~470 kcal (+190% de calorías).
      const equiv = calculateEquivalentPortion(sampleChicken, sampleCheeseFatty, 10);
      expect(equiv).toBeNull();
    });

    it('acepta papa cocida como equivalente de arroz blanco dentro del ±10% de calorías', () => {
      const equiv = calculateEquivalentPortion(sampleRice, samplePotato, 10);
      expect(equiv).not.toBeNull();
      expect(equiv?.cantidad).toBeGreaterThan(300);
      expect(Math.abs(equiv!.carbohidratos - sampleRice.carbohidratos)).toBeLessThanOrEqual(3);
      expect(Math.abs(equiv!.deltaCaloriasPct)).toBeLessThanOrEqual(10);
    });

    it('rechaza alimentos con distinto macronutriente dominante', () => {
      // Intentar reemplazar pechuga de pollo con arroz
      const equiv = calculateEquivalentPortion(sampleChicken, samplePotato, 10);
      expect(equiv).toBeNull();
    });
  });

  describe('3. getAutomaticEquivalents — Generación desde Catálogo Real', () => {
    it('genera alternativas de proteína para pechuga de pollo donde todas cumplen el filtro calórico de ±10%', () => {
      const equivs = getAutomaticEquivalents(sampleChicken);
      expect(equivs.length).toBeGreaterThan(0);
      for (const eq of equivs) {
        expect(Math.abs(eq.deltaCaloriasPct)).toBeLessThanOrEqual(10);
        expect(eq.proteina).toBeGreaterThan(25);
        expect(eq.activo).toBe(true);
      }
    });

    it('genera alternativas de carbohidratos para arroz blanco dentro del ±10% calórico', () => {
      const equivs = getAutomaticEquivalents(sampleRice);
      expect(equivs.length).toBeGreaterThan(0);
      for (const eq of equivs) {
        expect(Math.abs(eq.deltaCaloriasPct)).toBeLessThanOrEqual(10);
        expect(eq.carbohidratos).toBeGreaterThan(45);
        expect(eq.activo).toBe(true);
      }
    });
  });

  describe('4. getUniquePrescribedFoods — Consolidación para el Plan', () => {
    it('consolida y deduplica alimentos prescritos en la semana, descartando aderezos menores', () => {
      const mockPlan: NutritionPlan = {
        cliente_id: 'c-1',
        nombre: 'Plan Test',
        activo: true,
        modo: 'semanal',
        target_calorias: 2000,
        target_proteina_g: 150,
        target_carbohidratos_g: 200,
        target_grasa_g: 60,
        datos_plan: {
          modo: 'semanal',
          days: {
            lunes: {
              id: 'd-1',
              diaSemana: 'lunes',
              nombre: 'Lunes',
              meals: [
                {
                  id: 'm-1',
                  nombre: 'Almuerzo',
                  orden: 1,
                  foods: [
                    sampleChicken,
                    sampleRice,
                    {
                      id: 'salt-1',
                      foodId: 'f-salt',
                      nombre: 'Sal de mesa',
                      grupo: 'Bebidas y Varios',
                      cantidad: 2,
                      cantidadBase: 100,
                      unidad: 'gr',
                      calorias: 0,
                      proteina: 0,
                      carbohidratos: 0,
                      grasa: 0,
                    },
                  ],
                },
              ],
            },
            martes: {
              id: 'd-2',
              diaSemana: 'martes',
              nombre: 'Martes',
              meals: [
                {
                  id: 'm-2',
                  nombre: 'Almuerzo',
                  orden: 1,
                  foods: [
                    // Pechuga de pollo repetida con menor porción
                    { ...sampleChicken, cantidad: 120, id: 'm-f-chick-2' },
                  ],
                },
              ],
            },
          },
        },
      };

      const unique = getUniquePrescribedFoods(mockPlan);
      // Sal de mesa debe haber sido filtrada por irrelevancia macro
      expect(unique.some((f) => f.nombre.includes('Sal'))).toBe(false);
      // Pechuga de pollo debe aparecer una sola vez, con la porción mayor (150g)
      const chickens = unique.filter((f) => f.nombre.includes('Pechuga'));
      expect(chickens.length).toBe(1);
      expect(chickens[0].cantidad).toBe(150);
      // Arroz blanco debe aparecer
      expect(unique.some((f) => f.nombre.includes('Arroz'))).toBe(true);
    });

    it('asigna subgrupo taxonómico y genera opciones categorizadas en Nivel 2 para el catálogo', () => {
      const { strictMatches, macroMatches } = getGroupedEquivalentsSuggestions(sampleChicken);
      expect(strictMatches.length).toBeGreaterThan(0);
      expect(macroMatches.length).toBeGreaterThan(0);

      // Cada opción debe incluir subgrupo
      for (const item of macroMatches) {
        expect(item.subgrupo).toBeDefined();
        expect(typeof item.subgrupo).toBe('string');
      }

      // Debe incluir múltiples categorías taxonómicas distintas (ej. Res, Cerdo, Pescados)
      const subgrupos = new Set(macroMatches.map((m) => m.subgrupo));
      expect(subgrupos.size).toBeGreaterThanOrEqual(2);
    });
  });
});
