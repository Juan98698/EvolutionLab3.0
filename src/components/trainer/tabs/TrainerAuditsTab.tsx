import React from 'react';
import { Profile } from '../../../types/database.types';
import { Notification } from '../../../lib/overload';

const ALERT_COLORS: Record<string, { bg: string, border: string, text: string, icon: string }> = {
  'riesgo_estancamiento': { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#fca5a5', icon: '⚠️' },
  'oportunidad_subida': { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', text: '#6ee7b7', icon: '📈' },
  'exito': { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', text: '#93c5fd', icon: '🏆' },
  'info': { bg: 'rgba(255, 255, 255, 0.05)', border: 'rgba(255, 255, 255, 0.1)', text: 'white', icon: '💡' }
};

const calculateVolume = (peso: number, series_reps: any) => {
  let reps = 0;
  if (Array.isArray(series_reps)) {
    reps = series_reps.reduce((acc, curr) => acc + (parseInt(curr) || 0), 0);
  } else if (typeof series_reps === 'string') {
    reps = series_reps.split('-').reduce((acc, curr) => acc + (parseInt(curr) || 0), 0);
  }
  return peso * reps;
};

const calculateEstimated1RM = (peso: number, series_reps: any) => {
  let maxReps = 0;
  if (Array.isArray(series_reps)) {
    maxReps = Math.max(...series_reps.map(r => parseInt(r) || 0));
  } else if (typeof series_reps === 'string') {
    maxReps = Math.max(...series_reps.split('-').map(r => parseInt(r) || 0));
  }
  if (maxReps === 0) return 0;
  const epley = peso * (1 + maxReps / 30);
  const brzycki = peso / (1.0278 - 0.0278 * maxReps);
  return (epley + brzycki) / 2;
};

interface TrainerAuditsTabProps {
  actividades: any[];
  alertasClientes: Record<string, Notification[]>;
  loadingAuditoria: boolean;
  fetchAuditoria: (force?: boolean) => void;
  mostRecentSessionIds: Set<string>;
  availableExercisesForFilter: string[];
  filasFiltradasProgresion: any[];
  selectedAnalysisClient: string;
  setSelectedAnalysisClient: (val: string) => void;
  selectedAnalysisExercise: string;
  setSelectedAnalysisExercise: (val: string) => void;
  auditViewMode: 'cronologica' | 'ejercicio';
  setAuditViewMode: (val: 'cronologica' | 'ejercicio') => void;
  expandedActividades: Record<string, boolean>;
  setExpandedActividades: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  clientes: Profile[];
  activeSubTab?: string;
}

const TrainerAuditsTab: React.FC<TrainerAuditsTabProps> = ({
  actividades,
  alertasClientes,
  loadingAuditoria,
  fetchAuditoria,
  mostRecentSessionIds,
  availableExercisesForFilter,
  filasFiltradasProgresion,
  selectedAnalysisClient,
  setSelectedAnalysisClient,
  selectedAnalysisExercise,
  setSelectedAnalysisExercise,
  auditViewMode,
  setAuditViewMode,
  expandedActividades,
  setExpandedActividades,
  clientes,
  activeSubTab
}) => {
  return (
    <div className="stagger-item" style={{ animationDelay: '0.1s', display: activeSubTab === 'auditoria' ? 'block' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '18px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--theme-primary)' }}>📊</span> HISTORIAL DE ACTIVIDAD Y AUDITORÍA
        </h2>
        <button
          onClick={() => fetchAuditoria(true)}
          disabled={loadingAuditoria}
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            color: 'white',
            padding: '6px 12px',
            fontSize: '11px',
            fontFamily: "'Orbitron', sans-serif",
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s',
            opacity: loadingAuditoria ? 0.6 : 1
          }}
        >
          <span>🔄</span> Actualizar Actividad
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'flex-start' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setAuditViewMode('cronologica')}
            style={{
              fontSize: '10px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 600,
              transition: 'all 0.2s',
              background: auditViewMode === 'cronologica' ? 'var(--theme-btn-gradient)' : 'transparent',
              color: auditViewMode === 'cronologica' ? 'white' : 'rgba(255,255,255,0.5)',
              boxShadow: auditViewMode === 'cronologica' ? '0 0 10px var(--theme-btn-glow)' : 'none',
            }}
          >
            ⏱️ Vista Cronológica
          </button>
          <button
            onClick={() => setAuditViewMode('ejercicio')}
            style={{
              fontSize: '10px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 600,
              transition: 'all 0.2s',
              background: auditViewMode === 'ejercicio' ? 'var(--theme-btn-gradient)' : 'transparent',
              color: auditViewMode === 'ejercicio' ? 'white' : 'rgba(255,255,255,0.5)',
              boxShadow: auditViewMode === 'ejercicio' ? '0 0 10px var(--theme-btn-glow)' : 'none',
            }}
          >
            📊 Análisis por Ejercicio
          </button>
        </div>
      </div>

      {loadingAuditoria ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--theme-primary)', fontFamily: 'Orbitron, sans-serif' }}>
          <span>Analizando registros y procesando sobrecarga progresiva...</span>
        </div>
      ) : actividades.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--theme-card-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid var(--theme-border)', borderRadius: '16px' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)' }}>No hay sesiones registradas por tus atletas en los últimos días.</p>
        </div>
      ) : auditViewMode === 'cronologica' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {actividades.map((sesion) => {
            const hasExercises = sesion.sesiones_ejercicios && sesion.sesiones_ejercicios.length > 0;
            const isExpanded = !!expandedActividades[sesion.id];
            const formattedDate = sesion.fecha ? sesion.fecha.split('-').reverse().join('/') : '-';
            
            const isMostRecent = mostRecentSessionIds.has(sesion.id);
            const alertasAtleta = isMostRecent ? (alertasClientes[sesion.cliente_id] || []) : [];

            return (
              <div
                key={sesion.id}
                style={{
                  background: 'var(--theme-card-bg)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid var(--theme-border)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      👤 {sesion.profiles?.nombre || 'Atleta desconocido'}
                    </h3>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'inline-block', marginTop: '2px' }}>
                      📅 Registro: {formattedDate}
                    </span>
                  </div>

                  {hasExercises && (
                    <button
                      onClick={() => setExpandedActividades(prev => ({ ...prev, [sesion.id]: !isExpanded }))}
                      style={{
                        background: isExpanded ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        color: 'white',
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontFamily: "'Orbitron', sans-serif",
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>{isExpanded ? 'Ocultar Detalle' : 'Ver Detalle'}</span>
                      <span>{isExpanded ? '▲' : '▼'}</span>
                    </button>
                  )}
                </div>

                {alertasAtleta.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', background: 'rgba(255,255,255,0.01)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ width: '100%', fontSize: '9px', color: 'rgba(255,255,255,0.35)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Alertas de Progreso Activas (Motor de Progresión)
                    </div>
                    {alertasAtleta.map((alerta, idx) => {
                      const styles = ALERT_COLORS[alerta.tipo] || { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', text: 'white', icon: '❓' };
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: styles.bg,
                            border: `1px solid ${styles.border}`,
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '10px',
                            fontWeight: 600,
                            color: styles.text
                          }}
                        >
                          <span>{styles.icon}</span>
                          <span><strong>{alerta.ejercicio}:</strong> {alerta.mensaje}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {sesion.notas_generales && (
                  <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '10px', borderLeft: '3px solid var(--theme-primary)' }}>
                    📝 "{sesion.notas_generales}"
                  </div>
                )}

                {hasExercises && isExpanded && (
                  <div style={{
                    marginTop: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    background: 'rgba(0,0,0,0.15)',
                    padding: '14px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    <div style={{ fontSize: '10px', fontFamily: "'Orbitron', sans-serif", color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                      Ejercicios Completados
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                      {sesion.sesiones_ejercicios.map((ej: any) => {
                        const itemVolumen = calculateVolume(ej.peso, ej.series_reps);
                        const itemRM = calculateEstimated1RM(ej.peso, ej.series_reps);
                        return (
                          <div
                            key={ej.id}
                            style={{
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.04)',
                              borderRadius: '8px',
                              padding: '10px',
                              fontSize: '12px'
                            }}
                          >
                            <div style={{ fontWeight: 700, color: 'white', marginBottom: '6px' }}>
                              🏋️ {ej.nombre_ejercicio}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
                              <div>
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Series / Reps:</span>{' '}
                                <span style={{ fontWeight: 600, color: 'white' }}>
                                  {Array.isArray(ej.series_reps) ? ej.series_reps.join(' - ') : ej.series_reps || '-'}
                                </span>
                              </div>
                              <div>
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Carga:</span>{' '}
                                <span style={{ fontWeight: 600, color: '#34d399' }}>{ej.peso} kg</span>
                              </div>
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <div>
                                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>Vol:</span>{' '}
                                  <span style={{ fontWeight: 600, color: '#10b981' }}>{itemVolumen} kg</span>
                                </div>
                                <div>
                                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>1RM Est:</span>{' '}
                                  <span style={{ fontWeight: 600, color: '#fbbf24' }}>{Math.round(itemRM)} kg</span>
                                </div>
                              </div>
                              <div>
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>RIR:</span>{' '}
                                <span style={{ fontWeight: 600, color: '#fbbf24' }}>{ej.rpe_rir}</span>
                              </div>
                              {ej.descanso && (
                                <div>
                                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>Descanso:</span>{' '}
                                  <span>{ej.descanso} seg</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '16px',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px', flex: 1 }}>
              <label style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px' }}>FILTRAR POR ATLETA</label>
              <select
                value={selectedAnalysisClient}
                onChange={(e) => {
                  setSelectedAnalysisClient(e.target.value);
                  setSelectedAnalysisExercise('all');
                }}
                style={{
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '1px solid var(--theme-border)',
                  borderRadius: '8px',
                  padding: '10px',
                  color: 'white',
                  fontSize: '12px',
                  fontFamily: "'Orbitron', sans-serif",
                  outline: 'none',
                }}
              >
                <option value="all">👥 Todos los Atletas</option>
                {clientes.map((client) => (
                  <option key={client.id} value={client.id}>👤 {client.nombre}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px', flex: 1 }}>
              <label style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px' }}>FILTRAR POR EJERCICIO</label>
              <select
                value={selectedAnalysisExercise}
                onChange={(e) => setSelectedAnalysisExercise(e.target.value)}
                style={{
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '1px solid var(--theme-border)',
                  borderRadius: '8px',
                  padding: '10px',
                  color: 'white',
                  fontSize: '12px',
                  fontFamily: "'Orbitron', sans-serif",
                  outline: 'none',
                }}
              >
                <option value="all">🏋️ Todos los Ejercicios</option>
                {availableExercisesForFilter.map((exName) => (
                  <option key={exName} value={exName}>{exName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrap" style={{ background: 'var(--theme-card-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid var(--theme-border)', borderRadius: '16px', overflow: 'hidden' }}>
            <div className="table-scroll" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ padding: '12px 16px' }}>Fecha</th>
                    {selectedAnalysisClient === 'all' && <th style={{ padding: '12px 16px' }}>Atleta</th>}
                    <th style={{ padding: '12px 16px' }}>Ejercicio</th>
                    <th style={{ padding: '12px 16px' }}>Grupo</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Series</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Reps</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Peso (kg)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>RIR</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Descanso</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Volumen</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>1RM est.</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Δ Vol.</th>
                    <th style={{ padding: '12px 16px' }}>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {filasFiltradasProgresion.length === 0 ? (
                    <tr>
                      <td colSpan={selectedAnalysisClient === 'all' ? 13 : 12} style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>
                        No se encontraron registros de ejercicios con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filasFiltradasProgresion.map((f, index) => {
                      const formattedDate = f.fecha ? f.fecha.split('-').reverse().join('/') : '-';
                      return (
                        <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{formattedDate}</td>
                          {selectedAnalysisClient === 'all' && (
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--theme-secondary)' }}>{f.atleta}</td>
                          )}
                          <td style={{ padding: '12px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>{f.ejercicio}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span className={`badge badge-${f.grupo.toLowerCase()}`} style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                              {f.grupo}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>{f.series}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>{f.repsStr}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>{f.peso}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>{f.rpe}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>{f.descanso ? `${f.descanso}s` : '-'}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{f.volumen.toLocaleString()}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--theme-primary)' }}>{f.rm.toFixed(1)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            {f.deltaType === 'up' && (
                              <span style={{ color: '#10b981', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px', fontFamily: "'Orbitron', sans-serif", fontSize: '10px' }}>
                                {f.deltaHtml}
                              </span>
                            )}
                            {f.deltaType === 'dn' && (
                              <span style={{ color: '#ef4444', fontWeight: 700, background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px', fontFamily: "'Orbitron', sans-serif", fontSize: '10px' }}>
                                {f.deltaHtml}
                              </span>
                            )}
                            {f.deltaType === 'eq' && (
                              <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontFamily: "'Orbitron', sans-serif", fontSize: '10px' }}>
                                {f.deltaHtml}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.notas}>
                            {f.notas}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainerAuditsTab;
