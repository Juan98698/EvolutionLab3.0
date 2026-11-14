import { test, expect } from '@playwright/test';

// The test-only Supabase adapter supplies the same fixtures as responsive tests.
// Inter is bundled with the app. Baselines use Chromium at a fixed viewport/date.
test.describe('Estudio — regresión visual', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Las comparaciones de píxeles usan Chromium; los flujos responsive cubren WebKit.');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.clock.setFixedTime(new Date('2026-06-30T15:00:00Z'));
    await page.addInitScript(() => {
      localStorage.setItem('evolab_sw_cleanup_v4.2', 'true');
      localStorage.setItem('pwa_install_dismissed', 'true');
      for (const id of ['test-trainer-id', 'test-client-id']) {
        for (const prefix of ['evolution_guided_plan_v1_', 'pwa_push_prompt_dismissed_', 'evolution_trainer_onboarded_v1_']) localStorage.setItem(prefix + id, 'true');
      }
    });
  });

  test('Trainer Dashboard Layout - Visual Verification', async ({ page }) => {
    await page.goto('/trainer?preview=trainer');
    await expect(page.getByRole('heading', { name: 'Tu equipo, al día.' })).toBeVisible();
    await expect(page.locator('.studio-client-row')).toHaveCount(3);
    await expect(page.locator('.studio-topline')).toHaveScreenshot('studio-trainer-navigation.png', { maxDiffPixelRatio: 0.02 });
    await expect(page).toHaveScreenshot('studio-trainer-dashboard.png', { fullPage: true, maxDiffPixelRatio: 0.02 });
  });

  test('Portada Estudio completa en escritorio y móvil', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot('studio-login-desktop.png', { fullPage: true, maxDiffPixelRatio: 0.02 });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page).toHaveScreenshot('studio-login-mobile.png', { fullPage: true, maxDiffPixelRatio: 0.02 });
  });

  test('Trainer Planner & Periodization Panel - Visual Verification', async ({ page }) => {
    await page.goto('/trainer/plan/test-client-id?preview=trainer');
    const panel = page.getByTestId('periodization-card');
    await expect(panel).toBeVisible();
    await expect(page.getByText('¡Plan activo cargado correctamente!', { exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toBeHidden();
    await expect(panel).toHaveScreenshot('studio-periodization-default.png', { maxDiffPixelRatio: 0.02 });
    const manualRir = panel.getByRole('switch', { name: 'Activar control manual de RIR', exact: true });
    await manualRir.click();
    await expect(manualRir).toHaveAttribute('aria-checked', 'true');
    await expect(panel).toHaveScreenshot('studio-periodization-manual.png', { maxDiffPixelRatio: 0.02 });
  });

  test('Athlete Dashboard Layout - Visual Verification', async ({ page }) => {
    await page.goto('/dashboard?preview=athlete');
    await expect(page.locator('#start-session-btn')).toBeVisible();
    await expect(page.getByText('TU PROGRESO', { exact: true })).toBeVisible();
    await expect(page.getByText('NIVEL ATLETA', { exact: true })).toBeVisible();
    await expect(page.locator('.studio-topline')).toHaveScreenshot('studio-athlete-navigation.png', { maxDiffPixelRatio: 0.02 });
    await expect(page).toHaveScreenshot('studio-athlete-dashboard.png', { fullPage: true, maxDiffPixelRatio: 0.02 });
  });
});
