/**
 * EvolutionLab Periodization & RIR Calculations Engine
 * 
 * Implements scientific algorithms for:
 * 1. 1RM Estimation (Epley + Brzycki integrated with RIR)
 * 2. Load Prescription based on Reps + RIR
 * 3. Weekly Volume Auto-regulation (MEV / MAV / MRV)
 * 4. Biomechanical corrections for lift weak points
 * 5. Full-mesocycle auto-regulation with per-exercise deload
 */

import { PlanData } from '../types/database.types';
import { getThresholdsForMuscleGroup } from './volumeThresholds';

// ─── Constants ───────────────────────────────────────────────────────────────
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
 */
export const calculateNextMicrocycleVolume = (
  currentSets: number,
  stimulusFeedback: 'none' | 'good' | 'extreme',
  recoveryFeedback: 'recovered' | 'just_in_time' | 'sore'
): VolumeAdjustment => {
  if (currentSets <= 0) return { nextSets: 3, triggerDeload: false, notes: 'Volumen inicial por defecto.' };

  // Under-recovered: Athlete is sore or performance fell
  if (recoveryFeedback === 'sore') {
    // If they were doing more than 4 sets, reduce volume to clear fatigue
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
const mapExerciseToLiftKey = (normName: string): string | null => {
  // Only map primary compound variants — not accessories like "sentadilla búlgara"
  if (normName === 'sentadilla' || normName === 'sentadilla trasera' || normName === 'sentadilla con barra' || normName === 'back squat') {
    return 'sentadilla';
  }
  if (normName === 'press de banca' || normName === 'press banca' || normName === 'bench press' || normName === 'press de banca plano') {
    return 'press de banca';
  }
  if (normName === 'peso muerto' || normName === 'peso muerto convencional' || normName === 'deadlift' || normName === 'peso muerto sumo') {
    return 'peso muerto';
  }
  // Fallback: partial matching for flexibility, but only for clear compound names
  if (normName.includes('sentadilla') && !normName.includes('búlgar') && !normName.includes('bulgar')) {
    return 'sentadilla';
  }
  if ((normName.includes('press') && normName.includes('banca')) || normName.includes('bench')) {
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

  // BUG-02 + BUG-04 fix: Determine deload status BEFORE processing exercises
  const isEndOfBlock = currentWeek >= totalWeeks;

  // ── Calculate Initial Weekly Volume per Muscle Group ───────────────────────
  const weeklyVolumeMap: Record<string, number> = {};
  if (!isEndOfBlock) {
    updatedPlan.trainingDays?.forEach(day => {
      day.exercises?.forEach(ex => {
        const gm = getThresholdsForMuscleGroup((ex as any).grupo_muscular || '', config.nivel_atleta as any).gm;
        const setsStr = ex.variables?.['series de trabajo'] || ex.variables?.['series'] || '3';
        const sets = parseInt(setsStr, 10) || 3;
        weeklyVolumeMap[gm] = (weeklyVolumeMap[gm] || 0) + sets;
      });
    });
  }

  // ── Process each logged exercise ───────────────────────────────────────────
  loggedExercises.forEach(logged => {
    const normName = logged.nombre.toLowerCase().trim();
    let foundEx: any = null;

    // Find the matching exercise in the plan
    updatedPlan.trainingDays?.forEach(day => {
      day.exercises?.forEach(ex => {
        if (ex.nombre && ex.nombre.toLowerCase().trim() === normName) {
          foundEx = ex;
        }
      });
    });

    if (!foundEx) return; // Exercise not in plan — skip

    // ── Volume adjustment (only on non-deload weeks) ─────────────────────────
    // BUG-04 fix: Skip per-exercise volume adjustment when entering deload
    //             to avoid double-reduction (feedback + deload halving).
    if (!isEndOfBlock) {
      const gm = getThresholdsForMuscleGroup(foundEx.grupo_muscular || '', config.nivel_atleta as any).gm;
      const currentSetsStr = foundEx.variables?.['series de trabajo'] || foundEx.variables?.['series'] || '3';
      const currentSets = parseInt(currentSetsStr, 10) || 3;

      const estimulo = logged.feedback_estimulo || 'good';
      const recuperacion = logged.feedback_recuperacion || 'recovered';

      const { nextSets, notes } = calculateNextMicrocycleVolume(currentSets, estimulo, recuperacion);

      let finalSets = nextSets;
      let finalNotes = notes;

      // Si el algoritmo sugiere aumentar el volumen, verificamos el MRV del grupo muscular
      if (nextSets > currentSets) {
        const threshold = getThresholdsForMuscleGroup(gm, config.nivel_atleta as any);
        if (weeklyVolumeMap[gm] >= threshold.mrv) {
          finalSets = currentSets; // Bloqueamos el incremento para prevenir sobreentrenamiento
          finalNotes = `Límite MRV (${threshold.mrv} series) alcanzado para ${gm}. No se incrementan series para evitar sobreentrenamiento.`;
        } else {
          // Actualizamos el mapa para contabilizar este incremento en ejercicios posteriores del mismo grupo
          weeklyVolumeMap[gm] += (nextSets - currentSets);
        }
      }

      if (!foundEx.variables) foundEx.variables = {};
      foundEx.variables['series de trabajo'] = String(finalSets);
      foundEx.progression_notes = finalNotes;
    }

    // ── 1RM tracking (always runs, even during deload) ───────────────────────
    // Tracks 1RM for ANY exercise by its normalized name, not just the 3 powerlifts.
    const actualRIR = logged.rir;
    const maxReps = Math.max(...(logged.repsArray || []), 0);

    if (maxReps > 0 && logged.peso > 0) {
      const currentEstimated1RM = calculate1RM(logged.peso, maxReps, actualRIR);

      if (currentEstimated1RM > 0) {
        // Primary: Store by the exercise's exact normalized name
        updateMarca1RM(marcas, normName, currentEstimated1RM);

        // Secondary: Also update the powerlift alias key for backward compatibility
        // (so 'sentadilla trasera' also updates the 'sentadilla' entry)
        const aliasKey = mapExerciseToLiftKey(normName);
        if (aliasKey && aliasKey !== normName) {
          updateMarca1RM(marcas, aliasKey, currentEstimated1RM);
        }
      }
    }
  });

  // ── Persist updated 1RM marks ──────────────────────────────────────────────
  config.marcas_1rm = marcas;

  // ── Week progression & end-of-block deload ─────────────────────────────────
  // BUG-02 fix: Global deload ONLY at end of block, NOT from single exercise feedback
  if (isEndOfBlock) {
    config.semana_actual = 1;
    config.mrv_limite_alcanzado = false;

    // Apply planned deload: halve volume from ORIGINAL sets, set conservative RIR
    updatedPlan.trainingDays?.forEach(day => {
      day.exercises?.forEach(ex => {
        if (!ex.variables) ex.variables = {};
        const originalSets = parseInt(ex.variables['series de trabajo'] || '3', 10) || 3;
        ex.variables['series de trabajo'] = String(Math.max(MIN_SETS_DELOAD, Math.round(originalSets / 2)));
        ex.variables['rir'] = DELOAD_RIR;
      });
    });
  } else {
    config.semana_actual = currentWeek + 1;
  }

  config.has_new_updates = true;

  // ── Explicit Weight Mapping ────────────────────────────────────────────────
  // Recalculate weights for all exercises using the updated 1RM and hardcode it
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
        const repsStr = ex.variables?.['repeticiones'] || '';
        // Extract the first number from string like "8 a 10" or "8"
        const repsMatch = repsStr.match(/\d+/);
        const reps = repsMatch ? parseInt(repsMatch[0], 10) : 0;
        
        const rirStr = ex.variables?.['rir'] || '0';
        const rirMatch = rirStr.match(/\d+/);
        const targetRIR = rirMatch ? parseFloat(rirMatch[0]) : 0;

        if (reps > 0) {
          const newLoad = getPrescribedLoad(oneRM, reps, targetRIR);
          if (newLoad > 0) {
            if (!ex.variables) ex.variables = {};
            ex.variables['peso'] = `🤖 ${newLoad} kg`;
          }
        }
      }
    });
  });

  return updatedPlan;
};
