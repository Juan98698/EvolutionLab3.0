// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PeriodizationPanel } from '../PeriodizationPanel';
import type { PeriodizationConfig, TrainingDay } from '../../../types/database.types';

/**
 * Test de componente aislado para PeriodizationPanel.
 *
 * Cubre el hueco de cobertura señalado: ningún test existente monta este
 * panel directamente ni interactúa con sus controles. PlanPlanner.test.tsx
 * solo verifica que el componente padre carga sin warnings de keys — nunca
 * llega a la sección de periodización. Los tests del engine (periodizationRIR,
 * roadmapItems) prueban la lógica pura, pero no que la UI exponga y conecte
 * esa lógica correctamente a los clics del entrenador.
 *
 * Este archivo monta PeriodizationPanel con props mock mínimas y verifica:
 *   1. El toggle de rir_override_manual cambia el estado vía setConfig
 *   2. El selector de muscle_groups_in_focus aparece solo para avanzados
 *      y deriva sus opciones de los grupos musculares reales del plan
 *   3. Seleccionar/deseleccionar un grupo actualiza el array correctamente
 *   4. "Limpiar selección" vacía el array
 */

const baseConfig = (overrides: Partial<PeriodizationConfig> = {}): PeriodizationConfig => ({
  enabled:        true,
  objetivo:       'hipertrofia',
  nivel_atleta:   'intermedio',
  semana_actual:  1,
  total_semanas:  4,
  rir_inicial:    3,
  rir_progresion: 'normal',
  ...overrides,
});

const baseTrainingDays = (groups: string[] = ['Pecho', 'Espalda', 'Cuádriceps']): TrainingDay[] => [
  {
    id: 'day_1',
    name: 'Día A',
    exercises: groups.map((g, i) => ({
      id:             `ex_${i}`,
      nombre:         `Ejercicio ${g}`,
      grupo_muscular: g,
      variables: {
        'series de trabajo': '6',
        'repeticiones':      '10',
        'rir':                '2',
      },
    })),
  },
];

/** Renderiza el panel con un setConfig espiable que también re-renderiza con el nuevo estado */
function renderPanel(initialConfig: PeriodizationConfig, trainingDays: TrainingDay[] = baseTrainingDays()) {
  const setConfig = vi.fn();
  const setTrainingDays = vi.fn();
  const recalculatePlanWeights = vi.fn((days: TrainingDay[]) => days);
  const showToast = vi.fn();
  const onOpenHelpModal = vi.fn();
  const onOpenCalculator = vi.fn();

  const utils = render(
    <PeriodizationPanel
      config={initialConfig}
      setConfig={setConfig}
      trainingDays={trainingDays}
      setTrainingDays={setTrainingDays}
      languageMode="tecnico"
      recalculatePlanWeights={recalculatePlanWeights}
      showToast={showToast}
      onOpenHelpModal={onOpenHelpModal}
      onOpenCalculator={onOpenCalculator}
      weeklyTargets={{}}
    />
  );

  return { ...utils, setConfig, setTrainingDays, showToast };
}

/** Extrae el callback de actualización pasado al último setConfig(prev => ...) y lo aplica a un estado dado */
function applyLastSetConfigCall(setConfig: ReturnType<typeof vi.fn>, prevState: PeriodizationConfig): PeriodizationConfig | undefined {
  const lastCall = setConfig.mock.calls[setConfig.mock.calls.length - 1];
  const updater = lastCall[0];
  return typeof updater === 'function' ? updater(prevState) : updater;
}

describe('PeriodizationPanel — toggle rir_override_manual', () => {
  afterEach(cleanup);

  it('estado inicial sin override: muestra "RIR AUTOMÁTICO"', () => {
    renderPanel(baseConfig({ rir_override_manual: false }));
    expect(screen.getByText('🤖 RIR AUTOMÁTICO')).toBeDefined();
    expect(screen.queryByText('🔒 RIR MANUAL ACTIVO')).toBeNull();
  });

  it('estado inicial con override activo: muestra "RIR MANUAL ACTIVO"', () => {
    renderPanel(baseConfig({ rir_override_manual: true }));
    expect(screen.getByText('🔒 RIR MANUAL ACTIVO')).toBeDefined();
    expect(screen.queryByText('🤖 RIR AUTOMÁTICO')).toBeNull();
  });

  it('clic en el toggle (estado inicial OFF): invoca setConfig invirtiendo el flag a true', () => {
    const config = baseConfig({ rir_override_manual: false });
    const { setConfig } = renderPanel(config);

    fireEvent.click(screen.getByText('🤖 RIR AUTOMÁTICO'));

    expect(setConfig).toHaveBeenCalledTimes(1);
    const result = applyLastSetConfigCall(setConfig, config);
    expect(result?.rir_override_manual).toBe(true);
  });

  it('clic en el toggle (estado inicial ON): invoca setConfig invirtiendo el flag a false', () => {
    const config = baseConfig({ rir_override_manual: true });
    const { setConfig } = renderPanel(config);

    fireEvent.click(screen.getByText('🔒 RIR MANUAL ACTIVO'));

    expect(setConfig).toHaveBeenCalledTimes(1);
    const result = applyLastSetConfigCall(setConfig, config);
    expect(result?.rir_override_manual).toBe(false);
  });

  it('rir_override_manual undefined (nunca tocado): se trata como false ("RIR AUTOMÁTICO")', () => {
    const config = baseConfig();
    delete (config as any).rir_override_manual;
    renderPanel(config);
    expect(screen.getByText('🤖 RIR AUTOMÁTICO')).toBeDefined();
  });

  it('toggle no aparece si config.enabled es false (panel colapsado)', () => {
    renderPanel(baseConfig({ enabled: false }));
    expect(screen.queryByText('🤖 RIR AUTOMÁTICO')).toBeNull();
    expect(screen.queryByText('🔒 RIR MANUAL ACTIVO')).toBeNull();
  });
});

describe('PeriodizationPanel — selector muscle_groups_in_focus', () => {
  afterEach(cleanup);

  it('NO aparece para nivel intermedio', () => {
    renderPanel(baseConfig({ nivel_atleta: 'intermedio' }));
    expect(screen.queryByText('🎯 GRUPOS EN FOCO (opcional)')).toBeNull();
    expect(screen.queryByText('🎯 ESPECIALIZACIÓN ACTIVA')).toBeNull();
  });

  it('NO aparece para nivel principiante', () => {
    renderPanel(baseConfig({ nivel_atleta: 'principiante' }));
    expect(screen.queryByText('🎯 GRUPOS EN FOCO (opcional)')).toBeNull();
  });

  it('SÍ aparece para nivel avanzado, en estado "opcional" sin selección', () => {
    renderPanel(baseConfig({ nivel_atleta: 'avanzado', muscle_groups_in_focus: [] }));
    expect(screen.getByText('🎯 GRUPOS EN FOCO (opcional)')).toBeDefined();
    expect(screen.queryByText('🎯 ESPECIALIZACIÓN ACTIVA')).toBeNull();
  });

  it('con selección no vacía: cambia a estado "ESPECIALIZACIÓN ACTIVA"', () => {
    renderPanel(baseConfig({ nivel_atleta: 'avanzado', muscle_groups_in_focus: ['Pecho'] }));
    expect(screen.getByText('🎯 ESPECIALIZACIÓN ACTIVA')).toBeDefined();
    expect(screen.queryByText('🎯 GRUPOS EN FOCO (opcional)')).toBeNull();
  });

  it('avanzado sin ejercicios con grupo_muscular: no renderiza el selector (evita selector vacío)', () => {
    const trainingDays: TrainingDay[] = [{
      id: 'day_1', name: 'Día A',
      exercises: [{
        id: 'ex_1', nombre: 'Ejercicio sin grupo',
        variables: { 'series de trabajo': '6', 'repeticiones': '10', 'rir': '2' },
      }],
    }];
    renderPanel(baseConfig({ nivel_atleta: 'avanzado' }), trainingDays);
    expect(screen.queryByText('🎯 GRUPOS EN FOCO (opcional)')).toBeNull();
  });

  it('botones de grupo se derivan de los grupos musculares reales del plan (no hardcodeados)', () => {
    renderPanel(
      baseConfig({ nivel_atleta: 'avanzado' }),
      baseTrainingDays(['Bíceps', 'Tríceps'])
    );
    // Usar role=button para acotar al selector de foco — el nombre del grupo
    // también aparece en el panel de Auditoría MRV (<strong>{gm}</strong>),
    // así que getByText ambiguo fallaría por duplicado.
    expect(screen.getByRole('button', { name: 'Bíceps' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Tríceps' })).toBeDefined();
    // Grupos que no están en el plan no deben aparecer como botón
    expect(screen.queryByRole('button', { name: 'Pecho' })).toBeNull();
  });

  it('clic en un grupo no seleccionado: lo agrega al array muscle_groups_in_focus', () => {
    const config = baseConfig({ nivel_atleta: 'avanzado', muscle_groups_in_focus: [] });
    const { setConfig } = renderPanel(config);

    fireEvent.click(screen.getByRole('button', { name: 'Pecho' }));

    expect(setConfig).toHaveBeenCalledTimes(1);
    const result = applyLastSetConfigCall(setConfig, config);
    expect(result?.muscle_groups_in_focus).toEqual(['Pecho']);
  });

  it('clic en un grupo ya seleccionado: lo quita del array (toggle off)', () => {
    const config = baseConfig({ nivel_atleta: 'avanzado', muscle_groups_in_focus: ['Pecho', 'Espalda'] });
    const { setConfig } = renderPanel(config);

    fireEvent.click(screen.getByText('✓ Pecho'));

    expect(setConfig).toHaveBeenCalledTimes(1);
    const result = applyLastSetConfigCall(setConfig, config);
    expect(result?.muscle_groups_in_focus).toEqual(['Espalda']);
  });

  it('"Limpiar selección" solo aparece cuando hay especialización activa', () => {
    renderPanel(baseConfig({ nivel_atleta: 'avanzado', muscle_groups_in_focus: [] }));
    expect(screen.queryByText(/Limpiar selección/)).toBeNull();

    cleanup();
    renderPanel(baseConfig({ nivel_atleta: 'avanzado', muscle_groups_in_focus: ['Pecho'] }));
    expect(screen.getByText(/Limpiar selección/)).toBeDefined();
  });

  it('clic en "Limpiar selección": vacía muscle_groups_in_focus', () => {
    const config = baseConfig({ nivel_atleta: 'avanzado', muscle_groups_in_focus: ['Pecho', 'Espalda'] });
    const { setConfig } = renderPanel(config);

    fireEvent.click(screen.getByText(/Limpiar selección/));

    expect(setConfig).toHaveBeenCalledTimes(1);
    const result = applyLastSetConfigCall(setConfig, config);
    expect(result?.muscle_groups_in_focus).toEqual([]);
  });

  it('múltiples grupos pueden estar en foco simultáneamente (no es selección única)', () => {
    const config = baseConfig({ nivel_atleta: 'avanzado', muscle_groups_in_focus: ['Pecho'] });
    const { setConfig } = renderPanel(config);

    // "Pecho" ya está seleccionado (botón con prefijo ✓); clic en "Espalda" (no seleccionado aún)
    fireEvent.click(screen.getByRole('button', { name: 'Espalda' }));

    const result = applyLastSetConfigCall(setConfig, config);
    expect(result?.muscle_groups_in_focus).toEqual(['Pecho', 'Espalda']);
  });
});

describe('PeriodizationPanel — interacción entre ambos controles', () => {
  afterEach(cleanup);

  it('activar rir_override_manual no afecta la visibilidad del selector de grupos', () => {
    renderPanel(baseConfig({ nivel_atleta: 'avanzado', rir_override_manual: true, muscle_groups_in_focus: [] }));
    expect(screen.getByText('🔒 RIR MANUAL ACTIVO')).toBeDefined();
    expect(screen.getByText('🎯 GRUPOS EN FOCO (opcional)')).toBeDefined();
  });

  it('ambos controles conviven sin pisarse: cada uno invoca setConfig de forma independiente', () => {
    const config = baseConfig({ nivel_atleta: 'avanzado', rir_override_manual: false, muscle_groups_in_focus: [] });
    const { setConfig } = renderPanel(config);

    fireEvent.click(screen.getByText('🤖 RIR AUTOMÁTICO'));
    const afterToggle = applyLastSetConfigCall(setConfig, config);
    expect(afterToggle?.rir_override_manual).toBe(true);
    expect(afterToggle?.muscle_groups_in_focus).toEqual([]); // intacto

    setConfig.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Pecho' }));
    const afterGroupClick = applyLastSetConfigCall(setConfig, afterToggle!);
    expect(afterGroupClick?.muscle_groups_in_focus).toEqual(['Pecho']);
    expect(afterGroupClick?.rir_override_manual).toBe(true); // intacto, no se resetea
  });
});
