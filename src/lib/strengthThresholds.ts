/**
 * EvolutionLab — Strength Thresholds Engine
 *
 * Sistema de umbrales para bloques de FUERZA GENERAL.
 * Complementa (no reemplaza) volumeThresholds.ts que maneja hipertrofia/mantenimiento.
 *
 * Unidad de medida: NL (Número de Levantamientos) semanales a intensidad ≥ 80% 1RM.
 * Los umbrales están definidos por PATRÓN DE MOVIMIENTO, no por grupo muscular.
 *
 * Referencia conceptual:
 *   - Israetel, M. et al. — Scientific Principles of Strength Training (RP)
 *   - Prilepin's Chart (intensidad vs NL óptimos)
 *   - Autoregulación por señales de SNC, no solo por fatiga muscular
 */

import { AthleteLevel } from './volumeThresholds';

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

/**
 * Patrones de movimiento para fuerza general.
 * Cada patrón agrupa ejercicios con demanda neuromuscular similar.
 */
export type MovementPattern =
  | 'squat'           // Sentadilla, hack squat, front squat
  | 'hinge'           // Peso muerto, RDL, buenos días
  | 'push_horizontal' // Press banca, press inclinado, fondos
  | 'push_vertical'   // Press hombro, OHP, push press
  | 'pull_horizontal' // Remo barra, remo cable, remo mancuerna
  | 'pull_vertical'   // Dominadas, jalón al pecho, pull-up
  | 'core_transfer';  // Plancha pesada, carry, pallof press, ab wheel

export interface StrengthThreshold {
  pattern: MovementPattern;
  label: string;          // Nombre en español
  exampleExercises: string[];

  /**
   * Todos los valores son NL semanales (reps × series) a ≥ 80% 1RM.
   * Ejemplo: 3x3 = 9 NL, 5x3 = 15 NL, 6x2 = 12 NL.
   */
  mev: number;            // NL mínimos para generar adaptación de fuerza
  mavMin: number;         // Inicio de la zona óptima
  mavMax: number;         // Tope de la zona óptima
  mrv: number;            // Límite máximo recuperable semanalmente

  intensityZone: string;  // Rango de intensidad recomendado (% 1RM)

  /**
   * Señales de MRV para fuerza (distintas a hipertrofia).
   * El límite aquí es neural/articular, no metabólico/muscular.
   */
  mrvSignals: string[];
}

// ─────────────────────────────────────────────
// TABLAS DE UMBRALES POR NIVEL
// ─────────────────────────────────────────────

/**
 * PRINCIPIANTE
 * Zona de intensidad 70-85% 1RM → multiplicador ~0.7–1.0.
 * NL★ base: un set de 3x10 al 75% ≈ peso 0.7 → 21 NL★ brutos × 0.7 = ~15 NL★.
 * Umbrales conservadores — el SNC principiante se satura rápido.
 */
export const STRENGTH_THRESHOLDS_PRINCIPIANTE: Record<MovementPattern, StrengthThreshold> = {
  squat: {
    pattern: 'squat',
    label: 'Sentadilla',
    exampleExercises: ['Sentadilla trasera', 'Sentadilla goblet', 'Sentadilla frontal'],
    mev: 5, mavMin: 8, mavMax: 13, mrv: 18,
    intensityZone: '70–85% 1RM',
    mrvSignals: [
      'Técnica se rompe antes de terminar la serie',
      'Pérdida de profundidad o colapso de rodillas',
      'Dolor articular en rodillas o cadera',
    ],
  },
  hinge: {
    pattern: 'hinge',
    label: 'Bisagra de cadera',
    exampleExercises: ['Peso muerto convencional', 'RDL', 'Buenos días'],
    mev: 4, mavMin: 6, mavMax: 10, mrv: 14,
    intensityZone: '70–85% 1RM',
    mrvSignals: [
      'Redondeo de espalda baja bajo carga',
      'Pérdida de tensión en el recorrido excéntrico',
      'Dolor lumbar persistente entre sesiones',
    ],
  },
  push_horizontal: {
    pattern: 'push_horizontal',
    label: 'Empuje horizontal',
    exampleExercises: ['Press banca', 'Press inclinado barra', 'Fondos lastrados'],
    mev: 5, mavMin: 8, mavMax: 13, mrv: 18,
    intensityZone: '75–85% 1RM',
    mrvSignals: [
      'Pérdida de arco o posición escapular',
      'Fallo de velocidad en la primera rep',
      'Dolor en codo o hombro anterior',
    ],
  },
  push_vertical: {
    pattern: 'push_vertical',
    label: 'Empuje vertical',
    exampleExercises: ['Press militar barra', 'Push press', 'Press Arnold mancuerna'],
    mev: 3, mavMin: 5, mavMax: 8, mrv: 12,
    intensityZone: '70–80% 1RM',
    mrvSignals: [
      'Extensión excesiva de lumbar para completar el rep',
      'Temblor en el lockout',
      'Fatiga de manguito antes que deltoides',
    ],
  },
  pull_horizontal: {
    pattern: 'pull_horizontal',
    label: 'Jalón horizontal',
    exampleExercises: ['Remo barra', 'Remo cable sentado', 'Remo mancuerna'],
    mev: 5, mavMin: 8, mavMax: 13, mrv: 18,
    intensityZone: '75–85% 1RM',
    mrvSignals: [
      'Exceso de momentum del torso para completar el rango',
      'Pérdida de retracción escapular',
      'Dolor en inserción de bíceps',
    ],
  },
  pull_vertical: {
    pattern: 'pull_vertical',
    label: 'Jalón vertical',
    exampleExercises: ['Dominadas', 'Jalón al pecho', 'Pull-up lastrado'],
    mev: 5, mavMin: 8, mavMax: 13, mrv: 18,
    intensityZone: '75–85% 1RM o BW+lastre',
    mrvSignals: [
      'Incapacidad de mantener depresión escapular',
      'Codo se adelanta al tirar',
      'Dolor en codo medial (epitrocleitis incipiente)',
    ],
  },
  core_transfer: {
    pattern: 'core_transfer',
    label: 'Core de transferencia',
    exampleExercises: ['Plancha con lastre', 'Pallof press', 'Farmer carry'],
    mev: 3, mavMin: 5, mavMax: 8, mrv: 12,
    intensityZone: 'RPE 7–8 (no aplica % 1RM)',
    mrvSignals: [
      'Pérdida de zona neutra lumbar durante el ejercicio',
      'Compensación con cadera o hombros',
    ],
  },
};

/**
 * INTERMEDIO
 * Zona 80–90% 1RM → multiplicador 1.0–1.5.
 * Referencia DUP: 2 días de sentadilla (5x3 RIR3 + 5x4 RIR1) ≈ 15 + 30 = 45 NL★.
 * MAV cubre programas DUP y bloques lineales de fuerza intermedios.
 * MRV representa el límite neural antes de regresión de rendimiento.
 */
export const STRENGTH_THRESHOLDS_INTERMEDIO: Record<MovementPattern, StrengthThreshold> = {
  squat: {
    pattern: 'squat',
    label: 'Sentadilla',
    exampleExercises: ['Sentadilla trasera', 'Sentadilla frontal', 'Box squat'],
    mev: 12, mavMin: 20, mavMax: 38, mrv: 52,
    intensityZone: '80–90% 1RM',
    mrvSignals: [
      'Pérdida de velocidad de barra > 20% entre semanas sin deload',
      'Dolor articular difuso en rodilla o cadera',
      'Calidad de sueño deteriorada + fatiga matutina persistente',
    ],
  },
  hinge: {
    pattern: 'hinge',
    label: 'Bisagra de cadera',
    exampleExercises: ['Peso muerto convencional', 'Peso muerto sumo', 'RDL rumano'],
    mev: 8, mavMin: 14, mavMax: 26, mrv: 36,
    intensityZone: '80–90% 1RM',
    mrvSignals: [
      'Sensación de "back pumps" crónicos post sesión',
      'Pérdida de rigidez del core bajo carga submáxima',
      'Regresión en el 1RM estimado con RPE constante',
    ],
  },
  push_horizontal: {
    pattern: 'push_horizontal',
    label: 'Empuje horizontal',
    exampleExercises: ['Press banca', 'Press banca agarre cerrado', 'Dips lastrados'],
    mev: 12, mavMin: 20, mavMax: 38, mrv: 52,
    intensityZone: '80–90% 1RM',
    mrvSignals: [
      'Sticking point aparece antes de lo usual en el rango medio',
      'Asimetría de codos durante el press',
      'Dolor tendinoso en pectoral menor o bíceps proximal',
    ],
  },
  push_vertical: {
    pattern: 'push_vertical',
    label: 'Empuje vertical',
    exampleExercises: ['Press militar', 'Push press', 'Press con pausa'],
    mev: 7, mavMin: 12, mavMax: 22, mrv: 30,
    intensityZone: '78–88% 1RM',
    mrvSignals: [
      'Incapacidad de mantener overhead estable con cargas previas',
      'Dolor subescapular o en acromion',
      'Pérdida de la posición de apilamiento (stack) en el lockout',
    ],
  },
  pull_horizontal: {
    pattern: 'pull_horizontal',
    label: 'Jalón horizontal',
    exampleExercises: ['Remo barra Pendlay', 'Remo cable unilateral', 'Remo en T'],
    mev: 12, mavMin: 20, mavMax: 38, mrv: 52,
    intensityZone: '80–88% 1RM',
    mrvSignals: [
      'Falla de retracción escapular completa bajo cargas submáximas',
      'Dolor en inserción de dorsal o redondo mayor',
      'Exceso de extensión lumbar compensatoria',
    ],
  },
  pull_vertical: {
    pattern: 'pull_vertical',
    label: 'Jalón vertical',
    exampleExercises: ['Pull-up lastrado', 'Dominadas pronadas', 'Jalón al pecho con pausa'],
    mev: 12, mavMin: 20, mavMax: 38, mrv: 52,
    intensityZone: '80–88% 1RM o BW+lastre',
    mrvSignals: [
      'Pérdida de rango inferior (no llega a barbilla-barra)',
      'Protracción escapular en la fase concéntrica',
      'Codo en valgo durante el tirón',
    ],
  },
  core_transfer: {
    pattern: 'core_transfer',
    label: 'Core de transferencia',
    exampleExercises: ['Ab wheel de pie', 'Pallof press con resistencia', 'Farmer carry pesado'],
    mev: 6, mavMin: 10, mavMax: 18, mrv: 26,
    intensityZone: 'RPE 7–9',
    mrvSignals: [
      'Pérdida de rigidez durante los levantamientos principales',
      'Dolor lumbar bajo carga compresiva leve',
    ],
  },
};

/**
 * AVANZADO
 * Zona 82–93% 1RM → multiplicador 1.2–1.5.
 * MEV sube porque necesitan más estímulo para adaptarse.
 * MRV no sube proporcionalmente — la fatiga del SNC a estas intensidades
 * escala más rápido que la capacidad de adaptación.
 */
export const STRENGTH_THRESHOLDS_AVANZADO: Record<MovementPattern, StrengthThreshold> = {
  squat: {
    pattern: 'squat',
    label: 'Sentadilla',
    exampleExercises: ['Sentadilla trasera', 'Sentadilla de competencia', 'Pausa squat'],
    mev: 20, mavMin: 30, mavMax: 48, mrv: 62,
    intensityZone: '82–93% 1RM',
    mrvSignals: [
      'Velocity loss > 25% en sets de competencia sin cambio de RPE percibido',
      'Dolor articular en cadera (ingle), rodilla o lumbar que no resuelve en 48h',
      'Regresión técnica bajo cargas conocidas (cambia bar path)',
      'Insomnio o irritabilidad elevada sin explicación externa',
    ],
  },
  hinge: {
    pattern: 'hinge',
    label: 'Bisagra de cadera',
    exampleExercises: ['Peso muerto convencional', 'Peso muerto sumo', 'Deficit deadlift'],
    mev: 14, mavMin: 22, mavMax: 34, mrv: 44,
    intensityZone: '82–93% 1RM',
    mrvSignals: [
      'Pérdida de bloqueo de cadera limpio en el lockout',
      'Dolor sacroilíaco persistente',
      'Regresión de fuerza isométrica en la posición de inicio',
    ],
  },
  push_horizontal: {
    pattern: 'push_horizontal',
    label: 'Empuje horizontal',
    exampleExercises: ['Press banca', 'Press banca con bandas', 'Board press'],
    mev: 20, mavMin: 30, mavMax: 48, mrv: 62,
    intensityZone: '82–93% 1RM',
    mrvSignals: [
      'Asimetría de carga derecha/izquierda perceptible al atleta',
      'Pérdida de contacto de espalda alta con la banca bajo máxima tensión',
      'Dolor en pectoral mayor o tendón del bíceps largo',
    ],
  },
  push_vertical: {
    pattern: 'push_vertical',
    label: 'Empuje vertical',
    exampleExercises: ['Press militar', 'Press con bandas', 'Jerk de posición'],
    mev: 12, mavMin: 18, mavMax: 28, mrv: 38,
    intensityZone: '80–90% 1RM',
    mrvSignals: [
      'Incapacidad de mantener el bar path vertical bajo cargas conocidas',
      'Dolor en manguito rotador o cápsula anterior',
      'Pérdida del timing de respiración/presión intraabdominal',
    ],
  },
  pull_horizontal: {
    pattern: 'pull_horizontal',
    label: 'Jalón horizontal',
    exampleExercises: ['Remo Pendlay pesado', 'Remo yates', 'Chest supported row'],
    mev: 20, mavMin: 30, mavMax: 48, mrv: 62,
    intensityZone: '82–90% 1RM',
    mrvSignals: [
      'Compensación excesiva de lumbar (más de 30° de oscilación del torso)',
      'Tendinopatía de dorsal o redondo mayor',
      'Pérdida de fuerza en la posición de máxima retracción',
    ],
  },
  pull_vertical: {
    pattern: 'pull_vertical',
    label: 'Jalón vertical',
    exampleExercises: ['Pull-up con lastre máximo', 'Dominadas con pausa', 'Archer pull-up'],
    mev: 20, mavMin: 30, mavMax: 48, mrv: 62,
    intensityZone: '82–90% 1RM o BW+lastre',
    mrvSignals: [
      'Falta de depresión escapular activa al inicio del pull',
      'Dolor medial de codo bajo carga conocida',
      'Reducción del rango de movimiento sin causa estructural',
    ],
  },
  core_transfer: {
    pattern: 'core_transfer',
    label: 'Core de transferencia',
    exampleExercises: ['Ab wheel de pie con lastre', 'Copenhagen plank', 'Suitcase carry'],
    mev: 10, mavMin: 16, mavMax: 26, mrv: 34,
    intensityZone: 'RPE 8–9',
    mrvSignals: [
      'Pérdida de rigidez lumbar durante los levantamientos principales bajo cargas sub-máximas',
      'Dolor discogénico o en sacroilíaco tras sesiones de core',
    ],
  },
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/**
 * Devuelve la tabla de umbrales correcta según el nivel del atleta.
 */
export const getStrengthTable = (
  level: AthleteLevel
): Record<MovementPattern, StrengthThreshold> => {
  switch (level) {
    case 'principiante': return STRENGTH_THRESHOLDS_PRINCIPIANTE;
    case 'avanzado':     return STRENGTH_THRESHOLDS_AVANZADO;
    case 'intermedio':
    default:             return STRENGTH_THRESHOLDS_INTERMEDIO;
  }
};

/**
 * Devuelve el umbral de un patrón específico para un nivel.
 */
export const getStrengthThreshold = (
  pattern: MovementPattern,
  level: AthleteLevel = 'intermedio'
): StrengthThreshold => {
  return getStrengthTable(level)[pattern];
};

/**
 * Evalúa el estado de volumen de fuerza de un patrón.
 * Devuelve status + mensaje + señales MRV si corresponde.
 *
 * @param pattern   Patrón de movimiento
 * @param weeklyNL  NL totales programados en la semana a ≥ 80% 1RM
 * @param level     Nivel del atleta
 */
export const evaluateStrengthVolume = (
  pattern: MovementPattern,
  weeklyNL: number,
  level: AthleteLevel = 'intermedio'
): {
  status: 'low' | 'optimal' | 'warning' | 'danger';
  message: string;
  mrvSignals?: string[];
} => {
  const t = getStrengthThreshold(pattern, level);

  if (weeklyNL < t.mev) {
    return {
      status: 'low',
      message: `Volumen insuficiente para generar adaptación de fuerza. MEV para ${t.label} (${level}): ${t.mev} NL/semana. Actual: ${weeklyNL} NL.`,
    };
  }

  if (weeklyNL >= t.mavMin && weeklyNL <= t.mavMax) {
    return {
      status: 'optimal',
      message: `Zona óptima de fuerza. ${t.label} (${level}): ${weeklyNL} NL/semana dentro del MAV (${t.mavMin}–${t.mavMax} NL). Intensidad recomendada: ${t.intensityZone}.`,
    };
  }

  if (weeklyNL > t.mavMax && weeklyNL < t.mrv) {
    return {
      status: 'warning',
      message: `Volumen alto. ${t.label} (${level}): ${weeklyNL} NL/semana supera el MAV (${t.mavMax} NL). Monitorea señales de fatiga de SNC antes de continuar escalando.`,
    };
  }

  // weeklyNL >= t.mrv
  return {
    status: 'danger',
    message: `⚠️ MRV superado. ${t.label} (${level}): ${weeklyNL} NL/semana ≥ MRV (${t.mrv} NL). Riesgo de sobreentrenamiento neural. Reduce volumen o programa deload.`,
    mrvSignals: t.mrvSignals,
  };
};

/**
 * Lista de todos los patrones disponibles (útil para iterar en UI).
 */
export const ALL_MOVEMENT_PATTERNS: MovementPattern[] = [
  'squat',
  'hinge',
  'push_horizontal',
  'push_vertical',
  'pull_horizontal',
  'pull_vertical',
  'core_transfer',
];

/**
 * Mapeo de ejercicios comunes a su patrón de movimiento.
 * Usado para auto-clasificar ejercicios al crear sesiones.
 */
export const EXERCISE_TO_PATTERN: Record<string, MovementPattern> = {
  // Squat
  'sentadilla trasera': 'squat',
  'sentadilla frontal': 'squat',
  'sentadilla goblet': 'squat',
  'sentadilla con barra': 'squat',
  'sentadilla con barra al frente': 'squat',
  'sentadilla libre con barra': 'squat',
  'sentadilla bulgara con mancuernas': 'squat',
  'prensa 45° pies abajo': 'squat',
  'desplantes con mancuernas': 'squat',
  'back squat': 'squat',
  'front squat': 'squat',
  'box squat': 'squat',
  'pausa squat': 'squat',
  'hack squat barra': 'squat',
  'hack squat con barra': 'squat',

  // Hinge
  'peso muerto': 'hinge',
  'peso muerto convencional': 'hinge',
  'peso muerto sumo': 'hinge',
  'rdl': 'hinge',
  'rdl rumano': 'hinge',
  'peso muerto rumano': 'hinge',
  'peso muerto rumano con barra': 'hinge',
  'buenos días': 'hinge',
  'buenos dias': 'hinge',
  'deficit deadlift': 'hinge',
  'rack pull': 'hinge',
  'hip thrust barra': 'hinge',
  'hip thrust con barra': 'hinge',
  'flexion de rodilla acostado': 'hinge',
  'flexion de rodilla sentado': 'hinge',

  // Push horizontal
  'press banca': 'push_horizontal',
  'press de banca': 'push_horizontal',
  'press banca plano': 'push_horizontal',
  'press de banca plano': 'push_horizontal',
  'press banco plano con barra': 'push_horizontal',
  'press banco plano con mancuernas': 'push_horizontal',
  'press banca inclinado': 'push_horizontal',
  'press de banca inclinado': 'push_horizontal',
  'press banco inclinado con barra': 'push_horizontal',
  'press banco inclinado con mancuernas': 'push_horizontal',
  'press banca declinado': 'push_horizontal',
  'press de banca declinado': 'push_horizontal',
  'press banco declinado con barra': 'push_horizontal',
  'press banco declinado con mancuernas': 'push_horizontal',
  'press inclinado': 'push_horizontal',
  'press inclinado barra': 'push_horizontal',
  'press inclinado con barra': 'push_horizontal',
  'press declinado': 'push_horizontal',
  'fondos lastrados': 'push_horizontal',
  'dips lastrados': 'push_horizontal',
  'press banca agarre cerrado': 'push_horizontal',
  'press de banca agarre cerrado': 'push_horizontal',
  'board press': 'push_horizontal',
  'fondos en barras paralelas': 'push_horizontal',

  // Push vertical
  'press militar': 'push_vertical',
  'press militar barra': 'push_vertical',
  'press militar con barra': 'push_vertical',
  'press militar con barra de pie': 'push_vertical',
  'press militar con barra sentado': 'push_vertical',
  'press militar con mancuernas sentado': 'push_vertical',
  'ohp': 'push_vertical',
  'press hombro': 'push_vertical',
  'press hombro barra': 'push_vertical',
  'press de hombro': 'push_vertical',
  'press de hombro con barra': 'push_vertical',
  'push press': 'push_vertical',
  'press arnold': 'push_vertical',
  'press con pausa overhead': 'push_vertical',

  // Pull horizontal
  'remo barra': 'pull_horizontal',
  'remo con barra': 'pull_horizontal',
  'remo pendlay': 'pull_horizontal',
  'remo yates': 'pull_horizontal',
  'remo cable': 'pull_horizontal',
  'remo con cable': 'pull_horizontal',
  'remo mancuerna': 'pull_horizontal',
  'remo con mancuerna': 'pull_horizontal',
  'remo individual con mancuerna': 'pull_horizontal',
  'remo en polea baja': 'pull_horizontal',
  'remo bajo hammer': 'pull_horizontal',
  'remo en t': 'pull_horizontal',
  'chest supported row': 'pull_horizontal',
  'remo unilateral': 'pull_horizontal',

  // Pull vertical
  'dominadas': 'pull_vertical',
  'dominadas lastradas': 'pull_vertical',
  'dominadas / pull ups': 'pull_vertical',
  'dominadas / pull ups con lastre': 'pull_vertical',
  'pull-up': 'pull_vertical',
  'pull up': 'pull_vertical',
  'pull-up lastrado': 'pull_vertical',
  'jalón al pecho': 'pull_vertical',
  'jalon al pecho': 'pull_vertical',
  'jalon al pecho polea': 'pull_vertical',
  'jalón polea': 'pull_vertical',
  'jalon polea': 'pull_vertical',
  'jalón con polea': 'pull_vertical',
  'jalon con polea': 'pull_vertical',
  'chin-up': 'pull_vertical',
  'chin up': 'pull_vertical',
  'chin ups': 'pull_vertical',

  // Core transfer
  'plancha con lastre': 'core_transfer',
  'pallof press': 'core_transfer',
  'farmer carry': 'core_transfer',
  'suitcase carry': 'core_transfer',
  'ab wheel': 'core_transfer',
  'ab wheel rollout': 'core_transfer',
  'rueda abdominal': 'core_transfer',
  'copenhagen plank': 'core_transfer',
  'plancha frontal': 'core_transfer',
};

/**
 * Detecta el patrón de movimiento de un ejercicio por su nombre.
 * Búsqueda parcial (includes) para mayor tolerancia a variaciones de nombre.
 *
 * @returns MovementPattern | null si no se reconoce
 */
export const detectPatternFromExerciseName = (
  exerciseName: string
): MovementPattern | null => {
  const normalized = exerciseName.toLowerCase().trim();
  if (!normalized) return null;

  // Búsqueda exacta primero
  if (EXERCISE_TO_PATTERN[normalized]) {
    return EXERCISE_TO_PATTERN[normalized];
  }

  // Búsqueda parcial como fallback
  for (const [key, pattern] of Object.entries(EXERCISE_TO_PATTERN)) {
    if (normalized.includes(key) || (normalized.length >= 2 && key.includes(normalized))) {
      return pattern;
    }
  }

  return null;
};
