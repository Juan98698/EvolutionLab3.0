// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';

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

  it('una bandera de navegador nunca sustituye el cliente real por mocks', async () => {
    vi.resetModules();
    (window as any)._playwright_test = true;
    const { supabase } = await import('../supabaseClient');

    const channel: any = supabase.channel('plan-updates:test-user');
    expect(channel.topic).toBe('realtime:plan-updates:test-user');
    expect(typeof channel.send).toBe('function');
    await supabase.removeChannel(channel);
  });

  it('solo el adaptador separado del servidor E2E instala canales ficticios', async () => {
    vi.resetModules();
    const { supabase } = await import('../../../e2e/support/supabaseClient');
    const channel: any = supabase.channel('plan-updates:test-user');
    expect(channel.topic).toBeUndefined();
    expect(channel.on('broadcast', {}, () => {})).toBe(channel);
  });
});
