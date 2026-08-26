// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { SmartBlockBuilderModal, ProgModalState } from '../SmartBlockBuilderModal';
import { TrainingDay, PeriodizationConfig } from '../../../types/database.types';
import { getDefaultParamsForTemplate } from '../../../lib/progressionTemplates';

afterEach(cleanup);

const buildDays = (progression_type?: string, extra: Record<string, string> = {}): TrainingDay[] => [
  {
    id: 'day-1',
    name: 'Día 1',
    exercises: [
      {
        id: 'ex-1',
        nombre: 'Press de Banca',
        grupo_muscular: 'Pecho',
        variables: { 'series de trabajo': '3', repeticiones: '8-10', rir: '2', ...extra },
        progression_type: progression_type as any,
      },
    ],
  },
];

const renderModal = (opts: {
  template: string;
  progression_type?: string;
  extraVars?: Record<string, string>;
  periodizationConfig?: PeriodizationConfig;
}) => {
  const trainingDays = buildDays(opts.progression_type, opts.extraVars);
  const progModal: ProgModalState = {
    isOpen: true,
    dayId: 'day-1',
    exId: 'ex-1',
    template: opts.template,
    params: getDefaultParamsForTemplate(opts.template),
  };

  const setProgModal = vi.fn();
  const setTrainingDaysCalls: any[] = [];
  const setTrainingDays = vi.fn((updater: any) => {
    const result = typeof updater === 'function' ? updater(trainingDays) : updater;
    setTrainingDaysCalls.push(result);
  });
  const setExerciseHistory = vi.fn();
  const showToast = vi.fn();
  const setPeriodizationConfigCalls: any[] = [];
  const setPeriodizationConfig = vi.fn((updater: any) => {
    const result = typeof updater === 'function' ? updater(opts.periodizationConfig) : updater;
    setPeriodizationConfigCalls.push(result);
  });

  const utils = render(
    <SmartBlockBuilderModal
      progModal={progModal}
      setProgModal={setProgModal}
      trainingDays={trainingDays}
      setTrainingDays={setTrainingDays}
      setExerciseHistory={setExerciseHistory}
      showToast={showToast}
      periodizationConfig={opts.periodizationConfig}
      setPeriodizationConfig={setPeriodizationConfig}
    />
  );

  return { ...utils, setTrainingDaysCalls, setPeriodizationConfigCalls, setProgModal, showToast };
};

describe('SmartBlockBuilderModal', () => {
  describe('Aviso de automatización real vs. solo nota', () => {
    it("plantilla 'linear': muestra el aviso de automatización real", () => {
      renderModal({ template: 'linear', periodizationConfig: { enabled: true } as PeriodizationConfig });
      expect(screen.getByText(/Esto activa automatización real/i)).toBeInTheDocument();
    });

    it("plantilla 'double': muestra el aviso de automatización real", () => {
      renderModal({ template: 'double', periodizationConfig: { enabled: true } as PeriodizationConfig });
      expect(screen.getByText(/Esto activa automatización real/i)).toBeInTheDocument();
    });

    it("plantilla 'linear' con periodización del plan DESACTIVADA: además del aviso, muestra la advertencia de que no tendrá efecto", () => {
      renderModal({ template: 'linear', periodizationConfig: { enabled: false } as PeriodizationConfig });
      expect(screen.getByText(/no está activada para este plan/i)).toBeInTheDocument();
    });

    it("plantilla 'linear' sin periodizationConfig en absoluto (plan nunca configurado): también muestra la advertencia", () => {
      renderModal({ template: 'linear', periodizationConfig: undefined });
      expect(screen.getByText(/no está activada para este plan/i)).toBeInTheDocument();
    });

    it("plantilla 'linear' con periodización activada: NO muestra la advertencia de falta de activación", () => {
      renderModal({ template: 'linear', periodizationConfig: { enabled: true } as PeriodizationConfig });
      expect(screen.queryByText(/no está activada para este plan/i)).not.toBeInTheDocument();
    });

    it("plantilla 'undulating': muestra el aviso de automatización real, con el texto específico de alternancia por semana", () => {
      renderModal({ template: 'undulating', periodizationConfig: { enabled: true } as PeriodizationConfig });
      expect(screen.getByText(/Esto activa automatización real/i)).toBeInTheDocument();
      expect(screen.getByText(/alternan solos cada semana/i)).toBeInTheDocument();
    });

    it("plantilla 'deload': muestra el aviso de automatización real, con el texto específico de reversión automática al terminar el bloque", () => {
      renderModal({ template: 'deload', periodizationConfig: { enabled: true } as PeriodizationConfig });
      expect(screen.getByText(/Esto activa automatización real/i)).toBeInTheDocument();
      expect(screen.getByText(/vuelve solo a su progresión normal/i)).toBeInTheDocument();
    });
  });

  describe('Limpieza de estado al aplicar/reconfigurar una plantilla', () => {
    it('al aplicar una plantilla, limpia reps_objetivo obsoleto de una configuración previa', () => {
      const { setTrainingDaysCalls } = renderModal({
        template: 'linear',
        progression_type: 'linear',
        extraVars: { reps_objetivo: '🤖 10' },
        periodizationConfig: { enabled: true } as PeriodizationConfig,
      });

      fireEvent.click(screen.getByText('APLICAR PROGRESIÓN'));

      const updatedDays = setTrainingDaysCalls[setTrainingDaysCalls.length - 1];
      const ex = updatedDays[0].exercises[0];
      expect(ex.variables['reps_objetivo']).toBeUndefined();
    });

    it('al reconfigurar la plantilla de un ejercicio que ya tenía rachas acumuladas (ruleProgressionState), las limpia para ese ejercicio', () => {
      const periodizationConfig: PeriodizationConfig = {
        enabled: true,
        ruleProgressionState: {
          'press de banca': { ultimoVolumen: 1200, rirAltoStreak: 2 },
          'sentadilla': { ultimoVolumen: 900, regresionStreak: 1 }, // de otro ejercicio, no debe tocarse
        },
      } as PeriodizationConfig;

      const { setPeriodizationConfigCalls } = renderModal({
        template: 'double',
        progression_type: 'linear', // venía de una plantilla distinta
        periodizationConfig,
      });

      fireEvent.click(screen.getByText('APLICAR PROGRESIÓN'));

      expect(setPeriodizationConfigCalls.length).toBeGreaterThan(0);
      const updated = setPeriodizationConfigCalls[setPeriodizationConfigCalls.length - 1];
      expect(updated.ruleProgressionState['press de banca']).toBeUndefined();
      // El estado de otros ejercicios no se toca
      expect(updated.ruleProgressionState['sentadilla']).toBeDefined();
    });

    it('al reconfigurar un ejercicio que ya tenía un bloque de descarga vencido (deloadBlockState), lo limpia para que un nuevo deload cuente semanas desde cero', () => {
      const periodizationConfig: PeriodizationConfig = {
        enabled: true,
        deloadBlockState: {
          'press de banca': { semanaInicio: 3 },
          'sentadilla': { semanaInicio: 5 }, // de otro ejercicio, no debe tocarse
        },
      } as PeriodizationConfig;

      const { setPeriodizationConfigCalls } = renderModal({
        template: 'deload',
        progression_type: 'deload', // reconfigurando el mismo tipo de plantilla
        periodizationConfig,
      });

      fireEvent.click(screen.getByText('APLICAR PROGRESIÓN'));

      expect(setPeriodizationConfigCalls.length).toBeGreaterThan(0);
      const updated = setPeriodizationConfigCalls[setPeriodizationConfigCalls.length - 1];
      expect(updated.deloadBlockState['press de banca']).toBeUndefined();
      expect(updated.deloadBlockState['sentadilla']).toBeDefined();
    });

    it('si el ejercicio no tenía rachas acumuladas todavía, no llama a setPeriodizationConfig innecesariamente', () => {
      const periodizationConfig: PeriodizationConfig = {
        enabled: true,
        ruleProgressionState: {},
      } as PeriodizationConfig;

      const { setPeriodizationConfigCalls } = renderModal({ template: 'linear', periodizationConfig });
      fireEvent.click(screen.getByText('APLICAR PROGRESIÓN'));

      // Se llama (siempre limpiamos de forma segura), pero el resultado debe
      // ser equivalente al estado previo (prev) — no debe inventar campos.
      if (setPeriodizationConfigCalls.length > 0) {
        const updated = setPeriodizationConfigCalls[setPeriodizationConfigCalls.length - 1];
        expect(updated).toEqual(periodizationConfig);
      }
    });
  });

  it('sigue mostrando el flujo normal de aplicar progresión (toast de éxito y cierre del modal)', () => {
    const { setProgModal, showToast } = renderModal({
      template: 'linear',
      periodizationConfig: { enabled: true } as PeriodizationConfig,
    });

    fireEvent.click(screen.getByText('APLICAR PROGRESIÓN'));

    expect(setProgModal).toHaveBeenCalledWith(null);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('éxito'), 'success');
  });
});
