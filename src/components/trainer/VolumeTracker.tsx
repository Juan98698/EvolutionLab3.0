import React, { useMemo, useState, useCallback } from 'react';
import { TrainingDay } from '../../types/database.types';
import {
  getThresholdsForMuscleGroup,
  THRESHOLDS_INTERMEDIO,
  AthleteLevel
} from '../../lib/volumeThresholds';
import { humanizeAlertCompact } from '../../lib/alertLanguage';
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
  languageMode?: 'simple' | 'tecnico';
}

// ─── Parseo de campos numéricos (rango o valor simple) ───────────────────────
const parseNumericField = (str: string | undefined): number => {
  if (!str) return 0;
  const clean = str.trim();
  if (!clean) return 0;
  const range = clean.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (range) return (parseInt(range[1], 10) + parseInt(range[2], 10)) / 2;
  const single = clean.match(/^(\d+)/);
  return single ? parseInt(single[1], 10) : 0;
};

// ─── Estimador de intensidad para NL ponderados ──────────────────────────────
const estimateIntensityPct = (reps: number, rir: number): number => {
  const totalReps = reps + rir;
  if (totalReps <= 0) return 80;
  return Math.round(100 / (1 + totalReps * 0.0333));
};

const getNLWeight = (intensityPct: number): number => {
  if (intensityPct >= 90) return 1.5;
  if (intensityPct >= 85) return 1.2;
  if (intensityPct >= 80) return 1.0;
  if (intensityPct >= 70) return 0.7;
  return 0.5;
};

const calcWeightedNL = (
  series: number,
  reps: number,
  rir: number | null
): number => {
  if (rir === null || reps === 0) return series * reps;
  const intensity = estimateIntensityPct(reps, rir);
  const weight    = getNLWeight(intensity);
  return Math.round(series * reps * weight * 10) / 10;
};

// ─── Configuración de estados y colores ──────────────────────────────────────
const STATUS_CONFIG: Record<string, { dot: string; label: string; dotChar: string }> = {
  danger:   { dot: '#ef4444', label: '⚠️ Excesivo',      dotChar: '●' },
  warning:  { dot: '#f97316', label: '⚡ Volumen Alto',   dotChar: '●' },
  optimal:  { dot: '#10b981', label: '🚀 Óptimo',        dotChar: '●' },
  building: { dot: '#facc15', label: '🔨 Construyendo',  dotChar: '◉' },
  low:      { dot: '#94a3b8', label: '💤 Mantenimiento', dotChar: '○' },
};

export const VolumeTracker: React.FC<VolumeTrackerProps> = ({
  trainingDays,
  weeklyTargets,
  athleteLevel,
  blockObjective,
  languageMode = 'tecnico'
}) => {
  const isStrength = blockObjective === 'fuerza';

  // ─── Estado de expansión individual (revelación progresiva granular) ───────
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleItem = useCallback((key: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

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

          const evalResult = evaluateStrengthVolume(pattern, current, athleteLevel);
          const rawStatus = evalResult.status;

          const effectiveStatus =
            rawStatus === 'low' && current >= threshold.mev ? 'building' : rawStatus;

          const colors = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.low;

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
            borderColor: colors.dot,
            textColor:   colors.dot,
            dotColor:    colors.dot,
            dotChar:     colors.dotChar,
            statusLabel: colors.label,
            humanizedMessage: humanizeAlertCompact(effectiveStatus as any, {
              label:   threshold.label,
              current,
              mev:     threshold.mev,
              mavMin:  threshold.mavMin,
              mavMax:  threshold.mavMax,
              mrv:     threshold.mrv,
              unit:    'NL★',
            }),
            isOver: rawStatus === 'danger',
            unit: 'NL★',
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
          const isOptimal = weeklyTargets[muscle] > 0
            ? current === target
            : current >= thresholds.mavMin && current <= thresholds.mavMax;
          const isBuilding = !isOver && !isOptimal && current >= thresholds.mev && current < thresholds.mavMin;
          const isWarning = !isOver && !isOptimal && !isBuilding && current > thresholds.mavMax;

          let effectiveStatus = 'low';
          if (isOver)       effectiveStatus = 'danger';
          else if (isWarning)  effectiveStatus = 'warning';
          else if (isOptimal)  effectiveStatus = 'optimal';
          else if (isBuilding) effectiveStatus = 'building';

          const colors = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.low;

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
            borderColor: colors.dot,
            textColor:   colors.dot,
            dotColor:    colors.dot,
            dotChar:     colors.dotChar,
            statusLabel: colors.label,
            humanizedMessage: humanizeAlertCompact(effectiveStatus as any, {
              label:   muscle,
              current,
              mev:     thresholds.mev,
              mavMin:  thresholds.mavMin,
              mavMax:  thresholds.mavMax,
              mrv:     thresholds.mrv,
              unit:    'series',
            }),
            isOver,
            unit: 'series',
          };
        });
    }
  }, [isStrength, weeklyVolumeData, weeklyNLData, weeklyTargets, athleteLevel, blockObjective]);

  // ─── Toggles globales ───────────────────────────────────────────────────────
  const allExpanded = useMemo(() => {
    return trackerItems.length > 0 && trackerItems.every(item => expandedItems[item.key]);
  }, [trackerItems, expandedItems]);

  const toggleAll = useCallback(() => {
    if (allExpanded) {
      setExpandedItems({});
    } else {
      const next: Record<string, boolean> = {};
      trackerItems.forEach(item => {
        next[item.key] = true;
      });
      setExpandedItems(next);
    }
  }, [allExpanded, trackerItems]);

  if (trackerItems.length === 0) return null;

  // Filtrar items compactos vs expandidos para renderizar en dos contenedores
  const compactItems = trackerItems.filter(item => !expandedItems[item.key]);
  const expandedItemsList = trackerItems.filter(item => expandedItems[item.key]);

  return (
    <div style={{
      position: 'sticky', top: '70px', zIndex: 990,
      background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)',
      borderRadius: '16px', padding: '12px 16px', marginBottom: '24px',
      boxShadow: '0 8px 32px 0 var(--theme-glow)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)'
    }}>
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '10px'
      }}>
        <h3 style={{
          margin: 0, fontSize: '13px', color: 'var(--theme-primary)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <span>📊</span>
          {isStrength ? 'Tracker de Fuerza Semanal' : 'Tracker de Volumen Semanal'}
        </h3>
        <button
          onClick={toggleAll}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px', padding: '4px 10px',
            color: 'rgba(255,255,255,0.4)',
            fontSize: '10px', fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.2s ease', letterSpacing: '0.03em',
            fontFamily: "inherit"
          }}
        >
          {allExpanded ? '▲ Colapsar Todo' : '▼ Mostrar Todo'}
        </button>
      </div>

      {/* Leyenda para modo fuerza (siempre arriba del contenido) */}
      {isStrength && expandedItemsList.length > 0 && languageMode === 'tecnico' && (
        <div style={{
          fontSize: '10px', color: '#6b7280', marginBottom: '10px',
          display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          <span style={{ color: '#f59e0b' }}>★</span>
          NL★ = NL ponderados por intensidad estimada (RIR→%1RM).
          <span style={{ color: '#4b5563', marginLeft: '4px' }}>
            80%→×1.0 · 85%→×1.2 · 90%+→×1.5
          </span>
        </div>
      )}

      {/* ─── Listado Compacto (Chips individuales clicables) ───────────────── */}
      {compactItems.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center',
          marginBottom: expandedItemsList.length > 0 ? '12px' : '0'
        }}>
          {compactItems.map(item => (
            <button
              key={item.key}
              onClick={() => toggleItem(item.key)}
              title={`Clic para expandir detalle científico de ${item.label}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px',
                background: `${item.dotColor}0e`,
                border: `1px solid ${item.dotColor}35`,
                borderRadius: '99px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            >
              <span style={{ fontSize: '7px', color: item.dotColor, lineHeight: 1, flexShrink: 0 }}>
                {item.dotChar}
              </span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap' }}>
                {item.label}
              </span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: item.dotColor }}>
                {item.current}
              </span>
              <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.2)', marginLeft: '2px' }}>
                ▼
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ─── Listado Expandido (Cards detalladas individuales) ──────────────── */}
      {expandedItemsList.length > 0 && (
        <div style={{
          display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px',
          scrollbarWidth: 'thin'
        }}>
          {expandedItemsList.map(item => (
            <div
              key={item.key}
              onClick={() => toggleItem(item.key)}
              title="Clic para colapsar"
              style={{
                background: 'rgba(0,0,0,0.25)',
                border: `1px solid ${item.borderColor}`,
                borderRadius: '12px', padding: '10px 14px', minWidth: '140px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                position: 'relative', flexShrink: 0, cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#ffffff', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {item.label}
                </span>
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>▲</span>
              </div>

              {/* Status label */}
              <span style={{ fontSize: '9px', color: item.textColor, fontWeight: 700, letterSpacing: '0.02em' }}>
                {item.statusLabel}
              </span>

              <span style={{ fontSize: '18px', fontWeight: '900', color: item.textColor, lineHeight: 1, margin: '2px 0' }}>
                {item.current}
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 'normal' }}>
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
                  background: 'rgba(255,255,255,0.35)',
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

              {languageMode === 'tecnico' && (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                  <span>Obj: {item.target}</span>
                  <span>MRV {item.mrv}</span>
                </div>
              )}

              {/* Mensaje humanizado — consecuencia en lenguaje natural */}
              {(item as any).humanizedMessage && (
                <div style={{
                  width: '100%', fontSize: '10px', color: 'rgba(255,255,255,0.5)',
                  lineHeight: 1.4, marginTop: '6px', textAlign: 'left',
                  borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px',
                }}>
                  {(item as any).humanizedMessage}
                </div>
              )}

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
      )}
    </div>
  );
};
