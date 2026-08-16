// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  calculate1RM,
  getPrescribedLoad,
  getPrescribedLoadDetailed,
  calcTargetRIRForWeek,
  calculateNextMicrocycleVolume,
  autoRegulatePlanForNextWeek,
  applyPrescribedWeightToExercise,
  recalculatePlanWeights,
} from '../periodizationEngine';
import { PlanData } from '../../types/database.types';

describe('periodizationEngine Library', () => {
  describe('calculate1RM', () => {
    it('debe calcular 1RM correctamente usando Epley (100kg x 10 reps @ RIR 0 = 133.3kg - 133.4kg)', () => {
      const e1RM = calculate1RM(100, 10, 0);
      expect(e1RM).toBeGreaterThanOrEqual(133.3);
      expect(e1RM).toBeLessThanOrEqual(133.5);
    });

    it('retorna 0 si el peso es 0 o las repeticiones son 0', () => {
      expect(calculate1RM(0, 10, 2)).toBe(0);
      expect(calculate1RM(100, 0, 0)).toBe(0);
    });
  });

  describe('getPrescribedLoad & getPrescribedLoadDetailed', () => {
    it('calcula la carga prescrita para un 1RM dado', () => {
      const load = getPrescribedLoad(100, 8, 2);
      expect(load).toBeGreaterThan(60);
      expect(load).toBeLessThan(90);
      expect(load % 2.5).toBe(0); // Redondeado a incrementos de 2.5kg
    });

    it('retorna prescripción detallada con metadatos y fórmulas (Epley vs Brzycki)', () => {
      const detailedEpley = getPrescribedLoadDetailed(120, 5, 1, 'epley', 2.5);
      const detailedBrzycki = getPrescribedLoadDetailed(120, 5, 1, 'brzycki', 2.5);

      expect(detailedEpley.formula).toBe('epley');
      expect(detailedEpley.formulaLabel).toContain('Epley');
      expect(detailedBrzycki.formula).toBe('brzycki');
      expect(detailedBrzycki.formulaLabel).toContain('Brzycki');
    });
  });

  describe('calcTargetRIRForWeek', () => {
    it('calcula la progresión de RIR a lo largo del mesociclo (comienza alto y disminuye)', () => {
      const rirW1 = calcTargetRIRForWeek(1, 3, 'intermedio');
      const rirW3 = calcTargetRIRForWeek(3, 3, 'intermedio');

      expect(rirW1).toBeGreaterThanOrEqual(rirW3);
    });
  });

  describe('calculateNextMicrocycleVolume', () => {
    it('aumenta series si el estímulo fue bueno y la recuperación recuperada', () => {
      const adj = calculateNextMicrocycleVolume(4, 'good', 'recovered', 'intermedio');
      expect(adj.nextSets).toBeGreaterThan(4);
      expect(adj.triggerDeload).toBe(false);
    });

    it('disminuye series o activa descarga si la recuperación reportada es sore/extrema', () => {
      const adj = calculateNextMicrocycleVolume(22, 'extreme', 'sore', 'intermedio');
      expect(adj.nextSets).toBeLessThan(22);
    });
  });

  describe('autoRegulatePlanForNextWeek', () => {
    const mockPlan: PlanData = {
      periodizationConfig: {
        enabled: true,
        objetivo: 'hipertrofia',
        nivel_atleta: 'intermedio',
        semana_actual: 1,
        total_semanas: 4,
        marcas_1rm: { 'Press de Banca Plano con Barra': 100 },
      },
      trainingDays: [
        {
          id: 'day-1',
          name: 'Día 1: Pecho',
          exercises: [
            {
              id: 'ex-1',
              nombre: 'Press de Banca Plano con Barra',
              grupo_muscular: 'Pecho',
              variables: { 'series de trabajo': '3', repeticiones: '10', rir: '2' },
            },
          ],
        },
      ],
    };

    it('retorna el plan auto-regulado cuando recibe los ejercicios ejecutados', () => {
      const loggedExercises = [
        {
          nombre: 'Press de Banca Plano con Barra',
          repsArray: [10, 10, 10],
          peso: 80,
          rir: 3,
          feedback_estimulo: 'good' as const,
          feedback_recuperacion: 'recovered' as const,
        },
      ];

      const updatedPlan = autoRegulatePlanForNextWeek(mockPlan, loggedExercises);

      expect(updatedPlan).not.toBeNull();
      expect(updatedPlan?.periodizationConfig?.semana_actual).toBe(2);
    });
  });

  describe('applyPrescribedWeightToExercise & recalculatePlanWeights', () => {
    it('escribe tanto peso (🤖 X kg) como reps_objetivo (🤖 repsMin) de forma coherente', () => {
      const inputEx = {
        id: 'ex-bench',
        nombre: 'Press de Banca',
        variables: {
          'repeticiones': '10-12',
          'rir': '2',
        },
      };

      const updatedEx = applyPrescribedWeightToExercise(inputEx, 100, 'epley', 2.5);

      expect(updatedEx.variables['peso']).toMatch(/^🤖 \d+(\.\d+)? kg$/);
      expect(updatedEx.variables['reps_objetivo']).toBe('🤖 10');
    });

    it('recalculatePlanWeights actualiza de forma coherente peso y reps_objetivo en todos los días del plan', () => {
      const days = [
        {
          id: 'day-1',
          name: 'Día 1',
          exercises: [
            {
              id: 'ex-squat',
              nombre: 'Sentadilla Libre con Barra',
              variables: { 'repeticiones': '8-10', 'rir': '2' },
            },
          ],
        },
      ];

      const marcas = { sentadilla: 140 };
      const updatedDays = recalculatePlanWeights(days, marcas, 'epley', 2.5);

      const ex = updatedDays[0].exercises[0];
      expect(ex.variables['peso']).toMatch(/^🤖 \d+(\.\d+)? kg$/);
      expect(ex.variables['reps_objetivo']).toBe('🤖 8');
    });

    it('limpia las variables autogeneradas por el motor (🤖) cuando el 1RM es 0 o indefinido', () => {
      const inputEx = {
        id: 'ex-bench',
        nombre: 'Press de Banca',
        variables: {
          'repeticiones': '10-12',
          'rir': '2',
          'peso': '🤖 75 kg',
          'reps_objetivo': '🤖 10',
        },
      };

      const cleanedEx = applyPrescribedWeightToExercise(inputEx, 0);

      expect(cleanedEx.variables['peso']).toBeUndefined();
      expect(cleanedEx.variables['reps_objetivo']).toBeUndefined();
    });
  });
});

