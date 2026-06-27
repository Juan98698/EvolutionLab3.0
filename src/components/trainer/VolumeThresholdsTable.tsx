import { useState } from 'react';
import {
  THRESHOLDS_PRINCIPIANTE,
  THRESHOLDS_INTERMEDIO,
  THRESHOLDS_AVANZADO,
  AthleteLevel
} from '../../lib/volumeThresholds';
import {
  STRENGTH_THRESHOLDS_PRINCIPIANTE,
  STRENGTH_THRESHOLDS_INTERMEDIO,
  STRENGTH_THRESHOLDS_AVANZADO,
  MovementPattern,
} from '../../lib/strengthThresholds';

interface Props {
  onClose: () => void;
  defaultMode?: 'hipertrofia' | 'fuerza';
}

type TableMode = 'hipertrofia' | 'fuerza';

export function VolumeThresholdsTable({ onClose, defaultMode = 'hipertrofia' }: Props) {
  const [activeLevel, setActiveLevel] = useState<AthleteLevel>('intermedio');
  const [mode, setMode] = useState<TableMode>(defaultMode);

  const getHypertrophyThresholds = () => {
    switch (activeLevel) {
      case 'principiante': return THRESHOLDS_PRINCIPIANTE;
      case 'avanzado':     return THRESHOLDS_AVANZADO;
      default:             return THRESHOLDS_INTERMEDIO;
    }
  };

  const getStrengthThresholds = () => {
    switch (activeLevel) {
      case 'principiante': return STRENGTH_THRESHOLDS_PRINCIPIANTE;
      case 'avanzado':     return STRENGTH_THRESHOLDS_AVANZADO;
      default:             return STRENGTH_THRESHOLDS_INTERMEDIO;
    }
  };

  const thresholds       = getHypertrophyThresholds();
  const strengthTable    = getStrengthThresholds();

  const muscleCategories = [
    { name: 'EMPUJE',   muscles: ['Pecho', 'Hombros', 'Tríceps'] },
    { name: 'TIRÓN',    muscles: ['Espalda', 'Bíceps', 'Trapecio', 'Deltoides posterior'] },
    { name: 'PIERNAS',  muscles: ['Cuádriceps', 'Isquiosurales', 'Glúteos', 'Pantorrillas'] },
    { name: 'CORE',     muscles: ['Core', 'Lumbares'] }
  ];

  const patternCategories: { name: string; patterns: MovementPattern[] }[] = [
    { name: 'EMPUJE',   patterns: ['push_horizontal', 'push_vertical'] },
    { name: 'TIRÓN',    patterns: ['pull_horizontal', 'pull_vertical'] },
    { name: 'PIERNAS',  patterns: ['squat', 'hinge'] },
    { name: 'CORE',     patterns: ['core_transfer'] },
  ];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(5px)',
      padding: '10px',
      fontFamily: "'Inter', 'Roboto', sans-serif",
      color: '#fff'
    }}>
      <style>{`
        .threshold-modal-box { width: 90%; }
        .threshold-table-wrapper { overflow-x: auto; }
        .threshold-legend { flex-direction: row; }
        .mode-btn { transition: all 0.2s; cursor: pointer; border: none; font-size: 13px; font-weight: 600; padding: 6px 18px; border-radius: 6px; letter-spacing: 0.04em; }
        @media (max-width: 768px) {
          .threshold-modal-box { width: 100%; height: 95vh; max-height: 95vh !important; }
          .threshold-legend { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
        }
      `}</style>

      <div className="threshold-modal-box" style={{
        background: '#1A1A1A', border: '1px solid #333', borderRadius: '16px',
        maxWidth: '1000px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '24px', borderBottom: '1px solid #333'
        }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>📊</span> Umbrales de Volumen (MEV / MAV / MRV)
            </h2>
            <p style={{ fontSize: '14px', color: '#9ca3af', margin: '4px 0 0 0' }}>
              {mode === 'hipertrofia'
                ? 'Hipertrofia · Series directas por grupo muscular · Renaissance Periodization'
                : 'Fuerza general · Número de Levantamientos por patrón de movimiento · ≥ 80% 1RM'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#2A2A2A', border: 'none', color: '#9ca3af',
              width: '36px', height: '36px', borderRadius: '8px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = '#333'; }}
            onMouseOut={(e)  => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = '#2A2A2A'; }}
          >✕</button>
        </div>

        {/* ── Mode switcher + Level tabs ── */}
        <div style={{ padding: '16px 24px 0 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Mode pills */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="mode-btn"
              onClick={() => setMode('hipertrofia')}
              style={{
                background: mode === 'hipertrofia' ? '#6366f1' : '#2A2A2A',
                color: mode === 'hipertrofia' ? '#fff' : '#9ca3af',
              }}
            >
              💪 Hipertrofia
            </button>
            <button
              className="mode-btn"
              onClick={() => setMode('fuerza')}
              style={{
                background: mode === 'fuerza' ? '#f59e0b' : '#2A2A2A',
                color: mode === 'fuerza' ? '#000' : '#9ca3af',
              }}
            >
              🏋️ Fuerza general
            </button>
          </div>

          {/* Level tabs */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {(['principiante', 'intermedio', 'avanzado'] as AthleteLevel[]).map(level => {
              const isActive = activeLevel === level;
              const accent   = mode === 'fuerza' ? '#f59e0b' : '#6366f1';
              const shadow   = mode === 'fuerza' ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.3)';
              return (
                <button
                  key={level}
                  onClick={() => setActiveLevel(level)}
                  style={{
                    padding: '10px 20px',
                    border: isActive ? '1px solid #444' : '1px solid transparent',
                    borderBottom: 'none',
                    borderTop: isActive ? `2px solid ${accent}` : '1px solid transparent',
                    background: isActive ? '#2A2A2A' : '#151515',
                    color: isActive ? '#fff' : '#6b7280',
                    borderRadius: '8px 8px 0 0',
                    fontWeight: isActive ? 'bold' : '500',
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    boxShadow: isActive ? `0 -4px 10px -4px ${shadow}` : 'none',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { if (!isActive) e.currentTarget.style.color = '#d1d5db'; }}
                  onMouseOut={(e)  => { if (!isActive) e.currentTarget.style.color = '#6b7280'; }}
                >
                  {level}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="threshold-legend" style={{
            background: '#2A2A2A', padding: '16px',
            border: '1px solid #444', borderTop: 'none',
            borderRadius: '0 8px 8px 8px',
            display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center',
            fontSize: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#E6E6FA', color: '#483D8B', padding: '2px 10px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px' }}>MEV</span>
              <span style={{ color: '#d1d5db' }}>Mínimo efectivo</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#E0FFF0', color: '#006400', padding: '2px 10px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px' }}>MAV</span>
              <span style={{ color: '#d1d5db' }}>Máximo adaptativo</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#FFE4E1', color: '#8B0000', padding: '2px 10px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px' }}>MRV</span>
              <span style={{ color: '#d1d5db' }}>Máximo recuperable</span>
            </div>
            <div style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {mode === 'hipertrofia' ? 'Series directas / semana' : 'NL (reps × series) / semana  ·  ≥ 80% 1RM'}
            </div>
          </div>
        </div>

        {/* ── Table Content ── */}
        <div className="threshold-table-wrapper" style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px 24px' }}>
          <div style={{ background: '#1E1E1E', border: '1px solid #333', borderRadius: '8px', overflowX: 'auto' }}>
            <div style={{ minWidth: mode === 'fuerza' ? '700px' : '600px' }}>

              {/* Table Header */}
              {mode === 'hipertrofia' ? (
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px',
                  padding: '16px', borderBottom: '1px solid #333', background: '#222',
                  fontWeight: 'bold', color: '#9ca3af', fontSize: '14px', textAlign: 'center'
                }}>
                  <div style={{ textAlign: 'left' }}>Grupo muscular</div>
                  <div>MEV</div><div>MAV</div><div>MRV</div>
                </div>
              ) : (
                <div style={{
                  display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 1fr 0.8fr 1.6fr', gap: '12px',
                  padding: '16px', borderBottom: '1px solid #333', background: '#222',
                  fontWeight: 'bold', color: '#9ca3af', fontSize: '14px', textAlign: 'center'
                }}>
                  <div style={{ textAlign: 'left' }}>Patrón</div>
                  <div>MEV</div><div>MAV</div><div>MRV</div>
                  <div>Intensidad</div>
                </div>
              )}

              {/* Table Body */}
              {mode === 'hipertrofia'
                ? muscleCategories.map(category => (
                    <div key={category.name}>
                      <div style={{
                        background: '#151515', padding: '8px', textAlign: 'center',
                        fontSize: '12px', fontWeight: 'bold', color: '#6b7280', letterSpacing: '0.2em'
                      }}>{category.name}</div>

                      {category.muscles.map(muscle => {
                        const data = thresholds[muscle] || thresholds['General'];
                        if (!data) return null;
                        return (
                          <div key={muscle} style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px',
                            padding: '16px', borderBottom: '1px solid #333',
                            alignItems: 'center', transition: 'background 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#252525'}
                          onMouseOut={(e)  => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ fontWeight: 'bold', color: '#e5e7eb' }}>{muscle}</div>
                            <div style={{ textAlign: 'center' }}>
                              <span style={{ background: '#E6E6FA', color: '#483D8B', padding: '4px 12px', borderRadius: '6px', fontWeight: '500', fontSize: '14px' }}>
                                {data.mev} series
                              </span>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <span style={{ background: '#E0FFF0', color: '#006400', padding: '4px 12px', borderRadius: '6px', fontWeight: '500', fontSize: '14px' }}>
                                {data.mavMin}–{data.mavMax} series
                              </span>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <span style={{ background: '#FFE4E1', color: '#8B0000', padding: '4px 12px', borderRadius: '6px', fontWeight: '500', fontSize: '14px' }}>
                                {data.mrv} series
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))

                : patternCategories.map(category => (
                    <div key={category.name}>
                      <div style={{
                        background: '#151515', padding: '8px', textAlign: 'center',
                        fontSize: '12px', fontWeight: 'bold', color: '#6b7280', letterSpacing: '0.2em'
                      }}>{category.name}</div>

                      {category.patterns.map(pattern => {
                        const data = strengthTable[pattern];
                        if (!data) return null;
                        return (
                          <div key={pattern}>
                            <div style={{
                              display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 1fr 0.8fr 1.6fr', gap: '12px',
                              padding: '14px 16px', borderBottom: '1px solid #2a2a2a',
                              alignItems: 'center', transition: 'background 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#252525'}
                            onMouseOut={(e)  => e.currentTarget.style.background = 'transparent'}
                            >
                              <div>
                                <div style={{ fontWeight: 'bold', color: '#e5e7eb', fontSize: '14px' }}>{data.label}</div>
                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '3px' }}>
                                  {data.exampleExercises.slice(0, 2).join(' · ')}
                                </div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <span style={{ background: '#E6E6FA', color: '#483D8B', padding: '4px 10px', borderRadius: '6px', fontWeight: '500', fontSize: '13px' }}>
                                  {data.mev} NL
                                </span>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <span style={{ background: '#E0FFF0', color: '#006400', padding: '4px 10px', borderRadius: '6px', fontWeight: '500', fontSize: '13px' }}>
                                  {data.mavMin}–{data.mavMax} NL
                                </span>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <span style={{ background: '#FFE4E1', color: '#8B0000', padding: '4px 10px', borderRadius: '6px', fontWeight: '500', fontSize: '13px' }}>
                                  {data.mrv} NL
                                </span>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <span style={{
                                  background: '#1a1a2e', color: '#f59e0b',
                                  padding: '4px 8px', borderRadius: '6px',
                                  fontSize: '11px', fontWeight: '500', whiteSpace: 'nowrap'
                                }}>
                                  {data.intensityZone}
                                </span>
                              </div>
                            </div>

                            {/* MRV signals — expandibles en hover */}
                            <div style={{
                              padding: '0 16px 10px 16px',
                              borderBottom: '1px solid #333',
                              background: '#1a1a1a'
                            }}>
                              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Señales de MRV
                              </div>
                              {data.mrvSignals.map((signal, i) => (
                                <div key={i} style={{
                                  fontSize: '12px', color: '#9ca3af',
                                  display: 'flex', alignItems: 'flex-start', gap: '6px',
                                  marginBottom: '2px'
                                }}>
                                  <span style={{ color: '#ef4444', marginTop: '1px', flexShrink: 0 }}>›</span>
                                  {signal}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
              }
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '16px', background: '#151515', borderTop: '1px solid #333',
          fontSize: '12px', color: '#6b7280', textAlign: 'center'
        }}>
          {mode === 'hipertrofia'
            ? <p style={{ margin: 0 }}>Rangos basados en Renaissance Periodization (Israetel et al.). Son puntos de partida: la respuesta individual varía según genética, nutrición, sueño y estrés acumulado. Ajusta siempre según señales de recuperación del atleta.</p>
            : <p style={{ margin: 0 }}>NL = reps × series a ≥ 80% 1RM. El límite en fuerza es neural/articular, no metabólico. Las señales de MRV son más importantes que el número. Ajusta siempre según calidad técnica y rendimiento semana a semana.</p>
          }
        </div>

      </div>
    </div>
  );
}
