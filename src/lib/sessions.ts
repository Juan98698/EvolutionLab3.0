import { supabase } from './supabaseClient';
import { LocalSesion, Rule, TrackerConfig, ExpressBlockAudit } from '../types/database.types';
import { Session, OverloadConfig } from './overload';
import { DEFAULT_RULES } from './rules';
import { idbGet, idbSet, isIndexedDbAvailable } from './indexedDbStore';

export const SESSIONS_CACHE_KEY = 'sobrecarga_v5';
export const SESSIONS_UPDATED_EVENT = 'pwa-sessions-updated';
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

// ─────────────────────────────────────────────────────────────────────────
// Caché de sesiones: IndexedDB por dentro, misma firma síncrona por fuera.
//
// localStorage tiene un límite de ~5-10MB por origen. El historial completo
// de sesiones de un atleta con años de entrenamientos puede acercarse a ese
// techo. IndexedDB no tiene ese límite práctico, pero es 100% asíncrono —
// y todo el código existente (incluido `useState(() => readSessionsFromCache())`
// en AthleteDashboard) espera una lectura SÍNCRONA e inmediata.
//
// La solución: una variable en memoria (`cachedSessions`) es la fuente de
// verdad síncrona durante la vida de la pestaña. Al cargar el módulo, se
// siembra sincrónicamente desde localStorage (idéntico al comportamiento
// anterior, sin ningún salto) y, en paralelo, se hidrata desde IndexedDB
// de forma asíncrona — si IndexedDB tiene datos (o si es la primera vez y
// hay que migrar lo que había en localStorage), se actualiza la variable
// en memoria y se avisa a la UI vía SESSIONS_UPDATED_EVENT, el mismo evento
// que ya escuchan los componentes.
// ─────────────────────────────────────────────────────────────────────────

let cachedSessions: LocalSesion[] = readLegacyLocalStorageSync();

function readLegacyLocalStorageSync(): LocalSesion[] {
  try {
    const cached = localStorage.getItem(SESSIONS_CACHE_KEY);
    return cached ? (JSON.parse(cached) as LocalSesion[]) : [];
  } catch {
    return [];
  }
}

/** Hidrata `cachedSessions` desde IndexedDB (o migra lo que había en localStorage la primera vez). */
async function hydrateFromIndexedDb(): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  try {
    const fromIdb = await idbGet<LocalSesion[]>(SESSIONS_CACHE_KEY);
    if (fromIdb) {
      cachedSessions = fromIdb;
      notifySessionsUpdated();
    } else if (cachedSessions.length > 0) {
      // Primera vez que corre esta versión: migrar lo que había en localStorage.
      await idbSet(SESSIONS_CACHE_KEY, cachedSessions);
    }
  } catch (err) {
    console.warn('[IndexedDB] No se pudo hidratar el caché de sesiones, se sigue usando localStorage:', err);
  }
}

// Arranca la hidratación al cargar el módulo. No se bloquea nada: mientras
// tanto, las lecturas síncronas siguen sirviendo lo que había en localStorage.
void hydrateFromIndexedDb();

export function readSessionsFromCache(): LocalSesion[] {
  // Copia defensiva: quien la reciba puede mutarla libremente sin afectar
  // el estado interno hasta que llame a writeSessionsToCache explícitamente.
  return [...cachedSessions];
}

export function writeSessionsToCache(sessions: LocalSesion[]): void {
  cachedSessions = sessions;
  notifySessionsUpdated();

  if (isIndexedDbAvailable()) {
    idbSet(SESSIONS_CACHE_KEY, sessions).catch((err) => {
      console.warn('[IndexedDB] Falló el guardado, se usa localStorage como respaldo:', err);
      try {
        localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(sessions));
      } catch {
        // Si tampoco entra en localStorage (cuota excedida), se pierde la
        // persistencia de este guardado puntual, pero la sesión de la
        // pestaña actual sigue viendo los datos correctos en memoria.
      }
    });
  } else {
    // Navegador sin IndexedDB (muy poco común): mantener el comportamiento anterior.
    try {
      localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(sessions));
    } catch {
      // Cuota excedida — no hay más respaldo posible en este caso.
    }
  }
}

/** Solo para tests: resetea el caché en memoria sin pasar por IndexedDB/localStorage. */
export function __resetSessionsCacheForTests(sessions: LocalSesion[] = []): void {
  cachedSessions = sessions;
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

/**
 * 1RM estimado (promedio Epley + Brzycki) con la serie de más repeticiones,
 * redondeado a 0.1. Es la misma fórmula para el guardado online y offline:
 * antes cada camino usaba reps distintas (última serie vs. máximas) y solo
 * uno redondeaba, así que la misma sesión daba RM distinto según la red.
 */
export function estimateOneRepMax(peso: number | null, repsArray: number[]): number | null {
  if (peso == null || repsArray.length === 0) return null;
  const maxReps = Math.max(...repsArray);
  const epley = peso * (1 + maxReps / 30);
  const brzyckiDenominator = 1.0278 - 0.0278 * maxReps;
  const brzycki = brzyckiDenominator > 0.01 ? peso / brzyckiDenominator : peso;
  return Math.round(((epley + brzycki) / 2) * 10) / 10;
}

/** Filas de `sesiones_ejercicios` para una sesión local. `peso === null` = ejercicio funcional. */
export function buildEjerciciosRows(sesionId: string, ejercicios: LocalSesion['ejercicios']) {
  return ejercicios.map((ej) => {
    const repsArray = ej.repsArray || [];
    const totalReps = repsArray.reduce((a, b) => a + b, 0);
    return {
      sesion_id: sesionId,
      nombre_ejercicio: ej.nombre,
      grupo_muscular: ej.grupo || 'General',
      series_reps: repsArray,
      peso: ej.peso,
      rpe_rir: ej.rpe,
      descanso: ej.descanso,
      volumen: ej.peso == null ? null : ej.peso * totalReps,
      rm_estimado: estimateOneRepMax(ej.peso, repsArray),
      feedback_estimulo: ej.feedback_estimulo || null,
      feedback_recuperacion: ej.feedback_recuperacion || null,
    };
  });
}

/**
 * Sube una sesión local (cabecera + ejercicios) y devuelve el id del servidor.
 * Si fallan los ejercicios se borra la cabecera recién creada, para que el
 * reintento no deje cabeceras vacías duplicadas en el historial.
 */
async function uploadSession(userId: string, s: LocalSesion): Promise<string> {
  const { data: histData, error: histError } = await supabase
    .from('sesiones_historial')
    .insert({
      cliente_id: userId,
      fecha: s.fecha,
      notas_generales: s.notas_sesion || '',
      express_mode: s.express_mode || false,
      express_blocks: s.express_blocks || [],
    })
    .select('id')
    .single();

  if (histError) throw histError;
  const sesionId: string = histData.id;

  const { error: exError } = await supabase
    .from('sesiones_ejercicios')
    .insert(buildEjerciciosRows(sesionId, s.ejercicios));

  if (exError) {
    const { error: rollbackError } = await supabase
      .from('sesiones_historial')
      .delete()
      .eq('id', sesionId);
    if (rollbackError) {
      console.error('[Sync] No se pudo borrar la cabecera huérfana:', rollbackError);
    }
    throw exError;
  }

  return sesionId;
}

async function runSync(userId: string): Promise<SyncResult> {
  if (!navigator.onLine) return { syncedCount: 0, failedCount: 0 };

  const unsynced = readSessionsFromCache().filter((s) => typeof s.id === 'number');
  if (unsynced.length === 0) return { syncedCount: 0, failedCount: 0 };

  const serverIds = new Map<string | number, string>();
  let failedCount = 0;
  for (const s of unsynced) {
    try {
      serverIds.set(s.id, await uploadSession(userId, s));
    } catch (err) {
      console.error('[Sync] Error al sincronizar sesión offline:', err);
      failedCount++;
    }
  }

  if (serverIds.size > 0) {
    // Se relee el caché: mientras subíamos pudo guardarse otra sesión y no hay
    // que pisarla con la foto que se tomó al empezar.
    writeSessionsToCache(
      readSessionsFromCache().map((s) => (serverIds.has(s.id) ? { ...s, id: serverIds.get(s.id)! } : s))
    );
  }

  if (failedCount > 0) {
    // Avisar a la UI que quedaron sesiones sin subir, para mostrar un toast/indicador.
    window.dispatchEvent(
      new CustomEvent(SESSIONS_SYNC_FAILED_EVENT, { detail: { failedCount } })
    );
  }

  return { syncedCount: serverIds.size, failedCount };
}

let syncQueue: Promise<unknown> = Promise.resolve();

/**
 * Sincroniza las sesiones registradas localmente hacia Supabase.
 *
 * Las llamadas se encolan: si el dashboard, Analytics y el guardado de una
 * sesión piden sincronizar a la vez, cada una espera a la anterior y lee el
 * caché ya actualizado, así ninguna sesión se sube dos veces.
 */
export function syncOfflineSessions(userId: string): Promise<SyncResult> {
  const run = syncQueue.then(() => runSync(userId));
  syncQueue = run.catch(() => undefined);
  return run;
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
    const stillUnsynced = readSessionsFromCache().filter(
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
    writeSessionsToCache(merged);
    return merged;
  } catch {
    // Si falla por red, conservar las sesiones que ya teníamos en caché (incluyendo las offline)
    return readSessionsFromCache();
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
