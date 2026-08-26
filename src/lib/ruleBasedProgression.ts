/**
 * Motor de progresión por reglas fijas (Evolution Lab).
 *
 * Migración de reglas de `overload.ts` (que hoy solo generan notificaciones
 * pasivas) a un motor que SÍ escribe el plan directamente, espejando el
 * patrón ya probado en `periodizationEngine.ts` para el motor de RIR/1RM:
 * estado incremental persistido sesión a sesión (no se re-consulta el
 * historial completo cada vez).
 *
 * Reglas migradas (9 de 17 — ver el resto en el bloque "Reglas NO migradas"
 * al final de este archivo):
 * - descanso_excesivo          → volviste tras un corte largo → baja peso (prioridad máxima).
 * - deload_sugerido            → muchas semanas seguidas sin cortes → baja peso y series (descarga).
 * - bajar_peso_rir_alto        → RIR muy bajo (cerca del fallo) Y volumen cayendo a la vez → baja peso.
 * - bajar_peso_regresion       → volumen cayendo varias sesiones seguidas → baja peso.
 * - subir_peso_reps_objetivo   → llegaste a un objetivo de reps concreto en suficientes series → sube peso.
 * - subir_peso_reps            → RIR alto (poco esfuerzo real) varias sesiones seguidas → sube peso.
 * - subir_reps_antes_peso      → volumen creciendo sostenido, sin llegar al objetivo de reps aún → suma 1 rep antes de tocar el peso.
 * - autocarga_subir_reps       → mismo criterio que subir_peso_reps pero para ejercicios sin peso externo (peso === 0) → suma reps en vez de peso.
 * - autocarga_descanso_densidad → descanso REAL alto varias sesiones seguidas (autocarga) → reduce el descanso prescrito.
 *
 * autocarga_subir_reps y autocarga_descanso_densidad afectan campos
 * distintos (reps_objetivo vs descanso) y pueden disparar juntas en la
 * misma sesión sin conflicto — no forman parte de la cadena de prioridad
 * de abajo, que es exclusiva de los ejercicios con peso externo.
 *
 * Prioridad cuando más de una condición se cumple a la vez en la misma
 * sesión (de mayor a menor):
 *   1. descanso_excesivo   (corta la evaluación del resto — igual que el original)
 *   2. deload_sugerido     (señal estructural, no compite con ajustes finos)
 *   3. bajar_peso_rir_alto
 *   4. bajar_peso_regresion
 *   5. subir_peso_reps_objetivo
 *   6. subir_peso_reps
 *   7. subir_reps_antes_peso
 * Nunca se sube peso/reps en el mismo ciclo en que también hay señal de
 * sobreentrenamiento o de un corte largo.
 *
 * Diferencia deliberada con `overload.ts`: en vez de promediar sobre una
 * ventana de sesiones ya ocurridas (requiere volver a leer todo el
 * historial), esta versión usa rachas (streaks) y fechas que se actualizan
 * sesión a sesión — el mismo criterio en espíritu, sin necesitar una
 * consulta adicional a la base de datos al cerrar el entrenamiento.
 */

import { Rule, RuleProgressionState } from '../types/database.types';
import { DEFAULT_RULES } from './rules';

export type { RuleProgressionState };

export interface RuleProgressionInput {
  /** Peso de trabajo (kg) de la sesión recién loggeada para este ejercicio. 0 = autocarga. */
  peso: number;
  /** Repeticiones de cada serie completada en esta sesión (para volumen y para validar objetivos de reps por serie). */
  repsArray: number[];
  /** RIR reportado por el atleta en esta sesión, o null si no se reportó. */
  rirLogrado: number | null;
  /** Estado incremental previo (viene de config.ruleProgressionState[normName]). */
  state: RuleProgressionState;
  /** Fecha ISO (yyyy-mm-dd) de esta sesión. Sin esto, 'descanso_excesivo' y 'deload_sugerido' no se evalúan. */
  fecha?: string;
  /** Descanso REAL medido entre series (segundos, promedio de la sesión) — no el prescrito por el plan. Sin esto, 'autocarga_descanso_densidad' no se evalúa. */
  descansoReal?: number;
  /** Objetivo de reps específico para este ejercicio. Si no se provee, se usa la primera reps de la sesión como objetivo implícito. */
  repsObjetivo?: number;
  /** Reglas a evaluar — por defecto las de rules.ts. */
  rules?: Rule[];
}

export type RuleProgressionApplied =
  | 'descanso_excesivo'
  | 'deload_sugerido'
  | 'bajar_peso_rir_alto'
  | 'bajar_peso_regresion'
  | 'subir_peso_reps_objetivo'
  | 'subir_peso_reps'
  | 'subir_reps_antes_peso'
  | 'autocarga_subir_reps'
  | 'autocarga_descanso_densidad'
  | null;

export interface RuleProgressionResult {
  /** Nuevo peso a escribir en el plan, o null si esta sesión no dispara ningún cambio de peso. */
  newWeight: number | null;
  /** Nuevo objetivo de reps a escribir (variables['reps_objetivo']), o null si no cambia. */
  newRepsObjetivo: number | null;
  /** Nuevas series de trabajo a escribir (solo lo usa deload_sugerido), o null si no cambia. */
  newSeries: number | null;
  /** Nuevo descanso (segundos) a escribir (solo lo usa autocarga_descanso_densidad), o null si no cambia. */
  newDescanso: number | null;
  /** Nota explicativa para progression_notes, o null si no hubo cambio. */
  note: string | null;
  /** Estado a persistir en config.ruleProgressionState[normName] para la próxima sesión. */
  newState: RuleProgressionState;
  /** Qué regla, si alguna, se aplicó. */
  ruleApplied: RuleProgressionApplied;
}

const redondearPeso = (kg: number, incremento = 2.5): number =>
  Math.round(kg / incremento) * incremento;

const findRule = (rules: Rule[], id: string): Rule | undefined =>
  rules.find(r => r.id === id);

const diasEntreFechas = (desde: string, hasta: string): number => {
  const d0 = new Date(desde + 'T00:00:00Z').getTime();
  const d1 = new Date(hasta + 'T00:00:00Z').getTime();
  return Math.round((d1 - d0) / (1000 * 60 * 60 * 24));
};

const sinCambios = (state: RuleProgressionState): RuleProgressionResult => ({
  newWeight: null,
  newRepsObjetivo: null,
  newSeries: null,
  newDescanso: null,
  note: null,
  newState: state,
  ruleApplied: null,
});

/**
 * Evalúa las reglas migradas para UNA sesión de UN ejercicio y decide si
 * corresponde ajustar peso, reps o series — actualizando también el estado
 * incremental (rachas y fechas) que la próxima sesión va a necesitar.
 */
export function applyRuleBasedProgression(
  input: RuleProgressionInput
): RuleProgressionResult {
  const { peso, repsArray, rirLogrado, rules = DEFAULT_RULES, fecha, descansoReal } = input;
  const prevState = input.state || {};
  const volumen = peso * repsArray.reduce((a, b) => a + b, 0);
  const esAutocarga = peso <= 0;

  // ── 1. Descanso excesivo (máxima prioridad — corta la evaluación del resto,
  //    igual que en overload.ts) ──────────────────────────────────────────
  if (!esAutocarga && fecha && prevState.ultimaFecha) {
    const rDescansoEx = findRule(rules, 'descanso_excesivo');
    const diasDesdeUltima = diasEntreFechas(prevState.ultimaFecha, fecha);
    const diasUmbral = 14; // mismo default que OverloadConfig.diasDescansoExcesivo
    if (rDescansoEx?.activa && diasDesdeUltima > diasUmbral) {
      const redPct = rDescansoEx.reduccion_porciento ?? 10;
      const newWeight = redondearPeso(peso * (1 - redPct / 100));
      return {
        newWeight,
        newRepsObjetivo: null,
        newSeries: null,
        newDescanso: null,
        note: `⚡ Peso ajustado a ${newWeight} kg — volviste tras ${diasDesdeUltima} días sin entrenar este ejercicio. Retomamos con menos carga para restaurar la memoria motora.`,
        newState: {
          ultimoVolumen: volumen,
          ultimaFecha: fecha,
          deloadStreakInicio: fecha, // un corte largo reinicia también la racha de deload
        },
        ruleApplied: 'descanso_excesivo',
      };
    }
  }

  // ── 2. Deload sugerido (racha de entrenamiento sin cortes largos) ──────
  let deloadStreakInicio = prevState.deloadStreakInicio;
  if (fecha) {
    if (!deloadStreakInicio) {
      deloadStreakInicio = fecha;
    } else if (prevState.ultimaFecha) {
      const gap = diasEntreFechas(prevState.ultimaFecha, fecha);
      if (gap > 14) deloadStreakInicio = fecha; // el corte reinicia la racha
    }

    const rDeload = findRule(rules, 'deload_sugerido');
    if (rDeload?.activa && deloadStreakInicio) {
      const semanasConsecutivas = Math.floor(diasEntreFechas(deloadStreakInicio, fecha) / 7);
      const semanasUmbral = rDeload.semanas_consecutivas ?? 6;
      if (semanasConsecutivas >= semanasUmbral) {
        const newWeight = peso > 0 ? redondearPeso(peso * 0.6) : null; // -40%
        const currentSeries = repsArray.length || 3;
        return {
          newWeight,
          newRepsObjetivo: null,
          newSeries: Math.max(1, Math.round(currentSeries * 0.6)),
          newDescanso: null,
          note: `💤 Descarga sugerida — llevas ${semanasConsecutivas} semanas seguidas entrenando este ejercicio sin cortes. Reducimos volumen y peso ~40% esta semana para disipar fatiga.`,
          newState: {
            ...prevState,
            ultimoVolumen: volumen,
            ultimaFecha: fecha,
            deloadStreakInicio: fecha, // se reinicia la racha tras aplicar la descarga
          },
          ruleApplied: 'deload_sugerido',
        };
      }
    }
  }

  // A partir de acá, ejercicios de autocarga siguen un camino aparte (reps y
  // descanso, no peso). autocarga_subir_reps y autocarga_descanso_densidad
  // afectan campos distintos (reps_objetivo vs descanso) y no compiten entre
  // sí — ambas pueden disparar en la misma sesión si corresponde.
  if (esAutocarga) {
    const rAutocarga = findRule(rules, 'autocarga_subir_reps');
    const rirUmbral = rAutocarga?.rir_umbral ?? 3;
    const streakRirNecesario = rAutocarga?.sesiones_consecutivas ?? 2;

    const rDescansoDensidad = findRule(rules, 'autocarga_descanso_densidad');
    const descansoUmbral = rDescansoDensidad?.umbral_descanso_alto ?? 90;
    const streakDescansoNecesario = rDescansoDensidad?.sesiones_consecutivas ?? 2;

    const autocargaRirAltoStreak = rirLogrado !== null && rirLogrado >= rirUmbral
      ? (prevState.autocargaRirAltoStreak ?? 0) + 1
      : (rirLogrado !== null ? 0 : (prevState.autocargaRirAltoStreak ?? 0));

    const descansoAltoStreak = descansoReal !== undefined
      ? (descansoReal >= descansoUmbral ? (prevState.descansoAltoStreak ?? 0) + 1 : 0)
      : (prevState.descansoAltoStreak ?? 0);

    let newState: RuleProgressionState = {
      ultimoVolumen: volumen,
      ultimaFecha: fecha ?? prevState.ultimaFecha,
      deloadStreakInicio,
      autocargaRirAltoStreak,
      descansoAltoStreak,
    };

    let newRepsObjetivo: number | null = null;
    let newDescanso: number | null = null;
    const notas: string[] = [];
    let ruleApplied: RuleProgressionApplied = null;

    if (rAutocarga?.activa && rirLogrado !== null && autocargaRirAltoStreak >= streakRirNecesario) {
      const maxRepsActual = Math.max(...repsArray, 0);
      newRepsObjetivo = maxRepsActual + 1;
      notas.push(`🤸 Reps objetivo ajustadas a ${maxRepsActual + 1} — mantuviste RIR alto varias sesiones seguidas en este ejercicio de autocarga.`);
      newState = { ...newState, autocargaRirAltoStreak: 0 };
      ruleApplied = 'autocarga_subir_reps';
    }

    if (rDescansoDensidad?.activa && descansoReal !== undefined && descansoAltoStreak >= streakDescansoNecesario) {
      newDescanso = Math.max(45, Math.round(descansoReal - 15));
      notas.push(`⏱️ Descanso ajustado a ${newDescanso}s — venías descansando ${Math.round(descansoReal)}s en promedio varias sesiones seguidas; con más densidad podés seguir progresando.`);
      newState = { ...newState, descansoAltoStreak: 0 };
      if (!ruleApplied) ruleApplied = 'autocarga_descanso_densidad';
    }

    if (newRepsObjetivo != null || newDescanso != null) {
      return {
        newWeight: null,
        newRepsObjetivo,
        newSeries: null,
        newDescanso,
        note: notas.join(' ') || null,
        newState,
        ruleApplied,
      };
    }

    return sinCambios(newState);
  }

  // Primera sesión bajo este sistema (o sin RIR reportado): no hay con qué
  // comparar tendencia todavía. Se guarda como línea base y se espera a la
  // próxima sesión.
  if (prevState.ultimoVolumen === undefined || rirLogrado === null) {
    return sinCambios({
      ...prevState,
      ultimoVolumen: volumen,
      ultimaFecha: fecha ?? prevState.ultimaFecha,
      deloadStreakInicio,
    });
  }

  const volumenCayo = volumen < prevState.ultimoVolumen;

  const rSubir      = findRule(rules, 'subir_peso_reps');
  const rBajarRir    = findRule(rules, 'bajar_peso_rir_alto');
  const rBajarReg    = findRule(rules, 'bajar_peso_regresion');
  const rRepsObj     = findRule(rules, 'subir_peso_reps_objetivo');
  const rRepsAntes   = findRule(rules, 'subir_reps_antes_peso');

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

  // subir_peso_reps_objetivo: ¿suficientes series llegaron al objetivo de reps?
  const repsObjetivo = input.repsObjetivo ?? repsArray[0] ?? 10;
  const seriesMinPct = rRepsObj?.series_minimas_pct ?? 75;
  const seriesNecesarias = Math.ceil((repsArray.length * seriesMinPct) / 100);
  const seriesCumplen = repsArray.filter(r => r >= repsObjetivo).length;
  const estaSesionCumpleObjetivo = repsArray.length > 0 && seriesCumplen >= seriesNecesarias;
  const repsObjetivoStreak = estaSesionCumpleObjetivo
    ? (prevState.repsObjetivoStreak ?? 0) + 1
    : 0;

  // subir_reps_antes_peso: crecimiento de volumen sostenido (sin llegar aún
  // al objetivo de reps que dispararía subir_peso_reps_objetivo).
  const crecimientoPct = prevState.ultimoVolumen > 0
    ? ((volumen - prevState.ultimoVolumen) / prevState.ultimoVolumen) * 100
    : 0;
  const umbralCrecimiento = rRepsAntes?.umbral_crecimiento_vol ?? 8;
  const volumenCrecioStreak = crecimientoPct >= umbralCrecimiento
    ? (prevState.volumenCrecioStreak ?? 0) + 1
    : 0;

  const baseNewState: RuleProgressionState = {
    ultimoVolumen: volumen,
    ultimaFecha: fecha ?? prevState.ultimaFecha,
    deloadStreakInicio,
    rirAltoStreak,
    rirBajoRegresionStreak,
    regresionStreak,
    repsObjetivoStreak,
    volumenCrecioStreak,
  };

  // 3) Bajar por fatiga real: RIR muy bajo Y volumen cayendo, sostenido.
  if (rBajarRir?.activa && rirBajoRegresionStreak >= (rBajarRir.sesiones_consecutivas ?? 3)) {
    const redPct = rBajarRir.reduccion_porciento ?? 7;
    const newWeight = redondearPeso(peso * (1 - redPct / 100));
    return {
      newWeight,
      newRepsObjetivo: null,
      newSeries: null,
      newDescanso: null,
      note: `📉 Peso ajustado a ${newWeight} kg — tu RIR se mantuvo muy bajo (cerca del fallo) mientras tu volumen caía varias sesiones seguidas. Se prioriza recuperación antes de seguir cargando.`,
      newState: { ...baseNewState, rirBajoRegresionStreak: 0, regresionStreak: 0 },
      ruleApplied: 'bajar_peso_rir_alto',
    };
  }

  // 4) Bajar por regresión simple: volumen cayendo, sin importar el RIR.
  if (rBajarReg?.activa && regresionStreak >= 3) {
    const redPct = rBajarReg.reduccion_porciento ?? 7;
    const newWeight = redondearPeso(peso * (1 - redPct / 100));
    return {
      newWeight,
      newRepsObjetivo: null,
      newSeries: null,
      newDescanso: null,
      note: `📉 Peso ajustado a ${newWeight} kg — tu volumen viene cayendo varias sesiones seguidas en este ejercicio.`,
      newState: { ...baseNewState, regresionStreak: 0 },
      ruleApplied: 'bajar_peso_regresion',
    };
  }

  // 5) Subir por objetivo de reps concreto alcanzado (más específico que el RIR genérico).
  if (rRepsObj?.activa && repsObjetivoStreak >= (rRepsObj.sesiones_consecutivas ?? 2)) {
    const incPct = rRepsObj.incremento_porciento ?? 5;
    const incKg  = Math.max(rRepsObj.incremento_minimo_kg ?? 2.5, peso * (incPct / 100));
    const newWeight = redondearPeso(peso + incKg);
    return {
      newWeight,
      newRepsObjetivo: null,
      newSeries: null,
      newDescanso: null,
      note: `🚀 Peso ajustado a ${newWeight} kg — llegaste a ${repsObjetivo} reps en suficientes series varias sesiones seguidas.`,
      newState: { ...baseNewState, repsObjetivoStreak: 0 },
      ruleApplied: 'subir_peso_reps_objetivo',
    };
  }

  // 6) Subir: RIR alto (esfuerzo real bajo) sostenido, sin señal de regresión.
  if (rSubir?.activa && rirAltoStreak >= (rSubir.sesiones_consecutivas ?? 3)) {
    const incPct = rSubir.incremento_porciento ?? 5;
    const incKg  = Math.max(rSubir.incremento_minimo_kg ?? 2.5, peso * (incPct / 100));
    const newWeight = redondearPeso(peso + incKg);
    return {
      newWeight,
      newRepsObjetivo: null,
      newSeries: null,
      newDescanso: null,
      note: `📈 Peso ajustado a ${newWeight} kg — tuviste margen de esfuerzo real (RIR alto) varias sesiones seguidas en este ejercicio.`,
      newState: { ...baseNewState, rirAltoStreak: 0 },
      ruleApplied: 'subir_peso_reps',
    };
  }

  // 7) Volumen creciendo sostenido, pero sin llegar aún al objetivo de reps:
  //    sumar 1 rep antes de tocar el peso.
  if (rRepsAntes?.activa && volumenCrecioStreak >= (rRepsAntes.sesiones_consecutivas ?? 2)) {
    const maxRepsActual = Math.max(...repsArray, 0);
    return {
      newWeight: null,
      newRepsObjetivo: maxRepsActual + 1,
      newSeries: null,
      newDescanso: null,
      note: `🎯 Reps objetivo ajustadas a ${maxRepsActual + 1} — tu volumen viene creciendo varias sesiones seguidas en este ejercicio. Consolidamos con más reps antes de subir peso.`,
      newState: { ...baseNewState, volumenCrecioStreak: 0 },
      ruleApplied: 'subir_reps_antes_peso',
    };
  }

  return sinCambios(baseNewState);
}

/**
 * Reglas NO migradas en esta vuelta, y por qué:
 *
 * - mantener_peso: no tiene un objetivo numérico que escribir — es
 *   inherentemente "no cambiar nada", que ya es el resultado por defecto
 *   cuando ninguna otra regla dispara. No necesita mutación propia.
 * - descanso_largo: tipo:'info' en rules.ts (a diferencia de las demás
 *   reglas de descanso que sí son tipo:'descanso'/'bajar') — el propio
 *   dato ya la marca como puramente informativa, no una acción a aplicar.
 * - estancamiento / autocarga_evolucion_mecanica: recomiendan CAMBIAR de
 *   ejercicio o variante — no hay ningún campo numérico que ajustar; es una
 *   decisión de coaching, no un ajuste de carga. Quedan como notificación.
 * - racha_positiva / record_personal / primer_sesion / autocarga_tut_tiempo:
 *   puramente informativas/motivacionales, sin objetivo numérico propio.
 */
