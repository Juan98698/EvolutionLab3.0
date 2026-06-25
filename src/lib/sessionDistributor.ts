// src/lib/sessionDistributor.ts

export type SplitType = 'upper_lower' | 'push_pull_legs' | 'full_body' | 'arnold_split' | 'bro_split' | 'estilo_libre';

export interface WeeklyTarget {
  muscleGroup: string;
  plannedSets: number;
}

export interface SessionDistributionConfig {
  trainingDays: number;
  splitType: SplitType;
  weeklyVolume: WeeklyTarget[];
  customDays?: Array<{
    name: string;
    muscles: string[];
  }>;
}

export interface SessionMuscleTarget {
  muscleGroup: string;
  plannedSets: number;
}

export interface GeneratedSession {
  id: string;
  dayNumber: number;
  label: string;
  muscleTargets: SessionMuscleTarget[];
}

// Mapeo base para estandarizar nombres de grupos musculares
export const MUSCLES = [
  'Pecho', 'Espalda', 'Cuádriceps', 'Isquiosurales', 'Hombros', 
  'Bíceps', 'Tríceps', 'Glúteos', 'Pantorrillas', 'Core'
];

// Plantillas de qué músculos se trabajan en cada foco
const FOCUS_MAP: Record<string, string[]> = {
  push: ['Pecho', 'Hombros', 'Tríceps'],
  pull: ['Espalda', 'Bíceps'],
  legs: ['Cuádriceps', 'Isquiosurales', 'Glúteos', 'Pantorrillas'],
  upper: ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps'],
  lower: ['Cuádriceps', 'Isquiosurales', 'Glúteos', 'Pantorrillas', 'Core'],
  full: MUSCLES,
  arnold_chest_back: ['Pecho', 'Espalda'],
  arnold_legs: ['Cuádriceps', 'Isquiosurales', 'Glúteos', 'Pantorrillas', 'Core'],
  arnold_arms_shoulders: ['Hombros', 'Bíceps', 'Tríceps'],
  bro_chest: ['Pecho', 'Core'],
  bro_back: ['Espalda'],
  bro_legs: ['Cuádriceps', 'Isquiosurales', 'Glúteos', 'Pantorrillas'],
  bro_shoulders: ['Hombros', 'Core'],
  bro_arms: ['Bíceps', 'Tríceps']
};

export const getSplitTemplates = (splitType: SplitType, days: number): Array<{label: string, focus: string}> => {
  if (splitType === 'upper_lower') {
    return Array.from({ length: days }, (_, i) => {
      const isUpper = i % 2 === 0;
      return {
        label: isUpper ? `Upper ${Math.floor(i/2) + 1}` : `Lower ${Math.floor(i/2) + 1}`,
        focus: isUpper ? 'upper' : 'lower'
      };
    });
  }
  
  if (splitType === 'push_pull_legs') {
    const cycle = ['push', 'pull', 'legs'];
    const labels = ['Push', 'Pull', 'Legs'];
    return Array.from({ length: days }, (_, i) => ({
      label: `${labels[i % 3]} ${Math.floor(i/3) + 1}`,
      focus: cycle[i % 3]
    }));
  }

  if (splitType === 'full_body') {
    return Array.from({ length: days }, (_, i) => ({
      label: `Full Body ${i + 1}`,
      focus: 'full'
    }));
  }

  if (splitType === 'arnold_split') {
    const cycle = ['arnold_chest_back', 'arnold_legs', 'arnold_arms_shoulders'];
    const labels = ['Pecho/Espalda', 'Piernas', 'Hombro/Brazos'];
    return Array.from({ length: days }, (_, i) => ({
      label: `${labels[i % 3]} ${Math.floor(i/3) + 1}`,
      focus: cycle[i % 3]
    }));
  }

  if (splitType === 'bro_split') {
    const cycle = ['bro_chest', 'bro_back', 'bro_legs', 'bro_shoulders', 'bro_arms'];
    const labels = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos'];
    return Array.from({ length: days }, (_, i) => ({
      label: `Día de ${labels[i % 5]} ${Math.floor(i/5) > 0 ? Math.floor(i/5) + 1 : ''}`.trim(),
      focus: cycle[i % 5]
    }));
  }

  return [];
};

export function distributeSetsToSessions(config: SessionDistributionConfig): GeneratedSession[] {
  const { trainingDays, splitType, weeklyVolume, customDays } = config;
  
  const generateId = () => Math.random().toString(36).substring(2, 9);
  
  let daysConfig: Array<{ label: string, muscles: string[] }> = [];

  if (splitType === 'estilo_libre' && customDays) {
    daysConfig = customDays.map(d => ({ label: d.name, muscles: d.muscles }));
  } else {
    const templates = getSplitTemplates(splitType, trainingDays);
    daysConfig = templates.map(t => ({
      label: t.label,
      muscles: FOCUS_MAP[t.focus] || []
    }));
  }

  // Frecuencia real de cada músculo en el split generado
  const muscleFrequency = new Map<string, number>();
  for (const day of daysConfig) {
    for (const m of day.muscles) {
      muscleFrequency.set(m, (muscleFrequency.get(m) || 0) + 1);
    }
  }

  // Mapa rápido: músculo -> series semanales planeadas
  const weeklyMap = new Map<string, number>();
  weeklyVolume.forEach(v => {
    if (v.plannedSets > 0) {
      weeklyMap.set(v.muscleGroup, v.plannedSets);
    }
  });

  // Distribuir series
  const setsPerSessionPerMuscle = new Map<string, number[]>();

  for (const [muscle, totalSets] of weeklyMap.entries()) {
    const freq = muscleFrequency.get(muscle) || 0;
    if (freq === 0) continue;

    // Repartir equitativamente
    const baseSets = Math.floor(totalSets / freq);
    const remainder = totalSets % freq;

    const distribution: number[] = Array.from({ length: freq }, (_, i) => 
      i < remainder ? baseSets + 1 : baseSets
    );
    setsPerSessionPerMuscle.set(muscle, distribution);
  }

  const sessionOccurrence = new Map<string, number>();

  const sessions: GeneratedSession[] = daysConfig.map((dayConf, dayIdx) => {
    const targets: SessionMuscleTarget[] = [];
    
    for (const muscle of dayConf.muscles) {
      const distribution = setsPerSessionPerMuscle.get(muscle);
      if (!distribution) continue; // Si este músculo no tiene volumen configurado

      const occurrence = sessionOccurrence.get(muscle) || 0;
      const sets = distribution[occurrence] || 0;
      sessionOccurrence.set(muscle, occurrence + 1);

      if (sets > 0) {
        targets.push({ muscleGroup: muscle, plannedSets: sets });
      }
    }

    return {
      id: generateId(),
      dayNumber: dayIdx + 1,
      label: dayConf.label,
      muscleTargets: targets
    };
  });

  return sessions;
}
