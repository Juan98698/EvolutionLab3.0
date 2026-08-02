import { TrainingDay, Exercise } from '../types/database.types';

export interface GeneratedSessionTarget {
  muscleGroup: string;
  plannedSets: number;
}

export interface GeneratedSession {
  id: string;
  label: string;
  muscleTargets: GeneratedSessionTarget[];
}

/**
 * Normaliza nombres de grupos musculares para comparación uniforme
 */
export const normalizeMuscleGroup = (g: string | undefined | null): string => {
  if (!g) return '';
  const norm = g.toLowerCase().trim();
  if (norm.includes('pecho') || norm.includes('chest')) return 'Pecho';
  if (norm.includes('espalda') || norm.includes('back')) return 'Espalda';
  if (norm.includes('femoral') || norm.includes('isquio') || norm.includes('isquiotibiales') || norm.includes('isquiosurles') || norm.includes('isquiosurales')) return 'Isquiosurales';
  if (norm.includes('cuad') || norm.includes('cuádriceps') || norm.includes('cuadriceps')) return 'Cuádriceps';
  if (norm.includes('glute') || norm.includes('glúteo') || norm.includes('gluteo') || norm.includes('glúteos') || norm.includes('gluteos')) return 'Glúteos';
  if (norm.includes('hombro') || norm.includes('shoulder')) return 'Hombros';
  if (norm.includes('biceps') || norm.includes('bíceps')) return 'Bíceps';
  if (norm.includes('triceps') || norm.includes('tríceps')) return 'Tríceps';
  if (norm.includes('pantorrilla') || norm.includes('pantorrillas') || norm.includes('gemelo') || norm.includes('gemelos')) return 'Pantorrillas';
  if (norm.includes('core') || norm.includes('abdomen') || norm.includes('abs') || norm.includes('abdominales')) return 'Core';
  if (norm.includes('cardio') || norm.includes('aeróbico') || norm.includes('aerobico')) return 'Cardio';
  return g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();
};

/**
 * Fusiona un Esqueleto de Volumen (GeneratedSession[]) con los días y ejercicios existentes.
 * Preserva nombres de ejercicios, gifs, imágenes, descripciones y variables personalizadas,
 * actualizando el número de 'series de trabajo' para coincidir con las series planificadas en el esqueleto.
 */
export const mergeSkeletonIntoExistingPlan = (
  sessions: GeneratedSession[],
  existingDays: TrainingDay[],
  globalVariables: Array<{ id: string; defaultValue?: string }> = []
): TrainingDay[] => {
  const generateId = (): string => Math.random().toString(36).substring(2, 11);

  return sessions.map((session, dayIdx) => {
    // Buscar día existente coincidente (por índice o por nombre similar)
    const existingDay = existingDays[dayIdx] || existingDays.find(d => d.name?.toLowerCase() === session.label.toLowerCase());
    const existingExercises = existingDay ? (existingDay.exercises || []) : [];

    // Agrupar ejercicios existentes por grupo muscular normalizado
    const existingByMuscle: Record<string, Exercise[]> = {};
    existingExercises.forEach(ex => {
      // Ignorar placeholders vacíos
      if (!ex.nombre || ex.nombre.startsWith('[ ESPACIO PARA:')) return;
      const gm = normalizeMuscleGroup(ex.grupo_muscular);
      if (gm) {
        if (!existingByMuscle[gm]) existingByMuscle[gm] = [];
        existingByMuscle[gm].push({ ...ex });
      }
    });

    const newExercises: Exercise[] = [];

    // Si el esqueleto tiene más de un objetivo para el mismo grupo muscular en el mismo día
    // (p. ej. dos slots de "Pecho"), hay que repartir el pool de ejercicios reales disponibles
    // entre esos objetivos en vez de que el primero se los quede todos y el/los siguientes
    // caigan siempre en placeholder aunque sí exista un ejercicio real disponible para ellos.
    // Hoy ningún generador de esqueleto produce duplicados (ver sessionDistributor.ts), pero
    // esto deja la función correcta si en el futuro un split personalizado los permite.
    const targetCountByMuscle: Record<string, number> = {};
    session.muscleTargets.forEach(t => {
      const gm = normalizeMuscleGroup(t.muscleGroup);
      targetCountByMuscle[gm] = (targetCountByMuscle[gm] || 0) + 1;
    });
    const slotSeenByMuscle: Record<string, number> = {};

    // Procesar cada objetivo muscular del esqueleto para este día
    session.muscleTargets.forEach(target => {
      const targetGm = normalizeMuscleGroup(target.muscleGroup);
      const totalSlotsForMuscle = targetCountByMuscle[targetGm] || 1;
      const slotIndex = slotSeenByMuscle[targetGm] || 0;
      slotSeenByMuscle[targetGm] = slotIndex + 1;

      const pool = existingByMuscle[targetGm] || [];
      // Reparto round-robin: con un solo slot para este músculo (el caso normal), esto
      // selecciona el pool completo, igual que antes. Con varios slots, cada uno se
      // queda con su porción en vez de que el primero consuma todo el pool.
      const matches = totalSlotsForMuscle > 1
        ? pool.filter((_, i) => i % totalSlotsForMuscle === slotIndex)
        : pool;

      if (matches.length > 0) {
        // Hay ejercicios reales para este grupo muscular en este día
        // Distribuir el total de series planificadas entre los ejercicios existentes
        const setsPerEx = Math.max(1, Math.floor(target.plannedSets / matches.length));
        const remainder = target.plannedSets % matches.length;

        matches.forEach((ex, idx) => {
          const assignedSets = setsPerEx + (idx < remainder ? 1 : 0);
          const updatedVars = { ...(ex.variables || {}) };
          updatedVars['series de trabajo'] = String(Math.max(1, assignedSets));

          newExercises.push({
            ...ex,
            variables: updatedVars
          });
        });
      } else {
        // No hay ejercicio previo para este grupo muscular ➔ crear placeholder
        const exVariables = { ...Object.fromEntries(globalVariables.map(gv => [gv.id, gv.defaultValue || ''])) };
        exVariables['series de trabajo'] = String(target.plannedSets);

        newExercises.push({
          id: generateId(),
          nombre: `[ ESPACIO PARA: ${target.muscleGroup.toUpperCase()} ]`,
          nombre_original: '',
          grupo_muscular: target.muscleGroup,
          variables: exVariables,
          video_url: '',
          image_url: '',
          gif_url: ''
        } as Exercise);
      }
    });

    // Añadir cualquier otro ejercicio existente de grupos musculares que no tienen
    // ningún objetivo en el esqueleto para ese día (preserva agregados manuales del
    // entrenador para músculos que el esqueleto no contempla).
    const musclesEnObjetivos = new Set(Object.keys(targetCountByMuscle));
    Object.entries(existingByMuscle).forEach(([gm, exs]) => {
      if (!musclesEnObjetivos.has(gm)) {
        exs.forEach(ex => newExercises.push(ex));
      }
    });

    return {
      id: existingDay?.id || `day_${generateId()}`,
      name: session.label,
      exercises: newExercises
    };
  });
};

/**
 * Fusiona un Protocolo Científico (nuevos días con ejercicios de plantilla) con un Esqueleto de Volumen existente.
 * Mantiene la asignación de series planificadas ('series de trabajo') del esqueleto y reemplaza los placeholders
 * con los ejercicios reales del protocolo enriquecidos con su multimedia.
 */
export const mergeProtocolIntoExistingPlan = (
  protocolDays: TrainingDay[],
  existingDays: TrainingDay[],
  preserveSkeletonVolume: boolean = true
): TrainingDay[] => {
  if (!existingDays || existingDays.length === 0 || !preserveSkeletonVolume) {
    return protocolDays;
  }

  return protocolDays.map((protoDay, dayIdx) => {
    const existingDay = existingDays[dayIdx] || existingDays.find(d => d.name?.toLowerCase() === protoDay.name?.toLowerCase() || (protoDay as any).label?.toLowerCase() === d.name?.toLowerCase());
    if (!existingDay) return protoDay;

    const existingExercises = existingDay.exercises || [];

    // Crear mapa de series planificadas por grupo muscular del esqueleto existente
    const plannedSetsByMuscle: Record<string, number[]> = {};
    existingExercises.forEach(ex => {
      const gm = normalizeMuscleGroup(ex.grupo_muscular);
      const seriesStr = ex.variables?.['series de trabajo'] || ex.variables?.['series'] || '3';
      const seriesNum = parseInt(seriesStr, 10) || 3;
      if (gm) {
        if (!plannedSetsByMuscle[gm]) plannedSetsByMuscle[gm] = [];
        plannedSetsByMuscle[gm].push(seriesNum);
      }
    });

    const mergedExercises = protoDay.exercises.map(protoEx => {
      const protoGm = normalizeMuscleGroup(protoEx.grupo_muscular);
      const availableSets = plannedSetsByMuscle[protoGm];

      if (availableSets && availableSets.length > 0) {
        const plannedSeries = availableSets.shift()!; // Consumir una entrada asignada
        const updatedVars = { ...(protoEx.variables || {}) };
        updatedVars['series de trabajo'] = String(plannedSeries);
        return {
          ...protoEx,
          variables: updatedVars
        };
      }

      return protoEx;
    });

    return {
      ...protoDay,
      exercises: mergedExercises
    };
  });
};
