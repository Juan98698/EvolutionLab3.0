import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    // ── Desktop ─────────────────────────────────────────────────────────────
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Safari de escritorio — cubre el motor WebKit en macOS.
      // Detecta regresiones en CSS/JS que solo se manifiestan en el
      // renderizador de Apple (ej. gap en flexbox, backdrop-filter, etc.).
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'] },
    },

    // ── Mobile ───────────────────────────────────────────────────────────────
    {
      // iPhone 14 con WebKit — la misma ruta del atleta independiente que
      // quedó sin cobertura automática pese a todos los fixes de PWA /
      // caching / fuentes / accesibilidad táctil que se hicieron para mobile.
      // Este proyecto es la red de seguridad que faltaba: si algo se rompe
      // específicamente en Safari iOS, este proyecto lo detecta en el CI
      // antes de que llegue al usuario real.
      name: 'webkit-mobile',
      use: {
        ...devices['iPhone 14'],
        // Forzar el locale para que las pruebas que usan Intl (fechas,
        // formatos numéricos) sean deterministas independientemente del
        // entorno donde corra el CI.
        locale: 'es-AR',
        timezoneId: 'America/Argentina/Buenos_Aires',
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 15000,
  },
});
