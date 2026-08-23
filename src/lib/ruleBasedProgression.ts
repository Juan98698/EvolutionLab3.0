/**
 * Motor de progresión por reglas fijas (Evolution Lab).
 *
 * Migración de 3 de las 17 reglas de `overload.ts` (que hoy solo generan
 * notificaciones pasivas) a un motor que SÍ escribe el plan directamente,
 * espejando el patrón ya probado en `periodizationEngine.ts` para el motor
 * de RIR/1RM: estado incremental persistido sesión a sesión (no se
 * re-consulta el historial completo cada vez).
 *
 * Reglas migradas en esta primera vuelta:
 * - subir_peso_reps       → RIR alto (poco esfuerzo real) varias sesiones seguidas → sube peso.
 * - bajar_peso_rir_alto   → RIR muy bajo (cerca del fallo) Y volumen cayendo a la vez → baja peso (fatiga real).
 * - bajar_peso_regresion  → volumen cayendo varias sesiones seguidas, sin importar el RIR → baja peso.
 *
 * Diferencia deliberada con `overload.ts`: en vez de promediar RIR sobre una
 * ventana de sesiones ya ocurridas (requiere volver a leer todo el
 * historial), esta versión usa una racha (streak) que se incrementa o
 * resetea sesión a sesión — el mismo criterio en espíritu, pero sin
 * necesitar una consulta adicional a la base de datos en el momento de
 * cerrar el entrenamiento.
 *
 * Prioridad cuando más de una condición se cumple a la vez en la misma
 * sesión: bajar por fatiga real > bajar por regresión simple > subir.
 * Nunca se sube peso en el mismo ciclo en que también hay señal de
 * sobreentrenamiento.
 */

import { Rule, RuleProgressionState } from '../types/database.types';
import { DEFAULT_RULES } from './rules';

export type { RuleProgressionState };

export interface RuleProgressionInput {
  /** Peso de trabajo (kg) de la sesión recién loggeada para este ejercicio. */
  peso: number;
  /** Volumen total (peso × reps totales) de la sesión recién loggeada. */
  volumen: number;
  /** RIR reportado por el atleta en esta sesión, o null si no se reportó. */
  rirLogrado: number | null;
  /** Estado incremental previo (viene de config.ruleProgressionState[normName]). */
  state: RuleProgressionState;
  /** Reglas a evaluar — por defecto las de rules.ts, pero el plan puede traer overrides (trackerRules). */
  rules?: Rule[];
}

export type RuleProgressionApplied =
  | 'subir_peso_reps'
  | 'bajar_peso_rir_alto'
  | 'bajar_peso_regresion'
  | null;

export interface RuleProgressionResult {
  /** Nuevo peso a escribir en el plan, o null si esta sesión no dispara ningún cambio. */
  newWeight: number | null;
  /** Nota explicativa para progression_notes, o null si no hubo cambio. */
  note: string | null;
  /** Estado a persistir en config.ruleProgressionState[normName] para la próxima sesión. */
  newState: RuleProgressionState;
  /** Qué regla, si alguna, se aplicó — útil para tests y para no aplicar dos reglas a la vez. */
  ruleApplied: RuleProgressionApplied;
}

const redondearPeso = (kg: number, incremento = 2.5): number =>
  Math.round(kg / incremento) * incremento;

const findRule = (rules: Rule[], id: string): Rule | undefined =>
  rules.find(r => r.id === id);

/**
 * Evalúa las 3 reglas migradas para UNA sesión de UN ejercicio y decide si
 * corresponde ajustar el peso, actualizando también el estado incremental
 * (rachas) que la próxima sesión va a necesitar para seguir evaluando.
 */
export function applyRuleBasedProgression(
  input: RuleProgressionInput
): RuleProgressionResult {
  const { peso, volumen, rirLogrado, rules = DEFAULT_RULES } = input;
  const prevState = input.state || {};

  // Autocarga (peso 0, ej. dominadas/fondos sin lastre) no aplica: estas 3
  // reglas están calibradas para peso externo. Solo se actualiza el volumen
  // de referencia para no perder continuidad si el ejercicio cambia a carga
  // externa más adelante.
  if (peso <= 0) {
    return {
      newWeight: null,
      note: null,
      newState: { ...prevState, ultimoVolumen: volumen },
      ruleApplied: null,
    };
  }

  // Primera sesión bajo este sistema (o sin RIR reportado): no hay con qué
  // comparar tendencia todavía. Se guarda como línea base y se espera a la
  // próxima sesión.
  if (prevState.ultimoVolumen === undefined || rirLogrado === null) {
    return {
      newWeight: null,
      note: null,
      newState: { ...prevState, ultimoVolumen: volumen },
      ruleApplied: null,
    };
  }

  const volumenCayo = volumen < prevState.ultimoVolumen;

  const rSubir     = findRule(rules, 'subir_peso_reps');
  const rBajarRir  = findRule(rules, 'bajar_peso_rir_alto');
  const rBajarReg  = findRule(rules, 'bajar_peso_regresion');

  const rirAltoUmbral = rSubir?.rir_umbral ?? 3;
  const rirAltoStreak = rirLogrado >= rirAltoUmbral && !volumenCayo
    ? (prevState.rirAltoStreak ?? 0) + 1
    : 0;

  const rirBajoUmbral = rBajarRir?.rir_umbral_bajo ?? 1;
  const rirBajoRegresionStreak = rirLogrado <= rirBajoUmbral && volumenCayo
    ? (prevState.rirBajoRegresionStreak ?? 0) + 1
    : 0;

  const regresionStreak = volumenCayo
    ? (prevState.regresionStreak ?? 0) + 1
    : 0;

  const baseNewState: RuleProgressionState = {
    ultimoVolumen: volumen,
    rirAltoStreak,
    rirBajoRegresionStreak,
    regresionStreak,
  };

  // 1) Bajar por fatiga real: RIR muy bajo Y volumen cayendo, sostenido.
  if (
    rBajarRir?.activa &&
    rirBajoRegresionStreak >= (rBajarRir.sesiones_consecutivas ?? 3)
  ) {
    const redPct = rBajarRir.reduccion_porciento ?? 7;
    const newWeight = redondearPeso(peso * (1 - redPct / 100));
    return {
      newWeight,
      note: `📉 Peso ajustado a ${newWeight} kg — tu RIR se mantuvo muy bajo (cerca del fallo) mientras tu volumen caía varias sesiones seguidas. Se prioriza recuperación antes de seguir cargando.`,
      newState: { ...baseNewState, rirBajoRegresionStreak: 0, regresionStreak: 0 },
      ruleApplied: 'bajar_peso_rir_alto',
    };
  }

  // 2) Bajar por regresión simple: volumen cayendo, sin importar el RIR.
  if (
    rBajarReg?.activa &&
    regresionStreak >= (rBajarReg.sesiones_consecutivas ?? 3)
  ) {
    const redPct = rBajarReg.reduccion_porciento ?? 7;
    const newWeight = redondearPeso(peso * (1 - redPct / 100));
    return {
      newWeight,
      note: `📉 Peso ajustado a ${newWeight} kg — tu volumen viene cayendo varias sesiones seguidas en este ejercicio.`,
      newState: { ...baseNewState, regresionStreak: 0 },
      ruleApplied: 'bajar_peso_regresion',
    };
  }

  // 3) Subir: RIR alto (esfuerzo real bajo) sostenido, sin señal de regresión.
  if (
    rSubir?.activa &&
    rirAltoStreak >= (rSubir.sesiones_consecutivas ?? 3)
  ) {
    const incPct = rSubir.incremento_porciento ?? 5;
    const incKg  = Math.max(rSubir.incremento_minimo_kg ?? 2.5, peso * (incPct / 100));
    const newWeight = redondearPeso(peso + incKg);
    return {
      newWeight,
      note: `📈 Peso ajustado a ${newWeight} kg — tuviste margen de esfuerzo real (RIR alto) varias sesiones seguidas en este ejercicio.`,
      newState: { ...baseNewState, rirAltoStreak: 0 },
      ruleApplied: 'subir_peso_reps',
    };
  }

  return { newWeight: null, note: null, newState: baseNewState, ruleApplied: null };
}
