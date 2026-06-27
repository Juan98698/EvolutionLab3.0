/**
 * EvolutionLab — Hypertrophy & Maintenance Volume Thresholds Engine
 *
 * Basado en las guías de hipertrofia de Renaissance Periodization (Dr. Mike Israetel).
 * Los valores representan SERIES EFECTIVAS SEMANALES por grupo muscular.
 *
 * Cubre objetivos: 'hipertrofia' | 'mantenimiento'
 * Para bloques de FUERZA GENERAL → ver strengthThresholds.ts
 *
 * MEV: Minimum Effective Volume  — mínimo para generar adaptación
 * MAV: Maximum Adaptive Volume   — zona óptima de estímulo
 * MRV: Maximum Recoverable Volume — límite superior recuperable
 */

export type AthleteLevel = 'principiante' | 'intermedio' | 'avanzado';

export interface VolumeThreshold {
  gm: string; // Grupo Muscular normalizado
  mev: number;
  mavMin: number;
  mavMax: number;
  mrv: number;
}

// Tabla de umbrales científicos semanales - INTERMEDIO (Base RP)
export const THRESHOLDS_INTERMEDIO: Record<string, VolumeThreshold> = {
  'Pecho': { gm: 'Pecho', mev: 10, mavMin: 12, mavMax: 18, mrv: 26 },
  'Espalda': { gm: 'Espalda', mev: 12, mavMin: 14, mavMax: 20, mrv: 28 },
  'Cuádriceps': { gm: 'Cuádriceps', mev: 10, mavMin: 12, mavMax: 18, mrv: 26 },
  'Isquiosurales': { gm: 'Isquiosurales', mev: 8, mavMin: 10, mavMax: 14, mrv: 20 },
  'Hombros': { gm: 'Hombros', mev: 10, mavMin: 12, mavMax: 16, mrv: 24 },
  'Bíceps': { gm: 'Bíceps', mev: 8, mavMin: 10, mavMax: 14, mrv: 20 },
  'Tríceps': { gm: 'Tríceps', mev: 8, mavMin: 10, mavMax: 14, mrv: 20 },
  'Glúteos': { gm: 'Glúteos', mev: 8, mavMin: 10, mavMax: 16, mrv: 24 },
  'Pantorrillas': { gm: 'Pantorrillas', mev: 10, mavMin: 12, mavMax: 18, mrv: 26 },
  'Core': { gm: 'Core', mev: 10, mavMin: 12, mavMax: 16, mrv: 24 },
  'General': { gm: 'General', mev: 10, mavMin: 12, mavMax: 18, mrv: 24 }
};

// PRINCIPIANTE: Requieren mucho menos estímulo para crecer y se recuperan de mucho menos.
export const THRESHOLDS_PRINCIPIANTE: Record<string, VolumeThreshold> = {
  'Pecho': { gm: 'Pecho', mev: 4, mavMin: 6, mavMax: 8, mrv: 10 },
  'Espalda': { gm: 'Espalda', mev: 6, mavMin: 8, mavMax: 10, mrv: 14 },
  'Cuádriceps': { gm: 'Cuádriceps', mev: 4, mavMin: 6, mavMax: 8, mrv: 10 },
  'Isquiosurales': { gm: 'Isquiosurales', mev: 4, mavMin: 6, mavMax: 8, mrv: 10 },
  'Hombros': { gm: 'Hombros', mev: 4, mavMin: 6, mavMax: 8, mrv: 12 },
  'Bíceps': { gm: 'Bíceps', mev: 4, mavMin: 6, mavMax: 8, mrv: 10 },
  'Tríceps': { gm: 'Tríceps', mev: 4, mavMin: 6, mavMax: 8, mrv: 10 },
  'Glúteos': { gm: 'Glúteos', mev: 4, mavMin: 6, mavMax: 8, mrv: 12 },
  'Pantorrillas': { gm: 'Pantorrillas', mev: 4, mavMin: 6, mavMax: 8, mrv: 12 },
  'Core': { gm: 'Core', mev: 4, mavMin: 6, mavMax: 8, mrv: 12 },
  'General': { gm: 'General', mev: 4, mavMin: 6, mavMax: 8, mrv: 12 }
};

// AVANZADO: Requieren alto volumen (MEV alto) para crecer, pero su MRV puede ser similar al intermedio por la carga sistémica.
export const THRESHOLDS_AVANZADO: Record<string, VolumeThreshold> = {
  'Pecho': { gm: 'Pecho', mev: 14, mavMin: 16, mavMax: 22, mrv: 26 },
  'Espalda': { gm: 'Espalda', mev: 16, mavMin: 18, mavMax: 24, mrv: 28 },
  'Cuádriceps': { gm: 'Cuádriceps', mev: 14, mavMin: 16, mavMax: 22, mrv: 26 },
  'Isquiosurales': { gm: 'Isquiosurales', mev: 10, mavMin: 12, mavMax: 16, mrv: 20 },
  'Hombros': { gm: 'Hombros', mev: 14, mavMin: 16, mavMax: 20, mrv: 24 },
  'Bíceps': { gm: 'Bíceps', mev: 10, mavMin: 12, mavMax: 16, mrv: 20 },
  'Tríceps': { gm: 'Tríceps', mev: 10, mavMin: 12, mavMax: 16, mrv: 20 },
  'Glúteos': { gm: 'Glúteos', mev: 12, mavMin: 14, mavMax: 20, mrv: 24 },
  'Pantorrillas': { gm: 'Pantorrillas', mev: 14, mavMin: 16, mavMax: 20, mrv: 26 },
  'Core': { gm: 'Core', mev: 12, mavMin: 14, mavMax: 18, mrv: 24 },
  'General': { gm: 'General', mev: 12, mavMin: 14, mavMax: 20, mrv: 24 }
};

/**
 * Objetivos cubiertos por este archivo.
 * Para 'fuerza' → usar evaluateStrengthVolume() de strengthThresholds.ts
 */
export type BlockObjective = 'hipertrofia' | 'fuerza' | 'mantenimiento';

export const getThresholdsForMuscleGroup = (
  gm: string,
  level: AthleteLevel = 'intermedio',
  objetivo: BlockObjective = 'hipertrofia'
): VolumeThreshold => {
  const normalizedKeys: Record<string, string> = {
    'pecho': 'Pecho',
    'espalda': 'Espalda',
    'cuádriceps': 'Cuádriceps',
    'cuadriceps': 'Cuádriceps',
    'isquiosurales': 'Isquiosurales',
    'isquios': 'Isquiosurales',
    'femoral': 'Isquiosurales',
    'hombros': 'Hombros',
    'hombro': 'Hombros',
    'bíceps': 'Bíceps',
    'biceps': 'Bíceps',
    'tríceps': 'Tríceps',
    'triceps': 'Tríceps',
    'glúteos': 'Glúteos',
    'gluteos': 'Glúteos',
    'pantorrillas': 'Pantorrillas',
    'gemelos': 'Pantorrillas',
    'core': 'Core',
    'abdomen': 'Core'
  };

  const key = gm ? (normalizedKeys[gm.toLowerCase().trim()] || 'General') : 'General';

  let baseThreshold: VolumeThreshold;
  switch (level) {
    case 'principiante': baseThreshold = THRESHOLDS_PRINCIPIANTE[key]; break;
    case 'avanzado':     baseThreshold = THRESHOLDS_AVANZADO[key]; break;
    case 'intermedio':
    default:             baseThreshold = THRESHOLDS_INTERMEDIO[key]; break;
  }

  const adjusted = { ...baseThreshold };

  // 'fuerza' ya no se ajusta aquí — tiene su propio sistema en strengthThresholds.ts
  // Se devuelven los umbrales de hipertrofia como referencia contextual si alguien
  // llama a esta función con objetivo='fuerza' por compatibilidad hacia atrás.
  if (objetivo === 'mantenimiento') {
    adjusted.mev    = Math.max(Math.round(adjusted.mev    * 0.4), 2);
    adjusted.mavMin = Math.max(Math.round(adjusted.mavMin * 0.5), adjusted.mev + 1);
    adjusted.mavMax = Math.max(Math.round(adjusted.mavMax * 0.6), adjusted.mavMin + 1);
    adjusted.mrv    = Math.max(Math.round(adjusted.mrv    * 0.7), adjusted.mavMax + 2);
  }

  return adjusted;
};

export const evaluateVolumeStatus = (gm: string, currentWeeklySets: number, level: AthleteLevel = 'intermedio', objetivo: BlockObjective = 'hipertrofia', customTarget?: number) => {
  const threshold = getThresholdsForMuscleGroup(gm, level, objetivo);
  
  if (customTarget && customTarget > 0) {
    if (currentWeeklySets < customTarget) {
      return { status: 'low', message: `Faltan ${customTarget - currentWeeklySets} para el objetivo (${customTarget})` };
    } else if (currentWeeklySets === customTarget) {
      return { status: 'optimal', message: `¡Objetivo alcanzado! (${customTarget} series)` };
    } else if (currentWeeklySets > customTarget && currentWeeklySets < threshold.mrv) {
      return { status: 'warning', message: `Objetivo superado. Cerca de MRV (${threshold.mrv})` };
    } else if (currentWeeklySets >= threshold.mrv) {
      return { 
        status: 'danger', 
        message: `¡Peligro! MRV superado (${threshold.mrv}). Reduce el volumen.` 
      };
    }
  }

  if (currentWeeklySets < threshold.mev) {
    return { status: 'low', message: `Bajo (MEV es ${threshold.mev})` };
  } else if (currentWeeklySets >= threshold.mavMin && currentWeeklySets <= threshold.mavMax) {
    return { status: 'optimal', message: `Óptimo (MAV ${threshold.mavMin}-${threshold.mavMax})` };
  } else if (currentWeeklySets >= threshold.mrv) {
    return { 
      status: 'danger', 
      message: `⚠️ Alerta de Volumen Excesivo: Has programado ${currentWeeklySets} series semanales de ${threshold.gm}. El límite de volumen seguro (MRV) para un atleta ${level} enfocado en ${objetivo.toUpperCase()} es de ${threshold.mrv} series semanales. Considera reducir ejercicios o series para evitar sobreentrenamiento o lesiones.` 
    };
  } else {
    return { status: 'warning', message: `Moderado/Alto (Cerca del MRV de ${threshold.mrv})` };
  }
};
