// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import masterFoodCatalog from '../../data/masterFoodCatalog.json';
import {
  DEFAULT_MEAL_TEMPLATES,
  getLocalMealTemplates,
  saveMealTemplate,
  getMealTemplates,
  deleteMealTemplate,
  saveNutritionTemplate,
  getNutritionTemplates,
  deleteNutritionTemplate,
} from '../nutritionTemplates';
import { formatDayForWhatsapp, sharePlanViaWhatsapp } from '../nutritionWhatsapp';
import { NutritionPlan, NutritionTemplate, MealTemplate, MealFoodItem, Meal } from '../../types/nutrition.types';

// Mock de Supabase para pruebas offline
vi.mock('../supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    })),
  },
}));

describe('Nutrición 3.0: Opciones 4, 5 y 6 — Plantillas, WhatsApp y Calidad de Catálogo', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  /* =========================================================================
     OPCIÓN 6: CORRECCIÓN Y CONTROL DE CALIDAD EN EL CATÁLOGO DE 1.740 ALIMENTOS
     ========================================================================= */
  describe('Opción 6: Verificación de Integridad y Erratas del Catálogo', () => {
    it('debe contener exactamente 1.740 alimentos en el catálogo maestro', () => {
      expect(masterFoodCatalog).toBeDefined();
      expect(Array.isArray(masterFoodCatalog)).toBe(true);
      expect(masterFoodCatalog.length).toBe(1740);
    });

    it('debe tener corregida la errata de Anchoas en aceite (evo_food_0456)', () => {
      const food = masterFoodCatalog.find((f) => f.id === 'evo_food_0456');
      expect(food).toBeDefined();
      expect(food?.grasaBase).toBe(9.7); // Antes era 97g
      expect(food?.caloriasBase).toBe(203);
      expect((food?.proteinaBase || 0) + (food?.carbohidratosBase || 0) + (food?.grasaBase || 0)).toBeLessThanOrEqual(100);
    });

    it('debe tener corregida la errata de Harina de maíz / maicena (evo_food_0672)', () => {
      const food = masterFoodCatalog.find((f) => f.id === 'evo_food_0672');
      expect(food).toBeDefined();
      expect(food?.caloriasBase).toBe(361); // Antes era 48 kcal
      expect(food?.carbohidratosBase).toBe(75.7);
    });

    it('debe tener corregida la errata de Arequipe (evo_food_0597)', () => {
      const food = masterFoodCatalog.find((f) => f.id === 'evo_food_0597');
      expect(food).toBeDefined();
      expect(food?.caloriasBase).toBe(320); // Antes era 28 kcal
      expect(food?.carbohidratosBase).toBe(56.7);
      expect(food?.grasaBase).toBe(7.5);
    });

    it('debe tener corregida la errata de Leche de vaca fluida 1.65% (evo_food_0035)', () => {
      const food = masterFoodCatalog.find((f) => f.id === 'evo_food_0035');
      expect(food).toBeDefined();
      expect(food?.carbohidratosBase).toBe(4.8); // Antes era 48g
      expect(food?.caloriasBase).toBe(47);
    });

    it('debe tener corregida la errata de Salami primera (evo_food_0371)', () => {
      const food = masterFoodCatalog.find((f) => f.id === 'evo_food_0371');
      expect(food).toBeDefined();
      expect(food?.carbohidratosBase).toBe(2.0); // Antes era 94g
      expect(food?.caloriasBase).toBe(515);
    });

    it('debe tener corregida la errata de Aderezo para ensalada (evo_food_1387)', () => {
      const food = masterFoodCatalog.find((f) => f.id === 'evo_food_1387');
      expect(food).toBeDefined();
      expect(food?.cantidadBase).toBe(15);
      expect(food?.carbohidratosBase).toBe(0.5);
      expect(food?.grasaBase).toBe(8.0);
      expect(food?.caloriasBase).toBe(74);
    });

    it('debe tener corregida la errata de Altramuces en salmuera (evo_food_0757)', () => {
      const food = masterFoodCatalog.find((f) => f.id === 'evo_food_0757');
      expect(food).toBeDefined();
      expect(food?.caloriasBase).toBe(128); // Antes era 496 kcal
    });

    it('debe tener corregida la errata de Sobrasada mallorquina (evo_food_0389)', () => {
      const food = masterFoodCatalog.find((f) => f.id === 'evo_food_0389');
      expect(food).toBeDefined();
      expect(food?.carbohidratosBase).toBe(1.5); // Antes era 34g
      expect(food?.caloriasBase).toBe(566);
    });

    it('CERO alimentos deben violar la ley de conservación de masa (P + C + G > porción en gramos)', () => {
      const gramFoods = masterFoodCatalog.filter((f) => f.unidad === 'g' || f.unidad === 'gr');
      const massViolations = gramFoods.filter((f) => {
        const sum = (f.proteinaBase || 0) + (f.carbohidratosBase || 0) + (f.grasaBase || 0);
        return sum > (f.cantidadBase || 100) + 1;
      });
      expect(gramFoods.length).toBeGreaterThan(1600);
      expect(massViolations.length).toBe(0);
    });
  });

  /* =========================================================================
     OPCIÓN 4: SISTEMA DE PLANTILLAS EN DOS NIVELES (RECETAS Y DIETAS COMPLETAS)
     ========================================================================= */
  describe('Opción 4 — Nivel 1: Plantillas de Comidas / Recetas Reusables', () => {
    it('debe devolver las recetas predeterminadas del sistema cuando no hay recetas locales', () => {
      const templates = getLocalMealTemplates('trainer-1');
      expect(templates.length).toBeGreaterThanOrEqual(2);
      expect(templates[0].nombre).toContain('Desayuno');
      expect(templates.some((t) => t.categoria === 'Almuerzo')).toBe(true);
    });

    it('debe guardar una nueva receta reusable y recuperarla correctamente', async () => {
      const newRecipe: Omit<MealTemplate, 'id' | 'created_at' | 'updated_at'> = {
        entrenador_id: 'trainer-test-01',
        nombre: 'Desayuno Anabólico 1',
        categoria: 'Desayuno',
        horario_sugerido: '07:30',
        foods: [
          {
            id: 'item-1',
            foodId: 'evo_food_0001',
            nombre: 'Huevo entero promedio',
            grupo: 'Huevos',
            subgrupo: 'Huevos',
            cantidad: 150,
            cantidadBase: 50,
            unidad: 'g',
            calorias: 216,
            proteina: 19.2,
            carbohidratos: 0.9,
            grasa: 14.7,
          },
          {
            id: 'item-2',
            foodId: 'evo_food_0667',
            nombre: 'Avena en copos',
            grupo: 'Cereales y Tubérculos',
            subgrupo: 'Cereales',
            cantidad: 80,
            cantidadBase: 100,
            unidad: 'gr',
            calorias: 294,
            proteina: 9.4,
            carbohidratos: 47,
            grasa: 5.7,
          },
        ],
      };

      const saved = await saveMealTemplate(newRecipe);
      expect(saved.id).toBeDefined();
      expect(saved.nombre).toBe('Desayuno Anabólico 1');
      expect(saved.foods.length).toBe(2);

      // Recuperar de la lista
      const list = await getMealTemplates('trainer-test-01');
      const found = list.find((t) => t.id === saved.id);
      expect(found).toBeDefined();
      expect(found?.nombre).toBe('Desayuno Anabólico 1');
    });

    it('debe eliminar una receta existente', async () => {
      const saved = await saveMealTemplate({
        entrenador_id: 'trainer-test-01',
        nombre: 'Receta a Borrar',
        categoria: 'Snack',
        horario_sugerido: '17:00',
        foods: [],
      });

      const deleted = await deleteMealTemplate(saved.id, 'trainer-test-01');
      expect(deleted).toBe(true);

      const list = await getMealTemplates('trainer-test-01');
      expect(list.some((t) => t.id === saved.id)).toBe(false);
    });

    it('debe clonar los alimentos al insertarlos en una comida generando nuevos IDs únicos', () => {
      const recipe = DEFAULT_MEAL_TEMPLATES[0];
      const targetMeal: Meal = {
        id: 'meal-target-1',
        nombre: 'Desayuno',
        horario: '08:00',
        orden: 1,
        foods: [],
      };

      // Simular la inserción (como se hace en NutritionPlannerModal)
      const clonedFoods: MealFoodItem[] = recipe.foods.map((food, fIdx) => ({
        ...food,
        id: `food_${Date.now()}_${fIdx}_${Math.random().toString(36).substring(2, 6)}`,
      }));

      targetMeal.foods.push(...clonedFoods);

      expect(targetMeal.foods.length).toBe(recipe.foods.length);
      // Los IDs deben ser distintos a los de la receta original
      expect(targetMeal.foods[0].id).not.toBe(recipe.foods[0].id);
      // Pero los macros y cantidades deben ser exactamente los mismos
      expect(targetMeal.foods[0].calorias).toBe(recipe.foods[0].calorias);
      expect(targetMeal.foods[0].proteina).toBe(recipe.foods[0].proteina);

      // Modificar el alimento en la comida no debe mutar la receta original
      targetMeal.foods[0].cantidad = 200;
      expect(recipe.foods[0].cantidad).not.toBe(200);
    });
  });

  describe('Opción 4 — Nivel 2: Plantillas de Dieta Completa (100% Editables)', () => {
    const mockPlan: NutritionPlan = {
      id: 'plan-orig-123',
      cliente_id: 'atleta-juan',
      entrenador_id: 'trainer-01',
      nombre: 'Plan Hipertrofia Avanzada 3000 kcal',
      objetivo: 'Aumento de Masa Muscular',
      modo: 'semanal',
      activo: true,
      target_calorias: 3000,
      target_proteina_g: 200,
      target_carbohidratos_g: 380,
      target_grasa_g: 75,
      ajuste_calorico_pct: 15,
      recomendaciones: 'Tomar 3.5L de agua al día.',
      datos_plan: {
        modo: 'semanal',
        days: {
          lunes: {
            id: 'day-lunes-1',
            diaSemana: 'lunes',
            nombre: 'Lunes de Fuerza',
            comidas_count: 2,
            meals: [
              {
                id: 'm1',
                nombre: 'Desayuno',
                horario: '08:00',
                orden: 1,
                foods: [
                  {
                    id: 'f1',
                    foodId: 'evo_food_0001',
                    nombre: 'Huevo entero',
                    grupo: 'Huevos',
                    subgrupo: 'Huevos',
                    cantidad: 150,
                    cantidadBase: 50,
                    unidad: 'g',
                    calorias: 216,
                    proteina: 19.2,
                    carbohidratos: 0.9,
                    grasa: 14.7,
                  },
                ],
              },
              {
                id: 'm2',
                nombre: 'Almuerzo',
                horario: '13:00',
                orden: 2,
                foods: [
                  {
                    id: 'f2',
                    foodId: 'evo_food_1401',
                    nombre: 'Pechuga de pollo',
                    grupo: 'Carnes y Aves',
                    subgrupo: 'Carnes',
                    cantidad: 200,
                    cantidadBase: 100,
                    unidad: 'gr',
                    calorias: 330,
                    proteina: 62,
                    carbohidratos: 0,
                    grasa: 7.2,
                  },
                ],
              },
            ],
          },
        },
      },
    };

    it('debe guardar un plan de dieta completo como plantilla', async () => {
      const savedTemplate = await saveNutritionTemplate({
        entrenador_id: 'trainer-01',
        nombre: 'Plantilla Definición 2200 kcal',
        descripcion: 'Dieta alta en proteína para atletas de combate',
        objetivo: 'Definición Muscular',
        target_calorias: 2200,
        target_proteina_g: 180,
        target_carbohidratos_g: 220,
        target_grasa_g: 55,
        datos_plan: mockPlan.datos_plan,
      });

      expect(savedTemplate.id).toBeDefined();
      expect(savedTemplate.nombre).toBe('Plantilla Definición 2200 kcal');
      expect(savedTemplate.dias_count).toBe(1);
      expect(savedTemplate.comidas_count).toBe(2);

      const templates = await getNutritionTemplates('trainer-01');
      expect(templates.length).toBeGreaterThanOrEqual(1);
      expect(templates[0].id).toBe(savedTemplate.id);
    });

    it('debe cargar una plantilla en otro atleta manteniendo independencia y editabilidad al 100%', () => {
      const template: NutritionTemplate = {
        id: 'tmpl-hipertrofia-1',
        entrenador_id: 'trainer-01',
        nombre: 'Plantilla Base Hipertrofia',
        descripcion: 'Base reutilizable',
        objetivo: 'Volumen Limpio',
        target_calorias: 2800,
        target_proteina_g: 190,
        target_carbohidratos_g: 350,
        target_grasa_g: 70,
        datos_plan: mockPlan.datos_plan,
        dias_count: 1,
        comidas_count: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Nuevo atleta con sus propias metas de valoración antropométrica (ej. 2500 kcal)
      const atletaNuevoPlan: NutritionPlan = {
        id: 'plan-atleta-carlos',
        cliente_id: 'atleta-carlos-id',
        entrenador_id: 'trainer-01',
        nombre: 'Plan Nutricional — Carlos',
        objetivo: 'Mantenimiento',
        modo: 'semanal',
        target_calorias: 2500, // Fijado por valoración antropométrica
        target_proteina_g: 175,
        target_carbohidratos_g: 300,
        target_grasa_g: 65,
        activo: true,
        datos_plan: { days: {} as any, modo: 'semanal' },
      };

      // Simular carga de plantilla según la lógica implementada en handleLoadDietTemplate
      const clonedDays = JSON.parse(JSON.stringify(template.datos_plan.days));
      Object.keys(clonedDays).forEach((dayKey) => {
        const d = clonedDays[dayKey as any];
        if (d && Array.isArray(d.meals)) {
          d.meals = d.meals.map((meal: Meal, mIdx: number) => ({
            ...meal,
            id: `m_new_${mIdx}`,
            foods: (meal.foods || []).map((f: MealFoodItem, fIdx: number) => ({
              ...f,
              id: `food_new_${mIdx}_${fIdx}`,
            })),
          }));
        }
      });

      const updatedPlan: NutritionPlan = {
        ...atletaNuevoPlan,
        // Conservar las metas del atleta calculadas de su antropometría si ya existen
        target_calorias: atletaNuevoPlan.target_calorias > 0 ? atletaNuevoPlan.target_calorias : (template.target_calorias ?? 0),
        target_proteina_g: atletaNuevoPlan.target_proteina_g > 0 ? atletaNuevoPlan.target_proteina_g : (template.target_proteina_g ?? 0),
        target_carbohidratos_g: atletaNuevoPlan.target_carbohidratos_g > 0 ? atletaNuevoPlan.target_carbohidratos_g : (template.target_carbohidratos_g ?? 0),
        target_grasa_g: atletaNuevoPlan.target_grasa_g > 0 ? atletaNuevoPlan.target_grasa_g : (template.target_grasa_g ?? 0),
        objetivo: template.objetivo,
        datos_plan: {
          ...atletaNuevoPlan.datos_plan,
          days: clonedDays,
        },
      };

      // 1. Verificar que preservó las calorías del nuevo atleta
      expect(updatedPlan.target_calorias).toBe(2500);
      expect(updatedPlan.target_proteina_g).toBe(175);

      // 2. Verificar que las comidas fueron cargadas
      expect(updatedPlan.datos_plan.days.lunes.meals.length).toBe(2);

      // 3. Verificar que los IDs son nuevos
      expect(updatedPlan.datos_plan.days.lunes.meals[0].id).toBe('m_new_0');
      expect(updatedPlan.datos_plan.days.lunes.meals[0].foods[0].id).toBe('food_new_0_0');

      // 4. Verificar 100% editabilidad e independencia: editar o borrar comidas no muta la plantilla
      updatedPlan.datos_plan.days.lunes.meals[0].foods[0].cantidad = 500;
      expect(template.datos_plan.days.lunes.meals[0].foods[0].cantidad).toBe(150);

      // Borrar una comida del plan del atleta
      updatedPlan.datos_plan.days.lunes.meals.pop();
      expect(updatedPlan.datos_plan.days.lunes.meals.length).toBe(1);
      expect(template.datos_plan.days.lunes.meals.length).toBe(2);
    });

    it('debe permitir eliminar una plantilla de dieta', async () => {
      const saved = await saveNutritionTemplate({
        entrenador_id: 'trainer-01',
        nombre: 'Dieta Temporal',
        target_calorias: 2000,
        target_proteina_g: 150,
        target_carbohidratos_g: 200,
        target_grasa_g: 50,
        datos_plan: mockPlan.datos_plan,
      });

      const deleted = await deleteNutritionTemplate(saved.id, 'trainer-01');
      expect(deleted).toBe(true);

      const list = await getNutritionTemplates('trainer-01');
      expect(list.some((t) => t.id === saved.id)).toBe(false);
    });
  });

  /* =========================================================================
     OPCIÓN 5: BOTÓN DIRECTO Y FORMATO DE COMPARTIR POR WHATSAPP
     ========================================================================= */
  describe('Opción 5: Compartir Plan y Día por WhatsApp', () => {
    const samplePlan: NutritionPlan = {
      id: 'plan-wsp-test',
      cliente_id: 'atleta-maria',
      entrenador_id: 'coach-pedro',
      nombre: 'Plan Tonificación',
      objetivo: 'Pérdida de Grasa',
      modo: 'semanal',
      activo: true,
      target_calorias: 1800,
      target_proteina_g: 140,
      target_carbohidratos_g: 160,
      target_grasa_g: 45,
      recomendaciones: 'Tomar té verde en ayunas y no cenar después de las 21:30.',
      datos_plan: {
        modo: 'semanal',
        days: {
          lunes: {
            id: 'day-lunes-2',
            diaSemana: 'lunes',
            nombre: 'Lunes',
            comidas_count: 2,
            meals: [
              {
                id: 'm1',
                nombre: 'Desayuno',
                horario: '08:30',
                orden: 1,
                foods: [
                  {
                    id: 'f1',
                    foodId: 'evo_food_0001',
                    nombre: 'Huevo entero promedio',
                    grupo: 'Huevos',
                    subgrupo: 'Huevos',
                    cantidad: 100,
                    cantidadBase: 50,
                    unidad: 'g',
                    calorias: 144,
                    proteina: 12.8,
                    carbohidratos: 0.6,
                    grasa: 9.8,
                  },
                ],
              },
              {
                id: 'm2',
                nombre: 'Almuerzo Saludable',
                horario: '13:30',
                orden: 2,
                foods: [
                  {
                    id: 'f2',
                    foodId: 'evo_food_1401',
                    nombre: 'Pechuga de pollo a la plancha',
                    grupo: 'Carnes y Aves',
                    subgrupo: 'Carnes',
                    cantidad: 150,
                    cantidadBase: 100,
                    unidad: 'gr',
                    calorias: 247,
                    proteina: 46.5,
                    carbohidratos: 0,
                    grasa: 5.4,
                  },
                ],
              },
            ],
          },
        },
      },
    };

    it('debe formatear el texto de WhatsApp con encabezado, emojis, metas y comidas', () => {
      const text = formatDayForWhatsapp(samplePlan, 'lunes', 'María Pérez', 'Coach Pedro');

      expect(text).toContain('PLAN NUTRICIONAL — EVOLUTION LAB');
      expect(text).toContain('María Pérez');
      expect(text).toContain('Coach Pedro');
      expect(text).toContain('LUNES');
      expect(text).toContain('1800 kcal');
      expect(text).toContain('*1. DESAYUNO* (08:30)');
      expect(text).toContain('Huevo entero promedio: *100 g* (144 kcal)');
      expect(text).toContain('*2. ALMUERZO SALUDABLE* (13:30)');
      expect(text).toContain('Pechuga de pollo a la plancha: *150 gr* (247 kcal)');
      expect(text).toContain('TOTAL DEL DÍA:');
      expect(text).toContain('Tomar té verde en ayunas');
    });

    it('debe manejar días sin comidas sin romperse', () => {
      const text = formatDayForWhatsapp(samplePlan, 'martes', 'María Pérez');
      expect(text).toContain('No hay comidas asignadas para este día');
    });

    it('debe generar la URL de WhatsApp debidamente codificada y abrir ventana', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      const res = sharePlanViaWhatsapp(samplePlan, 'lunes', 'María Pérez', 'Coach Pedro');
      expect(res.success).toBe(true);
      expect(windowOpenSpy).toHaveBeenCalledTimes(1);

      const calledUrl = windowOpenSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('https://api.whatsapp.com/send?text=');
      // Debe contener parámetros codificados
      expect(calledUrl).toContain(encodeURIComponent('María Pérez'));
      expect(calledUrl).toContain(encodeURIComponent('PLAN NUTRICIONAL'));

      windowOpenSpy.mockRestore();
    });
  });
});
