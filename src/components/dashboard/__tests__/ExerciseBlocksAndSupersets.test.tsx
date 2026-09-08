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

    it('maneja bi-serie asimétrica (A: 4 series, B: 3 series) sin bloquear al atleta', () => {
      const state: BlockExerciseState[] = [
        {
          block_id: 'block_ab',
          block_rest: 90,
          transition_rest: 10,
          descanso: 75,
          series: [{ done: true }, { done: true }, { done: true }, { done: false }], // A tiene 4 series
        },
        {
          block_id: 'block_ab',
          block_rest: 90,
          transition_rest: 10,
          descanso: 60,
          series: [{ done: true }, { done: true }, { done: true }], // B ya completó sus 3 series
        },
      ];

      // Al completar B la serie 2, el siguiente paso debe ser A para su serie 3 pendiente
      const stepAfterB2 = computeNextExerciseStep(state, 1, 2);
      expect(stepAfterB2.nextIdx).toBe(0);
      expect(stepAfterB2.timerSeconds).toBe(90);
      expect(stepAfterB2.timerType).toBe('round');

      // Ahora A ejecuta su serie 3 en solitario
      state[0].series[3].done = true;
      const stepAfterA3 = computeNextExerciseStep(state, 0, 3);
      // B ya no tiene serie 3, por lo que A no tiene transición ni ronda siguiente -> bloque terminado
      expect(stepAfterA3.timerSeconds).toBe(75);
      expect(stepAfterA3.timerType).toBe('standard');
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

      // En la ronda 2, A completa su serie 2. B no tiene serie 2 -> debe saltar directo a C (índice 2)
      state[0].series[2].done = true;
      const stepFromA = computeNextExerciseStep(state, 0, 2);
      expect(stepFromA.nextIdx).toBe(2);
      expect(stepFromA.timerSeconds).toBe(10);
      expect(stepFromA.timerType).toBe('transition');

      // C completa su serie 2 -> fin del circuito
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
