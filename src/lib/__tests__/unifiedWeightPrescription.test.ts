// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  applyPrescribedWeightToExercise,
  recalculatePlanWeights,
} from '../periodizationEngine';
import { applyTemplateToPlan } from '../trainerTemplates';
import { TrainerTemplate, Exercise, TrainingDay } from '../../types/database.types';

describe('Unified Weight & Reps Prescription Engine (Rigorous Suite)', () => {
  describe('applyPrescribedWeightToExercise', () => {
    it('extrae repsMin correctamente para diversos formatos de rango de reps y fija reps_objetivo con 🤖', () => {
      const cases = [
        { repsStr: '10-12', expectedMin: 10 },
        { repsStr: '8 a 10', expectedMin: 8 },
        { repsStr: '6-8 reps', expectedMin: 6 },
        { repsStr: '15', expectedMin: 15 },
        { repsStr: '12 reps', expectedMin: 12 },
      ];

      cases.forEach(({ repsStr, expectedMin }) => {
        const ex = {
          id: `ex-${expectedMin}`,
          nombre: 'Press de Banca Plano',
          variables: {
            repeticiones: repsStr,
            rir: '2',
          },
        };

        const result = applyPrescribedWeightToExercise(ex, 100, 'epley', 2.5);
        expect(result.variables['reps_objetivo']).toBe(`🤖 ${expectedMin}`);
        expect(result.variables['peso']).toMatch(/^🤖 \d+(\.\d+)? kg$/);
      });
    });

    it('respeta la selección de fórmulas (Epley vs Brzycki vs Promedio)', () => {
      const ex = {
        id: 'ex-bench',
        nombre: 'Press de Banca',
        variables: {
          repeticiones: '10',
          rir: '2',
        },
      };

      const oneRM = 100;
      // Reps efectivas = 10 + 2 = 12
      // Epley: %1RM = 30 / (30 + 12) = 71.43% -> 71.43 kg -> redondeado a 2.5 = 72.5 kg
      // Brzycki: %1RM = 1.0278 - 0.0278 * 12 = 0.6942 -> 69.42 kg -> redondeado a 2.5 = 70 kg

      const resEpley = applyPrescribedWeightToExercise(ex, oneRM, 'epley', 2.5);
      const resBrzycki = applyPrescribedWeightToExercise(ex, oneRM, 'brzycki', 2.5);

      expect(resEpley.variables['peso']).toBe('🤖 72.5 kg');
      expect(resBrzycki.variables['peso']).toBe('🤖 70 kg');
    });

    it('respeta el incremento de redondeo configurado (1.0 kg, 2.5 kg, 5.0 kg)', () => {
      const ex = {
        id: 'ex-squat',
        nombre: 'Sentadilla Libre con Barra',
        variables: {
          repeticiones: '8',
          rir: '2',
        },
      };

      const oneRM = 110;

      const res1kg = applyPrescribedWeightToExercise(ex, oneRM, 'epley', 1.0);
      const res2_5kg = applyPrescribedWeightToExercise(ex, oneRM, 'epley', 2.5);
      const res5kg = applyPrescribedWeightToExercise(ex, oneRM, 'epley', 5.0);

      // Epley %1RM para 8+2=10 reps efectivas = 30/40 = 75% -> 110 * 0.75 = 82.5 kg
      expect(res1kg.variables['peso']).toBe('🤖 83 kg');
      expect(res2_5kg.variables['peso']).toBe('🤖 82.5 kg');
      expect(res5kg.variables['peso']).toBe('🤖 85 kg');
    });

    it('omite inyectar peso y reps_objetivo en ejercicios funcionales (Cardio/HIIT/WOD)', () => {
      const functionalEx = {
        id: 'ex-burpee',
        nombre: 'Burpees con Salto',
        categoria: 'funcional',
        variables: {
          repeticiones: '20',
          rir: '0',
        },
      };

      const result = applyPrescribedWeightToExercise(functionalEx, 100, 'epley', 2.5);
      expect(result.variables['peso']).toBeUndefined();
      expect(result.variables['reps_objetivo']).toBeUndefined();
    });

    it('limpia de forma atómica tanto peso como reps_objetivo si el 1RM pasa a 0 o nulo', () => {
      const exWithRobot = {
        id: 'ex-bench',
        nombre: 'Press de Banca',
        variables: {
          repeticiones: '10-12',
          rir: '2',
          peso: '🤖 72.5 kg',
          reps_objetivo: '🤖 10',
        },
      };

      const cleaned = applyPrescribedWeightToExercise(exWithRobot, 0);
      expect(cleaned.variables['peso']).toBeUndefined();
      expect(cleaned.variables['reps_objetivo']).toBeUndefined();
    });
  });

  describe('recalculatePlanWeights (Multi-Day Integration)', () => {
    it('recalcula un plan multi-día asignando peso y reps_objetivo de forma 100% coherente', () => {
      const days: TrainingDay[] = [
        {
          id: 'day-1',
          name: 'Día 1: Empuje',
          exercises: [
            {
              id: 'ex-1',
              nombre: 'Press de Banca Plano con Barra',
              variables: { repeticiones: '10-12', rir: '2' },
            } as Exercise,
          ],
        },
        {
          id: 'day-2',
          name: 'Día 2: Pierna',
          exercises: [
            {
              id: 'ex-2',
              nombre: 'Sentadilla Libre con Barra',
              variables: { repeticiones: '8-10', rir: '2' },
            } as Exercise,
            {
              id: 'ex-3',
              nombre: 'Kettlebell Swing',
              categoria: 'funcional' as any,
              variables: { repeticiones: '15', rir: '0' },
            } as Exercise,
          ],
        },
      ];

      const marcas = {
        press_banca: 100,
        sentadilla: 140,
      };

      const updatedDays = recalculatePlanWeights(days, marcas, 'epley', 2.5);

      // Día 1: Press de Banca
      const benchEx = updatedDays[0].exercises[0];
      expect(benchEx.variables['peso']).toBe('🤖 72.5 kg');
      expect(benchEx.variables['reps_objetivo']).toBe('🤖 10');

      // Día 2: Sentadilla (Compuesto)
      const squatEx = updatedDays[1].exercises[0];
      expect(squatEx.variables['peso']).toBe('🤖 105 kg');
      expect(squatEx.variables['reps_objetivo']).toBe('🤖 8');

      // Día 2: Kettlebell Swing (Funcional) -> debe quedar intacto sin peso robot
      const kbEx = updatedDays[1].exercises[1];
      expect(kbEx.variables['peso']).toBeUndefined();
      expect(kbEx.variables['reps_objetivo']).toBeUndefined();
    });
  });

  describe('applyTemplateToPlan (Trainer Templates Integration)', () => {
    it('clona plantillas asignando peso robot y reps_objetivo a los clientes con 1RM', () => {
      const template: TrainerTemplate = {
        id: 'tpl_1',
        trainer_id: 'trainer_123',
        nombre: 'Fuerza / Hipertrofia 3 Días',
        objetivo: 'hipertrofia',
        nivel_atleta: 'intermedio',
        dias_semana: 1,
        plan_data: {
          trainingDays: [
            {
              id: 'tpl_day_1',
              name: 'Día 1: Torso',
              exercises: [
                {
                  id: 'tpl_ex_1',
                  nombre: 'Press de Banca Plano con Barra',
                  variables: { repeticiones: '6-8', rir: '2' },
                } as Exercise,
              ],
            },
          ],
        },
      };

      const client1RM = { press_banca: 120 };
      const applied = applyTemplateToPlan(template, client1RM);

      const ex = applied.trainingDays[0].exercises[0];
      // 120kg 1RM x 6 reps + RIR 2 = 8 reps efectivas -> %1RM = 30/38 = 78.95% -> 94.73kg -> 95 kg
      expect(ex.variables['peso']).toBe('🤖 95 kg');
      expect(ex.variables['reps_objetivo']).toBe('🤖 6');
    });
  });

  describe('Coherence with ActiveSession Parsing Logic (Simulation)', () => {
    it('demuestra que la presencia de reps_objetivo evita la divergencia del promedio de rango en modo inmersivo', () => {
      const rawRepsVariable = '10-12';

      // Simulación de la lógica de parseo de ActiveSession.tsx:
      // Sin reps_objetivo: cae a parseReps("10-12") -> (10 + 12) / 2 = 11 reps
      const parseRepsWithoutObjetivo = (repsRaw: string) => {
        const rangeMatch = repsRaw.match(/^(\d+)\s*-\s*(\d+)$/);
        if (rangeMatch) {
          return (parseInt(rangeMatch[1], 10) + parseInt(rangeMatch[2], 10)) / 2;
        }
        return parseInt(repsRaw, 10);
      };

      // Con reps_objetivo (inyectado por el motor): "🤖 10" -> parseInt("10") = 10 reps
      const parseRepsWithObjetivo = (repsObjetivoRaw: string | undefined, repsRaw: string) => {
        const repsObjetivoNum = repsObjetivoRaw
          ? parseInt(repsObjetivoRaw.replace(/^🤖\s*/, '').trim(), 10)
          : NaN;
        return (!isNaN(repsObjetivoNum) && repsObjetivoNum > 0)
          ? repsObjetivoNum
          : parseRepsWithoutObjetivo(repsRaw);
      };

      const exerciseWithoutFix: { variables: Record<string, string | undefined> } = {
        variables: { repeticiones: rawRepsVariable, peso: '🤖 72.5 kg' },
      };

      const exerciseWithFix = applyPrescribedWeightToExercise(
        { nombre: 'Press de Banca', variables: { repeticiones: rawRepsVariable, rir: '2' } },
        100,
        'epley',
        2.5
      );

      const repsInmersivasSinFix = parseRepsWithObjetivo(
        exerciseWithoutFix.variables['reps_objetivo'],
        exerciseWithoutFix.variables['repeticiones'] || ''
      );

      const repsInmersivasConFix = parseRepsWithObjetivo(
        exerciseWithFix.variables['reps_objetivo'],
        exerciseWithFix.variables['repeticiones'] || ''
      );

      // Verificación de la incoherencia pre-fix (11 reps con peso de 10 reps)
      expect(repsInmersivasSinFix).toBe(11); // Incoherente: peso de 10 reps pedido para 11

      // Verificación del fix unificado (10 reps con peso de 10 reps)
      expect(repsInmersivasConFix).toBe(10); // 100% Coherente: coincide exactamente con repsMin (10)
    });
  });
});
