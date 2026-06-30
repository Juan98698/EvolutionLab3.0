import { supabase } from './supabaseClient';
import { LocalSesion, Rule, TrackerConfig } from '../types/database.types';
import { Session, OverloadConfig } from './overload';
import { DEFAULT_RULES } from './rules';

export const SESSIONS_CACHE_KEY = 'sobrecarga_v5';
export const SESSIONS_UPDATED_EVENT = 'pwa-sessions-updated';

const SESIONES_SELECT = `
  id,
  fecha,
  notas_generales,
  sesiones_ejercicios (
    id,
    nombre_ejercicio,
    grupo_muscular,
    series_reps,
    peso,
    rpe_rir,
    descanso,
    volumen,
    rm_estimado,
    feedback_estimulo,
    feedback_recuperacion
  )
`;

type RawEjercicioRow = {
  id: string;
  nombre_ejercicio: string;
  grupo_muscular: string | null;
  series_reps: number[];
  peso: number;
  rpe_rir: number;
  descanso: number;
  volumen: number;
  rm_estimado: number;
  feedback_estimulo: string | null;
  feedback_recuperacion: string | null;
};

type RawSesionRow = {
  id: string;
  fecha: string;
  notas_generales: string | null;
  sesiones_ejercicios: RawEjercicioRow[] | null;
};

function formatSessions(data: RawSesionRow[]): LocalSesion[] {
  return data.map((s) => ({
    id: s.id,
    fecha: s.fecha,
    notas_sesion: s.notas_generales || '',
    ejercicios: (s.sesiones_ejercicios || []).map((e) => ({
      id_ej: e.id,
      nombre: e.nombre_ejercicio,
      grupo: e.grupo_muscular || 'General',
      peso: e.peso,
      repsArray: e.series_reps || [],
      rpe: e.rpe_rir,
      descanso: e.descanso,
      notas_ej: '',
    })),
  }));
}

export function readSessionsFromCache(): LocalSesion[] {
  try {
    const cached = localStorage.getItem(SESSIONS_CACHE_KEY);
    return cached ? (JSON.parse(cached) as LocalSesion[]) : [];
  } catch {
    return [];
  }
}

export function writeSessionsToCache(sessions: LocalSesion[]): void {
  localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(sessions));
  notifySessionsUpdated();
}

export function notifySessionsUpdated(): void {
  window.dispatchEvent(new CustomEvent(SESSIONS_UPDATED_EVENT));
}

export async function fetchAthleteSessions(userId: string): Promise<LocalSesion[]> {
  const { data, error } = await supabase
    .from('sesiones_historial')
    .select(SESIONES_SELECT)
    .eq('cliente_id', userId)
    .order('fecha', { ascending: true });

  if (error) throw error;
  return formatSessions((data as RawSesionRow[]) || []);
}

/** Sincroniza las sesiones registradas localmente en modo offline hacia Supabase. */
export async function syncOfflineSessions(userId: string): Promise<void> {
  if (!navigator.onLine) return;
  
  const sessions = readSessionsFromCache();
  const unsynced = sessions.filter((s) => typeof s.id === 'number');
  if (unsynced.length === 0) return;

  let hasChanged = false;
  for (const s of unsynced) {
    try {
      // 1. Insertar cabecera de la sesión
      const { data: histData, error: histError } = await supabase
        .from('sesiones_historial')
        .insert({
          cliente_id: userId,
          fecha: s.fecha,
          notas_generales: s.notas_sesion || ''
        })
        .select('id')
        .single();

      if (histError) throw histError;
      const sesionId = histData.id;

      // 2. Mapear e insertar ejercicios individuales
      const ejerciciosInsert = s.ejercicios.map((ej) => {
        const totalReps = (ej.repsArray || []).reduce((a, b) => a + b, 0);
        const vol = ej.peso * totalReps;
        const maxReps = Math.max(...(ej.repsArray || [0]));
        const epley = ej.peso * (1 + maxReps / 30);
        const brzyckiDenominator = 1.0278 - 0.0278 * maxReps;
        const brzycki = brzyckiDenominator > 0.01 ? ej.peso / brzyckiDenominator : ej.peso;
        const rmEst = (epley + brzycki) / 2;

        return {
          sesion_id: sesionId,
          nombre_ejercicio: ej.nombre,
          grupo_muscular: ej.grupo || 'General',
          series_reps: ej.repsArray,
          peso: ej.peso,
          rpe_rir: ej.rpe,
          descanso: ej.descanso,
          volumen: vol,
          rm_estimado: rmEst,
          feedback_estimulo: (ej as any).feedback_estimulo || null,
          feedback_recuperacion: (ej as any).feedback_recuperacion || null
        };
      });

      const { error: exError } = await supabase
        .from('sesiones_ejercicios')
        .insert(ejerciciosInsert);

      if (exError) throw exError;

      // Sincronización exitosa: cambiar ID numérico local por el UUID real del servidor
      s.id = sesionId;
      hasChanged = true;
    } catch (err) {
      console.error('[Sync] Error al sincronizar sesión offline:', err);
    }
  }

  if (hasChanged) {
    writeSessionsToCache(sessions);
  }
}

/** Descarga de Supabase con fallback a caché local (offline-first). */
export async function loadAthleteSessions(userId: string): Promise<LocalSesion[]> {
  try {
    // Sincronizar primero las sesiones registradas offline
    await syncOfflineSessions(userId);

    // Descargar el historial completo del servidor
    const sessions = await fetchAthleteSessions(userId);
    writeSessionsToCache(sessions);
    return sessions;
  } catch {
    // Si falla por red, conservar las sesiones que ya teníamos en caché (incluyendo las offline)
    return readSessionsFromCache();
  }
}

/** Convierte historial anidado en filas planas para el motor de sobrecarga. */
export function flattenSessionsForOverload(sessions: LocalSesion[]): Session[] {
  const rows: Session[] = [];
  for (const s of sessions) {
    for (const e of s.ejercicios) {
      if (!e.nombre?.trim()) continue;
      const repsArray = e.repsArray || [];
      rows.push({
        id: `${s.id}_${e.id_ej}`,
        fecha: s.fecha,
        ejercicio: e.nombre,
        peso: e.peso,
        repsArray,
        rpe_rir: e.rpe,
        descanso: e.descanso,
        volumen: e.peso * repsArray.reduce((a, b) => a + b, 0),
        grupo: e.grupo,
      });
    }
  }
  return rows;
}

/** Fusiona reglas del plan con los defaults del motor. */
export function resolveOverloadRules(planRules?: Rule[]): Rule[] {
  if (!planRules?.length) return DEFAULT_RULES;
  return DEFAULT_RULES.map((def) => {
    const saved = planRules.find((r) => r.id === def.id);
    return saved ? { ...def, ...saved } : def;
  });
}

/** Mapea trackerConfig del plan a la config del motor. */
export function resolveOverloadConfig(
  trackerConfig?: TrackerConfig
): Partial<OverloadConfig> {
  if (!trackerConfig) return {};
  return {
    minSesiones: trackerConfig.minSesiones,
    ventana: trackerConfig.ventana,
    diasDescansoExcesivo: trackerConfig.diasDescansoExcesivo,
    diasOptimo: trackerConfig.diasOptimo,
    sesionesRegresionAlerta: trackerConfig.sesionesRegresionAlerta,
    sesionesEstancamiento: trackerConfig.sesionesEstancamiento,
  };
}
