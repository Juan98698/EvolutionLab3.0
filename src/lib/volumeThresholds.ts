/**
 * EvolutionLab Volume Thresholds Engine
 * 
 * Basado en las guías de hipertrofia de Renaissance Periodization (Dr. Mike Israetel).
 * Los valores representan SERIES EFECTIVAS SEMANALES por grupo muscular.
 * 
 * MEV: Minimum Effective Volume (Volumen Mínimo Efectivo)
 * MAV: Maximum Adaptive Volume (Volumen Adaptativo Máximo - Zona óptima)
 * MRV: Maximum Recoverable Volume (Volumen Máximo Recuperable - Límite superior)
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
const THRESHOLDS_INTERMEDIO: Record<string, VolumeThreshold> = {
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
const THRESHOLDS_PRINCIPIANTE: Record<string, VolumeThreshold> = {
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
const THRESHOLDS_AVANZADO: Record<string, VolumeThreshold> = {
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

export const getThresholdsForMuscleGroup = (gm: string, level: AthleteLevel = 'intermedio'): VolumeThreshold => {
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
  
  switch(level) {
    case 'principiante': return THRESHOLDS_PRINCIPIANTE[key];
    case 'avanzado': return THRESHOLDS_AVANZADO[key];
    case 'intermedio':
    default: return THRESHOLDS_INTERMEDIO[key];
  }
};

export const evaluateVolumeStatus = (gm: string, currentWeeklySets: number, level: AthleteLevel = 'intermedio') => {
  const threshold = getThresholdsForMuscleGroup(gm, level);
  
  if (currentWeeklySets < threshold.mev) {
    return { status: 'low', message: `Bajo (MEV es ${threshold.mev})` };
  } else if (currentWeeklySets >= threshold.mavMin && currentWeeklySets <= threshold.mavMax) {
    return { status: 'optimal', message: `Óptimo (MAV ${threshold.mavMin}-${threshold.mavMax})` };
  } else if (currentWeeklySets >= threshold.mrv) {
    return { 
      status: 'danger', 
      message: `⚠️ Alerta de Volumen Excesivo: Has programado ${currentWeeklySets} series semanales de ${threshold.gm}. El límite de volumen seguro (MRV) para un atleta ${level} es de ${threshold.mrv} series semanales. Considera reducir ejercicios o series para evitar sobreentrenamiento o lesiones.` 
    };
  } else {
    return { status: 'warning', message: `Moderado/Alto (Cerca del MRV de ${threshold.mrv})` };
  }
};
