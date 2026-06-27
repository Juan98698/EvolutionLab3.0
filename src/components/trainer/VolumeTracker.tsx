import React, { useMemo } from 'react';
import { TrainingDay } from '../../types/database.types';
import {
  getThresholdsForMuscleGroup,
  THRESHOLDS_INTERMEDIO,
  AthleteLevel
} from '../../lib/volumeThresholds';
import {
  ALL_MOVEMENT_PATTERNS,
  getStrengthThreshold,
  evaluateStrengthVolume,
  detectPatternFromExerciseName
} from '../../lib/strengthThresholds';

// ─── Músculos desde la fuente de verdad ──────────────────────────────────────
const ALL_MUSCLES = Object.keys(THRESHOLDS_INTERMEDIO).filter(k => k !== 'General');

interface VolumeTrackerProps {
  trainingDays: TrainingDay[];
  weeklyTargets: Record<string, number>;
  athleteLevel: AthleteLevel;
  blockObjective: 'hipertrofia' | 'fuerza' | 'mantenimiento';
}

// ─── Parseo de campos numéricos (rango o valor simple) ───────────────────────
const parseNumericField = (str: string | undefined): number => {
  if (!str) return 0;
  const clean = str.trim();
  if (!clean) return 0;
  const range = clean.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) return (parseInt(range[1], 10) + parseInt(range[2], 10)) / 2;
  const single = clean.match(/^(\d+)/);
  return single ? parseInt(single[1], 10) : 0;
};

// ─── Opción B: NL ponderados por intensidad ───────────────────────────────────
//
// Principio: no todos los NL generan el mismo estrés neural.
// 5x3 al 90% 1RM cuesta más que 5x3 al 80% 1RM aunque el NL bruto sea igual.
//
// Estimamos % 1RM desde reps + RIR usando la fórmula de Tuchscherer:
//   %1RM ≈ 100 / (1 + totalReps * 0.0333)
//   donde totalReps = reps realizadas + RIR (reps totales en el set)
//
// Luego asignamos un multiplicador por zona de intensidad (basado en Prilepin):
//   ≥ 90%  → 1.5  (muy pesado, alto costo neural)
//   85-89% → 1.2  (pesado)
//   80-84% → 1.0  (referencia base)
//   70-79% → 0.7  (moderado)
//   < 70%  → 0.5  (ligero, mínimo costo neural)

const estimateIntensityPct = (reps: number, rir: number): number => {
  const totalReps = reps + rir;
  if (totalReps <= 0) return 80; // fallback conservador
  return Math.round(100 / (1 + totalReps * 0.0333));
};

const getNLWeight = (intensityPct: number): number => {
  if (intensityPct >= 90) return 1.5;
  if (intensityPct >= 85) return 1.2;
  if (intensityPct >= 80) return 1.0;
  if (intensityPct >= 70) return 0.7;
  return 0.5;
};

/**
 * Calcula NL ponderados para un ejercicio dado.
 * Si no hay RIR disponible, usa NL brutos (peso = 1.0).
 */
const calcWeightedNL = (
  series: number,
  reps: number,
  rir: number | null
): number => {
  if (rir === null || reps === 0) return series * reps; // sin datos de RIR → bruto
  const intensity = estimateIntensityPct(reps, rir);
  const weight    = getNLWeight(intensity);
  return Math.round(series * reps * weight * 10) / 10; // 1 decimal
};

export const VolumeTracker: React.FC<VolumeTrackerProps> = ({
  trainingDays,
  weeklyTargets,
  athleteLevel,
  blockObjective
}) => {
  const isStrength = blockObjective === 'fuerza';

  // ─── Key de serialización para detectar cambios profundos ────────────────────
  const trainingDaysKey = useMemo(() =>
    JSON.stringify(trainingDays.map(d => d.exercises?.map(ex => ({
      n: ex.nombre,
      s: ex.variables?.['series de trabajo'] || ex.variables?.['series'],
      r: ex.variables?.['repeticiones']       || ex.variables?.['reps'],
      i: ex.variables?.['rir'],
      g: (ex as any).grupo_muscular,
    }))))
  , [trainingDays]);

  // ─── Acumulador hipertrofia: series/semana por músculo ───────────────────────
  const weeklyVolumeData = useMemo(() => {
    const map: Record<string, number> = {};
    trainingDays.forEach(day => {
      day.exercises?.forEach(ex => {
        const gm = getThresholdsForMuscleGroup(
          (ex as any).grupo_muscular || '', athleteLevel, blockObjective
        ).gm;
        const series = parseNumericField(
          ex.variables?.['series de trabajo'] || ex.variables?.['series']
        );
        map[gm] = (map[gm] || 0) + series;
      });
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingDaysKey, athleteLevel, blockObjective]);

  // ─── Acumulador fuerza: NL PONDERADOS por patrón ────────────────────────────
  // Usa intensidad estimada desde RIR para ponderar el costo neural real
  // en lugar de sumar NL brutos.
  const weeklyNLData = useMemo(() => {
    const map: Record<string, number> = {};
    trainingDays.forEach(day => {
      day.exercises?.forEach(ex => {
        const pattern = detectPatternFromExerciseName(ex.nombre || '');
        if (!pattern) return;

        const series = parseNumericField(
          ex.variables?.['series de trabajo'] || ex.variables?.['series']
        );
        const reps = parseNumericField(
          ex.variables?.['repeticiones'] || ex.variables?.['reps']
        );
        // RIR vacío ('') = sin dato → NL brutos (null)
        // RIR '0' = al fallo → intensidad máxima (válido)
        const rirRaw = ex.variables?.['rir'];
        const rir    = (rirRaw === undefined || rirRaw === '')
          ? null
          : parseNumericField(rirRaw);

        const weightedNL = calcWeightedNL(series, reps, rir);
        map[pattern] = Math.round(((map[pattern] || 0) + weightedNL) * 10) / 10;
      });
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingDaysKey]);

  // ─── Items del tracker ───────────────────────────────────────────────────────
  const trackerItems = useMemo(() => {
    if (isStrength) {
      return ALL_MOVEMENT_PATTERNS
        .filter(p => (weeklyNLData[p] || 0) > 0 || (weeklyTargets[p] || 0) > 0)
        .map(pattern => {
          const current   = weeklyNLData[pattern] || 0;
          const threshold = getStrengthThreshold(pattern, athleteLevel);
          const target    = (weeklyTargets[pattern] && weeklyTargets[pattern] > 0)
            ? weeklyTargets[pattern]
            : threshold.mavMax;

          const status = evaluateStrengthVolume(pattern, current, athleteLevel).status;

          const colorMap: Record<string, { border: string; text: string }> = {
            danger:  { border: '#ef4444', text: '#ef4444' },
            optimal: { border: '#10b981', text: '#10b981' },
            warning: { border: '#f97316', text: '#f97316' },
            low:     { border: current > 0 ? '#fbbf24' : 'rgba(255,255,255,0.1)',
                       text:   current > 0 ? '#fbbf24' : '#d1d5db' },
          };
          const colors = colorMap[status] ?? colorMap.low;

          const progressPct = Math.min((current / threshold.mrv) * 100, 100);
          const targetPct   = Math.min((target  / threshold.mrv) * 100, 100);

          return {
            key: pattern,
            label: threshold.label,
            current,
            target,
            mrv: threshold.mrv,
            progressPct,
            targetPct,
            borderColor: colors.border,
            textColor:   colors.text,
            isOver: status === 'danger',
            unit: 'NL★', // ★ indica que son NL ponderados, no brutos
          };
        });
    } else {
      return ALL_MUSCLES
        .filter(m => (weeklyVolumeData[m] || 0) > 0 || (weeklyTargets[m] || 0) > 0)
        .map(muscle => {
          const current    = weeklyVolumeData[muscle] || 0;
          const thresholds = getThresholdsForMuscleGroup(muscle, athleteLevel, blockObjective);
          const target     = (weeklyTargets[muscle] && weeklyTargets[muscle] > 0)
            ? weeklyTargets[muscle]
            : thresholds.mavMax;

          const isOver  = current > thresholds.mrv;
          const isExact = weeklyTargets[muscle] > 0
            ? current === target
            : current >= thresholds.mavMin && current <= thresholds.mavMax;

          let borderColor = 'rgba(255,255,255,0.1)';
          let textColor   = '#d1d5db';
          if (isOver)           { borderColor = '#ef4444'; textColor = '#ef4444'; }
          else if (isExact)     { borderColor = '#10b981'; textColor = '#10b981'; }
          else if (current > 0) { borderColor = '#fbbf24'; textColor = '#fbbf24'; }

          const progressPct = Math.min((current / thresholds.mrv) * 100, 100);
          const targetPct   = Math.min((target  / thresholds.mrv) * 100, 100);

          return {
            key: muscle,
            label: muscle,
            current,
            target,
            mrv: thresholds.mrv,
            progressPct,
            targetPct,
            borderColor,
            textColor,
            isOver,
            unit: 'series',
          };
        });
    }
  }, [isStrength, weeklyVolumeData, weeklyNLData, weeklyTargets, athleteLevel, blockObjective]);

  if (trackerItems.length === 0) return null;

  return (
    <div style={{
      position: 'sticky', top: '70px', zIndex: 990,
      background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)',
      borderRadius: '16px', padding: '12px 16px', marginBottom: '24px',
      boxShadow: '0 8px 32px 0 var(--theme-glow)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)'
    }}>
      <h3 style={{
        margin: '0 0 10px 0', fontSize: '13px', color: 'var(--theme-primary)',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        display: 'flex', alignItems: 'center', gap: '8px'
      }}>
        <span>📊</span>
        {isStrength
          ? 'Tracker de Fuerza (NL ponderados por intensidad)'
          : 'Tracker de Volumen (Series por Músculo)'}
      </h3>

      {/* Leyenda para modo fuerza */}
      {isStrength && (
        <div style={{
          fontSize: '11px', color: '#6b7280', marginBottom: '10px',
          display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          <span style={{ color: '#f59e0b' }}>★</span>
          NL★ = NL ponderados por intensidad estimada (RIR→%1RM→Prilepin).
          <span style={{ color: '#4b5563', marginLeft: '4px' }}>
            80%→×1.0 · 85%→×1.2 · 90%+→×1.5
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
        {trackerItems.map(item => (
          <div key={item.key} style={{
            background: 'rgba(0,0,0,0.2)',
            border: `1px solid ${item.borderColor}`,
            borderRadius: '8px', padding: '8px 12px', minWidth: '130px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
            position: 'relative', flexShrink: 0
          }}>
            <span style={{
              fontSize: '11px', fontWeight: 'bold', color: '#9ca3af',
              textAlign: 'center', whiteSpace: 'nowrap'
            }}>
              {item.label}
            </span>

            <span style={{ fontSize: '18px', fontWeight: '900', color: item.textColor, lineHeight: 1 }}>
              {item.current}
              <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'normal' }}>
                {' '}/ {item.target} {item.unit}
              </span>
            </span>

            {/* Barra de progreso */}
            <div style={{
              width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)',
              borderRadius: '9999px', overflow: 'visible', position: 'relative', marginTop: '2px'
            }}>
              {/* Marcador de target */}
              <div style={{
                position: 'absolute', top: '-3px',
                left: `${item.targetPct}%`,
                transform: 'translateX(-50%)',
                width: '2px', height: '10px',
                background: 'rgba(255,255,255,0.3)',
                borderRadius: '1px'
              }} />
              {/* Progreso */}
              <div style={{
                height: '100%', borderRadius: '9999px',
                background: item.borderColor,
                width: `${item.progressPct}%`,
                transition: 'width 0.3s ease',
                opacity: 0.85
              }} />
            </div>

            <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '9px', color: '#4b5563' }}>MRV {item.mrv}</span>
            </div>

            {item.isOver && (
              <div style={{
                position: 'absolute', top: '-6px', right: '-6px',
                background: '#ef4444', color: '#fff', fontSize: '9px',
                padding: '2px 5px', borderRadius: '12px', fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
              }}>
                Excedido
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
