// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';

let authCb: any = null;
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: any) => { authCb = cb; return { data: { subscription: { unsubscribe() {} } } }; },
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      getUser: vi.fn(() => Promise.resolve({ data: { user: null } })),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }), upsert: () => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
  },
}));
import { SupabaseProvider, useSupabase } from '../SupabaseContext';

let ctx: ReturnType<typeof useSupabase>;
const Probe = () => { ctx = useSupabase(); return <div>ok</div>; };
const hasReady = () => document.body.classList.contains('auth-ready');
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

describe('SupabaseContext - clase auth-ready (señal del boot-guard)', () => {
  it('se mantiene tras logout manual seguido del evento SIGNED_OUT', async () => {
    const r = render(<SupabaseProvider><Probe /></SupabaseProvider>);
    await act(async () => { await authCb('INITIAL_SESSION', { user: { id: 'u1' } }); });
    await act(async () => { await ctx.signOut(); });
    await act(async () => { await authCb('SIGNED_OUT', null); await nextFrame(); });
    expect(hasReady()).toBe(true);
    r.unmount();
  });

  it('se mantiene si la sesión expiró al abrir la app (INITIAL_SESSION null + SIGNED_OUT)', async () => {
    document.body.classList.remove('auth-ready');
    render(<SupabaseProvider><Probe /></SupabaseProvider>);
    await act(async () => { await authCb('INITIAL_SESSION', null); });
    await act(async () => { await authCb('SIGNED_OUT', null); await nextFrame(); });
    expect(hasReady()).toBe(true);
  });
});
