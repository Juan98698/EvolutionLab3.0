/**
 * athleteTemplates.ts
 *
 * Módulo de almacenamiento y conversión de plantillas personales para atletas independientes.
 * Permite guardar, cargar y eliminar plantillas personalizadas en LocalStorage,
 * desacoplado del RLS de entrenadores, ofreciendo paridad real en QuickStartPlanner.tsx.
 */

import { TrainingDay, Exercise } from '../types/database.types';

export interface LocalExercise {
  id: string;
  nombre: string;
  grupoMuscular: string;
  variables?: Record<string, string>;
  progression_notes?: string;
  progression_type?: 'linear' | 'double' | 'undulating' | 'deload';
  progression_params?: Record<string, any>;
}

export interface LocalDay {
  id: string;
  name: string;
  exercises: LocalExercise[];
}

export interface AthleteTemplate {
  id: string;
  athlete_id: string;
  nombre: string;
  descripcion?: string | null;
  dias_semana: number;
  days: LocalDay[];
  created_at: string;
  updated_at: string;
}

const generateShortId = (): string => Math.random().toString(36).substring(2, 11);

function getLocalStorageKey(athleteId: string): string {
  return `evolution_athlete_templates_${athleteId || 'default'}`;
}

/**
 * Convierte un arreglo de LocalDay (usado en QuickStartPlanner) a TrainingDay (estándar DB)
 */
export function convertLocalDaysToTrainingDays(localDays: LocalDay[]): TrainingDay[] {
  return localDays.map(day => ({
    id: day.id || `day_${generateShortId()}`,
    name: day.name,
    exercises: (day.exercises || []).map(ex => ({
      id: ex.id || `ex_${generateShortId()}`,
      nombre: ex.nombre,
      grupo_muscular: ex.grupoMuscular,
      variables: ex.variables || {},
      progression_notes: ex.progression_notes,
      progression_type: ex.progression_type,
      progression_params: ex.progression_params
    } as Exercise))
  }));
}

/**
 * Convierte un arreglo de TrainingDay (estándar DB) a LocalDay (QuickStartPlanner)
 */
export function convertTrainingDaysToLocalDays(trainingDays: TrainingDay[]): LocalDay[] {
  return trainingDays.map(day => ({
    id: day.id || `day_${generateShortId()}`,
    name: day.name,
    exercises: (day.exercises || []).map(ex => ({
      id: ex.id || `ex_${generateShortId()}`,
      nombre: ex.nombre || (ex as any).name || '',
      grupoMuscular: ex.grupo_muscular || (ex as any).muscle_group || '',
      variables: ex.variables || {},
      progression_notes: ex.progression_notes,
      progression_type: ex.progression_type,
      progression_params: ex.progression_params
    }))
  }));
}

/**
 * Obtiene todas las plantillas guardadas por el atleta desde LocalStorage
 */
export function getAthleteTemplates(athleteId: string): AthleteTemplate[] {
  try {
    const raw = localStorage.getItem(getLocalStorageKey(athleteId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[AthleteTemplates] Error al leer plantillas del atleta:', err);
    return [];
  }
}

/**
 * Guarda una plantilla personal del atleta en LocalStorage
 */
export function saveAthleteTemplate(params: {
  id?: string;
  athlete_id: string;
  nombre: string;
  descripcion?: string | null;
  days: LocalDay[];
}): AthleteTemplate {
  const now = new Date().toISOString();
  const templateId = params.id || `ath_tpl_${generateShortId()}_${Date.now()}`;

  const template: AthleteTemplate = {
    id: templateId,
    athlete_id: params.athlete_id,
    nombre: params.nombre.trim(),
    descripcion: params.descripcion ? params.descripcion.trim() : null,
    dias_semana: params.days.length,
    days: params.days,
    created_at: now,
    updated_at: now
  };

  const current = getAthleteTemplates(params.athlete_id);
  const index = current.findIndex(t => t.id === templateId);
  let updated: AthleteTemplate[];

  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...template, created_at: current[index].created_at || now };
  } else {
    updated = [template, ...current];
  }

  try {
    localStorage.setItem(getLocalStorageKey(params.athlete_id), JSON.stringify(updated));
  } catch (err) {
    console.warn('[AthleteTemplates] Error al guardar plantilla del atleta:', err);
  }

  return template;
}

/**
 * Elimina una plantilla personal del atleta
 */
export function deleteAthleteTemplate(athleteId: string, templateId: string): boolean {
  try {
    const current = getAthleteTemplates(athleteId);
    const filtered = current.filter(t => t.id !== templateId);
    localStorage.setItem(getLocalStorageKey(athleteId), JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.warn('[AthleteTemplates] Error al eliminar plantilla:', err);
    return false;
  }
}
