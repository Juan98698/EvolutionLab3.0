// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { idbGet, idbSet, idbDelete, isIndexedDbAvailable } from '../indexedDbStore';

describe('indexedDbStore', () => {
  beforeEach(async () => {
    // Cada test empieza con la key de prueba vacía
    await idbDelete('test-key');
  });

  it('isIndexedDbAvailable devuelve true cuando existe el polyfill de IndexedDB', () => {
    expect(isIndexedDbAvailable()).toBe(true);
  });

  it('devuelve undefined si la key no existe todavía', async () => {
    const value = await idbGet('una-key-que-no-existe');
    expect(value).toBeUndefined();
  });

  it('guarda y recupera un valor', async () => {
    await idbSet('test-key', { hola: 'mundo', numero: 42 });
    const value = await idbGet<{ hola: string; numero: number }>('test-key');
    expect(value).toEqual({ hola: 'mundo', numero: 42 });
  });

  it('sobrescribe un valor existente al volver a guardar con la misma key', async () => {
    await idbSet('test-key', 'primero');
    await idbSet('test-key', 'segundo');
    const value = await idbGet<string>('test-key');
    expect(value).toBe('segundo');
  });

  it('guarda arrays grandes (el caso de uso real: historial de sesiones)', async () => {
    const bigArray = Array.from({ length: 500 }, (_, i) => ({ id: i, fecha: '2026-01-01', ejercicios: [] }));
    await idbSet('test-key', bigArray);
    const value = await idbGet<typeof bigArray>('test-key');
    expect(value).toHaveLength(500);
    expect(value?.[499]).toEqual({ id: 499, fecha: '2026-01-01', ejercicios: [] });
  });

  it('borra una key existente', async () => {
    await idbSet('test-key', 'algo');
    await idbDelete('test-key');
    const value = await idbGet('test-key');
    expect(value).toBeUndefined();
  });

  it('no falla al borrar una key que no existe', async () => {
    await expect(idbDelete('key-inexistente')).resolves.not.toThrow();
  });
});
