// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isE2EContext } from '../e2eMode';

describe('isE2EContext', () => {
  const base = { userAgent: 'Mozilla/5.0 (iPhone)', search: '', playwrightFlag: undefined };

  it('detecta Playwright por el flag, el navegador headless o ?e2e=true', () => {
    expect(isE2EContext({ ...base, playwrightFlag: true })).toBe(true);
    expect(isE2EContext({ ...base, userAgent: 'Mozilla/5.0 HeadlessChrome/120' })).toBe(true);
    expect(isE2EContext({ ...base, search: '?e2e=true' })).toBe(true);
  });

  it('no se activa en un navegador normal ni con parámetros parecidos', () => {
    expect(isE2EContext(base)).toBe(false);
    expect(isE2EContext({ ...base, search: '?plan=premium&note=e2e=true-ish' })).toBe(false);
    expect(isE2EContext({ ...base, search: '?e2e=false' })).toBe(false);
  });
});

describe('supabaseClient: los stubs de E2E no tocan el cliente real', () => {
  afterEach(() => {
    delete (window as any)._playwright_test;
    vi.resetModules();
  });

  it('fuera de E2E, supabase.channel es el canal real de Realtime (antes siempre era un stub)', async () => {
    vi.resetModules();
    const { supabase } = await import('../supabaseClient');

    const channel = supabase.channel('plan-updates:test-user');
    expect(channel.topic).toBe('realtime:plan-updates:test-user');
    expect(typeof channel.send).toBe('function');
    await supabase.removeChannel(channel);
  });

  it('en E2E (Playwright) el canal sigue siendo un stub sin conexión', async () => {
    vi.resetModules();
    (window as any)._playwright_test = true;
    const { supabase } = await import('../supabaseClient');

    const channel: any = supabase.channel('plan-updates:test-user');
    expect(channel.topic).toBeUndefined();
    expect(channel.on('broadcast', {}, () => {})).toBe(channel);
  });
});
