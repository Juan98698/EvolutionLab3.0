import { test, expect } from '@playwright/test';

test('Portada de producción: Android, CPU ×4 y red limitada', async ({ page, context }, testInfo) => {
  // Use the real production build, no mocked identities or fixture bundle.
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 100_000 });
  await page.addInitScript(() => {
    const metrics = { lcp: 0, cls: 0 };
    Object.assign(window, { __studioMetrics: metrics });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) metrics.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) { const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number }; if (!shift.hadRecentInput) metrics.cls += shift.value; } }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Tu próximo paso. Una mejor versión.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(750);
  const result = await page.evaluate(() => ({
    ...(window as unknown as { __studioMetrics: { lcp: number; cls: number } }).__studioMetrics,
    domReady: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).domContentLoadedEventEnd,
    bytes: performance.getEntriesByType('resource').reduce((sum, item) => sum + (item as PerformanceResourceTiming).transferSize, 0),
    width: document.documentElement.clientWidth, contentWidth: document.documentElement.scrollWidth,
  }));
  await testInfo.attach('production-mobile-metrics.json', { body: JSON.stringify({ profile: 'CPU x4, 1.6 Mbps, 150 ms latency, Pixel 5 viewport', ...result }, null, 2), contentType: 'application/json' });
  console.log('Production mobile metrics:', JSON.stringify(result));
  expect(result.lcp).toBeGreaterThan(0);
  expect(result.lcp).toBeLessThan(6_000);
  expect(result.bytes).toBeLessThan(400_000);
  expect(result.cls).toBeLessThanOrEqual(0.1);
  expect(result.contentWidth).toBeLessThanOrEqual(result.width + 1);
});
