// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { bindPlanSnapshot, persistPlanSnapshot } from '../planCache';
beforeEach(() => localStorage.clear());
describe('Plan cache account boundary', () => {
  it('retains the authenticated account snapshot across reloads', () => {
    persistPlanSnapshot({ trainingDays: [] }, 'A'); bindPlanSnapshot('A');
    expect(localStorage.getItem('pwa_client_plan')).toBeTruthy();
  });
  it('archives a previous plan instead of displaying it to another account', () => {
    persistPlanSnapshot({ trainingDays: [] }, 'A'); bindPlanSnapshot('B');
    expect(localStorage.getItem('pwa_client_plan')).toBeNull();
    expect(localStorage.getItem('evolution:archived-plan:A')).toBeTruthy();
  });
});
