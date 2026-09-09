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
  if (memberCount === 2) return 'Súper Serie';
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
 * Limpia bloques huérfanos que hayan quedado con menos de 2 miembros.
 */
export function cleanOrphanBlocks(exercises: Exercise[]): Exercise[] {
  const counts: Record<string, number> = {};
  for (const ex of exercises) {
    if (ex.block_id) {
      counts[ex.block_id] = (counts[ex.block_id] || 0) + 1;
    }
  }

  return exercises.map(ex => {
    if (ex.block_id && (counts[ex.block_id] || 0) < 2) {
      const { block_id: _bId, block_rest: _bRest, transition_rest: _tRest, ...rest } = ex;
      return rest as Exercise;
    }
    return ex;
  });
}

/**
 * Vincula un ejercicio ancla con cualquier otro ejercicio objetivo del día,
 * reordenando físicamente el array para colocarlos de forma contigua y preservando
 * la integridad de los bloques existentes (moviendo bloques completos si corresponde).
 */
export function linkExercisesWithReorder(
  exercises: Exercise[],
  anchorExerciseId: string,
  targetExerciseId: string,
  blockRest: number = 90,
  transitionRest: number = 10
): {
  exercises: Exercise[];
  anchorName: string;
  targetName: string;
} {
  const anchorEx = exercises.find(e => e.id === anchorExerciseId);
  const targetEx = exercises.find(e => e.id === targetExerciseId);

  if (!anchorEx || !targetEx || anchorExerciseId === targetExerciseId) {
    return {
      exercises,
      anchorName: anchorEx?.nombre || '',
      targetName: targetEx?.nombre || '',
    };
  }

  // Si ya comparten bloque, no hay nada que mover ni fusionar: sin este guard,
  // el bloque completo terminaría reinsertado al final del día (ver más abajo,
  // "remaining" quedaría sin ningún miembro ancla para anclar la reinserción).
  if (anchorEx.block_id && anchorEx.block_id === targetEx.block_id) {
    return {
      exercises,
      anchorName: anchorEx.nombre || '',
      targetName: targetEx.nombre || '',
    };
  }

  // 1. Identificar miembros del bloque del objetivo (si el objetivo ya estaba en un bloque de 2+ miembros)
  const targetBlockId = targetEx.block_id;
  const targetBlockMembers = targetBlockId
    ? exercises.filter(e => e.block_id === targetBlockId)
    : [targetEx];
  
  const movingItems = targetBlockMembers.length >= 2 ? targetBlockMembers : [targetEx];
  const movingIds = new Set(movingItems.map(e => e.id));

  // 2. Identificar miembros del bloque del ancla
  const anchorBlockId = anchorEx.block_id;
  const anchorBlockMembers = anchorBlockId
    ? exercises.filter(e => e.block_id === anchorBlockId && !movingIds.has(e.id))
    : [anchorEx];

  // 3. Determinar block_id y descansos unificados
  const finalBlockId = anchorBlockId || targetBlockId || generateBlockUUID();
  const finalBlockRest = anchorEx.block_rest ?? targetEx.block_rest ?? blockRest;
  const finalTransitionRest = anchorEx.transition_rest ?? targetEx.transition_rest ?? transitionRest;

  // 4. Remover los elementos a mover del array
  const remaining = exercises.filter(e => !movingIds.has(e.id));

  // 5. Encontrar el índice del último miembro del bloque del ancla en remaining
  const anchorMemberIds = new Set(anchorBlockMembers.map(e => e.id));
  let lastAnchorIdx = -1;
  for (let i = 0; i < remaining.length; i++) {
    if (anchorMemberIds.has(remaining[i].id)) {
      lastAnchorIdx = i;
    }
  }

  if (lastAnchorIdx === -1) {
    lastAnchorIdx = remaining.findIndex(e => e.id === anchorExerciseId);
  }

  // 6. Insertar los elementos a mover inmediatamente después del último miembro del bloque ancla
  const insertIdx = lastAnchorIdx !== -1 ? lastAnchorIdx + 1 : remaining.length;
  remaining.splice(insertIdx, 0, ...movingItems);

  // 7. Asignar block_id a todos los miembros combinados
  const allJoinedIds = new Set([...anchorBlockMembers.map(e => e.id), ...movingItems.map(e => e.id)]);

  let updated = remaining.map(ex => {
    if (allJoinedIds.has(ex.id)) {
      return {
        ...ex,
        block_id: finalBlockId,
        block_rest: finalBlockRest,
        transition_rest: finalTransitionRest,
      };
    }
    return ex;
  });

  // 8. Limpiar posibles bloques huérfanos tras la reubicación
  updated = cleanOrphanBlocks(updated);

  return {
    exercises: updated,
    anchorName: anchorEx.nombre || 'Ejercicio',
    targetName: targetEx.nombre || 'Ejercicio',
  };
}

/**
 * Encadena un conjunto arbitrario de ejercicios del día (2, 3, 4, 5...) en una Súper Serie,
 * colocándolos de forma contigua en el orden de entrenamiento alrededor de la posición
 * del ejercicio ancla (o el primero seleccionado), asignándoles el mismo block_id
 * y configurando los descansos de ronda y de transición.
 */
export function chainExercisesWithReorder(
  exercises: Exercise[],
  anchorExerciseId: string,
  selectedExerciseIds: string[],
  blockRest: number = 90,
  transitionRest: number = 10
): {
  exercises: Exercise[];
  chainedBlockId: string;
} {
  const existingIds = new Set(exercises.map(e => e.id));
  const uniqueSelected = Array.from(new Set(selectedExerciseIds.filter(id => existingIds.has(id))));

  if (uniqueSelected.length < 2) {
    return { exercises, chainedBlockId: '' };
  }

  const anchorEx = exercises.find(e => e.id === anchorExerciseId);
  const selectedSet = new Set(uniqueSelected);

  // Determinar block_id: reutilizar el del ancla o de algún miembro seleccionado, o generar uno nuevo
  let finalBlockId = anchorEx?.block_id;
  if (!finalBlockId) {
    const memberWithBlock = exercises.find(e => selectedSet.has(e.id) && e.block_id);
    finalBlockId = memberWithBlock?.block_id || generateBlockUUID();
  }

  // Si el ancla pertenecía a un bloque previo, desvincular a los antiguos compañeros que NO fueron seleccionados
  const sanitized = exercises.map(ex => {
    if (anchorEx?.block_id && ex.block_id === anchorEx.block_id && !selectedSet.has(ex.id)) {
      const { block_id: _b, block_rest: _br, transition_rest: _tr, ...rest } = ex;
      return rest as Exercise;
    }
    return ex;
  });

  // Los ejercicios seleccionados preservando su orden original
  const selectedItems = sanitized.filter(e => selectedSet.has(e.id));
  const remaining = sanitized.filter(e => !selectedSet.has(e.id));

  // Encontrar el índice de inserción en remaining basado en el ejercicio ancla si está seleccionado,
  // o en el primer ejercicio seleccionado en el orden original como fallback
  const anchorOriginalIdx = (anchorEx && selectedSet.has(anchorEx.id))
    ? sanitized.findIndex(e => e.id === anchorExerciseId)
    : sanitized.findIndex(e => selectedSet.has(e.id));
  let insertIdx = 0;
  if (anchorOriginalIdx !== -1) {
    const targetExerciseBefore = sanitized
      .slice(0, anchorOriginalIdx)
      .reverse()
      .find(e => !selectedSet.has(e.id));
    if (targetExerciseBefore) {
      const idxInRemaining = remaining.findIndex(e => e.id === targetExerciseBefore.id);
      insertIdx = idxInRemaining + 1;
    } else {
      insertIdx = 0;
    }
  }

  const updatedSelected = selectedItems.map(ex => ({
    ...ex,
    block_id: finalBlockId,
    block_rest: blockRest,
    transition_rest: transitionRest,
  }));

  remaining.splice(insertIdx, 0, ...updatedSelected);
  const finalExercises = cleanOrphanBlocks(remaining);

  return {
    exercises: finalExercises,
    chainedBlockId: finalBlockId,
  };
}

/**
 * Sustituye un compañero de bloque por otro ejercicio del día (ej. si una máquina está ocupada).
 * El ejercicio saliente pierde su bloque y el nuevo compañero toma su lugar en el bloque contiguo.
 */
export function swapBlockPartner(
  exercises: Exercise[],
  currentExerciseId: string,
  oldPartnerId: string,
  newPartnerId: string
): Exercise[] {
  const currentEx = exercises.find(e => e.id === currentExerciseId);
  const oldPartner = exercises.find(e => e.id === oldPartnerId);
  const newPartner = exercises.find(e => e.id === newPartnerId);

  if (!currentEx || !oldPartner || !newPartner || currentExerciseId === newPartnerId) {
    return exercises;
  }

  const blockId = currentEx.block_id || generateBlockUUID();
  const blockRest = currentEx.block_rest ?? 90;
  const transitionRest = currentEx.transition_rest ?? 10;

  const oldPartnerIdx = exercises.findIndex(e => e.id === oldPartnerId);
  const newPartnerIdx = exercises.findIndex(e => e.id === newPartnerId);

  const updated = exercises.map((ex) => {
    if (ex.id === currentExerciseId) {
      return {
        ...ex,
        block_id: blockId,
        block_rest: blockRest,
        transition_rest: transitionRest,
      };
    }
    if (ex.id === oldPartnerId) {
      const { block_id: _b, block_rest: _br, transition_rest: _tr, ...rest } = ex;
      return rest as Exercise;
    }
    if (ex.id === newPartnerId) {
      return {
        ...ex,
        block_id: blockId,
        block_rest: blockRest,
        transition_rest: transitionRest,
      };
    }
    return ex;
  });

  if (oldPartnerIdx !== -1 && newPartnerIdx !== -1) {
    const temp = updated[oldPartnerIdx];
    updated[oldPartnerIdx] = updated[newPartnerIdx];
    updated[newPartnerIdx] = temp;
  }

  return cleanOrphanBlocks(updated);
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

  // C2. Guard defensivo: fallback por si el estado de series tiene huecos o inconsistencias no secuenciales.
  // En flujo normal y determinista, C1 siempre se cumple cuando activeMembers.length >= 2.
  const fallbackPartner = activeMembers.find(idx => exercises[idx].series.some(s => !s.done));
  return {
    nextIdx: fallbackPartner ?? currentExIdx,
    timerSeconds: currEx?.block_rest ?? 90,
    timerType: 'round',
  };
}
