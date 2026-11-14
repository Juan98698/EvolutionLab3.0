// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activateSessionCache, __resetSessionsCacheForTests, readSessionsFromCache, writeSessionsToCache, SESSIONS_CACHE_KEY } from '../sessionCache';
import { syncOfflineSessions, loadAthleteSessions } from '../sessions';
import { __resetIndexedDbConnectionForTests, idbSet } from '../indexedDbStore';
import type { LocalSesion } from '../../types/database.types';

const { rpc, fetchRows } = vi.hoisted(() => ({ rpc: vi.fn(), fetchRows: vi.fn() }));
vi.mock('../supabaseClient', () => ({ supabase: {
  rpc,
  from: () => ({ select() { return this; }, eq() { return this; }, order: fetchRows, insert: vi.fn().mockResolvedValue({ error: null }) }),
} }));
const session = (id = 1): LocalSesion => ({ id, operation_id: `operation-${id}`, fecha: '2026-11-13', notas_sesion: 'Sesión', ejercicios: [{ id_ej: 1, nombre: 'Sentadilla', grupo: 'Pierna', peso: 60, repsArray: [8,8], rpe: 2, descanso: 120 }] });
beforeEach(async () => {
  await activateSessionCache(null);
  await __resetIndexedDbConnectionForTests();
  await new Promise<void>(resolve => { const request = indexedDB.deleteDatabase('evolution_lab_db'); request.onsuccess = () => resolve(); request.onerror = () => resolve(); });
  localStorage.clear();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  rpc.mockReset().mockResolvedValue({ data: { id: 'server-uuid', ejercicios: [{ id_ej: 'exercise-uuid' }] }, error: null });
  fetchRows.mockReset().mockResolvedValue({ data: [], error: null });
});

describe('Account-scoped offline sessions', () => {
  it('keeps account A pending data away from account B, including after logout', async () => {
    await activateSessionCache('A');
    writeSessionsToCache([session()]);
    await activateSessionCache(null);
    expect(readSessionsFromCache()).toEqual([]);
    await activateSessionCache('B');
    expect(readSessionsFromCache()).toEqual([]);
    expect(await syncOfflineSessions('B')).toEqual({ syncedCount: 0, failedCount: 0 });
    expect(rpc).not.toHaveBeenCalled();
    await activateSessionCache('A');
    expect(readSessionsFromCache()[0].operation_id).toBe('operation-1');
  });
  it('does not assign legacy unowned data to the next signed-in account', async () => {
    localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify([session()]));
    await idbSet(SESSIONS_CACHE_KEY, [session()]);
    await activateSessionCache('B');
    expect(readSessionsFromCache()).toEqual([]);
    expect(localStorage.getItem(SESSIONS_CACHE_KEY)).toContain('operation-1');
  });
  it('returns deep snapshots so mutations cannot silently change the store', async () => {
    await activateSessionCache('A'); writeSessionsToCache([session()]);
    const value = readSessionsFromCache(); value[0].ejercicios[0].repsArray[0] = 900;
    expect(readSessionsFromCache()[0].ejercicios[0].repsArray[0]).toBe(8);
  });
  it('does not overwrite an edit made before IndexedDB hydration finishes', async () => {
    await idbSet('evolution:sessions:v6:A', [session(1)]);
    const hydration = activateSessionCache('A');
    writeSessionsToCache([session(2)], 'A');
    await hydration;
    expect(readSessionsFromCache('A')[0].id).toBe(2);
  });
  it('uses one RPC for header and exercises, retaining the operation key', async () => {
    __resetSessionsCacheForTests([session()], 'A');
    expect(await syncOfflineSessions('A')).toEqual({ syncedCount: 1, failedCount: 0 });
    expect(rpc).toHaveBeenCalledWith('record_training_session', expect.objectContaining({ p_cliente_id: 'A', p_operation_id: 'operation-1', p_session: expect.objectContaining({ ejercicios: [expect.objectContaining({ volumen: 960 })] }) }));
    expect(readSessionsFromCache('A')[0]).toMatchObject({ id: 'server-uuid', operation_id: 'operation-1' });
  });
  it('keeps pending data and retries with the SAME key after acknowledgement loss', async () => {
    __resetSessionsCacheForTests([session()], 'A');
    rpc.mockResolvedValueOnce({ data: null, error: new Error('Lost response') });
    expect((await syncOfflineSessions('A')).failedCount).toBe(1);
    expect(readSessionsFromCache('A')[0].id).toBe(1);
    await syncOfflineSessions('A');
    expect(rpc.mock.calls.map(call => call[1].p_operation_id)).toEqual(['operation-1', 'operation-1']);
  });
  it('persists an operation key before the first network attempt for numeric legacy IDs', async () => {
    const unkeyed = session(); delete unkeyed.operation_id;
    __resetSessionsCacheForTests([unkeyed], 'A');
    rpc.mockImplementationOnce(async () => {
      expect(readSessionsFromCache('A')[0].operation_id).toBeTruthy();
      return { error: new Error('Disconnected'), data: null };
    });
    await syncOfflineSessions('A');
    const key = readSessionsFromCache('A')[0].operation_id;
    await syncOfflineSessions('A');
    expect(rpc.mock.calls[1][1].p_operation_id).toBe(key);
  });
  it('does not send the same session twice during concurrent refreshes', async () => {
    __resetSessionsCacheForTests([session()], 'A');
    await Promise.all([syncOfflineSessions('A'), syncOfflineSessions('A')]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('preserves a new recording added while a sync is in flight', async () => {
    __resetSessionsCacheForTests([session()], 'A');
    rpc.mockImplementationOnce(async () => {
      writeSessionsToCache([...readSessionsFromCache('A'), session(2)], 'A');
      return { data: { id: 'server-1' }, error: null };
    });
    await syncOfflineSessions('A');
    expect(readSessionsFromCache('A').map(s => s.id)).toEqual(['server-1', 2]);
  });
  it('preserves pending data when refreshing the server history', async () => {
    __resetSessionsCacheForTests([session()], 'A');
    rpc.mockResolvedValue({ data: null, error: new Error('Network failure') });
    const result = await loadAthleteSessions('A');
    expect(result).toHaveLength(1); expect(result[0].id).toBe(1);
  });
  it('performs no network calls while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    __resetSessionsCacheForTests([session()], 'A');
    expect(await syncOfflineSessions('A')).toEqual({ syncedCount: 0, failedCount: 0 });
    expect(rpc).not.toHaveBeenCalled();
  });
});
