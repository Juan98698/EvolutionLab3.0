import { openDB, IDBPDatabase } from 'idb';

/**
 * Capa adaptadora genérica sobre IndexedDB, usada como backend de
 * almacenamiento de mayor capacidad que localStorage (que tiene un límite
 * de ~5-10MB por origen — insuficiente a mediano plazo para el historial
 * completo de sesiones de un atleta con años de entrenamientos).
 *
 * Expone una API mínima key-value (get/set/delete) sobre un único
 * object store ('kv'), suficiente para lo que hoy se guarda como JSON en
 * localStorage. No se modela un esquema relacional adentro de IndexedDB:
 * cada "fila" es simplemente `{ key, value }` donde `value` es el mismo
 * objeto que antes se guardaba serializado.
 */

const DB_NAME = 'evolution_lab_db';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

let dbPromise: Promise<IDBPDatabase> | null = null;

/** true si el navegador soporta IndexedDB. En SSR o navegadores muy viejos, no. */
export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

/** Lee un valor por su key. Devuelve `undefined` si no existe. */
export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  return db.get(STORE_NAME, key);
}

/** Guarda un valor por su key (lo sobrescribe si ya existía). */
export async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, value, key);
}

/** Borra un valor por su key. No falla si la key no existía. */
export async function idbDelete(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, key);
}

/** Solo para tests: cierra la conexión actual (si existe) y fuerza que la próxima operación abra una nueva. */
export async function __resetIndexedDbConnectionForTests(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      // Si la conexión anterior ya estaba rota, no hay nada que cerrar.
    }
  }
  dbPromise = null;
}
