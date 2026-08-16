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

  describe('End-to-End RIR & Overload Integration', () => {
    const buildBasePlan = (): PlanData => ({
      periodizationConfig: {
        enabled: true,
        objetivo: 'hipertrofia',
        nivel_atleta: 'intermedio',
        semana_actual: 1,
        total_semanas: 4,
        marcas_1rm: { 'press de banca': 100 },
        redondeo_peso: 2.5,
        formula_preferida: 'epley',
      },
      trainingDays: [
        {
          id: 'day-1',
          name: 'Día 1: Torso',
          exercises: [
            {
              id: 'ex-1',
              nombre: 'Press de Banca',
              grupo_muscular: 'Pecho',
              variables: { 'series de trabajo': '3', repeticiones: '10-12', rir: '2', peso: '🤖 72.5 kg' },
            },
          ],
        },
      ],
    });

    it('dispara doble progresión y escribe notas cuando el atleta completa el tope de reps con margen de RIR (12 reps @ RIR 4)', () => {
      const plan = buildBasePlan();
      const logged = [
        {
          nombre: 'Press de Banca',
          repsArray: [12, 12, 12],
          peso: 72.5,
          rir: 4, // rirLogrado > targetRIR + 1 (4 > 2 + 1)
          feedback_estimulo: 'good' as const,
          feedback_recuperacion: 'recovered' as const,
        },
      ];

      const updatedPlan = autoRegulatePlanForNextWeek(plan, logged);
      const ex = updatedPlan!.trainingDays![0].exercises![0];

      expect(ex!.variables!['peso']).toBe('🤖 85 kg');
      expect(ex!.variables!['reps_objetivo']).toBe('🤖 10');
      expect(ex!.progression_notes).toContain('Rango completado');
    });

    it('ajusta la marca 1RM vía EMA (0.85*prev + 0.15*new) cuando el atleta reporta un RIR real flojo y escribe nota de ajuste estándar', () => {
      const plan = buildBasePlan();
      // Atleta levantó 60kg x 8 reps con RIR 0 (1RM estimado = 60 * (1 + 8/30) = 76 kg)
      // Marca previa era 100 kg. Nueva marca EMA = 0.85 * 100 + 0.15 * 76 = 96.4 kg (o 96.3 kg).
      const logged = [
        {
          nombre: 'Press de Banca',
          repsArray: [8, 8, 8],
          peso: 60,
          rir: 0,
          feedback_estimulo: 'good' as const,
          feedback_recuperacion: 'recovered' as const,
        },
      ];

      const updatedPlan = autoRegulatePlanForNextWeek(plan, logged);
      const updated1RM = updatedPlan?.periodizationConfig?.marcas_1rm?.['press de banca'];
      const ex = updatedPlan!.trainingDays![0].exercises![0];

      expect(updated1RM).toBeLessThan(100);
      expect(updated1RM).toBeCloseTo(96.3, 1);
      expect(ex!.progression_notes).toContain('🤖 Peso ajustado a');
    });

    it('mantiene retrocompatibilidad perfecta cuando rirLogrado es igual a targetRIR (comportamiento de sesiones legacy)', () => {
      const plan = buildBasePlan();
      const logged = [
        {
          nombre: 'Press de Banca',
          repsArray: [10, 10, 10], // 10 reps (no llegó al tope de 12)
          peso: 72.5,
          rir: 2, // Igual a targetRIR (2)
          feedback_estimulo: 'good' as const,
          feedback_recuperacion: 'recovered' as const,
        },
      ];

      const updatedPlan = autoRegulatePlanForNextWeek(plan, logged);
      const ex = updatedPlan!.trainingDays![0].exercises![0];

      // No dispara doble progresión porque no completó repsMax (12)
      expect(ex!.variables!['peso']).toBe('🤖 72.5 kg');
    });
  });
});


