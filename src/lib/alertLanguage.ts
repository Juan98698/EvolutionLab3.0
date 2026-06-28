/**
 * EvolutionLab — Alert Language Layer
 *
 * Traduce los status técnicos del motor (MEV/MAV/MRV/NL★) a lenguaje
 * de consecuencias que cualquier entrenador entiende, independientemente
 * de su nivel de familiaridad con la terminología científica.
 *
 * Principio de diseño:
 *   - El headline habla de consecuencias para el atleta, no de métricas
 *   - El dato técnico siempre está disponible detrás de "ver detalle"
 *   - La acción es concreta y accionable, no genérica
 */

export type AlertStatus = 'low' | 'building' | 'optimal' | 'warning' | 'danger';
export type AlertUnit  = 'NL★' | 'series';

export interface AlertContext {
  /** Nombre del patrón de movimiento (fuerza) o grupo muscular (hipertrofia) */
  label: string;
  /** Valor actual acumulado en la semana */
  current: number;
  /** Umbral MEV del nivel */
  mev: number;
  /** Umbral MAVmin del nivel */
  mavMin: number;
  /** Umbral MAVmax del nivel */
  mavMax: number;
  /** Umbral MRV del nivel */
  mrv: number;
  /** Unidad de medida */
  unit: AlertUnit;
  /** Nivel del atleta — afecta el tono de la recomendación */
  athleteLevel: 'principiante' | 'intermedio' | 'avanzado';
  /** Señales de MRV específicas (solo para fuerza, status danger) */
  mrvSignals?: string[];
}

export interface HumanizedAlert {
  /** Lo que el entrenador ve primero — consecuencia en lenguaje natural */
  headline: string;
  /** Por qué importa — contexto sin siglas */
  consequence: string;
  /** Qué hacer — acción concreta */
  action: string;
  /** El mensaje técnico original — para el entrenador que quiere profundizar */
  technical: string;
  /** Señales observables en el atleta (solo en danger) */
  signals?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const levelLabel = (level: AlertContext['athleteLevel']): string => ({
  principiante: 'principiante',
  intermedio:   'intermedio',
  avanzado:     'avanzado',
}[level]);

const unitLabel = (unit: AlertUnit, plural = false): string => {
  if (unit === 'NL★') return plural ? 'levantamientos ponderados' : 'levantamiento ponderado';
  return plural ? 'series' : 'serie';
};

// ─── Función principal ────────────────────────────────────────────────────────

export const humanizeAlert = (
  status: AlertStatus,
  ctx: AlertContext
): HumanizedAlert => {
  const { label, current, mev, mavMin, mavMax, mrv, unit, athleteLevel, mrvSignals } = ctx;
  const lvl  = levelLabel(athleteLevel);
  const diff = {
    toMev:    mev - current,
    toMavMin: mavMin - current,
    toMavMax: mavMax - current,
    overMrv:  current - mrv,
    overMav:  current - mavMax,
  };

  switch (status) {

    // ── Sin estímulo suficiente ────────────────────────────────────────────
    case 'low':
      return {
        headline:    `${label} necesita más trabajo esta semana`,
        consequence: `Con este volumen el estímulo es insuficiente — tu atleta ${lvl} no va a ver adaptaciones apreciables en ${label.toLowerCase()}.`,
        action:      `Añade al menos ${diff.toMev} ${unitLabel(unit, diff.toMev !== 1)} más para cruzar el mínimo efectivo.`,
        technical:   `${current} ${unit} < MEV (${mev} ${unit}) para ${label} ${lvl}`,
      };

    // ── En construcción — por encima del mínimo pero fuera del óptimo ─────
    case 'building':
      return {
        headline:    `${label} está ganando terreno`,
        consequence: `El volumen supera el mínimo efectivo pero todavía hay margen para optimizar. El atleta va a progresar, aunque no a su ritmo máximo.`,
        action:      `Añade ${diff.toMavMin} ${unitLabel(unit, diff.toMavMin !== 1)} más para entrar en la zona de mayor adaptación.`,
        technical:   `${current} ${unit} — entre MEV (${mev}) y MAV mín (${mavMin}) para ${label} ${lvl}`,
      };

    // ── Zona óptima ────────────────────────────────────────────────────────
    case 'optimal':
      return {
        headline:    `${label} en zona óptima`,
        consequence: `Tu atleta está recibiendo el estímulo justo para maximizar la adaptación en ${label.toLowerCase()} sin comprometer la recuperación.`,
        action:      `Mantén este rango. Puedes escalar progresivamente dentro de ${mavMin}–${mavMax} ${unit} en las próximas semanas.`,
        technical:   `${current} ${unit} — dentro del MAV (${mavMin}–${mavMax} ${unit}) para ${label} ${lvl}`,
      };

    // ── Alto pero tolerable ────────────────────────────────────────────────
    case 'warning':
      return {
        headline:    `El volumen de ${label.toLowerCase()} está en el límite`,
        consequence: `Supera la zona óptima en ${diff.overMav} ${unit}. Puede funcionar si el atleta se recupera bien, pero aumenta el riesgo de fatiga acumulada la semana siguiente.`,
        action:      `Observa si el rendimiento baja antes de añadir más. Si hay señales de fatiga, reduce a ${mavMax} ${unit} en el próximo microciclo.`,
        technical:   `${current} ${unit} > MAV máx (${mavMax} ${unit}), por debajo de MRV (${mrv} ${unit}) para ${label} ${lvl}`,
      };

    // ── MRV superado ───────────────────────────────────────────────────────
    case 'danger':
      return {
        headline:    `Demasiado volumen de ${label.toLowerCase()} — tu atleta no se va a recuperar`,
        consequence: `Supera el límite máximo recuperable en ${diff.overMrv} ${unit}. Más allá de este punto el volumen genera fatiga sin adaptación adicional, y aumenta el riesgo de lesión.`,
        action:      `Reduce a ${mrv - 5}–${mrv} ${unit} esta semana. Si el bloque es de acumulación intencional, programa un deload en los próximos 7 días.`,
        technical:   `${current} ${unit} ≥ MRV (${mrv} ${unit}) para ${label} ${lvl}`,
        signals:     mrvSignals?.slice(0, 3),
      };

    default:
      return {
        headline:    `${label}`,
        consequence: '',
        action:      '',
        technical:   `${current} ${unit}`,
      };
  }
};

// ─── Versión compacta para chips del VolumeTracker ───────────────────────────
// Devuelve solo el headline en formato muy corto para caber en el chip expandido

export const humanizeAlertCompact = (
  status: AlertStatus,
  ctx: Pick<AlertContext, 'label' | 'current' | 'mev' | 'mavMin' | 'mavMax' | 'mrv' | 'unit'>
): string => {
  const { current, mev, mavMin, mavMax, mrv, unit } = ctx;

  switch (status) {
    case 'low':      return `Faltan ${mev - current} ${unit} para el mínimo efectivo`;
    case 'building': return `Cerca del óptimo — faltan ${mavMin - current} ${unit}`;
    case 'optimal':  return `En zona óptima (${mavMin}–${mavMax} ${unit})`;
    case 'warning':  return `${current - mavMax} ${unit} sobre el óptimo — monitorea fatiga`;
    case 'danger':   return `${current - mrv} ${unit} sobre el límite — reduce esta semana`;
    default:         return '';
  }
};
