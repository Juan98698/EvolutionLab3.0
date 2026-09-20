export type FoodGroup =
  | 'Carnes y Aves'
  | 'Pescados y Mariscos'
  | 'Huevos'
  | 'Lácteos y Quesos'
  | 'Cereales y Tubérculos'
  | 'Legumbres'
  | 'Grasas y Frutos Secos'
  | 'Frutas'
  | 'Verduras'
  | 'Suplementación'
  | 'Bebidas y Varios'
  | 'Mis Alimentos';

export interface FoodItem {
  id: string | number;
  nombre: string;
  grupo: FoodGroup;
  cantidadBase: number;
  unidad: string;
  caloriasBase: number;
  proteinaBase: number;
  carbohidratosBase: number;
  grasaBase: number;
  esPersonalizado?: boolean;
  fuente?: string;
  marca?: string;
  codigoBarras?: string;
}

export interface MealFoodItem {
  id: string;
  foodId: string | number;
  nombre: string;
  grupo: FoodGroup;
  cantidad: number;
  cantidadBase: number;
  unidad: string;
  calorias: number;
  proteina: number;
  carbohidratos: number;
  grasa: number;
  completado?: boolean;
  notas?: string;
}

export interface Meal {
  id: string;
  nombre: string;
  horario?: string;
  orden: number;
  foods: MealFoodItem[];
  targetPorcentaje?: number;
}

export type DayOfWeek = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';

export interface NutritionDay {
  id: string;
  diaSemana: DayOfWeek | 'todos';
  nombre: string;
  meals: Meal[];
}

export interface NutritionalTarget {
  calorias: number;
  proteinaGrams: number;
  proteinaGPerKg?: number;
  carbohidratosGrams: number;
  carbohidratosGPerKg?: number;
  grasaGrams: number;
  grasaGPerKg?: number;
  bmr?: number;
  tdee?: number;
  ajusteCaloricoPct?: number;
  objetivo?: string;
}

export interface NutritionTotals {
  calorias: number;
  proteina: number;
  carbohidratos: number;
  grasa: number;
}

export interface NutritionCompliance {
  caloriasDiff: number;
  caloriasPct: number;
  proteinaPct: number;
  carbohidratosPct: number;
  grasaPct: number;
  status: 'optimo' | 'deficit' | 'superavit';
}

export interface NutritionPlanData {
  days: Record<string, NutritionDay>;
  modo: 'diario_unico' | 'semanal';
  vigenciaDias?: number;
}

export interface NutritionPlan {
  id?: string;
  cliente_id: string;
  entrenador_id?: string | null;
  valoracion_id?: string | null;
  nombre: string;
  activo: boolean;
  modo: 'diario_unico' | 'semanal';
  objetivo?: string | null;
  target_calorias: number;
  target_proteina_g: number;
  target_carbohidratos_g: number;
  target_grasa_g: number;
  ajuste_calorico_pct?: number;
  datos_plan: NutritionPlanData;
  recomendaciones?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface NutritionTemplate {
  id?: string;
  entrenador_id: string;
  nombre: string;
  descripcion?: string | null;
  objetivo?: string | null;
  target_calorias?: number | null;
  datos_plan: NutritionPlanData;
  created_at?: string;
}
