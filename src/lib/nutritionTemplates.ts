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
        caloriasBase: 368,
        proteinaBase: 11.8,
        carbohidratosBase: 58.8,
        grasaBase: 7.1,
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
        caloriasBase: 72,
        proteinaBase: 6.4,
        carbohidratosBase: 0.3,
        grasaBase: 4.9,
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
        caloriasBase: 165,
        proteinaBase: 31,
        carbohidratosBase: 0,
        grasaBase: 3.6,
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
        caloriasBase: 130,
        proteinaBase: 2.6,
        carbohidratosBase: 28,
        grasaBase: 0.3,
      },
      {
        id: 'def-f5',
        foodId: 'evo_food_0950',
        nombre: 'Aguacate Hass',
        grupo: 'Grasas y Frutos Secos',
        subgrupo: 'Base ICBF / USDA',
        cantidad: 60,
        cantidadBase: 100,
        unidad: 'gr',
        calorias: 133,
        proteina: 0.8,
        carbohidratos: 8.1,
        grasa: 9.8,
        caloriasBase: 221,
        proteinaBase: 1.3,
        carbohidratosBase: 13.5,
        grasaBase: 16.4,
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

  // 2. Intentar sincronizar con Supabase
  try {
    const payloadFull = {
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
    };

    const { error } = await supabase.from('plantillas_nutricionales').upsert(payloadFull);
    if (error) {
      // Si la tabla en Supabase todavía no tiene las columnas de la migración v15 (código 42703: undefined_column),
      // reintentar de inmediato con las columnas base para que la plantilla sí llegue a la nube.
      if (
        error.code === '42703' ||
        error.message?.includes('target_proteina_g') ||
        error.message?.includes('column') ||
        error.message?.includes('does not exist')
      ) {
        console.warn(
          '[NutritionTemplates] Columnas extendidas no detectadas en Supabase (migración v15 pendiente). Reintentando con esquema base...'
        );
        const payloadBase = {
          id: template.id,
          entrenador_id: template.entrenador_id,
          nombre: template.nombre,
          descripcion: template.descripcion,
          objetivo: template.objetivo,
          target_calorias: template.target_calorias,
          datos_plan: template.datos_plan,
        };
        const { error: fallbackError } = await supabase.from('plantillas_nutricionales').upsert(payloadBase);
        if (fallbackError) {
          console.warn('[NutritionTemplates] Error al guardar plantilla con esquema base:', fallbackError);
        }
      } else {
        console.warn('[NutritionTemplates] Error al sincronizar plantilla con Supabase:', error.message || error);
      }
    }
  } catch (err) {
    console.warn('[NutritionTemplates] Error de red al sincronizar con la nube:', err);
  }

  return template;
}

/**
 * Obtiene todas las plantillas de dieta del entrenador (sincronizando automáticamente
 * cualquier plantilla local previa que no haya alcanzado la nube).
 */
export async function getNutritionTemplates(trainerId: string): Promise<NutritionTemplate[]> {
  const localList = getLocalDietTemplates(trainerId);

  try {
    const { data, error } = await supabase
      .from('plantillas_nutricionales')
      .select('*')
      .eq('entrenador_id', trainerId)
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const remoteTemplates = data as unknown as NutritionTemplate[];
      const remoteIds = new Set(remoteTemplates.map((r) => r.id));

      // Sincronización automática de plantillas locales históricas hacia la nube:
      // Si el entrenador tiene plantillas en su navegador que no llegaron a Supabase
      // debido al desajuste previo de columnas, subirlas en segundo plano.
      const unsyncedLocals = localList.filter((local) => !remoteIds.has(local.id));
      if (unsyncedLocals.length > 0) {
        Promise.allSettled(unsyncedLocals.map((tpl) => saveNutritionTemplate(tpl))).catch(() => {});
      }

      // Fusionar remotas y locales
      const mergedMap = new Map<string, NutritionTemplate>();
      remoteTemplates.forEach((t) => mergedMap.set(t.id, t));
      localList.forEach((t) => {
        if (!mergedMap.has(t.id)) mergedMap.set(t.id, t);
      });
      const mergedList = Array.from(mergedMap.values());

      saveLocalDietTemplates(trainerId, mergedList);
      return mergedList;
    } else if (error) {
      console.warn('[NutritionTemplates] Error al consultar plantillas:', error.message || error);
    }
  } catch (err) {
    console.warn('[NutritionTemplates] Red no disponible al consultar plantillas:', err);
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
    const { error } = await supabase.from('plantillas_nutricionales').delete().eq('id', id);
    if (error) {
      console.warn('[NutritionTemplates] Error al eliminar plantilla en Supabase:', error.message || error);
    }
  } catch (err) {
    console.warn('[NutritionTemplates] Red no disponible al eliminar plantilla:', err);
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
    const { error } = await supabase.from('recetas_nutricionales').upsert({
      id: template.id,
      entrenador_id: template.entrenador_id,
      nombre: template.nombre,
      categoria: template.categoria,
      horario_sugerido: template.horario_sugerido,
      foods: template.foods,
      updated_at: template.updated_at,
    });
    if (error) {
      console.warn('[MealTemplates] Error de Supabase al guardar receta en la nube:', error.message || error);
    }
  } catch (err) {
    console.warn('[MealTemplates] Error de red al sincronizar receta con la nube:', err);
  }

  return template;
}

/**
 * Obtiene todas las recetas de comida del entrenador (sincronizando automáticamente
 * cualquier receta local previa que no haya alcanzado la nube).
 */
export async function getMealTemplates(trainerId: string): Promise<MealTemplate[]> {
  const localList = getLocalMealTemplates(trainerId);

  try {
    const { data, error } = await supabase
      .from('recetas_nutricionales')
      .select('*')
      .eq('entrenador_id', trainerId)
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const remoteRecipes = data as unknown as MealTemplate[];
      const remoteIds = new Set(remoteRecipes.map((r) => r.id));

      // Sincronizar recetas locales huérfanas hacia la nube
      const unsyncedLocals = localList.filter(
        (local) => local.entrenador_id !== 'system' && !remoteIds.has(local.id)
      );
      if (unsyncedLocals.length > 0) {
        Promise.allSettled(unsyncedLocals.map((m) => saveMealTemplate(m))).catch(() => {});
      }

      // Fusionar remotas con locales y las default del sistema
      const mergedMap = new Map<string, MealTemplate>();
      DEFAULT_MEAL_TEMPLATES.forEach((def) => mergedMap.set(def.id, def));
      remoteRecipes.forEach((m) => mergedMap.set(m.id, m));
      localList.forEach((m) => {
        if (!mergedMap.has(m.id)) mergedMap.set(m.id, m);
      });
      const mergedList = Array.from(mergedMap.values());

      saveLocalMealTemplates(trainerId, mergedList);
      return mergedList;
    } else if (error) {
      console.warn('[MealTemplates] Error al consultar recetas:', error.message || error);
    }
  } catch (err) {
    console.warn('[MealTemplates] Red no disponible al consultar recetas:', err);
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
    const { error } = await supabase.from('recetas_nutricionales').delete().eq('id', id);
    if (error) {
      console.warn('[MealTemplates] Error al eliminar receta en Supabase:', error.message || error);
    }
  } catch (err) {
    console.warn('[MealTemplates] Red no disponible al eliminar receta:', err);
  }

  return true;
}
