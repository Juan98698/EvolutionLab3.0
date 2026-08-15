import { describe, it, expect } from 'vitest';
import {
  isFunctionalExercise,
  isHypertrophyExercise,
  getFunctionalVariableLabel,
  getFunctionalVariablePlaceholder
} from '../exerciseUtils';

describe('exerciseUtils Module', () => {
  describe('isFunctionalExercise', () => {
    it('detecta ejercicios funcionales por categoría', () => {
      expect(isFunctionalExercise({ categoria: 'funcional' })).toBe(true);
      expect(isFunctionalExercise({ categoria: 'HIIT' })).toBe(true);
      expect(isFunctionalExercise({ categoria: 'cardio' })).toBe(true);
    });

    it('detecta ejercicios funcionales por keywords en el nombre', () => {
      expect(isFunctionalExercise({ nombre: 'Wall Ball Shot' })).toBe(true);
      expect(isFunctionalExercise({ nombre: 'Burpee Over Bar' })).toBe(true);
      expect(isFunctionalExercise({ nombre: 'Kettlebell Swing 16kg' })).toBe(true);
      expect(isFunctionalExercise({ nombre: 'Sled Push' })).toBe(true);
    });

    it('clasifica ejercicios tradicionales de hipertrofia como no funcionales', () => {
      expect(isFunctionalExercise({ nombre: 'Press de Banca con Barra', categoria: 'Hipertrofia' })).toBe(false);
      expect(isHypertrophyExercise({ nombre: 'Sentadilla Trasera', categoria: 'Fuerza' })).toBe(true);
    });
  });

  describe('getFunctionalVariableLabel', () => {
    it('retorna la etiqueta original cuando isFunc es false', () => {
      expect(getFunctionalVariableLabel('series', 'Series de trabajo', false)).toBe('Series de trabajo');
      expect(getFunctionalVariableLabel('rir', 'RIR', false)).toBe('RIR');
    });

    it('adapta las etiquetas cuando isFunc es true', () => {
      expect(getFunctionalVariableLabel('series', 'Series de trabajo', true)).toBe('RONDAS / SERIES');
      expect(getFunctionalVariableLabel('repeticiones', 'Repeticiones', true)).toBe('TIEMPO TRABAJO / REPS');
      expect(getFunctionalVariableLabel('descanso', 'Descanso', true)).toBe('TIEMPO DESCANSO');
      expect(getFunctionalVariableLabel('rir', 'RIR', true)).toBe('RPE / INTENSIDAD');
      expect(getFunctionalVariableLabel('peso', 'Peso', true)).toBe('CARGA (OPCIONAL)');
      expect(getFunctionalVariableLabel('tempo', 'Tempo', true)).toBe('FORMATO / ESTRUCTURA');
    });
  });

  describe('getFunctionalVariablePlaceholder', () => {
    it('retorna el placeholder original cuando isFunc es false', () => {
      expect(getFunctionalVariablePlaceholder('series', '3', false)).toBe('3');
    });

    it('adapta los placeholders cuando isFunc es true', () => {
      expect(getFunctionalVariablePlaceholder('series', '3', true)).toBe('Ej. 4 rondas');
      expect(getFunctionalVariablePlaceholder('repeticiones', '10-12', true)).toBe('Ej. 40s / 15 reps');
      expect(getFunctionalVariablePlaceholder('descanso', '90', true)).toBe('Ej. 20s / 1 min');
    });
  });
});
