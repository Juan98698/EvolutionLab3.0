import { useState, useEffect } from 'react';
import { AthleteLevel, BlockObjective } from '../../lib/volumeThresholds';
import { ProtocolTemplate, getProtocolsForContext } from '../../lib/protocols';
import { TrainingDay } from '../../types/database.types';
import { detectPatternFromExerciseName } from '../../lib/strengthThresholds';
import { supabase } from '../../lib/supabaseClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  objective: BlockObjective;
  level: AthleteLevel;
  onApplyProtocol: (days: TrainingDay[], recommendedSchedule?: number[]) => void;
}

export function ProtocolSelectorModal({ isOpen, onClose, objective, level, onApplyProtocol }: Props) {
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolTemplate | null>(null);
  const [applying, setApplying] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isOpen) return null;

  const isStrengthBlock = objective === 'fuerza';
  const protocols = getProtocolsForContext(objective, level);

  const handleApply = async () => {
    if (!selectedProtocol) return;
    setApplying(true);

    // ── Paso 1: Resolver alias → nombre real via ejercicios_alias ───────────
    // Recopila nombres únicos del protocolo y los busca en la tabla de alias.
    const allNames = selectedProtocol.days
      .flatMap(d => d.exercises.map(ex => ex.name.trim()));
    const uniqueNames = [...new Set(allNames)];

    // Mapa alias → nombre_real
    let aliasMap: Record<string, string> = {};
    try {
      const { data: aliasData } = await supabase
        .from('ejercicios_alias')
        .select('alias, nombre_real')
        .in('alias', uniqueNames);

      if (aliasData) {
        aliasData.forEach((row: any) => {
          aliasMap[row.alias.trim()] = row.nombre_real.trim();
        });
      }
    } catch (e) {
      console.warn('No se pudo consultar ejercicios_alias:', e);
    }

    // ── Paso 2: Buscar ejercicios reales en ejercicios_globales ─────────────
    // Usa los nombres_real resueltos para traer imagen, video, descripcion
    // y movement_pattern de una sola query.
    const nombresReales = Object.values(aliasMap);
    let globalMap: Record<string, {
      imagen_url?: string | null;
      video_url?: string | null;
      descripcion?: string | null;
      movement_pattern?: string | null;
    }> = {};

    if (nombresReales.length > 0) {
      try {
        const { data: globalData } = await supabase
          .from('ejercicios_globales')
          .select('nombre, imagen_url, video_url, descripcion, movement_pattern')
          .in('nombre', nombresReales);

        if (globalData) {
          globalData.forEach((row: any) => {
            globalMap[row.nombre.trim()] = {
              imagen_url:       row.imagen_url,
              video_url:        row.video_url,
              descripcion:      row.descripcion,
              movement_pattern: row.movement_pattern,
            };
          });
        }
      } catch (e) {
        console.warn('No se pudo enriquecer desde ejercicios_globales:', e);
      }
    }

    // ── Paso 3: Construir trainingDays enriquecidos ──────────────────────────
    const trainingDays: TrainingDay[] = selectedProtocol.days.map((day, idx) => ({
      id: crypto.randomUUID(),
      dayNumber: idx + 1,
      name: day.label,
      exercises: day.exercises.map(ex => {
        const nombreReal = aliasMap[ex.name.trim()];
        const global     = nombreReal ? globalMap[nombreReal] : undefined;

        // Patrón: primero desde la BD, luego detección por nombre como fallback
        const pattern = global?.movement_pattern
          || (isStrengthBlock ? (detectPatternFromExerciseName(ex.name) ?? undefined) : undefined);

        return {
          id:              crypto.randomUUID(),
          nombre:          nombreReal || ex.name,  // nombre real si existe, genérico si no
          nombre_original: ex.name,                // siempre guardamos el genérico como referencia
          grupo_muscular:  ex.muscle,
          ...(pattern             ? { movement_pattern: pattern }        : {}),
          ...(global?.imagen_url  ? { image_url: global.imagen_url }     : {}),
          ...(global?.video_url   ? { video_url: global.video_url }      : {}),
          ...(global?.descripcion ? { description: global.descripcion }  : {}),
          variables: {
            'series de trabajo': ex.sets,
            'repeticiones':      ex.reps,
            'rir':               ex.rir,
            'descanso':          ex.rest,
          }
        };
      })
    }));

    onApplyProtocol(trainingDays, selectedProtocol.recommendedSchedule);
    setApplying(false);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        background: '#111', width: '100%', maxWidth: '800px', maxHeight: '90vh',
        borderRadius: '12px', border: '1px solid #333', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', color: '#fff', fontFamily: 'system-ui, sans-serif'
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>
              {isStrengthBlock ? '🏋️ Protocolos de Fuerza General' : '📚 Protocolos Científicos'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#888' }}>
              Mostrando para:{' '}
              <strong style={{ color: isStrengthBlock ? '#f59e0b' : '#0ea5e9', textTransform: 'capitalize' }}>{objective}</strong>
              {' • '}
              <strong style={{ color: isStrengthBlock ? '#f59e0b' : '#0ea5e9', textTransform: 'capitalize' }}>{level}</strong>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, overflow: isMobile ? 'auto' : 'hidden' }}>
          
          {/* Sidebar: Lista de protocolos */}
          <div style={{ width: isMobile ? '100%' : '280px', borderRight: isMobile ? 'none' : '1px solid #222', borderBottom: isMobile ? '1px solid #222' : 'none', overflowY: isMobile ? 'visible' : 'auto', padding: '16px', boxSizing: 'border-box' }}>
            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#666', letterSpacing: '0.05em', marginBottom: '12px' }}>Plantillas Recomendadas</h3>
            {protocols.map(p => (
              <div 
                key={p.id}
                onClick={() => setSelectedProtocol(p)}
                style={{
                  padding: '12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '8px',
                  background: selectedProtocol?.id === p.id ? 'rgba(14, 165, 233, 0.1)' : '#1a1a1a',
                  border: `1px solid ${selectedProtocol?.id === p.id ? '#0ea5e9' : '#222'}`,
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px', color: selectedProtocol?.id === p.id ? '#0ea5e9' : '#fff' }}>
                  {p.name}
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>
                  {p.daysPerWeek} días/semana • Nivel: <span style={{ textTransform: 'capitalize' }}>{p.level}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#aaa', lineHeight: 1.4 }}>
                  {p.description}
                </div>
              </div>
            ))}
          </div>

          {/* Main Area: Guía Científica */}
          <div style={{ flex: 1, padding: isMobile ? '16px' : '24px', overflowY: isMobile ? 'visible' : 'auto', background: '#0a0a0a', boxSizing: 'border-box' }}>
            {selectedProtocol ? (
              <div>
                <div style={{ display: 'inline-block', background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                  Guía del Mentor Científico
                </div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '24px' }}>¿Por qué este protocolo?</h3>
                <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#d1d5db', background: '#111', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #0ea5e9' }}>
                  {selectedProtocol.scienceGuide}
                </p>

                <h4 style={{ margin: '24px 0 16px', fontSize: '16px', color: '#fff' }}>Estructura del Esqueleto ({selectedProtocol.daysPerWeek} Días)</h4>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {selectedProtocol.days.map((day, idx) => (
                    <div key={idx} style={{ background: '#1a1a1a', borderRadius: '8px', padding: '12px', border: '1px solid #222' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '13px', color: isStrengthBlock ? '#f59e0b' : '#0ea5e9', marginBottom: '8px' }}>{day.label}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {day.exercises.map((ex, eIdx) => {
                          const pattern = isStrengthBlock ? detectPatternFromExerciseName(ex.name) : null;
                          return (
                            <span key={eIdx} style={{ fontSize: '11px', background: '#222', padding: '4px 8px', borderRadius: '4px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span>{ex.name} ({ex.sets}x{ex.reps})</span>
                              {pattern && (
                                <span style={{ color: '#f59e0b', fontSize: '10px', opacity: 0.8 }}>
                                  {pattern.replace('_', ' ')}
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧬</div>
                <p style={{ fontSize: '14px' }}>Selecciona un protocolo de la lista para ver la guía científica.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #222', background: '#111', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #333', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '14px' }}>
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={!selectedProtocol || applying}
            style={{
              padding: '8px 24px', borderRadius: '6px', border: 'none',
              background: selectedProtocol && !applying
                ? (isStrengthBlock ? '#d97706' : '#0ea5e9')
                : '#333',
              color: selectedProtocol && !applying ? '#fff' : '#888',
              cursor: selectedProtocol && !applying ? 'pointer' : 'not-allowed',
              fontWeight: 'bold', fontSize: '14px', transition: 'background 0.2s',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            {applying && (
              <span style={{ width: '14px', height: '14px', border: '2px solid #888', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
            )}
            {applying
              ? 'Buscando en biblioteca...'
              : isStrengthBlock ? 'Aplicar Protocolo de Fuerza' : 'Aplicar Protocolo al Plan'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
