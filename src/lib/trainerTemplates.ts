import { supabase } from './supabaseClient';
import { TrainerTemplate, TrainingDay, Exercise, GlobalVariable, PeriodizationConfig } from '../types/database.types';
import { recalculatePlanWeights } from './periodizationEngine';

/**
 * Genera un ID corto seguro
 */
const generateShortId = (): string => Math.random().toString(36).substring(2, 11);

/**
 * Sanitiza los días de entrenamiento para una plantilla:
 * Limpia los pesos absolutos en kg (específicos de un atleta),
 * pero MANTIENE intactos los ejercicios, GIFs, imágenes, videos de Google Drive/YouTube,
 * descripciones y variables prescritas (series, reps, RIR, tempo, descanso).
 */
export function sanitizePlanDaysForTemplate(days: TrainingDay[]): TrainingDay[] {
  return days.map(day => ({
    ...day,
    exercises: (day.exercises || []).map(ex => {
      const sanitizedVariables = { ...(ex.variables || {}) };
      // Limpiar pesos específicos
      delete sanitizedVariables['peso'];
      delete sanitizedVariables['peso_sugerido'];
      delete sanitizedVariables['carga'];

      return {
        ...ex,
        variables: sanitizedVariables,
        // Preservar estrictamente toda la multimedia
        image_url: ex.image_url || '',
        gif_url: ex.gif_url || '',
        video_url: ex.video_url || '',
        description: ex.description || ''
      } as Exercise;
    })
  }));
}

/**
 * Obtiene la clave de LocalStorage para las plantillas en caché
 */
function getLocalStorageKey(trainerId: string): string {
  return `evolution_trainer_templates_${trainerId || 'default'}`;
}

/**
 * Lee la lista de plantillas desde LocalStorage
 */
export function getLocalTemplates(trainerId: string): TrainerTemplate[] {
  try {
    const raw = localStorage.getItem(getLocalStorageKey(trainerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[TrainerTemplates] Error al leer plantillas locales:', err);
    return [];
  }
}

/**
 * Guarda la lista de plantillas en LocalStorage (Caché Offline)
 */
export function saveLocalTemplates(trainerId: string, templates: TrainerTemplate[]): void {
  try {
    localStorage.setItem(getLocalStorageKey(trainerId), JSON.stringify(templates));
  } catch (err) {
    console.warn('[TrainerTemplates] Error al guardar en caché local:', err);
  }
}

/**
 * Obtiene las plantillas creadas por el entrenador (de Supabase con fallback offline a LocalStorage)
 */
export async function getTrainerTemplates(trainerId: string): Promise<TrainerTemplate[]> {
  const localList = getLocalTemplates(trainerId);

  if (!trainerId || trainerId === 'default') {
    return localList;
  }

  try {
    const fetchRemote = async () => {
      const { data, error } = await supabase
        .from('plantillas_entrenador')
        .select('*')
        .eq('trainer_id', trainerId)
        .order('updated_at', { ascending: false });
      return { data, error };
    };

    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>(resolve =>
      setTimeout(() => resolve({ data: null, error: { message: 'Timeout de red (1.5s)' } }), 1500)
    );

    const { data, error } = await Promise.race([fetchRemote(), timeoutPromise]);

    if (error) {
      console.warn('[TrainerTemplates] Error en consulta de Supabase, usando caché local:', error.message);
      return localList;
    }

    if (Array.isArray(data)) {
      const remoteTemplates = data as TrainerTemplate[];
      // Sincronizar en caché local
      saveLocalTemplates(trainerId, remoteTemplates);
      return remoteTemplates;
    }

    return localList;
  } catch (err) {
    console.warn('[TrainerTemplates] Fallo en la red de Supabase, usando respaldo offline:', err);
    return localList;
  }
}

/**
 * Guarda una nueva plantilla o actualiza una existente
 */
export async function saveTrainerTemplate(
  params: {
    id?: string;
    trainer_id: string;
    nombre: string;
    descripcion?: string | null;
    objetivo: 'hipertrofia' | 'fuerza' | 'perdida_grasa' | 'mantenimiento' | 'salud';
    nivel_atleta: 'principiante' | 'intermedio' | 'avanzado';
    dias_semana: number;
    trainingDays: TrainingDay[];
    weeklyTargets?: Record<string, number>;
    globalVariables?: GlobalVariable[];
    periodizationConfig?: Partial<PeriodizationConfig>;
  }
): Promise<TrainerTemplate> {
  const now = new Date().toISOString();
  const sanitizedDays = sanitizePlanDaysForTemplate(params.trainingDays);
  const templateId = params.id || `tpl_${generateShortId()}_${Date.now()}`;

  const templatePayload: TrainerTemplate = {
    id: templateId,
    trainer_id: params.trainer_id,
    nombre: params.nombre.trim(),
    descripcion: params.descripcion ? params.descripcion.trim() : null,
    objetivo: params.objetivo,
    nivel_atleta: params.nivel_atleta,
    dias_semana: params.dias_semana,
    plan_data: {
      trainingDays: sanitizedDays,
      weeklyTargets: params.weeklyTargets || {},
      globalVariables: params.globalVariables || [],
      periodizationConfig: params.periodizationConfig || {}
    },
    created_at: now,
    updated_at: now
  };

  // 1. Actualizar caché local primero (inmediato)
  const currentLocal = getLocalTemplates(params.trainer_id);
  const index = currentLocal.findIndex(t => t.id === templateId);
  let updatedLocal: TrainerTemplate[];
  if (index >= 0) {
    updatedLocal = [...currentLocal];
    updatedLocal[index] = { ...templatePayload, created_at: currentLocal[index].created_at || now };
  } else {
    updatedLocal = [templatePayload, ...currentLocal];
  }
  saveLocalTemplates(params.trainer_id, updatedLocal);

  // 2. Persistir en Supabase DB si hay conexión
  if (params.trainer_id && params.trainer_id !== 'default') {
    let data: TrainerTemplate | null = null;
    let error: { code?: string; message?: string; details?: string; hint?: string } | null = null;

    try {
      const response = await supabase
        .from('plantillas_entrenador')
        .upsert({
          id: templatePayload.id,
          trainer_id: templatePayload.trainer_id,
          nombre: templatePayload.nombre,
          descripcion: templatePayload.descripcion,
          objetivo: templatePayload.objetivo,
          nivel_atleta: templatePayload.nivel_atleta,
          dias_semana: templatePayload.dias_semana,
          plan_data: templatePayload.plan_data,
          updated_at: now
        })
        .select()
        .single();
      data = response.data as TrainerTemplate | null;
      error = response.error;
    } catch (networkErr) {
      console.warn('[TrainerTemplates] Falla de red al guardar en remoto, usando respaldo offline:', networkErr);
      return templatePayload;
    }

    if (error) {
      const fullErrorMsg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
      const isTableGrantError = 
        fullErrorMsg.includes('permission denied for table') ||
        fullErrorMsg.includes('permission denied for relation') ||
        fullErrorMsg.includes('permission denied for schema') ||
        (fullErrorMsg.includes('permission denied') && !fullErrorMsg.includes('row-level security') && !fullErrorMsg.includes('policy'));

      const isRlsError = !isTableGrantError && (
        fullErrorMsg.includes('row-level security') ||
        fullErrorMsg.includes('violates row-level security policy') ||
        fullErrorMsg.includes('rls policy')
      );

      if (isTableGrantError) {
        console.warn('[TrainerTemplates] Permiso GRANT de tabla faltante en Postgres:', error.message);
        saveLocalTemplates(params.trainer_id, currentLocal);
        throw new Error('Error de permisos en Supabase: falta ejecutar los permisos GRANT en la tabla plantillas_entrenador en el SQL Editor de Supabase.');
      }

      if (isRlsError) {
        // Revertir caché local para evitar bypass de la restricción RLS
        saveLocalTemplates(params.trainer_id, currentLocal);
        throw new Error('Tu suscripción actual no permite guardar plantillas personalizadas. Por favor, actualiza tu plan para continuar.');
      }

      console.warn('[TrainerTemplates] Error en remoto Supabase, usando respaldo offline:', error.message);
    } else if (data) {
      const remoteTemplate = data as TrainerTemplate;
      const updatedWithRemote = currentLocal.map(t => t.id === remoteTemplate.id ? remoteTemplate : t);
      if (!updatedWithRemote.some(t => t.id === remoteTemplate.id)) {
        updatedWithRemote.unshift(remoteTemplate);
      }
      saveLocalTemplates(params.trainer_id, updatedWithRemote);
      return remoteTemplate;
    }
  }

  return templatePayload;
}

/**
 * Elimina una plantilla guardada
 */
export async function deleteTrainerTemplate(templateId: string, trainerId: string): Promise<boolean> {
  // 1. Remover de caché local
  const localList = getLocalTemplates(trainerId);
  const filtered = localList.filter(t => t.id !== templateId);
  saveLocalTemplates(trainerId, filtered);

  // 2. Remover de Supabase
  if (trainerId && trainerId !== 'default') {
    try {
      const { error } = await supabase
        .from('plantillas_entrenador')
        .delete()
        .eq('id', templateId)
        .eq('trainer_id', trainerId);

      if (error) {
        console.warn('[TrainerTemplates] Error eliminando plantilla en Supabase:', error.message);
      }
    } catch (err) {
      console.warn('[TrainerTemplates] Excepción eliminando plantilla en remoto:', err);
    }
  }

  return true;
}

/**
 * Aplica una plantilla guardada a un plan de atleta activo:
 * Genera nuevos IDs para los ejercicios y calcula automáticamente
 * las cargas en kg específicas para el atleta si se proporcionan sus marcas de 1RM.
 */
export function applyTemplateToPlan(
  template: TrainerTemplate,
  client1RM?: Record<string, number>
): {
  trainingDays: TrainingDay[];
  weeklyTargets: Record<string, number>;
  globalVariables: GlobalVariable[];
  periodizationConfig?: Partial<PeriodizationConfig>;
} {
  const sourceDays = template.plan_data.trainingDays || [];

  // Clonar días asignando nuevos IDs únicos
  const clonedDays: TrainingDay[] = sourceDays.map(day => ({
    id: `day_${generateShortId()}`,
    name: day.name,
    exercises: (day.exercises || []).map(ex => ({
      ...ex,
      id: generateShortId(),
      variables: { ...(ex.variables || {}) }
    }))
  }));

  // Auto-calcular pesos en kg usando las marcas de 1RM del atleta si existen
  const finalDays = client1RM && Object.keys(client1RM).length > 0
    ? recalculatePlanWeights(clonedDays, client1RM)
    : clonedDays;

  return {
    trainingDays: finalDays,
    weeklyTargets: template.plan_data.weeklyTargets || {},
    globalVariables: template.plan_data.globalVariables || [],
    periodizationConfig: template.plan_data.periodizationConfig || {}
  };
}
