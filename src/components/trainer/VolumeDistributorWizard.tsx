import { useState, useEffect, useMemo } from 'react';
import { 
  SplitType, 
  distributeSetsToSessions, 
  GeneratedSession, 
  MUSCLES
} from '../../lib/sessionDistributor';
import { getThresholdsForMuscleGroup, AthleteLevel } from '../../lib/volumeThresholds';
import {
  getStrengthThreshold,
  ALL_MOVEMENT_PATTERNS,
} from '../../lib/strengthThresholds';

interface Props {
  onClose: () => void;
  onApply: (sessions: GeneratedSession[], targets: Record<string, number>) => void;
  athleteLevel?: AthleteLevel;
  blockObjective?: 'hipertrofia' | 'fuerza' | 'mantenimiento';
  initialTargets?: Record<string, number>;
}

export function VolumeDistributorWizard({ onClose, onApply, athleteLevel = 'intermedio', blockObjective = 'hipertrofia', initialTargets = {} }: Props) {
  const [splitType, setSplitType] = useState<SplitType>('upper_lower');
  const [trainingDays, setTrainingDays] = useState(4);
  const [muscleVolume, setMuscleVolume] = useState<Record<string, number>>({});
  
  // Para estilo libre
  const [customDays, setCustomDays] = useState<Array<{name: string, muscles: string[]}>>([
    { name: 'Día 1', muscles: [] }
  ]);

  // ── Fuerza vs Hipertrofia/Mantenimiento ──
  const isStrength = blockObjective === 'fuerza';



  /**
   * Lista de ítems activos para los sliders.
   * - Hipertrofia/Mantenimiento: grupos musculares (MUSCLES)
   * - Fuerza: patrones de movimiento (ALL_MOVEMENT_PATTERNS como keys)
   */
  const activeItems: string[] = useMemo(() => {
    if (isStrength) {
      return ALL_MOVEMENT_PATTERNS as unknown as string[];
    }

    if (splitType === 'estilo_libre') {
      const all = new Set<string>();
      customDays.forEach(d => d.muscles.forEach(m => all.add(m)));
      return Array.from(all);
    }
    
    // Simplificación: Para los splits predefinidos, la mayoría usan todo el cuerpo.
    // Solo devolvemos todos los MUSCLES si no es estilo libre.
    return MUSCLES;
  }, [isStrength, splitType, customDays, trainingDays]);

  // Inicializar volumen al MAV por defecto
  useEffect(() => {
    const initialVolume: Record<string, number> = {};

    if (isStrength) {
      // ── Fuerza: inicializar NL por patrón de movimiento ──
      ALL_MOVEMENT_PATTERNS.forEach(pattern => {
        const threshold = getStrengthThreshold(pattern, athleteLevel);
        initialVolume[pattern] = (initialTargets && initialTargets[pattern] !== undefined)
          ? initialTargets[pattern]
          : threshold.mavMin;
      });
    } else {
      // ── Hipertrofia/Mantenimiento: inicializar series por grupo muscular ──
      activeItems.forEach(muscle => {
        const thresholds = getThresholdsForMuscleGroup(muscle, athleteLevel, blockObjective);
        initialVolume[muscle] = (initialTargets && initialTargets[muscle] !== undefined)
          ? initialTargets[muscle]
          : thresholds.mavMin;
      });
    }

    setMuscleVolume(initialVolume);
  }, [isStrength, splitType, athleteLevel, activeItems.length, initialTargets]);

  const handleVolumeChange = (key: string, value: number) => {
    setMuscleVolume(prev => ({ ...prev, [key]: value }));
  };

  /**
   * Sesiones generadas — solo para hipertrofia/mantenimiento.
   * En modo fuerza, el panel derecho es informativo (sin distributeSetsToSessions).
   */
  const generatedSessions = useMemo(() => {
    if (isStrength) return [];

    const weeklyVolume = Object.entries(muscleVolume).map(([muscleGroup, plannedSets]) => ({
      muscleGroup,
      plannedSets
    }));

    return distributeSetsToSessions({
      trainingDays,
      splitType,
      weeklyVolume,
      customDays: splitType === 'estilo_libre' ? customDays : undefined
    });
  }, [isStrength, splitType, trainingDays, muscleVolume, customDays]);

  const totalVolume = Object.values(muscleVolume).reduce((a, b) => a + b, 0);

  // Funciones para estilo libre
  const toggleMuscleInCustomDay = (dayIndex: number, muscle: string) => {
    const newDays = [...customDays];
    const day = newDays[dayIndex];
    if (day.muscles.includes(muscle)) {
      day.muscles = day.muscles.filter(m => m !== muscle);
    } else {
      day.muscles.push(muscle);
    }
    setCustomDays(newDays);
  };

  const addCustomDay = () => {
    setCustomDays([...customDays, { name: `Día ${customDays.length + 1}`, muscles: [] }]);
  };

  /** Unidad de medida según el objetivo. */
  const unit = isStrength ? 'NL' : 'series';

  /** Máximo del slider según el objetivo. */
  const sliderMax = isStrength ? 40 : 45;

  /**
   * Aplica la distribución al plan.
   * - Hipertrofia: pasa sesiones + targets normalmente.
   * - Fuerza: pasa sesiones vacías + targets por patrón (informativo).
   */
  const handleApply = () => {
    if (isStrength) {
      // Para fuerza, no generamos sesiones con distributeSetsToSessions.
      // Pasamos targets por patrón para que PlanPlanner los almacene.
      onApply([], muscleVolume);
    } else {
      onApply(generatedSessions, muscleVolume);
    }
  };

  // ── Color de estado por zona de umbral ──
  const getStatusColor = (val: number, mev: number, mavMin: number, mavMax: number, mrv: number): string => {
    if (val < mev) return '#666';
    if (val >= mavMin && val <= mavMax) return '#006400';
    if (val >= mrv) return '#8B0000';
    return '#B8860B';
  };

  // ───────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(5px)',
      padding: '10px', /* Reduced padding for mobile */
      fontFamily: "'Inter', 'Roboto', sans-serif",
      color: '#fff'
    }}>
      <style>{`
        .wizard-modal-box {
          flex-direction: row;
        }
        .wizard-left-panel {
          width: 45%;
          border-right: 1px solid #333;
          max-height: 90vh;
        }
        .wizard-right-panel {
          width: 55%;
          max-height: 90vh;
        }
        @media (max-width: 768px) {
          .wizard-modal-box {
            flex-direction: column !important;
            height: 95vh;
            max-height: 95vh !important;
          }
          .wizard-left-panel {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid #333;
            max-height: 50vh !important;
            height: 50vh;
          }
          .wizard-right-panel {
            width: 100% !important;
            max-height: 45vh !important;
            height: 45vh;
          }
        }
      `}</style>
      <div className="wizard-modal-box" style={{
        background: '#1A1A1A',
        border: '1px solid #333',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1100px',
        maxHeight: '90vh',
        display: 'flex',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden'
      }}>
        
        {/* PANEL IZQUIERDO: Configuración */}
        <div className="wizard-left-panel" style={{
          display: 'flex', flexDirection: 'column',
          background: '#151515',
          overflowY: 'auto'
        }}>
          <div style={{
            padding: '24px', borderBottom: '1px solid #333',
            position: 'sticky', top: 0, background: '#151515', zIndex: 10
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>{isStrength ? '🏋️' : '⚡'}</span> Asistente de Distribución
            </h2>
            <p style={{ fontSize: '14px', color: '#9ca3af', margin: '4px 0 0 0' }}>
              Nivel actual: <strong style={{ color: '#818cf8', textTransform: 'uppercase' }}>{athleteLevel}</strong>
              <span style={{
                display: 'inline-block',
                marginLeft: '8px',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: isStrength ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                color: isStrength ? '#f87171' : '#a5b4fc',
                border: `1px solid ${isStrength ? 'rgba(239, 68, 68, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
              }}>
                {blockObjective}
              </span>
            </p>
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* ── Split Selection (solo hipertrofia/mantenimiento) ── */}
            {!isStrength && (
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#d1d5db', marginBottom: '8px' }}>Split preferido</label>
                <select 
                  value={splitType}
                  onChange={(e) => setSplitType(e.target.value as SplitType)}
                  style={{
                    width: '100%', background: '#222', border: '1px solid #444',
                    borderRadius: '8px', padding: '8px 16px', color: '#fff',
                    outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value="upper_lower">Upper / Lower (Torso/Pierna)</option>
                  <option value="push_pull_legs">Push / Pull / Legs (Empuje/Tirón/Pierna)</option>
                  <option value="full_body">Full Body (Cuerpo Completo)</option>
                  <option value="arnold_split">Arnold Split (PechoEspalda/Pierna/Brazo)</option>
                  <option value="bro_split">Weider / Bro Split (1 músculo por día)</option>
                  <option value="estilo_libre">Estilo Libre (Personalizado)</option>
                </select>
              </div>
            )}

            {/* ── Nota informativa para fuerza ── */}
            {isStrength && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '13px',
                lineHeight: 1.5,
                color: '#d1d5db',
              }}>
                <div style={{ fontWeight: 'bold', color: '#f87171', marginBottom: '4px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🏋️ Modo Fuerza
                </div>
                En bloques de fuerza, el volumen se mide en <strong style={{ color: '#f87171' }}>NL (Número de Levantamientos)</strong> a 
                ≥ 80% 1RM, organizados por <strong style={{ color: '#f87171' }}>patrón de movimiento</strong> en vez de grupo muscular.
              </div>
            )}

            {/* ── Días por semana (solo hipertrofia/mantenimiento con split no libre) ── */}
            {!isStrength && splitType !== 'estilo_libre' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#d1d5db' }}>Días por semana</label>
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>{trainingDays} días</span>
                </div>
                <input 
                  type="range" 
                  min={2} max={6} step={1}
                  value={trainingDays}
                  onChange={(e) => setTrainingDays(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer' }}
                />
              </div>
            )}

            {/* ── Constructor Estilo Libre (solo hipertrofia/mantenimiento) ── */}
            {!isStrength && splitType === 'estilo_libre' && (
              <div style={{ border: '1px solid #444', borderRadius: '8px', padding: '16px', background: '#1E1E1E', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Días Personalizados</h3>
                {customDays.map((day, idx) => (
                  <div key={idx} style={{ background: '#222', border: '1px solid #333', borderRadius: '4px', padding: '12px' }}>
                    <input 
                      type="text" 
                      value={day.name}
                      onChange={e => {
                        const newDays = [...customDays];
                        newDays[idx].name = e.target.value;
                        setCustomDays(newDays);
                      }}
                      style={{ background: 'transparent', color: '#fff', fontWeight: 'bold', border: 'none', outline: 'none', marginBottom: '8px', width: '100%', fontSize: '14px' }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {MUSCLES.map(m => {
                        const isSelected = day.muscles.includes(m);
                        return (
                          <button
                            key={m}
                            onClick={() => toggleMuscleInCustomDay(idx, m)}
                            style={{
                              padding: '4px 8px', fontSize: '12px', borderRadius: '4px', cursor: 'pointer',
                              border: isSelected ? '1px solid #6366f1' : '1px solid #444',
                              background: isSelected ? 'rgba(99,102,241,0.2)' : '#151515',
                              color: isSelected ? '#a5b4fc' : '#6b7280'
                            }}
                          >
                            {m}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <button 
                  onClick={addCustomDay}
                  style={{
                    width: '100%', padding: '8px', background: '#2A2A2A', color: '#d1d5db',
                    border: 'none', borderRadius: '4px', fontSize: '14px', fontWeight: '500',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#333'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#2A2A2A'}
                >
                  + Añadir Día
                </button>
              </div>
            )}

            <hr style={{ borderColor: '#333', borderTop: 'none', margin: '0' }} />

            {/* ══════════════════════════════════════════════════
                SLIDERS DE VOLUMEN
                ══════════════════════════════════════════════════ */}
            {(isStrength || splitType !== 'estilo_libre' || activeItems.length > 0) && (
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#d1d5db', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {isStrength ? 'Ajuste de NL Semanal por Patrón' : 'Ajuste de Volumen Semanal'}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                  {isStrength ? (
                    /* ── SLIDERS DE FUERZA (Patrones de movimiento / NL) ── */
                    ALL_MOVEMENT_PATTERNS.map(pattern => {
                      const threshold = getStrengthThreshold(pattern, athleteLevel);
                      const val = muscleVolume[pattern] || 0;
                      const statusColor = getStatusColor(val, threshold.mev, threshold.mavMin, threshold.mavMax, threshold.mrv);

                      return (
                        <div key={pattern} style={{ position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <div>
                              <span style={{ fontSize: '14px', color: '#e5e7eb', fontWeight: '500' }}>{threshold.label}</span>
                              <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '6px' }}>
                                ({threshold.intensityZone})
                              </span>
                            </div>
                            <span style={{ fontSize: '14px', fontWeight: 'bold', color: statusColor }}>
                              {val} NL
                            </span>
                          </div>
                          
                          <div style={{ position: 'relative', paddingTop: '16px', paddingBottom: '8px' }}>
                            <input 
                              type="range" 
                              min={0} max={sliderMax} step={1}
                              value={val}
                              onChange={(e) => handleVolumeChange(pattern, Number(e.target.value))}
                              style={{ 
                                width: '100%', position: 'absolute', top: '16px', left: 0, 
                                zIndex: 10, opacity: 0, cursor: 'pointer', height: '6px' 
                              }}
                            />
                            <div style={{ width: '100%', height: '6px', background: '#333', borderRadius: '9999px', overflow: 'hidden' }}>
                              <div 
                                style={{ height: '100%', borderRadius: '9999px', transition: 'all 0.2s', width: `${(val / sliderMax) * 100}%`, backgroundColor: statusColor }}
                              />
                            </div>
                            
                            <div style={{ position: 'absolute', top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                              {/* MEV Marker */}
                              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', left: `${(threshold.mev / sliderMax) * 100}%`, transform: 'translateX(-50%)' }}>
                                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#E6E6FA', marginBottom: '2px' }}>MEV</span>
                                <div style={{ width: '2px', height: '12px', background: '#E6E6FA' }} />
                              </div>
                              {/* MAV Min Marker */}
                              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', left: `${(threshold.mavMin / sliderMax) * 100}%`, transform: 'translateX(-50%)' }}>
                                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#E0FFF0', marginBottom: '2px' }}>MAV</span>
                                <div style={{ width: '2px', height: '12px', background: '#E0FFF0' }} />
                              </div>
                              {/* MRV Marker */}
                              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', left: `${(threshold.mrv / sliderMax) * 100}%`, transform: 'translateX(-50%)' }}>
                                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#FFE4E1', marginBottom: '2px' }}>MRV</span>
                                <div style={{ width: '2px', height: '12px', background: '#FFE4E1' }} />
                              </div>
                            </div>
                          </div>

                          {/* Ejemplos de ejercicios — solo en modo fuerza */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                            {threshold.exampleExercises.slice(0, 3).map((ex, i) => (
                              <span key={i} style={{ fontSize: '10px', color: '#555', background: '#1E1E1E', padding: '1px 6px', borderRadius: '3px' }}>
                                {ex}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    /* ── SLIDERS DE HIPERTROFIA/MANTENIMIENTO (Grupos musculares / series) ── */
                    activeItems.map(muscle => {
                      const threshold = getThresholdsForMuscleGroup(muscle, athleteLevel, blockObjective);
                      const val = muscleVolume[muscle] || 0;
                      const statusColor = getStatusColor(val, threshold.mev, threshold.mavMin, threshold.mavMax, threshold.mrv);

                      return (
                        <div key={muscle} style={{ position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '14px', color: '#e5e7eb' }}>{muscle}</span>
                            <span style={{ fontSize: '14px', fontWeight: 'bold', color: statusColor }}>
                              {val} series
                            </span>
                          </div>
                          
                          <div style={{ position: 'relative', paddingTop: '16px', paddingBottom: '8px' }}>
                            <input 
                              type="range" 
                              min={0} max={sliderMax} step={1}
                              value={val}
                              onChange={(e) => handleVolumeChange(muscle, Number(e.target.value))}
                              style={{ 
                                width: '100%', position: 'absolute', top: '16px', left: 0, 
                                zIndex: 10, opacity: 0, cursor: 'pointer', height: '6px' 
                              }}
                            />
                            <div style={{ width: '100%', height: '6px', background: '#333', borderRadius: '9999px', overflow: 'hidden' }}>
                              <div 
                                style={{ height: '100%', borderRadius: '9999px', transition: 'all 0.2s', width: `${(val / sliderMax) * 100}%`, backgroundColor: statusColor }}
                              />
                            </div>
                            
                            <div style={{ position: 'absolute', top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                              {/* MEV Marker */}
                              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', left: `${(threshold.mev / sliderMax) * 100}%`, transform: 'translateX(-50%)' }}>
                                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#E6E6FA', marginBottom: '2px' }}>MEV</span>
                                <div style={{ width: '2px', height: '12px', background: '#E6E6FA' }} />
                              </div>
                              {/* MAV Min Marker */}
                              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', left: `${(threshold.mavMin / sliderMax) * 100}%`, transform: 'translateX(-50%)' }}>
                                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#E0FFF0', marginBottom: '2px' }}>MAV</span>
                                <div style={{ width: '2px', height: '12px', background: '#E0FFF0' }} />
                              </div>
                              {/* MRV Marker */}
                              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', left: `${(threshold.mrv / sliderMax) * 100}%`, transform: 'translateX(-50%)' }}>
                                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#FFE4E1', marginBottom: '2px' }}>MRV</span>
                                <div style={{ width: '2px', height: '12px', background: '#FFE4E1' }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            PANEL DERECHO: Distribución Resultante
            ══════════════════════════════════════════════════ */}
        <div className="wizard-right-panel" style={{
          width: '55%', display: 'flex', flexDirection: 'column', background: '#1A1A1A', position: 'relative'
        }}>
          <div style={{
            padding: '24px', borderBottom: '1px solid #333',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#1A1A1A', zIndex: 10
          }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                {isStrength ? 'Resumen de NL Semanal' : 'Distribución Generada'}
              </h3>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>
                {totalVolume} {unit} totales en la semana
              </p>
            </div>
            <button 
              onClick={onClose}
              style={{
                background: 'transparent', border: 'none', color: '#9ca3af',
                width: '36px', height: '36px', borderRadius: '8px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = '#333'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'transparent'; }}
            >
              ✕
            </button>
          </div>

          <div style={{ padding: '24px', overflowY: 'auto', flex: 1, background: '#1A1A1A' }}>

            {isStrength ? (
              /* ══════════════════════════════════════
                 PANEL DERECHO — MODO FUERZA
                 Resumen informativo de NL por patrón
                 ══════════════════════════════════════ */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {ALL_MOVEMENT_PATTERNS.map(pattern => {
                  const threshold = getStrengthThreshold(pattern, athleteLevel);
                  const val = muscleVolume[pattern] || 0;
                  const statusColor = getStatusColor(val, threshold.mev, threshold.mavMin, threshold.mavMax, threshold.mrv);

                  let statusLabel = 'Bajo MEV';
                  if (val >= threshold.mavMin && val <= threshold.mavMax) statusLabel = 'Zona Óptima (MAV)';
                  else if (val >= threshold.mrv) statusLabel = '⚠️ MRV Superado';
                  else if (val >= threshold.mev && val < threshold.mavMin) statusLabel = 'Entre MEV y MAV';
                  else if (val > threshold.mavMax && val < threshold.mrv) statusLabel = 'Alto (cerca MRV)';

                  if (val === 0) return null;

                  return (
                    <div key={pattern} style={{
                      background: '#222',
                      border: `1px solid ${statusColor}33`,
                      borderRadius: '10px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        padding: '12px 16px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        borderBottom: '1px solid #333',
                        background: '#2A2A2A',
                      }}>
                        <div>
                          <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>
                            {threshold.label}
                          </span>
                          <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '8px' }}>
                            {threshold.intensityZone}
                          </span>
                        </div>
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px',
                          color: statusColor, background: `${statusColor}15`,
                          padding: '4px 10px', borderRadius: '6px',
                        }}>
                          {val} NL
                        </span>
                      </div>
                      <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: statusColor, fontWeight: '500' }}>
                          {statusLabel}
                        </span>
                        <span style={{ fontSize: '11px', color: '#555' }}>
                          MEV {threshold.mev} · MAV {threshold.mavMin}–{threshold.mavMax} · MRV {threshold.mrv}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Nota educativa */}
                <div style={{
                  marginTop: '8px', padding: '12px 16px', borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)',
                  fontSize: '12px', lineHeight: 1.5, color: '#9ca3af',
                }}>
                  <strong style={{ color: '#f87171' }}>NL = Número de Levantamientos</strong> — reps × series a ≥ 80% 1RM.
                  Ejemplo: 5×3 = 15 NL, 3×2 = 6 NL. Los umbrales son semanales por patrón.
                  Usa los <strong style={{ color: '#d1d5db' }}>Protocolos Científicos</strong> para generar la estructura de días.
                </div>
              </div>
            ) : (
              /* ══════════════════════════════════════
                 PANEL DERECHO — MODO HIPERTROFIA/MANTENIMIENTO
                 Distribución generada por sesión (comportamiento original)
                 ══════════════════════════════════════ */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {generatedSessions.map(session => {
                  const sessionSets = session.muscleTargets.reduce((a, b) => a + b.plannedSets, 0);
                  
                  return (
                    <div key={session.id} style={{ background: '#222', border: '1px solid #333', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
                      <div style={{ background: '#2A2A2A', padding: '12px 16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>{session.label}</span>
                        <span style={{ fontSize: '12px', fontWeight: '500', background: '#151515', color: '#9ca3af', padding: '4px 8px', borderRadius: '4px' }}>
                          {sessionSets} series
                        </span>
                      </div>
                      
                      <div style={{ padding: 0 }}>
                        {session.muscleTargets.length === 0 && (
                          <div style={{ padding: '16px', textAlign: 'center', fontSize: '14px', color: '#6b7280', fontStyle: 'italic' }}>
                            Día de descanso o sin volumen asignado.
                          </div>
                        )}
                        {session.muscleTargets.map((target, idx) => (
                          <div 
                            key={target.muscleGroup} 
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '12px 16px', fontSize: '14px',
                              borderBottom: idx !== session.muscleTargets.length - 1 ? '1px solid rgba(51, 51, 51, 0.5)' : 'none'
                            }}
                          >
                            <span style={{ color: '#d1d5db' }}>{target.muscleGroup}</span>
                            <span style={{ fontFamily: 'monospace', color: '#a5b4fc', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                              {target.plannedSets} series
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Botón Aplicar ── */}
          <div style={{ padding: '24px', borderTop: '1px solid #333', background: '#1A1A1A', position: 'sticky', bottom: 0 }}>
            <button 
              onClick={handleApply}
              style={{
                width: '100%',
                background: isStrength ? '#dc2626' : '#4f46e5',
                color: '#fff', fontWeight: 'bold',
                padding: '14px 16px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                boxShadow: isStrength ? '0 0 15px rgba(220,38,38,0.3)' : '0 0 15px rgba(79,70,229,0.3)',
                transition: 'all 0.2s', fontSize: '16px'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = isStrength ? '#b91c1c' : '#4338ca'}
              onMouseOut={(e) => e.currentTarget.style.background = isStrength ? '#dc2626' : '#4f46e5'}
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {isStrength ? 'Guardar Objetivos de NL' : 'Aplicar Esqueleto al Plan'}
            </button>
            <p style={{ fontSize: '12px', textAlign: 'center', color: '#6b7280', margin: '12px 0 0 0' }}>
              {isStrength
                ? 'Esto guardará los objetivos de NL por patrón. Usa los Protocolos Científicos para crear los días.'
                : 'Esto creará los días vacíos con las series asignadas listas para que elijas los ejercicios.'
              }
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
