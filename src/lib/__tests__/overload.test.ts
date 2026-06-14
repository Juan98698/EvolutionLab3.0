import { describe, it, expect } from 'vitest';
import {
  analizarSobrecargaProgresiva,
  Session,
  DEFAULT_OVERLOAD_CONFIG,
} from '../overload';
import { DEFAULT_RULES } from '../rules';
import { Rule } from '../../types/database.types';

/** Helper: sesión con volumen explícito (peso × suma de reps) */
const sesion = (
  id: string,
  fecha: string,
  ejercicio: string,
  peso: number,
  repsArray: number[],
  rpe: number,
  descanso = 90
): Session => ({
  id,
  fecha,
  ejercicio,
  peso,
  repsArray,
  rpe_rir: rpe,
  descanso,
  volumen: peso * repsArray.reduce((a, b) => a + b, 0),
});

const onlyRule = (id: string): Rule[] =>
  DEFAULT_RULES.filter((r) => r.id === id);

describe('analizarSobrecargaProgresiva', () => {
  it('returns empty array when no sessions', () => {
    expect(analizarSobrecargaProgresiva([])).toEqual([]);
  });

  it('fires primer_sesion on first session only', () => {
    const sessions = [sesion('1', '2023-01-01', 'Squat', 100, [5, 5, 5], 3)];
    const result = analizarSobrecargaProgresiva(sessions, onlyRule('primer_sesion'));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('primer_sesion');
    expect(result[0].tipo).toBe('info');
  });

  it('requires minSesiones before evaluating progression rules', () => {
    const sessions = [
      sesion('1', '2023-01-01', 'Squat', 100, [5, 5, 5], 3),
      sesion('2', '2023-01-08', 'Squat', 100, [5, 5, 5], 3),
    ];
    const result = analizarSobrecargaProgresiva(sessions, onlyRule('mantener_peso'));
    expect(result).toEqual([]);
  });

  it('detects subir_peso_reps when RIR is consistently high', () => {
    const sessions = [
      sesion('1', '2023-01-01', 'Squat', 100, [5, 5, 5], 4),
      sesion('2', '2023-01-08', 'Squat', 100, [5, 5, 5], 4),
      sesion('3', '2023-01-15', 'Squat', 100, [5, 5, 5], 4),
    ];
    const result = analizarSobrecargaProgresiva(sessions, onlyRule('subir_peso_reps'));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('subir_peso_reps');
    expect(result[0].tipo).toBe('success');
  });

  it('detects bajar_peso_rir_alto when RIR is low and volume drops', () => {
    const sessions = [
      sesion('1', '2023-01-01', 'Bench', 80, [10, 10, 10], 2),
      sesion('2', '2023-01-08', 'Bench', 80, [8, 8, 8], 0),
      sesion('3', '2023-01-15', 'Bench', 80, [6, 6, 6], 0),
      sesion('4', '2023-01-22', 'Bench', 80, [5, 5, 5], 0),
    ];
    const result = analizarSobrecargaProgresiva(sessions, onlyRule('bajar_peso_rir_alto'));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('bajar_peso_rir_alto');
    expect(result[0].tipo).toBe('warning');
  });

  it('detects descanso_excesivo after long break', () => {
    const sessions = [
      sesion('1', '2023-01-01', 'Deadlift', 150, [5, 5, 5], 2),
      sesion('2', '2023-01-08', 'Deadlift', 150, [5, 5, 5], 2),
      sesion('3', '2023-02-01', 'Deadlift', 150, [5, 5, 5], 2),
    ];
    const result = analizarSobrecargaProgresiva(
      sessions,
      onlyRule('descanso_excesivo'),
      { diasDescansoExcesivo: 14 }
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('descanso_excesivo');
  });

  it('detects mantener_peso when volume is stable', () => {
    const sessions = [
      sesion('1', '2023-01-01', 'Squat', 100, [5, 5, 5], 2),
      sesion('2', '2023-01-08', 'Squat', 100, [5, 5, 5], 2),
      sesion('3', '2023-01-15', 'Squat', 100, [5, 5, 5], 2),
    ];
    const result = analizarSobrecargaProgresiva(sessions, onlyRule('mantener_peso'));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('mantener_peso');
  });

  it('detects bajar_peso_regresion after consecutive volume drops', () => {
    const sessions = [
      sesion('1', '2023-01-01', 'Squat', 100, [10, 10, 10], 2),
      sesion('2', '2023-01-08', 'Squat', 100, [8, 8, 8], 1),
      sesion('3', '2023-01-15', 'Squat', 100, [6, 6, 6], 1),
      sesion('4', '2023-01-22', 'Squat', 100, [5, 5, 5], 0),
    ];
    const result = analizarSobrecargaProgresiva(sessions, onlyRule('bajar_peso_regresion'));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('bajar_peso_regresion');
  });

  it('detects subir_reps_antes_peso on volume growth streak', () => {
    const sessions = [
      sesion('1', '2023-01-01', 'Squat', 100, [5, 5, 5], 2),
      sesion('2', '2023-01-08', 'Squat', 100, [6, 6, 6], 2),
      sesion('3', '2023-01-15', 'Squat', 100, [7, 7, 7], 2),
    ];
    const result = analizarSobrecargaProgresiva(sessions, onlyRule('subir_reps_antes_peso'));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('subir_reps_antes_peso');
  });

  it('detects descanso_largo when rest is too long', () => {
    const sessions = [
      sesion('1', '2023-01-01', 'Squat', 100, [5, 5, 5], 2, 200),
      sesion('2', '2023-01-08', 'Squat', 100, [5, 5, 5], 2, 210),
      sesion('3', '2023-01-15', 'Squat', 100, [5, 5, 5], 2, 195),
    ];
    const result = analizarSobrecargaProgresiva(sessions, onlyRule('descanso_largo'));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('descanso_largo');
  });

  it('detects record_personal when 1RM improves', () => {
    const sessions = [
      sesion('1', '2023-01-01', 'Squat', 100, [5, 5, 5], 2),
      sesion('2', '2023-01-08', 'Squat', 100, [5, 5, 5], 2),
      sesion('3', '2023-01-15', 'Squat', 110, [8, 8, 8], 2),
    ];
    const result = analizarSobrecargaProgresiva(sessions, onlyRule('record_personal'));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('record_personal');
    expect(result[0].tipo).toBe('success');
  });

  it('detects racha_positiva after volume improves 3 sessions in a row', () => {
    const sessions = [
      sesion('1', '2023-01-01', 'Squat', 100, [5, 5, 5], 2),
      sesion('2', '2023-01-08', 'Squat', 100, [6, 6, 6], 2),
      sesion('3', '2023-01-15', 'Squat', 100, [7, 7, 7], 2),
      sesion('4', '2023-01-22', 'Squat', 100, [8, 8, 8], 2),
    ];
    const result = analizarSobrecargaProgresiva(sessions, onlyRule('racha_positiva'));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('racha_positiva');
  });

  it('ignores disabled rules', () => {
    const disabledRules: Rule[] = [
      {
        id: 'subir_peso_reps',
        tipo: 'subir',
        activa: false,
        titulo: 'Desactivada',
        mensaje: 'No debería aparecer',
        rir_umbral: 3,
        sesiones_consecutivas: 3,
      },
    ];
    const sessions = [
      sesion('1', '2023-01-01', 'Squat', 100, [5, 5, 5], 4),
      sesion('2', '2023-01-08', 'Squat', 100, [5, 5, 5], 4),
      sesion('3', '2023-01-15', 'Squat', 100, [5, 5, 5], 4),
    ];
    expect(analizarSobrecargaProgresiva(sessions, disabledRules)).toEqual([]);
  });

  it('does not fire when all rules are disabled', () => {
    const disabledAllRules: Rule[] = DEFAULT_RULES.map((r) => ({ ...r, activa: false }));
    const sessions = [
      sesion('1', '2023-01-01', 'Bench', 80, [5, 5, 5], 2),
      sesion('2', '2023-01-08', 'Bench', 85, [5, 5, 5], 2),
      sesion('3', '2023-01-15', 'Bench', 90, [5, 5, 5], 2),
    ];
    expect(analizarSobrecargaProgresiva(sessions, disabledAllRules)).toEqual([]);
  });

  it('uses default config values', () => {
    expect(DEFAULT_OVERLOAD_CONFIG.minSesiones).toBe(3);
    expect(DEFAULT_OVERLOAD_CONFIG.diasDescansoExcesivo).toBe(14);
  });

  describe('synergy with trainer progression strategies', () => {
    const exerciseDouble: any = {
      nombre: 'Squat',
      progression_type: 'double',
      progression_params: {
        series: '3',
        repsIniciales: '8',
        repsMaximas: '12',
        incremento: '2.5'
      }
    };

    const exerciseDeload: any = {
      nombre: 'Squat',
      progression_type: 'deload',
      progression_params: {
        series: '2',
        rir: '4'
      }
    };

    it('suppresses RIR weight increase in double progression when volume is not complete', () => {
      const sessions = [
        sesion('1', '2023-01-01', 'Squat', 100, [8, 8, 8], 4),
        sesion('2', '2023-01-08', 'Squat', 100, [8, 8, 8], 4),
        sesion('3', '2023-01-15', 'Squat', 100, [8, 8, 8], 4),
      ];
      // Normally, 3 sessions with RIR 4 would trigger subir_peso_reps
      const normalResult = analizarSobrecargaProgresiva(sessions, onlyRule('subir_peso_reps'), {});
      expect(normalResult).toHaveLength(1);

      // With double progression configured, it should suppress it since repsMaximas (12) is not hit yet
      const synergyResult = analizarSobrecargaProgresiva(sessions, onlyRule('subir_peso_reps'), {}, [exerciseDouble]);
      expect(synergyResult).toHaveLength(0);
    });

    it('suppresses regression warnings during deload strategy', () => {
      const sessions = [
        sesion('1', '2023-01-01', 'Squat', 100, [10, 10, 10], 2),
        sesion('2', '2023-01-08', 'Squat', 100, [8, 8, 8], 1),
        sesion('3', '2023-01-15', 'Squat', 100, [6, 6, 6], 1),
        sesion('4', '2023-01-22', 'Squat', 100, [5, 5, 5], 0),
      ];
      // Normally, consecutive volume drops trigger bajar_peso_regresion
      const normalResult = analizarSobrecargaProgresiva(sessions, onlyRule('bajar_peso_regresion'), {});
      expect(normalResult).toHaveLength(1);

      // During deload, this warning is suppressed since fat fatigue dissipation is planned
      const synergyResult = analizarSobrecargaProgresiva(sessions, onlyRule('bajar_peso_regresion'), {}, [exerciseDeload]);
      expect(synergyResult).toHaveLength(0);
    });
  });
});
