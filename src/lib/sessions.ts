import { supabase } from './supabaseClient';
import { LocalSesion, Rule, TrackerConfig, ExpressBlockAudit } from '../types/database.types';
import { Session, OverloadConfig } from './overload';
import { DEFAULT_RULES } from './rules';
import { activateSessionCache, readSessionsFromCache, writeSessionsToCache } from './sessionCache';
export { activateSessionCache, readSessionsFromCache, writeSessionsToCache, notifySessionsUpdated, __resetSessionsCacheForTests, SESSIONS_CACHE_KEY, SESSIONS_UPDATED_EVENT } from './sessionCache';

/** Se dispara cuando una o más sesiones offline no pudieron subirse a Supabase. */
export const SESSIONS_SYNC_FAILED_EVENT = 'pwa-sessions-sync-failed';

export interface SyncResult {
  syncedCount: number;
  failedCount: number;
}

const SESIONES_SELECT = `
  id,
  fecha,
  notas_generales,
  express_mode,
  express_blocks,
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
  peso: number | null;
  rpe_rir: number | null;
  descanso: number;
  volumen: number | null;
  rm_estimado: number | null;
  feedback_estimulo: string | null;
  feedback_recuperacion: string | null;
};

type RawSesionRow = {
  id: string;
  fecha: string;
  notas_generales: string | null;
  express_mode?: boolean | null;
  express_blocks?: ExpressBlockAudit[] | null;
  sesiones_ejercicios: RawEjercicioRow[] | null;
};

function formatSessions(data: RawSesionRow[]): LocalSesion[] {
  return data.map((s) => ({
    id: s.id,
    fecha: s.fecha,
    notas_sesion: s.notas_generales || '',
    express_mode: s.express_mode ?? undefined,
    express_blocks: s.express_blocks ?? undefined,
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

export async function fetchAthleteSessions(userId: string): Promise<LocalSesion[]> {
  const { data, error } = await supabase
    .from('sesiones_historial')
    .select(SESIONES_SELECT)
    .eq('cliente_id', userId)
    .order('fecha', { ascending: true });

  if (error) throw error;
  return formatSessions((data as RawSesionRow[]) || []);
}

/** Same maximum-repetition formula and rounding for every upload path. */
export function estimateOneRepMax(peso: number | null, repsArray: number[]): number | null {
  if (peso == null || !Number.isFinite(peso) || peso < 0 || repsArray.length === 0) return null;
  const maxReps = Math.max(0, ...repsArray);
  const epley = peso * (1 + maxReps / 30);
  const denominator = 1.0278 - 0.0278 * maxReps;
  const brzycki = denominator > 0.01 ? peso / denominator : peso;
  return Math.round(((epley + brzycki) / 2) * 10) / 10;
}

function sessionPayload(session: LocalSesion) {
  return {
    ...session,
    ejercicios: session.ejercicios.map(ej => {
      const repsArray = ej.repsArray || [];
      return {
        nombre_ejercicio: ej.nombre, grupo_muscular: ej.grupo || 'General', series_reps: repsArray,
        peso: ej.peso, rpe_rir: ej.rpe, descanso: ej.descanso,
        volumen: ej.peso == null ? null : ej.peso * repsArray.reduce((a, b) => a + b, 0),
        rm_estimado: estimateOneRepMax(ej.peso, repsArray),
        feedback_estimulo: ej.feedback_estimulo || null,
        feedback_recuperacion: ej.feedback_recuperacion || null,
      };
    }),
  };
}

const syncing = new Map<string, Promise<SyncResult>>();
/** Single-flight per owner plus server-side idempotency across tabs and retries. */
export function syncOfflineSessions(userId: string): Promise<SyncResult> {
  const running = syncing.get(userId);
  if (running) return running;
  const operation = syncPending(userId).finally(() => { syncing.delete(userId); });
  syncing.set(userId, operation);
  return operation;
}

async function syncPending(userId: string): Promise<SyncResult> {
  if (!navigator.onLine) return { syncedCount: 0, failedCount: 0 };
  await activateSessionCache(userId);
  const pending = readSessionsFromCache(userId).filter(s => typeof s.id === 'number');
  let syncedCount = 0;

  let failedCount = 0;
  for (const session of pending) {
    try {
      // Persist the key BEFORE sending, including for legacy numeric local IDs.
      if (!session.operation_id) {
        session.operation_id = crypto.randomUUID();
        writeSessionsToCache(readSessionsFromCache(userId).map(s => s.id === session.id ? session : s), userId);
      }
      const { data, error } = await supabase.rpc('record_training_session', {
        p_cliente_id: userId, p_operation_id: session.operation_id, p_session: sessionPayload(session),
      });
      if (error || !data?.id) throw error || new Error('El servidor no confirmó la sesión.');
      // Merge into the latest snapshot, preserving sessions added while awaiting IO.
      writeSessionsToCache(readSessionsFromCache(userId).map(s => {
        if (s.operation_id !== session.operation_id) return s;
        return { ...s, id: data.id, ejercicios: s.ejercicios.map((e, index) => ({ ...e, id_ej: data.ejercicios?.[index]?.id_ej || e.id_ej })) };
      }), userId);
      syncedCount++;
    } catch (error) {
      console.error('[Sync] La sesión sigue pendiente:', error);
      failedCount++;
    }
  }
  if (failedCount) window.dispatchEvent(new CustomEvent(SESSIONS_SYNC_FAILED_EVENT, { detail: { failedCount } }));
  return { syncedCount, failedCount };

}

/** Descarga de Supabase con fallback a caché local (offline-first). */
export async function loadAthleteSessions(userId: string): Promise<LocalSesion[]> {
  try {
    // Sincronizar primero las sesiones registradas offline
    await syncOfflineSessions(userId);

    // Descargar el historial completo del servidor
    const sessions = await fetchAthleteSessions(userId);

    // Si alguna sesión offline no pudo subirse (p. ej. se cayó la red a mitad
    // del insert), sigue en caché con su id numérico local. NO hay que pisarla
    // con la lista del servidor -que obviamente no la incluye- o se pierde para
    // siempre. Se fusiona en vez de sobrescribir.
    const stillUnsynced = readSessionsFromCache(userId).filter(
      (s) => typeof s.id === 'number'
    );
    
    // Si quedan sesiones sin sincronizar, reportar el estado de salud a la base de datos
    if (stillUnsynced.length > 0) {
      const dates = stillUnsynced.map((s) => s.fecha).sort();
      const oldestDate = dates[0];
      
      await supabase
        .from('sync_health_reports')
        .insert({
          user_id: userId,
          unsynced_count: stillUnsynced.length,
          oldest_unsynced_fecha: oldestDate
        });
    }

    const merged = [...sessions, ...stillUnsynced];
    writeSessionsToCache(merged, userId);
    return merged;
  } catch {
    // Si falla por red, conservar las sesiones que ya teníamos en caché (incluyendo las offline)
    return readSessionsFromCache(userId);
  }
}

/** true si hay sesiones registradas localmente que todavía no llegaron al servidor. */
export function hasUnsyncedSessions(): boolean {
  return readSessionsFromCache().some((s) => typeof s.id === 'number');
}

/** Cantidad de sesiones registradas localmente que todavía no llegaron al servidor. */
export function countUnsyncedSessions(): number {
  return readSessionsFromCache().filter((s) => typeof s.id === 'number').length;
}

/** Convierte historial anidado en filas planas para el motor de sobrecarga. */
export function flattenSessionsForOverload(sessions: LocalSesion[]): Session[] {
  const rows: Session[] = [];
  for (const s of sessions) {
    for (const e of s.ejercicios) {
      if (!e.nombre?.trim()) continue;
      const repsArray = e.repsArray || [];
      const pesoSafe = e.peso ?? 0;
      const isFunctional = e.peso == null;
      rows.push({
        id: `${s.id}_${e.id_ej}`,
        fecha: s.fecha,
        ejercicio: e.nombre,
        peso: e.peso,
        repsArray,
        rpe_rir: e.rpe,
        descanso: e.descanso,
        volumen: isFunctional ? null : pesoSafe * repsArray.reduce((a, b) => a + b, 0),
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
