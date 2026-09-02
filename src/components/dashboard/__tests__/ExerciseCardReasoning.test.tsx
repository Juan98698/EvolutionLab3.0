// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { ExerciseCard } from '../ExerciseCard';
import { WorkoutCard } from '../WorkoutCard';
import { Exercise, GlobalVariable, PeriodizationConfig, TrainingDay } from '../../../types/database.types';

describe('ExerciseCard & WorkoutCard Robot Reasoning Tooltip Tests', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockGlobalVariables: GlobalVariable[] = [
    { id: 'series de trabajo', label: 'Series de Trabajo', type: 'number', defaultValue: '3' },
    { id: 'repeticiones', label: 'Repeticiones', type: 'text', defaultValue: '10' },
    { id: 'rir', label: 'RIR', type: 'number', defaultValue: '2' },
    { id: 'descanso', label: 'Descanso', type: 'number', defaultValue: '2' },
    { id: 'peso', label: 'Peso', type: 'text', defaultValue: '0' }
  ];

  const mockVariableDefinitions: Record<string, string> = {
    'peso': 'Carga externa movilizada en cada repetición.',
    'rir': 'Repeticiones en Reserva antes del fallo muscular.'
  };

  const mockPeriodizationConfig: PeriodizationConfig = {
    enabled: true,
    objetivo: 'hipertrofia',
    nivel_atleta: 'intermedio',
    formula_preferida: 'epley',
    redondeo_peso: 2.5,
    marcas_1rm: {
      'sentadilla libre con barra': 80,
      'sentadilla': 80
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * 1. PRUEBAS A CORTO PLAZO: Interacción Directa con el Robot 🤖
   * ───────────────────────────────────────────────────────────────────────── */
  describe('Corto Plazo: Interacción y Desglose Científico del Robot 🤖', () => {
    it('renderiza la variable calibrada con el botón interactivo del robot y badge destacado', () => {
      const exercise: Exercise = {
        id: 'ex-1',
        nombre: 'Sentadilla libre con barra',
        variables: {
          'series de trabajo': '4',
          'repeticiones': '10',
          'rir': '2',
          'descanso': '2',
          'peso': '🤖 47.5 kg'
        },
        progression_notes: 'Buena recuperación y estímulo moderado. Se incrementa +1 serie para avanzar hacia el MAV.'
      };

      const { container } = render(
        <ExerciseCard
          exercise={exercise}
          dayId="day-1"
          globalVariables={mockGlobalVariables}
          variableDefinitions={mockVariableDefinitions}
          isChecked={false}
          onToggleCheck={vi.fn()}
          periodizationConfig={mockPeriodizationConfig}
        />
      );

      // Debe tener el badge auto-calibrado
      const autoBadge = container.querySelector('.var-badge.badge-auto-calibrated');
      expect(autoBadge).toBeTruthy();

      // Debe renderizar el botón del robot con título explicativo
      const robotBtn = container.querySelector('button[title*="motivo del ajuste"]');
      expect(robotBtn).toBeTruthy();
      expect(robotBtn?.textContent).toContain('47.5 kg');
    });

    it('al hacer clic en el robot 🤖 se despliega el panel con 1RM, fórmula de Epley y pauta del entrenador', () => {
      const exercise: Exercise = {
        id: 'ex-1',
        nombre: 'Sentadilla libre con barra',
        variables: {
          'series de trabajo': '4',
          'repeticiones': '10',
          'rir': '2',
          'descanso': '2',
          'peso': '🤖 47.5 kg'
        },
        progression_notes: 'Buena recuperación y estímulo moderado. Se incrementa +1 serie para avanzar hacia el MAV.'
      };

      const { container } = render(
        <ExerciseCard
          exercise={exercise}
          dayId="day-1"
          globalVariables={mockGlobalVariables}
          variableDefinitions={mockVariableDefinitions}
          isChecked={false}
          onToggleCheck={vi.fn()}
          periodizationConfig={mockPeriodizationConfig}
        />
      );

      const robotTrigger = container.querySelector('.reasoning-tooltip-trigger');
      expect(robotTrigger).toBeTruthy();

      // Antes del clic, el panel no está visible
      expect(container.querySelector('.reasoning-panel')).toBeNull();

      // Clic para abrir
      fireEvent.click(robotTrigger!);

      // Ahora el panel debe estar abierto
      const panel = container.querySelector('.reasoning-panel');
      expect(panel).toBeTruthy();

      // Verifica los elementos del desglose
      expect(panel?.textContent).toContain('Ajuste Automático de Carga');
      expect(panel?.textContent).toContain('Sentadilla libre con barra');
      expect(panel?.textContent).toContain('¿Por qué este valor?');
      expect(panel?.textContent).toContain('Objetivo de la Sesión');
      expect(panel?.textContent).toContain('57.5 kg'); // Resultado calculado
      expect(panel?.textContent).toContain('Buena recuperación y estímulo moderado'); // Pauta

      // Desplegar el cálculo matemático colapsado
      const mathToggleBtn = screen.getByRole('button', { name: /cálculo matemático/i });
      fireEvent.click(mathToggleBtn);
      expect(panel?.textContent).toContain('80 kg'); // 1RM
      expect(panel?.textContent).toContain('Epley'); // Fórmula

      // Segundo clic en trigger o botón ¡A ENTRENAR! para cerrar
      const actionBtn = screen.getByRole('button', { name: /¡A ENTRENAR!/i });
      fireEvent.click(actionBtn);
      expect(container.querySelector('.reasoning-panel')).toBeNull();
    });

    it('soporta calibración inteligente en el campo de Repeticiones y muestra explicación clara', () => {
      const exerciseWithReps: Exercise = {
        id: 'ex-reps',
        nombre: 'Press Militar con Mancuernas',
        variables: {
          'repeticiones': '🤖 12',
          'peso': '20 kg'
        },
        progression_notes: 'Reps incrementadas a 12 para acumular volumen antes de subir peso.'
      };

      const { container } = render(
        <ExerciseCard
          exercise={exerciseWithReps}
          dayId="day-1"
          globalVariables={mockGlobalVariables}
          variableDefinitions={mockVariableDefinitions}
          isChecked={false}
          onToggleCheck={vi.fn()}
          periodizationConfig={mockPeriodizationConfig}
        />
      );

      // Debe haber badge auto-calibrado para repeticiones
      const repsBadge = container.querySelector('.var-badge.badge-auto-calibrated');
      expect(repsBadge).toBeTruthy();
      expect(repsBadge?.textContent).toContain('12');

      const trigger = container.querySelector('.reasoning-tooltip-trigger');
      fireEvent.click(trigger!);

      const panel = container.querySelector('.reasoning-panel');
      expect(panel).toBeTruthy();
      expect(panel?.textContent).toContain('Ajuste Automático de Repeticiones');
      expect(panel?.textContent).toContain('Press Militar con Mancuernas');
      expect(panel?.textContent).toContain('12');
      expect(panel?.textContent).toContain('Reps incrementadas a 12');
    });
  });

  /* ─────────────────────────────────────────────────────────────────────────
   * 2. PRUEBAS A MEDIO PLAZO: Fórmulas Dinámicas y Sobrecarga Adaptativa
   * ───────────────────────────────────────────────────────────────────────── */
  describe('Medio Plazo: Fórmulas Configurables y Reglas de Sobrecarga', () => {
    it('muestra la fórmula de Brzycki cuando el entrenador la selecciona como preferida', () => {
      const brzyckiConfig: PeriodizationConfig = {
        ...mockPeriodizationConfig,
        formula_preferida: 'brzycki'
      };

      const exercise: Exercise = {
        id: 'ex-2',
        nombre: 'Sentadilla libre con barra',
        variables: {
          'repeticiones': '8',
          'rir': '2',
          'peso': '🤖 55 kg'
        }
      };

      const { container } = render(
        <ExerciseCard
          exercise={exercise}
          dayId="day-1"
          globalVariables={mockGlobalVariables}
          variableDefinitions={mockVariableDefinitions}
          isChecked={false}
          onToggleCheck={vi.fn()}
          periodizationConfig={brzyckiConfig}
        />
      );

      const trigger = container.querySelector('.reasoning-tooltip-trigger');
      fireEvent.click(trigger!);

      // Abrir acordeón matemático
      const mathToggleBtn = screen.getByRole('button', { name: /cálculo matemático/i });
      fireEvent.click(mathToggleBtn);

      const panel = container.querySelector('.reasoning-panel');
      expect(panel).toBeTruthy();
      expect(panel?.textContent).toContain('Brzycki');
    });

    it('proporciona desglose de Sobrecarga Progresiva aun cuando el ejercicio no tenga 1RM directo registrado', () => {
      const exercise: Exercise = {
        id: 'ex-3',
        nombre: 'Elevaciones Laterales con Mancuerna',
        variables: {
          'repeticiones': '12',
          'peso': '🤖 12.5 kg'
        },
        progression_notes: '🤖 Rango completado con RIR 1. Se incrementa peso a 12.5 kg.'
      };

      const { container } = render(
        <ExerciseCard
          exercise={exercise}
          dayId="day-1"
          globalVariables={mockGlobalVariables}
          variableDefinitions={mockVariableDefinitions}
          isChecked={false}
          onToggleCheck={vi.fn()}
          periodizationConfig={mockPeriodizationConfig}
        />
      );

      const trigger = container.querySelector('.reasoning-tooltip-trigger');
      fireEvent.click(trigger!);

      const panel = container.querySelector('.reasoning-panel');
      expect(panel).toBeTruthy();
      expect(panel?.textContent).toContain('Sobrecarga Progresiva de Carga');
      expect(panel?.textContent).toContain('12.5 kg');
      expect(panel?.textContent).toContain('Rango completado con RIR 1');
    });
  });

  /* ─────────────────────────────────────────────────────────────────────────
   * 3. PRUEBAS A LARGO PLAZO: Jerarquía de Componentes, Accesibilidad y Robustez
   * ───────────────────────────────────────────────────────────────────────── */
  describe('Largo Plazo: Jerarquía WorkoutCard -> ExerciseList -> ExerciseCard y Accesibilidad', () => {
    it('propaga periodizationConfig desde WorkoutCard hasta el panel del robot del ejercicio', () => {
      const mockDay: TrainingDay = {
        id: 'day-leg-1',
        name: 'Día 1: Pierna Pesada',
        exercises: [
          {
            id: 'ex-leg-1',
            nombre: 'Sentadilla libre con barra',
            variables: {
              'repeticiones': '10',
              'rir': '2',
              'peso': '🤖 47.5 kg'
            }
          }
        ]
      };

      const { container } = render(
        <WorkoutCard
          day={mockDay}
          globalVariables={mockGlobalVariables}
          variableDefinitions={mockVariableDefinitions}
          checkedExerciseIds={[]}
          onToggleCheck={vi.fn()}
          periodizationConfig={mockPeriodizationConfig}
        />
      );

      // Verificar que el badge del robot existe dentro de WorkoutCard
      const robotBtn = container.querySelector('button[title*="motivo del ajuste"]');
      expect(robotBtn).toBeTruthy();

      // Abrir el panel desde dentro de WorkoutCard
      fireEvent.click(robotBtn!);
      expect(container.querySelector('.reasoning-panel')).toBeTruthy();
      expect(container.querySelector('.reasoning-panel')?.textContent).toContain('57.5 kg');
    });

    it('permite abrir y cerrar el panel de razonamiento usando el teclado (Enter y Espacio)', () => {
      const exercise: Exercise = {
        id: 'ex-kbd',
        nombre: 'Sentadilla libre con barra',
        variables: {
          'repeticiones': '10',
          'rir': '2',
          'peso': '🤖 47.5 kg'
        }
      };

      const { container } = render(
        <ExerciseCard
          exercise={exercise}
          dayId="day-1"
          globalVariables={mockGlobalVariables}
          variableDefinitions={mockVariableDefinitions}
          isChecked={false}
          onToggleCheck={vi.fn()}
          periodizationConfig={mockPeriodizationConfig}
        />
      );

      const trigger = container.querySelector('.reasoning-tooltip-trigger') as HTMLElement;
      expect(trigger).toBeTruthy();

      // Enter abre el panel
      fireEvent.keyDown(trigger, { key: 'Enter' });
      expect(container.querySelector('.reasoning-panel')).toBeTruthy();

      // Espacio lo cierra
      fireEvent.keyDown(trigger, { key: ' ' });
      expect(container.querySelector('.reasoning-panel')).toBeNull();
    });

    it('mantiene el comportamiento estándar para variables normales sin robot y permite abrir la guía teórica (i)', () => {
      const onShowGuideMock = vi.fn();
      const exercise: Exercise = {
        id: 'ex-normal',
        nombre: 'Press Banca',
        variables: {
          'repeticiones': '10',
          'peso': '60 kg'
        }
      };

      const { container } = render(
        <ExerciseCard
          exercise={exercise}
          dayId="day-1"
          globalVariables={mockGlobalVariables}
          variableDefinitions={mockVariableDefinitions}
          isChecked={false}
          onToggleCheck={vi.fn()}
          onShowGuide={onShowGuideMock}
          periodizationConfig={mockPeriodizationConfig}
        />
      );

      // No debe tener badge de robot
      expect(container.querySelector('.badge-auto-calibrated')).toBeNull();
      expect(container.querySelector('.reasoning-tooltip-trigger')).toBeNull();

      // El botón ⓘ debe funcionar abriendo la guía general
      const infoBtn = screen.getByRole('button', { name: /Ver definición de Peso/i });
      fireEvent.click(infoBtn);
      expect(onShowGuideMock).toHaveBeenCalledWith('Peso', 'Carga externa movilizada en cada repetición.');
    });
  });
});
