import type { PlanData } from '../types/database.types';

/** Compatibility snapshot for existing screens, with explicit account provenance. */
export function persistPlanSnapshot(plan: PlanData, userId: string): void {
  localStorage.setItem('pwa_client_plan', JSON.stringify(plan));
  localStorage.setItem('evolution_plan_owner', userId);
}

export function bindPlanSnapshot(userId: string | null): void {
  if (userId && localStorage.getItem('evolution_plan_owner') === userId) return;
  const previous = localStorage.getItem('pwa_client_plan');
  if (previous) {
    const owner = localStorage.getItem('evolution_plan_owner') || 'unassigned';
    localStorage.setItem(`evolution:archived-plan:${owner}`, previous);
  }
  localStorage.removeItem('pwa_client_plan');
  localStorage.removeItem('evolution_plan_owner');
}
