// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  mergeSkeletonIntoExistingPlan,
  mergeProtocolIntoExistingPlan,
  normalizeMuscleGroup,
  GeneratedSession
} from '../planMerger';
import { TrainingDay, Exercise } from '../../types/database.types';

describe('planMerger Module', () => {
  describe('normalizeMuscleGroup', () => {
    it('normaliza variaciones con acentos, inglés y sinónimos', () => {
      expect(normalizeMuscleGroup('pecho')).toBe('Pecho');
      expect(normalizeMuscleGroup('Chest')).toBe('Pecho');
      expect(normalizeMuscleGroup('cuadriceps')).toBe('Cuádriceps');
      expect(normalizeMuscleGroup('isquiotibiales')).toBe('Isquiosurales');
      expect(normalizeMuscleGroup('isquiosurales')).toBe('Isquiosurales');
      expect(normalizeMuscleGroup('gluteo')).toBe('Glúteos');
      expect(normalizeMuscleGroup('biceps')).toBe('Bíceps');
      expect(normalizeMuscleGroup('triceps')).toBe('Tríceps');
      expect(normalizeMuscleGroup('gemelos')).toBe('Pantorrillas');
      expect(normalizeMuscleGroup('abdomen')).toBe('Core');
    });
  });

  describe('mergeSkeletonIntoExistingPlan', () => {
    it('conserva ejercicios reales existentes y actualiza sus series de trabajo con el volumen del esqueleto', () => {
      const existingDays: TrainingDay[] = [
        {
          id: 'day_1',
          name: 'Día 1: Pecho y Espalda',
          exercises: [
            {
              id: 'ex_1',
              nombre: 'Press Inclinado con Mancuernas',
              nombre_original: 'Press Inclinado con Mancuernas',
              grupo_muscular: 'Pecho',
              image_url: 'https://cdn.fit/press.jpg',
              gif_url: 'https://cdn.fit/press.gif',
              variables: { 'series de trabajo': '3', 'repeticiones': '10' }
            } as Exercise,
            {
              id: 'ex_2',
              nombre: 'Remo con Barra',
              nombre_original: 'Remo con Barra',
              grupo_muscular: 'Espalda',
              image_url: 'https://cdn.fit/remo.jpg',
              gif_url: 'https://cdn.fit/remo.gif',
              variables: { 'series de trabajo': '3', 'repeticiones': '10' }
            } as Exercise
          ]
        }
      ];

      const sessions: GeneratedSession[] = [
        {
          id: 'sess_1',
          label: 'Día 1: Pecho y Espalda',
          muscleTargets: [
            { muscleGroup: 'Pecho', plannedSets: 5 },
            { muscleGroup: 'Espalda', plannedSets: 4 }
          ]
        }
      ];

      const result = mergeSkeletonIntoExistingPlan(sessions, existingDays, []);

      expect(result).toHaveLength(1);
      const exercises = result[0].exercises;
      expect(exercises).toHaveLength(2);

      // Verificar que el ejercicio de Pecho conserva su nombre y multimedia, pero actualiza sus series a 5
      const pechoEx = exercises.find(e => e.grupo_muscular === 'Pecho');
      expect(pechoEx?.nombre).toBe('Press Inclinado con Mancuernas');
      expect(pechoEx?.gif_url).toBe('https://cdn.fit/press.gif');
      expect(pechoEx?.variables['series de trabajo']).toBe('5');

      // Verificar que el ejercicio de Espalda conserva su nombre y multimedia, pero actualiza sus series a 4
      const espaldaEx = exercises.find(e => e.grupo_muscular === 'Espalda');
      expect(espaldaEx?.nombre).toBe('Remo con Barra');
      expect(espaldaEx?.gif_url).toBe('https://cdn.fit/remo.gif');
      expect(espaldaEx?.variables['series de trabajo']).toBe('4');
    });

    it('crea un placeholder sólo para grupos musculares sin ejercicios previos', () => {
      const existingDays: TrainingDay[] = [
        {
          id: 'day_1',
          name: 'Día 1: Torso',
          exercises: [
            {
              id: 'ex_1',
              nombre: 'Press de Banca',
              nombre_original: 'Press de Banca',
              grupo_muscular: 'Pecho',
              variables: { 'series de trabajo': '3' }
            } as Exercise
          ]
        }
      ];

      const sessions: GeneratedSession[] = [
        {
          id: 'sess_1',
          label: 'Día 1: Torso',
          muscleTargets: [
            { muscleGroup: 'Pecho', plannedSets: 4 },
            { muscleGroup: 'Tríceps', plannedSets: 3 }
          ]
        }
      ];

      const result = mergeSkeletonIntoExistingPlan(sessions, existingDays, []);
      const exercises = result[0].exercises;
      expect(exercises).toHaveLength(2);

      const pechoEx = exercises.find(e => e.grupo_muscular === 'Pecho');
      expect(pechoEx?.nombre).toBe('Press de Banca');
      expect(pechoEx?.variables['series de trabajo']).toBe('4');

      const tricepsEx = exercises.find(e => e.grupo_muscular === 'Tríceps');
      expect(tricepsEx?.nombre).toBe('[ ESPACIO PARA: TRÍCEPS ]');
      expect(tricepsEx?.variables['series de trabajo']).toBe('3');
    });

    it('reparte los ejercicios reales entre slots repetidos del mismo grupo muscular en vez de que el primero se los quede todos', () => {
      // Caso hipotético: el esqueleto pide dos slots de "Pecho" el mismo día (hoy ningún
      // generador real hace esto, pero la función debe seguir siendo correcta si algún
      // split personalizado futuro lo permite).
      const existingDays: TrainingDay[] = [
        {
          id: 'day_1',
          name: 'Día 1: Pecho Doble',
          exercises: [
            {
              id: 'ex_1',
              nombre: 'Press de Banca',
              nombre_original: 'Press de Banca',
              grupo_muscular: 'Pecho',
              variables: { 'series de trabajo': '3' }
            } as Exercise,
            {
              id: 'ex_2',
              nombre: 'Aperturas con Mancuernas',
              nombre_original: 'Aperturas con Mancuernas',
              grupo_muscular: 'Pecho',
              variables: { 'series de trabajo': '3' }
            } as Exercise
          ]
        }
      ];

      const sessions: GeneratedSession[] = [
        {
          id: 'sess_1',
          label: 'Día 1: Pecho Doble',
          muscleTargets: [
            { muscleGroup: 'Pecho', plannedSets: 4 },
            { muscleGroup: 'Pecho', plannedSets: 3 }
          ]
        }
      ];

      const result = mergeSkeletonIntoExistingPlan(sessions, existingDays, []);
      const exercises = result[0].exercises;

      // Ambos ejercicios reales deben sobrevivir — ninguno debe convertirse en placeholder.
      expect(exercises).toHaveLength(2);
      expect(exercises.every(e => !e.nombre.startsWith('[ ESPACIO PARA:'))).toBe(true);

      const nombres = exercises.map(e => e.nombre).sort();
      expect(nombres).toEqual(['Aperturas con Mancuernas', 'Press de Banca']);
    });

    it('crea placeholder solo para los slots repetidos que exceden los ejercicios reales disponibles', () => {
      const existingDays: TrainingDay[] = [
        {
          id: 'day_1',
          name: 'Día 1: Pecho Doble',
          exercises: [
            {
              id: 'ex_1',
              nombre: 'Press de Banca',
              nombre_original: 'Press de Banca',
              grupo_muscular: 'Pecho',
              variables: { 'series de trabajo': '3' }
            } as Exercise
          ]
        }
      ];

      const sessions: GeneratedSession[] = [
        {
          id: 'sess_1',
          label: 'Día 1: Pecho Doble',
          muscleTargets: [
            { muscleGroup: 'Pecho', plannedSets: 4 },
            { muscleGroup: 'Pecho', plannedSets: 3 }
          ]
        }
      ];

      const result = mergeSkeletonIntoExistingPlan(sessions, existingDays, []);
      const exercises = result[0].exercises;

      expect(exercises).toHaveLength(2);
      // El único ejercicio real existente se conserva (no se pierde ni se duplica)...
      expect(exercises.filter(e => e.nombre === 'Press de Banca')).toHaveLength(1);
      // ...y el segundo slot, al no tener un ejercicio real disponible, cae en placeholder.
      expect(exercises.filter(e => e.nombre === '[ ESPACIO PARA: PECHO ]')).toHaveLength(1);
    });
  });

  describe('mergeProtocolIntoExistingPlan', () => {
    it('fusiona los ejercicios reales de un protocolo en los slots del esqueleto preservando las series de trabajo planificadas', () => {
      const existingSkeletonDays: TrainingDay[] = [
        {
          id: 'day_1',
          name: 'Empuje',
          exercises: [
            {
              id: 'p_1',
              nombre: '[ ESPACIO PARA: PECHO ]',
              grupo_muscular: 'Pecho',
              variables: { 'series de trabajo': '5' }
            } as Exercise,
            {
              id: 'p_2',
              nombre: '[ ESPACIO PARA: HOMBROS ]',
              grupo_muscular: 'Hombros',
              variables: { 'series de trabajo': '4' }
            } as Exercise
          ]
        }
      ];

      const protocolDays: TrainingDay[] = [
        {
          id: 'proto_day_1',
          name: 'Empuje',
          exercises: [
            {
              id: 'proto_ex_1',
              nombre: 'Press Militar con Barra',
              nombre_original: 'Press Militar con Barra',
              grupo_muscular: 'Hombros',
              gif_url: 'https://cdn.fit/militar.gif',
              variables: { 'series de trabajo': '3' }
            } as Exercise,
            {
              id: 'proto_ex_2',
              nombre: 'Press Inclinado con Mancuernas',
              nombre_original: 'Press Inclinado con Mancuernas',
              grupo_muscular: 'Pecho',
              gif_url: 'https://cdn.fit/inclinado.gif',
              variables: { 'series de trabajo': '3' }
            } as Exercise
          ]
        }
      ];

      const result = mergeProtocolIntoExistingPlan(protocolDays, existingSkeletonDays, true);
      const exercises = result[0].exercises;

      const hombrosEx = exercises.find(e => e.grupo_muscular === 'Hombros');
      expect(hombrosEx?.nombre).toBe('Press Militar con Barra');
      expect(hombrosEx?.gif_url).toBe('https://cdn.fit/militar.gif');
      // Debe conservar las 4 series planificadas en el esqueleto
      expect(hombrosEx?.variables['series de trabajo']).toBe('4');

      const pechoEx = exercises.find(e => e.grupo_muscular === 'Pecho');
      expect(pechoEx?.nombre).toBe('Press Inclinado con Mancuernas');
      expect(pechoEx?.gif_url).toBe('https://cdn.fit/inclinado.gif');
      // Debe conservar las 5 series planificadas en el esqueleto
      expect(pechoEx?.variables['series de trabajo']).toBe('5');
    });
  });
});
