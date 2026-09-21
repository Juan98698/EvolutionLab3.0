import { FoodItem, FoodGroup } from '../types/nutrition.types';
import rawFoods from './masterFoodCatalog.json';

export const FOOD_GROUPS: FoodGroup[] = [
  'Carnes y Aves',
  'Pescados y Mariscos',
  'Huevos',
  'Lácteos y Quesos',
  'Cereales y Tubérculos',
  'Legumbres',
  'Grasas y Frutos Secos',
  'Frutas',
  'Verduras',
  'Suplementación',
  'Bebidas y Varios',
  'Mis Alimentos',
];

/**
 * Grupos taxonómicos del catálogo maestro de nutrición de Evolution Lab 3.0
 * Basados en tablas de composición de alimentos científicas (ICBF / USDA)
 */
export const OFFICIAL_46_GROUPS = [
  'Huevos',
  'Leches y Bebidas Lácteas',
  'Yogures',
  'Quesos',
  'Helados y Postres Lácteos',
  'Carne de Cerdo',
  'Carne de Res / Vacuno',
  'Carne de Cordero / Ovino',
  'Aves y Otras Carnes',
  'Vísceras y Menudencias',
  'Embutidos y Fiambres',
  'Carnes Cocidas y Preparadas',
  'Pescado Blanco (Magro)',
  'Pescado Semigraso',
  'Pescado Azul (Graso)',
  'Moluscos',
  'Crustáceos y Mariscos',
  'Aceites',
  'Grasas y Mantequillas',
  'Chocolates y Cacao',
  'Azúcares y Endulzantes',
  'Féculas y Harinas',
  'Cereales y Derivados',
  'Legumbres y Granos',
  'Tubérculos y Raíces',
  'Verduras de Hoja y Setas',
  'Otros Alimentos',
  'Hortalizas de Fruto',
  'Hortalizas Bulbosas',
  'Frutas Frescas',
  'Zumos y Jugos de Frutas',
  'Mermeladas y Dulces',
  'Frutos Secos y Semillas',
  'Bebidas e Infusiones',
  'Vinos',
  'Licores y Destilados',
  'Salsas y Condimentos',
  'Especias y Hierbas',
  'Misceláneos',
  'Alimentos Dietéticos Especiales',
  'Alimentos Tradicionales',
  'Alimentos Procesados',
  'Platos y Preparados',
  'Leguminosas y Derivados',
  'Suplementación Deportiva',
  'Varios',
] as const;

export type OfficialGroupName = (typeof OFFICIAL_46_GROUPS)[number];

/**
 * Catálogo Maestro Oficial de Alimentos para Evolution Lab 3.0
 * Química de alimentos y factores de macronutrientes verificados
 * Fuente: Tablas de Composición de Alimentos (ICBF / USDA) y Alimentos Personalizados
 */
export const BASE_FOOD_CATALOG: FoodItem[] = rawFoods as unknown as FoodItem[];
