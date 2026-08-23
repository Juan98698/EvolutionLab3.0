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

    it('empareja el RIR percibido con las reps de la última serie (serie más exigente, ej. 12, 12, 10 @ RIR 0) evitando sobreestimar el 1RM con repsMax', () => {
      const plan = buildBasePlan();
      // Atleta hizo 12, 12, 10 reps con 80kg y su serie más dura (la última) fue RIR 0.
      // El 1RM debe calcularse con las 10 reps de la última serie: 80 * (1 + (10+0)/30) = 106.67 kg.
      // NO con las 12 reps de la primera serie fresca: 80 * (1 + (12+0)/30) = 112 kg (que sobreestimaría +5%).
      const logged = [
        {
          nombre: 'Press de Banca',
          repsArray: [12, 12, 10],
          peso: 80,
          rir: 0,
          feedback_estimulo: 'good' as const,
          feedback_recuperacion: 'recovered' as const,
        },
      ];

      const updatedPlan = autoRegulatePlanForNextWeek(plan, logged);
      const updated1RM = updatedPlan?.periodizationConfig?.marcas_1rm?.['press de banca'];

      // 1RM estimado = 80 * (1 + 10/30) = 106.67 kg.
      // Si hubiera usado maxReps (12): 80 * (1 + 12/30) = 112 kg (sobreestimación peligrosa).
      expect(updated1RM).toBeCloseTo(106.7, 1);
      expect(updated1RM).toBeLessThan(112.0);
    });
  });

  describe('resolveProgressionEngine — despachador por ejercicio (motor de reglas vs RIR/1RM)', () => {
    const buildDispatchPlan = (progressionType?: 'linear' | 'double' | 'undulating' | 'deload'): PlanData => ({
      periodizationConfig: {
        enabled: true,
        objetivo: 'hipertrofia',
        nivel_atleta: 'intermedio',
        semana_actual: 1,
        total_semanas: 4,
        // Sin marcas_1rm: el motor de reglas no lo necesita para funcionar,
        // a diferencia del motor RIR/1RM.
      },
      trainingDays: [
        {
          id: 'day-1',
          name: 'Día 1: Torso',
          exercises: [
            {
              id: 'ex-1',
              nombre: 'Curl de Bíceps',
              grupo_muscular: 'Bíceps',
              // Sin variables['rir'] a propósito: el motor de reglas no lo lee.
              variables: { 'series de trabajo': '3', repeticiones: '10-12', peso: '20 kg' },
              progression_type: progressionType,
            },
          ],
        },
      ],
    });

    const logSession = (peso: number, reps: number[], rir: number) => ([{
      nombre: 'Curl de Bíceps',
      repsArray: reps,
      peso,
      rir,
      feedback_estimulo: 'good' as const,
      feedback_recuperacion: 'recovered' as const,
    }]);

    it('sin progression_type (default): usa el motor RIR/1RM (reps_objetivo) y nunca crea ruleProgressionState', () => {
      const plan = buildDispatchPlan(undefined);
      const result = autoRegulatePlanForNextWeek(plan, logSession(20, [12, 12, 12], 4));
      const ex = result!.trainingDays![0].exercises![0];

      // reps_objetivo es una firma exclusiva del motor RIR/1RM (checkRepProgressionTrigger
      // / applyPrescribedWeightToExercise) — su presencia confirma que el
      // despachador usó ese motor y no el de reglas.
      expect(ex.variables['reps_objetivo']).toBeDefined();
      expect(result!.periodizationConfig?.ruleProgressionState).toBeUndefined();
    });

    it("progression_type: 'linear' — usa el motor de reglas y SÍ actualiza el plan tras 3 sesiones consecutivas de RIR alto, sin necesitar marcas_1rm ni variables['rir']", () => {
      const plan = buildDispatchPlan('linear');

      let current = plan;
      let result: PlanData | null = null;
      // La 1ra sesión solo establece la línea base de volumen (no cuenta para
      // la racha) — hacen falta 3 sesiones MÁS con RIR alto para disparar,
      // por eso son 4 llamadas en total.
      for (const reps of [[12, 12, 12], [12, 12, 12], [12, 12, 13], [12, 13, 13]]) {
        result = autoRegulatePlanForNextWeek(current, logSession(20, reps, 4));
        current = result!;
      }

      const ex = result!.trainingDays![0].exercises![0];
      expect(ex.variables['peso']).not.toBe('20 kg');
      expect(ex.variables['peso']).toMatch(/^🤖 .+ kg$/);
      expect(ex.progression_notes).toContain('📈');

      // El estado incremental quedó persistido en el plan, listo para la
      // próxima sesión — igual que marcas_1rm para el motor RIR.
      expect(result!.periodizationConfig?.ruleProgressionState?.['curl de bíceps']).toBeDefined();

      // El motor RIR/1RM nunca corrió para este ejercicio: sin reps_objetivo,
      // y sin que el ajuste semanal de series/RIR de la periodización lo haya
      // tocado (rir nunca aparece, ya que el motor de reglas no lo usa).
      expect(ex.variables['reps_objetivo']).toBeUndefined();
    });

    it("progression_type: 'double' también enruta al motor de reglas y baja el peso tras 4 sesiones con volumen cayendo (la 1ra solo establece línea base)", () => {
      const plan = buildDispatchPlan('double');

      let current = plan;
      let result: PlanData | null = null;
      // peso=40kg fijo, reps bajando cada sesión -> volumen 880, 800, 720, 640
      for (const reps of [22, 20, 18, 16]) {
        result = autoRegulatePlanForNextWeek(current, logSession(40, [reps], 2));
        current = result!;
      }

      const ex = result!.trainingDays![0].exercises![0];
      expect(ex.variables['peso']).toBe('🤖 37.5 kg'); // 40 * (1 - 7%) = 37.2 -> redondeado a 2.5 -> 37.5
    });

    it('ambos motores nunca corren a la vez para el mismo ejercicio: con progression_type de reglas, el ajuste semanal de la periodización (series/rir) tampoco lo toca', () => {
      const plan = buildDispatchPlan('linear');
      // Fuerza el cierre de semana (sessions_per_week=1 con este plan de 1 día)
      // para confirmar que ni el ajuste de series ni la progresión de RIR
      // semanal tocan a un ejercicio gobernado por el motor de reglas.
      const result = autoRegulatePlanForNextWeek(plan, logSession(20, [12, 12, 12], 4));
      const ex = result!.trainingDays![0].exercises![0];

      expect(ex.variables['reps_objetivo']).toBeUndefined();
      // El motor de reglas nunca escribe 'rir' — si apareciera, sería porque
      // el ajuste semanal de periodización (que sí lo hace) no fue excluido.
      expect(ex.variables['rir']).toBeUndefined();
    });
  });
});


