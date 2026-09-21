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
 * Los 46 grupos oficiales del catálogo maestro de nutrición
 */
export const OFFICIAL_46_GROUPS = [
  'HUEVOS',
  'LECHES',
  'YOGURT',
  'QUESOS',
  'HELADOS Y OTROS PRODUCTOS LACTEOS',
  'CARNE DE CERDO',
  'CARNE DE VACUNO',
  'CARNE DE OVINO',
  'AVES, CAZA Y OTRAS CARNES',
  'VISCERAS',
  'EMBUTIDOS',
  'PRODUCTOS CARNICOS TRATADOS POR EL CALOR',
  'PESCADO CON POCA GRASA',
  'PESCADO SEMIGRASO',
  'PESCADOS GRASOS',
  'MOLUSCOS',
  'CRUSTACEOS Y OTROS PRODUCTOS',
  'ACEITES',
  'GRASAS',
  'CHOCHOLATES',
  'AZUCARES',
  'FECULAS',
  'CEREALES Y DERIVADOS',
  'LEGUMBRES',
  'TUBERCULOS',
  'VERDURAS DE HOJA Y SETAS',
  'OTROS',
  'HORTALIZAS DE FRUTO',
  'HORTALIZAS BULBOSAS',
  'FRUTAS',
  'ZUMOS DE FRUTAS',
  'CONFITURAS Y MERMELADAS',
  'FRUTOS SECOS',
  'BEBIDAS',
  'VINOS',
  'LICORES',
  'SALSAS',
  'ESPECIAS',
  'MISCELANEOS',
  'ALIMENTOS PARA REGIMENES ESPECIALES',
  'ALIMENTOS NATIVOS',
  'ALIMENTOS MANUFACTURADOS',
  'ALIMENTOS PREPARADOS',
  'LEGUMINOSAS Y DERIVADOS',
  'SUPLEMENTOS',
  'VARIOS',
] as const;

export type OfficialGroupName = (typeof OFFICIAL_46_GROUPS)[number];

/**
 * Catálogo Oficial Completo de Alimentos para Evolution Lab 3.0
 * Fuente: Catálogo Oficial Certificado (1,420 alimentos en 46 grupos oficiales)
 * Química de alimentos y factores de macronutrientes verificados
 */
export const BASE_FOOD_CATALOG: FoodItem[] = rawFoods as unknown as FoodItem[];
