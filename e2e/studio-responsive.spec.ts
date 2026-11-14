import { test, expect, type Page } from '@playwright/test';

async function expectViewportFit(page: Page) {
  const geometry = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(geometry.content, `El documento desborda ${geometry.content - geometry.viewport}px`).toBeLessThanOrEqual(geometry.viewport + 1);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-30T15:00:00Z'));
  await page.addInitScript(() => {
    localStorage.setItem('evolab_sw_cleanup_v4.2', 'true');
    localStorage.setItem('pwa_install_dismissed', 'true');
    for (const id of ['test-trainer-id', 'test-client-id']) {
      for (const key of ['evolution_guided_plan_v1_', 'pwa_push_prompt_dismissed_', 'evolution_trainer_onboarded_v1_']) localStorage.setItem(key + id, 'true');
    }
  });
});

for (const width of [320, 390, 768, 1440]) {
  test(`Acceso: formulario utilizable a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
    await expectViewportFit(page);
    const email = page.getByLabel('Correo electrónico', { exact: true });
    await expect(email).toBeVisible();
    await email.fill('atleta@example.test');
    if (width <= 650) expect(await email.evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
    await page.getByRole('button', { name: /Regístrate gratis/i }).click();
    await expectViewportFit(page);
    await expect(page.getByLabel('Nombre completo')).toBeVisible();
  });

  test(`Entrenador: navegación, búsqueda y herramientas a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/trainer?preview=trainer');
    await expect(page.getByRole('heading', { name: 'Tu equipo, al día.' })).toBeVisible();
    await expectViewportFit(page);
    await page.getByLabel('Buscar atleta').fill('Valeria');
    await expect(page.locator('.studio-client-row')).toHaveCount(1);
    await page.getByText('Seguimiento y herramientas', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Registrar sesión', exact: true })).toBeVisible();
    await expectViewportFit(page);
    if (width <= 900) {
      await page.getByRole('button', { name: 'Menú', exact: true }).click();
      await expect(page.getByRole('navigation', { name: 'Navegación del espacio' })).toBeVisible();
      await expectViewportFit(page);
    }
    await page.getByRole('navigation', { name: 'Navegación del espacio' }).getByRole('link', { name: 'Seguimiento', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Auditoría / Sesiones' })).toHaveAttribute('aria-pressed', 'true');
    await expectViewportFit(page);
    if (width <= 900) await page.getByRole('button', { name: 'Menú', exact: true }).click();
    await page.locator('.studio-account').getByRole('button', { name: 'Salir', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Cerrar sesión' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test(`Atleta: entrenamiento y pestañas a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/dashboard?preview=athlete');
    await expect(page.locator('#start-session-btn')).toBeVisible();
    await expectViewportFit(page);
    if (width < 768) {
      await page.getByRole('button', { name: 'Progreso', exact: true }).click();
      await expect(page.getByText('Consistencia Semanal', { exact: false })).toBeVisible();
      await expectViewportFit(page);
      await page.getByRole('button', { name: 'Hoy', exact: true }).click();
    }
    await page.locator('#start-session-btn').click();
    await expect(page).toHaveURL(/\/session\/preview/);
    await expect(page.locator('.session-preview-root')).toBeVisible();
    await expectViewportFit(page);
    await page.locator('.session-preview-start-btn').click();
    await expect(page).toHaveURL(/\/session\/active/);
    await expect(page.locator('.active-session-root')).toBeVisible();
    await expectViewportFit(page);
  });
}

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 667 }, { width: 1440, height: 720 }]) {
  test(`Cabecera y portada completas a ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
    const header = await page.locator('.studio-auth-header').boundingBox();
    const title = await page.locator('#studio-auth-title').boundingBox();
    expect(header!.y).toBeGreaterThanOrEqual(0);
    expect(title!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
    await expectViewportFit(page);
  });
}

for (const width of [320, 768, 1440]) {
  test(`Administración y modales a ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/admin?preview=admin');
    await expect(page.locator('.studio-main')).toBeVisible();
    await expectViewportFit(page);
    await page.goto('/trainer?preview=trainer');
    await page.getByLabel('Buscar atleta').fill('Valeria');
    await page.getByText('Seguimiento y herramientas', { exact: true }).click();
    await page.getByRole('button', { name: 'Antropometría y macros', exact: true }).click();
    // The modal loads the PDF/chart modules on demand. Allow the same cold
    // startup budget as the boot guard, independently of layout assertions.
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });
    await expectViewportFit(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.getByRole('button', { name: 'Nutrición', exact: true }).click();
    await expect(page.locator('.nutrition-modal-window')).toBeVisible();
    await expectViewportFit(page);
    const size = await page.locator('.nutrition-modal-window').evaluate(e => ({ content:e.scrollWidth, viewport:e.clientWidth }));
    expect(size.content).toBeLessThanOrEqual(size.viewport + 1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.nutrition-modal-window')).toBeHidden();
  });

  test(`Herramientas del entrenador sin desbordar a ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/trainer/plan/test-client-id', '/trainer/config', '/trainer/branding']) {
      await page.goto(`${route}?preview=trainer`);
      await expect(page.locator('.studio-main')).toBeVisible();
      await expect(page.locator('.studio-main')).not.toContainText('Cargando');
      await expectViewportFit(page);
    }
    for (const route of ['/historial', '/analytics', '/biblioteca']) {
      await page.goto(`${route}?preview=athlete`);
      await expect(page.locator('.studio-main')).toBeVisible();
      await expect(page.locator('.studio-main')).not.toContainText('Cargando');
      await expectViewportFit(page);
    }
    await page.goto('/dashboard?preview=coached');
    await expect(page.locator('#start-session-btn')).toBeVisible({ timeout: 15000 });
    await expectViewportFit(page);
  });
}
