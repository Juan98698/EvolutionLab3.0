/**
 * exerciseBlockUtils.ts
 *
 * Módulo de utilidades puras para gestión de Bi-series, Tri-series, Circuitos
 * y agrupamiento dinámico (Modo Express).
 *
 * Principio arquitectónico:
 * - \lock_type\ y \lock_tag\ (A1, A2, B1...) son 100% derivados y de solo lectura.
 * - El orden determinista lo da la posición en el array de ejercicios.
 */

import { Exercise, ExpressBlockAudit } from '../types/database.types';

export type ExerciseBlockType = 'standard' | 'superset' | 'triset' | 'circuit';

/**
 * Deriva el tipo de bloque a partir de la cantidad de ejercicios miembros.
 */
export function getBlockType(memberCount: number): ExerciseBlockType {
  if (memberCount <= 1) return 'standard';
  if (memberCount === 2) return 'superset';
  if (memberCount === 3) return 'triset';
  return 'circuit';
}

/**
 * Retorna la etiqueta legible en español para el tipo de bloque.
 */
export function getBlockTypeLabel(memberCount: number): string {
  if (memberCount <= 1) return 'Serie Estándar';
  if (memberCount === 2) return 'Bi-serie / Súper Serie';
  if (memberCount === 3) return 'Tri-serie';
  return 'Circuito';
}

/**
 * Calcula dinámicamente las etiquetas visuales (A1, A2, B1, B2...) para todos
 * los ejercicios de un día de entrenamiento, garantizando letras consecutivas por bloque
 * y subíndices basados en su posición natural en el array.
 */
export function computeBlockTags(exercises: Exercise[]): Record<string, string> {
  const result: Record<string, string> = {};
  if (!exercises || exercises.length === 0) return result;

  const blockIdToLetter: Record<string, string> = {};
  let currentLetterCode = 65; // 'A' in ASCII

  // 1. Identificar todos los block_id únicos con al menos 2 miembros y asignarles una letra A, B, C...
  const blockCounts: Record<string, number> = {};
  for (const ex of exercises) {
    if (ex.block_id) {
      blockCounts[ex.block_id] = (blockCounts[ex.block_id] || 0) + 1;
    }
  }

  for (const ex of exercises) {
    const bId = ex.block_id;
    if (bId && blockCounts[bId] >= 2 && !blockIdToLetter[bId]) {
      blockIdToLetter[bId] = String.fromCharCode(currentLetterCode);
      currentLetterCode++;
      if (currentLetterCode > 90) currentLetterCode = 65; // Loop if more than 26 blocks
    }
  }

  // 2. Asignar subíndices (1, 2, 3...) según el orden de aparición en el array
  const blockIndexCounter: Record<string, number> = {};
  for (const ex of exercises) {
    const bId = ex.block_id;
    if (bId && blockIdToLetter[bId]) {
      const letter = blockIdToLetter[bId];
      const count = (blockIndexCounter[bId] || 0) + 1;
      blockIndexCounter[bId] = count;
      result[ex.id] = `${letter}${count}`;
    }
  }

  return result;
}

/**
 * Genera un UUID seguro compatible con navegadores y entornos de prueba.
 */
export function generateBlockUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'block_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
}

/**
 * Vincula dos o más ejercicios en un bloque de Bi-serie / Tri-serie / Circuito.
 */
export function groupExercisesIntoBlock(
  exercises: Exercise[],
  targetExerciseIds: string[],
  blockRest: number = 90,
  transitionRest: number = 10,
  existingBlockId?: string
): Exercise[] {
  const newBlockId = existingBlockId || generateBlockUUID();
  const targetSet = new Set(targetExerciseIds);

  return exercises.map(ex => {
    if (targetSet.has(ex.id)) {
      return {
        ...ex,
        block_id: newBlockId,
        block_rest: blockRest,
        transition_rest: transitionRest,
      };
    }
    return ex;
  });
}

/**
 * Desvincula todos los ejercicios pertenecientes a un bloque específico.
 */
export function ungroupBlock(exercises: Exercise[], blockId: string): Exercise[] {
  return exercises.map(ex => {
    if (ex.block_id === blockId) {
      const { block_id: _block_id, block_rest: _block_rest, transition_rest: _transition_rest, ...rest } = ex;
      return rest as Exercise;
    }
    return ex;
  });
}

/**
 * Actualiza los parámetros de descanso de ronda y transición para todos
 * los ejercicios pertenecientes a un bloque.
 */
export function updateBlockSettings(
  exercises: Exercise[],
  blockId: string,
  updates: { block_rest?: number; transition_rest?: number }
): Exercise[] {
  return exercises.map(ex => {
    if (ex.block_id === blockId) {
      return {
        ...ex,
        ...(updates.block_rest !== undefined ? { block_rest: updates.block_rest } : {}),
        ...(updates.transition_rest !== undefined ? { transition_rest: updates.transition_rest } : {}),
      };
    }
    return ex;
  });
}

/**
 * Aplica el Modo Express de forma efímera sobre los ejercicios de una sesión activa.
 * - 'supersets': Agrupa los ejercicios contiguos de 2 en 2.
 * - 'circuit': Agrupa todos los ejercicios del día en un solo circuito continuo.
 * - 'reset': Elimina los bloques y vuelve a series estándar individuales.
 */
export function applyExpressMode(
  exercises: Exercise[],
  mode: 'supersets' | 'circuit' | 'reset'
): { exercises: Exercise[]; expressBlocks: ExpressBlockAudit[] } {
  if (mode === 'reset') {
    return {
      exercises: exercises.map(ex => {
        const { block_id: _block_id, block_rest: _block_rest, transition_rest: _transition_rest, ...rest } = ex;
        return rest as Exercise;
      }),
      expressBlocks: [],
    };
  }

  if (mode === 'circuit') {
    const circuitBlockId = generateBlockUUID();
    const updated = exercises.map(ex => ({
      ...ex,
      block_id: circuitBlockId,
      block_rest: 120,
      transition_rest: 10,
    }));
    return {
      exercises: updated,
      expressBlocks: [
        {
          block_id: circuitBlockId,
          exercise_names: exercises.map(e => e.nombre || 'Ejercicio'),
        },
      ],
    };
  }

  // mode === 'supersets': pares contiguos
  const expressBlocks: ExpressBlockAudit[] = [];
  const updated: Exercise[] = [];

  for (let i = 0; i < exercises.length; i += 2) {
    const ex1 = exercises[i];
    const ex2 = exercises[i + 1];

    if (ex1 && ex2) {
      const bId = generateBlockUUID();
      updated.push({
        ...ex1,
        block_id: bId,
        block_rest: 90,
        transition_rest: 10,
      });
      updated.push({
        ...ex2,
        block_id: bId,
        block_rest: 90,
        transition_rest: 10,
      });
      expressBlocks.push({
        block_id: bId,
        exercise_names: [ex1.nombre || 'Ejercicio 1', ex2.nombre || 'Ejercicio 2'],
      });
    } else if (ex1) {
      // Ejercicio impar que queda solo al final
      const { block_id: _block_id, block_rest: _block_rest, transition_rest: _transition_rest, ...rest } = ex1;
      updated.push(rest as Exercise);
    }
  }

  return {
    exercises: updated,
    expressBlocks,
  };
}

export interface BlockExerciseState {
  block_id?: string;
  block_rest?: number;
  transition_rest?: number;
  descanso?: number;
  series: { done: boolean }[];
}

export interface NextBlockStepResult {
  nextIdx: number;
  timerSeconds: number;
  timerType: 'transition' | 'round' | 'standard';
}

/**
 * Máquina de estados Round-Robin para ejecución de Bi-series y Circuitos.
 * Determina el siguiente ejercicio a ejecutar y la duración/tipo del temporizador de descanso.
 */
export function computeNextExerciseStep(
  exercises: BlockExerciseState[],
  currentExIdx: number,
  currentSetIdx: number
): NextBlockStepResult {
  const currEx = exercises[currentExIdx];
  const blockId = currEx?.block_id;

  if (!blockId) {
    return {
      nextIdx: currentExIdx,
      timerSeconds: currEx?.descanso ?? 90,
      timerType: 'standard',
    };
  }

  // 1. Índices de todos los miembros del bloque
  const blockIndices = exercises
    .map((e, idx) => (e.block_id === blockId ? idx : -1))
    .filter(idx => idx !== -1);

  // 2. Paso 1 (Misma Ronda): Verificar si en la ronda actual (currentSetIdx) hay un compañero posterior
  // que aún deba ejecutar su serie de esta ronda. Si existe, es una transición rápida dentro de la ronda.
  const nextPartnerInRound = blockIndices.find(
    idx => idx > currentExIdx && exercises[idx]?.series[currentSetIdx] && !exercises[idx].series[currentSetIdx].done
  );

  if (nextPartnerInRound !== undefined) {
    return {
      nextIdx: nextPartnerInRound,
      timerSeconds: currEx?.transition_rest ?? 10,
      timerType: 'transition',
    };
  }

  // 3. Paso 2 (Ronda Actual Finalizada): La ronda actual concluyó para todos los miembros disponibles.
  // Calculamos qué miembros del bloque todavía tienen series pendientes en rondas futuras.
  const activeMembers = blockIndices.filter(idx =>
    exercises[idx]?.series?.some(s => !s.done)
  );

  // Caso A: Todos los miembros del bloque han concluido todas sus series (Fin del bloque completo)
  if (activeMembers.length === 0) {
    const maxBlockIdx = Math.max(...blockIndices);
    const nextIdx = maxBlockIdx < exercises.length - 1 ? maxBlockIdx + 1 : currentExIdx;
    return {
      nextIdx,
      timerSeconds: currEx?.descanso ?? 90,
      timerType: 'standard',
    };
  }

  // Caso B: Solo 1 miembro del bloque tiene series pendientes (Ejecución solitaria por asimetría)
  // Deja de haber ronda/bloque: el atleta descansa el tiempo individual prescrito para ese ejercicio específico.
  if (activeMembers.length === 1) {
    const loneMemberIdx = activeMembers[0];
    const loneEx = exercises[loneMemberIdx];
    return {
      nextIdx: loneMemberIdx,
      timerSeconds: loneEx?.descanso ?? 90,
      timerType: 'standard',
    };
  }

  // Caso C: Al menos 2 miembros siguen activos en el bloque (Siguiente Ronda de Bi-serie / Circuito)
  // C1. Buscar el primer miembro activo con serie pendiente en la siguiente ronda (currentSetIdx + 1)
  const nextRoundPartner = activeMembers.find(
    idx => exercises[idx]?.series[currentSetIdx + 1] && !exercises[idx].series[currentSetIdx + 1].done
  );

  if (nextRoundPartner !== undefined) {
    return {
      nextIdx: nextRoundPartner,
      timerSeconds: currEx?.block_rest ?? 90,
      timerType: 'round',
    };
  }

  // C2. Fallback: primer miembro activo con cualquier serie pendiente
  const fallbackPartner = activeMembers.find(idx => exercises[idx].series.some(s => !s.done));
  return {
    nextIdx: fallbackPartner ?? currentExIdx,
    timerSeconds: currEx?.block_rest ?? 90,
    timerType: 'round',
  };
}
