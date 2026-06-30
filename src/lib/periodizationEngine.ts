/**
 * EvolutionLab Periodization & RIR Calculations Engine
 *
 * Implements scientific algorithms for:
 * 1. 1RM Estimation (Epley + Brzycki integrated with RIR)
 * 2. Load Prescription based on Reps + RIR
 * 3. Weekly Volume Auto-regulation (MEV / MAV / MRV)
 *    - Hipertrofia/mantenimiento → series/semana por grupo muscular (volumeThresholds.ts)
 *    - Fuerza general           → NL/semana por patrón de movimiento (strengthThresholds.ts)
 * 4. Biomechanical corrections for lift weak points
 * 5. Full-mesocycle auto-regulation with per-exercise deload
 */

import { PlanData } from '../types/database.types';
import { getThresholdsForMuscleGroup } from './volumeThresholds';
import {
  detectPatternFromExerciseName,
  evaluateStrengthVolume,
  getStrengthThreshold,
  MovementPattern,
} from './strengthThresholds';

// ─── Strength NL weighting (Opción B) ────────────────────────────────────────
// Pondera NL por intensidad estimada desde RIR, igual que VolumeTracker.
// Mantiene coherencia entre lo que el tracker muestra y lo que el motor chequea.

const estimateIntensityPct = (reps: number, rir: number): number => {
  const totalReps = reps + rir;
  if (totalReps <= 0) return 80;
  return Math.round(100 / (1 + totalReps * 0.0333));
};

const getNLWeight = (intensityPct: number): number => {
  if (intensityPct >= 90) return 1.5;
  if (intensityPct >= 85) return 1.2;
  if (intensityPct >= 80) return 1.0;
  if (intensityPct >= 70) return 0.7;
  return 0.5;
};

const calcWeightedNL = (sets: number, reps: number, rir: number | null): number => {
  if (rir === null || reps === 0) return sets * reps;
  const intensity = estimateIntensityPct(reps, rir);
  const weight    = getNLWeight(intensity);
  return Math.round(sets * reps * weight * 10) / 10;
};
const BRZYCKI_MAX_REPS = 36;           // Safe upper limit for Brzycki formula
const MAX_SETS_PER_EXERCISE = 8;       // MRV ceiling per exercise
const MIN_SETS_DELOAD = 2;             // Minimum sets during a deload week
const EMA_DECAY_FACTOR = 0.85;         // Weight for old 1RM during downward EMA adjustment
const DELOAD_RIR = '4';                // Conservative RIR for active recovery weeks

// ─── Exported Interfaces ─────────────────────────────────────────────────────

export interface WeakPointCorrection {
  name: string;
  tempo: string;
  description: string;
}

export interface VolumeAdjustment {
  nextSets: number;
  triggerDeload: boolean;
  notes: string;
}

/** Available formulas for 1RM estimation and load prescription */
export type FormulaType = 'epley' | 'brzycki' | 'epley_brzycki_avg';

/** Detailed load prescription result with full reasoning metadata */
export interface LoadPrescription {
  weight: number;              // Final rounded weight (e.g., 87.5)
  exactWeight: number;         // Exact calculated weight before rounding (e.g., 88.95)
  pct1RM: number;              // Percentage of 1RM used (e.g., 0.75)
  oneRM: number;               // The 1RM value used (e.g., 118.6)
  reps: number;                // Target reps (e.g., 8)
  rir: number;                 // Target RIR (e.g., 2)
  effectiveReps: number;       // reps + rir (e.g., 10)
  roundingIncrement: number;   // The rounding increment used (e.g., 2.5)
  formula: FormulaType;        // Which formula was used
  formulaLabel: string;        // Human-readable formula name (e.g., "Epley (1985)")
  formulaExpression: string;   // The math expression (e.g., "30 / (30 + 8 + 2) = 75.0%")
  source: string;              // Scientific citation
}

/** Shape of each exercise entry passed by AddSesion to the auto-regulation engine. */
export interface LoggedExerciseInput {
  nombre: string;
  repsArray: number[];
  peso: number;
  rir: number;                        // BUG-06 fix: renamed from 'rpe' — this is Reps In Reserve
  feedback_estimulo?: 'none' | 'good' | 'extreme';
  feedback_recuperacion?: 'recovered' | 'just_in_time' | 'sore';
}

// ─── 1. 1RM Estimation ──────────────────────────────────────────────────────

/**
 * Calculates estimated 1RM based on weight, reps achieved, and reps in reserve (RIR).
 * Uses an integrated Epley + Brzycki formula adjusted for RIR.
 * 
 * BUG-07 fix: Brzycki denominator is now guarded with `<= BRZYCKI_MAX_REPS`
 * instead of `< 37`, preventing near-zero division with non-integer inputs.
 */
export const calculate1RM = (weight: number, reps: number, rir: number = 0): number => {
  if (weight <= 0 || reps <= 0) return 0;
  const effectiveReps = reps + rir;
  
  // Epley Formula
  const epley = weight * (1 + effectiveReps / 30);
  
  // Brzycki Formula — guarded to prevent near-zero or negative denominator
  const denominator = 1.0278 - 0.0278 * effectiveReps;
  const brzycki = (effectiveReps <= BRZYCKI_MAX_REPS && denominator > 0.01)
    ? weight / denominator
    : weight; // Fallback: raw weight when formula breaks down at high reps

  return Math.round(((epley + brzycki) / 2) * 10) / 10;
};

// ─── 2. Load Prescription ────────────────────────────────────────────────────

/**
 * Calculates the recommended training load (weight) for a given target rep count and RIR,
 * based on the athlete's estimated 1RM.
 */
export const getPrescribedLoad = (oneRM: number, reps: number, targetRIR: number): number => {
  if (oneRM <= 0 || reps <= 0) return 0;
  
  // Epley's inverse to find % of 1RM: %1RM = 30 / (30 + reps + RIR)
  const pct1RM = 30 / (30 + reps + targetRIR);
  
  // Suggested weight rounded to the nearest 2.5 kg (standard gym increments)
  const exactWeight = oneRM * pct1RM;
  return Math.round(exactWeight / 2.5) * 2.5;
};

/**
 * Detailed version of getPrescribedLoad that returns full reasoning metadata.
 * Supports formula selection: 'epley', 'brzycki', or 'epley_brzycki_avg'.
 * The rounding increment is configurable (default 2.5 kg).
 */
export const getPrescribedLoadDetailed = (
  oneRM: number,
  reps: number,
  targetRIR: number,
  formula: FormulaType = 'epley',
  roundingIncrement: number = 2.5
): LoadPrescription => {
  if (oneRM <= 0 || reps <= 0) {
    return {
      weight: 0, exactWeight: 0, pct1RM: 0, oneRM, reps, rir: targetRIR,
      effectiveReps: reps + targetRIR, roundingIncrement, formula,
      formulaLabel: getFormulaLabel(formula),
      formulaExpression: 'N/A (datos insuficientes)',
      source: getFormulaSource(formula),
    };
  }

  const effectiveReps = reps + targetRIR;
  let pct1RM: number;
  let formulaExpression: string;

  switch (formula) {
    case 'epley': {
      // Epley inverse: %1RM = 1 / (1 + effectiveReps / 30) = 30 / (30 + effectiveReps)
      pct1RM = 30 / (30 + effectiveReps);
      formulaExpression = `30 / (30 + ${reps} + ${targetRIR}) = ${(pct1RM * 100).toFixed(1)}%`;
      break;
    }
    case 'brzycki': {
      // Brzycki inverse: %1RM = (1.0278 - 0.0278 × effectiveReps)
      const rawPct = 1.0278 - 0.0278 * effectiveReps;
      pct1RM = Math.max(rawPct, 0.05); // Floor to prevent negative/zero
      formulaExpression = `1.0278 - 0.0278 × ${effectiveReps} = ${(pct1RM * 100).toFixed(1)}%`;
      break;
    }
    case 'epley_brzycki_avg':
    default: {
      const epleyPct = 30 / (30 + effectiveReps);
      const brzyckiPct = Math.max(1.0278 - 0.0278 * effectiveReps, 0.05);
      pct1RM = (epleyPct + brzyckiPct) / 2;
      formulaExpression = `Promedio(Epley: ${(epleyPct * 100).toFixed(1)}%, Brzycki: ${(brzyckiPct * 100).toFixed(1)}%) = ${(pct1RM * 100).toFixed(1)}%`;
      break;
    }
  }

  const exactWeight = oneRM * pct1RM;
  const weight = Math.round(exactWeight / roundingIncrement) * roundingIncrement;

  return {
    weight,
    exactWeight: Math.round(exactWeight * 100) / 100,
    pct1RM,
    oneRM,
    reps,
    rir: targetRIR,
    effectiveReps,
    roundingIncrement,
    formula,
    formulaLabel: getFormulaLabel(formula),
    formulaExpression,
    source: getFormulaSource(formula),
  };
};

/** Returns human-readable label for a formula type */
export const getFormulaLabel = (formula: FormulaType): string => {
  switch (formula) {
    case 'epley': return 'Epley (1985)';
    case 'brzycki': return 'Brzycki (1993)';
    case 'epley_brzycki_avg': return 'Promedio Epley-Brzycki';
    default: return 'Epley (1985)';
  }
};

/** Returns scientific citation for a formula type */
export const getFormulaSource = (formula: FormulaType): string => {
  switch (formula) {
    case 'epley': return 'Epley, B. (1985). Poundage Chart. Boyd Epley Workout. Lincoln, NE.';
    case 'brzycki': return 'Brzycki, M. (1993). Strength Testing. Journal of Physical Education, Recreation & Dance, 64(1), 88-90.';
    case 'epley_brzycki_avg': return 'Promedio de Epley (1985) y Brzycki (1993). LeSuer et al. (1997) validaron ambas fórmulas como igualmente precisas dentro de rangos de 1-10 RM.';
    default: return 'Epley, B. (1985).';
  }
};

// ─── 2b. RIR Target por Semana ───────────────────────────────────────────────

/**
 * Calcula el RIR target para la semana actual del mesociclo.
 *
 * Principiante: baja cada 2 semanas (progresión 'lenta'), floor en 1.
 *   Nunca llega a RIR 0 — la técnica aún no está consolidada y el riesgo
 *   de lesión con fallo muscular supera el beneficio potencial.
 *
 * Intermedio:   baja cada semana (progresión 'normal'), floor en 0.
 *   Triple progresión: carga + reps + series. Llega a fallo en la última
 *   semana del bloque para maximizar el estímulo antes del deload.
 *
 * Avanzado:     igual que intermedio pero rir_inicial puede ser 4,
 *   permitiendo bloques de 5–6 semanas sin llegar a fallo prematuro.
 *
 * La fórmula de prescripción de carga usa el RIR resultante:
 *   peso = 1RM × [30 / (30 + reps + RIR_target)]
 * → RIR bajo = % 1RM alto = más peso automáticamente.
 * → Las dos palancas (RIR + 1RM actualizado) se potencian semana a semana.
 */
export const calcTargetRIRForWeek = (
  semanaActual: number,
  rirInicial: number,
  nivel: 'principiante' | 'intermedio' | 'avanzado',
  progresion: 'lenta' | 'normal' | 'agresiva' = 'normal'
): number => {
  // Principiantes no llegan a fallo (RIR mínimo 1)
  const floorRIR = nivel === 'principiante' ? 1 : 0;

  // 'lenta' baja cada 2 semanas; 'normal'/'agresiva' bajan cada semana
  const decrement = progresion === 'lenta'
    ? Math.floor((semanaActual - 1) / 2)
    : semanaActual - 1;

  return Math.max(floorRIR, rirInicial - decrement);
};

// ─── 2c. Progresión de Reps (Doble Progresión) ───────────────────────────────

/**
 * Parsea un string de rango de reps ("10-12", "10", "60s") y devuelve
 * { repsMin, repsMax }. Para strings sin rango, min === max.
 * Devuelve null si el string no contiene números (ej. "60s" sin número útil).
 */
export const parseRepsRange = (repsStr: string): { repsMin: number; repsMax: number } | null => {
  const nums = repsStr.match(/\d+/g);
  if (!nums || nums.length === 0) return null;
  const repsMin = parseInt(nums[0], 10);
  const repsMax = nums.length > 1 ? parseInt(nums[1], 10) : repsMin;
  return { repsMin, repsMax };
};

/** Resultado del chequeo de progresión de reps */
export interface RepProgressionResult {
  newWeight: number;   // Nuevo peso prescripto (redondeado al incremento)
  newReps: number;     // Reps objetivo para la próxima sesión (repsMin del rango)
  note: string;        // Nota visible al atleta
}

/**
 * Detecta si el atleta completó el tope del rango de reps con RIR de sobra
 * y calcula el nuevo peso para la próxima sesión (doble progresión).
 *
 * La doble progresión funciona así:
 *   1. El atleta empieza en el MÍNIMO del rango (ej. 10 reps) con el peso dado.
 *   2. Cada sesión intenta llegar a más reps dentro del rango.
 *   3. Cuando llega al MÁXIMO (ej. 12) con RIR real > RIR_target + 1 (le sobra
 *      margen), el peso sube y vuelve al mínimo del rango.
 *
 * La condición "RIR real > RIR_target + 1" (margen de +1) evita subidas
 * prematuras: si el atleta hizo 12 reps con RIR 2 y el target era RIR 2,
 * no hay margen real — el peso no debería subir todavía.
 *
 * @param loggedMaxReps   Máximo de reps logrado en cualquier serie de la sesión
 * @param repsMax         Tope del rango del plan (ej. 12 de "10-12")
 * @param repsMin         Piso del rango del plan (ej. 10 de "10-12")
 * @param rirLogrado      RIR real reportado por el atleta
 * @param rirTarget       RIR objetivo de la semana actual (del plan)
 * @param oneRM           1RM actualizado del ejercicio
 * @param roundingIncrement  Incremento de redondeo en kg (default 2.5)
 * @returns RepProgressionResult si aplica la subida, null si no
 */
export const checkRepProgressionTrigger = (
  loggedMaxReps: number,
  repsMax: number,
  repsMin: number,
  rirLogrado: number,
  rirTarget: number,
  oneRM: number,
  roundingIncrement: number = 2.5
): RepProgressionResult | null => {
  // Condición: llegó al tope del rango Y le sobra al menos 1 RIR de margen
  if (loggedMaxReps < repsMax) return null;
  if (rirLogrado <= rirTarget + 1) return null;
  if (oneRM <= 0) return null;

  // Nuevo peso: prescripto para el MÍNIMO del rango con el RIR target actual
  // Volver al mínimo del rango con más peso = doble progresión clásica
  const pct1RM   = 30 / (30 + repsMin + rirTarget);
  const exact    = oneRM * pct1RM;
  const newWeight = Math.round(exact / roundingIncrement) * roundingIncrement;
  if (newWeight <= 0) return null;

  const margenExtra = rirLogrado - rirTarget;
  return {
    newWeight,
    newReps: repsMin,
    note: `🤖 Rango completado (${repsMax} reps con RIR ${rirLogrado}, objetivo RIR ${rirTarget} — ${margenExtra} de margen). Peso ajustado a ${newWeight} kg para retomar desde ${repsMin} reps.`,
  };
};

// ─── 3. Weak Point Corrections ───────────────────────────────────────────────

/**
 * Suggests mechanical corrections and accessory exercises based on lift weak points.
 */
export const getWeakPointCorrection = (
  lift: 'sentadilla' | 'banca' | 'peso_muerto',
  point: 'abajo' | 'mitad' | 'arriba' | 'pecho' | 'bloqueo' | 'despegue' | 'rodillas'
): WeakPointCorrection | null => {
  if (lift === 'sentadilla') {
    if (point === 'abajo') {
      return {
        name: 'Sentadilla con Pausa (Pause Squats)',
        tempo: '3-2-1-0',
        description: 'Baja en 3 segundos, sostén una pausa estricta de 2 segundos abajo en el punto más profundo para disipar la energía elástica, y sube de forma explosiva. Fortalece la salida concéntrica profunda.'
      };
    }
    if (point === 'mitad') {
      return {
        name: 'Pin Squats (Sentadilla desde Pines)',
        tempo: '2-1-1-0',
        description: 'Coloca los pines de seguridad en tu punto de estancamiento. Baja hasta apoyar la barra levemente, haz una pausa de 1 segundo sin perder tensión corporal y sube explosivamente.'
      };
    }
    if (point === 'arriba') {
      return {
        name: 'Sentadilla con Bandas / Cadenas',
        tempo: '2-0-1-0',
        description: 'Agrega resistencia acomodada (bandas elásticas o cadenas) para sobrecargar la porción superior del rango de movimiento y entrenar la fase de bloqueo final.'
      };
    }
  }

  if (lift === 'banca') {
    if (point === 'pecho') {
      return {
        name: 'Spoto Press',
        tempo: '3-1-1-0',
        description: 'Baja la barra de forma controlada y deténla exactamente a 2-3 cm del pecho. Sosténla inmóvil durante 1 segundo antes de presionar hacia arriba. Aumenta la estabilidad y fuerza en el arranque.'
      };
    }
    if (point === 'mitad') {
      return {
        name: 'Press de Banca con Tabla (Board Press)',
        tempo: '2-1-1-0',
        description: 'Coloca una tabla o taco de espuma sobre el pecho para recortar el rango de movimiento y sobrecargar el punto medio de empuje y la transición a los tríceps.'
      };
    }
    if (point === 'bloqueo') {
      return {
        name: 'Press de Banca con Agarre Estrecho (Close Grip)',
        tempo: '3-0-1-0',
        description: 'Cierra el agarre a la altura de los hombros para transferir el esfuerzo de empuje hacia los tríceps, fortaleciendo el bloqueo final del codo.'
      };
    }
  }

  if (lift === 'peso_muerto') {
    if (point === 'despegue') {
      return {
        name: 'Peso Muerto con Déficit',
        tempo: '2-1-1-0',
        description: 'Súbete a un disco de 20 kg o plataforma de 5-10 cm de altura. Esto aumenta el recorrido y te obliga a empujar con más fuerza con las piernas al iniciar el despegue.'
      };
    }
    if (point === 'rodillas') {
      return {
        name: 'Peso Muerto con Pausa bajo Rodillas',
        tempo: '2-2-1-0',
        description: 'Realiza el jalón desde el suelo, haz una pausa estricta de 2 segundos justo debajo de la rótula, y finaliza el movimiento bloqueando con fuerza. Mejora la tensión en la espalda.'
      };
    }
    if (point === 'bloqueo') {
      return {
        name: 'Rack Pulls (Peso Muerto parcial)',
        tempo: '1-0-1-0',
        description: 'Coloca la barra sobre pines a la altura de las rodillas. Realiza el tirón final sobrecargando los glúteos, el lumbar y el trapecio para afianzar el bloqueo terminal.'
      };
    }
  }

  return null;
};

// ─── 4. Microcycle Volume Auto-regulation ────────────────────────────────────

/**
 * Evaluates athlete feedback after a training session to auto-regulate sets for the next week.
 * Follows the MEV/MAV/MRV logic (RP Hypertrophy model).
 *
 * BUG-13 fix: `nivel` now gates volume progression strategy by athlete level.
 *
 * — PRINCIPIANTE: Volumen FIJO durante todo el mesociclo. Progresan exclusivamente
 *   via progresión lineal (más peso o más reps con el mismo peso). Aumentar series
 *   semana a semana genera daño muscular excesivo que su sistema no puede reparar,
 *   saboteando las ganancias. El MRV del principiante está pegado al MEV (4-10 series),
 *   por lo que no hay margen para acumulación dinámica.
 *
 * — INTERMEDIO: Progresión dinámica ondulante. Arrancan cerca del MEV y van sumando
 *   series de forma reactiva hasta alcanzar el MRV al final del bloque.
 *
 * — AVANZADO: Misma lógica dinámica que intermedio dentro de los grupos en foco.
 *   La especialización por grupos (MV para el resto) se maneja a nivel de plan
 *   config, no aquí.
 */
export const calculateNextMicrocycleVolume = (
  currentSets: number,
  stimulusFeedback: 'none' | 'good' | 'extreme',
  recoveryFeedback: 'recovered' | 'just_in_time' | 'sore',
  nivel: 'principiante' | 'intermedio' | 'avanzado' = 'intermedio'
): VolumeAdjustment => {
  if (currentSets <= 0) return { nextSets: 3, triggerDeload: false, notes: 'Volumen inicial por defecto.' };

  // ── PRINCIPIANTE: volumen fijo, solo puede bajar si hay mal recovery ────────
  // Su MEV y MRV están muy cerca, y su sensibilidad al estímulo es tan alta que
  // un volumen mínimo y constante ya produce adaptación máxima. La progresión
  // ocurre únicamente por carga y repeticiones (progresión lineal).
  if (nivel === 'principiante') {
    if (recoveryFeedback === 'sore') {
      const reducedSets = Math.max(1, currentSets - 1);
      return {
        nextSets: reducedSets,
        triggerDeload: currentSets >= 4,
        notes: 'Principiante con recuperación insuficiente. Se reduce 1 serie. Progresión por carga/reps, no por volumen.'
      };
    }
    // recovered o just_in_time → volumen intacto, progresión lineal en carga
    return {
      nextSets: currentSets,
      triggerDeload: false,
      notes: 'Principiante: volumen fijo. Progresa aumentando peso o repeticiones en la próxima sesión.'
    };
  }

  // ── INTERMEDIO / AVANZADO: progresión dinámica reactiva ────────────────────

  // Under-recovered: Athlete is sore or performance fell
  if (recoveryFeedback === 'sore') {
    const reducedSets = Math.max(1, currentSets - 1);
    return {
      nextSets: reducedSets,
      triggerDeload: currentSets >= 6, // Trigger automatic deload if under-recovering at high volumes
      notes: 'Bajo nivel de recuperación. Se reduce el volumen de series para favorecer la recuperación.'
    };
  }

  // Just in time: Muscle recovered exactly on training day
  if (recoveryFeedback === 'just_in_time') {
    return {
      nextSets: currentSets,
      triggerDeload: false,
      notes: 'Recuperación óptima. Se mantiene el volumen actual de series para consolidar adaptaciones.'
    };
  }

  // Recovered and ready for more:
  if (recoveryFeedback === 'recovered') {
    // Low or normal stimulus: increase volume to progress towards MAV
    if (stimulusFeedback === 'none' || stimulusFeedback === 'good') {
      const nextSets = Math.min(MAX_SETS_PER_EXERCISE, currentSets + 1);
      return {
        nextSets,
        triggerDeload: false,
        notes: 'Buena recuperación y estímulo moderado. Se incrementa +1 serie para avanzar hacia el MAV.'
      };
    }
    
    // Extreme stimulus: already at maximum benefit, don't increase sets further
    if (stimulusFeedback === 'extreme') {
      return {
        nextSets: currentSets,
        triggerDeload: false,
        notes: 'Estímulo extremo. Se mantiene el volumen para evitar sobrepasar el MRV prematuramente.'
      };
    }
  }

  return { nextSets: currentSets, triggerDeload: false, notes: 'Mantener volumen.' };
};

// ─── 5. Full Mesocycle Auto-regulation ───────────────────────────────────────

/**
 * Maps a normalized exercise name to one of the three tracked powerlifts.
 * Returns null for accessory/isolation exercises.
 */
export const mapExerciseToLiftKey = (normName: string): string | null => {
  // Only map primary compound variants — not accessories like "sentadilla búlgara"
  if (normName === 'sentadilla' || normName === 'sentadilla trasera' || normName === 'sentadilla con barra' || normName === 'back squat' || normName === 'sentadilla libre con barra') {
    return 'sentadilla';
  }
  if (normName === 'press de banca' || normName === 'press banca' || normName === 'bench press' || normName === 'press de banca plano' || normName === 'press banco plano con barra') {
    return 'press de banca';
  }
  if (normName === 'peso muerto' || normName === 'peso muerto convencional' || normName === 'deadlift' || normName === 'peso muerto sumo' || normName === 'peso muerto rumano con barra') {
    return 'peso muerto';
  }
  // Fallback: partial matching for flexibility, but only for clear compound names
  if (normName.includes('sentadilla') && !normName.includes('búlgar') && !normName.includes('bulgar')) {
    return 'sentadilla';
  }
  if ((normName.includes('press') && (normName.includes('banca') || normName.includes('banco'))) || normName.includes('bench')) {
    return 'press de banca';
  }
  if (normName.includes('peso muerto') || normName.includes('deadlift')) {
    return 'peso muerto';
  }
  return null;
};

/**
 * Updates the athlete's functional 1RM mark for a lift using Exponential Moving Average.
 * - New PR detected → take the new value immediately.
 * - Lower estimate (detraining/fatigue) → gradual decay via EMA.
 * 
 * BUG-05 fix: Previously 1RM could only go up, trapping inflated marks after injury.
 */
const updateMarca1RM = (
  marcas: Record<string, number>,
  liftKey: string,
  newEstimate: number
): void => {
  const previousMark = marcas[liftKey] || 0;

  if (previousMark === 0 || newEstimate >= previousMark) {
    // First entry or new PR — accept immediately
    marcas[liftKey] = newEstimate;
  } else {
    // Performance regression — decay gradually via EMA to avoid drastic prescription drops
    marcas[liftKey] = Math.round(
      (EMA_DECAY_FACTOR * previousMark + (1 - EMA_DECAY_FACTOR) * newEstimate) * 10
    ) / 10;
  }
};

/**
 * Automatically calculates sets, updates functional 1RMs, and manages weeks / deloads
 * for the next microcycle based on the logged workout feedback (RP + MacroFactor hybrid).
 *
 * BUG-02 fix: Deload is now per-exercise (handled by calculateNextMicrocycleVolume).
 *             Global deload only triggers at end-of-block (currentWeek >= totalWeeks).
 * BUG-04 fix: When in deload week, per-exercise volume adjustments are SKIPPED to
 *             prevent double-reduction (feedback reduce + deload halving).
 * BUG-12 fix: Uses PlanData type instead of `any`.
 * BUG-13 fix: Passes `nivel` to calculateNextMicrocycleVolume — principiantes no suben series.
 * BUG-14 fix: Volume adjustment timing — el ajuste de volumen se aplica SOLO al cerrar el
 *             microciclo (última sesión de la semana). Las sesiones intermedias acumulan
 *             feedback en `config.weekly_session_feedback` sin tocar las series del plan.
 *             El 1RM se sigue actualizando en cada sesión (no tiene el mismo problema).
 *
 *             Lógica de cierre de microciclo:
 *             1. Cada sesión incrementa `sessions_completed_this_week`.
 *             2. Cuando `sessions_completed_this_week >= sessions_per_week`, se procesa
 *                el feedback acumulado y se avanza la semana.
 *             3. El feedback se consolida por ejercicio: si un músculo reportó
 *                recuperación mixta (sore en sesión A, recovered en sesión B),
 *                se toma el peor caso (sore gana). Para el estímulo, se promedia.
 */
export const autoRegulatePlanForNextWeek = (
  plan: PlanData,
  loggedExercises: LoggedExerciseInput[]
): PlanData | null => {
  if (!plan) return null;

  // Deep clone to avoid mutations on the original plan object
  const updatedPlan: PlanData = JSON.parse(JSON.stringify(plan));

  if (!updatedPlan.periodizationConfig || !updatedPlan.periodizationConfig.enabled) {
    return updatedPlan;
  }

  const config = updatedPlan.periodizationConfig;
  const marcas = config.marcas_1rm || {};
  const currentWeek = config.semana_actual || 1;
  const totalWeeks = config.total_semanas || 4;
  const nivel = config.nivel_atleta as 'principiante' | 'intermedio' | 'avanzado';
  const isStrengthBlock = config.objetivo === 'fuerza';

  // ── BUG-14: Inicializar contadores si son la primera sesión del bloque ─────
  if (config.sessions_per_week === undefined || config.sessions_per_week === 0) {
    config.sessions_per_week = updatedPlan.trainingDays?.length || 3;
  }
  if (config.sessions_completed_this_week === undefined) {
    config.sessions_completed_this_week = 0;
  }
  if (!config.weekly_session_feedback) {
    config.weekly_session_feedback = [];
  }

  // ── PASO 1: 1RM tracking — siempre se ejecuta en cada sesión ──────────────
  // El 1RM mejora con cada dato disponible. No hay riesgo de timing porque
  // no modifica series — solo actualiza el estimado funcional del atleta.
  loggedExercises.forEach(logged => {
    const normName = logged.nombre.toLowerCase().trim();
    const actualRIR = logged.rir;
    const maxReps = Math.max(...(logged.repsArray || []), 0);

    if (maxReps > 0 && logged.peso > 0) {
      const currentEstimated1RM = calculate1RM(logged.peso, maxReps, actualRIR);
      if (currentEstimated1RM > 0) {
        updateMarca1RM(marcas, normName, currentEstimated1RM);
        const aliasKey = mapExerciseToLiftKey(normName);
        if (aliasKey && aliasKey !== normName) {
          updateMarca1RM(marcas, aliasKey, currentEstimated1RM);
        }
      }
    }

    // Acumular feedback semanal para aplicar al cerrar el microciclo
    const estimulo     = logged.feedback_estimulo    || 'good';
    const recuperacion = logged.feedback_recuperacion || 'recovered';
    config.weekly_session_feedback!.push({
      ejercicio:   logged.nombre,
      estimulo,
      recuperacion,
      fecha:       new Date().toISOString().slice(0, 10),
    });
  });

  config.marcas_1rm = marcas;

  // ── Recalcular pesos con el 1RM actualizado (siempre, cada sesión) ─────────
  // La prescripción de peso mejora con cada sesión aunque las series no cambien.
  // Si además el atleta completó el tope del rango con RIR de sobra, aplica
  // doble progresión: sube el peso y resetea a repsMin del rango.
  //
  // FIX: Se construye un Map de loggedExercises por nombre normalizado ANTES
  // del forEach de ejercicios del plan. Esto evita el bug donde el mismo
  // ejercicio presente en dos días distintos (ej. "Sentadilla" en Día A y Día C)
  // recibía la doble progresión dos veces: una por cada aparición en el plan,
  // ambas usando los datos del único loggedEntry encontrado por nombre.
  // Con el Map + Set de nombres ya procesados, la doble progresión se aplica
  // como máximo UNA vez por nombre de ejercicio por sesión.
  const loggedMap = new Map<string, typeof loggedExercises[0]>();
  for (const l of loggedExercises) {
    loggedMap.set(l.nombre.toLowerCase().trim(), l);
  }
  // Rastrear qué ejercicios ya tuvieron doble progresión aplicada en esta sesión
  const doubleProgressionApplied = new Set<string>();

  updatedPlan.trainingDays?.forEach(day => {
    day.exercises?.forEach(ex => {
      if (!ex.nombre) return;
      const normName = ex.nombre.toLowerCase().trim();
      let oneRM = marcas[normName];
      if (!oneRM) {
        const alias = mapExerciseToLiftKey(normName);
        if (alias) oneRM = marcas[alias];
      }
      if (oneRM && oneRM > 0) {
        const repsStr      = ex.variables?.['repeticiones'] || '';
        const rirStr       = ex.variables?.['rir'] || '0';
        const rirMatch     = rirStr.match(/\d+/);
        const targetRIR    = rirMatch ? parseFloat(rirMatch[0]) : 0;
        const roundingIncrement = config.redondeo_peso ?? 2.5;
        const parsedRange  = parseRepsRange(repsStr);

        if (!parsedRange) return;
        const { repsMin, repsMax } = parsedRange;

        // Buscar el ejercicio en la sesión loggeada usando el Map O(1)
        const loggedEntry = loggedMap.get(normName);

        let appliedProgression = false;

        // Doble progresión: solo si fue loggeado en esta sesión Y no se aplicó
        // ya en otro día del mismo plan (ejercicio repetido en múltiples días)
        if (loggedEntry && loggedEntry.repsArray.length > 0 && !doubleProgressionApplied.has(normName)) {
          const loggedMaxReps = Math.max(...loggedEntry.repsArray);
          const rirLogrado    = loggedEntry.rir;

          const progressionResult = checkRepProgressionTrigger(
            loggedMaxReps,
            repsMax,
            repsMin,
            rirLogrado,
            targetRIR,
            oneRM,
            roundingIncrement
          );

          if (progressionResult) {
            if (!ex.variables) ex.variables = {};
            ex.variables['peso']          = `🤖 ${progressionResult.newWeight} kg`;
            ex.progression_notes          = progressionResult.note;
            appliedProgression            = true;
            doubleProgressionApplied.add(normName);
          }
        }

        // Si no hubo doble progresión, prescripción estándar desde 1RM
        if (!appliedProgression && repsMin > 0) {
          const newLoad = getPrescribedLoad(oneRM, repsMin, targetRIR);
          if (newLoad > 0) {
            if (!ex.variables) ex.variables = {};
            ex.variables['peso'] = `🤖 ${newLoad} kg`;
          }
        }
      }
    });
  });

  // ── PASO 2: Incrementar contador de sesiones completadas ──────────────────
  config.sessions_completed_this_week += 1;
  const isLastSessionOfWeek =
    config.sessions_completed_this_week >= (config.sessions_per_week || 3);
  const isEndOfBlock = currentWeek >= totalWeeks;

  // ── PASO 3: Si NO es la última sesión, guardar y salir ─────────────────────
  // El plan se guarda con el 1RM y el peso actualizado, pero las series
  // no cambian hasta que se complete la semana entera.
  if (!isLastSessionOfWeek) {
    config.has_new_updates = true;
    return updatedPlan;
  }

  // ── PASO 4: Es la última sesión — procesar feedback acumulado ──────────────
  // Consolidar el feedback de toda la semana por ejercicio.
  // Regla de consolidación:
  //   Recuperación: worst-case (sore > just_in_time > recovered)
  //   Estímulo:     worst-case hacia extremo (extreme > good > none)
  const RECOVERY_RANK: Record<string, number> = {
    sore: 2, just_in_time: 1, recovered: 0,
  };
  const STIMULUS_RANK: Record<string, number> = {
    extreme: 2, good: 1, none: 0,
  };

  const consolidatedFeedback: Record<string, {
    estimulo: 'none' | 'good' | 'extreme';
    recuperacion: 'recovered' | 'just_in_time' | 'sore';
  }> = {};

  (config.weekly_session_feedback || []).forEach(fb => {
    const key = fb.ejercicio.toLowerCase().trim();
    if (!consolidatedFeedback[key]) {
      consolidatedFeedback[key] = { estimulo: fb.estimulo, recuperacion: fb.recuperacion };
    } else {
      // Tomar el peor caso de recuperación
      if (RECOVERY_RANK[fb.recuperacion] > RECOVERY_RANK[consolidatedFeedback[key].recuperacion]) {
        consolidatedFeedback[key].recuperacion = fb.recuperacion;
      }
      // Tomar el peor caso de estímulo (hacia extremo)
      if (STIMULUS_RANK[fb.estimulo] > STIMULUS_RANK[consolidatedFeedback[key].estimulo]) {
        consolidatedFeedback[key].estimulo = fb.estimulo;
      }
    }
  });

  // ── PASO 5: Aplicar ajuste de volumen con el feedback consolidado ──────────
  // BUG-02 + BUG-04: Deload global SOLO al final del bloque o por fatiga sistémica.
  // BUG-13: nivel gatilla la lógica correcta en calculateNextMicrocycleVolume.
  // FIX triggerDeload: los votos de deload de ejercicios individuales se acumulan
  // aquí. Si más de la mitad de los ejercicios con feedback votan deload, se
  // trata como cierre anticipado de bloque (fatiga sistémica mid-block).
  const weeklyVolumeMap: Record<string, number> = {};
  const weeklyNLMap: Record<string, number>     = {};
  let deloadVotes     = 0;  // ejercicios que pidieron deload esta semana
  let feedbackCount   = 0;  // ejercicios con feedback esta semana (denominador)

  if (!isEndOfBlock) {
    // Precalcular volumen semanal actual para chequeo de MRV
    updatedPlan.trainingDays?.forEach(day => {
      day.exercises?.forEach(ex => {
        const setsStr   = ex.variables?.['series de trabajo'] || ex.variables?.['series'] || '3';
        const sets      = parseInt(setsStr, 10) || 3;
        const repsStr   = ex.variables?.['repeticiones'] || '5';
        const repsMatch = repsStr.match(/\d+/);
        const reps      = repsMatch ? parseInt(repsMatch[0], 10) : 5;

        if (isStrengthBlock) {
          const pattern = (ex as any).movement_pattern || detectPatternFromExerciseName((ex as any).nombre || '');
          if (pattern) {
            const rirRaw = ex.variables?.['rir'];
            const rirVal = (rirRaw === undefined || rirRaw === '')
              ? null
              : parseInt(rirRaw.match(/\d+/)?.[0] || '2', 10);
            weeklyNLMap[pattern] = Math.round(
              ((weeklyNLMap[pattern] || 0) + calcWeightedNL(sets, reps, rirVal)) * 10
            ) / 10;
          }
        } else {
          const gm = getThresholdsForMuscleGroup(
            (ex as any).grupo_muscular || '', nivel, config.objetivo as any
          ).gm;
          weeklyVolumeMap[gm] = (weeklyVolumeMap[gm] || 0) + sets;
        }
      });
    });

    // Aplicar ajuste por ejercicio usando el feedback consolidado de la semana
    updatedPlan.trainingDays?.forEach(day => {
      day.exercises?.forEach((foundEx: any) => {
        const normName = (foundEx.nombre || '').toLowerCase().trim();
        const feedback = consolidatedFeedback[normName];
        if (!feedback) return; // Ejercicio sin feedback esta semana — no tocar

        const currentSetsStr = foundEx.variables?.['series de trabajo'] || foundEx.variables?.['series'] || '3';
        const currentSets    = parseInt(currentSetsStr, 10) || 3;

        const { nextSets, triggerDeload, notes } = calculateNextMicrocycleVolume(
          currentSets,
          feedback.estimulo,
          feedback.recuperacion,
          nivel
        );

        // Acumular votos de deload — cada ejercicio tiene voz
        feedbackCount += 1;
        if (triggerDeload) deloadVotes += 1;

        let finalSets  = nextSets;
        let finalNotes = notes;

        if (nextSets > currentSets) {
          if (isStrengthBlock) {
            const pattern = foundEx.movement_pattern || detectPatternFromExerciseName(foundEx.nombre || '');
            if (pattern) {
              const repsStr   = foundEx.variables?.['repeticiones'] || '5';
              const repsMatch = repsStr.match(/\d+/);
              const reps      = repsMatch ? parseInt(repsMatch[0], 10) : 5;
              const rirRaw    = foundEx.variables?.['rir'];
              const rirVal    = (rirRaw === undefined || rirRaw === '')
                ? null
                : parseInt(rirRaw.match(/\d+/)?.[0] || '2', 10);
              const currentNL = weeklyNLMap[pattern] || 0;
              const addedNL   = calcWeightedNL(nextSets - currentSets, reps, rirVal);
              const threshold = getStrengthThreshold(pattern, nivel);

              if (currentNL + addedNL > threshold.mrv) {
                finalSets  = currentSets;
                finalNotes = `MRV de fuerza alcanzado para ${threshold.label} (${nivel}): `
                  + `${currentNL} NL★ actuales ≥ ${threshold.mrv} NL★/semana. `
                  + `No se incrementan series. Señales a monitorear: ${threshold.mrvSignals[0]}.`;
              } else {
                weeklyNLMap[pattern] = Math.round((currentNL + addedNL) * 10) / 10;
              }
            }
          } else {
            const gm        = getThresholdsForMuscleGroup(foundEx.grupo_muscular || '', nivel, config.objetivo as any).gm;
            const threshold = getThresholdsForMuscleGroup(gm, nivel, config.objetivo as any);
            if (weeklyVolumeMap[gm] >= threshold.mrv) {
              finalSets  = currentSets;
              finalNotes = `Límite MRV (${threshold.mrv} series) alcanzado para ${gm}. `
                + `No se incrementan series para evitar sobreentrenamiento.`;
            } else {
              weeklyVolumeMap[gm] += (nextSets - currentSets);
            }
          }
        }

        if (!foundEx.variables) foundEx.variables = {};
        foundEx.variables['series de trabajo'] = String(finalSets);
        foundEx.progression_notes = finalNotes;
      });
    });
  }

  // ── Deload mid-block por fatiga sistémica ─────────────────────────────────
  // Si más de la mitad de los ejercicios con feedback votan triggerDeload,
  // el cuerpo está en fatiga sistémica real — se aplica deload anticipado.
  // Umbral: mayoría simple (>50%) para evitar que un solo ejercicio fuera de
  // rango dispare el deload de todo el bloque.
  // Distinción importante vs isEndOfBlock:
  //   - isEndOfBlock: deload planificado → semana_actual se resetea a 1
  //   - isMidBlockDeload: deload de emergencia → semana_actual se mantiene
  //     para que el bloque continúe desde donde estaba al recuperarse.
  const isMidBlockDeload = !isEndOfBlock
    && feedbackCount > 0
    && deloadVotes > feedbackCount / 2;

  // ── PASO 6: Avanzar semana / cerrar bloque ─────────────────────────────────
  const applyDeload = isEndOfBlock || isMidBlockDeload;

  if (applyDeload) {
    // Deload: reducir series a la mitad, RIR conservador
    updatedPlan.trainingDays?.forEach(day => {
      day.exercises?.forEach(ex => {
        if (!ex.variables) ex.variables = {};
        const originalSets = parseInt(ex.variables['series de trabajo'] || '3', 10) || 3;
        ex.variables['series de trabajo'] = String(Math.max(MIN_SETS_DELOAD, Math.round(originalSets / 2)));
        ex.variables['rir'] = DELOAD_RIR;
      });
    });

    if (isEndOfBlock) {
      // Deload planificado → reiniciar bloque
      config.semana_actual        = 1;
      config.mrv_limite_alcanzado = false;
    } else {
      // Deload mid-block → conservar semana actual, marcar para que la UI
      // pueda mostrar un aviso al entrenador ("deload anticipado por fatiga")
      config.mrv_limite_alcanzado = true;
      // semana_actual NO cambia: el bloque reanuda desde aquí al recuperarse
    }
  } else {
    const newWeek = currentWeek + 1;
    config.semana_actual = newWeek;

    // ── Progresión RIR por nivel (Plan de Progresión Israetel) ─────────────
    // Calcula el RIR target para la semana entrante y lo inyecta en todos
    // los ejercicios. La fórmula de prescripción de carga lo toma en el
    // Paso 2 de la próxima sesión → peso sube automáticamente al bajar RIR.
    const rirInicial    = config.rir_inicial    ?? (nivel === 'avanzado' ? 4 : 3);
    const rirProgresion = config.rir_progresion ?? (nivel === 'principiante' ? 'lenta' : 'normal');
    const newTargetRIR  = calcTargetRIRForWeek(newWeek, rirInicial, nivel, rirProgresion);

    updatedPlan.trainingDays?.forEach(day => {
      day.exercises?.forEach(ex => {
        if (!ex.variables) ex.variables = {};
        ex.variables['rir'] = String(newTargetRIR);
      });
    });
  }

  // ── PASO 7: Resetear contadores semanales ─────────────────────────────────
  config.sessions_completed_this_week = 0;
  config.weekly_session_feedback      = [];
  config.has_new_updates              = true;

  // ── PASO 8: Historial de microciclos ──────────────────────────────────────
  if (!updatedPlan.microcycles) updatedPlan.microcycles = [];

  const prevMicro = updatedPlan.microcycles.find(m => m.weekNumber === currentWeek);
  if (prevMicro) {
    prevMicro.isCompleted = true;
  }

  const newWeekNumber = updatedPlan.periodizationConfig.semana_actual || currentWeek;
  const existingNewMicro = updatedPlan.microcycles.find(m => m.weekNumber === newWeekNumber);
  if (existingNewMicro) {
    existingNewMicro.trainingDays = updatedPlan.trainingDays || [];
    existingNewMicro.isCompleted  = false;
  } else {
    updatedPlan.microcycles.push({
      weekNumber:   newWeekNumber,
      isCompleted:  false,
      trainingDays: updatedPlan.trainingDays || [],
    });
  }

  return updatedPlan;
};

// ─── 6. Strength Volume Diagnostics ──────────────────────────────────────────

/**
 * Evalúa el estado de volumen de fuerza de un plan completo.
 * Recorre todos los ejercicios, detecta su patrón de movimiento,
 * acumula NL semanales y devuelve el diagnóstico por patrón.
 *
 * Uso: llamar desde la UI para mostrar alertas en bloques de fuerza,
 * equivalente a evaluateVolumeStatus() en bloques de hipertrofia.
 */
export const evaluateStrengthPlanVolume = (
  plan: PlanData,
  nivel: 'principiante' | 'intermedio' | 'avanzado' = 'intermedio'
): Record<MovementPattern, ReturnType<typeof evaluateStrengthVolume>> => {
  const nlMap: Record<string, number> = {};

  plan.trainingDays?.forEach(day => {
    day.exercises?.forEach(ex => {
      const pattern = (ex as any).movement_pattern || detectPatternFromExerciseName((ex as any).nombre || '');
      if (!pattern) return;

      const setsStr  = ex.variables?.['series de trabajo'] || ex.variables?.['series'] || '3';
      const repsStr  = ex.variables?.['repeticiones'] || '5';
      const sets     = parseInt(setsStr, 10) || 3;
      const repsMatch = repsStr.match(/\d+/);
      const reps     = repsMatch ? parseInt(repsMatch[0], 10) : 5;

      nlMap[pattern] = (nlMap[pattern] || 0) + (sets * reps);
    });
  });

  const result = {} as Record<MovementPattern, ReturnType<typeof evaluateStrengthVolume>>;

  for (const [pattern, nl] of Object.entries(nlMap)) {
    result[pattern as MovementPattern] = evaluateStrengthVolume(
      pattern as MovementPattern,
      nl,
      nivel
    );
  }

  return result;
};
