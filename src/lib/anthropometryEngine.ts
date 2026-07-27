/**
 * anthropometryEngine.ts
 *
 * Motor científico para valoraciones antropométricas, composición corporal (4 masas),
 * Somatotipo de Heath-Carter (Endomorfia, Mesomorfia, Ectomorfia), gasto calórico basal/total,
 * prescripción de macronutrientes y clasificaciones normativas (OMS, ACE).
 */

import {
  ValoracionAntropometrica,
  PlieguesCutaneos,
  PerimetrosCorporales,
  DiametrosOseos,
  SomatotipoResult,
  MacroDistribution,
} from '../types/database.types';

// ---------------------------------------------------------------------------
// 1. Clasificación IMC (Organización Mundial de la Salud - OMS)
// ---------------------------------------------------------------------------

export interface IMCClassification {
  imc: number;
  categoria: string;
  rangoStr: string;
}

export function calculateBMI(pesoKg: number, estaturaCm: number): IMCClassification {
  if (pesoKg <= 0 || estaturaCm <= 0) {
    return { imc: 0, categoria: 'No determinado', rangoStr: 'N/A' };
  }
  const estaturaM = estaturaCm / 100;
  const imc = Math.round((pesoKg / (estaturaM * estaturaM)) * 10) / 10;

  let categoria = 'Normal';
  let rangoStr = '18.5 – 24.9 kg/m²';

  if (imc < 18.5) {
    categoria = 'Bajo peso';
    rangoStr = '< 18.5 kg/m²';
  } else if (imc >= 18.5 && imc <= 24.9) {
    categoria = 'Normal';
    rangoStr = '18.5 – 24.9 kg/m²';
  } else if (imc >= 25.0 && imc <= 29.9) {
    categoria = 'Sobrepeso';
    rangoStr = '25.0 – 29.9 kg/m²';
  } else if (imc >= 30.0 && imc <= 34.9) {
    categoria = 'Obesidad grado I';
    rangoStr = '30.0 – 34.9 kg/m²';
  } else if (imc >= 35.0 && imc <= 39.9) {
    categoria = 'Obesidad grado II';
    rangoStr = '35.0 – 39.9 kg/m²';
  } else {
    categoria = 'Obesidad grado III';
    rangoStr = '≥ 40.0 kg/m²';
  }

  return { imc, categoria, rangoStr };
}

// ---------------------------------------------------------------------------
// 2. Clasificación de % Grasa Corporal (American Council on Exercise - ACE)
// ---------------------------------------------------------------------------

export interface FatClassification {
  pctGrasa: number;
  categoria: string;
  rangoStr: string;
}

export function classifyBodyFat(pctGrasa: number, genero: 'masculino' | 'femenino' = 'masculino'): FatClassification {
  const rounded = Math.round(pctGrasa * 10) / 10;

  if (genero === 'femenino') {
    if (rounded < 14) return { pctGrasa: rounded, categoria: 'Grasa esencial', rangoStr: '10 – 13 %' };
    if (rounded <= 20) return { pctGrasa: rounded, categoria: 'Atletas', rangoStr: '14 – 20 %' };
    if (rounded <= 24) return { pctGrasa: rounded, categoria: 'Buena forma física (fitness)', rangoStr: '21 – 24 %' };
    if (rounded <= 31) return { pctGrasa: rounded, categoria: 'Aceptable', rangoStr: '25 – 31 %' };
    return { pctGrasa: rounded, categoria: 'Obesidad', rangoStr: '≥ 32 %' };
  } else {
    if (rounded < 6) return { pctGrasa: rounded, categoria: 'Grasa esencial', rangoStr: '2 – 5 %' };
    if (rounded <= 13) return { pctGrasa: rounded, categoria: 'Atletas', rangoStr: '6 – 13 %' };
    if (rounded <= 17) return { pctGrasa: rounded, categoria: 'Buena forma física (fitness)', rangoStr: '14 – 17 %' };
    if (rounded <= 24) return { pctGrasa: rounded, categoria: 'Aceptable', rangoStr: '18 – 24 %' };
    return { pctGrasa: rounded, categoria: 'Obesidad', rangoStr: '≥ 25 %' };
  }
}

// ---------------------------------------------------------------------------
// 3. Clasificación de % Masa Muscular
// ---------------------------------------------------------------------------

export interface MuscleClassification {
  pctMusculo: number;
  categoria: string;
  rangoStr: string;
}

export function classifyMuscleMass(pctMusculo: number, genero: 'masculino' | 'femenino' = 'masculino'): MuscleClassification {
  const rounded = Math.round(pctMusculo * 10) / 10;

  if (genero === 'femenino') {
    if (rounded < 28) return { pctMusculo: rounded, categoria: 'Bajo', rangoStr: '< 28 %' };
    if (rounded <= 34) return { pctMusculo: rounded, categoria: 'Promedio', rangoStr: '28 – 34 %' };
    if (rounded <= 38) return { pctMusculo: rounded, categoria: 'Bueno', rangoStr: '34 – 38 %' };
    return { pctMusculo: rounded, categoria: 'Alto', rangoStr: '> 38 %' };
  } else {
    if (rounded < 32) return { pctMusculo: rounded, categoria: 'Bajo', rangoStr: '< 32 %' };
    if (rounded <= 38) return { pctMusculo: rounded, categoria: 'Promedio', rangoStr: '32 – 38 %' };
    if (rounded <= 44) return { pctMusculo: rounded, categoria: 'Bueno', rangoStr: '38 – 44 %' };
    return { pctMusculo: rounded, categoria: 'Alto', rangoStr: '> 44 %' };
  }
}

// ---------------------------------------------------------------------------
// 4. Cálculo de % Grasa por Método (Yuhasz, Faulkner, ISAK)
// ---------------------------------------------------------------------------

export function calculateBodyFatPct(
  pliegues: PlieguesCutaneos,
  metodo: 'Yuhasz' | 'Faulkner' | 'ISAK' = 'Yuhasz',
  genero: 'masculino' | 'femenino' = 'masculino'
): number {
  const triceps = pliegues.triceps || 0;
  const subescapular = pliegues.subescapular || 0;
  const suprailiaco = pliegues.suprailiaco || pliegues.supraespinal || 0;
  const abdominal = pliegues.abdominal || 0;
  const muslo = pliegues.muslo || 0;
  const pantorrilla = pliegues.pantorrilla || 0;
  const antebrazo = pliegues.antebrazo || 0;
  const supraespinal = pliegues.supraespinal || suprailiaco;

  if (metodo === 'Faulkner') {
    // 4 pliegues: tríceps, subescapular, suprailíaco, abdominal
    const sum4 = triceps + subescapular + suprailiaco + abdominal;
    if (sum4 <= 0) return 15;
    const fatPct = 5.783 + 0.153 * sum4;
    return Math.max(3, Math.min(60, Math.round(fatPct * 10) / 10));
  }

  if (metodo === 'ISAK') {
    // 8 pliegues o 6 pliegues ampliados ISAK
    const sum8 = triceps + subescapular + suprailiaco + abdominal + muslo + pantorrilla + antebrazo + supraespinal;
    if (sum8 <= 0) return 15;
    const fatPct = genero === 'femenino' ? 3.58 + 0.155 * sum8 : 2.585 + 0.1051 * sum8;
    return Math.max(3, Math.min(60, Math.round(fatPct * 10) / 10));
  }

  // Yuhasz por defecto (6 pliegues)
  const sum6 = triceps + subescapular + suprailiaco + abdominal + muslo + pantorrilla;
  if (sum6 <= 0) return 15;
  const fatPct = genero === 'femenino' ? 4.56 + 0.143 * sum6 : 3.64 + 0.097 * sum6;
  return Math.max(3, Math.min(60, Math.round(fatPct * 10) / 10));
}

// ---------------------------------------------------------------------------
// 5. Fraccionamiento de 4 Masas (Grasa, Muscular, Ósea, Residual)
// ---------------------------------------------------------------------------

export interface FourMassFractionation {
  kgGrasa: number;
  pctGrasa: number;
  kgMusculo: number;
  pctMusculo: number;
  kgOseo: number;
  pctOseo: number;
  kgResidual: number;
  pctResidual: number;
  ratioMusculoGrasa: number;
}

export function calculateFourMasses(
  pesoKg: number,
  estaturaCm: number,
  pctGrasa: number,
  diametros?: DiametrosOseos,
  genero: 'masculino' | 'femenino' = 'masculino',
  metodo: 'Yuhasz' | 'Faulkner' | 'ISAK' = 'Yuhasz'
): FourMassFractionation {
  if (pesoKg <= 0) {
    return {
      kgGrasa: 0, pctGrasa: 0, kgMusculo: 0, pctMusculo: 0,
      kgOseo: 0, pctOseo: 0, kgResidual: 0, pctResidual: 0, ratioMusculoGrasa: 0,
    };
  }

  const kgGrasa = Math.round(pesoKg * (pctGrasa / 100) * 100) / 100;

  // Masa Ósea
  let kgOseo = 0;
  if (metodo === 'ISAK' && diametros?.codo && diametros?.rodilla && estaturaCm > 0) {
    // Método Avanzado ISAK (Kerr / Drinkwater-Ross ponderado con los 6 diámetros óseos)
    const hM = estaturaCm / 100;
    const codoM = diametros.codo / 100;
    const rodillaM = diametros.rodilla / 100;
    const munecaM = (diametros.anteroposterior || diametros.codo) / 100;
    const biilioM = ((diametros.biiliocrestal || diametros.biliocrestal) || 28) / 100;
    const biacroM = (diametros.biacromial || 38) / 100;

    // Rocha ampliando componente apendicular y axial ISAK
    const diamEfectivo = (codoM * 0.35 + rodillaM * 0.35 + munecaM * 0.15 + (biilioM + biacroM) * 0.075);
    kgOseo = 3.02 * Math.pow(hM * hM * diamEfectivo * rodillaM * 400, 0.712);
  } else if (diametros?.codo && diametros?.rodilla && estaturaCm > 0) {
    // Rocha / von Döbeln clásico para Yuhasz y Faulkner (Codo, Rodilla y Muñeca)
    const codoM = diametros.codo / 100;
    const rodillaM = diametros.rodilla / 100;
    const munecaM = (diametros.anteroposterior ? diametros.anteroposterior / 100 : codoM);
    const estaturaM = estaturaCm / 100;
    const diamApendicular = (codoM + munecaM) / 2;
    kgOseo = 3.02 * Math.pow(estaturaM * estaturaM * diamApendicular * rodillaM * 400, 0.712);
  } else {
    // Estimación de masa ósea estandarizada por sexo
    kgOseo = pesoKg * (genero === 'femenino' ? 0.12 : 0.14);
  }

  kgOseo = Math.round(kgOseo * 100) / 100;
  const pctOseo = Math.round((kgOseo / pesoKg) * 100 * 10) / 10;

  // Masa Residual (Wurch)
  const kgResidual = Math.round(pesoKg * (genero === 'femenino' ? 0.209 : 0.241) * 100) / 100;
  const pctResidual = Math.round((kgResidual / pesoKg) * 100 * 10) / 10;

  // Masa Muscular (Diferencial Matiegka)
  const kgMusculo = Math.max(0, Math.round((pesoKg - (kgGrasa + kgOseo + kgResidual)) * 100) / 100);
  const pctMusculo = Math.round((kgMusculo / pesoKg) * 100 * 10) / 10;

  const ratioMusculoGrasa = kgGrasa > 0 ? Math.round((kgMusculo / kgGrasa) * 100) / 100 : 0;

  return {
    kgGrasa,
    pctGrasa: Math.round(pctGrasa * 10) / 10,
    kgMusculo,
    pctMusculo,
    kgOseo,
    pctOseo,
    kgResidual,
    pctResidual,
    ratioMusculoGrasa,
  };
}

// ---------------------------------------------------------------------------
// 6. Somatotipo de Heath-Carter (Endomorfia, Mesomorfia, Ectomorfia)
// ---------------------------------------------------------------------------

export function calculateSomatotype(
  pesoKg: number,
  estaturaCm: number,
  pliegues: PlieguesCutaneos,
  perimetros?: PerimetrosCorporales,
  diametros?: DiametrosOseos
): SomatotipoResult {
  if (pesoKg <= 0 || estaturaCm <= 0) {
    return { endo: 0, meso: 0, ecto: 0, x: 0, y: 0 };
  }

  const triceps = pliegues.triceps || 10;
  const subescapular = pliegues.subescapular || 10;
  const suprailiaco = pliegues.suprailiaco || pliegues.supraespinal || 10;

  // 1. Endomorfia
  const sum3 = (triceps + subescapular + suprailiaco) * (170.18 / estaturaCm);
  let endo = -0.7182 + 0.1451 * sum3 - 0.00068 * (sum3 * sum3) + 0.0000014 * (sum3 * sum3 * sum3);
  endo = Math.max(0.5, Math.round(endo * 10) / 10);

  // 2. Mesomorfia
  const codoCm = diametros?.codo || 6.5;
  const rodillaCm = diametros?.rodilla || 9.5;
  const brazoCorr = (perimetros?.brazo_contraido || perimetros?.brazo || 32) - (triceps / 10);
  const pantorrillaCorr = (perimetros?.pantorrilla || 36) - ((pliegues.pantorrilla || 10) / 10);

  let meso = 0.858 * codoCm + 0.601 * rodillaCm + 0.188 * brazoCorr + 0.161 * pantorrillaCorr - 0.131 * estaturaCm + 4.5;
  meso = Math.max(0.5, Math.round(meso * 10) / 10);

  // 3. Ectomorfia (HWR: Height-Weight Ratio)
  const hwr = estaturaCm / Math.cbrt(pesoKg);
  let ecto = 0.1;
  if (hwr >= 40.75) {
    ecto = 0.732 * hwr - 28.58;
  } else if (hwr >= 38.25) {
    ecto = 0.463 * hwr - 17.63;
  }
  ecto = Math.max(0.1, Math.round(ecto * 10) / 10);

  // Coordenadas bidimensionales X, Y para Somatocarta
  const x = Math.round((ecto - endo) * 100) / 100;
  const y = Math.round((2 * meso - (endo + ecto)) * 100) / 100;

  return { endo, meso, ecto, x, y };
}

export function getSomatotypeDiagnostic(endo: number, meso: number, ecto: number, nombreAtleta: string = 'El atleta'): string {
  const maxComp = Math.max(endo, meso, ecto);

  if (maxComp === endo && endo >= meso && endo >= ecto) {
    if (meso >= ecto) {
      return `La gráfica de somatotipo ubica a ${nombreAtleta} con un componente endomórfico marcadamente predominante y un componente mesomórfico secundario (biotipo endo-mesomorfo). Presenta tendencia a la acumulación de grasa corporal pero con una sólida base estructural y muscular para trabajo de fuerza.`;
    } else {
      return `La gráfica de somatotipo ubica a ${nombreAtleta} en la zona endomórfica predominante. Se recomienda priorizar el déficit calórico controlado combinando sobrecarga progresiva y resistencia metabólica.`;
    }
  } else if (maxComp === meso && meso >= endo && meso >= ecto) {
    if (endo >= ecto) {
      return `La gráfica de somatotipo ubica a ${nombreAtleta} con una fuerte dominancia mesomórfica y endomorfia secundaria (biotipo meso-endomorfo). Destaca por su alta masa muscular y estructura física robusta para rendimiento de potencia.`;
    } else {
      return `La gráfica de somatotipo ubica a ${nombreAtleta} con un biotipo meso-ectomorfo (gran tono muscular con baja grasa relativa y extremidades estilizadas), ideal para estética atlética y fuerza relativa.`;
    }
  } else if (maxComp === ecto && ecto >= endo && ecto >= meso) {
    if (meso >= endo) {
      return `La gráfica de somatotipo ubica a ${nombreAtleta} con dominancia ectomórfica y respuesta mesomórfica secundaria (biotipo ecto-mesomorfo), caracterizado por porcentaje graso muy bajo y físico estilizado.`;
    } else {
      return `La gráfica de somatotipo ubica a ${nombreAtleta} en el cuadrante ectomórfico (complexión delgada y metabolismo elevado). Se sugiere enfocar en superávit calórico nutricional y volumen de hipertrofia.`;
    }
  } else {
    return `La gráfica de somatotipo ubica a ${nombreAtleta} en una zona central equilibrada entre Endomorfia (${endo}), Mesomorfia (${meso}) y Ectomorfia (${ecto}), brindando alta flexibilidad para recomposición corporal.`;
  }
}

// ---------------------------------------------------------------------------
// 7. Metabolismo, Balance Calórico y Prescripción de Macronutrientes
// ---------------------------------------------------------------------------

export interface EnergyAndMacros {
  bmr: number;
  tdee: number;
  targetCalories: number;
  ajustePct: number;
  protein: MacroDistribution;
  fat: MacroDistribution;
  carbs: MacroDistribution;
}

export function calculateEnergyAndMacros(
  pesoKg: number,
  estaturaCm: number,
  edad: number,
  pctGrasa: number,
  frecuenciaEntreno: string = '3-4',
  ajusteCaloricoPct: number = 0,
  gProteinPerKg: number = 2.0,
  gFatPerKg: number = 1.0,
  genero: 'masculino' | 'femenino' = 'masculino'
): EnergyAndMacros {
  if (pesoKg <= 0) {
    const emptyMacro: MacroDistribution = { gPerKg: 0, grams: 0, calories: 0, percentage: 0 };
    return {
      bmr: 0, tdee: 0, targetCalories: 0, ajustePct: 0,
      protein: emptyMacro, fat: emptyMacro, carbs: emptyMacro,
    };
  }

  // BMR (Katch-McArdle si hay % grasa o Mifflin-St Jeor)
  let bmr = 0;
  if (pctGrasa > 0) {
    const masaMagraKg = pesoKg * (1 - pctGrasa / 100);
    bmr = Math.round(370 + 21.6 * masaMagraKg);
  } else {
    bmr = Math.round(10 * pesoKg + 6.25 * estaturaCm - 5 * edad + (genero === 'masculino' ? 5 : -161));
  }

  // Factor de actividad física (NEAT + EAT)
  let activityMultiplier = 1.375;
  if (frecuenciaEntreno.includes('1-2') || frecuenciaEntreno.includes('baja')) activityMultiplier = 1.2;
  else if (frecuenciaEntreno.includes('3-4') || frecuenciaEntreno.includes('moderada')) activityMultiplier = 1.45;
  else if (frecuenciaEntreno.includes('5-6') || frecuenciaEntreno.includes('alta')) activityMultiplier = 1.65;
  else if (frecuenciaEntreno.includes('diario') || frecuenciaEntreno.includes('atleta')) activityMultiplier = 1.8;

  const tdee = Math.round(bmr * activityMultiplier);
  const targetCalories = Math.max(1000, Math.round(tdee * (1 + ajusteCaloricoPct / 100)));

  // Proteínas (4 kcal/g)
  const pGrams = Math.round(pesoKg * gProteinPerKg);
  const pCalories = pGrams * 4;
  const pPct = Math.round((pCalories / targetCalories) * 100);

  // Grasas (9 kcal/g)
  const fGrams = Math.round(pesoKg * gFatPerKg);
  const fCalories = fGrams * 9;
  const fPct = Math.round((fCalories / targetCalories) * 100);

  // Carbohidratos (4 kcal/g) - Resto de calorías necesarias
  const cCalories = Math.max(0, targetCalories - (pCalories + fCalories));
  const cGrams = Math.round(cCalories / 4);
  const cGPerKg = Math.round((cGrams / pesoKg) * 10) / 10;
  const cPct = Math.max(0, 100 - (pPct + fPct));

  return {
    bmr,
    tdee,
    targetCalories,
    ajustePct: ajusteCaloricoPct,
    protein: { gPerKg: gProteinPerKg, grams: pGrams, calories: pCalories, percentage: pPct },
    fat: { gPerKg: gFatPerKg, grams: fGrams, calories: fCalories, percentage: fPct },
    carbs: { gPerKg: cGPerKg, grams: cGrams, calories: cCalories, percentage: cPct },
  };
}

// ---------------------------------------------------------------------------
// 8. Evaluador Principal de Valoración Antropométrica Completa
// ---------------------------------------------------------------------------

export function processFullAnthropometry(input: {
  cliente_id: string;
  entrenador_id?: string | null;
  fecha: string;
  edad: number;
  peso: number;
  estatura: number;
  estatura_sentado?: number | null;
  metodo: 'Yuhasz' | 'Faulkner' | 'ISAK';
  objetivo?: string | null;
  frecuencia_entreno?: string | null;
  pliegues?: PlieguesCutaneos;
  perimetros?: PerimetrosCorporales;
  diametros?: DiametrosOseos;
  ajuste_calorico_pct?: number;
  g_proteina_kg?: number;
  g_grasa_kg?: number;
  genero?: 'masculino' | 'femenino';
  notas?: string | null;
}): ValoracionAntropometrica {
  const genero = input.genero || 'masculino';
  const pliegues = input.pliegues || {};
  const perimetros = input.perimetros || {};
  const diametros = input.diametros || {};

  // 1. IMC
  const bmiInfo = calculateBMI(input.peso, input.estatura);

  // 2. % Grasa
  const pctGrasa = calculateBodyFatPct(pliegues, input.metodo, genero);
  const fatInfo = classifyBodyFat(pctGrasa, genero);

  // 3. Masas
  const masses = calculateFourMasses(input.peso, input.estatura, pctGrasa, diametros, genero, input.metodo);
  const muscleInfo = classifyMuscleMass(masses.pctMusculo, genero);

  // 4. Somatotipo
  const somato = calculateSomatotype(input.peso, input.estatura, pliegues, perimetros, diametros);

  // 5. Metabolismo y Macros
  const energy = calculateEnergyAndMacros(
    input.peso,
    input.estatura,
    input.edad,
    pctGrasa,
    input.frecuencia_entreno || '3-4',
    input.ajuste_calorico_pct || 0,
    input.g_proteina_kg || 2.0,
    input.g_grasa_kg || 1.0,
    genero
  );

  return {
    cliente_id: input.cliente_id,
    entrenador_id: input.entrenador_id,
    fecha: input.fecha,
    edad: input.edad,
    peso: input.peso,
    estatura: input.estatura,
    estatura_sentado: input.estatura_sentado,
    metodo: input.metodo,
    genero,
    objetivo: input.objetivo,
    frecuencia_entreno: input.frecuencia_entreno,
    pliegues,
    perimetros,
    diametros,
    imc: bmiInfo.imc,
    clasificacion_imc: bmiInfo.categoria,
    pct_grasa: masses.pctGrasa,
    clasificacion_grasa: fatInfo.categoria,
    kg_grasa: masses.kgGrasa,
    pct_musculo: masses.pctMusculo,
    clasificacion_musculo: muscleInfo.categoria,
    kg_musculo: masses.kgMusculo,
    pct_oseo: masses.pctOseo,
    kg_oseo: masses.kgOseo,
    pct_residual: masses.pctResidual,
    kg_residual: masses.kgResidual,
    ratio_musculo_grasa: masses.ratioMusculoGrasa,
    somatotipo: somato,
    bmr: energy.bmr,
    tdee: energy.tdee,
    target_calorias: energy.targetCalories,
    ajuste_calorico_pct: energy.ajustePct,
    macros: {
      proteina: energy.protein,
      grasa: energy.fat,
      carbohidratos: energy.carbs,
    },
    notas: input.notas,
  };
}
