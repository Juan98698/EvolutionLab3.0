import { test, expect } from '@playwright/test';

// Derivado de VITE_SUPABASE_URL para evitar hardcodear el identificador del proyecto.
// Si se migra el proyecto de Supabase, solo hay que actualizar la variable de entorno —
// no buscar referencias dispersas en el código. Se puede sobreescribir explícitamente
// con la variable SUPABASE_PROJECT_REF en .env.local o en el entorno de CI.
//
// Ejemplo en .env.local:
//   VITE_SUPABASE_URL=https://szqitksfxiuuiljftlrl.supabase.co
//   SUPABASE_PROJECT_REF=szqitksfxiuuiljftlrl  (opcional, si se quiere valor explícito)
const PROJECT_REF = process.env['SUPABASE_PROJECT_REF']
  || process.env['VITE_SUPABASE_URL']?.split('//')[1]?.split('.')[0]
  || '';

test.describe('Evolution Lab 3.0 Visual Regression Tests', () => {
  
  test.beforeEach(({ page }) => {
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE ${msg.type()}]: ${msg.text()}`);
    });
    
    page.on('pageerror', err => {
      console.log(`[BROWSER UNCAUGHT EXCEPTION]: ${err.message}\nStack: ${err.stack}`);
    });

    page.on('request', req => {              
      if (req.url().includes('supabase.co') && !req.url().includes('/auth/')) {
        console.log(`[REQUEST]: ${req.method()} ${req.url()}`);
      }
    });
  });



  test('Trainer Dashboard Layout - Visual Verification', async ({ page }) => {
    test.setTimeout(90000);

    // Intercept profiles single fetch for the trainer
    await page.route('**/rest/v1/profiles*', async route => {
      await route.fulfill({
        json: {
          id: 'test-trainer-id',
          nombre: 'Trainer Juan',
          rol: 'entrenador',
          email: 'trainer@example.com'
        }
      });
    });

    // Mock Trainer Session in LocalStorage
    await page.addInitScript(({ projectRef }) => {
      (window as any)._playwright_test = true;
      window.localStorage.setItem('evolab_sw_cleanup_v4.2', 'true');
      
      const mockSession = {
        access_token: 'mock-jwt',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh',
        user: {
          id: 'test-trainer-id',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'trainer@example.com'
        },
        expires_at: 9999999999
      };

      window.localStorage.setItem(`sb-${projectRef}-auth-token`, JSON.stringify(mockSession));
      window.localStorage.setItem('evolution_trainer_onboarded_v1_test-trainer-id', 'true');
      window.localStorage.setItem('evolution_guided_plan_v1_test-trainer-id', 'true');
      
      window.localStorage.setItem('pwa_user_profile', JSON.stringify({
        id: 'test-trainer-id',
        nombre: 'Trainer Juan',
        rol: 'entrenador'
      }));
    }, { projectRef: PROJECT_REF });

    // Navigate to Trainer Dashboard
    await page.goto('/trainer', { waitUntil: 'domcontentloaded' });

    // Wait for the main elements to render (handles both old .header and new .top-bar classes)
    await page.waitForSelector('.header, .top-bar', { timeout: 60000 });

    // 1. Capture the Top Navigation Bar (Visual snapshot)
    const topBar = page.locator('.header, .top-bar');
    await expect(topBar).toHaveScreenshot('trainer-top-bar.png', {
      maxDiffPixelRatio: 0.02,
      timeout: 30000
    });

    // 2. Capture the full viewport of the Trainer Dashboard
    await expect(page).toHaveScreenshot('trainer-dashboard-full.png', {
      fullPage: true,
      mask: [page.locator('#fab1RMBtn')],
      timeout: 30000
    });
  });

  test('Trainer Planner & Periodization Panel - Visual Verification', async ({ page }) => {
    test.setTimeout(90000);

    // Intercept ejercicios_globales fetch query
    await page.route('**/rest/v1/ejercicios_globales*', async route => {
      await route.fulfill({
        json: [
          {
            nombre: 'Sentadilla',
            grupo_muscular: 'cuadriceps',
            imagen_url: '',
            video_url: '',
            descripcion: 'Sentadilla con barra'
          }
        ]
      });
    });

    // Intercept Supabase API calls to return mock profiles dynamically (using single objects instead of arrays)
    await page.route('**/rest/v1/profiles*', async route => {
      const url = route.request().url();
      if (url.includes('test-trainer-id')) {
        await route.fulfill({
          json: {
            id: 'test-trainer-id',
            nombre: 'Trainer Juan',
            rol: 'entrenador',
            email: 'trainer@example.com'
          }
        });
      } else {
        await route.fulfill({
          json: {
            id: 'test-client-id',
            nombre: 'Juan Perez',
            rol: 'cliente',
            entrenador_id: 'test-trainer-id',
            email: 'atleta@example.com'
          }
        });
      }
    });

    // Intercept planes query. Since postgrest .maybeSingle() expects a JSON array that the client-side library
    // unpacks as data[0] (to avoid HTTP 406 errors on empty), we must return a JSON array containing the plan.
    await page.route('**/rest/v1/planes*', async route => {
      const config = {
        enabled: true,
        nivel_atleta: 'avanzado',
        objetivo: 'hipertrofia',
        semana_actual: 1,
        total_semanas: 4,
        rir_inicial: 4,
        rir_progresion: 'normal',
        rir_override_manual: false,
        muscle_groups_in_focus: ['cuadriceps']
      };

      const planObj = {
        id: 'test-plan-id',
        cliente_id: 'test-client-id',
        creador_id: 'test-trainer-id',
        periodizationConfig: config, // root-level for backward compatibility (c28f204)
        datos_plan: {
          trainingDays: [
            {
              id: 'day_1',
              name: 'Día A',
              exercises: [
                {
                  id: 'ex1',
                  nombre: 'Sentadilla',
                  grupo_muscular: 'cuadriceps',
                  variables: {
                    'series de trabajo': '3',
                    'repeticiones': '8',
                    'rir': '2',
                    'descanso': '120'
                  }
                }
              ]
            }
          ],
          periodizationConfig: config // inside datos_plan for forward compatibility (main)
        }
      };

      // Fulfill with a JSON array containing the single plan object
      await route.fulfill({ json: [planObj] });
    });

    // Mock Trainer Session and override the supabase client's local stub data in memory
    await page.addInitScript(({ projectRef }) => {
      (window as any)._playwright_test = true;
      window.localStorage.setItem('evolab_sw_cleanup_v4.2', 'true');
      
      const mockSession = {
        access_token: 'mock-jwt',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh',
        user: {
          id: 'test-trainer-id',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'trainer@example.com'
        },
        expires_at: 9999999999
      };

      window.localStorage.setItem(`sb-${projectRef}-auth-token`, JSON.stringify(mockSession));
      window.localStorage.setItem('evolution_trainer_onboarded_v1_test-trainer-id', 'true');
      window.localStorage.setItem('evolution_trainer_onboarded_v1_test-client-id', 'true');
      window.localStorage.setItem('evolution_guided_plan_v1_test-client-id', 'true');
      window.localStorage.setItem('evolution_guided_plan_v1_test-trainer-id', 'true');
      
      window.localStorage.setItem('pwa_user_profile', JSON.stringify({
        id: 'test-trainer-id',
        nombre: 'Trainer Juan',
        rol: 'entrenador'
      }));

      // Define property setter on window.supabase to intercept and hook the 'from' property setter
      let mockSupabase: any = null;
      Object.defineProperty(window, 'supabase', {
        get() {
          return mockSupabase;
        },
        set(val) {
          mockSupabase = val;
          if (mockSupabase) {
            let currentFrom = mockSupabase.from;
            Object.defineProperty(mockSupabase, 'from', {
              get() {
                return currentFrom;
              },
              set(newFrom) {
                currentFrom = (table: string) => {
                  const builder = newFrom(table);
                  if (table === 'planes') {
                    const originalMaybeSingle = builder.maybeSingle;
                    builder.maybeSingle = async () => {
                      const res = await originalMaybeSingle();
                      if (res && res.data) {
                        const config = {
                          enabled: true,
                          nivel_atleta: 'avanzado',
                          objetivo: 'hipertrofia',
                          semana_actual: 1,
                          total_semanas: 4,
                          rir_inicial: 4,
                          rir_progresion: 'normal',
                          rir_override_manual: false,
                          muscle_groups_in_focus: ['cuadriceps']
                        };
                        res.data.periodizationConfig = config;
                        if (res.data.datos_plan) {
                          res.data.datos_plan.periodizationConfig = config;
                        }
                      }
                      return res;
                    };
                  }
                  return builder;
                };
              },
              configurable: true
            });
          }
        },
        configurable: true
      });
    }, { projectRef: PROJECT_REF });

    // Navigate to Trainer Planner for client 'test-client-id'
    await page.goto('/trainer/plan/test-client-id', { waitUntil: 'domcontentloaded' });

    // Wait for the planner structure to load
    await page.waitForSelector('.planner-title-main', { timeout: 20000 });

    // Locate the Periodization Panel card via stable data-testid attribute
    await page.waitForSelector('[data-testid="periodization-card"]', { timeout: 20000 });
    const periodizationCard = page.locator('[data-testid="periodization-card"]').first();

    // Scroll to the Periodization Card to load it stably
    await periodizationCard.scrollIntoViewIfNeeded();

    // 1. Capture the Periodization Panel card in its default state (Automated RIR)
    await expect(periodizationCard).toHaveScreenshot('trainer-periodization-card-default.png', {
      maxDiffPixelRatio: 0.02,
      timeout: 15000
    });

    // 2. Locate and toggle RIR manual override button
    const rirToggleButton = periodizationCard.locator('text=/RIR AUTOMÁTICO|RIR MANUAL ACTIVO/').first();
    await rirToggleButton.click();

    // Wait 250ms for color change transitions
    await page.waitForTimeout(250);

    // 3. Capture the Periodization Panel card in Manual Override state
    await expect(periodizationCard).toHaveScreenshot('trainer-periodization-card-manual.png', {
      maxDiffPixelRatio: 0.02,
      timeout: 15000
    });
  });

  test('Athlete Dashboard Layout - Visual Verification', async ({ page }) => {
    test.setTimeout(90000);

    // Congelar SOLO la fecha del navegador (no los timers). GamificacionPanel y
    // AthleteDashboard usan `new Date()` / `Date.now()` en varios lugares
    // (daysSinceLast, racha, vigencia del plan, día de la semana resaltado en
    // "Consistencia Semanal"). Sin esto, el resultado visual depende del día
    // real en que se corre el test — pasando algunos días y fallando otros de
    // forma intermitente. Se usa setFixedTime() en lugar de install() porque
    // install() también pausa setTimeout/setInterval reales, lo cual bloquearía
    // el fallback de 6s de SupabaseContext.tsx y dejaría la app en loading
    // infinito. setFixedTime() solo fija la fecha, los timers siguen normales.
    await page.clock.setFixedTime(new Date('2026-06-30T15:00:00'));

    // Intercept profiles single fetch for the athlete
    await page.route('**/rest/v1/profiles*', async route => {
      await route.fulfill({
        json: {
          id: 'test-client-id',
          nombre: 'Juan Perez',
          rol: 'cliente',
          email: 'atleta@example.com'
        }
      });
    });

    // Intercept planes fetch to avoid hitting production database in CI
    await page.route('**/rest/v1/planes*', async route => {
      await route.fulfill({
        json: [
          {
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
          }
        ]
      });
    });

    // Intercept sesiones_historial fetch — devuelve una sesión real para que
    // la tarjeta "TU PROGRESO" (GamificacionPanel) se renderice de forma determinística.
    // El shape debe coincidir con RawSesionRow[] que espera formatSessions() en src/lib/sessions.ts
    await page.route('**/rest/v1/sesiones_historial*', async route => {
      await route.fulfill({
        json: [
          {
            id: 'mock-session-1',
            fecha: '2026-06-30',
            notas_generales: 'Gran entrenamiento',
            sesiones_ejercicios: [
              {
                id: 'ex-1',
                nombre_ejercicio: 'Press de banca',
                grupo_muscular: 'Pecho',
                series_reps: [10, 10, 10],
                peso: 80,
                rpe_rir: 8,
                descanso: 2,
                volumen: 2400,
                rm_estimado: 106.6,
                feedback_estimulo: 'bueno',
                feedback_recuperacion: 'bueno'
              }
            ]
          }
        ]
      });
    });

    // Intercept gamificacion fetch — el badge "Primera Sesión" ya viene guardado
    // de antemano. Esto evita que GamificacionPanel lo detecte como "nuevo" y
    // dispare canvas-confetti (animación vía requestAnimationFrame, no CSS, que
    // Playwright no puede neutralizar con disableAnimations). Sin este mock, el
    // confetti se disparaba de forma no determinística por el doble-efecto de
    // React StrictMode en el servidor de desarrollo de Vite, dejando restos de
    // partículas con física aleatoria que variaban entre corridas (~160px de diff).
    await page.route('**/rest/v1/gamificacion*', async route => {
      await route.fulfill({
        json: [
          { titulo: 'Primera Sesión' }
        ]
      });
    });



    // Mock Athlete Session & Clean Storage in LocalBrowser Context
    await page.addInitScript(({ projectRef }) => {
      (window as any)._playwright_test = true;
      window.localStorage.setItem('evolab_sw_cleanup_v4.2', 'true');

      const mockSession = {
        access_token: 'mock-jwt',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh',
        user: {
          id: 'test-client-id',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'atleta@example.com'
        },
        expires_at: 9999999999
      };

      window.localStorage.setItem(`sb-${projectRef}-auth-token`, JSON.stringify(mockSession));
      window.localStorage.setItem('evolution_trainer_onboarded_v1_test-client-id', 'true');
      window.localStorage.setItem('evolution_guided_plan_v1_test-client-id', 'true');
      window.localStorage.setItem('evolution_onboarded_v1', 'true');
      window.localStorage.setItem('pwa_push_prompt_dismissed_test-client-id', 'true');
      window.localStorage.setItem('pwa_user_profile', JSON.stringify({
        id: 'test-client-id',
        nombre: 'Juan Perez',
        rol: 'cliente'
      }));

      // Inyectar plan mockeado de forma síncrona
      const mockPlan = {
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
      };
      window.localStorage.setItem('pwa_client_plan', JSON.stringify(mockPlan));

      // Pre-poblar la caché local de sesiones con el mismo dato que devuelve el mock de red.
      // loadAthleteSessions() intenta red primero (fromNetwork=true) y usa esta caché solo
      // como fallback si la red falla, pero mantenerla sincronizada evita cualquier parpadeo
      // en caso de que el fallback se dispare por cualquier motivo.
      const mockSessionsCache = [
        {
          id: 'mock-session-1',
          fecha: '2026-06-30',
          notas_sesion: 'Gran entrenamiento',
          ejercicios: [
            {
              id_ej: 'ex-1',
              nombre: 'Press de banca',
              grupo: 'Pecho',
              peso: 80,
              repsArray: [10, 10, 10],
              rpe: 8,
              descanso: 2,
              notas_ej: ''
            }
          ]
        }
      ];
      window.localStorage.setItem('sobrecarga_v5', JSON.stringify(mockSessionsCache));
    }, { projectRef: PROJECT_REF });

    // Navigate to Athlete Dashboard
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // Wait for header/top-bar
    await page.waitForSelector('.header, .top-bar', { timeout: 60000 });

    // Esperar a que el plan esté realmente cargado buscando el botón de entrenar ahora, el cual es condicional
    await page.waitForSelector('#start-session-btn', { timeout: 60000 });

    // Esperar a que la tarjeta "TU PROGRESO" (GamificacionPanel) esté montada.
    // overloadSessions se puebla de forma asíncrona (useEffect -> loadAthleteSessions),
    // así que sin este wait el screenshot podía dispararse antes de que React
    // terminara de re-renderizar con los datos de sesiones, causando alturas de página
    // inconsistentes entre corridas (el bug original de flakiness).
    await page.getByText('TU PROGRESO', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });

    // Adicionalmente, esperar a que el texto "NIVEL ATLETA" esté visible, ya que es
    // el bloque específico que antes desaparecía por la condición de carrera.
    await page.getByText('NIVEL ATLETA', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });

    // 1. Capture Athlete Top Navigation Bar
    const topBar = page.locator('.header, .top-bar');
    await expect(topBar).toHaveScreenshot('athlete-top-bar.png', {
      maxDiffPixelRatio: 0.02,
      timeout: 30000
    });

    // 2. Capture Athlete Dashboard Page
    // maxDiffPixelRatio: 0.005 (0.5%) tolera ruido de renderizado sub-pixel
    // (anti-aliasing de emojis, glow/boxShadow con variables CSS de tema) que
    // varía levemente entre corridas de Chromium en el contenedor incluso con
    // datos 100% mockeados y deterministas. Los diffs observados tras fijar
    // fecha/sesiones/badges rondan 160-7500px sobre ~4.3M píxeles totales
    // (~0.003-0.17%) — ruido de renderizado, no una regresión real. Un cambio
    // de layout genuino difiere en decenas/cientos de miles de píxeles, muy
    // por encima de este umbral, así que sigue detectando regresiones reales.
    await expect(page).toHaveScreenshot('athlete-dashboard-full.png', {
      fullPage: true,
      mask: [page.locator('#fab1RMBtn')],
      maxDiffPixelRatio: 0.005,
      timeout: 30000
    });
  });
});
