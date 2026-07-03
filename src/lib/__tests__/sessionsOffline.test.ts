// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  syncOfflineSessions,
  loadAthleteSessions,
  SESSIONS_CACHE_KEY,
  SESSIONS_SYNC_FAILED_EVENT,
} from '../sessions';

// Mock Supabase
const mockHistorialInsert = vi.fn();
const mockEjerciciosInsert = vi.fn();
// Resultado configurable del insert de ejercicios, para simular una falla a mitad de sync
const mockEjerciciosInsertResult = vi.fn(() => ({ error: null as Error | null }));
// Lista que "el servidor" devuelve cuando se llama a fetchAthleteSessions (select + order)
let mockServerSessionsRows: any[] = [];

vi.mock('../supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn((table) => {
        const chain: any = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        // .order() es la llamada terminal de fetchAthleteSessions (select().eq().order())
        chain.order = vi.fn().mockImplementation(() =>
          Promise.resolve({ data: mockServerSessionsRows, error: null })
        );

        chain.single = vi.fn().mockImplementation(() => {
          if (table === 'sesiones_historial') {
            return Promise.resolve({ data: { id: 'uuid-server-id' }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        });

        chain.insert = vi.fn().mockImplementation((arg) => {
          if (table === 'sesiones_historial') {
            mockHistorialInsert(arg);
            return chain;
          }
          if (table === 'sesiones_ejercicios') {
            mockEjerciciosInsert(arg);
            return Promise.resolve(mockEjerciciosInsertResult());
          }
          return Promise.resolve({ error: null });
        });

        return chain;
      })
    }
  };
});

describe('Offline Session Synchronization and Cache Preservation', () => {
  beforeEach(() => {
    localStorage.clear();
    mockHistorialInsert.mockClear();
    mockEjerciciosInsert.mockClear();
    mockEjerciciosInsertResult.mockReset();
    mockEjerciciosInsertResult.mockReturnValue({ error: null });
    mockServerSessionsRows = [];
    
    // Default online
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true
    });
  });

  it('should not sync anything when offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true
    });

    const mockLocalSession = {
      id: 1, // numeric id indicates local unsynced session
      fecha: '2026-06-30',
      notas_sesion: 'offline log note',
      ejercicios: [
        {
          id_ej: 1020,
          nombre: 'Sentadillas',
          grupo: 'Pierna',
          peso: 80,
          repsArray: [10, 10],
          rpe: 2,
          descanso: 120
        }
      ]
    };
    localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify([mockLocalSession]));

    await syncOfflineSessions('test-user');
    
    // Nothing was synced
    expect(mockHistorialInsert).not.toHaveBeenCalled();
    const cache = JSON.parse(localStorage.getItem(SESSIONS_CACHE_KEY)!);
    expect(cache[0].id).toBe(1); // remains numeric
  });

  it('should upload local unsynced sessions and update IDs to UUIDs when online', async () => {
    const mockLocalSession = {
      id: 1, // unsynced
      fecha: '2026-06-30',
      notas_sesion: 'offline log note',
      ejercicios: [
        {
          id_ej: 1020,
          nombre: 'Sentadillas',
          grupo: 'Pierna',
          peso: 80,
          repsArray: [10, 10],
          rpe: 2,
          descanso: 120
        }
      ]
    };
    localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify([mockLocalSession]));

    await syncOfflineSessions('test-user');

    expect(mockHistorialInsert).toHaveBeenCalledWith({
      cliente_id: 'test-user',
      fecha: '2026-06-30',
      notas_generales: 'offline log note'
    });
    expect(mockEjerciciosInsert).toHaveBeenCalled();

    const cache = JSON.parse(localStorage.getItem(SESSIONS_CACHE_KEY)!);
    expect(cache[0].id).toBe('uuid-server-id'); // updated to server UUID!
  });

  it('should keep the local numeric id and report a failure when the exercises insert fails mid-sync', async () => {
    // Simula: el insert de la cabecera funciona, pero el insert de ejercicios
    // falla a mitad de camino (ej. corte de red).
    mockEjerciciosInsertResult.mockReturnValueOnce({ error: new Error('network drop mid-insert') });

    const mockLocalSession = {
      id: 1, // unsynced
      fecha: '2026-06-30',
      notas_sesion: 'sesion con datos reales de un entrenamiento',
      ejercicios: [
        {
          id_ej: 1020,
          nombre: 'Sentadillas',
          grupo: 'Pierna',
          peso: 80,
          repsArray: [10, 10],
          rpe: 2,
          descanso: 120
        }
      ]
    };
    localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify([mockLocalSession]));

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const result = await syncOfflineSessions('test-user');

    expect(result).toEqual({ syncedCount: 0, failedCount: 1 });

    // La sesión NO se pierde: sigue en caché con su id numérico local
    const cache = JSON.parse(localStorage.getItem(SESSIONS_CACHE_KEY)!);
    expect(cache).toHaveLength(1);
    expect(cache[0].id).toBe(1);
    expect(cache[0].notas_sesion).toBe('sesion con datos reales de un entrenamiento');

    // Se avisó a la UI para que muestre el toast/indicador
    const dispatchedTypes = dispatchSpy.mock.calls.map((call) => (call[0] as CustomEvent).type);
    expect(dispatchedTypes).toContain(SESSIONS_SYNC_FAILED_EVENT);
  });

  it('BUG REGRESSION: loadAthleteSessions no debe pisar (y perder) una sesión offline que no pudo sincronizarse', async () => {
    // Reproduce la secuencia exacta del bug reportado:
    // 1) syncOfflineSessions falla para esta sesión (insert de ejercicios cae)
    // 2) fetchAthleteSessions sí tiene éxito y trae la lista "oficial" del servidor,
    //    que obviamente no incluye la sesión que nunca llegó a subirse
    // 3) el resultado final NO debe perder la sesión offline
    mockEjerciciosInsertResult.mockReturnValueOnce({ error: new Error('network drop mid-insert') });

    const offlineSession = {
      id: 1, // unsynced
      fecha: '2026-06-30',
      notas_sesion: 'entrenamiento real que no debe desaparecer',
      ejercicios: [
        {
          id_ej: 1020,
          nombre: 'Peso muerto',
          grupo: 'Pierna',
          peso: 100,
          repsArray: [5, 5],
          rpe: 3,
          descanso: 150
        }
      ]
    };
    localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify([offlineSession]));

    // El servidor todavía no tiene ninguna sesión para este usuario
    mockServerSessionsRows = [];

    const result = await loadAthleteSessions('test-user');

    // Antes del fix esto era [] y la sesión offline desaparecía silenciosamente.
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].notas_sesion).toBe('entrenamiento real que no debe desaparecer');

    // Y debe seguir persistida en caché, no solo en el valor de retorno
    const cache = JSON.parse(localStorage.getItem(SESSIONS_CACHE_KEY)!);
    expect(cache).toHaveLength(1);
    expect(cache[0].id).toBe(1);
  });

  it('loadAthleteSessions debe fusionar sesiones ya sincronizadas del servidor con las que siguen pendientes', async () => {
    const pendingOfflineSession = {
      id: 2, // sigue sin sincronizar
      fecha: '2026-07-01',
      notas_sesion: 'sesion todavia offline',
      ejercicios: []
    };
    localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify([pendingOfflineSession]));

    // Falla el intento de sync de esta sesión puntual (sigue pendiente después de loadAthleteSessions)
    mockEjerciciosInsertResult.mockReturnValueOnce({ error: new Error('network drop mid-insert') });

    // El servidor ya tiene otra sesión distinta (subida desde otro dispositivo, por ejemplo)
    mockServerSessionsRows = [
      {
        id: 'uuid-server-existing',
        fecha: '2026-06-28',
        notas_generales: 'sesion ya en el servidor',
        sesiones_ejercicios: []
      }
    ];

    const result = await loadAthleteSessions('test-user');

    expect(result).toHaveLength(2);
    const ids = result.map((s) => s.id);
    expect(ids).toContain('uuid-server-existing');
    expect(ids).toContain(2);
  });
});
