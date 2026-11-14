import type { SupabaseClient } from '@supabase/supabase-js';

export function installSupabaseMock(supabase: SupabaseClient) {
  // Explicit local-preview fixtures; this module is excluded from production.
  const previewRole = new URLSearchParams(window.location.search).get('preview');
  const fixtureDate = previewRole ? new Date().toISOString().slice(0, 10) : '2026-06-30';
  if (previewRole && ['trainer', 'athlete', 'coached', 'admin'].includes(previewRole)) {
    const id = previewRole === 'admin' ? 'test-admin-id' : previewRole === 'trainer' ? 'test-trainer-id' : 'test-client-id';
    localStorage.setItem('pwa_user_profile', JSON.stringify({ id, nombre: previewRole === 'trainer' ? 'JM Trainer' : 'Valeria', rol: previewRole === 'admin' ? 'admin' : previewRole === 'trainer' ? 'entrenador' : 'cliente' }));
    localStorage.setItem(`evolution_trainer_onboarded_v1_${id}`, 'true');
    localStorage.setItem(`evolution_sandbox_guide_v1_${id}`, 'true');
    localStorage.setItem('evolution_onboarded_v1', 'true');
    localStorage.setItem('pwa_install_dismissed', 'true');
    localStorage.setItem('evolab_sw_cleanup_v4.2', 'true');
  }

  const fixtureProfile = (userId: string) => ({
    id: userId,
    nombre: userId.includes('admin') ? 'Administración' : userId.includes('trainer') ? 'Trainer Juan' : 'Juan Perez',
    email: 'preview@example.test',
    rol: userId.includes('admin') ? 'admin' : userId.includes('trainer') ? 'entrenador' : 'cliente',
    ...(previewRole ? { suscripcion_plan: userId.includes('trainer') ? 'profesional' : 'premium', suscripcion_estado: 'activo', suscripcion_expira_at: '2099-01-01', onboarding_completado: true, fecha_inicio: fixtureDate, vigencia_dias: 365 } : {}),
    ...(previewRole === 'coached' && !userId.includes('trainer') ? { entrenador_id: 'test-trainer-id' } : {}),
  });

  const isE2E = true;
  supabase.rpc = ((_name: string) => Promise.resolve({ data: [], error: null })) as any;

  let mockPlanObj: any = null;

  if (isE2E) {
    mockPlanObj = {
      id: 'test-plan-id',
      cliente_id: 'test-client-id',
      creador_id: 'test-trainer-id',
      activo: true,
      periodizationConfig: {
        enabled: true,
        nivel_atleta: 'avanzado',
        objetivo: 'hipertrofia',
        semana_actual: 1,
        total_semanas: 4,
        rir_inicial: 4,
        rir_progresion: 'normal',
        rir_override_manual: false,
        muscle_groups_in_focus: ['cuadriceps'],
        marcas_1rm: { 'press de banca': 100 },
        fecha_evaluacion: fixtureDate
      },
      datos_plan: {
        portada: {
          userName: 'Juan Perez',
          userGoal: 'Hipertrofia',
          startDate: fixtureDate,
          planVigenciaPlan: '28',
          trainerName: 'Coach Juan',
          whatsappLink: '',
          instagramLink: '',
          globalNote: 'Ejecuta con cuidado'
        },
        periodizationConfig: {
          enabled: true,
          nivel_atleta: 'avanzado',
          objetivo: 'hipertrofia',
          semana_actual: 1,
          total_semanas: 4,
          rir_inicial: 4,
          rir_progresion: 'normal',
          rir_override_manual: false,
          muscle_groups_in_focus: ['cuadriceps'],
          marcas_1rm: { 'press de banca': 100 },
          fecha_evaluacion: fixtureDate
        },
        globalVariables: [
          { id: 'series de trabajo', label: 'SERIES DE TRABAJO', type: 'text', defaultValue: '3' },
          { id: 'repeticiones', label: 'REPETICIONES', type: 'text', defaultValue: '10' }
        ],
        trainingDays: [
          {
            id: 'day_1',
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
    };

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
      limit: (_count: number) => builder,
      range: (_from: number, _to: number) => builder,
      in: (_col: string, _vals: any[]) => builder,
      not: (_col: string, _op: string, _val: any) => builder,
      is: (_col: string, _val: any) => builder,
      gt: (_col: string, _val: any) => builder,
      gte: (_col: string, _val: any) => builder,
      lt: (_col: string, _val: any) => builder,
      lte: (_col: string, _val: any) => builder,
      contains: (_col: string, _val: any) => builder,
      overlaps: (_col: string, _val: any) => builder,
      textSearch: (_col: string, _query: string, _opts?: any) => builder,
      upsert: (_data: any, _options?: any) => Promise.resolve({ data: [], error: null }),
      single: () => {
        if (table === 'profiles') {
          const userId = filters['id'] || 'test-client-id';
          return Promise.resolve({ data: fixtureProfile(userId), error: null });
        }
        return Promise.resolve({ data: null, error: new Error('Not found') });
      },
      maybeSingle: () => {
        if (table === 'profiles') {
          const userId = filters['id'] || 'test-client-id';
          return Promise.resolve({ data: fixtureProfile(userId), error: null });
        }
        if (table === 'planes') {
          return Promise.resolve({
            data: mockPlanObj,
            error: null
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then: (onfulfilled: any) => {
        if (table === 'profiles') {
          const rows = previewRole ? [
            { id: 'athlete-valeria', nombre: 'Valeria R.', email: 'valeria@example.test', rol: 'cliente', entrenador_id: 'test-trainer-id', objetivo: 'Hipertrofia', modalidad: 'remoto', vigencia_dias: 30 },
            { id: 'athlete-santiago', nombre: 'Santiago M.', email: 'santiago@example.test', rol: 'cliente', entrenador_id: 'test-trainer-id', objetivo: 'Fuerza', modalidad: 'presencial', vigencia_dias: 30 },
            { id: 'athlete-nicolas', nombre: 'Nicolás C.', email: 'nicolas@example.test', rol: 'cliente', entrenador_id: 'test-trainer-id', objetivo: 'Hipertrofia', modalidad: 'remoto', vigencia_dias: 30 },
          ] : [];
          return Promise.resolve({ data: rows, error: null }).then(onfulfilled);
        }
        if (table === 'sesiones_historial') {
          const sessions = [
            {
              id: 'test-past-session-id',
              cliente_id: 'test-client-id',
              fecha: '2026-06-25',
              notas_generales: 'Rendimiento excelente',
              express_mode: false,
              express_blocks: [],
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
        if (table === 'planes') {
          return Promise.resolve({ data: [mockPlanObj], error: null }).then(onfulfilled);
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
