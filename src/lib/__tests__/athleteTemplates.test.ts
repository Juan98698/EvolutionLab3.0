// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAthleteTemplates,
  saveAthleteTemplate,
  deleteAthleteTemplate,
  convertLocalDaysToTrainingDays,
  convertTrainingDaysToLocalDays,
  LocalDay
} from '../athleteTemplates';

describe('AthleteTemplates Module (Independent Athlete Local Persistence)', () => {
  const athleteId = 'ath_user_123';

  beforeEach(() => {
    localStorage.clear();
  });

  const sampleDays: LocalDay[] = [
    {
      id: 'day_1',
      name: 'Día 1: Pecho & Tríceps',
      exercises: [
        { id: 'ex_1', nombre: 'Press de Banca Plano', grupoMuscular: 'Pecho', variables: { series: '3', reps: '10' } }
      ]
    }
  ];

  it('saves and reads personal athlete templates from localStorage', () => {
    expect(getAthleteTemplates(athleteId)).toEqual([]);

    const saved = saveAthleteTemplate({
      athlete_id: athleteId,
      nombre: 'Mi Rutina de Volumen 4 Días',
      descripcion: 'Enfoque en pectorales',
      days: sampleDays
    });

    expect(saved.id).toBeDefined();
    expect(saved.nombre).toBe('Mi Rutina de Volumen 4 Días');
    expect(saved.days.length).toBe(1);

    const list = getAthleteTemplates(athleteId);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(saved.id);
  });

  it('deletes an athlete template correctly', () => {
    const saved = saveAthleteTemplate({
      athlete_id: athleteId,
      nombre: 'Rutina a Eliminar',
      days: sampleDays
    });

    expect(getAthleteTemplates(athleteId).length).toBe(1);

    const success = deleteAthleteTemplate(athleteId, saved.id);
    expect(success).toBe(true);
    expect(getAthleteTemplates(athleteId)).toEqual([]);
  });

  it('converts LocalDay[] to TrainingDay[] and vice versa seamlessly', () => {
    const trainingDays = convertLocalDaysToTrainingDays(sampleDays);
    expect(trainingDays.length).toBe(1);
    expect(trainingDays[0].name).toBe('Día 1: Pecho & Tríceps');
    expect(trainingDays[0].exercises[0].name).toBe('Press de Banca Plano');
    expect(trainingDays[0].exercises[0].muscle_group).toBe('Pecho');

    const backToLocal = convertTrainingDaysToLocalDays(trainingDays);
    expect(backToLocal.length).toBe(1);
    expect(backToLocal[0].name).toBe('Día 1: Pecho & Tríceps');
    expect(backToLocal[0].exercises[0].nombre).toBe('Press de Banca Plano');
  });
});
