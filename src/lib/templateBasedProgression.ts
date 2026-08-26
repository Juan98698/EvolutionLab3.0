/**
 * Motor de progresión por plantilla determinística (Evolution Lab).
 *
 * A diferencia de `ruleBasedProgression.ts` (que dispara según tendencias de
 * varias sesiones — rachas de RIR, volumen, etc.), estas dos plantillas no
 * dependen de cómo le fue al atleta: aplican un valor fijo según en qué
 * semana del bloque está, sin condición que evaluar.
 *
 * - Ondulante (DUP): alterna semana a semana entre un perfil de fuerza (más
 *   peso, menos reps, RIR bajo) y uno de hipertrofia (menos peso, más reps,
 *   RIR más alto). Semanas impares del bloque = fuerza, pares = hipertrofia.
 *   Es una progresión continua — no expira sola, igual que 'linear'/'double'.
 *
 * - Descarga (deload): a diferencia de las tres anteriores, esto es un
 *   bloque TEMPORAL por diseño (así lo pidió el propio formulario del
 *   modal: "duración en semanas"). Mientras dure, reduce series y sube el
 *   RIR objetivo (menos esfuerzo real); al terminar la duración configurada,
 *   se revierte solo — el ejercicio vuelve al motor de RIR/1RM por default,
 *   sin que el entrenador tenga que acordarse de cambiarlo a mano.
 */

export interface UndulatingParams {
  seriesFuerza?: string;
  repsFuerza?: string;
  rirFuerza?: string;
  seriesHipertrofia?: string;
  repsHipertrofia?: string;
  rirHipertrofia?: string;
}

export interface UndulatingResult {
  series: string;
  repeticiones: string;
  rir: string;
  note: string;
  esFuerza: boolean;
}

/**
 * Decide el perfil (fuerza/hipertrofia) de la semana actual del bloque
 * ondulante. `semanaDelBloque` es 1-indexado (1 = primera semana del bloque).
 */
export function applyUndulatingWeek(
  semanaDelBloque: number,
  params: UndulatingParams
): UndulatingResult {
  const esFuerza = semanaDelBloque % 2 === 1; // semanas impares = fuerza

  if (esFuerza) {
    const series = params.seriesFuerza || '4';
    const repeticiones = params.repsFuerza || '5';
    const rir = params.rirFuerza || '1';
    return {
      series,
      repeticiones,
      rir,
      esFuerza: true,
      note: `💪 Semana ${semanaDelBloque} de tu bloque ondulante — fase de FUERZA (series ${series}, reps ${repeticiones}, RIR ${rir}).`,
    };
  }

  const series = params.seriesHipertrofia || '3';
  const repeticiones = params.repsHipertrofia || '10';
  const rir = params.rirHipertrofia || '2';
  return {
    series,
    repeticiones,
    rir,
    esFuerza: false,
    note: `🏗️ Semana ${semanaDelBloque} de tu bloque ondulante — fase de HIPERTROFIA (series ${series}, reps ${repeticiones}, RIR ${rir}).`,
  };
}

export interface DeloadBlockParams {
  /** Duración del bloque de descarga, en semanas. Default 1 (mismo default que el modal). */
  duracion?: number;
  series?: string;
  rir?: string;
  /** Rango textual (ej. "50-60") — puramente informativo en la nota, no se usa para calcular nada. */
  reduccionVolumen?: string;
  /** Etiqueta cualitativa (ej. "Moderada") — igual, solo para la nota. */
  cargaRecomendada?: string;
}

export interface DeloadBlockResult {
  series: string;
  rir: string;
  /** true si el bloque de descarga sigue vigente esta semana; false si ya terminó (hay que revertir progression_type). */
  vigente: boolean;
  note: string;
}

/**
 * `semanasTranscurridas` = semanas completas desde que se aplicó esta
 * plantilla (0 = la semana en que se aplicó). Cuando iguala o supera
 * `duracion`, el bloque terminó — el llamador debe revertir
 * `progression_type` a undefined para que el ejercicio vuelva al motor RIR.
 */
export function applyDeloadBlock(
  semanasTranscurridas: number,
  params: DeloadBlockParams
): DeloadBlockResult {
  const duracion = params.duracion ?? 1;
  const vigente = semanasTranscurridas < duracion;
  const series = params.series || '2';
  const rir = params.rir || '3-4';

  if (!vigente) {
    return {
      series,
      rir,
      vigente: false,
      note: `✅ Descarga completada — el bloque de ${duracion} semana(s) terminó. Este ejercicio vuelve a tu progresión normal por RIR.`,
    };
  }

  const semanaActualDelBloque = semanasTranscurridas + 1;
  const extra = params.cargaRecomendada ? `, carga ${params.cargaRecomendada.toLowerCase()}` : '';
  return {
    series,
    rir,
    vigente: true,
    note: `💤 Semana ${semanaActualDelBloque} de ${duracion} en descarga — series reducidas a ${series}, RIR objetivo ${rir}${extra}.`,
  };
}
