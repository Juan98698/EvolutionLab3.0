import { supabase } from './supabaseClient';
import { NutritionTemplate, MealTemplate } from '../types/nutrition.types';

const DIET_TEMPLATES_KEY_PREFIX = 'evolution_diet_templates_';
const MEAL_TEMPLATES_KEY_PREFIX = 'evolution_meal_templates_';

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Plantillas predeterminadas de comidas para dar valor inmediato al entrenador
 */
export const DEFAULT_MEAL_TEMPLATES: MealTemplate[] = [
  {
    id: 'default-meal-desayuno-1',
    entrenador_id: 'system',
    nombre: 'Desayuno Proteico Clásico de Avena y Huevo',
    categoria: 'Desayuno',
    horario_sugerido: '08:00',
    foods: [
      {
        id: 'def-f1',
        foodId: 'evo_food_0667',
        nombre: 'Avena en copos',
        grupo: 'Cereales y Tubérculos',
        subgrupo: 'Cereales y Derivados',
        cantidad: 80,
        cantidadBase: 100,
        unidad: 'gr',
        calorias: 294,
        proteina: 9.4,
        carbohidratos: 47,
        grasa: 5.7,
      },
      {
        id: 'def-f2',
        foodId: 'evo_food_0001',
        nombre: 'Huevo entero promedio (una unidad)',
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
    id: 'default-meal-almuerzo-1',
    entrenador_id: 'system',
    nombre: 'Almuerzo Fitness (Pollo, Arroz y Aguacate)',
    categoria: 'Almuerzo',
    horario_sugerido: '13:00',
    foods: [
      {
        id: 'def-f3',
        foodId: 'evo_food_1401',
        nombre: 'Pechuga de pollo a la plancha',
        grupo: 'Carnes y Aves',
        subgrupo: 'Base ICBF / USDA',
        cantidad: 180,
        cantidadBase: 100,
        unidad: 'gr',
        calorias: 297,
        proteina: 55.8,
        carbohidratos: 0,
        grasa: 6.5,
      },
      {
        id: 'def-f4',
        foodId: 'evo_food_0658',
        nombre: 'Arroz blanco',
        grupo: 'Cereales y Tubérculos',
        subgrupo: 'Cereales y Derivados',
        cantidad: 150,
        cantidadBase: 100,
        unidad: 'gr',
        calorias: 195,
        proteina: 3.9,
        carbohidratos: 42,
        grasa: 0.5,
      },
      {
        id: 'def-f5',
        foodId: 'evo_food_1001',
        nombre: 'Aguacate Hass',
        grupo: 'Grasas y Frutos Secos',
        subgrupo: 'Base ICBF / USDA',
        cantidad: 60,
        cantidadBase: 100,
        unidad: 'gr',
        calorias: 96,
        proteina: 1.2,
        carbohidratos: 5.1,
        grasa: 9,
      },
    ],
  },
];

/* =========================================================================
   1. PLANTILLAS DE DIETAS COMPLETAS (NutritionTemplate)
   ========================================================================= */

function getDietStorageKey(trainerId: string): string {
  return `${DIET_TEMPLATES_KEY_PREFIX}${trainerId || 'default'}`;
}

export function getLocalDietTemplates(trainerId: string): NutritionTemplate[] {
  try {
    const raw = localStorage.getItem(getDietStorageKey(trainerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[NutritionTemplates] Error al leer plantillas locales de dieta:', err);
    return [];
  }
}

export function saveLocalDietTemplates(trainerId: string, templates: NutritionTemplate[]): void {
  try {
    localStorage.setItem(getDietStorageKey(trainerId), JSON.stringify(templates));
  } catch (err) {
    console.warn('[NutritionTemplates] Error al guardar plantillas locales de dieta:', err);
  }
}

/**
 * Guarda o actualiza una plantilla de dieta completa
 */
export async function saveNutritionTemplate(
  data: Omit<NutritionTemplate, 'id'> & { id?: string }
): Promise<NutritionTemplate> {
  const trainerId = data.entrenador_id || 'default';
  const id = data.id || generateUUID();
  const now = new Date().toISOString();

  // Calcular conteo de días y comidas
  const daysKeys = Object.keys(data.datos_plan?.days || {});
  let totalMeals = 0;
  daysKeys.forEach((dk) => {
    totalMeals += data.datos_plan?.days?.[dk as any]?.meals?.length || 0;
  });

  const template: NutritionTemplate = {
    ...data,
    id,
    dias_count: daysKeys.length || 7,
    comidas_count: totalMeals,
    created_at: data.created_at || now,
    updated_at: now,
  };

  // 1. Guardar localmente (Offline First)
  const localList = getLocalDietTemplates(trainerId);
  const existingIdx = localList.findIndex((t) => t.id === id);
  if (existingIdx >= 0) {
    localList[existingIdx] = template;
  } else {
    localList.unshift(template);
  }
  saveLocalDietTemplates(trainerId, localList);

  // 2. Intentar sincronizar con Supabase si existe la tabla
  try {
    await supabase.from('plantillas_nutricionales').upsert({
      id: template.id,
      entrenador_id: template.entrenador_id,
      nombre: template.nombre,
      descripcion: template.descripcion,
      objetivo: template.objetivo,
      target_calorias: template.target_calorias,
      target_proteina_g: template.target_proteina_g,
      target_carbohidratos_g: template.target_carbohidratos_g,
      target_grasa_g: template.target_grasa_g,
      datos_plan: template.datos_plan,
      updated_at: template.updated_at,
    });
  } catch {
    // Modo offline o tabla no creada aún; la persistencia local garantiza continuidad
  }

  return template;
}

/**
 * Obtiene todas las plantillas de dieta del entrenador
 */
export async function getNutritionTemplates(trainerId: string): Promise<NutritionTemplate[]> {
  const localList = getLocalDietTemplates(trainerId);

  try {
    const { data, error } = await supabase
      .from('plantillas_nutricionales')
      .select('*')
      .eq('entrenador_id', trainerId)
      .order('updated_at', { ascending: false });

    if (!error && data && data.length > 0) {
      // Sincronizar cache local con la nube
      saveLocalDietTemplates(trainerId, data as unknown as NutritionTemplate[]);
      return data as unknown as NutritionTemplate[];
    }
  } catch {
    // Red no disponible o tabla en desarrollo
  }

  return localList;
}

/**
 * Elimina una plantilla de dieta
 */
export async function deleteNutritionTemplate(id: string, trainerId: string): Promise<boolean> {
  const localList = getLocalDietTemplates(trainerId).filter((t) => t.id !== id);
  saveLocalDietTemplates(trainerId, localList);

  try {
    await supabase.from('plantillas_nutricionales').delete().eq('id', id);
  } catch {
    // Ignorar si offline
  }

  return true;
}

/* =========================================================================
   2. PLANTILLAS DE COMIDAS / RECETAS (MealTemplate)
   ========================================================================= */

function getMealStorageKey(trainerId: string): string {
  return `${MEAL_TEMPLATES_KEY_PREFIX}${trainerId || 'default'}`;
}

export function getLocalMealTemplates(trainerId: string): MealTemplate[] {
  try {
    const raw = localStorage.getItem(getMealStorageKey(trainerId));
    if (!raw) return DEFAULT_MEAL_TEMPLATES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_MEAL_TEMPLATES;
    }
    return parsed;
  } catch (err) {
    console.warn('[MealTemplates] Error al leer recetas locales:', err);
    return DEFAULT_MEAL_TEMPLATES;
  }
}

export function saveLocalMealTemplates(trainerId: string, templates: MealTemplate[]): void {
  try {
    localStorage.setItem(getMealStorageKey(trainerId), JSON.stringify(templates));
  } catch (err) {
    console.warn('[MealTemplates] Error al guardar recetas locales:', err);
  }
}

/**
 * Guarda una comida/receta guardada
 */
export async function saveMealTemplate(
  data: Omit<MealTemplate, 'id'> & { id?: string }
): Promise<MealTemplate> {
  const trainerId = data.entrenador_id || 'default';
  const id = data.id || generateUUID();
  const now = new Date().toISOString();

  const template: MealTemplate = {
    ...data,
    id,
    created_at: data.created_at || now,
    updated_at: now,
  };

  const current = getLocalMealTemplates(trainerId);
  const existingIdx = current.findIndex((m) => m.id === id);
  let updatedList: MealTemplate[];

  if (existingIdx >= 0) {
    updatedList = [...current];
    updatedList[existingIdx] = template;
  } else {
    updatedList = [template, ...current];
  }

  saveLocalMealTemplates(trainerId, updatedList);

  try {
    await supabase.from('recetas_nutricionales').upsert({
      id: template.id,
      entrenador_id: template.entrenador_id,
      nombre: template.nombre,
      categoria: template.categoria,
      horario_sugerido: template.horario_sugerido,
      foods: template.foods,
      updated_at: template.updated_at,
    });
  } catch {
    // Offline
  }

  return template;
}

/**
 * Obtiene todas las recetas de comida del entrenador
 */
export async function getMealTemplates(trainerId: string): Promise<MealTemplate[]> {
  const localList = getLocalMealTemplates(trainerId);

  try {
    const { data, error } = await supabase
      .from('recetas_nutricionales')
      .select('*')
      .eq('entrenador_id', trainerId)
      .order('updated_at', { ascending: false });

    if (!error && data && data.length > 0) {
      saveLocalMealTemplates(trainerId, data as unknown as MealTemplate[]);
      return data as unknown as MealTemplate[];
    }
  } catch {
    // Fallback local
  }

  return localList;
}

/**
 * Elimina una receta de comida
 */
export async function deleteMealTemplate(id: string, trainerId: string): Promise<boolean> {
  const current = getLocalMealTemplates(trainerId).filter((m) => m.id !== id);
  saveLocalMealTemplates(trainerId, current);

  try {
    await supabase.from('recetas_nutricionales').delete().eq('id', id);
  } catch {
    // Offline
  }

  return true;
}
