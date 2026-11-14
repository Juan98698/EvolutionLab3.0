import { useEffect, useRef, useState } from 'react';
import type { PlanData } from '../types/database.types';
import { supabase } from '../lib/supabaseClient';
import { normalizePlan } from '../lib/normalizePlan';
import { recalculatePlanWeights } from '../lib/periodizationEngine';
import { bindPlanSnapshot, persistPlanSnapshot } from '../lib/planCache';

type Callbacks = { showToast: (message: string, type: 'info' | 'error') => void; onUpdates: () => void; refreshProfile: () => void };
function prepare(plan: PlanData): PlanData {
  const normalized = normalizePlan(plan);
  const config = normalized.periodizationConfig;
  return config?.enabled && config.marcas_1rm && Object.keys(config.marcas_1rm).length
    ? { ...normalized, trainingDays: recalculatePlanWeights(normalized.trainingDays || [], config.marcas_1rm, config.formula_preferida, config.redondeo_peso) }
    : normalized;
}
function cachedPlan(userId: string | undefined): PlanData | null {
  if (!userId || localStorage.getItem('evolution_plan_owner') !== userId) return null;
  try {
    const raw = localStorage.getItem('pwa_client_plan');
    return raw ? prepare(JSON.parse(raw)) : null;
  } catch { return null; }
}

/** Owns network, offline recovery and realtime updates for one account. */
export function useAthletePlan(userId: string | undefined, isSoloClient: boolean, callbacks: Callbacks) {
  const [plan, setPlan] = useState<PlanData | null>(() => cachedPlan(userId));
  const [loadingPlan, setLoadingPlan] = useState(true);
  const latest = useRef(callbacks);
  latest.current = callbacks;
  useEffect(() => {
    let cancelled = false;
    let generation = 0;
    setPlan(cachedPlan(userId));
    if (!userId) { setLoadingPlan(false); return; }
    const fetchPlan = async () => {
      const request = ++generation;
      const stale = () => cancelled || request !== generation;
      setLoadingPlan(true);
      try {
        const { data, error } = await supabase.from('planes').select('*').eq('cliente_id', userId).eq('activo', true).order('created_at', { ascending: false }).limit(1);
        if (stale()) return;
        if (error) throw error;
        const row = data?.[0];
        if (!row?.datos_plan || !Object.keys(row.datos_plan).length) {
          // A successful empty response revokes the active snapshot. Offline
          // recovery is reserved for genuine transport/server failures.
          if (localStorage.getItem('evolution_plan_owner') === userId) bindPlanSnapshot(null);
          setPlan(null);
          if (!isSoloClient) latest.current.showToast('No tienes un plan activo asignado.', 'info');
          return;
        }
        let next = prepare(row.datos_plan);
        if (next.periodizationConfig?.has_new_updates) {
          latest.current.onUpdates();
          next = { ...next, periodizationConfig: { ...next.periodizationConfig, has_new_updates: false } };
          // Acknowledgement does not block displaying the received plan.
          void Promise.resolve(supabase.from('planes').update({ datos_plan: next }).eq('id', row.id)).catch(() => {});
        }
        setPlan(next);
        persistPlanSnapshot(next, userId);
      } catch {
        if (stale()) return;
        const local = cachedPlan(userId);
        setPlan(local);
        latest.current.showToast(local ? 'Plan cargado sin conexión.' : 'No pudimos cargar tu plan. Comprueba tu conexión.', local ? 'info' : 'error');
      } finally { if (!stale()) setLoadingPlan(false); }
    };
    void fetchPlan();
    const channel = supabase.channel(`plan-updates:${userId}`).on('broadcast', { event: 'plan-updated' }, () => {
      if (cancelled) return;
      void fetchPlan();
      latest.current.refreshProfile();
    }).subscribe();
    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [userId, isSoloClient]);
  return { plan, setPlan, loadingPlan };
}
