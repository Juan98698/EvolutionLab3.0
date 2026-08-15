/**
 * Utilidades compartidas para categorización y lógica de ejercicios.
 */

export interface ExerciseBaseLike {
  categoria?: string | null;
  grupo_muscular?: string | null;
  grupo?: string | null;
  tipo_metrica?: string | null;
  nombre?: string | null;
  nombre_ejercicio?: string | null;
  [key: string]: any;
}

/**
 * Determina si un ejercicio es de modalidad Funcional / HIIT / Cardio Metabólico.
 * Se usa para aislar el cómputo de sobrecarga progresiva (tonelaje/1RM), el radar de hipertrofia y la UI.
 */
export function isFunctionalExercise(ex: ExerciseBaseLike | null | undefined): boolean {
  if (!ex) return false;
  
  const cat = (ex.categoria || '').toLowerCase().trim();
  if (cat === 'funcional' || cat === 'hiit' || cat === 'cardio') {
    return true;
  }

  const tipoMetrica = (ex.tipo_metrica || '').toLowerCase().trim();
  if (tipoMetrica === 'tiempo' || tipoMetrica === 'reps_tiempo' || tipoMetrica === 'distancia_peso') {
    return true;
  }

  const grupo = (ex.grupo_muscular || ex.grupo || '').toLowerCase().trim();
  if (grupo === 'full body' || grupo === 'funcional' || grupo === 'cardio') {
    return true;
  }

  const nombre = (ex.nombre || ex.nombre_ejercicio || '').toLowerCase().trim();
  if (
    nombre.includes('wall ball') ||
    nombre.includes('burpee') ||
    nombre.includes('battle rope') ||
    nombre.includes('azote de cuerda') ||
    nombre.includes('sled push') ||
    nombre.includes('trineo') ||
    nombre.includes('kettlebell swing')
  ) {
    return true;
  }

  return false;
}

/**
 * Determina si un ejercicio es de Hipertrofia / Fuerza tradicional con peso y repeticiones.
 */
export function isHypertrophyExercise(ex: ExerciseBaseLike | null | undefined): boolean {
  return !isFunctionalExercise(ex);
}

/**
 * Devuelve la etiqueta adaptada para una variable del ejercicio.
 * Si el ejercicio es de tipo funcional/HIIT/metabólico, adapta la etiqueta (ej. "Series" -> "RONDAS / SERIES").
 */
export function getFunctionalVariableLabel(varId: string, originalLabel?: string, isFunc: boolean = false): string {
  const fallbackLabel = originalLabel || varId;
  if (!isFunc) return fallbackLabel;

  const key = (varId || originalLabel || '').toLowerCase().trim();

  if (key.includes('serie') || key.includes('ronda')) {
    return 'RONDAS / SERIES';
  }
  if (key.includes('rep') || key.includes('trabajo')) {
    return 'TIEMPO TRABAJO / REPS';
  }
  if (key.includes('descan') || key.includes('pausa')) {
    return 'TIEMPO DESCANSO';
  }
  if (key.includes('rir') || key.includes('rpe') || key.includes('intensi')) {
    return 'RPE / INTENSIDAD';
  }
  if (key.includes('peso') || key.includes('carga')) {
    return 'CARGA (OPCIONAL)';
  }
  if (key.includes('tempo') || key.includes('estruc') || key.includes('forma')) {
    return 'FORMATO / ESTRUCTURA';
  }

  return fallbackLabel;
}

/**
 * Devuelve el placeholder adaptado para la edición de variables en el planificador.
 */
export function getFunctionalVariablePlaceholder(varId: string, originalPlaceholder?: string, isFunc: boolean = false): string {
  const fallbackPlaceholder = originalPlaceholder || '';
  if (!isFunc) return fallbackPlaceholder;

  const key = (varId || '').toLowerCase().trim();

  if (key.includes('serie') || key.includes('ronda')) {
    return 'Ej. 4 rondas';
  }
  if (key.includes('rep') || key.includes('trabajo')) {
    return 'Ej. 40s / 15 reps';
  }
  if (key.includes('descan') || key.includes('pausa')) {
    return 'Ej. 20s / 1 min';
  }
  if (key.includes('rir') || key.includes('rpe') || key.includes('intensi')) {
    return 'Ej. RPE 8-9';
  }
  if (key.includes('peso') || key.includes('carga')) {
    return 'Ej. 16 kg / Corporal';
  }
  if (key.includes('tempo') || key.includes('estruc') || key.includes('forma')) {
    return "Ej. AMRAP 12', EMOM";
  }

  return fallbackPlaceholder;
}
