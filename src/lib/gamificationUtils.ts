/**
 * gamificationUtils.ts
 *
 * Fuente unica de verdad para las funciones de gamificacion compartidas
 * entre AthleteNavbar y GamificacionPanel.
 *
 * Funciones puras, sin dependencias de React ni de Supabase.
 */

/**
 * Devuelve la clave ISO de semana del ano para una fecha dada,
 * en el formato "YYYY-WNN" (ej. "2026-W03").
 */
export function getISOWeekString(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + '-W' + weekNo.toString().padStart(2, '0');
}

/**
 * Interfaz minima compatible con Session de overload.ts y con el
 * resultado de readSessionsFromCache() en AthleteNavbar.
 */
export interface HasFecha {
  fecha: string;
}

/**
 * Calcula la racha semanal de un atleta.
 * - actual: semanas consecutivas activas hasta ahora.
 * - maxima: racha maxima historica.
 *
 * @param sessions  Array con campo fecha en "YYYY-MM-DD".
 * @param now       Fecha de referencia (inyectable en tests).
 */
export function calcularRachaSemanas(
  sessions: HasFecha[],
  now: Date = new Date()
): { actual: number; maxima: number } {
  if (sessions.length === 0) return { actual: 0, maxima: 0 };

  const sessionWeeks = new Set(
    sessions.map(function(s) {
      const parts = s.fecha.split('-').map(Number);
      const year = parts[0], month = parts[1], day = parts[2];
      return getISOWeekString(new Date(year, month - 1, day));
    })
  );

  function getOffsetWeekString(weeksAgo: number): string {
    const d = new Date(now.getTime());
    d.setDate(d.getDate() - 7 * weeksAgo);
    return getISOWeekString(d);
  }

  const currentWeek = getOffsetWeekString(0);
  const lastWeek = getOffsetWeekString(1);
  const hasCurrent = sessionWeeks.has(currentWeek);
  const hasLast = sessionWeeks.has(lastWeek);

  let actual = 0;
  if (hasCurrent || hasLast) {
    let weeksAgo = hasCurrent ? 0 : 1;
    while (sessionWeeks.has(getOffsetWeekString(weeksAgo))) {
      actual++;
      weeksAgo++;
    }
  }

  const sortedWeeks = Array.from(sessionWeeks).sort();
  let maxima = 0;

  if (sortedWeeks.length > 0) {
    let currentMax = 1;
    maxima = 1;
    for (let i = 1; i < sortedWeeks.length; i++) {
      const prev = sortedWeeks[i - 1].split('-W').map(Number);
      const curr = sortedWeeks[i].split('-W').map(Number);
      const y1 = prev[0], w1 = prev[1], y2 = curr[0], w2 = curr[1];
      let isConsecutive = false;
      if (y1 === y2 && w2 === w1 + 1) {
        isConsecutive = true;
      } else if (y2 === y1 + 1 && (w1 === 52 || w1 === 53) && w2 === 1) {
        isConsecutive = true;
      }
      if (isConsecutive) {
        currentMax++;
      } else {
        maxima = Math.max(maxima, currentMax);
        currentMax = 1;
      }
    }
    maxima = Math.max(maxima, currentMax);
  }

  return { actual: actual, maxima: maxima };
}

/**
 * Calcula el nivel actual dado el total de puntos.
 * Formula: LVL = floor(sqrt(pts / 250)) + 1
 */
export function calcularNivel(totalPoints: number): number {
  return Math.floor(Math.sqrt(totalPoints / 250)) + 1;
}

/**
 * Calcula el progreso de XP dentro del nivel actual.
 */
export function calcularLevelProgress(
  totalPoints: number,
  currentLevel: number
): { pointsGained: number; pointsNeeded: number; pct: number } {
  const currentLvlPoints = Math.pow(currentLevel - 1, 2) * 250;
  const nextLvlPoints = Math.pow(currentLevel, 2) * 250;
  const pointsGained = totalPoints - currentLvlPoints;
  const pointsNeeded = nextLvlPoints - currentLvlPoints;
  const pct = pointsNeeded > 0 ? Math.min((pointsGained / pointsNeeded) * 100, 100) : 100;
  return { pointsGained: pointsGained, pointsNeeded: pointsNeeded, pct: pct };
}