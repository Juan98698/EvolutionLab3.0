/**
 * Utilidades compartidas para categorización y lógica de ejercicios.
 */

export interface ExerciseBaseLike {
  categoria?: string | null;
  grupo_muscular?: string | null;
  tipo_metrica?: string | null;
  nombre?: string | null;
  [key: string]: any;
}

/**
 * Determina si un ejercicio es de modalidad Funcional / HIIT / Cardio Metabólico.
 * Se usa para aislar el cómputo de sobrecarga progresiva (tonelaje/1RM) y el radar de hipertrofia.
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

  const grupo = (ex.grupo_muscular || '').toLowerCase().trim();
  if (grupo === 'full body' || grupo === 'funcional' || grupo === 'cardio') {
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
