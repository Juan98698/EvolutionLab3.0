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

// ─── Músculos disponibles derivados de la tabla base (única fuente de verdad) ─
const ALL_MUSCLES = Object.keys(THRESHOLDS_INTERMEDIO).filter(k => k !== 'General');

interface VolumeTrackerProps {
  trainingDays: TrainingDay[];
  weeklyTargets: Record<string, number>;
  athleteLevel: AthleteLevel;
  blockObjective: 'hipertrofia' | 'fuerza' | 'mantenimiento';
}

// ─── Mejora 1: función unificada para parsear series y reps ──────────────────
const parseNumericField = (str: string | undefined): number => {
  if (!str) return 0;
  const clean = str.trim();
  if (!clean) return 0;
  const range = clean.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) return (parseInt(range[1], 10) + parseInt(range[2], 10)) / 2;
  const single = clean.match(/^(\d+)/);
  return single ? parseInt(single[1], 10) : 0;
};

export const VolumeTracker: React.FC<VolumeTrackerProps> = ({
  trainingDays,
  weeklyTargets,
  athleteLevel,
  blockObjective
}) => {
  const isStrength = blockObjective === 'fuerza';

  // ─── Serialización estable para detectar cambios profundos ──────────────────
  // React compara por referencia — si el array es el mismo objeto aunque
  // cambien las variables anidadas, useMemo no recalcula. El key fuerza el recálculo.
  const trainingDaysKey = useMemo(() =>
    JSON.stringify(trainingDays.map(d => d.exercises?.map(ex => ({
      n: ex.nombre,
      s: ex.variables?.['series de trabajo'] || ex.variables?.['series'],
      r: ex.variables?.['repeticiones']       || ex.variables?.['reps'],
      g: (ex as any).grupo_muscular,
    }))))
  , [trainingDays]);

  // ─── Acumulador hipertrofia: series/semana por grupo muscular ────────────────
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

  // ─── Acumulador fuerza: NL/semana por patrón de movimiento ──────────────────
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
        map[pattern] = (map[pattern] || 0) + series * reps;
      });
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingDaysKey]);

  // ─── Items del tracker ───────────────────────────────────────────────────────
  const trackerItems = useMemo(() => {
    if (isStrength) {
      return ALL_MOVEMENT_PATTERNS
        .filter(pattern => (weeklyNLData[pattern] || 0) > 0 || (weeklyTargets[pattern] || 0) > 0)
        .map(pattern => {
          const current   = weeklyNLData[pattern] || 0;
          const threshold = getStrengthThreshold(pattern, athleteLevel);

          // Mejora 2: target por defecto es MAVmax, no MRV
          // El MRV es el límite de seguridad, no el objetivo.
          const target = (weeklyTargets[pattern] && weeklyTargets[pattern] > 0)
            ? weeklyTargets[pattern]
            : threshold.mavMax;

          const status = evaluateStrengthVolume(pattern, current, athleteLevel).status;

          const colorMap = {
            danger:  { border: '#ef4444', text: '#ef4444' },
            optimal: { border: '#10b981', text: '#10b981' },
            warning: { border: '#f97316', text: '#f97316' },
            low:     current > 0
              ? { border: '#fbbf24', text: '#fbbf24' }
              : { border: 'rgba(255,255,255,0.1)', text: '#d1d5db' },
          };
          const colors = colorMap[status] ?? colorMap.low;

          // Mejora 3: barra de progreso — progreso relativo al target, cap en MRV
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
            unit: 'NL',
          };
        });
    } else {
      // Mejora 2 aplicada también a hipertrofia: target por defecto = mavMax
      return ALL_MUSCLES
        .filter(muscle => (weeklyVolumeData[muscle] || 0) > 0 || (weeklyTargets[muscle] || 0) > 0)
        .map(muscle => {
          const current    = weeklyVolumeData[muscle] || 0;
          const thresholds = getThresholdsForMuscleGroup(muscle, athleteLevel, blockObjective);

          const target = (weeklyTargets[muscle] && weeklyTargets[muscle] > 0)
            ? weeklyTargets[muscle]
            : thresholds.mavMax;

          const isOver  = current > thresholds.mrv;
          const isExact = weeklyTargets[muscle] > 0
            ? current === target
            : current >= thresholds.mavMin && current <= thresholds.mavMax;

          let borderColor = 'rgba(255,255,255,0.1)';
          let textColor   = '#d1d5db';
          if (isOver)        { borderColor = '#ef4444'; textColor = '#ef4444'; }
          else if (isExact)  { borderColor = '#10b981'; textColor = '#10b981'; }
          else if (current > 0) { borderColor = '#fbbf24'; textColor = '#fbbf24'; }

          // Mejora 3: barra de progreso
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
        {isStrength ? 'Tracker de Fuerza (NL por Patrón)' : 'Tracker de Volumen (Series por Músculo)'}
      </h3>

      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
        {trackerItems.map(item => (
          <div key={item.key} style={{
            background: 'rgba(0,0,0,0.2)',
            border: `1px solid ${item.borderColor}`,
            borderRadius: '8px', padding: '8px 12px', minWidth: '130px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
            position: 'relative', flexShrink: 0
          }}>
            {/* Nombre del patrón / músculo */}
            <span style={{
              fontSize: '11px', fontWeight: 'bold', color: '#9ca3af',
              textAlign: 'center', whiteSpace: 'nowrap'
            }}>
              {item.label}
            </span>

            {/* Número actual / target */}
            <span style={{ fontSize: '18px', fontWeight: '900', color: item.textColor, lineHeight: 1 }}>
              {item.current}
              <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'normal' }}>
                {' '}/ {item.target} {item.unit}
              </span>
            </span>

            {/* Mejora 3: barra de progreso ────────────────────────────────── */}
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
              {/* Barra de progreso actual */}
              <div style={{
                height: '100%', borderRadius: '9999px',
                background: item.borderColor,
                width: `${item.progressPct}%`,
                transition: 'width 0.3s ease',
                opacity: 0.85
              }} />
            </div>

            {/* Label MRV a la derecha de la barra */}
            <div style={{
              width: '100%', display: 'flex', justifyContent: 'flex-end'
            }}>
              <span style={{ fontSize: '9px', color: '#4b5563' }}>
                MRV {item.mrv}
              </span>
            </div>

            {/* Badge excedido */}
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
