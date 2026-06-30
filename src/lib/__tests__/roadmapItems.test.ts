/**
 * Tests: Cabos del Roadmap — 3 funcionalidades implementadas
 *
 * 1. muscle_groups_in_focus   — avanzados con especialización por grupo muscular
 * 2. rir_override_manual      — el entrenador bloquea la progresión automática de RIR
 * 3. grupo_muscular en feedback — consolidación por región corporal en sesiones mixtas
 *
 * Nota sobre series: MAX_SETS_PER_EXERCISE = 8 (techo por ejercicio).
 * Los tests usan series de inicio ≤ 7 para que +1 sea observable.
 * Los thresholds semanales de MRV (pecho avanzado = 26 series/semana) son
 * para el total del grupo muscular en la semana, no por ejercicio.
 */

import { describe, it, expect } from 'vitest';
import { autoRegulatePlanForNextWeek } from '../periodizationEngine';
import type { PlanData } from '../../types/database.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Nivel = 'principiante' | 'intermedio' | 'avanzado';

const makePlan = (
  overrides: {
    nivel?: Nivel;
    sessionsPerWeek?: number;
    semanaActual?: number;
    totalSemanas?: number;
    rirInicial?: number;
    rirProgresion?: 'lenta' | 'normal' | 'agresiva';
    rirOverrideManual?: boolean;
    muscleGroupsInFocus?: string[];
    exercises?: Array<{
      id: string;
      nombre: string;
      grupo_muscular: string;
      series: string;
      rir: string;
    }>;
  } = {}
): PlanData => {
  // Series default: 6 → dentro de MAX_SETS_PER_EXERCISE (8) y por encima de MEV base.
  // Con recovered+good el motor intentará subirlas a 7, que es observable.
  const exercises = overrides.exercises ?? [
    { id: 'ex_pecho',   nombre: 'Press de banca', grupo_muscular: 'pecho',       series: '6', rir: '2' },
    { id: 'ex_espalda', nombre: 'Remo con barra',  grupo_muscular: 'espalda',     series: '6', rir: '2' },
    { id: 'ex_pierna',  nombre: 'Sentadilla',      grupo_muscular: 'cuadriceps',  series: '6', rir: '2' },
  ];

  return {
    trainingDays: [{
      id: 'day_1',
      name: 'Día A',
      exercises: exercises.map(e => ({
        id:             e.id,
        nombre:         e.nombre,
        grupo_muscular: e.grupo_muscular,
        variables: {
          'series de trabajo': e.series,
          'repeticiones':      '10',
          'rir':               e.rir,
          'descanso':          '120',
        },
      })),
    }],
    periodizationConfig: {
      enabled:                      true,
      nivel_atleta:                 overrides.nivel ?? 'avanzado',
      objetivo:                     'hipertrofia',
      semana_actual:                overrides.semanaActual ?? 1,
      total_semanas:                overrides.totalSemanas ?? 4,
      sessions_per_week:            overrides.sessionsPerWeek ?? 1,
      sessions_completed_this_week: 0,
      weekly_session_feedback:      [],
      marcas_1rm:                   {},
      rir_inicial:                  overrides.rirInicial ?? 3,
      rir_progresion:               overrides.rirProgresion ?? 'normal',
      rir_override_manual:          overrides.rirOverrideManual,
      muscle_groups_in_focus:       overrides.muscleGroupsInFocus,
    },
  };
};

const makeLogged = (
  entries: Array<{
    nombre: string;
    rir?: number;
    estimulo?: 'none' | 'good' | 'extreme';
    recuperacion?: 'recovered' | 'just_in_time' | 'sore';
    repsArray?: number[];
  }>
) => entries.map(e => ({
  nombre:                e.nombre,
  repsArray:             e.repsArray ?? [10, 10],
  peso:                  80,
  rir:                   e.rir ?? 2,
  feedback_estimulo:     e.estimulo ?? 'good',
  feedback_recuperacion: e.recuperacion ?? 'recovered',
}));

const getRIRs = (plan: PlanData): string[] =>
  plan.trainingDays!.flatMap(d => d.exercises.map(ex => ex.variables['rir']));

const getSets = (plan: PlanData): number[] =>
  plan.trainingDays!.flatMap(d =>
    d.exercises.map(ex => parseInt(ex.variables['series de trabajo'], 10))
  );

const getExByName = (plan: PlanData, nombre: string) =>
  plan.trainingDays!.flatMap(d => d.exercises).find(
    ex => ex.nombre?.toLowerCase().includes(nombre.toLowerCase())
  );

// ─── 1. muscle_groups_in_focus ───────────────────────────────────────────────

describe('muscle_groups_in_focus — especialización avanzada', () => {

  it('sin muscle_groups_in_focus: todos los grupos reciben progresión dinámica', () => {
    // 6 series de inicio → con recovered+good el motor sube a 7 (dentro de MAX=8)
    const plan   = makePlan({ nivel: 'avanzado', sessionsPerWeek: 1 });
    const logged = makeLogged([
      { nombre: 'Press de banca', recuperacion: 'recovered', estimulo: 'good' },
      { nombre: 'Remo con barra',  recuperacion: 'recovered', estimulo: 'good' },
      { nombre: 'Sentadilla',      recuperacion: 'recovered', estimulo: 'good' },
    ]);

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();

    const sets = getSets(result!);
    // Sin foco: todos deberían subir de 6 a 7
    expect(sets.every(s => s === 7)).toBe(true);
  });

  it('pecho en foco: pecho sube series, espalda y pierna se mantienen en MV', () => {
    const plan = makePlan({
      nivel:               'avanzado',
      sessionsPerWeek:     1,
      muscleGroupsInFocus: ['pecho'],
    });
    const logged = makeLogged([
      { nombre: 'Press de banca', recuperacion: 'recovered', estimulo: 'good' },
      { nombre: 'Remo con barra',  recuperacion: 'recovered', estimulo: 'good' },
      { nombre: 'Sentadilla',      recuperacion: 'recovered', estimulo: 'good' },
    ]);

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();

    const pecho   = getExByName(result!, 'Press de banca');
    const espalda = getExByName(result!, 'Remo con barra');
    const pierna  = getExByName(result!, 'Sentadilla');

    // Pecho (en foco): recovered+good → sube de 6 a 7
    expect(parseInt(pecho!.variables['series de trabajo'], 10)).toBe(7);
    // Espalda y pierna (MV): el motor bloquea la subida
    expect(parseInt(espalda!.variables['series de trabajo'], 10)).toBe(6);
    expect(parseInt(pierna!.variables['series de trabajo'],  10)).toBe(6);
  });

  it('grupo fuera de foco con sore en volumen alto: SÍ puede bajar series', () => {
    // series=7 (alta para avanzado) + sore → calculateNextMicrocycleVolume baja a 6
    // El bloqueo MV solo impide SUBIR — bajar por recuperación siempre aplica
    const plan = makePlan({
      nivel:               'avanzado',
      sessionsPerWeek:     1,
      muscleGroupsInFocus: ['pecho'],
      exercises: [
        { id: 'ex_e', nombre: 'Remo con barra', grupo_muscular: 'espalda', series: '7', rir: '1' },
      ],
    });
    const logged = makeLogged([
      { nombre: 'Remo con barra', recuperacion: 'sore', estimulo: 'good' },
    ]);

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();

    const espalda = getExByName(result!, 'Remo con barra');
    // Sore → baja de 7 a 6 (incluso siendo MV)
    expect(parseInt(espalda!.variables['series de trabajo'], 10)).toBeLessThan(7);
  });

  it('array de foco vacío: se comporta igual que sin foco (todos progresan)', () => {
    const plan = makePlan({
      nivel:               'avanzado',
      sessionsPerWeek:     1,
      muscleGroupsInFocus: [],  // vacío = sin especialización activa
    });
    const logged = makeLogged([
      { nombre: 'Press de banca', recuperacion: 'recovered', estimulo: 'good' },
      { nombre: 'Remo con barra',  recuperacion: 'recovered', estimulo: 'good' },
      { nombre: 'Sentadilla',      recuperacion: 'recovered', estimulo: 'good' },
    ]);

    const result = autoRegulatePlanForNextWeek(plan, logged);
    const sets = getSets(result!);
    // Todos deben subir (de 6 a 7)
    expect(sets.every(s => s === 7)).toBe(true);
  });

  it('nota de MV aparece en ejercicio fuera de foco cuando el motor bloquea la subida', () => {
    const plan = makePlan({
      nivel:               'avanzado',
      sessionsPerWeek:     1,
      muscleGroupsInFocus: ['pecho'],
    });
    const logged = makeLogged([
      { nombre: 'Press de banca', recuperacion: 'recovered', estimulo: 'good' },
      { nombre: 'Remo con barra',  recuperacion: 'recovered', estimulo: 'good' },
      { nombre: 'Sentadilla',      recuperacion: 'recovered', estimulo: 'good' },
    ]);

    const result = autoRegulatePlanForNextWeek(plan, logged);
    const espalda = getExByName(result!, 'Remo con barra');
    const pierna  = getExByName(result!, 'Sentadilla');
    // La nota debe mencionar que el grupo está fuera de foco
    expect(espalda!.progression_notes).toContain('fuera de foco');
    expect(pierna!.progression_notes).toContain('fuera de foco');
  });

  it('pecho y hombros en foco: ambos suben, espalda se mantiene en MV', () => {
    const plan = makePlan({
      nivel:               'avanzado',
      sessionsPerWeek:     1,
      muscleGroupsInFocus: ['pecho', 'hombros'],
      exercises: [
        { id: 'ex_p', nombre: 'Press banca',  grupo_muscular: 'pecho',   series: '6', rir: '2' },
        { id: 'ex_h', nombre: 'Press hombro', grupo_muscular: 'hombros', series: '6', rir: '2' },
        { id: 'ex_e', nombre: 'Remo barra',   grupo_muscular: 'espalda', series: '6', rir: '2' },
      ],
    });
    const logged = makeLogged([
      { nombre: 'Press banca',  recuperacion: 'recovered', estimulo: 'good' },
      { nombre: 'Press hombro', recuperacion: 'recovered', estimulo: 'good' },
      { nombre: 'Remo barra',   recuperacion: 'recovered', estimulo: 'good' },
    ]);

    const result = autoRegulatePlanForNextWeek(plan, logged);
    const pecho   = getExByName(result!, 'Press banca');
    const hombros = getExByName(result!, 'Press hombro');
    const espalda = getExByName(result!, 'Remo barra');

    expect(parseInt(pecho!.variables['series de trabajo'],   10)).toBe(7);  // subió
    expect(parseInt(hombros!.variables['series de trabajo'], 10)).toBe(7);  // subió
    expect(parseInt(espalda!.variables['series de trabajo'], 10)).toBe(6);  // MV, no sube
  });
});

// ─── 2. rir_override_manual ──────────────────────────────────────────────────

describe('rir_override_manual — el entrenador congela el RIR', () => {

  it('sin override: RIR progresa al cerrar semana (semana 1 → 2, normal → RIR 2)', () => {
    const plan = makePlan({
      nivel:           'intermedio',
      sessionsPerWeek: 1,
      semanaActual:    1,
      rirInicial:      3,
      rirProgresion:   'normal',
    });
    const logged = makeLogged([
      { nombre: 'Press de banca' },
      { nombre: 'Remo con barra' },
      { nombre: 'Sentadilla' },
    ]);

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();
    // semana 2 con normal: RIR = max(0, 3 - 1) = 2
    const rirs = getRIRs(result!);
    expect(rirs.every(r => r === '2')).toBe(true);
  });

  it('con override=true: RIR no cambia aunque cierre semana', () => {
    const plan = makePlan({
      nivel:             'intermedio',
      sessionsPerWeek:   1,
      semanaActual:      1,
      rirInicial:        3,
      rirOverrideManual: true,
      exercises: [
        { id: 'ex_p', nombre: 'Press de banca', grupo_muscular: 'pecho',   series: '6', rir: '1' },
        { id: 'ex_r', nombre: 'Remo con barra',  grupo_muscular: 'espalda', series: '6', rir: '1' },
      ],
    });
    const logged = makeLogged([
      { nombre: 'Press de banca' },
      { nombre: 'Remo con barra' },
    ]);

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();
    // El RIR debe seguir siendo '1' — el entrenador lo fijó manualmente
    const rirs = getRIRs(result!);
    expect(rirs.every(r => r === '1')).toBe(true);
  });

  it('con override=true: cada ejercicio puede tener su propio RIR fijo distinto', () => {
    const plan = makePlan({
      nivel:             'avanzado',
      sessionsPerWeek:   1,
      rirOverrideManual: true,
      exercises: [
        { id: 'ex_p', nombre: 'Press de banca', grupo_muscular: 'pecho',   series: '6', rir: '0' },
        { id: 'ex_r', nombre: 'Remo con barra',  grupo_muscular: 'espalda', series: '6', rir: '3' },
        { id: 'ex_s', nombre: 'Sentadilla',       grupo_muscular: 'pierna',  series: '6', rir: '2' },
      ],
    });
    const logged = makeLogged([
      { nombre: 'Press de banca' },
      { nombre: 'Remo con barra' },
      { nombre: 'Sentadilla' },
    ]);

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(getExByName(result!, 'Press de banca')!.variables['rir']).toBe('0');
    expect(getExByName(result!, 'Remo con barra')!.variables['rir']).toBe('3');
    expect(getExByName(result!, 'Sentadilla')!.variables['rir']).toBe('2');
  });

  it('con override=true: el 1RM y peso siguen actualizándose (solo el RIR queda fijo)', () => {
    const plan = makePlan({
      nivel:             'intermedio',
      sessionsPerWeek:   1,
      rirOverrideManual: true,
      exercises: [
        { id: 'ex_p', nombre: 'Press de banca', grupo_muscular: 'pecho', series: '6', rir: '1' },
      ],
    });
    const logged = [{
      nombre:                'Press de banca',
      repsArray:             [10, 10, 10],
      peso:                  100,
      rir:                   1,
      feedback_estimulo:     'good'      as const,
      feedback_recuperacion: 'recovered' as const,
    }];

    const result = autoRegulatePlanForNextWeek(plan, logged);
    const pecho = getExByName(result!, 'Press de banca');
    // RIR fijo: no lo toca el motor
    expect(pecho!.variables['rir']).toBe('1');
    // Pero el peso sí se actualizó (el 1RM se calculó y prescribió)
    expect(pecho!.variables['peso']).toMatch(/🤖/);
  });

  it('override=false equivale a sin override: RIR progresa igual en ambos casos', () => {
    const planFalse = makePlan({
      nivel: 'intermedio', sessionsPerWeek: 1, semanaActual: 1,
      rirInicial: 3, rirOverrideManual: false,
    });
    const planUndef = makePlan({
      nivel: 'intermedio', sessionsPerWeek: 1, semanaActual: 1, rirInicial: 3,
    });
    const logged = makeLogged([
      { nombre: 'Press de banca' },
      { nombre: 'Remo con barra' },
      { nombre: 'Sentadilla' },
    ]);

    const r1 = autoRegulatePlanForNextWeek(planFalse, logged);
    const r2 = autoRegulatePlanForNextWeek(planUndef, logged);
    expect(getRIRs(r1!)).toEqual(getRIRs(r2!));
  });
});

// ─── 3. Feedback por grupo muscular ─────────────────────────────────────────

describe('grupo_muscular en feedback — consolidación por región corporal', () => {

  it('feedback acumulado en sesión intermedia lleva grupo_muscular del plan', () => {
    // 2 sesiones/semana → esta es la 1a: solo acumula, no cierra semana
    const plan = makePlan({
      nivel:               'avanzado',
      sessionsPerWeek:     2,
      muscleGroupsInFocus: ['pecho'],
      exercises: [
        { id: 'ex_p', nombre: 'Press de banca', grupo_muscular: 'pecho',   series: '6', rir: '2' },
        { id: 'ex_e', nombre: 'Remo con barra',  grupo_muscular: 'espalda', series: '6', rir: '2' },
      ],
    });
    const logged = makeLogged([
      { nombre: 'Press de banca', recuperacion: 'sore' },
      { nombre: 'Remo con barra',  recuperacion: 'recovered' },
    ]);

    // Primera sesión de 2 — no cierra semana, solo acumula
    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();
    expect(result!.periodizationConfig?.sessions_completed_this_week).toBe(1);

    const feedback = result!.periodizationConfig?.weekly_session_feedback ?? [];
    expect(feedback.length).toBeGreaterThan(0);

    const pressEntry = feedback.find(fb => fb.ejercicio.toLowerCase().includes('banca'));
    const remoEntry  = feedback.find(fb => fb.ejercicio.toLowerCase().includes('remo'));
    expect(pressEntry?.grupo_muscular).toBe('pecho');
    expect(remoEntry?.grupo_muscular).toBe('espalda');
  });

  it('sesión mixta: pecho recuperado y espalda sore se evalúan por separado', () => {
    // El feedback de espalda (sore) no debe contagiar la decisión de pecho.
    // Con muscle_groups_in_focus incluyendo ambos, cada grupo sigue su propio feedback.
    const plan = makePlan({
      nivel:               'avanzado',
      sessionsPerWeek:     1,
      muscleGroupsInFocus: ['pecho', 'espalda'],
    });
    const logged = makeLogged([
      { nombre: 'Press de banca', recuperacion: 'recovered', estimulo: 'good' },
      { nombre: 'Remo con barra',  recuperacion: 'sore',      estimulo: 'good' },
    ]);

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();

    const pecho   = getExByName(result!, 'Press de banca');
    const espalda = getExByName(result!, 'Remo con barra');

    // Pecho: recovered → debe subir de 6 a 7
    expect(parseInt(pecho!.variables['series de trabajo'], 10)).toBe(7);
    // Espalda: sore → baja de 6 a 5 (o mantiene, nunca sube)
    expect(parseInt(espalda!.variables['series de trabajo'], 10)).toBeLessThanOrEqual(6);
  });

  it('ejercicio sin grupo_muscular en plan: no crashea y feedback sin grupo', () => {
    const plan: PlanData = {
      trainingDays: [{
        id: 'day_1', name: 'Día A',
        exercises: [{
          id: 'ex_sin', nombre: 'Ejercicio genérico',
          variables: { 'series de trabajo': '6', 'repeticiones': '10', 'rir': '2', 'descanso': '120' },
        }],
      }],
      periodizationConfig: {
        enabled: true, nivel_atleta: 'intermedio', objetivo: 'hipertrofia',
        semana_actual: 1, total_semanas: 4, sessions_per_week: 1,
        sessions_completed_this_week: 0, weekly_session_feedback: [],
        marcas_1rm: {}, rir_inicial: 3, rir_progresion: 'normal',
      },
    };
    const logged = makeLogged([{ nombre: 'Ejercicio genérico', recuperacion: 'recovered' }]);

    expect(() => autoRegulatePlanForNextWeek(plan, logged)).not.toThrow();
    const result = autoRegulatePlanForNextWeek(plan, logged);
    const fb = result!.periodizationConfig?.weekly_session_feedback ?? [];
    const entry = fb.find(f => f.ejercicio.toLowerCase().includes('genérico'));
    // Sin grupo_muscular en el plan → debe quedar undefined en el feedback
    expect(entry?.grupo_muscular).toBeUndefined();
  });
});
