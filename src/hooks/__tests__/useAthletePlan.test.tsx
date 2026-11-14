// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAthletePlan } from '../useAthletePlan';
import type { PlanData } from '../../types/database.types';

const { limit, channel } = vi.hoisted(() => ({ limit: vi.fn(), channel: vi.fn() }));
vi.mock('../../lib/supabaseClient', () => ({ supabase: {
  from: () => { const b = { select: () => b, eq: () => b, order: () => b, limit }; return b; },
  channel, removeChannel: vi.fn(),
} }));
const plan = (name: string) => ({ portada: { userName: name }, trainingDays: [], globalVariables: [] }) as unknown as PlanData;
const callbacks = { showToast: vi.fn(), refreshProfile: vi.fn(), onUpdates: vi.fn() };
beforeEach(() => {
  localStorage.clear(); limit.mockReset();
  channel.mockImplementation(() => { const c = { on: () => c, subscribe: () => c }; return c; });
});
afterEach(cleanup);

describe('Account-owned plan loading', () => {
  it('does not apply or persist a late response from the previous account', async () => {
    let finishA!: (value: unknown) => void;
    limit.mockImplementationOnce(() => new Promise(resolve => { finishA = resolve; }))
      .mockResolvedValueOnce({ data: [{ id: 'plan-b', datos_plan: plan('B') }], error: null });
    const hook = renderHook(({ id }) => useAthletePlan(id, true, callbacks), { initialProps: { id: 'a' } });
    hook.rerender({ id: 'b' });
    await waitFor(() => expect(hook.result.current.plan?.portada?.userName).toBe('B'));
    await act(async () => { finishA({ data: [{ id: 'plan-a', datos_plan: plan('A') }], error: null }); });
    expect(hook.result.current.plan?.portada?.userName).toBe('B');
    expect(localStorage.getItem('evolution_plan_owner')).toBe('b');
    expect(JSON.parse(localStorage.getItem('pwa_client_plan')!).portada.userName).toBe('B');
  });
  it('archives an old snapshot when the server confirms there is no active plan', async () => {
    localStorage.setItem('evolution_plan_owner', 'a');
    localStorage.setItem('pwa_client_plan', JSON.stringify(plan('Old')));
    limit.mockResolvedValue({ data: [], error: null });
    const hook = renderHook(() => useAthletePlan('a', true, callbacks));
    await waitFor(() => expect(hook.result.current.loadingPlan).toBe(false));
    expect(hook.result.current.plan).toBeNull();
    expect(localStorage.getItem('pwa_client_plan')).toBeNull();
    expect(localStorage.getItem('evolution:archived-plan:a')).toContain('Old');
  });
  it('recovers the current account snapshot on a network failure', async () => {
    localStorage.setItem('evolution_plan_owner', 'a');
    localStorage.setItem('pwa_client_plan', JSON.stringify(plan('Offline')));
    limit.mockRejectedValue(new Error('offline'));
    const hook = renderHook(() => useAthletePlan('a', true, callbacks));
    await waitFor(() => expect(hook.result.current.loadingPlan).toBe(false));
    expect(hook.result.current.plan?.portada?.userName).toBe('Offline');
  });
  it('never recovers a different account snapshot on a network failure', async () => {
    localStorage.setItem('evolution_plan_owner', 'a');
    localStorage.setItem('pwa_client_plan', JSON.stringify(plan('Private A')));
    limit.mockRejectedValue(new Error('offline'));
    const hook = renderHook(() => useAthletePlan('b', true, callbacks));
    await waitFor(() => expect(hook.result.current.loadingPlan).toBe(false));
    expect(hook.result.current.plan).toBeNull();
  });
});
