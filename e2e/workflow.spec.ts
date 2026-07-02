import { test, expect } from '@playwright/test';

const PROJECT_REF = 'szqitksfxiuuiljftlrl';

test.describe('Evolution Lab 3.0 E2E Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Pipe page console messages to terminal output for debugging
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE ${msg.type().toUpperCase()}]: ${msg.text()}`);
    });

    page.on('pageerror', exception => {
      console.log(`[BROWSER UNCAUGHT EXCEPTION]: ${exception.message}\nStack:\n${exception.stack}`);
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      console.log(`\n--- [TEST FAILED: ${testInfo.title}] ---`);
      console.log(`[URL AT FAILURE]: ${page.url()}`);
      try {
        const bodyText = await page.locator('body').innerText();
        console.log(`[BODY TEXT AT FAILURE (first 500 chars)]:\n${bodyText.substring(0, 500)}`);
      } catch (e) {
        console.log(`[COULD NOT CAPTURE BODY TEXT]: ${e}`);
      }
      console.log(`---------------------------------------\n`);
    }
  });

  test('should render trainer planner workspace correctly on Desktop', async ({ page }) => {
    test.setTimeout(90000);

    // Set client-side testing flag and load mock localStorage keys before page scripts run
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
      window.localStorage.setItem('evolution_guided_plan_v1_test-client-id', 'true');
      window.localStorage.setItem('evolution_guided_plan_v1_test-trainer-id', 'true');
      
      window.localStorage.setItem('pwa_user_profile', JSON.stringify({
        id: 'test-trainer-id',
        nombre: 'Trainer Juan',
        rol: 'entrenador'
      }));
    }, { projectRef: PROJECT_REF });

    // Navigate directly to trainer planner route using DOMContentLoaded wait strategy
    await page.goto('/trainer/plan/test-client-id', { waitUntil: 'domcontentloaded' });

    // Verify title metadata loads correctly (using a 30s assertion timeout)
    const h1 = page.locator('.planner-title-main');
    await expect(h1).toContainText('PLANIFICADOR DE RUTINA', { timeout: 30000 });
  });

  test('should display athlete welcome greeting and weekly consistency calendar on Mobile', async ({ page }) => {
    test.setTimeout(60000);

    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    // Set client-side testing flag and load mock localStorage keys before page scripts run
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
      window.localStorage.setItem('evolution_guided_plan_v1_test-client-id', 'true');
      window.localStorage.setItem('evolution_guided_plan_v1_test-trainer-id', 'true');
      
      window.localStorage.setItem('pwa_user_profile', JSON.stringify({
        id: 'test-client-id',
        nombre: 'Juan Perez',
        rol: 'cliente'
      }));

      window.localStorage.setItem('sobrecarga_v5', JSON.stringify([
        {
          id: 'test-past-session-id',
          fecha: '2026-06-25',
          notas_sesion: 'Rendimiento excelente',
          ejercicios: [
            {
              id_ej: 'test-exercise-log-id',
              nombre: 'Press de banca',
              grupo: 'Pecho',
              peso: 80,
              repsArray: [10, 10, 10],
              rpe: 2,
              descanso: 120
            }
          ]
        }
      ]));
    }, { projectRef: PROJECT_REF });

    // Navigate directly to dashboard route using DOMContentLoaded wait strategy
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // Verify athlete header greeting and calendar cards load successfully (using a 30s assertion timeout)
    const topBar = page.locator('.top-bar');
    await expect(topBar).toContainText('Hola, Juan Perez', { timeout: 30000 });

    const calendarTitle = page.locator('text=CONSISTENCIA SEMANAL');
    // Scroll element into view before asserting visibility on mobile layouts
    await calendarTitle.scrollIntoViewIfNeeded();
    await expect(calendarTitle).toBeVisible({ timeout: 30000 });
  });
});
