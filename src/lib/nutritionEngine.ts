import {
  FoodItem,
  FoodGroup,
  MealFoodItem,
  Meal,
  NutritionDay,
  NutritionPlan,
  NutritionalTarget,
  NutritionTotals,
  NutritionCompliance,
  DayOfWeek,
  DominantMacro,
  FoodEquivalentOption,
  FoodEquivalentsGroupedSuggestions,
} from '../types/nutrition.types';
import { ValoracionAntropometrica } from '../types/database.types';
import { idbGet, idbSet } from './indexedDbStore';
import { supabase } from './supabaseClient';
import { BASE_FOOD_CATALOG } from '../data/foodCatalog';

export const DAYS_OF_WEEK: { key: DayOfWeek; label: string }[] = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
];

export const DEFAULT_MEALS: { nombre: string; horario: string }[] = [
  { nombre: '🍳 Desayuno', horario: '08:00' },
  { nombre: '🍎 Media Mañana', horario: '10:30' },
  { nombre: '🥩 Almuerzo', horario: '13:00' },
  { nombre: '⚡ Merienda / Pre-Entreno', horario: '16:30' },
  { nombre: '🥗 Cena', horario: '20:00' },
];

/**
 * Normaliza una cadena para búsquedas insensibles a mayúsculas, minúsculas, espacios y acentos/diacríticos.
 * Por ejemplo: "Plátano" -> "platano", "Atún" -> "atun", "Café" -> "cafe", "Mañana" -> "manana".
 */
export function normalizeFoodSearchText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Ordena las comidas de un día en riguroso orden cronológico según su horario (HH:MM).
 * En caso de ausencia de horario o empate, recurre al orden canónico nutricional.
 * Reasigna orden correlativo (1, 2, 3...) tras la ordenación.
 */
export function sortMealsChronologically(meals: Meal[]): Meal[] {
  if (!Array.isArray(meals) || meals.length <= 1) {
    return Array.isArray(meals)
      ? meals.map((m, idx) => ({ ...m, orden: idx + 1 }))
      : [];
  }

  const getMealMinutes = (meal: Meal): number => {
    if (meal.horario && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(meal.horario.trim())) {
      const [h, m] = meal.horario.trim().split(':').map(Number);
      return h * 60 + m;
    }

    const norm = normalizeFoodSearchText(meal.nombre);
    if (norm.includes('desayuno')) return 8 * 60; // 08:00
    if (norm.includes('media manana') || norm.includes('almuerzo 1') || norm.includes('snack matutino')) return 10 * 60 + 30; // 10:30
    if (norm.includes('almuerzo') || norm.includes('comida')) return 13 * 60 + 30; // 13:30
    if (norm.includes('merienda') || norm.includes('media tarde')) return 16 * 60 + 30; // 16:30
    if (norm.includes('pre-entreno') || norm.includes('pre entreno') || norm.includes('preentreno')) return 17 * 60; // 17:00
    if (norm.includes('post-entreno') || norm.includes('post entreno') || norm.includes('postentreno')) return 18 * 60 + 30; // 18:30
    if (norm.includes('cena')) return 20 * 60 + 30; // 20:30
    if (norm.includes('nocturno') || norm.includes('recena') || norm.includes('dormir')) return 22 * 60 + 30; // 22:30
    if (norm.includes('colacion') || norm.includes('snack')) return 11 * 60; // 11:00

    return (meal.orden ?? 99) * 100;
  };

  return [...meals]
    .sort((a, b) => {
      const minA = getMealMinutes(a);
      const minB = getMealMinutes(b);
      if (minA !== minB) return minA - minB;
      return (a.orden ?? 0) - (b.orden ?? 0);
    })
    .map((m, idx) => ({ ...m, orden: idx + 1 }));
}


/**
 * Redondeo a 1 decimal para macronutrientes
 */
export function round1(num: number): number {
  return Math.round((num + Number.EPSILON) * 10) / 10;
}

/**
 * Calcula los macros proporcionales de un alimento según la cantidad ingresada
 */
export function calculatePortionMacros(
  food: {
    cantidadBase: number;
    caloriasBase: number;
    proteinaBase: number;
    carbohidratosBase: number;
    grasaBase: number;
  },
  cantidad: number
): { calorias: number; proteina: number; carbohidratos: number; grasa: number } {
  const base = food.cantidadBase > 0 ? food.cantidadBase : 100;
  const ratio = (Number(cantidad) || 0) / base;

  return {
    calorias: Math.round(food.caloriasBase * ratio),
    proteina: round1(food.proteinaBase * ratio),
    carbohidratos: round1(food.carbohidratosBase * ratio),
    grasa: round1(food.grasaBase * ratio),
  };
}

/**
 * Detecta el macronutriente dominante de un alimento con rigor clínico y fallback determinista.
 * Funciona tanto con MealFoodItem ({ proteina, carbohidratos, grasa }) como con FoodItem ({ proteinaBase, carbohidratosBase, grasaBase }).
 */
export function getDominantMacro(
  food:
    | { proteina: number; carbohidratos: number; grasa: number; calorias?: number }
    | { proteinaBase: number; carbohidratosBase: number; grasaBase: number; caloriasBase?: number }
): DominantMacro {
  const p = 'proteina' in food ? Number(food.proteina) || 0 : Number(food.proteinaBase) || 0;
  const c = 'carbohidratos' in food ? Number(food.carbohidratos) || 0 : Number(food.carbohidratosBase) || 0;
  const g = 'grasa' in food ? Number(food.grasa) || 0 : Number(food.grasaBase) || 0;

  const calP = p * 4;
  const calC = c * 4;
  const calG = g * 9;
  const totalCal = calP + calC + calG;

  if (totalCal <= 0) return 'proteina';

  const ratioP = calP / totalCal;
  const ratioC = calC / totalCal;
  const ratioG = calG / totalCal;

  // Umbrales clínicos prioritarios
  if (ratioP >= 0.35 || (p >= 15 && p > c && p > g)) return 'proteina';
  if (ratioC >= 0.45) return 'carbohidratos';
  if (ratioG >= 0.50) return 'grasa';

  // Fallback determinista para alimentos mixtos (frutos secos, legumbres, etc.)
  if (calP >= calC && calP >= calG) return 'proteina';
  if (calC >= calP && calC >= calG) return 'carbohidratos';
  return 'grasa';
}

/**
 * Calcula la porción matemáticamente equivalente de un alimento candidato para igualar
 * el macronutriente dominante del alimento prescrito, usando calculatePortionMacros y aplicando
 * un filtro duro de tolerancia calórica (por defecto ±10%).
 */
export function calculateEquivalentPortion(
  targetFood: MealFoodItem,
  candidate: FoodItem,
  maxCalorieDiffPct: number = 10
): FoodEquivalentOption | null {
  const targetMacro = getDominantMacro(targetFood);
  const candidateMacro = getDominantMacro(candidate);

  // Ambos alimentos deben compartir el mismo macronutriente dominante
  if (targetMacro !== candidateMacro) return null;

  let targetVal = 0;
  let candidateBaseVal = 0;

  if (targetMacro === 'proteina') {
    targetVal = Number(targetFood.proteina) || 0;
    candidateBaseVal = Number(candidate.proteinaBase) || 0;
  } else if (targetMacro === 'carbohidratos') {
    targetVal = Number(targetFood.carbohidratos) || 0;
    candidateBaseVal = Number(candidate.carbohidratosBase) || 0;
  } else {
    targetVal = Number(targetFood.grasa) || 0;
    candidateBaseVal = Number(candidate.grasaBase) || 0;
  }

  // Si el candidato no tiene cantidad significativa del macro o el prescrito no tiene nada
  if (candidateBaseVal <= 0.5 || targetVal <= 0) return null;

  const basePortion = candidate.cantidadBase > 0 ? candidate.cantidadBase : 100;
  const rawQty = (targetVal / candidateBaseVal) * basePortion;

  if (rawQty <= 0 || !isFinite(rawQty)) return null;

  // Redondeo ergonómico para cocina y nutrición
  let qty: number;
  const unit = (candidate.unidad || 'gr').toLowerCase();
  const isDiscreteUnit = [
    'u',
    'unidad',
    'scoop',
    'tableta',
    'capsula',
    'cápsula',
    'sobre',
    'tajada',
    'taza',
    'vaso',
    'cucharada',
    'cucharadita',
  ].includes(unit);

  if (isDiscreteUnit) {
    qty = rawQty >= 2 ? Math.round(rawQty * 2) / 2 : round1(rawQty);
  } else {
    if (rawQty >= 50) {
      qty = Math.round(rawQty / 5) * 5;
    } else if (rawQty >= 10) {
      qty = Math.round(rawQty);
    } else {
      qty = round1(rawQty);
    }
  }

  if (qty <= 0) return null;

  // Límite ergonómico culinario: evitar multiplicaciones desproporcionadas (ej. más de 3.5x del peso prescrito o más de 450g)
  const maxReasonableQty = Math.max((Number(targetFood.cantidad) || 100) * 3.5, 420);
  if (!isDiscreteUnit && qty > maxReasonableQty) {
    return null;
  }

  // Reusar calculatePortionMacros para calcular los valores proporcionales
  const macros = calculatePortionMacros(candidate, qty);

  const targetCal =
    targetFood.calorias > 0
      ? targetFood.calorias
      : Math.round(
          (Number(targetFood.proteina) || 0) * 4 +
            (Number(targetFood.carbohidratos) || 0) * 4 +
            (Number(targetFood.grasa) || 0) * 9
        );

  const safeTargetCal = targetCal > 0 ? targetCal : 1;
  const deltaCaloriasPct = Math.round(((macros.calorias - safeTargetCal) / safeTargetCal) * 100);

  // Filtro duro: no superar la tolerancia calórica estricta (por defecto ±10%)
  if (Math.abs(deltaCaloriasPct) > maxCalorieDiffPct) {
    return null;
  }

  return {
    foodId: candidate.id,
    nombre: candidate.nombre,
    grupo: candidate.grupo,
    cantidad: qty,
    unidad: candidate.unidad,
    calorias: macros.calorias,
    proteina: macros.proteina,
    carbohidratos: macros.carbohidratos,
    grasa: macros.grasa,
    deltaCaloriasPct,
    activo: true,
    esPersonalizado: candidate.esPersonalizado || false,
  };
}

/**
 * Evalúa si un alimento candidato del catálogo es una fuente culinaria sensata y coherente
 * para actuar como reemplazo del macronutriente prescrito.
 * Evita disparates como sugerir 1.4kg de ensalada de canónigos o 1.1kg de alcaparras como fuente proteica,
 * o vísceras/menudencias grasosas (chunchullo, ubre) como fuentes de grasa saludable.
 */
export function isEligibleMacroCandidate(
  targetMacro: DominantMacro,
  candidate: FoodItem
): boolean {
  if (!candidate || !candidate.nombre) return false;
  const cGrupo = candidate.grupo || '';
  const cSubgrupo = candidate.subgrupo || '';
  const cNorm = normalizeFoodSearchText(candidate.nombre);
  const pBase = candidate.proteinaBase || 0;
  const cBase = candidate.carbohidratosBase || 0;
  const gBase = candidate.grasaBase || 0;

  // Filtros de sentido común general
  if (
    cGrupo === 'Bebidas y Varios' ||
    cSubgrupo.includes('Bebida') ||
    cSubgrupo.includes('Alcohólica') ||
    cSubgrupo.includes('Infusiones')
  ) {
    return false;
  }
  if (
    cSubgrupo.includes('Vísceras') ||
    cSubgrupo.includes('Menudencias') ||
    cNorm.includes('chunchullo') ||
    cNorm.includes('ubre') ||
    cNorm.includes('rinon')
  ) {
    return false;
  }
  if (
    cNorm.includes('levadura') ||
    cNorm.includes('gelatina') ||
    cNorm.includes('curry') ||
    cNorm.includes('pimienta') ||
    cNorm.includes('alcaparras')
  ) {
    return false;
  }

  if (targetMacro === 'proteina') {
    // Verduras, frutas o semillas no deben sustituir fuentes magras de proteína
    if (cGrupo === 'Verduras' || cGrupo === 'Frutas' || cGrupo === 'Grasas y Frutos Secos') {
      return false;
    }
    const isProteinGroup = [
      'Carnes y Aves',
      'Pescados y Mariscos',
      'Huevos',
      'Lácteos y Quesos',
      'Suplementación',
    ].includes(cGrupo);
    return isProteinGroup || pBase >= 12;
  }

  if (targetMacro === 'carbohidratos') {
    // Carnes o verduras muy bajas en hidratos no son fuentes primarias de carbohidratos
    if (cGrupo === 'Verduras' || cGrupo === 'Carnes y Aves' || cGrupo === 'Pescados y Mariscos') {
      return false;
    }
    const isCarbGroup = ['Cereales y Tubérculos', 'Frutas', 'Legumbres'].includes(cGrupo);
    return isCarbGroup || cBase >= 14;
  }

  if (targetMacro === 'grasa') {
    // Grasas saludables: frutos secos, aceites, semillas, aguacates
    if (cGrupo === 'Carnes y Aves' || cGrupo === 'Pescados y Mariscos' || cGrupo === 'Verduras') {
      return false;
    }
    return ['Grasas y Frutos Secos', 'Lácteos y Quesos'].includes(cGrupo) || gBase >= 14;
  }

  return true;
}

/**
 * Obtiene las sugerencias organizadas en dos niveles para el entrenador:
 * 1. strictMatches: Alimentos con estricta tolerancia calórica (<= ±10%).
 * 2. macroMatches: Otras fuentes culinarias válidas del macro (proteína/carbos/grasa)
 *    cuyas calorías difieren (> 10%), permitiendo al entrenador ampliar la variedad
 *    con alimentos como salmón, huevo entero, legumbres o batata según su criterio.
 */
export function getGroupedEquivalentsSuggestions(
  targetFood: MealFoodItem,
  catalog: FoodItem[] = BASE_FOOD_CATALOG
): FoodEquivalentsGroupedSuggestions {
  if (!targetFood || !Array.isArray(catalog) || catalog.length === 0) {
    return { strictMatches: [], macroMatches: [] };
  }

  const targetMacro = getDominantMacro(targetFood);
  const targetNorm = normalizeFoodSearchText(targetFood.nombre);

  const strictMatches: FoodEquivalentOption[] = [];
  const macroMatches: FoodEquivalentOption[] = [];
  const seenKeys = new Set<string>();
  seenKeys.add(targetNorm);

  for (const item of catalog) {
    const itemNorm = normalizeFoodSearchText(item.nombre);
    if (seenKeys.has(itemNorm) || itemNorm === targetNorm) continue;
    if (!isEligibleMacroCandidate(targetMacro, item)) continue;

    // Permitimos calcular hasta ±70% para clasificar en los dos niveles
    const equiv = calculateEquivalentPortion(targetFood, item, 70);
    if (!equiv) continue;

    const firstWord = itemNorm.split(' ')[0];
    const key = `${equiv.grupo}_${firstWord}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    seenKeys.add(itemNorm);

    if (Math.abs(equiv.deltaCaloriasPct) <= 10) {
      strictMatches.push(equiv);
    } else {
      macroMatches.push(equiv);
    }
  }

  // Ordenar ambos niveles por cercanía calórica al prescrito
  strictMatches.sort((a, b) => Math.abs(a.deltaCaloriasPct) - Math.abs(b.deltaCaloriasPct));
  macroMatches.sort((a, b) => Math.abs(a.deltaCaloriasPct) - Math.abs(b.deltaCaloriasPct));

  return {
    strictMatches: strictMatches.slice(0, 6),
    macroMatches: macroMatches.slice(0, 8),
  };
}

/**
 * Obtiene las mejores opciones automáticas equivalentes desde el catálogo para un alimento prescrito.
 * Aplica el filtro duro calórico (±10%), excluye el mismo alimento y deduplica para ofrecer variedad culinaria.
 */
export function getAutomaticEquivalents(
  targetFood: MealFoodItem,
  catalog: FoodItem[] = BASE_FOOD_CATALOG,
  maxOptions: number = 6
): FoodEquivalentOption[] {
  const { strictMatches } = getGroupedEquivalentsSuggestions(targetFood, catalog);
  return strictMatches.slice(0, maxOptions);
}

/**
 * Consolida los alimentos prescritos en el plan semanal para la guía de equivalencias,
 * agrupando repeticiones del mismo alimento y filtrando alimentos irrelevantes o aderezos mínimos.
 */
export function getUniquePrescribedFoods(
  plan: NutritionPlan,
  filterDayKeys?: string[]
): MealFoodItem[] {
  if (!plan || !plan.datos_plan || !plan.datos_plan.days) return [];

  const map = new Map<string, MealFoodItem>();
  const allowedKeys =
    Array.isArray(filterDayKeys) && filterDayKeys.length > 0
      ? new Set(filterDayKeys.map((k) => k.toLowerCase()))
      : null;

  for (const [dayKey, day] of Object.entries(plan.datos_plan.days)) {
    if (allowedKeys && !allowedKeys.has(dayKey.toLowerCase())) continue;
    if (!day || !Array.isArray(day.meals)) continue;
    for (const meal of day.meals) {
      if (!Array.isArray(meal.foods)) continue;
      for (const food of meal.foods) {
        if (!food || !food.nombre) continue;

        // Filtrar alimentos muy pequeños o aderezos sin significancia macro
        const p = Number(food.proteina) || 0;
        const c = Number(food.carbohidratos) || 0;
        const g = Number(food.grasa) || 0;
        const cal = Number(food.calorias) || 0;

        if (p < 10 && c < 12 && g < 8 && cal < 80) continue;

        const norm = normalizeFoodSearchText(food.nombre);
        if (!map.has(norm)) {
          map.set(norm, food);
        } else {
          // Si ya existe, conservar el de mayor porción para que la guía cubra la ración completa
          const existing = map.get(norm)!;
          if (food.cantidad > existing.cantidad) {
            map.set(norm, food);
          }
        }
      }
    }
  }

  // Ordenar: primero fuentes de proteína, luego carbohidratos, luego grasas
  return Array.from(map.values()).sort((a, b) => {
    const macroOrder: Record<DominantMacro, number> = {
      proteina: 1,
      carbohidratos: 2,
      grasa: 3,
    };
    const orderA = macroOrder[getDominantMacro(a)];
    const orderB = macroOrder[getDominantMacro(b)];
    if (orderA !== orderB) return orderA - orderB;
    return a.nombre.localeCompare(b.nombre);
  });
}

/**
 * Suma de macros y calorías de una lista de alimentos (una ingesta/comida)
 */
export function calculateMealTotals(foods: MealFoodItem[]): NutritionTotals {
  let calorias = 0;
  let proteina = 0;
  let carbohidratos = 0;
  let grasa = 0;

  for (const f of foods) {
    calorias += Number(f.calorias) || 0;
    proteina += Number(f.proteina) || 0;
    carbohidratos += Number(f.carbohidratos) || 0;
    grasa += Number(f.grasa) || 0;
  }

  return {
    calorias: Math.round(calorias),
    proteina: round1(proteina),
    carbohidratos: round1(carbohidratos),
    grasa: round1(grasa),
  };
}

/**
 * Suma de macros y calorías de un día completo
 */
export function calculateDayTotals(day?: NutritionDay): NutritionTotals {
  if (!day || !day.meals) {
    return { calorias: 0, proteina: 0, carbohidratos: 0, grasa: 0 };
  }

  let calorias = 0;
  let proteina = 0;
  let carbohidratos = 0;
  let grasa = 0;

  for (const meal of day.meals) {
    const mt = calculateMealTotals(meal.foods);
    calorias += mt.calorias;
    proteina += mt.proteina;
    carbohidratos += mt.carbohidratos;
    grasa += mt.grasa;
  }

  return {
    calorias: Math.round(calorias),
    proteina: round1(proteina),
    carbohidratos: round1(carbohidratos),
    grasa: round1(grasa),
  };
}

/**
 * Calcula la adherencia y delta frente a los objetivos nutricionales
 */
export function calculateCompliance(
  totals: NutritionTotals,
  target: NutritionalTarget
): NutritionCompliance {
  const tCal = target.calorias > 0 ? target.calorias : 2000;
  const tProt = target.proteinaGrams > 0 ? target.proteinaGrams : 150;
  const tCarb = target.carbohidratosGrams > 0 ? target.carbohidratosGrams : 200;
  const tFat = target.grasaGrams > 0 ? target.grasaGrams : 60;

  const caloriasDiff = totals.calorias - tCal;
  const caloriasPct = Math.round((totals.calorias / tCal) * 100);
  const proteinaPct = Math.round((totals.proteina / tProt) * 100);
  const carbohidratosPct = Math.round((totals.carbohidratos / tCarb) * 100);
  const grasaPct = Math.round((totals.grasa / tFat) * 100);

  // Consideramos óptimo si está dentro de +/- 3% de las calorías objetivo
  let status: 'optimo' | 'deficit' | 'superavit' = 'optimo';
  const tolerance = tCal * 0.03;

  if (caloriasDiff < -tolerance) {
    status = 'deficit';
  } else if (caloriasDiff > tolerance) {
    status = 'superavit';
  }

  return {
    caloriasDiff,
    caloriasPct,
    proteinaPct,
    carbohidratosPct,
    grasaPct,
    status,
  };
}

/**
 * Inicializa un día estándar con las comidas predeterminadas
 */
export function createEmptyNutritionDay(diaSemana: DayOfWeek | 'todos', label: string): NutritionDay {
  return {
    id: 'day_' + diaSemana + '_' + Math.random().toString(36).substring(2, 7),
    diaSemana,
    nombre: label,
    meals: DEFAULT_MEALS.map((m, idx) => ({
      id: 'meal_' + idx + '_' + Math.random().toString(36).substring(2, 7),
      nombre: m.nombre,
      horario: m.horario,
      orden: idx + 1,
      foods: [],
    })),
  };
}

/**
 * Crea una estructura de plan alimenticio inicializado a partir de una valoración antropométrica
 */
export function createPlanFromValuation(
  clienteId: string,
  valuation?: ValoracionAntropometrica | null,
  trainerId?: string | null
): NutritionPlan {
  const targetCalorias =
    valuation?.target_calorias ||
    (valuation as any)?.calorias_recomendadas ||
    (valuation?.macros as any)?.calorias_totales ||
    valuation?.tdee ||
    (valuation as any)?.get ||
    2000;

  const targetProteina =
    (valuation?.macros as any)?.proteina?.grams ||
    (valuation?.macros as any)?.proteina_g ||
    (valuation as any)?.proteina_g ||
    150;

  const targetCarbos =
    (valuation?.macros as any)?.carbohidratos?.grams ||
    (valuation?.macros as any)?.carbohidratos_g ||
    (valuation as any)?.carbohidratos_g ||
    200;

  const targetGrasa =
    (valuation?.macros as any)?.grasa?.grams ||
    (valuation?.macros as any)?.grasas_g ||
    (valuation as any)?.grasas_g ||
    60;

  const ajusteCaloricoPct =
    valuation?.ajuste_calorico_pct ||
    (valuation?.macros as any)?.ajuste_calorico_pct ||
    0;

  const days: Record<string, NutritionDay> = {};
  for (const d of DAYS_OF_WEEK) {
    days[d.key] = createEmptyNutritionDay(d.key, d.label);
  }

  return {
    cliente_id: clienteId,
    entrenador_id: trainerId || valuation?.entrenador_id || null,
    valoracion_id: valuation?.id || null,
    nombre: valuation?.objetivo ? `Plan Nutricional: ${valuation.objetivo}` : 'Plan Nutricional Deportivo',
    activo: true,
    modo: 'semanal',
    objetivo: valuation?.objetivo || 'Recomposición Corporal',
    target_calorias: targetCalorias,
    target_proteina_g: round1(targetProteina),
    target_carbohidratos_g: round1(targetCarbos),
    target_grasa_g: round1(targetGrasa),
    ajuste_calorico_pct: ajusteCaloricoPct,
    datos_plan: {
      days,
      modo: 'semanal',
      vigenciaDias: 28,
    },
    recomendaciones:
      '• Pesar los alimentos en crudo antes de la cocción.\n• Consumir entre 3 y 4 litros de agua distribuidos a lo largo del día.\n• Sal marina y especias naturales al gusto.\n• Mantener los horarios de ingesta con regularidad.',
  };
}

/**
 * Duplica en profundidad (deep clone) las comidas y alimentos de un día a otros días
 */
export function copyNutritionDay(
  plan: NutritionPlan,
  sourceDayKey: string,
  targetDayKeys: string[]
): NutritionPlan {
  const sourceDay = plan.datos_plan.days[sourceDayKey];
  if (!sourceDay) return plan;

  const newDays = { ...plan.datos_plan.days };

  for (const targetKey of targetDayKeys) {
    if (!newDays[targetKey]) continue;

    // Clonar las comidas y alimentos con nuevos IDs únicos para evitar referencias compartidas
    const clonedMeals: Meal[] = sourceDay.meals.map((meal) => ({
      ...meal,
      id: 'meal_' + Math.random().toString(36).substring(2, 9),
      foods: meal.foods.map((food) => ({
        ...food,
        id: 'food_inst_' + Math.random().toString(36).substring(2, 9),
      })),
    }));

    newDays[targetKey] = {
      ...newDays[targetKey],
      meals: clonedMeals,
    };
  }

  return {
    ...plan,
    datos_plan: {
      ...plan.datos_plan,
      days: newDays,
    },
    updated_at: new Date().toISOString(),
  };
}

/**
 * Validador y saneador de alimentos (Atwater & integridad de datos de comunidad)
 */
export function validateAndSanitizeFood(food: Partial<FoodItem>): {
  valid: boolean;
  food?: FoodItem;
  warning?: string;
  error?: string;
} {
  const nombre = (food.nombre || '').trim();
  if (!nombre) {
    return { valid: false, error: 'El nombre del alimento es obligatorio.' };
  }

  const cantidadBase = Number(food.cantidadBase) > 0 ? Number(food.cantidadBase) : 100;
  const unidad = (food.unidad || 'gr').trim();
  const proteina = Math.max(0, Number(food.proteinaBase) || 0);
  const carbohidratos = Math.max(0, Number(food.carbohidratosBase) || 0);
  const grasa = Math.max(0, Number(food.grasaBase) || 0);

  // Cálculo Atwater teórico
  const atwaterCal = Math.round(proteina * 4 + carbohidratos * 4 + grasa * 9);
  let calorias = Number(food.caloriasBase);

  // Si no viene caloría, autocalcular con Atwater
  if (isNaN(calorias) || calorias === 0) {
    calorias = atwaterCal;
  }

  let warning: string | undefined;

  // Filtro físico: la grasa pura aporta 900 kcal/100g. Más de 950 kcal/100g es físicamente imposible
  const calPor100g = (calorias / cantidadBase) * 100;
  if (calPor100g > 950) {
    warning = `Calorías atípicas (${Math.round(calPor100g)} kcal/100g). Verifica la etiqueta antes de continuar.`;
  } else if (atwaterCal > 0) {
    const diffPct = Math.abs(calorias - atwaterCal) / calorias;
    if (diffPct > 0.45 && Math.abs(calorias - atwaterCal) > 30) {
      warning = `Las calorías reportadas (${calorias}) difieren del cálculo teórico Atwater (${atwaterCal} kcal).`;
    }
  }

  const sanitized: FoodItem = {
    id: food.id || 'custom_' + Math.random().toString(36).substring(2, 9),
    nombre,
    grupo: (food.grupo as FoodGroup) || 'Mis Alimentos',
    cantidadBase,
    unidad,
    caloriasBase: Math.round(calorias),
    proteinaBase: round1(proteina),
    carbohidratosBase: round1(carbohidratos),
    grasaBase: round1(grasa),
    esPersonalizado: Boolean(food.esPersonalizado),
    fuente: food.fuente || 'Manual',
    marca: food.marca,
    codigoBarras: food.codigoBarras,
  };

  return { valid: true, food: sanitized, warning };
}

/**
 * Consulta a la API de Open Food Facts con sanitización de datos comunales
 */
export async function searchOpenFoodFacts(query: string): Promise<FoodItem[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const normalizedTerm = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let rawProducts: any[] = [];

  try {
    // 1. Intentar primero a través del proxy serverless/dev (/api/food-search)
    try {
      const proxyRes = await fetch(`/api/food-search?q=${encodeURIComponent(term)}`);
      if (proxyRes.ok) {
        const contentType = proxyRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const proxyData = await proxyRes.json();
          if (Array.isArray(proxyData?.products) && proxyData.products.length > 0) {
            rawProducts = proxyData.products;
          }
        }
      }
    } catch {
      // Ignorar error de red del proxy y continuar al fallback directo
    }

    // 2. Si el proxy no devolvió productos (ej. en preview offline o llamadas directas),
    // consultar directamente el nuevo servicio Search-a-licious de Open Food Facts
    if (rawProducts.length === 0) {
      const fetchOffSearch = async (q: string): Promise<any[]> => {
        try {
          const searchUrl = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=25`;
          const directRes = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'EvolutionLab/3.0 - Web - (soporte@evolutionlab.app)',
              Accept: 'application/json',
            },
          });
          if (directRes.ok) {
            const ct = directRes.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
              const data = await directRes.json();
              if (Array.isArray(data?.hits)) {
                return data.hits.map((h: any) => ({
                  code: h.code || '',
                  product_name: h.product_name || h.product_name_es || h.product_name_en || '',
                  product_name_es: h.product_name_es || h.product_name || '',
                  brands: Array.isArray(h.brands) ? h.brands.join(', ') : (h.brands || ''),
                  nutriments: h.nutriments || {},
                  image_front_small_url: h.image_front_small_url || h.image_url || '',
                }));
              }
            }
          }
        } catch {
          // Ignorar y continuar
        }
        return [];
      };

      const hits1 = await fetchOffSearch(term);
      rawProducts.push(...hits1);

      if (term !== normalizedTerm && rawProducts.length < 15) {
        const hits2 = await fetchOffSearch(normalizedTerm);
        for (const h of hits2) {
          if (!rawProducts.some((p) => (p.code && p.code === h.code) || (p.product_name && p.product_name === h.product_name))) {
            rawProducts.push(h);
          }
        }
      }

      // 3. Fallback adicional a world.openfoodfacts.org si Search-a-licious no dio resultados
      if (rawProducts.length === 0) {
        try {
          const fallbackUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
            normalizedTerm
          )}&search_simple=1&action=process&json=1&page_size=25&fields=code,product_name,product_name_es,brands,nutriments,image_front_small_url`;
          const directRes = await fetch(fallbackUrl, {
            headers: {
              'User-Agent': 'EvolutionLab/3.0 - Web - (soporte@evolutionlab.app)',
              Accept: 'application/json',
            },
          });
          if (directRes.ok) {
            const ct = directRes.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
              const directData = await directRes.json();
              if (Array.isArray(directData?.products)) {
                rawProducts = directData.products;
              }
            }
          }
        } catch {
          // Continuar
        }
      }
    }

    if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
      return [];
    }

    const results: FoodItem[] = [];

    for (const p of rawProducts) {
      const nombre = (p.product_name || p.product_name_es || p.product_name_en || '').trim();
      if (!nombre) continue;

      const lowerName = nombre.toLowerCase();

      // Descartar cosméticos y artículos no comestibles que a veces se cuelan en Open Food Facts
      const isNonFood = /\b(micellar|shampoo|champú|crema corporal|lotion|jabón|soap|cleanser|serum|mascarilla|conditioner|detergente|cleaner)\b/i.test(
        lowerName
      );
      if (isNonFood) continue;

      const nutriments = p.nutriments || {};
      const cal = nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal'] ?? nutriments['energy_100g'];
      const prot = nutriments['proteins_100g'] ?? nutriments['proteins'];
      const carbs = nutriments['carbohydrates_100g'] ?? nutriments['carbohydrates'];
      const fat = nutriments['fat_100g'] ?? nutriments['fat'];

      const hasMacros = cal !== undefined || prot !== undefined || carbs !== undefined || fat !== undefined;

      const brandStr = Array.isArray(p.brands) ? p.brands.join(', ') : (p.brands || '').trim();
      const displayName = brandStr && !nombre.toLowerCase().includes(brandStr.toLowerCase())
        ? `${nombre} (${brandStr})`
        : nombre;

      // Detectar si es líquido o bebida para asignar unidad 'ml' en lugar de 'gr'
      const isLiquid =
        /\b(leche|yogur|yagur|yogurt|bebida|jugo|néctar|nectar|drink|agua|water|aceite|oil|kumis|soda|gaseosa|refresco|vinagre|té|tea|café|coffee|smoothie|shake|extracto)\b/i.test(
          lowerName
        ) ||
        (typeof p.quantity === 'string' && /\b(ml|cl|l|litro|litros)\b/i.test(p.quantity));

      const unidad = isLiquid ? 'ml' : 'gr';

      const { valid, food } = validateAndSanitizeFood({
        id: 'off_' + (p.code || Math.random().toString(36).substring(2, 9)),
        nombre: displayName,
        grupo: 'Mis Alimentos',
        cantidadBase: 100,
        unidad,
        caloriasBase: Math.round(Number(cal) || 0),
        proteinaBase: Math.round((Number(prot) || 0) * 10) / 10,
        carbohidratosBase: Math.round((Number(carbs) || 0) * 10) / 10,
        grasaBase: Math.round((Number(fat) || 0) * 10) / 10,
        esPersonalizado: true,
        fuente: 'Open Food Facts',
        marca: brandStr || undefined,
        codigoBarras: p.code || undefined,
      });

      if (valid && food) {
        (food as any)._hasNutrition = hasMacros;
        results.push(food);
      }
    }

    // Filtrar: Si hay alimentos con información nutricional completa, priorizarlos
    // para no saturar con tarjetas vacías de productos sin macros
    const itemsWithMacros = results.filter((f) => (f as any)._hasNutrition);
    if (itemsWithMacros.length > 0) {
      return itemsWithMacros;
    }

    return results;
  } catch (err) {
    console.error('Error al consultar Open Food Facts:', err);
    return [];
  }
}

// ----------------------------------------------------------------------------
// PERSISTENCIA OFFLINE EN INDEXEDDB
// ----------------------------------------------------------------------------

export async function savePlanOffline(plan: NutritionPlan): Promise<void> {
  if (!plan.cliente_id) return;
  const key = `nutrition_plan_${plan.cliente_id}`;
  await idbSet(key, plan);
  if (plan.id) {
    await idbSet(`nutrition_plan_id_${plan.id}`, plan);
  }
}

export async function getPlanOffline(clienteId: string): Promise<NutritionPlan | undefined> {
  const key = `nutrition_plan_${clienteId}`;
  return idbGet<NutritionPlan>(key);
}

export async function saveCustomFoodOffline(food: FoodItem): Promise<void> {
  const existing = (await idbGet<FoodItem[]>('custom_foods_catalog')) || [];
  const updated = [food, ...existing.filter((f) => f.id !== food.id)];
  await idbSet('custom_foods_catalog', updated);
}

export async function getCustomFoodsOffline(): Promise<FoodItem[]> {
  return (await idbGet<FoodItem[]>('custom_foods_catalog')) || [];
}

/**
 * Guarda un alimento personalizado en IndexedDB (local offline) y lo sincroniza con Supabase en la nube
 */
export async function saveCustomFood(food: FoodItem): Promise<FoodItem> {
  // 1. Guardar primero en IndexedDB para disponibilidad inmediata y offline
  await saveCustomFoodOffline(food);

  // 2. Sincronizar en Supabase si hay sesión activa
  try {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (user) {
      const isUuid =
        typeof food.id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(food.id);

      const payload: any = {
        creador_id: user.id,
        nombre: food.nombre.trim(),
        grupo: food.grupo || 'Mis Alimentos',
        cantidad_base: food.cantidadBase || 100,
        unidad: food.unidad || 'gr',
        calorias: food.caloriasBase,
        proteina: food.proteinaBase,
        carbohidratos: food.carbohidratosBase,
        grasa: food.grasaBase,
        fuente: food.fuente || 'personalizado',
      };

      if (isUuid) {
        payload.id = food.id;
      }

      const { data, error } = await supabase
        .from('alimentos_personalizados')
        .upsert(payload)
        .select()
        .maybeSingle();

      if (data && !error) {
        const syncedFood: FoodItem = {
          ...food,
          id: data.id,
        };
        await saveCustomFoodOffline(syncedFood);
        return syncedFood;
      }
    }
  } catch (err) {
    console.warn('No se pudo sincronizar alimento en la nube (modo offline):', err);
  }

  return food;
}

/**
 * Obtiene los alimentos personalizados combinando el caché local de IndexedDB y Supabase en la nube
 */
export async function getCustomFoods(): Promise<FoodItem[]> {
  const localFoods = await getCustomFoodsOffline();

  try {
    const { data: remoteRows, error } = await supabase
      .from('alimentos_personalizados')
      .select('*')
      .order('created_at', { ascending: false });

    if (remoteRows && !error && remoteRows.length > 0) {
      const remoteFoods: FoodItem[] = remoteRows.map((r: any) => ({
        id: r.id,
        nombre: r.nombre,
        grupo: (r.grupo as FoodGroup) || 'Mis Alimentos',
        cantidadBase: Number(r.cantidad_base) || 100,
        unidad: r.unidad || 'gr',
        caloriasBase: Number(r.calorias) || 0,
        proteinaBase: Number(r.proteina) || 0,
        carbohidratosBase: Number(r.carbohidratos) || 0,
        grasaBase: Number(r.grasa) || 0,
        esPersonalizado: true,
        fuente: r.fuente || 'personalizado',
      }));

      // Fusionar remotos con locales evitando duplicados
      const byKey = new Map<string, FoodItem>();
      for (const f of localFoods) {
        byKey.set(String(f.id), f);
        byKey.set(f.nombre.toLowerCase().trim(), f);
      }
      for (const f of remoteFoods) {
        byKey.set(String(f.id), f);
        byKey.set(f.nombre.toLowerCase().trim(), f);
      }

      const merged = Array.from(new Set(byKey.values()));
      await idbSet('custom_foods_catalog', merged);
      return merged;
    }
  } catch (err) {
    console.warn('Error al consultar alimentos personalizados en Supabase:', err);
  }

  return localFoods;
}

/**
 * Elimina un alimento personalizado tanto localmente como en la nube
 */
export async function deleteCustomFood(foodId: string | number): Promise<void> {
  const existing = await getCustomFoodsOffline();
  const filtered = existing.filter((f) => String(f.id) !== String(foodId));
  await idbSet('custom_foods_catalog', filtered);

  try {
    const isUuid =
      typeof foodId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(foodId);
    if (isUuid) {
      await supabase.from('alimentos_personalizados').delete().eq('id', foodId);
    }
  } catch (err) {
    console.warn('Error al eliminar alimento en Supabase:', err);
  }
}

