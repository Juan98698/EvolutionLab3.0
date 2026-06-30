/**
 * Tests: Plan de Progresión por Nivel — RIR como regulador de intensidad
 *
 * Cubre:
 * 1. calcTargetRIRForWeek() — lógica pura por nivel y progresión
 * 2. autoRegulatePlanForNextWeek() — que el RIR se inyecta correctamente
 *    al cerrar un microciclo (no en sesiones intermedias)
 */

import { describe, it, expect } from 'vitest';
import {
  calcTargetRIRForWeek,
  autoRegulatePlanForNextWeek,
} from '../periodizationEngine';
import type { PlanData } from '../../types/database.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Crea un PlanData mínimo para tests de autoregulación */
const makePlan = (
  nivel: 'principiante' | 'intermedio' | 'avanzado',
  semanaActual: number,
  totalSemanas: number,
  rirInicial?: number,
  rirProgresion?: 'lenta' | 'normal' | 'agresiva',
  sessionsPerWeek = 1,
): PlanData => ({
  trainingDays: [
    {
      id: 'day_1',
      name: 'Día A',
      exercises: [
        {
          id: 'ex_1',
          nombre: 'Press de banca',
          variables: {
            'series de trabajo': '3',
            'repeticiones': '10',
            'rir': '3',
            'descanso': '120',
          },
        },
        {
          id: 'ex_2',
          nombre: 'Sentadilla',
          variables: {
            'series de trabajo': '4',
            'repeticiones': '8',
            'rir': '3',
            'descanso': '180',
          },
        },
      ],
    },
  ],
  periodizationConfig: {
    enabled:                    true,
    nivel_atleta:               nivel,
    objetivo:                   'hipertrofia',
    semana_actual:              semanaActual,
    total_semanas:              totalSemanas,
    sessions_per_week:          sessionsPerWeek,
    sessions_completed_this_week: 0,
    weekly_session_feedback:    [],
    marcas_1rm:                 {},
    rir_inicial:                rirInicial,
    rir_progresion:             rirProgresion,
  },
});

const makeLoggedExercises = () => [
  {
    nombre:               'Press de banca',
    repsArray:            [10, 10, 10],
    peso:                 80,
    rir:                  3,
    feedback_estimulo:    'good'  as const,
    feedback_recuperacion:'recovered' as const,
  },
  {
    nombre:               'Sentadilla',
    repsArray:            [8, 8, 8, 8],
    peso:                 100,
    rir:                  3,
    feedback_estimulo:    'good'  as const,
    feedback_recuperacion:'recovered' as const,
  },
];

// ─── 1. calcTargetRIRForWeek ─────────────────────────────────────────────────

describe('calcTargetRIRForWeek', () => {

  // ── Principiante ────────────────────────────────────────────────────────────
  describe('principiante (progresión lenta, floor=1)', () => {
    it('semana 1: RIR 3 (sin descenso)', () => {
      expect(calcTargetRIRForWeek(1, 3, 'principiante', 'lenta')).toBe(3);
    });
    it('semana 2: RIR 3 (aún no bajó)', () => {
      expect(calcTargetRIRForWeek(2, 3, 'principiante', 'lenta')).toBe(3);
    });
    it('semana 3: RIR 2 (primer descenso en semana impar)', () => {
      expect(calcTargetRIRForWeek(3, 3, 'principiante', 'lenta')).toBe(2);
    });
    it('semana 4: RIR 2 (se mantiene otra semana)', () => {
      expect(calcTargetRIRForWeek(4, 3, 'principiante', 'lenta')).toBe(2);
    });
    it('semana 5: RIR 1 (segundo descenso)', () => {
      expect(calcTargetRIRForWeek(5, 3, 'principiante', 'lenta')).toBe(1);
    });
    it('semana 6: RIR 1 (se mantiene)', () => {
      expect(calcTargetRIRForWeek(6, 3, 'principiante', 'lenta')).toBe(1);
    });
    it('NUNCA llega a 0 — floor en 1 (técnica no consolidada)', () => {
      // Bloque largo de 10 semanas
      expect(calcTargetRIRForWeek(10, 3, 'principiante', 'lenta')).toBe(1);
    });
  });

  // ── Intermedio ──────────────────────────────────────────────────────────────
  describe('intermedio (progresión normal, floor=0)', () => {
    it('semana 1: RIR 3', () => {
      expect(calcTargetRIRForWeek(1, 3, 'intermedio', 'normal')).toBe(3);
    });
    it('semana 2: RIR 2', () => {
      expect(calcTargetRIRForWeek(2, 3, 'intermedio', 'normal')).toBe(2);
    });
    it('semana 3: RIR 1', () => {
      expect(calcTargetRIRForWeek(3, 3, 'intermedio', 'normal')).toBe(1);
    });
    it('semana 4: RIR 0 (llega a fallo)', () => {
      expect(calcTargetRIRForWeek(4, 3, 'intermedio', 'normal')).toBe(0);
    });
    it('no baja de 0 (floor respetado)', () => {
      expect(calcTargetRIRForWeek(10, 3, 'intermedio', 'normal')).toBe(0);
    });
  });

  // ── Avanzado ────────────────────────────────────────────────────────────────
  describe('avanzado (rir_inicial=4, progresión normal, floor=0)', () => {
    it('semana 1: RIR 4', () => {
      expect(calcTargetRIRForWeek(1, 4, 'avanzado', 'normal')).toBe(4);
    });
    it('semana 2: RIR 3', () => {
      expect(calcTargetRIRForWeek(2, 4, 'avanzado', 'normal')).toBe(3);
    });
    it('semana 3: RIR 2', () => {
      expect(calcTargetRIRForWeek(3, 4, 'avanzado', 'normal')).toBe(2);
    });
    it('semana 4: RIR 1', () => {
      expect(calcTargetRIRForWeek(4, 4, 'avanzado', 'normal')).toBe(1);
    });
    it('semana 5: RIR 0', () => {
      expect(calcTargetRIRForWeek(5, 4, 'avanzado', 'normal')).toBe(0);
    });
  });

  // ── Defaults de nivel ───────────────────────────────────────────────────────
  describe('defaults de progresión según nivel', () => {
    it('sin progresión explícita: la firma default es "normal" (baja cada semana)', () => {
      // El default del parámetro en la firma es 'normal', NO 'lenta'.
      // El nivel no cambia el default de la función pura — quien lo adapta
      // es handleGuidedComplete/autoRegulatePlanForNextWeek pasando el valor
      // correcto. Semana 3 con normal: RIR = max(0, 3-2) = 1 para intermedio.
      expect(calcTargetRIRForWeek(3, 3, 'intermedio')).toBe(1);
    });
    it('avanzado sin especificar progresión usa normal', () => {
      expect(calcTargetRIRForWeek(3, 4, 'avanzado')).toBe(2);
    });
    it('principiante con "normal" explícito: baja más rápido que lenta pero floor=1', () => {
      // Semana 3, normal: decrement=2 → max(1, 3-2) = 1
      expect(calcTargetRIRForWeek(3, 3, 'principiante', 'normal')).toBe(1);
    });
    it('principiante con "lenta" explícito: semana 3 = RIR 2', () => {
      expect(calcTargetRIRForWeek(3, 3, 'principiante', 'lenta')).toBe(2);
    });
  });
});

// ─── 2. autoRegulatePlanForNextWeek + RIR ────────────────────────────────────

describe('autoRegulatePlanForNextWeek — progresión RIR', () => {

  /**
   * Extrae el RIR del primer ejercicio del primer día del plan resultante.
   * Devuelve null si el ejercicio no tiene variables.rir.
   */
  const getRIRFromPlan = (plan: PlanData): string | null =>
    plan.trainingDays?.[0]?.exercises?.[0]?.variables?.['rir'] ?? null;

  // ── Sesión intermedia: RIR no debe cambiar ──────────────────────────────────
  it('sesión intermedia (no es la última): RIR permanece igual', () => {
    const plan   = makePlan('intermedio', 1, 4, 3, 'normal', 3); // 3 sesiones/semana
    const logged = makeLoggedExercises();

    // Primera sesión de 3 — no cierra microciclo
    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();
    // RIR debe seguir siendo '3' (semana 1, sesión 1 de 3)
    expect(getRIRFromPlan(result!)).toBe('3');
  });

  // ── Intermedio: cierre de semana → RIR baja ─────────────────────────────────
  it('intermedio, semana 1 → 2 (1 sesión/semana): RIR pasa de 3 a 2', () => {
    const plan   = makePlan('intermedio', 1, 4, 3, 'normal', 1);
    const logged = makeLoggedExercises();

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();
    // Al cerrar semana 1, el motor calcula RIR para semana 2 → 3-(2-1)=2
    expect(getRIRFromPlan(result!)).toBe('2');
    expect(result!.periodizationConfig?.semana_actual).toBe(2);
  });

  it('intermedio, semana 3 → 4 (última, 1 sesión/semana): RIR = 0', () => {
    const plan   = makePlan('intermedio', 3, 4, 3, 'normal', 1);
    const logged = makeLoggedExercises();

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();
    // RIR semana 4: max(0, 3 - (4-1)) = max(0, 0) = 0
    expect(getRIRFromPlan(result!)).toBe('0');
  });

  // ── Principiante: floor en 1, progresión lenta ──────────────────────────────
  it('principiante, semana 1 → 2: RIR se mantiene en 3 (progresión lenta)', () => {
    const plan   = makePlan('principiante', 1, 6, 3, 'lenta', 1);
    const logged = makeLoggedExercises();

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();
    // Semana 2 con progresión lenta: floor((2-1)/2)=0 → RIR = max(1, 3-0) = 3
    expect(getRIRFromPlan(result!)).toBe('3');
  });

  it('principiante, semana 2 → 3: RIR baja a 2', () => {
    const plan   = makePlan('principiante', 2, 6, 3, 'lenta', 1);
    const logged = makeLoggedExercises();

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();
    // Semana 3 con lenta: floor((3-1)/2)=1 → RIR = max(1, 3-1) = 2
    expect(getRIRFromPlan(result!)).toBe('2');
  });

  it('principiante nunca llega a RIR 0 — semana 5 → 6: RIR = 1', () => {
    const plan   = makePlan('principiante', 5, 6, 3, 'lenta', 1);
    const logged = makeLoggedExercises();

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();
    // Semana 6 con lenta: floor((6-1)/2)=2 → RIR = max(1, 3-2) = 1
    expect(getRIRFromPlan(result!)).toBe('1');
  });

  // ── Deload: siempre RIR 4, ignora la progresión ─────────────────────────────
  it('deload al cerrar bloque: RIR = 4 (siempre, sin importar nivel)', () => {
    // semana_actual=4 = total_semanas → es fin de bloque
    const plan   = makePlan('intermedio', 4, 4, 3, 'normal', 1);
    const logged = makeLoggedExercises();

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();
    // Deload: RIR debe ser '4'
    expect(getRIRFromPlan(result!)).toBe('4');
    // Y la semana se resetea a 1
    expect(result!.periodizationConfig?.semana_actual).toBe(1);
  });

  // ── Avanzado con rir_inicial=4 ───────────────────────────────────────────────
  it('avanzado con rir_inicial=4, semana 1 → 2: RIR = 3', () => {
    const plan   = makePlan('avanzado', 1, 5, 4, 'normal', 1);
    const logged = makeLoggedExercises();

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();
    // RIR semana 2: max(0, 4-(2-1)) = 3
    expect(getRIRFromPlan(result!)).toBe('3');
  });

  // ── RIR se aplica a TODOS los ejercicios del plan ────────────────────────────
  it('el RIR actualizado se escribe en TODOS los ejercicios del plan', () => {
    const plan   = makePlan('intermedio', 1, 4, 3, 'normal', 1);
    const logged = makeLoggedExercises();

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();

    const allRIRs = result!.trainingDays!.flatMap(day =>
      day.exercises.map(ex => ex.variables['rir'])
    );
    // Todos deben ser '2' (semana 2 con intermedio normal desde rir_inicial=3)
    expect(allRIRs.every(r => r === '2')).toBe(true);
  });

  // ── Defaults: sin rir_inicial ni rir_progresion explícitos ──────────────────
  it('sin rir_inicial explícito: intermedio usa default 3', () => {
    const plan   = makePlan('intermedio', 1, 4, undefined, undefined, 1);
    const logged = makeLoggedExercises();

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();
    // Default: rir_inicial=3, progresión=normal → semana 2 → RIR 2
    expect(getRIRFromPlan(result!)).toBe('2');
  });

  it('sin rir_inicial explícito: avanzado usa default 4', () => {
    const plan   = makePlan('avanzado', 1, 5, undefined, undefined, 1);
    const logged = makeLoggedExercises();

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();
    // Default: rir_inicial=4, progresión=normal → semana 2 → RIR 3
    expect(getRIRFromPlan(result!)).toBe('3');
  });
});

// ─── 3. Deload mid-block por fatiga sistémica (triggerDeload conectado) ──────

describe('deload mid-block por fatiga sistémica', () => {

  /** Plan con ejercicios en volumen alto para disparar triggerDeload */
  const makeHighVolumePlan = (
    nivel: 'principiante' | 'intermedio' | 'avanzado',
    setsPerExercise: number,
    sessionsPerWeek = 1,
  ): PlanData => ({
    trainingDays: [{
      id: 'day_1',
      name: 'Día A',
      exercises: [
        {
          id: 'ex_1',
          nombre: 'Press de banca',
          variables: { 'series de trabajo': String(setsPerExercise), 'repeticiones': '10', 'rir': '1', 'descanso': '120' },
        },
        {
          id: 'ex_2',
          nombre: 'Sentadilla',
          variables: { 'series de trabajo': String(setsPerExercise), 'repeticiones': '8', 'rir': '1', 'descanso': '180' },
        },
        {
          id: 'ex_3',
          nombre: 'Remo con barra',
          variables: { 'series de trabajo': String(setsPerExercise), 'repeticiones': '10', 'rir': '1', 'descanso': '120' },
        },
      ],
    }],
    periodizationConfig: {
      enabled:                      true,
      nivel_atleta:                 nivel,
      objetivo:                     'hipertrofia',
      semana_actual:                2,    // mid-block, no es el final
      total_semanas:                4,
      sessions_per_week:            sessionsPerWeek,
      sessions_completed_this_week: 0,
      weekly_session_feedback:      [],
      marcas_1rm:                   {},
      rir_inicial:                  3,
      rir_progresion:               'normal',
    },
  });

  const makeAllSoreLogged = () => [
    { nombre: 'Press de banca', repsArray: [10, 10], peso: 80, rir: 1, feedback_estimulo: 'good'  as const, feedback_recuperacion: 'sore' as const },
    { nombre: 'Sentadilla',     repsArray: [8, 8],   peso: 100, rir: 1, feedback_estimulo: 'good' as const, feedback_recuperacion: 'sore' as const },
    { nombre: 'Remo con barra', repsArray: [10, 10], peso: 70, rir: 1, feedback_estimulo: 'good'  as const, feedback_recuperacion: 'sore' as const },
  ];

  it('mayoría sore en volumen alto: dispara deload mid-block y setea mrv_limite_alcanzado', () => {
    // 3 ejercicios con 7 series y sore → triggerDeload en los 3 → mayoría (3/3 > 50%)
    const plan   = makeHighVolumePlan('intermedio', 7, 1);
    const logged = makeAllSoreLogged();

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();

    // mrv_limite_alcanzado = true: señal para la UI
    expect(result!.periodizationConfig?.mrv_limite_alcanzado).toBe(true);
    // semana_actual NO se resetea — el bloque continúa desde donde estaba
    expect(result!.periodizationConfig?.semana_actual).toBe(2);
    // RIR sube a DELOAD_RIR (4) en todos los ejercicios
    const allRIRs = result!.trainingDays!.flatMap(d => d.exercises.map(ex => ex.variables['rir']));
    expect(allRIRs.every(r => r === '4')).toBe(true);
    // Series reducidas a la mitad (7 → max(2, round(7/2)) = 4)
    const allSets = result!.trainingDays!.flatMap(d => d.exercises.map(ex => parseInt(ex.variables['series de trabajo'], 10)));
    expect(allSets.every(s => s <= 4)).toBe(true);
  });

  it('mayoría sore en volumen BAJO: NO dispara deload mid-block (triggerDeload=false con pocas series)', () => {
    // 3 series con sore: triggerDeload solo si currentSets >= 6 para intermedios → no aplica
    const plan   = makeHighVolumePlan('intermedio', 3, 1);
    const logged = makeAllSoreLogged();

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();

    // Sin deload mid-block — el volumen bajo con sore solo reduce series
    expect(result!.periodizationConfig?.mrv_limite_alcanzado).toBeFalsy();
    // La semana avanza normalmente
    expect(result!.periodizationConfig?.semana_actual).toBe(3);
  });

  it('solo 1 de 3 ejercicios con sore: no alcanza mayoría — sin deload mid-block', () => {
    const plan   = makeHighVolumePlan('intermedio', 7, 1);
    const logged = [
      { nombre: 'Press de banca', repsArray: [10, 10], peso: 80, rir: 1, feedback_estimulo: 'good'     as const, feedback_recuperacion: 'sore'      as const },
      { nombre: 'Sentadilla',     repsArray: [8, 8],   peso: 100, rir: 1, feedback_estimulo: 'good'    as const, feedback_recuperacion: 'recovered'  as const },
      { nombre: 'Remo con barra', repsArray: [10, 10], peso: 70, rir: 1, feedback_estimulo: 'good'     as const, feedback_recuperacion: 'recovered'  as const },
    ];

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();

    // 1/3 votos = 33% < 50% → sin deload mid-block
    expect(result!.periodizationConfig?.mrv_limite_alcanzado).toBeFalsy();
    expect(result!.periodizationConfig?.semana_actual).toBe(3);
  });

  it('deload al final del bloque: semana_actual se resetea a 1 y mrv_limite_alcanzado=false', () => {
    // semana_actual=4 con total_semanas=4 → isEndOfBlock → deload planificado
    const plan = makeHighVolumePlan('intermedio', 7, 1);
    plan.periodizationConfig!.semana_actual  = 4;
    plan.periodizationConfig!.total_semanas  = 4;
    const logged = makeAllSoreLogged();

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();

    // Deload planificado: resetea el bloque
    expect(result!.periodizationConfig?.semana_actual).toBe(1);
    expect(result!.periodizationConfig?.mrv_limite_alcanzado).toBe(false);
  });
});
