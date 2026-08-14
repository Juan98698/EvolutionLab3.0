// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { isFunctionalExercise, isHypertrophyExercise } from '../../../lib/exerciseUtils';
import { ExerciseCard } from '../ExerciseCard';

describe('Functional Exercises Architecture & Component Protection Tests', () => {
  afterEach(() => {
    cleanup();
  });

  describe('isFunctionalExercise Helper Unit Tests', () => {
    it('identifica correctamente ejercicios por categoría funcional o HIIT', () => {
      expect(isFunctionalExercise({ nombre: 'Burpees', categoria: 'funcional' })).toBe(true);
      expect(isFunctionalExercise({ nombre: 'Sprints', categoria: 'hiit' })).toBe(true);
      expect(isFunctionalExercise({ nombre: 'Assault Bike', categoria: 'cardio' })).toBe(true);
    });

    it('identifica ejercicios con tipo_metrica de tiempo o reps_tiempo', () => {
      expect(isFunctionalExercise({ nombre: 'Azote de Cuerda', tipo_metrica: 'tiempo' })).toBe(true);
      expect(isFunctionalExercise({ nombre: 'Wall Ball', tipo_metrica: 'reps_tiempo' })).toBe(true);
      expect(isFunctionalExercise({ nombre: 'Sled Push', tipo_metrica: 'distancia_peso' })).toBe(true);
    });

    it('identifica ejercicios con grupo_muscular "Full Body"', () => {
      expect(isFunctionalExercise({ nombre: 'Kettlebell Swings', grupo_muscular: 'Full Body' })).toBe(true);
    });

    it('retorna false para ejercicios tradicionales de musculación e hipertrofia', () => {
      expect(isFunctionalExercise({ nombre: 'Press Banca', categoria: 'musculacion', grupo_muscular: 'Pecho', tipo_metrica: 'peso_reps' })).toBe(false);
      expect(isHypertrophyExercise({ nombre: 'Sentadilla', grupo_muscular: 'Cuádriceps' })).toBe(true);
    });
  });

  describe('ExerciseCard SVG Iconography Tests', () => {
    it('renderiza íconos monocromáticos SVG con stroke="currentColor" para variables funcionales', () => {
      const exercise = {
        id: 'ej-funcional-1',
        dia_id: 'dia-1',
        nombre: 'Battle Ropes',
        orden: 1,
        variables: {
          'rondas': '5',
          'tiempo de trabajo': '40s',
          'tiempo de descanso': '20s'
        }
      };

      const globalVariables = [
        { id: 'rondas', label: 'Rondas', type: 'number', defaultValue: '3' },
        { id: 'tiempo de trabajo', label: 'Tiempo de trabajo', type: 'text', defaultValue: '30s' },
        { id: 'tiempo de descanso', label: 'Tiempo de descanso', type: 'text', defaultValue: '15s' }
      ];

      render(
        <ExerciseCard
          exercise={exercise as any}
          dayId="dia-1"
          globalVariables={globalVariables as any}
          variableDefinitions={{}}
          isChecked={false}
          onToggleCheck={() => {}}
        />
      );

      // Verificar que rendered badges contengan SVG monocromático con stroke="currentColor"
      const badges = document.querySelectorAll('.var-badge');
      expect(badges.length).toBeGreaterThan(0);

      badges.forEach(badge => {
        const svg = badge.querySelector('svg');
        expect(svg).toBeTruthy();
        expect(svg?.getAttribute('stroke')).toBe('currentColor');
      });
    });
  });
});
