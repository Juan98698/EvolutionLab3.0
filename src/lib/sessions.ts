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

/** Descarga de Supabase con fallback a caché local (offline-first). */
export async function loadAthleteSessions(userId: string): Promise<LocalSesion[]> {
  try {
    const sessions = await fetchAthleteSessions(userId);
    writeSessionsToCache(sessions);
    return sessions;
  } catch {
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
