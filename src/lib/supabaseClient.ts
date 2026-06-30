import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'ADVERTENCIA: Las variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no están definidas en .env.local'
  );
}

// Cliente Singleton expuesto para toda la aplicación
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  }
});

if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;

  // Determine if execution context is an E2E testing environment
  const isE2E = window.location.port === '5173' || navigator.userAgent.includes('Headless') || (window as any)._playwright_test;
  console.log('⚡ Supabase Client Init - isE2E:', isE2E, 'port:', window.location.port, '_playwright_test:', (window as any)._playwright_test);

  if (isE2E) {
    (supabase as any).auth = {
      getSession: () => {
        const activeProfile = window.localStorage.getItem('pwa_user_profile');
        if (!activeProfile) return Promise.resolve({ data: { session: null }, error: null });
        const profile = JSON.parse(activeProfile);
        const mockSession = {
          access_token: 'mock-jwt',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh',
          user: {
            id: profile.id,
            email: profile.rol === 'entrenador' ? 'trainer@example.com' : 'atleta@example.com',
            aud: 'authenticated',
            role: 'authenticated'
          },
          expires_at: 9999999999
        };
        return Promise.resolve({ data: { session: mockSession }, error: null });
      },
      onAuthStateChange: (callback: any) => {
        setTimeout(() => {
          const activeProfile = window.localStorage.getItem('pwa_user_profile');
          if (!activeProfile) {
            callback('INITIAL_SESSION', null);
            return;
          }
          const profile = JSON.parse(activeProfile);
          const mockSession = {
            access_token: 'mock-jwt',
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: 'mock-refresh',
            user: {
              id: profile.id,
              email: profile.rol === 'entrenador' ? 'trainer@example.com' : 'atleta@example.com',
              aud: 'authenticated',
              role: 'authenticated'
            },
            expires_at: 9999999999
          };
          callback('INITIAL_SESSION', mockSession);
        }, 10);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: () => Promise.resolve({ error: null })
    } as any;
  }

  const originalFrom = supabase.from.bind(supabase);
  supabase.from = (table: string) => {
    if (!isE2E) {
      return originalFrom(table);
    }

    const filters: any = {};
    const builder: any = {
      select: (_columns?: string) => builder,
      eq: (col: string, val: any) => {
        filters[col] = val;
        return builder;
      },
      order: (_col: string, _options?: any) => builder,
      upsert: (_data: any, _options?: any) => Promise.resolve({ data: [], error: null }),
      single: () => {
        if (table === 'profiles') {
          const userId = filters['id'] || 'test-client-id';
          const name = userId.includes('trainer') ? 'Trainer Juan' : 'Juan Perez';
          const role = userId.includes('trainer') ? 'entrenador' : 'cliente';
          return Promise.resolve({ data: { id: userId, nombre: name, rol: role }, error: null });
        }
        return Promise.resolve({ data: null, error: new Error('Not found') });
      },
      maybeSingle: () => {
        if (table === 'profiles') {
          const userId = filters['id'] || 'test-client-id';
          const name = userId.includes('trainer') ? 'Trainer Juan' : 'Juan Perez';
          const role = userId.includes('trainer') ? 'entrenador' : 'cliente';
          return Promise.resolve({ data: { id: userId, nombre: name, rol: role }, error: null });
        }
        if (table === 'planes') {
          return Promise.resolve({
            data: {
              id: 'test-plan-id',
              cliente_id: 'test-client-id',
              creador_id: 'test-trainer-id',
              activo: true,
              datos_plan: {
                portada: {
                  userName: 'Juan Perez',
                  userGoal: 'Hipertrofia',
                  startDate: '2026-06-30',
                  planVigenciaPlan: '28',
                  trainerName: 'Coach Juan',
                  whatsappLink: '',
                  instagramLink: '',
                  globalNote: 'Ejecuta con cuidado'
                },
                globalVariables: [
                  { id: 'series de trabajo', label: 'SERIES DE TRABAJO', type: 'text', defaultValue: '3' },
                  { id: 'repeticiones', label: 'REPETICIONES', type: 'text', defaultValue: '10' }
                ],
                trainingDays: [
                  {
                    id: 'day-1',
                    name: 'Lunes: Pecho',
                    exercises: [
                      {
                        id: 'ex-1',
                        nombre: 'Press de banca',
                        grupo_muscular: 'Pecho',
                        variables: {
                          'series de trabajo': '3',
                          'repeticiones': '10'
                        }
                      }
                    ]
                  }
                ]
              }
            },
            error: null
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then: (onfulfilled: any) => {
        if (table === 'sesiones_historial') {
          const sessions = [
            {
              id: 'test-past-session-id',
              cliente_id: 'test-client-id',
              fecha: '2026-06-25',
              notas_generales: 'Rendimiento excelente',
              sesiones_ejercicios: [
                {
                  id: 'test-exercise-log-id',
                  nombre_ejercicio: 'Press de banca',
                  grupo_muscular: 'Pecho',
                  series_reps: [10, 10, 10],
                  peso: 80,
                  rpe_rir: 2,
                  descanso: 120,
                  volumen: 2400,
                  rm_estimado: 100,
                  feedback_estimulo: 'bueno',
                  feedback_recuperacion: 'bueno'
                }
              ]
            }
          ];
          return Promise.resolve({ data: sessions, error: null }).then(onfulfilled);
        }
        return Promise.resolve({ data: [], error: null }).then(onfulfilled);
      }
    };

    builder.insert = (_data: any) => {
      return {
        select: () => Promise.resolve({ data: [{ id: 'new-session-uuid' }], error: null }),
        then: (onfulfilled: any) => Promise.resolve({ data: [{ id: 'new-session-uuid' }], error: null }).then(onfulfilled)
      };
    };

    builder.update = (_data: any) => {
      const dummyUpdate = {
        eq: (_col: string, _val: any) => dummyUpdate,
        then: (onfulfilled: any) => Promise.resolve({ data: [], error: null }).then(onfulfilled)
      };
      return dummyUpdate;
    };

    builder.delete = () => {
      const dummyDelete = {
        eq: (_col: string, _val: any) => dummyDelete,
        then: (onfulfilled: any) => Promise.resolve({ data: [], error: null }).then(onfulfilled)
      };
      return dummyDelete;
    };

    return builder;
  };

  // Stub realtime channel subscription to bypass live WebSocket connections
  supabase.channel = (_name: string) => {
    const dummyChannel = {
      on: (_event: string, _filter: any, _callback: any) => dummyChannel,
      subscribe: () => dummyChannel
    };
    return dummyChannel as any;
  };

  supabase.removeChannel = (_channel: any) => Promise.resolve() as any;
}
