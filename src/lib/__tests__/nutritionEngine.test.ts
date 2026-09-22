import { describe, it, expect, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Mock de Supabase para evitar llamadas de red y timeouts en pruebas
const mockCustomFoodsDb: any[] = [];
vi.mock('../supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'trainer-uuid-test-123', email: 'trainer@evolutionlab.test' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => ({
      select: vi.fn().mockImplementation(() => ({
        order: vi.fn().mockImplementation(() => {
          if (table === 'alimentos_personalizados') {
            return Promise.resolve({ data: [...mockCustomFoodsDb], error: null });
          }
          return Promise.resolve({ data: [], error: null });
        }),
        maybeSingle: vi.fn().mockImplementation(() => {
          return Promise.resolve({
            data: mockCustomFoodsDb[mockCustomFoodsDb.length - 1] || null,
            error: null,
          });
        }),
      })),
      upsert: vi.fn().mockImplementation((payload: any) => {
        const row = {
          id: payload.id || '99999999-9999-4999-8999-999999999999',
          ...payload,
        };
        const idx = mockCustomFoodsDb.findIndex((f) => f.id === row.id);
        if (idx >= 0) {
          mockCustomFoodsDb[idx] = row;
        } else {
          mockCustomFoodsDb.push(row);
        }
        return {
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
          }),
        };
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation((col: string, val: any) => {
          if (col === 'id') {
            const idx = mockCustomFoodsDb.findIndex((f) => String(f.id) === String(val));
            if (idx >= 0) mockCustomFoodsDb.splice(idx, 1);
          }
          return Promise.resolve({ data: null, error: null });
        }),
      }),
    })),
  },
}));

import {
  calculatePortionMacros,
  calculateMealTotals,
  calculateDayTotals,
  calculateCompliance,
  createPlanFromValuation,
  copyNutritionDay,
  validateAndSanitizeFood,
  savePlanOffline,
  getPlanOffline,
  saveCustomFoodOffline,
  getCustomFoodsOffline,
  saveCustomFood,
  getCustomFoods,
  deleteCustomFood,
  searchOpenFoodFacts,
  normalizeFoodSearchText,
  sortMealsChronologically,
  DAYS_OF_WEEK,
} from '../nutritionEngine';
import { BASE_FOOD_CATALOG } from '../../data/foodCatalog';
import { ValoracionAntropometrica } from '../../types/database.types';
import { MealFoodItem } from '../../types/nutrition.types';

describe('Nutrition Engine — Cálculos, Integridad y Flujo de Principio a Fin', () => {
  describe('1. Escalado Proporcional de Macronutrientes por Porción', () => {
    it('debe calcular correctamente los macros proporcionales para una porción en gramos', () => {
      const food = {
        cantidadBase: 100,
        caloriasBase: 165,
        proteinaBase: 31.0,
        carbohidratosBase: 0,
        grasaBase: 3.6,
      };

      // 150g de pechuga (ratio 1.5x)
      const res = calculatePortionMacros(food, 150);
      expect(res.calorias).toBe(248); // Math.round(165 * 1.5)
      expect(res.proteina).toBe(46.5); // 31 * 1.5
      expect(res.carbohidratos).toBe(0);
      expect(res.grasa).toBe(5.4); // 3.6 * 1.5
    });

    it('debe calcular proporciones para unidades distintas a gramos (ej. scoops)', () => {
      const whey = {
        cantidadBase: 1, // 1 scoop
        caloriasBase: 120,
        proteinaBase: 24.0,
        carbohidratosBase: 2.0,
        grasaBase: 1.8,
      };

      const res = calculatePortionMacros(whey, 2); // 2 scoops
      expect(res.calorias).toBe(240);
      expect(res.proteina).toBe(48.0);
      expect(res.carbohidratos).toBe(4.0);
      expect(res.grasa).toBe(3.6);
    });

    it('debe devolver 0 si la cantidad ingresada es 0', () => {
      const food = {
        cantidadBase: 100,
        caloriasBase: 200,
        proteinaBase: 10,
        carbohidratosBase: 20,
        grasaBase: 5,
      };
      const res = calculatePortionMacros(food, 0);
      expect(res.calorias).toBe(0);
      expect(res.proteina).toBe(0);
      expect(res.carbohidratos).toBe(0);
      expect(res.grasa).toBe(0);
    });
  });

  describe('2. Subtotales de Ingesta y Totales Diarios', () => {
    const mockFoods: MealFoodItem[] = [
      {
        id: '1',
        foodId: 'f1',
        nombre: 'Avena en hojuelas',
        grupo: 'Cereales y Tubérculos',
        cantidad: 80,
        cantidadBase: 100,
        unidad: 'gr',
        calorias: 311,
        proteina: 13.5,
        carbohidratos: 53.0,
        grasa: 5.5,
      },
      {
        id: '2',
        foodId: 'f2',
        nombre: 'Huevos enteros',
        grupo: 'Huevos',
        cantidad: 3,
        cantidadBase: 1,
        unidad: 'u',
        calorias: 222,
        proteina: 18.9,
        carbohidratos: 1.2,
        grasa: 15.0,
      },
    ];

    it('debe sumar con exactitud los subtotales de una comida', () => {
      const totals = calculateMealTotals(mockFoods);
      expect(totals.calorias).toBe(533);
      expect(totals.proteina).toBe(32.4);
      expect(totals.carbohidratos).toBe(54.2);
      expect(totals.grasa).toBe(20.5);
    });

    it('debe calcular los totales de un día completo sumando todas sus comidas', () => {
      const day = {
        id: 'day_lunes',
        diaSemana: 'lunes' as const,
        nombre: 'Lunes',
        meals: [
          { id: 'm1', nombre: 'Desayuno', orden: 1, foods: mockFoods },
          { id: 'm2', nombre: 'Almuerzo', orden: 2, foods: mockFoods },
        ],
      };

      const dayTotals = calculateDayTotals(day);
      expect(dayTotals.calorias).toBe(533 * 2);
      expect(dayTotals.proteina).toBe(64.8);
      expect(dayTotals.carbohidratos).toBe(108.4);
      expect(dayTotals.grasa).toBe(41.0);
    });
  });

  describe('3. Comparación y Cumplimiento de Metas (Delta & Compliance)', () => {
    it('debe clasificar como "optimo" si las calorías están dentro de +/- 3% de la meta', () => {
      const target = {
        calorias: 2000,
        proteinaGrams: 150,
        carbohidratosGrams: 200,
        grasaGrams: 60,
      };

      // 2020 kcal (desvío de +1%, dentro de 3%)
      const totals = {
        calorias: 2020,
        proteina: 152,
        carbohidratos: 198,
        grasa: 61,
      };

      const comp = calculateCompliance(totals, target);
      expect(comp.status).toBe('optimo');
      expect(comp.caloriasDiff).toBe(20);
      expect(comp.caloriasPct).toBe(101);
      expect(comp.proteinaPct).toBe(101);
    });

    it('debe clasificar como "deficit" si está por debajo del 3% de tolerancia', () => {
      const target = { calorias: 2400, proteinaGrams: 180, carbohidratosGrams: 250, grasaGrams: 70 };
      const totals = { calorias: 2100, proteina: 150, carbohidratos: 200, grasa: 50 };

      const comp = calculateCompliance(totals, target);
      expect(comp.status).toBe('deficit');
      expect(comp.caloriasDiff).toBe(-300);
      expect(comp.caloriasPct).toBe(88);
    });

    it('debe clasificar como "superavit" si supera el 3% de tolerancia', () => {
      const target = { calorias: 2000, proteinaGrams: 150, carbohidratosGrams: 200, grasaGrams: 60 };
      const totals = { calorias: 2200, proteina: 165, carbohidratos: 220, grasa: 68 };

      const comp = calculateCompliance(totals, target);
      expect(comp.status).toBe('superavit');
      expect(comp.caloriasDiff).toBe(200);
    });
  });

  describe('4. Flujo Antropometría → Inicialización del Plan Nutricional', () => {
    it('debe heredar fielmente las calorías y distribución de macronutrientes de la valoración', () => {
      const valuationMock: ValoracionAntropometrica = {
        id: 'val_123',
        cliente_id: 'cliente_456',
        entrenador_id: 'entrenador_789',
        fecha: '2026-09-20',
        edad: 28,
        peso: 82.5,
        estatura: 180,
        metodo: 'Faulkner',
        objetivo: 'Definición Muscular',
        target_calorias: 2150,
        tdee: 2550,
        bmr: 1850,
        ajuste_calorico_pct: -15,
        macros: {
          proteina: { gPerKg: 2.2, grams: 181.5, calories: 726, percentage: 34 },
          grasa: { gPerKg: 0.9, grams: 74.3, calories: 669, percentage: 31 },
          carbohidratos: { gPerKg: 2.3, grams: 188.8, calories: 755, percentage: 35 },
        },
      };

      const plan = createPlanFromValuation('cliente_456', valuationMock, 'entrenador_789');

      expect(plan.cliente_id).toBe('cliente_456');
      expect(plan.entrenador_id).toBe('entrenador_789');
      expect(plan.valoracion_id).toBe('val_123');
      expect(plan.target_calorias).toBe(2150);
      expect(plan.target_proteina_g).toBe(181.5);
      expect(plan.target_grasa_g).toBe(74.3);
      expect(plan.target_carbohidratos_g).toBe(188.8);
      expect(plan.objetivo).toBe('Definición Muscular');
      expect(plan.activo).toBe(true);

      // Comprobar que los 7 días de la semana estén creados
      expect(Object.keys(plan.datos_plan.days)).toHaveLength(7);
      for (const d of DAYS_OF_WEEK) {
        expect(plan.datos_plan.days[d.key]).toBeDefined();
        expect(plan.datos_plan.days[d.key].meals.length).toBeGreaterThan(0);
      }
    });
  });

  describe('5. Herramienta de Productividad: Copiar Día (Deep Clone)', () => {
    it('debe duplicar en profundidad las comidas y alimentos sin mutaciones colaterales', () => {
      const plan = createPlanFromValuation('client_1', null);
      
      // Agregar un alimento al lunes
      plan.datos_plan.days.lunes.meals[0].foods.push({
        id: 'orig_food_1',
        foodId: 'f1',
        nombre: 'Pechuga de pollo',
        grupo: 'Carnes y Aves',
        cantidad: 150,
        cantidadBase: 100,
        unidad: 'gr',
        calorias: 248,
        proteina: 46.5,
        carbohidratos: 0,
        grasa: 5.4,
      });

      // Copiar lunes a martes y miercoles
      const updatedPlan = copyNutritionDay(plan, 'lunes', ['martes', 'miercoles']);

      expect(updatedPlan.datos_plan.days.martes.meals[0].foods).toHaveLength(1);
      expect(updatedPlan.datos_plan.days.miercoles.meals[0].foods).toHaveLength(1);
      expect(updatedPlan.datos_plan.days.martes.meals[0].foods[0].nombre).toBe('Pechuga de pollo');

      // Verificar que los IDs generados sean únicos (deep clone)
      const foodLunesId = updatedPlan.datos_plan.days.lunes.meals[0].foods[0].id;
      const foodMartesId = updatedPlan.datos_plan.days.martes.meals[0].foods[0].id;
      expect(foodLunesId).not.toBe(foodMartesId);

      // Mutar martes no debe afectar lunes
      updatedPlan.datos_plan.days.martes.meals[0].foods[0].cantidad = 300;
      expect(updatedPlan.datos_plan.days.lunes.meals[0].foods[0].cantidad).toBe(150);
    });
  });

  describe('6. Validación y Saneamiento de Alimentos', () => {
    it('debe rechazar alimentos sin nombre', () => {
      const res = validateAndSanitizeFood({ nombre: '   ' });
      expect(res.valid).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('debe autocalcular calorías faltantes mediante Atwater', () => {
      const res = validateAndSanitizeFood({
        nombre: 'Batido Casero',
        cantidadBase: 100,
        unidad: 'ml',
        proteinaBase: 10,
        carbohidratosBase: 20,
        grasaBase: 5,
        // caloriasBase omitido
      });

      expect(res.valid).toBe(true);
      // Atwater: 10*4 + 20*4 + 5*9 = 40 + 80 + 45 = 165 kcal
      expect(res.food?.caloriasBase).toBe(165);
    });

    it('debe emitir advertencia si las calorías superan el límite físico (950 kcal/100g)', () => {
      const res = validateAndSanitizeFood({
        nombre: 'Alimento Fake Ultra Calórico',
        cantidadBase: 100,
        unidad: 'gr',
        caloriasBase: 1200,
        proteinaBase: 10,
        carbohidratosBase: 10,
        grasaBase: 120,
      });

      expect(res.valid).toBe(true);
      expect(res.warning).toContain('Calorías atípicas');
    });
  });

  describe('7. Persistencia Offline en IndexedDB', () => {
    it('debe guardar y recuperar planes completos en IndexedDB', async () => {
      const plan = createPlanFromValuation('client_test_offline', null, 'trainer_offline');
      plan.id = 'plan_uuid_123';
      plan.datos_plan.days.lunes.meals[0].foods.push({
        id: 'item_1',
        foodId: 'f_test',
        nombre: 'Huevos cocidos',
        grupo: 'Huevos',
        cantidad: 2,
        cantidadBase: 1,
        unidad: 'u',
        calorias: 154,
        proteina: 12.6,
        carbohidratos: 1.2,
        grasa: 10.6,
      });

      await savePlanOffline(plan);

      const retrieved = await getPlanOffline('client_test_offline');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('plan_uuid_123');
      expect(retrieved?.datos_plan.days.lunes.meals[0].foods).toHaveLength(1);
      expect(retrieved?.datos_plan.days.lunes.meals[0].foods[0].nombre).toBe('Huevos cocidos');
    });

    it('debe guardar y listar alimentos personalizados en IndexedDB', async () => {
      const customFood = {
        id: 'cust_99',
        nombre: 'Pan Proteico Artesanal',
        grupo: 'Cereales y Tubérculos' as const,
        cantidadBase: 100,
        unidad: 'gr',
        caloriasBase: 240,
        proteinaBase: 22.0,
        carbohidratosBase: 24.0,
        grasaBase: 4.5,
        esPersonalizado: true,
      };

      await saveCustomFoodOffline(customFood);

      const catalog = await getCustomFoodsOffline();
      expect(catalog.some((f) => f.nombre === 'Pan Proteico Artesanal')).toBe(true);
    });

    it('debe sincronizar alimentos personalizados con saveCustomFood, getCustomFoods y deleteCustomFood', async () => {
      const foodA = {
        id: 'custom_abc123',
        nombre: 'Batido Hipercalórico Casero',
        grupo: 'Suplementación' as const,
        cantidadBase: 1,
        unidad: 'batido',
        caloriasBase: 650,
        proteinaBase: 45.0,
        carbohidratosBase: 80.0,
        grasaBase: 18.0,
        esPersonalizado: true,
      };

      // 1. Guardar híbrido
      const saved = await saveCustomFood(foodA);
      expect(saved.nombre).toBe('Batido Hipercalórico Casero');

      // 2. Obtener lista
      const list = await getCustomFoods();
      expect(list.some((f) => f.nombre === 'Batido Hipercalórico Casero')).toBe(true);

      // 3. Eliminar
      await deleteCustomFood(saved.id);
      const listAfter = await getCustomFoods();
      expect(listAfter.some((f) => f.id === saved.id)).toBe(false);
    });
  });

  describe('8. Control de Calidad del Catálogo de Alimentos Base', () => {
    it('todos los alimentos base deben tener datos nutricionales válidos y coherentes', () => {
      expect(BASE_FOOD_CATALOG.length).toBeGreaterThan(100);

      for (const food of BASE_FOOD_CATALOG) {
        expect(food.id).toBeDefined();
        expect(food.nombre.trim().length).toBeGreaterThan(0);
        expect(food.cantidadBase).toBeGreaterThan(0);
        expect(food.caloriasBase).toBeGreaterThanOrEqual(0);
        expect(food.proteinaBase).toBeGreaterThanOrEqual(0);
        expect(food.carbohidratosBase).toBeGreaterThanOrEqual(0);
        expect(food.grasaBase).toBeGreaterThanOrEqual(0);

        // Sin NaNs ni infinitos
        expect(isNaN(food.caloriasBase)).toBe(false);
        expect(isFinite(food.caloriasBase)).toBe(true);
      }
    });
  });

  describe('9. Búsqueda y Sanitización en Open Food Facts', () => {
    it('debe devolver array vacío si la consulta tiene menos de 2 caracteres', async () => {
      const res = await searchOpenFoodFacts('a');
      expect(res).toEqual([]);
    });

    it('debe sanitizar productos simulados de Open Food Facts con valores macronutricionales válidos', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/food-search')) {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              products: [
                {
                  code: '123456',
                  product_name: 'Huevos AA Campesinos',
                  brands: 'Santa Anita',
                  nutriments: {
                    'energy-kcal_100g': 143,
                    proteins_100g: 12.6,
                    carbohydrates_100g: 0.8,
                    fat_100g: 9.5,
                  },
                },
              ],
            }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      try {
        const results = await searchOpenFoodFacts('huevos');
        expect(results.length).toBe(1);
        expect(results[0].nombre).toContain('Huevos AA Campesinos');
        expect(results[0].caloriasBase).toBe(143);
        expect(results[0].proteinaBase).toBe(12.6);
        expect(results[0].carbohidratosBase).toBe(0.8);
        expect(results[0].grasaBase).toBe(9.5);
        expect(results[0].esPersonalizado).toBe(true);
        expect(results[0].fuente).toBe('Open Food Facts');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('debe manejar errores de red o respuestas no JSON sin lanzar excepciones no controladas', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new Error('Network error simulado'));
      });

      try {
        const results = await searchOpenFoodFacts('atun');
        expect(results).toEqual([]);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('debe consultar Search-a-licious con hits, asignar ml a líquidos y filtrar productos sin macros cuando existen con macros', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation((url: string) => {
        // Simular que el proxy /api/food-search falla (red o 500)
        if (url.includes('/api/food-search')) {
          return Promise.reject(new Error('Proxy offline'));
        }

        // Simular Search-a-licious directo
        if (url.includes('search.openfoodfacts.org/search')) {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              hits: [
                {
                  code: '7702001',
                  product_name: 'Salchicha Tradicional',
                  brands: ['Zenú'],
                  nutriments: {}, // Sin macros (debe ser filtrado)
                },
                {
                  code: '7702002',
                  product_name: 'Salchicha Ranchera',
                  brands: 'Zenú',
                  nutriments: {
                    'energy-kcal_100g': 240,
                    proteins_100g: 13,
                    carbohydrates_100g: 2,
                    fat_100g: 20,
                  },
                },
                {
                  code: '7702003',
                  product_name: 'Bebida de Avena',
                  brands: 'Colanta',
                  nutriments: {
                    'energy-kcal_100g': 70,
                    proteins_100g: 2,
                    carbohydrates_100g: 10.5,
                    fat_100g: 2,
                  },
                },
              ],
            }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      try {
        const results = await searchOpenFoodFacts('Zenú');
        // El producto sin macros se filtra porque hay productos con macros reales
        expect(results.length).toBe(2);
        expect(results[0].nombre).toContain('Salchicha Ranchera');
        expect(results[0].caloriasBase).toBe(240);
        expect(results[0].proteinaBase).toBe(13);
        expect(results[0].unidad).toBe('gr'); // Sólido -> gr

        // La bebida líquida debe tener unidad 'ml'
        expect(results[1].nombre).toContain('Bebida de Avena');
        expect(results[1].unidad).toBe('ml');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('11. Normalización de Búsqueda Insensible a Acentos (normalizeFoodSearchText)', () => {
    it('remueve tildes y diacríticos preservando los caracteres base en minúsculas', () => {
      expect(normalizeFoodSearchText('Plátano')).toBe('platano');
      expect(normalizeFoodSearchText('ATÚN')).toBe('atun');
      expect(normalizeFoodSearchText('Café con Leche')).toBe('cafe con leche');
      expect(normalizeFoodSearchText('Jamón Serrano')).toBe('jamon serrano');
      expect(normalizeFoodSearchText('Orégano')).toBe('oregano');
      expect(normalizeFoodSearchText('Güisqui')).toBe('guisqui');
      expect(normalizeFoodSearchText('Mañana')).toBe('manana');
    });

    it('maneja espacios redundantes, strings vacíos y valores nulos/indefinidos', () => {
      expect(normalizeFoodSearchText('   Plátano   maduro   ')).toBe('platano   maduro');
      expect(normalizeFoodSearchText('')).toBe('');
      expect(normalizeFoodSearchText(null as any)).toBe('');
      expect(normalizeFoodSearchText(undefined as any)).toBe('');
    });

    it('permite comparar términos con y sin acento de forma bidireccional', () => {
      const foodName = 'Plátano hartón verde';
      const searchNoAccent = 'platano';
      const searchWithAccent = 'plátano';
      const searchUpper = 'PLÁTANO';

      const normFood = normalizeFoodSearchText(foodName);
      expect(normFood.includes(normalizeFoodSearchText(searchNoAccent))).toBe(true);
      expect(normFood.includes(normalizeFoodSearchText(searchWithAccent))).toBe(true);
      expect(normFood.includes(normalizeFoodSearchText(searchUpper))).toBe(true);
    });
  });

  describe('12. Ordenación Cronológica de Comidas (sortMealsChronologically)', () => {
    it('ordena comidas por su horario HH:MM de menor a mayor y actualiza orden correlativo', () => {
      const unorderedMeals: any[] = [
        { id: 'm3', nombre: 'Cena', horario: '20:30', orden: 1, foods: [] },
        { id: 'm1', nombre: 'Desayuno', horario: '08:00', orden: 2, foods: [] },
        { id: 'm2', nombre: 'Almuerzo', horario: '13:30', orden: 3, foods: [] },
      ];

      const sorted = sortMealsChronologically(unorderedMeals);
      expect(sorted.map((m) => m.nombre)).toEqual(['Desayuno', 'Almuerzo', 'Cena']);
      expect(sorted.map((m) => m.orden)).toEqual([1, 2, 3]);
    });

    it('resuelve el caso donde Media Mañana se reinserta al final tras haber sido eliminada', () => {
      // Simula el caso exacto reportado por el usuario:
      // El día tenía Desayuno, Almuerzo, Merienda, Cena, y el usuario añade Media Mañana que quedó al final
      const mealsWithAppendedMidMorning: any[] = [
        { id: 'm1', nombre: 'Desayuno', horario: '08:00', orden: 1, foods: [] },
        { id: 'm2', nombre: 'Almuerzo', horario: '13:30', orden: 2, foods: [] },
        { id: 'm3', nombre: 'Merienda', horario: '17:00', orden: 3, foods: [] },
        { id: 'm4', nombre: 'Cena', horario: '20:30', orden: 4, foods: [] },
        { id: 'm5', nombre: 'Media Mañana', horario: '10:00', orden: 5, foods: [] },
      ];

      const sorted = sortMealsChronologically(mealsWithAppendedMidMorning);
      expect(sorted.map((m) => m.nombre)).toEqual([
        'Desayuno',
        'Media Mañana',
        'Almuerzo',
        'Merienda',
        'Cena',
      ]);
      expect(sorted.map((m) => m.orden)).toEqual([1, 2, 3, 4, 5]);
      expect(sorted[1].horario).toBe('10:00');
    });

    it('utiliza fallback canónico nutricional cuando no hay horario definido', () => {
      const mealsWithoutTimes: any[] = [
        { id: 'm3', nombre: 'Cena', horario: '', orden: 1, foods: [] },
        { id: 'm2', nombre: 'Almuerzo', horario: '', orden: 2, foods: [] },
        { id: 'm1', nombre: 'Desayuno', horario: '', orden: 3, foods: [] },
        { id: 'm4', nombre: 'Media Mañana', horario: '', orden: 4, foods: [] },
      ];

      const sorted = sortMealsChronologically(mealsWithoutTimes);
      expect(sorted.map((m) => m.nombre)).toEqual([
        'Desayuno',
        'Media Mañana',
        'Almuerzo',
        'Cena',
      ]);
      expect(sorted.map((m) => m.orden)).toEqual([1, 2, 3, 4]);
    });

    it('maneja arreglos vacíos o de un solo elemento sin alterarlos', () => {
      expect(sortMealsChronologically([])).toEqual([]);
      const singleMeal: any = [{ id: 'm1', nombre: 'Desayuno', horario: '08:00', orden: 9, foods: [] }];
      const sortedSingle = sortMealsChronologically(singleMeal);
      expect(sortedSingle.length).toBe(1);
      expect(sortedSingle[0].orden).toBe(1);
    });
  });
});

