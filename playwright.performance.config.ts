import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', testMatch: 'performance.spec.ts', timeout: 60000,
  workers: 1, reporter: 'list',
  outputDir: 'performance-results',
  use: { ...devices['Pixel 5'], baseURL: 'http://127.0.0.1:5180' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 5180 --strictPort',
    url: 'http://127.0.0.1:5180', reuseExistingServer: false,
  },
});
