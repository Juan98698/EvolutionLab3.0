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

    // Mock Athlete Session in LocalStorage
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
      window.localStorage.setItem('pwa_user_profile', JSON.stringify({
        id: 'test-client-id',
        nombre: 'Juan Perez',
        rol: 'cliente'
      }));
    }, { projectRef: PROJECT_REF });

    // Navigate to Athlete Dashboard
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // Wait for header/top-bar
    await page.waitForSelector('.header, .top-bar', { timeout: 60000 });

    // 1. Capture Athlete Top Navigation Bar
    const topBar = page.locator('.header, .top-bar');
    await expect(topBar).toHaveScreenshot('athlete-top-bar.png', {
      maxDiffPixelRatio: 0.02,
      timeout: 30000
    });

    // 2. Capture Athlete Dashboard Page
    await expect(page).toHaveScreenshot('athlete-dashboard-full.png', {
      fullPage: true,
      mask: [page.locator('#fab1RMBtn')],
      timeout: 30000
    });
  });
});
