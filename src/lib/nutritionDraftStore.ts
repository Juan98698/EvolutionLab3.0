import { DayOfWeek, NutritionPlan } from '../types/nutrition.types';
import { Profile, ValoracionAntropometrica } from '../types/database.types';
import { idbGet, idbSet } from './indexedDbStore';

export const NUTRITION_ACTIVE_SESSION_KEY = 'evolution_active_nutrition_session';
export const NUTRITION_DRAFT_KEY_PREFIX = 'evolution_nutrition_draft_';

export interface ActiveNutritionSession {
  trainerId?: string;
  atleta: Profile;
  valuation: ValoracionAntropometrica | null;
  timestamp: number;
}

export interface NutritionDraft {
  atletaId: string;
  activeDayKey: DayOfWeek;
  plan: NutritionPlan;
  timestamp: number;
}

/**
 * Guarda la sesión activa del modal de nutrición (cuando el entrenador abre la planificación para un atleta)
 */
export function saveActiveNutritionSession(
  atleta: Profile,
  valuation: ValoracionAntropometrica | null = null,
  trainerId?: string
): void {
  try {
    const session: ActiveNutritionSession = {
      trainerId,
      atleta,
      valuation,
      timestamp: Date.now(),
    };
    localStorage.setItem(NUTRITION_ACTIVE_SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.warn('[NutritionDraftStore] Error al guardar sesión activa:', err);
  }
}

/**
 * Obtiene la sesión activa si existe y no ha expirado (vigencia de 24 horas)
 */
export function getActiveNutritionSession(currentTrainerId?: string): ActiveNutritionSession | null {
  try {
    const raw = localStorage.getItem(NUTRITION_ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const session: ActiveNutritionSession = JSON.parse(raw);
    if (!session || !session.atleta?.id) return null;

    // Verificar expiración (24h)
    const MAX_SESSION_AGE = 24 * 60 * 60 * 1000;
    if (Date.now() - session.timestamp > MAX_SESSION_AGE) {
      clearActiveNutritionSession();
      return null;
    }

    // Si se especificó el entrenador, verificar que coincida
    if (currentTrainerId && session.trainerId && session.trainerId !== currentTrainerId) {
      return null;
    }

    return session;
  } catch (err) {
    console.warn('[NutritionDraftStore] Error al leer sesión activa:', err);
    return null;
  }
}

/**
 * Limpia la sesión activa (al cerrar deliberadamente el modal)
 */
export function clearActiveNutritionSession(): void {
  try {
    localStorage.removeItem(NUTRITION_ACTIVE_SESSION_KEY);
  } catch (err) {
    console.warn('[NutritionDraftStore] Error al limpiar sesión activa:', err);
  }
}

/**
 * Guarda en tiempo real el borrador del plan en curso tanto en localStorage (síncrono, ideal para cambios de app)
 * como en IndexedDB (respaldo asíncrono offline)
 */
export function saveNutritionDraft(
  atletaId: string,
  plan: NutritionPlan,
  activeDayKey: DayOfWeek
): void {
  if (!atletaId || !plan) return;
  const draft: NutritionDraft = {
    atletaId,
    activeDayKey,
    plan,
    timestamp: Date.now(),
  };

  // 1. Guardar primero en localStorage (inmediato, síncrono, garantizado ante suspensión del hilo en móviles)
  try {
    localStorage.setItem(`${NUTRITION_DRAFT_KEY_PREFIX}${atletaId}`, JSON.stringify(draft));
  } catch (err) {
    console.warn('[NutritionDraftStore] Error al guardar borrador en localStorage:', err);
  }

  // 2. Respaldo asíncrono en IndexedDB
  try {
    idbSet(`nutrition_draft_${atletaId}`, draft).catch((e) => {
      console.warn('[NutritionDraftStore] Error al respaldar borrador en idb:', e);
    });
  } catch (err) {
    // noop
  }
}

/**
 * Obtiene el borrador activo para un atleta dado (vigencia de 7 días)
 */
export function getNutritionDraft(atletaId: string): NutritionDraft | null {
  if (!atletaId) return null;
  try {
    const raw = localStorage.getItem(`${NUTRITION_DRAFT_KEY_PREFIX}${atletaId}`);
    if (!raw) return null;
    const draft: NutritionDraft = JSON.parse(raw);
    if (!draft || !draft.plan) return null;

    // Vigencia del borrador: 7 días
    const MAX_DRAFT_AGE = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - draft.timestamp > MAX_DRAFT_AGE) {
      clearNutritionDraft(atletaId);
      return null;
    }

    return draft;
  } catch (err) {
    console.warn('[NutritionDraftStore] Error al leer borrador:', err);
    return null;
  }
}

/**
 * Obtiene el borrador activo desde IndexedDB (fallback asíncrono)
 */
export async function getNutritionDraftAsync(atletaId: string): Promise<NutritionDraft | null> {
  const syncDraft = getNutritionDraft(atletaId);
  if (syncDraft) return syncDraft;
  try {
    const idbDraft = await idbGet<NutritionDraft>(`nutrition_draft_${atletaId}`);
    if (idbDraft && idbDraft.plan) {
      return idbDraft;
    }
  } catch (err) {
    console.warn('[NutritionDraftStore] Error al leer borrador de idb:', err);
  }
  return null;
}

/**
 * Elimina el borrador de un atleta (por ejemplo, después de Guardar Plan exitosamente en la nube)
 */
export function clearNutritionDraft(atletaId: string): void {
  if (!atletaId) return;
  try {
    localStorage.removeItem(`${NUTRITION_DRAFT_KEY_PREFIX}${atletaId}`);
    idbSet(`nutrition_draft_${atletaId}`, null).catch(() => {});
  } catch (err) {
    console.warn('[NutritionDraftStore] Error al limpiar borrador:', err);
  }
}
