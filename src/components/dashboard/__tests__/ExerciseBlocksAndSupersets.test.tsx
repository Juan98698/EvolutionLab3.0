import { describe, it, expect } from 'vitest';
import {
  getBlockType,
  getBlockTypeLabel,
  computeBlockTags,
  groupExercisesIntoBlock,
  ungroupBlock,
  updateBlockSettings,
  applyExpressMode,
  computeNextExerciseStep,
  linkExercisesWithReorder,
  swapBlockPartner,
  cleanOrphanBlocks,
  BlockExerciseState,
} from '../../../lib/exerciseBlockUtils';
import { Exercise } from '../../../types/database.types';

describe('Exercise Block Utils & Superset Logic', () => {
  describe('Tipos de bloque derivados y etiquetas (A1, A2, B1...)', () => {
    it('deriva correctamente el tipo de bloque a partir del número de miembros', () => {
      expect(getBlockType(0)).toBe('standard');
      expect(getBlockType(1)).toBe('standard');
      expect(getBlockType(2)).toBe('superset');
      expect(getBlockType(3)).toBe('triset');
      expect(getBlockType(4)).toBe('circuit');
      expect(getBlockType(6)).toBe('circuit');

      expect(getBlockTypeLabel(1)).toBe('Serie Estándar');
      expect(getBlockTypeLabel(2)).toBe('Bi-serie / Súper Serie');
      expect(getBlockTypeLabel(3)).toBe('Tri-serie');
      expect(getBlockTypeLabel(5)).toBe('Circuito');
    });

    it('asigna etiquetas deterministas A1, A2, B1, B2 basadas en la posición del array', () => {
      const exercises: Exercise[] = [
        { id: 'ex-1', nombre: 'Press Banca', variables: {}, block_id: 'block_chest_back' },
        { id: 'ex-2', nombre: 'Remo con Barra', variables: {}, block_id: 'block_chest_back' },
        { id: 'ex-3', nombre: 'Elevaciones Laterales', variables: {} }, // individual
        { id: 'ex-4', nombre: 'Curl Bíceps', variables: {}, block_id: 'block_arms' },
        { id: 'ex-5', nombre: 'Extensiones Tríceps', variables: {}, block_id: 'block_arms' },
      ];

      const tags = computeBlockTags(exercises);

      expect(tags['ex-1']).toBe('A1');
      expect(tags['ex-2']).toBe('A2');
      expect(tags['ex-3']).toBeUndefined();
      expect(tags['ex-4']).toBe('B1');
      expect(tags['ex-5']).toBe('B2');
    });

    it('no genera etiquetas para ejercicios con block_id huérfano (solo 1 miembro en el bloque)', () => {
      const exercises: Exercise[] = [
        { id: 'ex-alone', nombre: 'Sentadilla', variables: {}, block_id: 'orphan_block' },
        { id: 'ex-normal', nombre: 'Prensa', variables: {} },
      ];

      const tags = computeBlockTags(exercises);
      expect(tags['ex-alone']).toBeUndefined();
      expect(tags['ex-normal']).toBeUndefined();
    });

    it('soporta tri-series con etiquetas A1, A2, A3', () => {
      const exercises: Exercise[] = [
        { id: 'ex-1', nombre: 'Elevación Lateral', variables: {}, block_id: 'tri_block' },
        { id: 'ex-2', nombre: 'Pájaros Posteriores', variables: {}, block_id: 'tri_block' },
        { id: 'ex-3', nombre: 'Press Militar', variables: {}, block_id: 'tri_block' },
      ];

      const tags = computeBlockTags(exercises);
      expect(tags['ex-1']).toBe('A1');
      expect(tags['ex-2']).toBe('A2');
      expect(tags['ex-3']).toBe('A3');
    });
  });

  describe('Agrupación, Desagrupación y Actualización de Parámetros', () => {
    it('agrupa dos ejercicios asignando block_id, block_rest y transition_rest', () => {
      const initial: Exercise[] = [
        { id: 'ex-1', nombre: 'Press Banca', variables: { 'descanso': '90' } },
        { id: 'ex-2', nombre: 'Remo Barra', variables: { 'descanso': '90' } },
        { id: 'ex-3', nombre: 'Aperturas', variables: { 'descanso': '60' } },
      ];

      const grouped = groupExercisesIntoBlock(initial, ['ex-1', 'ex-2'], 120, 15);

      expect(grouped[0].block_id).toBeTruthy();
      expect(grouped[0].block_id).toBe(grouped[1].block_id);
      expect(grouped[0].block_rest).toBe(120);
      expect(grouped[0].transition_rest).toBe(15);
      expect(grouped[1].block_rest).toBe(120);
      expect(grouped[1].transition_rest).toBe(15);

      // El ejercicio 3 no se altera
      expect(grouped[2].block_id).toBeUndefined();
    });

    it('desagrupa un bloque limpiando los campos de bloque y manteniendo el resto', () => {
      const bId = 'b_test_123';
      const initial: Exercise[] = [
        { id: 'ex-1', nombre: 'Press Banca', variables: { 'descanso': '90' }, block_id: bId, block_rest: 90, transition_rest: 10 },
        { id: 'ex-2', nombre: 'Remo Barra', variables: { 'descanso': '90' }, block_id: bId, block_rest: 90, transition_rest: 10 },
      ];

      const ungrouped = ungroupBlock(initial, bId);
      expect(ungrouped[0].block_id).toBeUndefined();
      expect(ungrouped[0].block_rest).toBeUndefined();
      expect(ungrouped[0].transition_rest).toBeUndefined();
      expect(ungrouped[1].block_id).toBeUndefined();
      expect(ungrouped[0].variables['descanso']).toBe('90');
    });

    it('actualiza los descansos de ronda y transición en todos los miembros del bloque', () => {
      const bId = 'b_sync_456';
      const initial: Exercise[] = [
        { id: 'ex-1', nombre: 'A1', variables: {}, block_id: bId, block_rest: 60, transition_rest: 5 },
        { id: 'ex-2', nombre: 'A2', variables: {}, block_id: bId, block_rest: 60, transition_rest: 5 },
      ];

      const updated = updateBlockSettings(initial, bId, { block_rest: 100, transition_rest: 12 });
      expect(updated[0].block_rest).toBe(100);
      expect(updated[0].transition_rest).toBe(12);
      expect(updated[1].block_rest).toBe(100);
      expect(updated[1].transition_rest).toBe(12);
    });
  });

  describe('Vinculación Arbitraria con Reordenamiento Físico (linkExercisesWithReorder & swapBlockPartner)', () => {
    it('vincula ejercicios distantes (ej. índice 0 con índice 4) reordenando físicamente el array para dejarlos contiguos', () => {
      const initial: Exercise[] = [
        { id: 'ex-0', nombre: 'Press Banca', variables: {} },
        { id: 'ex-1', nombre: 'Sentadilla', variables: {} },
        { id: 'ex-2', nombre: 'Prensa', variables: {} },
        { id: 'ex-3', nombre: 'Curl Bíceps', variables: {} },
        { id: 'ex-4', nombre: 'Remo Barra', variables: {} },
      ];

      // Vincular Press Banca (0) con Remo Barra (4)
      const res = linkExercisesWithReorder(initial, 'ex-0', 'ex-4', 90, 10);
      const list = res.exercises;

      expect(res.anchorName).toBe('Press Banca');
      expect(res.targetName).toBe('Remo Barra');

      // Remo Barra (ex-4) se movió inmediatamente después de Press Banca (ex-0)
      expect(list.map(e => e.id)).toEqual(['ex-0', 'ex-4', 'ex-1', 'ex-2', 'ex-3']);

      // Ambos comparten el mismo block_id
      expect(list[0].block_id).toBeTruthy();
      expect(list[0].block_id).toBe(list[1].block_id);
      expect(list[0].block_rest).toBe(90);
      expect(list[0].transition_rest).toBe(10);

      // Los demás no tienen bloque
      expect(list[2].block_id).toBeUndefined();

      // Las etiquetas computadas son A1 y A2 contiguas
      const tags = computeBlockTags(list);
      expect(tags['ex-0']).toBe('A1');
      expect(tags['ex-4']).toBe('A2');
    });

    it('expande una bi-serie existente a tri-serie insertando el nuevo miembro tras el último miembro del bloque', () => {
      const initial: Exercise[] = [
        { id: 'ex-0', nombre: 'Press Banca', block_id: 'block_a', block_rest: 90, transition_rest: 10, variables: {} },
        { id: 'ex-1', nombre: 'Remo Barra', block_id: 'block_a', block_rest: 90, transition_rest: 10, variables: {} },
        { id: 'ex-2', nombre: 'Sentadilla', variables: {} },
        { id: 'ex-3', nombre: 'Pájaros Deltoides', variables: {} },
      ];

      // Vincular ex-0 (Bloque A) con ex-3 (lejano)
      const res = linkExercisesWithReorder(initial, 'ex-0', 'ex-3');
      const list = res.exercises;

      // ex-3 se coloca justo tras ex-1 (el último miembro de Bloque A)
      expect(list.map(e => e.id)).toEqual(['ex-0', 'ex-1', 'ex-3', 'ex-2']);
      expect(list[0].block_id).toBe('block_a');
      expect(list[1].block_id).toBe('block_a');
      expect(list[2].block_id).toBe('block_a');

      const tags = computeBlockTags(list);
      expect(tags['ex-0']).toBe('A1');
      expect(tags['ex-1']).toBe('A2');
      expect(tags['ex-3']).toBe('A3');
    });

    it('fusiona dos bloques existentes moviendo todo el bloque objetivo junto al bloque ancla sin dejar huérfanos', () => {
      const initial: Exercise[] = [
        { id: 'a1', nombre: 'Press Banca', block_id: 'b_chest', variables: {} },
        { id: 'a2', nombre: 'Aperturas', block_id: 'b_chest', variables: {} },
        { id: 'mid', nombre: 'Abdominales', variables: {} },
        { id: 'b1', nombre: 'Remo Barra', block_id: 'b_back', variables: {} },
        { id: 'b2', nombre: 'Jalón Pecho', block_id: 'b_back', variables: {} },
      ];

      // Vincular Bloque Pecho con Bloque Espalda
      const res = linkExercisesWithReorder(initial, 'a1', 'b1');
      const list = res.exercises;

      // Todo el Bloque Espalda (b1 + b2) se traslada contiguo tras a2
      expect(list.map(e => e.id)).toEqual(['a1', 'a2', 'b1', 'b2', 'mid']);

      // Todos los 4 miembros quedan bajo el mismo block_id
      const bId = list[0].block_id;
      expect(bId).toBeTruthy();
      expect(list[1].block_id).toBe(bId);
      expect(list[2].block_id).toBe(bId);
      expect(list[3].block_id).toBe(bId);

      const tags = computeBlockTags(list);
      expect(tags['a1']).toBe('A1');
      expect(tags['a2']).toBe('A2');
      expect(tags['b1']).toBe('A3');
      expect(tags['b2']).toBe('A4');
    });

    it('sustituye un compañero de bi-serie en caliente cuando una máquina está ocupada (swapBlockPartner)', () => {
      const initial: Exercise[] = [
        { id: 'ex-0', nombre: 'Press Banca', block_id: 'b_super', block_rest: 90, transition_rest: 10, variables: {} },
        { id: 'ex-1', nombre: 'Prensa (Ocupada)', block_id: 'b_super', block_rest: 90, transition_rest: 10, variables: {} },
        { id: 'ex-2', nombre: 'Elevaciones Laterales', variables: {} },
        { id: 'ex-3', nombre: 'Extensiones Tríceps (Disponible)', variables: {} },
      ];

      // El atleta sustituye ex-1 (Prensa ocupada) por ex-3 (Extensiones)
      const swapped = swapBlockPartner(initial, 'ex-0', 'ex-1', 'ex-3');

      // ex-3 pasa a la posición de ex-1 y toma el block_id; ex-1 pasa a la posición 3 y queda sin bloque
      expect(swapped[0].id).toBe('ex-0');
      expect(swapped[1].id).toBe('ex-3');
      expect(swapped[1].nombre).toBe('Extensiones Tríceps (Disponible)');
      expect(swapped[1].block_id).toBe('b_super');

      expect(swapped[3].id).toBe('ex-1');
      expect(swapped[3].block_id).toBeUndefined();

      const tags = computeBlockTags(swapped);
      expect(tags['ex-0']).toBe('A1');
      expect(tags['ex-3']).toBe('A2');
      expect(tags['ex-1']).toBeUndefined();
    });

    it('cleanOrphanBlocks elimina block_id si un bloque queda con menos de 2 miembros', () => {
      const exercises: Exercise[] = [
        { id: 'e1', nombre: 'Press', block_id: 'b_orphan', block_rest: 90, transition_rest: 10, variables: {} },
        { id: 'e2', nombre: 'Remo', variables: {} },
      ];

      const cleaned = cleanOrphanBlocks(exercises);
      expect(cleaned[0].block_id).toBeUndefined();
      expect(cleaned[0].block_rest).toBeUndefined();
      expect(cleaned[0].transition_rest).toBeUndefined();
    });
  });

  describe('Modo Express (Agrupamiento Ad-hoc Efímero)', () => {
    it('agrupa pares contiguos en Bi-series y deja impar solo al final', () => {
      const exercises: Exercise[] = [
        { id: 'e1', nombre: 'Press Pecho', variables: {} },
        { id: 'e2', nombre: 'Remo Espalda', variables: {} },
        { id: 'e3', nombre: 'Curl Bíceps', variables: {} },
        { id: 'e4', nombre: 'Press Francés', variables: {} },
        { id: 'e5', nombre: 'Abdominales', variables: {} },
      ];

      const result = applyExpressMode(exercises, 'supersets');
      const updated = result.exercises;

      // Par 1 (e1 + e2)
      expect(updated[0].block_id).toBeTruthy();
      expect(updated[0].block_id).toBe(updated[1].block_id);
      expect(updated[0].block_rest).toBe(90);

      // Par 2 (e3 + e4)
      expect(updated[2].block_id).toBeTruthy();
      expect(updated[2].block_id).toBe(updated[3].block_id);
      expect(updated[2].block_id).not.toBe(updated[0].block_id);

      // Ejercicio 5 (impar) queda sin bloque
      expect(updated[4].block_id).toBeUndefined();

      // Auditoría
      expect(result.expressBlocks.length).toBe(2);
      expect(result.expressBlocks[0].exercise_names).toEqual(['Press Pecho', 'Remo Espalda']);
      expect(result.expressBlocks[1].exercise_names).toEqual(['Curl Bíceps', 'Press Francés']);
    });

    it('agrupa todos los ejercicios en un único Circuito', () => {
      const exercises: Exercise[] = [
        { id: 'e1', nombre: 'Prensa', variables: {} },
        { id: 'e2', nombre: 'Extensiones', variables: {} },
        { id: 'e3', nombre: 'Femoral', variables: {} },
      ];

      const result = applyExpressMode(exercises, 'circuit');
      expect(result.exercises[0].block_id).toBeTruthy();
      expect(result.exercises[0].block_id).toBe(result.exercises[1].block_id);
      expect(result.exercises[1].block_id).toBe(result.exercises[2].block_id);
      expect(result.exercises[0].block_rest).toBe(120);

      expect(result.expressBlocks.length).toBe(1);
      expect(result.expressBlocks[0].exercise_names).toEqual(['Prensa', 'Extensiones', 'Femoral']);
    });

    it('restablece a series estándar con mode = reset', () => {
      const exercises: Exercise[] = [
        { id: 'e1', nombre: 'Prensa', variables: {}, block_id: 'b1', block_rest: 90 },
        { id: 'e2', nombre: 'Extensiones', variables: {}, block_id: 'b1', block_rest: 90 },
      ];

      const result = applyExpressMode(exercises, 'reset');
      expect(result.exercises[0].block_id).toBeUndefined();
      expect(result.exercises[0].block_rest).toBeUndefined();
      expect(result.exercises[1].block_id).toBeUndefined();
      expect(result.expressBlocks.length).toBe(0);
    });
  });

  describe('Máquina de Estados Round-Robin (computeNextExerciseStep)', () => {
    it('ejecuta bi-serie simétrica alternando transición (10s) y descanso de ronda (90s)', () => {
      const state: BlockExerciseState[] = [
        {
          block_id: 'block_ab',
          block_rest: 90,
          transition_rest: 10,
          descanso: 60,
          series: [{ done: false }, { done: false }, { done: false }],
        },
        {
          block_id: 'block_ab',
          block_rest: 90,
          transition_rest: 10,
          descanso: 60,
          series: [{ done: false }, { done: false }, { done: false }],
        },
        {
          descanso: 90,
          series: [{ done: false }, { done: false }],
        },
      ];

      // Round 0 - Ex 0 set 0
      state[0].series[0].done = true;
      let step = computeNextExerciseStep(state, 0, 0);
      expect(step.nextIdx).toBe(1);
      expect(step.timerSeconds).toBe(10);
      expect(step.timerType).toBe('transition');

      // Round 0 - Ex 1 set 0
      state[1].series[0].done = true;
      step = computeNextExerciseStep(state, 1, 0);
      expect(step.nextIdx).toBe(0);
      expect(step.timerSeconds).toBe(90);
      expect(step.timerType).toBe('round');

      // Round 1 - Ex 0 set 1
      state[0].series[1].done = true;
      step = computeNextExerciseStep(state, 0, 1);
      expect(step.nextIdx).toBe(1);
      expect(step.timerSeconds).toBe(10);
      expect(step.timerType).toBe('transition');

      // Round 1 - Ex 1 set 1
      state[1].series[1].done = true;
      step = computeNextExerciseStep(state, 1, 1);
      expect(step.nextIdx).toBe(0);
      expect(step.timerSeconds).toBe(90);
      expect(step.timerType).toBe('round');

      // Round 2 - Ex 0 set 2
      state[0].series[2].done = true;
      step = computeNextExerciseStep(state, 0, 2);
      expect(step.nextIdx).toBe(1);
      expect(step.timerSeconds).toBe(10);
      expect(step.timerType).toBe('transition');

      // Round 2 - Ex 1 set 2 (final)
      state[1].series[2].done = true;
      step = computeNextExerciseStep(state, 1, 2);
      expect(step.nextIdx).toBe(2); // Avanza al siguiente ejercicio fuera del bloque
      expect(step.timerSeconds).toBe(60);
      expect(step.timerType).toBe('standard');
    });

    it('maneja bi-serie asimétrica (A: 4 series, B: 3 series): al terminar B, A queda en solitario con descanso estándar individual', () => {
      const state: BlockExerciseState[] = [
        {
          block_id: 'block_ab',
          block_rest: 90,
          transition_rest: 10,
          descanso: 75,
          series: [{ done: true }, { done: true }, { done: true }, { done: false }], // A tiene 4 series (falta la 4ª)
        },
        {
          block_id: 'block_ab',
          block_rest: 90,
          transition_rest: 10,
          descanso: 60,
          series: [{ done: true }, { done: true }, { done: true }], // B ya completó sus 3 series
        },
      ];

      // Al completar B la serie 2 (su 3ª serie), B ya no tiene series pendientes.
      // Queda solo A activo en el bloque: deja de haber ronda y se usa el descanso individual de A (75s), tipo 'standard'.
      const stepAfterB2 = computeNextExerciseStep(state, 1, 2);
      expect(stepAfterB2.nextIdx).toBe(0);
      expect(stepAfterB2.timerSeconds).toBe(75);
      expect(stepAfterB2.timerType).toBe('standard');

      // Ahora A ejecuta su serie 3 en solitario y la completa
      state[0].series[3].done = true;
      const stepAfterA3 = computeNextExerciseStep(state, 0, 3);
      // Todo el bloque ha finalizado -> descanso individual de A (75s), tipo 'standard'
      expect(stepAfterA3.timerSeconds).toBe(75);
      expect(stepAfterA3.timerType).toBe('standard');
    });

    it('maneja cola solitaria larga (A: 6 series, B: 3 series): cada serie solitaria de A usa su propio descanso individual', () => {
      const state: BlockExerciseState[] = [
        {
          block_id: 'block_ab',
          block_rest: 90,
          transition_rest: 10,
          descanso: 120, // A es un ejercicio pesado con 120s de descanso
          series: [
            { done: true }, { done: true }, { done: true },
            { done: false }, { done: false }, { done: false }
          ],
        },
        {
          block_id: 'block_ab',
          block_rest: 90,
          transition_rest: 10,
          descanso: 60,
          series: [{ done: true }, { done: true }, { done: true }], // B terminó sus 3 series
        },
      ];

      // 1. Justo tras la 3ª serie de B: B terminó, solo queda A -> descanso individual de A (120s)
      const stepAfterB = computeNextExerciseStep(state, 1, 2);
      expect(stepAfterB.nextIdx).toBe(0);
      expect(stepAfterB.timerSeconds).toBe(120);
      expect(stepAfterB.timerType).toBe('standard');

      // 2. A completa serie 4 (índice 3): le quedan series 5 y 6 -> descanso individual de A (120s)
      state[0].series[3].done = true;
      const stepAfterA3 = computeNextExerciseStep(state, 0, 3);
      expect(stepAfterA3.nextIdx).toBe(0);
      expect(stepAfterA3.timerSeconds).toBe(120);
      expect(stepAfterA3.timerType).toBe('standard');

      // 3. A completa serie 5 (índice 4): le queda serie 6 -> descanso individual de A (120s)
      state[0].series[4].done = true;
      const stepAfterA4 = computeNextExerciseStep(state, 0, 4);
      expect(stepAfterA4.nextIdx).toBe(0);
      expect(stepAfterA4.timerSeconds).toBe(120);
      expect(stepAfterA4.timerType).toBe('standard');

      // 4. A completa serie 6 (índice 5): fin de todo el bloque
      state[0].series[5].done = true;
      const stepAfterA5 = computeNextExerciseStep(state, 0, 5);
      expect(stepAfterA5.timerSeconds).toBe(120);
      expect(stepAfterA5.timerType).toBe('standard');
    });

    it('ejecuta circuito de 3 ejercicios con series asimétricas (A: 3, B: 2, C: 3)', () => {
      const state: BlockExerciseState[] = [
        {
          block_id: 'circuit_1',
          block_rest: 120,
          transition_rest: 10,
          descanso: 90,
          series: [{ done: true }, { done: true }, { done: false }], // A
        },
        {
          block_id: 'circuit_1',
          block_rest: 120,
          transition_rest: 10,
          descanso: 90,
          series: [{ done: true }, { done: true }], // B (2 series ya hechas)
        },
        {
          block_id: 'circuit_1',
          block_rest: 120,
          transition_rest: 10,
          descanso: 90,
          series: [{ done: true }, { done: true }, { done: false }], // C
        },
      ];

      // En la ronda 2, A completa su serie 2. B ya terminó, pero A y C siguen activos (activeMembers = 2) -> bi-serie entre A y C
      state[0].series[2].done = true;
      const stepFromA = computeNextExerciseStep(state, 0, 2);
      expect(stepFromA.nextIdx).toBe(2);
      expect(stepFromA.timerSeconds).toBe(10);
      expect(stepFromA.timerType).toBe('transition');

      // C completa su serie 2 -> fin de todos los miembros
      state[2].series[2].done = true;
      const stepFromC = computeNextExerciseStep(state, 2, 2);
      expect(stepFromC.timerSeconds).toBe(90);
      expect(stepFromC.timerType).toBe('standard');
    });

    it('mantiene comportamiento estándar para ejercicios individuales sin block_id', () => {
      const state: BlockExerciseState[] = [
        {
          descanso: 120,
          series: [{ done: true }, { done: false }],
        },
      ];

      const step = computeNextExerciseStep(state, 0, 0);
      expect(step.nextIdx).toBe(0);
      expect(step.timerSeconds).toBe(120);
      expect(step.timerType).toBe('standard');
    });
  });
});
