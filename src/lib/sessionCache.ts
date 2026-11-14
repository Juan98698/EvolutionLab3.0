import type { LocalSesion } from '../types/database.types';
import { idbGet, idbSet } from './indexedDbStore';

export const SESSIONS_CACHE_KEY = 'sobrecarga_v5'; // Legacy data is retained, never assigned to another account.
export const SESSIONS_UPDATED_EVENT = 'pwa-sessions-updated';
const cacheKey = (userId: string) => `evolution:sessions:v6:${userId}`;
type Entry = { sessions: LocalSesion[]; revision: number; ready: Promise<void> };
const entries = new Map<string, Entry>();
let activeUserId: string | null = null;
let generation = 0;

function clone(sessions: LocalSesion[]): LocalSesion[] {
  return JSON.parse(JSON.stringify(sessions)) as LocalSesion[];
}
export function notifySessionsUpdated(): void {
  window.dispatchEvent(new CustomEvent(SESSIONS_UPDATED_EVENT));
}

/** Bind before mounting account screens. Hydration cannot overwrite newer edits. */
export function activateSessionCache(userId: string | null): Promise<void> {
  if (activeUserId !== userId) {
    generation++;
    entries.clear();
    activeUserId = userId;
    notifySessionsUpdated();
  }
  if (!userId) return Promise.resolve();
  return entryFor(userId).ready;
}

function entryFor(userId: string): Entry {
  const existing = entries.get(userId);
  if (existing) return existing;
  let sessions: LocalSesion[] = [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(cacheKey(userId)) || '[]');
    if (Array.isArray(value)) sessions = value;
  } catch { /* IndexedDB is the second durable copy. */ }
  const entry: Entry = { sessions, revision: 0, ready: Promise.resolve() };
  entries.set(userId, entry);
  const epoch = generation;
  entry.ready = idbGet<LocalSesion[]>(cacheKey(userId)).then(value => {
    if (Array.isArray(value) && entry.revision === 0 && epoch === generation) {
      entry.sessions = value;
      notifySessionsUpdated();
    }
  }).catch(() => { /* The synchronous copy remains available. */ });
  return entry;
}

export function readSessionsFromCache(userId: string | null = activeUserId): LocalSesion[] {
  if (!userId) return [];
  return clone(entryFor(userId).sessions);
}

export function writeSessionsToCache(sessions: LocalSesion[], userId: string | null = activeUserId): void {
  if (!userId) throw new Error('Inicia sesión antes de guardar un entrenamiento.');
  const entry = entryFor(userId);
  entry.revision++;
  entry.sessions = clone(sessions);
  let savedLocally = false;
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(entry.sessions));
    savedLocally = true;
  } catch { /* IndexedDB can persist data even when localStorage is full. */ }
  // IndexedDB transactions are enqueued in call order.
  void idbSet(cacheKey(userId), entry.sessions).catch(() => {
    if (!savedLocally) window.dispatchEvent(new CustomEvent('pwa-storage-failed'));
  });
  notifySessionsUpdated();
}

/** Test helper intentionally binds an explicit owner, just like authentication. */
export function __resetSessionsCacheForTests(sessions: LocalSesion[] = [], userId = 'test-user'): void {
  generation++;
  entries.clear();
  activeUserId = userId;
  entries.set(userId, { sessions: clone(sessions), revision: 1, ready: Promise.resolve() });
}
