import { describe, expect, it } from 'vitest';
import { normalizePlan } from '../normalizePlan';
import type { PlanData } from '../../types/database.types';

describe('Historical plan normalization', () => {
  it('normalizes aliases without mutating input or adding phantom exercises', () => {
    const input = { globalVariables: [{ id: 'gv_reps', defaultValue: '8' }], trainingDays: [{ id: 'a', exercises: [{ id: 'x', nombre: 'Press', variables: { gv_series: '4' } }] }] } as unknown as PlanData;
    const before = JSON.stringify(input);
    const output = normalizePlan(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(output.trainingDays![0].exercises).toHaveLength(1);
    expect(output.trainingDays![0].exercises[0].variables).toMatchObject({ repeticiones: '8', 'series de trabajo': '4' });
    expect(output.globalVariables!.filter(v => v.id === 'repeticiones')).toHaveLength(1);
  });
  it('retains custom variables and functional exercise fields', () => {
    const input = { globalVariables: [{ id: 'segundos', label: 'Duración', type: 'number', defaultValue: '30' }], trainingDays: [{ id: 'a', exercises: [{ id: 'x', nombre: 'Plancha', variables: { segundos: '45' }, block_id: 'block', transition_rest: 20 }] }] } as unknown as PlanData;
    const exercise = normalizePlan(input).trainingDays![0].exercises[0];
    expect(exercise).toMatchObject({ variables: { segundos: '45' }, block_id: 'block', transition_rest: 20 });
  });
});
