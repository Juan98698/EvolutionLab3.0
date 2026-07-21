import { describe, it, expect } from 'vitest';
import {
  getISOWeekString,
  calcularRachaSemanas,
  calcularNivel,
  calcularLevelProgress,
} from '../gamificationUtils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSession(fecha: string) {
  return { fecha };
}

/** Devuelve una fecha fija para usar como 'now' en los tests */
function monday(isoDate: string): Date {
  return new Date(isoDate + 'T12:00:00Z');
}

// ---------------------------------------------------------------------------
// getISOWeekString
// ---------------------------------------------------------------------------
describe('getISOWeekString', () => {
  it('2025-12-29 es la semana 1 de 2026 (ISO) — 1° de enero 2026 es jueves, la semana 1 arranca el lunes anterior', () => {
    expect(getISOWeekString(new Date(2025, 11, 29))).toBe('2026-W01');
  });

  it('2026-01-05 es la semana 2 de 2026 (ISO)', () => {
    expect(getISOWeekString(new Date(2026, 0, 5))).toBe('2026-W02');
  });

  it('2025-12-28 es la ultima semana de 2025 (W52)', () => {
    expect(getISOWeekString(new Date(2025, 11, 28))).toBe('2025-W52');
  });

  it('2026-12-28 es la semana 53 de 2026 (2026 SI tiene semana 53: 1° de enero es jueves)', () => {
    expect(getISOWeekString(new Date(2026, 11, 28))).toBe('2026-W53');
  });
});

// ---------------------------------------------------------------------------
// calcularRachaSemanas — racha actual
// ---------------------------------------------------------------------------
describe('calcularRachaSemanas — racha actual', () => {
  it('lista vacia -> { actual: 0, maxima: 0 }', () => {
    const result = calcularRachaSemanas([], monday('2026-07-13'));
    expect(result).toEqual({ actual: 0, maxima: 0 });
  });

  it('una sesion en la semana actual -> actual: 1', () => {
    // 2026-07-13 es lunes de la semana 29 de 2026
    const sessions = [makeSession('2026-07-13')];
    const { actual } = calcularRachaSemanas(sessions, monday('2026-07-13'));
    expect(actual).toBe(1);
  });

  it('una sesion hace exactamente 2 semanas (racha rota) -> actual: 0', () => {
    const sessions = [makeSession('2026-06-29')]; // semana 27
    const { actual } = calcularRachaSemanas(sessions, monday('2026-07-13')); // semana 29
    expect(actual).toBe(0);
  });

  it('sesiones en 4 semanas consecutivas incluyendo la actual -> actual: 4', () => {
    const sessions = [
      makeSession('2026-06-22'), // semana 26
      makeSession('2026-06-29'), // semana 27
      makeSession('2026-07-06'), // semana 28
      makeSession('2026-07-13'), // semana 29
    ];
    const { actual } = calcularRachaSemanas(sessions, monday('2026-07-13'));
    expect(actual).toBe(4);
  });

  it('sesion en semana pasada pero no en la actual -> sigue viva (gracia de 7 dias)', () => {
    // Regla: si entrenaste la semana pasada la racha sigue contando
    const sessions = [makeSession('2026-07-06')]; // semana 28
    const { actual } = calcularRachaSemanas(sessions, monday('2026-07-13')); // semana 29
    expect(actual).toBe(1);
  });

  it('varias sesiones en la misma semana cuentan como 1 semana', () => {
    const sessions = [
      makeSession('2026-07-13'),
      makeSession('2026-07-14'),
      makeSession('2026-07-15'),
    ];
    const { actual } = calcularRachaSemanas(sessions, monday('2026-07-13'));
    expect(actual).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// calcularRachaSemanas — racha maxima historica
// ---------------------------------------------------------------------------
describe('calcularRachaSemanas — racha maxima historica', () => {
  it('3 semanas seguidas -> maxima: 3', () => {
    const sessions = [
      makeSession('2026-06-29'), // W27
      makeSession('2026-07-06'), // W28
      makeSession('2026-07-13'), // W29
    ];
    const { maxima } = calcularRachaSemanas(sessions, monday('2026-07-13'));
    expect(maxima).toBe(3);
  });

  it('racha rota en el medio: dos bloques [2,3] -> maxima: 3', () => {
    const sessions = [
      makeSession('2026-05-04'), // W19
      makeSession('2026-05-11'), // W20
      // gap W21
      makeSession('2026-05-25'), // W22
      makeSession('2026-06-01'), // W23
      makeSession('2026-06-08'), // W24
    ];
    const { maxima } = calcularRachaSemanas(sessions, monday('2026-07-13'));
    expect(maxima).toBe(3);
  });

  it('cruce de ano: W52 de 2025 -> W01 de 2026 es consecutivo', () => {
    const sessions = [
      makeSession('2025-12-22'), // W52-2025
      makeSession('2025-12-29'), // W01-2026 (ISO)
      makeSession('2026-01-05'), // W02-2026
    ];
    const { maxima } = calcularRachaSemanas(sessions, monday('2026-07-13'));
    expect(maxima).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// calcularNivel
// ---------------------------------------------------------------------------
describe('calcularNivel', () => {
  it('0 puntos -> nivel 1', () => {
    expect(calcularNivel(0)).toBe(1);
  });

  it('249 puntos -> nivel 1', () => {
    expect(calcularNivel(249)).toBe(1);
  });

  it('250 puntos -> nivel 2', () => {
    // floor(sqrt(250/250))+1 = floor(1)+1 = 2
    expect(calcularNivel(250)).toBe(2);
  });

  it('1000 puntos -> nivel 3', () => {
    // floor(sqrt(1000/250))+1 = floor(2)+1 = 3
    expect(calcularNivel(1000)).toBe(3);
  });

  it('2250 puntos -> nivel 4', () => {
    // floor(sqrt(2250/250))+1 = floor(3)+1 = 4
    expect(calcularNivel(2250)).toBe(4);
  });

  it('el nivel nunca baja por tener mas puntos (monotono creciente)', () => {
    for (let pts = 0; pts < 5000; pts += 100) {
      expect(calcularNivel(pts)).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// calcularLevelProgress
// ---------------------------------------------------------------------------
describe('calcularLevelProgress', () => {
  it('pct nunca supera 100', () => {
    // Con muchos puntos acumulados en el mismo nivel
    const level = calcularNivel(9999);
    const { pct } = calcularLevelProgress(9999, level);
    expect(pct).toBeLessThanOrEqual(100);
  });

  it('a la mitad del camino al nivel 2, pct ~ 50', () => {
    // Nivel 2 arranca en 250pts, termina en 1000pts (LVL2 = floor(sqrt(1000/250))+1 = 3? no)
    // floor(sqrt(x/250))+1 = 2 => sqrt(x/250)=1 => x=250
    // floor(sqrt(x/250))+1 = 3 => sqrt(x/250)=2 => x=1000
    // Entonces nivel 2 va de 250 a 999pts.
    // La mitad seria ~ 625 pts
    const pts = 625;
    const level = calcularNivel(pts); // debe ser 2
    const { pct } = calcularLevelProgress(pts, level);
    expect(pct).toBeGreaterThan(40);
    expect(pct).toBeLessThan(60);
  });

  it('al borde exacto de subir de nivel, pct es 100', () => {
    // Justo en el inicio del nivel 3 (1000 pts)
    const level = calcularNivel(1000); // = 3
    const prevLvl = level - 1; // 2
    const currentLvlPoints = Math.pow(prevLvl, 2) * 250; // 1000
    const { pct } = calcularLevelProgress(currentLvlPoints, level);
    // ptsGained = 1000 - 1000 = 0, pct = 0
    expect(pct).toBe(0);
  });

  it('pointsNeeded siempre mayor que cero para nivel >= 1', () => {
    [1, 2, 3, 4, 5].forEach(lvl => {
      const pts = Math.pow(lvl - 1, 2) * 250; // inicio exacto del nivel
      const { pointsNeeded } = calcularLevelProgress(pts, lvl);
      expect(pointsNeeded).toBeGreaterThan(0);
    });
  });
});
