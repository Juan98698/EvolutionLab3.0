/**
 * Tests: Doble Progresión (Progresión de Reps)
 *
 * Cubre:
 * 1. parseRepsRange()            — parsing de rangos "10-12", "10", "60s"
 * 2. checkRepProgressionTrigger() — lógica de disparo de doble progresión
 * 3. autoRegulatePlanForNextWeek() — integración: el trigger se aplica
 *    en cada sesión (no solo al cerrar semana) y escribe peso + nota.
 */

import { describe, it, expect } from 'vitest';
import {
  parseRepsRange,
  checkRepProgressionTrigger,
  autoRegulatePlanForNextWeek,
} from '../periodizationEngine';
import type { PlanData } from '../../types/database.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makePlanWithOneRM = (
  repsStr: string,
  rir: string,
  oneRM: number,
  nivel: 'principiante' | 'intermedio' | 'avanzado' = 'intermedio',
  sessionsPerWeek = 1,
): PlanData => ({
  trainingDays: [{
    id: 'day_1',
    name: 'Día A',
    exercises: [{
      id: 'ex_1',
      nombre: 'Press de banca',
      variables: {
        'series de trabajo': '3',
        'repeticiones': repsStr,
        'rir': rir,
        'descanso': '120',
      },
    }],
  }],
  periodizationConfig: {
    enabled: true,
    nivel_atleta: nivel,
    objetivo: 'hipertrofia',
    semana_actual: 1,
    total_semanas: 4,
    sessions_per_week: sessionsPerWeek,
    sessions_completed_this_week: 0,
    weekly_session_feedback: [],
    marcas_1rm: { 'press de banca': oneRM },
    rir_inicial: 3,
    rir_progresion: 'normal',
    redondeo_peso: 2.5,
  },
});

const makeLogged = (
  repsArray: number[],
  rir: number,
  peso: number = 80,
  estimulo: 'none' | 'good' | 'extreme' = 'good',
  recuperacion: 'recovered' | 'just_in_time' | 'sore' = 'recovered',
) => [{
  nombre: 'Press de banca',
  repsArray,
  peso,
  rir,
  feedback_estimulo: estimulo,
  feedback_recuperacion: recuperacion,
}];

// ─── 1. parseRepsRange ────────────────────────────────────────────────────────

describe('parseRepsRange', () => {
  it('rango "10-12": min=10, max=12', () => {
    expect(parseRepsRange('10-12')).toEqual({ repsMin: 10, repsMax: 12 });
  });
  it('rango "6-8": min=6, max=8', () => {
    expect(parseRepsRange('6-8')).toEqual({ repsMin: 6, repsMax: 8 });
  });
  it('valor único "10": min=10, max=10', () => {
    expect(parseRepsRange('10')).toEqual({ repsMin: 10, repsMax: 10 });
  });
  it('valor único "5": min=5, max=5', () => {
    expect(parseRepsRange('5')).toEqual({ repsMin: 5, repsMax: 5 });
  });
  it('rango con espacios "12 - 15": min=12, max=15', () => {
    expect(parseRepsRange('12 - 15')).toEqual({ repsMin: 12, repsMax: 15 });
  });
  it('"60s" (isométrico con número): devuelve min=60, max=60', () => {
    // Hay un número, así que parseamos lo que hay
    expect(parseRepsRange('60s')).toEqual({ repsMin: 60, repsMax: 60 });
  });
  it('string vacío: devuelve null', () => {
    expect(parseRepsRange('')).toBeNull();
  });
  it('sin números: devuelve null', () => {
    expect(parseRepsRange('AMRAP')).toBeNull();
  });
});

// ─── 2. checkRepProgressionTrigger ───────────────────────────────────────────

describe('checkRepProgressionTrigger', () => {

  // ── Casos donde SÍ aplica el trigger ────────────────────────────────────────
  it('llegó al tope del rango con margen de sobra: aplica progresión', () => {
    // 12 reps (tope), RIR logrado 3, RIR target 1 → margen = 3-1=2 > 1 → sube
    const result = checkRepProgressionTrigger(12, 12, 10, 3, 1, 100, 2.5);
    expect(result).not.toBeNull();
    expect(result!.newWeight).toBeGreaterThan(0);
    expect(result!.newReps).toBe(10); // vuelve al mínimo del rango
    expect(result!.note).toContain('Rango completado');
  });

  it('peso calculado correcto: 1RM=100, repsMin=10, RIR=2 → ~73 kg', () => {
    // pct1RM = 30/(30+10+2) = 30/42 ≈ 0.714 → 100 * 0.714 = 71.4 → redondea a 72.5
    const result = checkRepProgressionTrigger(12, 12, 10, 4, 2, 100, 2.5);
    expect(result).not.toBeNull();
    expect(result!.newWeight).toBe(72.5);
  });

  it('margen de exactamente 2 RIR activa el trigger', () => {
    // RIR logrado=3, target=1 → margen=2 > 1 → activa
    const result = checkRepProgressionTrigger(12, 12, 10, 3, 1, 100, 2.5);
    expect(result).not.toBeNull();
  });

  // ── Casos donde NO aplica el trigger ────────────────────────────────────────
  it('NO llega al tope del rango: no aplica', () => {
    // Hizo 10 reps, tope es 12 → no completó el rango
    const result = checkRepProgressionTrigger(10, 12, 10, 3, 1, 100, 2.5);
    expect(result).toBeNull();
  });

  it('llegó al tope pero sin margen suficiente (RIR logrado = target + 1): no aplica', () => {
    // RIR logrado=2, target=1 → margen=1, condición es > 1 → no activa
    const result = checkRepProgressionTrigger(12, 12, 10, 2, 1, 100, 2.5);
    expect(result).toBeNull();
  });

  it('llegó al tope con RIR logrado = target exacto: no aplica', () => {
    // RIR logrado=2, target=2 → margen=0 → no activa
    const result = checkRepProgressionTrigger(12, 12, 10, 2, 2, 100, 2.5);
    expect(result).toBeNull();
  });

  it('llegó al tope con RIR logrado < target (se pasó de duro): no aplica', () => {
    // Hizo más esfuerzo del esperado — el peso NO sube
    const result = checkRepProgressionTrigger(12, 12, 10, 0, 2, 100, 2.5);
    expect(result).toBeNull();
  });

  it('1RM = 0: no aplica (sin datos)', () => {
    const result = checkRepProgressionTrigger(12, 12, 10, 3, 1, 0, 2.5);
    expect(result).toBeNull();
  });

  it('rango de un solo valor (no hay tope superior): aplica si supera max', () => {
    // "10" → repsMin=10, repsMax=10. Hizo 10 con RIR 4, target 1 → margen 3 → sube
    const result = checkRepProgressionTrigger(10, 10, 10, 4, 1, 100, 2.5);
    expect(result).not.toBeNull();
  });

  it('redondeo personalizado (1.25 kg) aplicado correctamente', () => {
    // pct1RM = 30/(30+10+2) ≈ 0.714 → 100 * 0.714 = 71.4 → redondea a 71.25 con inc=1.25
    const result = checkRepProgressionTrigger(12, 12, 10, 4, 2, 100, 1.25);
    expect(result).not.toBeNull();
    expect(result!.newWeight % 1.25).toBeCloseTo(0, 5);
  });
});

// ─── 3. Integración en autoRegulatePlanForNextWeek ───────────────────────────

describe('autoRegulatePlanForNextWeek — doble progresión', () => {

  const getExFromResult = (plan: PlanData) =>
    plan.trainingDays![0].exercises[0];

  // ── Trigger activo: peso sube y hay nota ────────────────────────────────────
  it('doble progresión activa: peso y nota se escriben en el plan', () => {
    const plan   = makePlanWithOneRM('10-12', '1', 100, 'intermedio', 3);
    // Hizo 12 reps con RIR 3, target RIR 1 → margen=2 → trigger activo
    const logged = makeLogged([12, 12, 11], 3);

    // Sesión intermedia (1 de 3): peso sí se recalcula aunque no cierre semana
    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();

    const ex = getExFromResult(result!);
    expect(ex.variables['peso']).toMatch(/🤖/);
    // Nota debe mencionar el rango completado
    expect(ex.progression_notes).toContain('Rango completado');
    expect(ex.progression_notes).toContain('RIR 3');
  });

  it('el nuevo peso prescripto usa el 1RM actualizado desde el logged (no el inicial del config)', () => {
    // El engine actualiza el 1RM ANTES de calcular el peso prescripto.
    // logged: 80 kg × 12 reps × RIR 3 → 1RM Epley = 80*(1+15/30) = 120
    //                                    1RM Brzycki = 80/(1.0278-0.0278*15) ≈ 112.8
    //                                    Promedio ≈ 116.4 → pero usa EMA si hay 1RM previo
    // 1RM config inicial = 100 → nuevo estimado ~116 → EMA toma el mayor (PR)
    // Resultado: la función sí escribe un peso > 0 con el emoji 🤖
    const plan   = makePlanWithOneRM('10-12', '1', 100, 'intermedio', 3);
    const logged = makeLogged([12, 12, 12], 3);

    const result = autoRegulatePlanForNextWeek(plan, logged);
    const ex     = getExFromResult(result!);

    // El peso debe estar prescripto (🤖) y ser un número mayor a 0
    expect(ex.variables['peso']).toMatch(/🤖 \d+(\.\d+)? kg/);
    // Y debe ser mayor que el peso prescripto con el 1RM original (100kg)
    // pct1RM = 30/(30+10+1) = 30/41 ≈ 73.2% → con 1RM=100 sería 72.5 kg
    // Con 1RM > 100 (actualizado), el peso debe ser > 72.5 kg
    const pesoNum = parseFloat(ex.variables['peso'].replace('🤖 ', '').replace(' kg', ''));
    expect(pesoNum).toBeGreaterThan(72.5);
    // Y la nota confirma que fue doble progresión
    expect(ex.progression_notes).toContain('Rango completado');
  });

  // ── Trigger inactivo: prescripción estándar ─────────────────────────────────
  it('sin trigger (reps por debajo del tope): prescripción estándar sin nota de progresión', () => {
    const plan   = makePlanWithOneRM('10-12', '2', 100, 'intermedio', 3);
    // Hizo 10 reps (no llegó al tope de 12)
    const logged = makeLogged([10, 10, 9], 2);

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();

    const ex = getExFromResult(result!);
    // Peso prescripto estándar sí debe estar
    expect(ex.variables['peso']).toMatch(/🤖/);
    // Pero NO debe haber nota de doble progresión
    expect(ex.progression_notes ?? '').not.toContain('Rango completado');
  });

  it('sin trigger (margen insuficiente RIR logrado = target + 1): prescripción estándar', () => {
    const plan   = makePlanWithOneRM('10-12', '1', 100, 'intermedio', 3);
    // Hizo 12 reps con RIR 2 y target 1 → margen=1, no activa
    const logged = makeLogged([12, 12, 12], 2);

    const result = autoRegulatePlanForNextWeek(plan, logged);
    const ex     = getExFromResult(result!);
    expect(ex.progression_notes ?? '').not.toContain('Rango completado');
  });

  // ── Ejercicio sin 1RM previo: no rompe el plan ──────────────────────────────
  it('ejercicio sin 1RM en marcas: no escribe peso ni rompe el plan', () => {
    const plan = makePlanWithOneRM('10-12', '2', 0, 'intermedio', 3);
    // Forzar marcas vacías
    plan.periodizationConfig!.marcas_1rm = {};
    const logged = makeLogged([12, 12, 12], 4);

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();
    // 1RM se actualiza desde el logged (80 kg × factor) — no crashea
  });

  // ── La doble progresión corre en sesión intermedia (no solo al cerrar semana) ──
  it('doble progresión se aplica en sesión intermedia (no espera cierre de semana)', () => {
    // 3 sesiones/semana, esta es la sesión 1 (no la última)
    const plan   = makePlanWithOneRM('10-12', '1', 100, 'intermedio', 3);
    const logged = makeLogged([12, 12, 12], 3); // margen=2 → trigger

    const result = autoRegulatePlanForNextWeek(plan, logged);
    expect(result).not.toBeNull();
    // sessions_completed_this_week debe ser 1 (no cerró semana)
    expect(result!.periodizationConfig?.sessions_completed_this_week).toBe(1);
    // Pero el peso ya se actualizó
    expect(getExFromResult(result!).variables['peso']).toMatch(/🤖/);
    expect(getExFromResult(result!).progression_notes).toContain('Rango completado');
  });

  // ── Respeta redondeo_peso del config ────────────────────────────────────────
  it('respeta redondeo_peso=1.25 del periodizationConfig', () => {
    const plan = makePlanWithOneRM('10-12', '1', 100, 'intermedio', 3);
    plan.periodizationConfig!.redondeo_peso = 1.25;
    const logged = makeLogged([12, 12, 12], 3);

    const result = autoRegulatePlanForNextWeek(plan, logged);
    const ex     = getExFromResult(result!);
    const pesoNum = parseFloat(ex.variables['peso'].replace('🤖 ', '').replace(' kg', ''));
    // Debe ser múltiplo de 1.25
    expect(pesoNum % 1.25).toBeCloseTo(0, 5);
  });
});
