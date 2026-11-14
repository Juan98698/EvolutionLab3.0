import { test, expect } from '@playwright/test';

test('recuperación por código conserva la sesión hasta guardar la contraseña', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/login?recovery=code');
  // A first visit also performs the existing service-worker/cache cleanup.
  await expect(page.getByRole('heading', { name: 'Verifica tu correo' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel('Nueva contraseña', { exact: false })).toHaveCount(0);
  await page.getByLabel('Correo electrónico').fill('recovery@example.com');
  await page.getByLabel('Código de recuperación').fill('000000');
  await page.getByRole('button', { name: 'Verificar código' }).click();
  await expect(page.getByRole('alert')).toContainText('El código no es válido o venció');
  await expect(page.getByLabel('Nueva contraseña', { exact: false })).toHaveCount(0);

  await page.getByRole('button', { name: 'Solicitar un código nuevo' }).click();
  await page.getByRole('button', { name: 'Enviar código de recuperación' }).click();
  await expect(page.getByRole('status')).toContainText('recibirás un código');
  await page.getByLabel('Código de recuperación').fill('123456');
  await page.getByRole('button', { name: 'Verificar código' }).click();
  await expect(page.getByRole('heading', { name: 'Elige una nueva contraseña' })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  // A page reload during recovery must keep the verified identity in this tab.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Elige una nueva contraseña' })).toBeVisible({ timeout: 15000 });
  await page.getByLabel('Nueva contraseña (Mín. 6 caracteres)', { exact: true }).fill('test-password-only');
  await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill('test-password-only');
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText('Auth session missing!')).toHaveCount(0);
});
