import { useState, useEffect } from 'react';
import { AthleteLevel, BlockObjective } from '../../lib/volumeThresholds';
import { ProtocolTemplate, getProtocolsForContext } from '../../lib/protocols';
import { TrainingDay, TrainerTemplate } from '../../types/database.types';
import { detectPatternFromExerciseName } from '../../lib/strengthThresholds';
import { supabase } from '../../lib/supabaseClient';
import { useModalA11y } from '../../hooks/useModalA11y';
import { useConfirm } from '../../context/ConfirmDialogContext';
import { getTrainerTemplates, deleteTrainerTemplate, applyTemplateToPlan } from '../../lib/trainerTemplates';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  objective: BlockObjective;
  level: AthleteLevel;
  trainerId?: string;
  client1RM?: Record<string, number>;
  onApplyProtocol: (days: TrainingDay[], recommendedSchedule?: number[]) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function ProtocolSelectorModal({
  isOpen,
  onClose,
  objective,
  level,
  trainerId = 'default',
  client1RM,
  onApplyProtocol,
  showToast
}: Props) {
  const [activeTab, setActiveTab] = useState<'scientific' | 'custom'>('scientific');
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolTemplate | null>(null);
  const [customTemplates, setCustomTemplates] = useState<TrainerTemplate[]>([]);
  const [selectedCustomTemplate, setSelectedCustomTemplate] = useState<TrainerTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [applying, setApplying] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === 'custom') {
      getTrainerTemplates(trainerId).then(list => {
        setCustomTemplates(list);
        if (list.length > 0 && !selectedCustomTemplate) {
          setSelectedCustomTemplate(list[0]);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab, trainerId]);

  const dialogRef = useModalA11y<HTMLDivElement>({ isOpen, onClose });
  const confirm = useConfirm();

  if (!isOpen) return null;

  const isStrengthBlock = objective === 'fuerza';
  const protocols = getProtocolsForContext(objective, level);

  const filteredCustomTemplates = customTemplates.filter(t => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      t.nombre.toLowerCase().includes(q) ||
      (t.descripcion || '').toLowerCase().includes(q) ||
      t.objetivo.toLowerCase().includes(q)
    );
  });

  const handleDeleteTemplate = async (templateId: string, name: string) => {
    const confirmed = await confirm(`¿Estás seguro de que quieres eliminar la plantilla "${name}"?`, {
      title: 'Eliminar plantilla',
      confirmText: 'Eliminar',
      danger: true
    });
    if (!confirmed) return;
    await deleteTrainerTemplate(templateId, trainerId);
    setCustomTemplates(prev => prev.filter(t => t.id !== templateId));
    if (selectedCustomTemplate?.id === templateId) {
      setSelectedCustomTemplate(null);
    }
    if (showToast) showToast(`Plantilla "${name}" eliminada.`, 'info');
  };

  const handleApplyCustomTemplate = () => {
    if (!selectedCustomTemplate) return;
    setApplying(true);

    const result = applyTemplateToPlan(selectedCustomTemplate, client1RM);
    onApplyProtocol(result.trainingDays);

    if (showToast) {
      showToast(
        client1RM && Object.keys(client1RM).length > 0
          ? `✅ Plantilla "${selectedCustomTemplate.nombre}" cargada y pesos calculados según las marcas de 1RM del atleta.`
          : `✅ Plantilla "${selectedCustomTemplate.nombre}" cargada.`,
        'success'
      );
    }

    setApplying(false);
    onClose();
  };

  const handleApply = async () => {
    if (activeTab === 'custom') {
      handleApplyCustomTemplate();
      return;
    }

    if (!selectedProtocol) return;
    setApplying(true);

    // ── Paso 1: Resolver alias → nombre real via ejercicios_alias ───────────
    const allNames = selectedProtocol.days.flatMap(d => d.exercises.map(ex => ex.name.trim()));
    const uniqueNames = [...new Set(allNames)];

    const aliasMap: Record<string, string> = {};
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
    const nombresReales = [...new Set([...uniqueNames, ...Object.values(aliasMap)])];
    const globalMap: Record<string, {
      imagen_url?: string | null;
      gif_url?: string | null;
      video_url?: string | null;
      descripcion?: string | null;
      movement_pattern?: string | null;
    }> = {};

    if (nombresReales.length > 0) {
      try {
        const { data: globalData } = await supabase
          .from('ejercicios_globales')
          .select('nombre, imagen_url, gif_url, video_url, descripcion, movement_pattern')
          .in('nombre', nombresReales);

        if (globalData) {
          globalData.forEach((row: any) => {
            const item = {
              imagen_url:       row.imagen_url,
              gif_url:          row.gif_url,
              video_url:        row.video_url,
              descripcion:      row.descripcion,
              movement_pattern: row.movement_pattern,
            };
            globalMap[row.nombre.trim()] = item;
            globalMap[row.nombre.trim().toLowerCase()] = item;
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
        const nameClean  = ex.name.trim();
        const nombreReal = aliasMap[nameClean] || nameClean;
        const global     = globalMap[nombreReal] || globalMap[nombreReal.toLowerCase()] || globalMap[nameClean.toLowerCase()];

        const pattern = global?.movement_pattern
          || (isStrengthBlock ? (detectPatternFromExerciseName(ex.name) ?? undefined) : undefined);

        return {
          id:              crypto.randomUUID(),
          nombre:          nombreReal,
          nombre_original: ex.name,
          grupo_muscular:  ex.muscle,
          ...(pattern             ? { movement_pattern: pattern }        : {}),
          ...(global?.imagen_url  ? { image_url: global.imagen_url }     : {}),
          ...(global?.gif_url     ? { gif_url: global.gif_url }          : {}),
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
      backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="protocol-selector-title"
        tabIndex={-1}
        style={{
          background: '#0d1322', width: '100%', maxWidth: '880px', maxHeight: '90vh',
          borderRadius: '16px', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', color: '#fff', fontFamily: 'system-ui, sans-serif'
        }}>
        
        {/* Header & Tabs */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#111827' }}>
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 id="protocol-selector-title" style={{ margin: 0, fontSize: '18px', color: '#fff' }}>
                {activeTab === 'scientific' ? (isStrengthBlock ? '🏋️ Protocolos de Fuerza' : '🧪 Protocolos Científicos') : '⭐ Mis Plantillas Guardadas'}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                {activeTab === 'scientific' ? (
                  <>Mostrando para: <strong style={{ color: '#00F2FE', textTransform: 'capitalize' }}>{objective}</strong> • <strong style={{ color: '#00F2FE', textTransform: 'capitalize' }}>{level}</strong></>
                ) : (
                  <>Tus plantillas personalizadas reutilizables para cualquier atleta.</>
                )}
              </p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
          </div>

          {/* Navigation Bar Tabs */}
          <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0 20px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('scientific')}
              style={{
                padding: '12px 18px', border: 'none', background: 'transparent',
                color: activeTab === 'scientific' ? '#00F2FE' : '#94a3b8',
                fontWeight: activeTab === 'scientific' ? 700 : 500, fontSize: '0.85rem',
                borderBottom: activeTab === 'scientific' ? '2px solid #00F2FE' : '2px solid transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              🧪 Protocolos Científicos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              style={{
                padding: '12px 18px', border: 'none', background: 'transparent',
                color: activeTab === 'custom' ? '#00F2FE' : '#94a3b8',
                fontWeight: activeTab === 'custom' ? 700 : 500, fontSize: '0.85rem',
                borderBottom: activeTab === 'custom' ? '2px solid #00F2FE' : '2px solid transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              ⭐ Mis Plantillas Guardadas ({customTemplates.length})
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, overflow: isMobile ? 'auto' : 'hidden' }}>
          
          {/* TAB 1: PROTOCOLOS CIENTÍFICOS */}
          {activeTab === 'scientific' && (
            <>
              {/* Sidebar: Lista de protocolos */}
              <div style={{ width: isMobile ? '100%' : '280px', borderRight: isMobile ? 'none' : '1px solid #1e293b', borderBottom: isMobile ? '1px solid #1e293b' : 'none', overflowY: isMobile ? 'visible' : 'auto', padding: '16px', boxSizing: 'border-box' }}>
                <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', marginBottom: '12px' }}>Plantillas Recomendadas</h3>
                {protocols.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProtocol(p)}
                    aria-pressed={selectedProtocol?.id === p.id}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit',
                      padding: '12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '8px',
                      background: selectedProtocol?.id === p.id ? 'rgba(0, 242, 254, 0.1)' : '#161e31',
                      border: `1px solid ${selectedProtocol?.id === p.id ? '#00F2FE' : 'rgba(255,255,255,0.06)'}`,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px', color: selectedProtocol?.id === p.id ? '#00F2FE' : '#fff' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>
                      {p.daysPerWeek} días/semana • Nivel: <span style={{ textTransform: 'capitalize' }}>{p.level}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4 }}>
                      {p.description}
                    </div>
                  </button>
                ))}
              </div>

              {/* Main Area: Guía Científica */}
              <div style={{ flex: 1, padding: isMobile ? '16px' : '24px', overflowY: isMobile ? 'visible' : 'auto', background: '#090d16', boxSizing: 'border-box' }}>
                {selectedProtocol ? (
                  <div>
                    <div style={{ display: 'inline-block', background: 'rgba(0, 242, 254, 0.15)', color: '#00F2FE', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                      Guía del Mentor Científico
                    </div>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>¿Por qué este protocolo?</h3>
                    <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#e2e8f0', background: '#131b2e', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #00F2FE' }}>
                      {selectedProtocol.scienceGuide}
                    </p>

                    <h4 style={{ margin: '24px 0 16px', fontSize: '15px', color: '#fff' }}>Estructura ({selectedProtocol.daysPerWeek} Días)</h4>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {selectedProtocol.days.map((day, idx) => (
                        <div key={idx} style={{ background: '#131b2e', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#00F2FE', marginBottom: '8px' }}>{day.label}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {day.exercises.map((ex, eIdx) => {
                              const pattern = isStrengthBlock ? detectPatternFromExerciseName(ex.name) : null;
                              return (
                                <span key={eIdx} style={{ fontSize: '11px', background: '#1c2842', padding: '4px 8px', borderRadius: '4px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧬</div>
                    <p style={{ fontSize: '14px' }}>Selecciona un protocolo de la lista para ver la guía científica.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: MIS PLANTILLAS GUARDADAS */}
          {activeTab === 'custom' && (
            <>
              {/* Sidebar: Lista de plantillas personalizadas */}
              <div style={{ width: isMobile ? '100%' : '300px', borderRight: isMobile ? 'none' : '1px solid #1e293b', borderBottom: isMobile ? '1px solid #1e293b' : 'none', overflowY: isMobile ? 'visible' : 'auto', padding: '16px', boxSizing: 'border-box' }}>
                <input
                  type="text"
                  placeholder="🔍 Buscar plantilla..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%', background: '#161e31', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '0.85rem',
                    outline: 'none', marginBottom: '14px', boxSizing: 'border-box'
                  }}
                />

                {filteredCustomTemplates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 12px', color: '#64748b', fontSize: '0.85rem' }}>
                    {searchQuery ? 'No hay plantillas que coincidan con la búsqueda.' : 'Aún no has guardado plantillas personalizadas. Puedes guardar cualquier rutina desde el planificador.'}
                  </div>
                ) : (
                  filteredCustomTemplates.map(tpl => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setSelectedCustomTemplate(tpl)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit',
                        padding: '12px', borderRadius: '10px', cursor: 'pointer', marginBottom: '10px',
                        background: selectedCustomTemplate?.id === tpl.id ? 'rgba(0, 242, 254, 0.12)' : '#161e31',
                        border: `1px solid ${selectedCustomTemplate?.id === tpl.id ? '#00F2FE' : 'rgba(255,255,255,0.06)'}`,
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                          textTransform: 'uppercase', background: tpl.objetivo === 'fuerza' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0, 242, 254, 0.2)',
                          color: tpl.objetivo === 'fuerza' ? '#f59e0b' : '#00F2FE'
                        }}>
                          {tpl.objetivo}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{tpl.dias_semana} días</span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: selectedCustomTemplate?.id === tpl.id ? '#00F2FE' : '#fff', marginBottom: '4px' }}>
                        {tpl.nombre}
                      </div>
                      {tpl.descripcion && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {tpl.descripcion}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* Main Area: Inspector de la plantilla seleccionada */}
              <div style={{ flex: 1, padding: isMobile ? '16px' : '24px', overflowY: isMobile ? 'visible' : 'auto', background: '#090d16', boxSizing: 'border-box' }}>
                {selectedCustomTemplate ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <h3 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>{selectedCustomTemplate.nombre}</h3>
                      <button
                        onClick={() => handleDeleteTemplate(selectedCustomTemplate.id, selectedCustomTemplate.nombre)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#ef4444', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem',
                          fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        🗑️ Eliminar
                      </button>
                    </div>

                    {selectedCustomTemplate.descripcion && (
                      <div style={{ background: '#131b2e', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #00F2FE', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '20px' }}>
                        <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>📝 Notas del Entrenador:</strong>
                        {selectedCustomTemplate.descripcion}
                      </div>
                    )}

                    {/* Días y Ejercicios Desglosados */}
                    <h4 style={{ margin: '20px 0 12px', fontSize: '14px', color: '#fff' }}>
                      Estructura de la Rutina ({selectedCustomTemplate.plan_data.trainingDays?.length || 0} Días)
                    </h4>

                    <div style={{ display: 'grid', gap: '14px' }}>
                      {(selectedCustomTemplate.plan_data.trainingDays || []).map((day, idx) => (
                        <div key={day.id || idx} style={{ background: '#131b2e', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#00F2FE', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{day.name || `Día ${idx + 1}`}</span>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>{(day.exercises || []).length} ejercicios</span>
                          </div>

                          <div style={{ display: 'grid', gap: '8px' }}>
                            {(day.exercises || []).map((ex, eIdx) => (
                              <div key={ex.id || eIdx} style={{
                                background: '#1c2842', padding: '10px 12px', borderRadius: '8px',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                              }}>
                                <div>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{ex.nombre}</span>
                                    {ex.video_url && (
                                      <span style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                        📹 Video propio
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                                    {ex.grupo_muscular} • {ex.variables['series de trabajo'] || 3} series • {ex.variables['repeticiones'] || '10'} reps {ex.variables['rir'] ? `• RIR ${ex.variables['rir']}` : ''}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>⭐</div>
                    <p style={{ fontSize: '14px' }}>Selecciona una plantilla para ver sus detalles y aplicarla.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', background: '#111827', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '14px' }}>
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={(activeTab === 'scientific' ? !selectedProtocol : !selectedCustomTemplate) || applying}
            style={{
              padding: '8px 24px', borderRadius: '8px', border: 'none',
              background: (activeTab === 'scientific' ? selectedProtocol : selectedCustomTemplate) && !applying
                ? 'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)'
                : 'rgba(255,255,255,0.1)',
              color: (activeTab === 'scientific' ? selectedProtocol : selectedCustomTemplate) && !applying ? '#04070e' : '#64748b',
              cursor: (activeTab === 'scientific' ? selectedProtocol : selectedCustomTemplate) && !applying ? 'pointer' : 'not-allowed',
              fontWeight: 'bold', fontSize: '14px', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            {applying && (
              <span style={{ width: '14px', height: '14px', border: '2px solid #04070e', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
            )}
            {applying
              ? 'Aplicando...'
              : (activeTab === 'custom' ? '🚀 Aplicar Plantilla a este Atleta' : (isStrengthBlock ? 'Aplicar Protocolo de Fuerza' : 'Aplicar Protocolo al Plan'))
            }
          </button>
        </div>
      </div>
    </div>
  );
}

