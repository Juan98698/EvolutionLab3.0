// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { applyRuleBasedProgression, RuleProgressionState } from '../ruleBasedProgression';
import { Rule } from '../../types/database.types';

const emptyState: RuleProgressionState = {};

describe('applyRuleBasedProgression', () => {
  it('primera sesión (sin ultimoVolumen previo): no dispara nada, solo guarda línea base', () => {
    const result = applyRuleBasedProgression({
      peso: 80, volumen: 800, rirLogrado: 4, state: emptyState,
    });
    expect(result.newWeight).toBeNull();
    expect(result.ruleApplied).toBeNull();
    expect(result.newState.ultimoVolumen).toBe(800);
  });

  it('rirLogrado null (atleta no reportó): no dispara nada, pero actualiza el volumen de referencia', () => {
    const result = applyRuleBasedProgression({
      peso: 80, volumen: 850, rirLogrado: null, state: { ultimoVolumen: 800, rirAltoStreak: 2 },
    });
    expect(result.newWeight).toBeNull();
    expect(result.newState.ultimoVolumen).toBe(850);
  });

  it('autocarga (peso 0): nunca dispara, solo actualiza volumen de referencia', () => {
    const result = applyRuleBasedProgression({
      peso: 0, volumen: 0, rirLogrado: 4, state: { ultimoVolumen: 100, rirAltoStreak: 2 },
    });
    expect(result.newWeight).toBeNull();
    expect(result.ruleApplied).toBeNull();
  });

  describe('subir_peso_reps — RIR alto sostenido', () => {
    it('NO dispara con solo 2 sesiones consecutivas de RIR alto (falta 1 para el umbral default de 3)', () => {
      let state: RuleProgressionState = { ultimoVolumen: 700 };
      // Sesión 1 con RIR alto y volumen subiendo
      let r = applyRuleBasedProgression({ peso: 80, volumen: 760, rirLogrado: 4, state });
      state = r.newState;
      expect(r.ruleApplied).toBeNull();
      expect(state.rirAltoStreak).toBe(1);

      // Sesión 2
      r = applyRuleBasedProgression({ peso: 80, volumen: 800, rirLogrado: 4, state });
      state = r.newState;
      expect(r.ruleApplied).toBeNull();
      expect(state.rirAltoStreak).toBe(2);
    });

    it('dispara al llegar a la 3ra sesión consecutiva con RIR alto y sube el peso coherente con incremento_porciento/incremento_minimo_kg', () => {
      let state: RuleProgressionState = { ultimoVolumen: 700 };
      let r = applyRuleBasedProgression({ peso: 80, volumen: 760, rirLogrado: 4, state });
      state = r.newState;
      r = applyRuleBasedProgression({ peso: 80, volumen: 800, rirLogrado: 4, state });
      state = r.newState;
      r = applyRuleBasedProgression({ peso: 80, volumen: 820, rirLogrado: 3, state });

      expect(r.ruleApplied).toBe('subir_peso_reps');
      // incremento_minimo_kg=2.5 vs 5% de 80=4 -> gana el 5% -> 84, redondeado a 2.5 -> 85
      expect(r.newWeight).toBe(85);
      expect(r.note).toContain('📈');
      // La racha se resetea tras aplicar, para no volver a subir la próxima sesión sin nueva evidencia
      expect(r.newState.rirAltoStreak).toBe(0);
    });

    it('una sesión con RIR bajo en medio de la racha la resetea a 0 (no acumula sesiones no consecutivas)', () => {
      let state: RuleProgressionState = { ultimoVolumen: 700 };
      let r = applyRuleBasedProgression({ peso: 80, volumen: 760, rirLogrado: 4, state });
      state = r.newState;
      expect(state.rirAltoStreak).toBe(1);

      r = applyRuleBasedProgression({ peso: 80, volumen: 780, rirLogrado: 1, state }); // RIR bajo rompe la racha
      state = r.newState;
      expect(state.rirAltoStreak).toBe(0);
    });

    it('respeta activa:false — no dispara aunque la racha llegue al umbral', () => {
      const rulesDisabled: Rule[] = [
        { id: 'subir_peso_reps', tipo: 'subir', activa: false, titulo: '', mensaje: '', rir_umbral: 3, sesiones_consecutivas: 3 },
      ];
      let state: RuleProgressionState = { ultimoVolumen: 700 };
      let r;
      for (const vol of [760, 800, 820]) {
        r = applyRuleBasedProgression({ peso: 80, volumen: vol, rirLogrado: 4, state, rules: rulesDisabled });
        state = r.newState;
      }
      expect(r!.ruleApplied).toBeNull();
      expect(r!.newWeight).toBeNull();
    });
  });

  describe('bajar_peso_regresion — volumen cayendo, sin importar el RIR', () => {
    it('dispara tras 3 caídas de volumen consecutivas, incluso con RIR medio (no bajo)', () => {
      let state: RuleProgressionState = { ultimoVolumen: 1000 };
      let r = applyRuleBasedProgression({ peso: 80, volumen: 950, rirLogrado: 2, state });
      state = r.newState;
      r = applyRuleBasedProgression({ peso: 80, volumen: 900, rirLogrado: 2, state });
      state = r.newState;
      r = applyRuleBasedProgression({ peso: 80, volumen: 850, rirLogrado: 2, state });

      expect(r.ruleApplied).toBe('bajar_peso_regresion');
      // reduccion_porciento default 7% de 80 = 5.6 -> 74.4 -> redondeado a 2.5 -> 75
      expect(r.newWeight).toBe(75);
      expect(r.note).toContain('📉');
    });
  });

  describe('bajar_peso_rir_alto — fatiga real (RIR muy bajo Y volumen cayendo a la vez)', () => {
    it('dispara tras 3 sesiones con RIR muy bajo (cerca del fallo) Y volumen cayendo simultáneamente', () => {
      let state: RuleProgressionState = { ultimoVolumen: 1000 };
      let r = applyRuleBasedProgression({ peso: 80, volumen: 950, rirLogrado: 0, state });
      state = r.newState;
      r = applyRuleBasedProgression({ peso: 80, volumen: 900, rirLogrado: 1, state });
      state = r.newState;
      r = applyRuleBasedProgression({ peso: 80, volumen: 850, rirLogrado: 0, state });

      expect(r.ruleApplied).toBe('bajar_peso_rir_alto');
      expect(r.newWeight).toBe(75);
      expect(r.note).toContain('cerca del fallo');
    });

    it('prioriza fatiga real (bajar_peso_rir_alto) sobre regresión simple cuando ambas condiciones se cumplen a la vez', () => {
      // RIR bajo + volumen cayendo cumple AMBAS condiciones simultáneamente en
      // cada sesión, así que ambas rachas llegan a 3 al mismo tiempo. La regla
      // más específica (fatiga real) debe ganar, no la genérica.
      let state: RuleProgressionState = { ultimoVolumen: 1000 };
      let r = applyRuleBasedProgression({ peso: 80, volumen: 950, rirLogrado: 0, state });
      state = r.newState;
      r = applyRuleBasedProgression({ peso: 80, volumen: 900, rirLogrado: 0, state });
      state = r.newState;
      r = applyRuleBasedProgression({ peso: 80, volumen: 850, rirLogrado: 0, state });

      expect(r.ruleApplied).toBe('bajar_peso_rir_alto');
    });
  });

  it('caso de uso completo: sube, luego 3 sesiones de regresión bajan el peso otra vez', () => {
    let state: RuleProgressionState = { ultimoVolumen: 700 };
    let r;
    for (const vol of [760, 800, 820]) {
      r = applyRuleBasedProgression({ peso: 80, volumen: vol, rirLogrado: 4, state });
      state = r.newState;
    }
    expect(r!.ruleApplied).toBe('subir_peso_reps');
    const pesoSubido = r!.newWeight!;
    expect(pesoSubido).toBeGreaterThan(80);

    // Ahora, con el peso nuevo, 3 sesiones de volumen cayendo
    for (const vol of [780, 750, 720]) {
      r = applyRuleBasedProgression({ peso: pesoSubido, volumen: vol, rirLogrado: 2, state });
      state = r.newState;
    }
    expect(r!.ruleApplied).toBe('bajar_peso_regresion');
    expect(r!.newWeight!).toBeLessThan(pesoSubido);
  });
});
