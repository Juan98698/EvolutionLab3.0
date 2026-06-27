import React, { useMemo } from 'react';
import { TrainingDay } from '../../types/database.types';
import { getThresholdsForMuscleGroup, AthleteLevel } from '../../lib/volumeThresholds';
import { 
  ALL_MOVEMENT_PATTERNS, 
  getStrengthThreshold, 
  evaluateStrengthVolume, 
  detectPatternFromExerciseName 
} from '../../lib/strengthThresholds';

interface VolumeTrackerProps {
  trainingDays: TrainingDay[];
  weeklyTargets: Record<string, number>;
  athleteLevel: AthleteLevel;
  blockObjective: 'hipertrofia' | 'fuerza' | 'mantenimiento';
}

export const VolumeTracker: React.FC<VolumeTrackerProps> = ({
  trainingDays,
  weeklyTargets,
  athleteLevel,
  blockObjective
}) => {
  const isStrength = blockObjective === 'fuerza';

  // Helper to parse volume series
  const parseSeries = (seriesStr: string | undefined): number => {
    if (!seriesStr) return 0;
    const cleanStr = seriesStr.trim();
    if (!cleanStr) return 0;
    const rangeMatch = cleanStr.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1], 10);
      const max = parseInt(rangeMatch[2], 10);
      return (min + max) / 2;
    }
    const singleMatch = cleanStr.match(/^(\d+)/);
    if (singleMatch) {
      return parseInt(singleMatch[1], 10);
    }
    return 0;
  };

  // Helper to parse volume reps
  const parseReps = (repsStr: string | undefined): number => {
    if (!repsStr) return 0;
    const cleanStr = repsStr.trim();
    if (!cleanStr) return 0;
    const rangeMatch = cleanStr.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1], 10);
      const max = parseInt(rangeMatch[2], 10);
      return (min + max) / 2;
    }
    const singleMatch = cleanStr.match(/^(\d+)/);
    if (singleMatch) {
      return parseInt(singleMatch[1], 10);
    }
    return 0;
  };

  // Sumar volumen total de TODA la semana por grupo muscular (Hipertrofia)
  const weeklyVolumeData = useMemo(() => {
    const volumeMap: Record<string, number> = {};
    if (trainingDays && Array.isArray(trainingDays)) {
      trainingDays.forEach(day => {
        if (day && Array.isArray(day.exercises)) {
          day.exercises.forEach(ex => {
            const gm = getThresholdsForMuscleGroup(
              (ex as any).grupo_muscular || '',
              athleteLevel,
              blockObjective
            ).gm;
            const seriesStr = ex.variables?.['series de trabajo'] || ex.variables?.['series'] || '';
            const series = parseSeries(seriesStr);
            volumeMap[gm] = (volumeMap[gm] || 0) + series;
          });
        }
      });
    }
    return volumeMap;
  }, [trainingDays, athleteLevel, blockObjective]);

  // Sumar volumen total de Fuerza de TODA la semana por patrón (NL = series * reps)
  const weeklyNLData = useMemo(() => {
    const nlMap: Record<string, number> = {};
    if (trainingDays && Array.isArray(trainingDays)) {
      trainingDays.forEach(day => {
        if (day && Array.isArray(day.exercises)) {
          day.exercises.forEach(ex => {
            const pattern = detectPatternFromExerciseName(ex.nombre || '');
            if (pattern) {
              const seriesStr = ex.variables?.['series de trabajo'] || ex.variables?.['series'] || '';
              const repsStr = ex.variables?.['repeticiones'] || ex.variables?.['reps'] || '';
              const series = parseSeries(seriesStr);
              const reps = parseReps(repsStr);
              nlMap[pattern] = (nlMap[pattern] || 0) + (series * reps);
            }
          });
        }
      });
    }
    return nlMap;
  }, [trainingDays]);

  // Filtrar ítems activos a mostrar en la barra del tracker
  const trackerItems = useMemo(() => {
    if (isStrength) {
      return ALL_MOVEMENT_PATTERNS.filter(pattern => {
        const current = weeklyNLData[pattern] || 0;
        const target = weeklyTargets[pattern] || 0;
        return current > 0 || target > 0;
      }).map(pattern => {
        const current = weeklyNLData[pattern] || 0;
        const threshold = getStrengthThreshold(pattern, athleteLevel);
        const target = (weeklyTargets[pattern] && weeklyTargets[pattern] > 0)
          ? weeklyTargets[pattern]
          : threshold.mrv;

        const status = evaluateStrengthVolume(pattern, current, athleteLevel).status;

        let borderColor = 'rgba(255, 255, 255, 0.1)';
        let textColor = '#d1d5db';
        let isOver = false;

        if (status === 'danger') {
          borderColor = '#ef4444'; // Red
          textColor = '#ef4444';
          isOver = true;
        } else if (status === 'optimal') {
          borderColor = '#10b981'; // Green
          textColor = '#10b981';
        } else if (status === 'warning') {
          borderColor = '#f97316'; // Orange
          textColor = '#f97316';
        } else if (current > 0) {
          borderColor = '#fbbf24'; // Yellow
          textColor = '#fbbf24';
        }

        return {
          key: pattern,
          label: threshold.label,
          current,
          target,
          borderColor,
          textColor,
          isOver,
          unit: 'NL'
        };
      });
    } else {
      const ALL_MUSCLES = ['Pecho', 'Espalda', 'Cuádriceps', 'Isquiosurales', 'Hombros', 'Bíceps', 'Tríceps', 'Glúteos', 'Pantorrillas', 'Core'];
      return ALL_MUSCLES.filter(muscle => {
        const current = weeklyVolumeData[muscle] || 0;
        const target = weeklyTargets[muscle] || 0;
        return current > 0 || target > 0;
      }).map(muscle => {
        const current = weeklyVolumeData[muscle] || 0;
        const thresholds = getThresholdsForMuscleGroup(muscle, athleteLevel, blockObjective);
        const target = (weeklyTargets[muscle] && weeklyTargets[muscle] > 0)
          ? weeklyTargets[muscle]
          : thresholds.mrv;

        const isOver = current > target;
        const isExact = (weeklyTargets[muscle] && weeklyTargets[muscle] > 0)
          ? current === target
          : current >= thresholds.mavMin && current <= thresholds.mavMax;

        let borderColor = 'rgba(255, 255, 255, 0.1)';
        let textColor = '#d1d5db';

        if (isOver) {
          borderColor = '#ef4444'; // Red
          textColor = '#ef4444';
        } else if (isExact) {
          borderColor = '#10b981'; // Green
          textColor = '#10b981';
        } else if (current > 0) {
          borderColor = '#fbbf24'; // Yellow
          textColor = '#fbbf24';
        }

        return {
          key: muscle,
          label: muscle,
          current,
          target,
          borderColor,
          textColor,
          isOver,
          unit: 'series'
        };
      });
    }
  }, [isStrength, weeklyVolumeData, weeklyNLData, weeklyTargets, athleteLevel, blockObjective]);

  if (trackerItems.length === 0) return null;

  return (
    <div style={{
      position: 'sticky', top: '70px', zIndex: 990,
      background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '16px',
      padding: '12px 16px', marginBottom: '24px', boxShadow: '0 8px 32px 0 var(--theme-glow)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)'
    }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--theme-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>📊</span> {isStrength ? 'Tracker de Fuerza (NL por Patrón)' : 'Tracker de Volumen (Series por Músculo)'}
      </h3>
      <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
        {trackerItems.map(item => (
          <div key={item.key} style={{
            background: 'rgba(0,0,0,0.2)', border: `1px solid ${item.borderColor}`,
            borderRadius: '8px', padding: '8px 12px', minWidth: '120px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            position: 'relative'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#9ca3af', textAlign: 'center', whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
            <span style={{ fontSize: '18px', fontWeight: '900', color: item.textColor }}>
              {item.current} <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 'normal' }}>/ {item.target} {item.unit}</span>
            </span>
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
