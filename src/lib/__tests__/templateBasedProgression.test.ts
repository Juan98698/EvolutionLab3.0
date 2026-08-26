// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { applyUndulatingWeek, applyDeloadBlock } from '../templateBasedProgression';

describe('applyUndulatingWeek', () => {
  const params = {
    seriesFuerza: '4', repsFuerza: '5', rirFuerza: '1',
    seriesHipertrofia: '3', repsHipertrofia: '10', rirHipertrofia: '2',
  };

  it('semana impar del bloque (1): aplica el perfil de FUERZA', () => {
    const r = applyUndulatingWeek(1, params);
    expect(r.esFuerza).toBe(true);
    expect(r.series).toBe('4');
    expect(r.repeticiones).toBe('5');
    expect(r.rir).toBe('1');
    expect(r.note).toContain('FUERZA');
  });

  it('semana par del bloque (2): aplica el perfil de HIPERTROFIA', () => {
    const r = applyUndulatingWeek(2, params);
    expect(r.esFuerza).toBe(false);
    expect(r.series).toBe('3');
    expect(r.repeticiones).toBe('10');
    expect(r.rir).toBe('2');
    expect(r.note).toContain('HIPERTROFIA');
  });

  it('alterna correctamente a lo largo de varias semanas (1,2,3,4 -> F,H,F,H)', () => {
    expect(applyUndulatingWeek(1, params).esFuerza).toBe(true);
    expect(applyUndulatingWeek(2, params).esFuerza).toBe(false);
    expect(applyUndulatingWeek(3, params).esFuerza).toBe(true);
    expect(applyUndulatingWeek(4, params).esFuerza).toBe(false);
  });

  it('usa defaults razonables si faltan parámetros', () => {
    const r = applyUndulatingWeek(1, {});
    expect(r.series).toBe('4');
    expect(r.repeticiones).toBe('5');
    expect(r.rir).toBe('1');
  });
});

describe('applyDeloadBlock', () => {
  const params = { duracion: 2, series: '2', rir: '3-4', reduccionVolumen: '50-60', cargaRecomendada: 'Moderada' };

  it('semana 0 (recién aplicado): vigente, aplica series/rir reducidos', () => {
    const r = applyDeloadBlock(0, params);
    expect(r.vigente).toBe(true);
    expect(r.series).toBe('2');
    expect(r.rir).toBe('3-4');
    expect(r.note).toContain('Semana 1 de 2');
    expect(r.note).toContain('moderada');
  });

  it('última semana del bloque (duracion-1): sigue vigente', () => {
    const r = applyDeloadBlock(1, params);
    expect(r.vigente).toBe(true);
    expect(r.note).toContain('Semana 2 de 2');
  });

  it('al llegar a la duración configurada: ya NO vigente, el llamador debe revertir', () => {
    const r = applyDeloadBlock(2, params);
    expect(r.vigente).toBe(false);
    expect(r.note).toContain('Descarga completada');
    expect(r.note).toContain('vuelve a tu progresión normal');
  });

  it('duración default (1 semana) si no se especifica', () => {
    const r0 = applyDeloadBlock(0, {});
    expect(r0.vigente).toBe(true);
    const r1 = applyDeloadBlock(1, {});
    expect(r1.vigente).toBe(false);
  });

  it('usa defaults razonables para series/rir si faltan', () => {
    const r = applyDeloadBlock(0, { duracion: 3 });
    expect(r.series).toBe('2');
    expect(r.rir).toBe('3-4');
  });
});
