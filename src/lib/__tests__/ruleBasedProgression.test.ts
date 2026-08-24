// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { applyRuleBasedProgression, RuleProgressionState } from '../ruleBasedProgression';
import { Rule } from '../../types/database.types';

const emptyState: RuleProgressionState = {};

describe('applyRuleBasedProgression', () => {
  it('primera sesión (sin ultimoVolumen previo): no dispara nada, solo guarda línea base', () => {
    const result = applyRuleBasedProgression({
      peso: 80, repsArray: [10, 10, 10], rirLogrado: 4, state: emptyState,
    });
    expect(result.newWeight).toBeNull();
    expect(result.ruleApplied).toBeNull();
    expect(result.newState.ultimoVolumen).toBe(2400); // 80 * 30
  });

  it('rirLogrado null (atleta no reportó): no dispara nada, pero actualiza el volumen de referencia', () => {
    const result = applyRuleBasedProgression({
      peso: 80, repsArray: [10, 10], rirLogrado: null, state: { ultimoVolumen: 800, rirAltoStreak: 2 },
    });
    expect(result.newWeight).toBeNull();
    expect(result.newState.ultimoVolumen).toBe(1600); // 80 * 20
  });

  it('autocarga (peso 0) sin RIR reportado: no dispara, solo actualiza volumen de referencia', () => {
    const result = applyRuleBasedProgression({
      peso: 0, repsArray: [10, 10], rirLogrado: null, state: { ultimoVolumen: 100, rirAltoStreak: 2 },
    });
    expect(result.newWeight).toBeNull();
    expect(result.ruleApplied).toBeNull();
  });

  describe('subir_peso_reps — RIR alto sostenido', () => {
    const reps = [[10, 10], [11, 10], [11, 11]]; // volumen creciendo: 1600, 1680, 1760 (peso=80)

    it('NO dispara con solo 2 sesiones consecutivas de RIR alto (falta 1 para el umbral default de 3)', () => {
      let state: RuleProgressionState = { ultimoVolumen: 1500 };
      let r = applyRuleBasedProgression({ peso: 80, repsArray: reps[0], rirLogrado: 4, state });
      state = r.newState;
      expect(r.ruleApplied).toBeNull();
      expect(state.rirAltoStreak).toBe(1);

      r = applyRuleBasedProgression({ peso: 80, repsArray: reps[1], rirLogrado: 4, state });
      state = r.newState;
      expect(r.ruleApplied).toBeNull();
      expect(state.rirAltoStreak).toBe(2);
    });

    it('dispara al llegar a la 3ra sesión consecutiva con RIR alto y sube el peso coherente con incremento_porciento/incremento_minimo_kg', () => {
      let state: RuleProgressionState = { ultimoVolumen: 1500 };
      let r = applyRuleBasedProgression({ peso: 80, repsArray: reps[0], rirLogrado: 4, state });
      state = r.newState;
      r = applyRuleBasedProgression({ peso: 80, repsArray: reps[1], rirLogrado: 4, state });
      state = r.newState;
      r = applyRuleBasedProgression({ peso: 80, repsArray: reps[2], rirLogrado: 3, state });

      expect(r.ruleApplied).toBe('subir_peso_reps');
      // 5% de 80=4kg > mínimo 2.5kg -> gana el 5% -> 84 -> redondeado a 2.5 -> 85
      expect(r.newWeight).toBe(85);
      expect(r.note).toContain('📈');
      expect(r.newState.rirAltoStreak).toBe(0);
    });

    it('una sesión con RIR bajo en medio de la racha la resetea a 0 (no acumula sesiones no consecutivas)', () => {
      let state: RuleProgressionState = { ultimoVolumen: 1500 };
      let r = applyRuleBasedProgression({ peso: 80, repsArray: reps[0], rirLogrado: 4, state });
      state = r.newState;
      expect(state.rirAltoStreak).toBe(1);

      r = applyRuleBasedProgression({ peso: 80, repsArray: reps[1], rirLogrado: 1, state });
      state = r.newState;
      expect(state.rirAltoStreak).toBe(0);
    });

    it('respeta activa:false — no dispara aunque la racha llegue al umbral', () => {
      const rulesDisabled: Rule[] = [
        { id: 'subir_peso_reps', tipo: 'subir', activa: false, titulo: '', mensaje: '', rir_umbral: 3, sesiones_consecutivas: 3 },
      ];
      let state: RuleProgressionState = { ultimoVolumen: 1500 };
      let r;
      for (const repArr of reps) {
        r = applyRuleBasedProgression({ peso: 80, repsArray: repArr, rirLogrado: 4, state, rules: rulesDisabled });
        state = r.newState;
      }
      expect(r!.ruleApplied).toBeNull();
      expect(r!.newWeight).toBeNull();
    });
  });

  describe('bajar_peso_regresion — volumen cayendo, sin importar el RIR', () => {
    // peso=100, reps sumando 10 -> 9 -> 8 -> 7 => volumen 1000 -> 900 -> 800 -> 700 (limpio, decreciente)
    it('dispara tras 3 caídas de volumen consecutivas, incluso con RIR medio (no bajo)', () => {
      let state: RuleProgressionState = { ultimoVolumen: 1000 };
      let r = applyRuleBasedProgression({ peso: 100, repsArray: [9], rirLogrado: 2, state });
      state = r.newState;
      r = applyRuleBasedProgression({ peso: 100, repsArray: [8], rirLogrado: 2, state });
      state = r.newState;
      r = applyRuleBasedProgression({ peso: 100, repsArray: [7], rirLogrado: 2, state });

      expect(r.ruleApplied).toBe('bajar_peso_regresion');
      // reduccion_porciento default 7% de 100 = 7 -> 93 -> redondeado a 2.5 -> 92.5
      expect(r.newWeight).toBe(92.5);
      expect(r.note).toContain('📉');
    });
  });

  describe('bajar_peso_rir_alto — fatiga real (RIR muy bajo Y volumen cayendo a la vez)', () => {
    it('dispara tras 3 sesiones con RIR muy bajo (cerca del fallo) Y volumen cayendo simultáneamente', () => {
      let state: RuleProgressionState = { ultimoVolumen: 1000 };
      let r = applyRuleBasedProgression({ peso: 100, repsArray: [9], rirLogrado: 0, state });
      state = r.newState;
      r = applyRuleBasedProgression({ peso: 100, repsArray: [8], rirLogrado: 1, state });
      state = r.newState;
      r = applyRuleBasedProgression({ peso: 100, repsArray: [7], rirLogrado: 0, state });

      expect(r.ruleApplied).toBe('bajar_peso_rir_alto');
      expect(r.newWeight).toBe(92.5);
      expect(r.note).toContain('cerca del fallo');
    });

    it('prioriza fatiga real (bajar_peso_rir_alto) sobre regresión simple cuando ambas condiciones se cumplen a la vez', () => {
      let state: RuleProgressionState = { ultimoVolumen: 1000 };
      let r = applyRuleBasedProgression({ peso: 100, repsArray: [9], rirLogrado: 0, state });
      state = r.newState;
      r = applyRuleBasedProgression({ peso: 100, repsArray: [8], rirLogrado: 0, state });
      state = r.newState;
      r = applyRuleBasedProgression({ peso: 100, repsArray: [7], rirLogrado: 0, state });

      expect(r.ruleApplied).toBe('bajar_peso_rir_alto');
    });
  });

  describe('subir_peso_reps_objetivo — objetivo de reps concreto alcanzado en suficientes series', () => {
    it('dispara tras 2 sesiones (default) donde >=75% de las series llegan al objetivo de reps', () => {
      // repsObjetivo=10, 3 series por sesión -> necesita al menos 3 series (ceil(3*0.75)=3) cumpliendo
      let state: RuleProgressionState = { ultimoVolumen: 100 * 27 }; // línea base previa
      let r = applyRuleBasedProgression({
        peso: 100, repsArray: [10, 10, 10], rirLogrado: 2, repsObjetivo: 10, state,
      });
      state = r.newState;
      expect(r.ruleApplied).toBeNull(); // 1ra sesión de la racha, aún no llega al umbral (2)
      expect(state.repsObjetivoStreak).toBe(1);

      r = applyRuleBasedProgression({
        peso: 100, repsArray: [10, 10, 10], rirLogrado: 2, repsObjetivo: 10, state,
      });
      expect(r.ruleApplied).toBe('subir_peso_reps_objetivo');
      expect(r.newWeight).toBe(105); // 100 + max(2.5, 5%) = 100+5=105
      expect(r.note).toContain('🚀');
    });

    it('NO dispara si menos del 75% de las series llegan al objetivo (ej. 1 de 3)', () => {
      let state: RuleProgressionState = { ultimoVolumen: 100 * 27 };
      let r;
      for (let i = 0; i < 3; i++) {
        r = applyRuleBasedProgression({
          peso: 100, repsArray: [10, 8, 8], rirLogrado: 2, repsObjetivo: 10, state,
        });
        state = r.newState;
      }
      expect(r!.ruleApplied).not.toBe('subir_peso_reps_objetivo');
      expect(state.repsObjetivoStreak).toBe(0);
    });
  });

  describe('subir_reps_antes_peso — volumen creciendo sostenido, antes de tocar el peso', () => {
    it('dispara tras 2 sesiones (default) de crecimiento de volumen >=8%, sumando 1 rep en vez de peso', () => {
      let state: RuleProgressionState = { ultimoVolumen: 1000 };
      // repsObjetivo=20 (bien por encima de lo logueado) para que
      // subir_peso_reps_objetivo nunca dispare y no le robe el turno a esta
      // regla — en producción este valor viene de progression_params; sin él,
      // el fallback usa la propia sesión como meta (ver test de fallback más abajo).
      let r = applyRuleBasedProgression({ peso: 100, repsArray: [11], rirLogrado: 2, repsObjetivo: 20, state }); // 1100
      state = r.newState;
      expect(r.ruleApplied).toBeNull();
      expect(state.volumenCrecioStreak).toBe(1);

      r = applyRuleBasedProgression({ peso: 100, repsArray: [13], rirLogrado: 2, repsObjetivo: 20, state }); // 1300 > 1100*1.08=1188
      expect(r.ruleApplied).toBe('subir_reps_antes_peso');
      expect(r.newWeight).toBeNull(); // esta regla nunca toca el peso
      expect(r.newRepsObjetivo).toBe(14); // max(repsArray)=13 + 1
      expect(r.note).toContain('🎯');
    });

    it('sin repsObjetivo explícito (fallback): usa la propia sesión como meta implícita, igual que el overload.ts original', () => {
      // Documenta el comportamiento del fallback: sin progression_params
      // configurado, subir_peso_reps_objetivo puede disparar primero porque
      // su meta implícita es la propia sesión — mismo comportamiento que
      // tenía el sistema de notificaciones original en ese mismo caso.
      let state: RuleProgressionState = { ultimoVolumen: 1000 };
      let r = applyRuleBasedProgression({ peso: 100, repsArray: [11], rirLogrado: 2, state });
      state = r.newState;
      r = applyRuleBasedProgression({ peso: 100, repsArray: [13], rirLogrado: 2, state });
      expect(r.ruleApplied).toBe('subir_peso_reps_objetivo');
    });

    it('NO dispara si el crecimiento de volumen es menor al umbral (ej. solo +2%)', () => {
      let state: RuleProgressionState = { ultimoVolumen: 1000 };
      let r;
      for (let i = 0; i < 3; i++) {
        r = applyRuleBasedProgression({ peso: 100, repsArray: [10.2], rirLogrado: 2, repsObjetivo: 20, state }); // +2%
        state = r.newState;
      }
      expect(r!.ruleApplied).not.toBe('subir_reps_antes_peso');
    });
  });

  describe('autocarga_subir_reps — mismo criterio que subir_peso_reps pero para peso 0', () => {
    it('dispara tras 2 sesiones (default para autocarga) de RIR alto, sumando 1 rep en vez de peso', () => {
      let state: RuleProgressionState = {};
      let r = applyRuleBasedProgression({ peso: 0, repsArray: [12, 12], rirLogrado: 4, state });
      state = r.newState;
      expect(r.ruleApplied).toBeNull();
      expect(state.autocargaRirAltoStreak).toBe(1);

      r = applyRuleBasedProgression({ peso: 0, repsArray: [13, 13], rirLogrado: 3, state });
      expect(r.ruleApplied).toBe('autocarga_subir_reps');
      expect(r.newWeight).toBeNull();
      expect(r.newRepsObjetivo).toBe(14); // max(repsArray)=13 + 1
      expect(r.note).toContain('🤸');
    });

    it('nunca toca el peso, incluso si por error se le pasa un peso > 0 pero se detecta autocarga solo con peso<=0', () => {
      // Confirma que el criterio de autocarga es estrictamente peso<=0.
      const r = applyRuleBasedProgression({ peso: 0.0, repsArray: [10], rirLogrado: 4, state: {} });
      expect(r.newWeight).toBeNull();
    });
  });

  describe('descanso_excesivo — volver tras un corte largo (máxima prioridad)', () => {
    it('dispara si pasaron más de 14 días desde la última sesión registrada, bajando el peso 10%', () => {
      const state: RuleProgressionState = { ultimoVolumen: 800, ultimaFecha: '2026-08-01', rirAltoStreak: 2 };
      const r = applyRuleBasedProgression({
        peso: 100, repsArray: [10], rirLogrado: 4, fecha: '2026-08-20', state, // 19 días de corte
      });
      expect(r.ruleApplied).toBe('descanso_excesivo');
      expect(r.newWeight).toBe(90); // 100 * 0.9 -> redondeado a 2.5 -> 90
      expect(r.note).toContain('19 días');
      // Las rachas de peso se resetean tras un corte largo (no tiene sentido arrastrarlas)
      expect(r.newState.rirAltoStreak).toBeUndefined();
    });

    it('NO dispara con un corte de 10 días (por debajo del umbral de 14)', () => {
      const state: RuleProgressionState = { ultimoVolumen: 800, ultimaFecha: '2026-08-01' };
      const r = applyRuleBasedProgression({
        peso: 100, repsArray: [10], rirLogrado: 4, fecha: '2026-08-11', state,
      });
      expect(r.ruleApplied).not.toBe('descanso_excesivo');
    });

    it('sin fecha o sin ultimaFecha previa: no se evalúa esta regla (no rompe nada)', () => {
      const r = applyRuleBasedProgression({
        peso: 100, repsArray: [10], rirLogrado: 4, state: { ultimoVolumen: 800 }, // sin ultimaFecha
      });
      expect(r.ruleApplied).not.toBe('descanso_excesivo');
    });

    it('toma prioridad sobre cualquier otra regla que también se cumpliera esa misma sesión', () => {
      // Racha de regresión ya en 2 (a 1 de disparar bajar_peso_regresion), pero
      // el corte de 20 días debe ganar de todos modos.
      const state: RuleProgressionState = {
        ultimoVolumen: 1000, ultimaFecha: '2026-08-01', regresionStreak: 2,
      };
      const r = applyRuleBasedProgression({
        peso: 100, repsArray: [5], rirLogrado: 2, fecha: '2026-08-21', state, // volumen cae Y hay corte largo
      });
      expect(r.ruleApplied).toBe('descanso_excesivo');
    });
  });

  describe('deload_sugerido — muchas semanas seguidas sin cortes largos', () => {
    it('dispara tras 6 semanas (default) de entrenamiento continuo sin cortes >14 días, bajando peso y series ~40%', () => {
      let state: RuleProgressionState = {};
      let r = applyRuleBasedProgression({ peso: 100, repsArray: [10, 10, 10], rirLogrado: 2, fecha: '2026-01-01', state });
      state = r.newState;
      expect(state.deloadStreakInicio).toBe('2026-01-01');

      // Simula sesiones cada 7 días durante 6 semanas, sin superar nunca el corte de 14 días
      let fecha = new Date('2026-01-01T00:00:00Z');
      for (let semana = 1; semana <= 6; semana++) {
        fecha = new Date(fecha.getTime() + 7 * 24 * 60 * 60 * 1000);
        const fechaStr = fecha.toISOString().slice(0, 10);
        r = applyRuleBasedProgression({ peso: 100, repsArray: [10, 10, 10], rirLogrado: 2, fecha: fechaStr, state });
        state = r.newState;
      }

      expect(r!.ruleApplied).toBe('deload_sugerido');
      expect(r!.newWeight).toBe(60); // 100 * 0.6
      expect(r!.newSeries).toBe(2); // round(3 * 0.6) = 2 (redondeado, mínimo 1)
      expect(r!.note).toContain('💤');
    });

    it('un corte de más de 14 días reinicia la racha de deload (no se acumula a través del descanso)', () => {
      let state: RuleProgressionState = {};
      let r = applyRuleBasedProgression({ peso: 100, repsArray: [10], rirLogrado: 2, fecha: '2026-01-01', state });
      state = r.newState;

      // Corte de 20 días
      r = applyRuleBasedProgression({ peso: 100, repsArray: [10], rirLogrado: 2, fecha: '2026-01-21', state });
      state = r.newState;

      // La racha de deload debió reiniciarse a la fecha de esta última sesión
      expect(state.deloadStreakInicio).toBe('2026-01-21');
    });
  });

  it('caso de uso completo: sube por RIR alto, luego 3 sesiones de regresión bajan el peso otra vez', () => {
    let state: RuleProgressionState = { ultimoVolumen: 1500 };
    let r;
    for (const repArr of [[10, 10], [11, 10], [11, 11]]) {
      r = applyRuleBasedProgression({ peso: 80, repsArray: repArr, rirLogrado: 4, state });
      state = r.newState;
    }
    expect(r!.ruleApplied).toBe('subir_peso_reps');
    const pesoSubido = r!.newWeight!;
    expect(pesoSubido).toBeGreaterThan(80);

    // Ahora, con el peso nuevo, 3 sesiones de volumen cayendo
    for (const reps of [9, 8, 7]) {
      r = applyRuleBasedProgression({ peso: pesoSubido, repsArray: [reps], rirLogrado: 2, state });
      state = r.newState;
    }
    expect(r!.ruleApplied).toBe('bajar_peso_regresion');
    expect(r!.newWeight!).toBeLessThan(pesoSubido);
  });
});
