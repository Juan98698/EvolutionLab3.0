import type { GlobalVariable, PlanData } from '../types/database.types';

const defaults: GlobalVariable[] = [
  { id: 'series de aproximacion', label: 'SERIES DE APROXIMACION', type: 'number', defaultValue: '2' },
  { id: 'series de trabajo', label: 'SERIES DE TRABAJO', type: 'text', defaultValue: '3' },
  { id: 'repeticiones', label: 'REPETICIONES', type: 'text', defaultValue: '10-12' },
  { id: 'tempo', label: 'TEMPO', type: 'text', defaultValue: '2:1:1' },
  { id: 'rir', label: 'RIR', type: 'number', defaultValue: '2' },
  { id: 'descanso', label: 'DESCANSO(MIN)', type: 'number', defaultValue: '2' },
  { id: 'peso', label: 'PESO(KG)', type: 'text', defaultValue: '10' },
];
const aliases: Record<string, string> = {
  gv_series: 'series de trabajo', gv_reps: 'repeticiones', gv_rir: 'rir',
  gv_descanso: 'descanso', gv_peso: 'peso', gv_tempo: 'tempo', gv_aproximacion: 'series de aproximacion',
};
const canonical = (id: string) => aliases[id.toLowerCase().trim()] || id.toLowerCase().trim();

/** Normalize historical formats without mutating the source or inventing exercises. */
export function normalizePlan(plan: PlanData): PlanData {
  const current = plan.globalVariables || [];
  const variables = defaults.map(v => ({ ...v, defaultValue: current.find(old => canonical(old.id) === v.id)?.defaultValue || v.defaultValue }));
  for (const custom of current) {
    if (!variables.some(v => v.id === canonical(custom.id))) variables.push({ ...custom });
  }
  return {
    ...plan, globalVariables: variables,
    trainingDays: (plan.trainingDays || []).map(day => ({
      ...day,
      exercises: (day.exercises || []).map((exercise, index) => {
        const legacy = exercise as typeof exercise & { name?: string; videoUrl?: string; imageData?: string; gifData?: string };
        const values = Object.fromEntries(Object.entries(exercise.variables || {}).map(([key, value]) => [canonical(key), String(value ?? '')]));
        for (const variable of variables) if (!values[variable.id]) values[variable.id] = variable.defaultValue;
        return {
          ...exercise, id: exercise.id || `${day.id}-exercise-${index}`,
          nombre: exercise.nombre ?? legacy.name ?? '', variables: values,
          video_url: exercise.video_url ?? legacy.videoUrl ?? '',
          image_url: exercise.image_url ?? legacy.imageData ?? '', gif_url: exercise.gif_url ?? legacy.gifData ?? '',
        };
      }),
    })),
  };
}
