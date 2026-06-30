// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncOfflineSessions, SESSIONS_CACHE_KEY } from '../sessions';

// Mock Supabase
const mockHistorialInsert = vi.fn();
const mockEjerciciosInsert = vi.fn();

vi.mock('../supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn((table) => {
        const chain: any = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        
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
            return Promise.resolve({ error: null });
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
});
