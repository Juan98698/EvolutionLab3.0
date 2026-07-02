import React from 'react';
import { Profile } from '../../../types/database.types';

interface TrainerClientsTabProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  filterModalidad: string;
  setFilterModalidad: (val: string) => void;
  setRegisterOpen: (val: boolean) => void;
  loading: boolean;
  filteredClientes: Profile[];
  updatingVigenciaId: string | null;
  handleVigenciaLocalChange: (id: string, value: string) => void;
  handleVigenciaSave: (id: string, value: number) => void;
  clientesRachas: Record<string, { actual: number; maxima: number }>;
  clientesLogros: Record<string, { titulo: string; icono: string; tipo: string }[]>;
  navigate: (path: string) => void;
  handleOpenRegisterSessionModal: (atleta: Profile) => void;
  handleOpenEvolutionModal: (atleta: Profile) => void;
}

const TrainerClientsTab: React.FC<TrainerClientsTabProps> = ({
  searchQuery,
  setSearchQuery,
  filterModalidad,
  setFilterModalidad,
  setRegisterOpen,
  loading,
  filteredClientes,
  updatingVigenciaId,
  handleVigenciaLocalChange,
  handleVigenciaSave,
  clientesRachas,
  clientesLogros,
  navigate,
  handleOpenRegisterSessionModal,
  handleOpenEvolutionModal
}) => {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ flex: '1 1 300px' }}>
          <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '20px', fontWeight: 800, margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--theme-primary)' }}>👥</span> MIS ATLETAS
          </h2>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div className="search-bar" style={{ flex: '1 1 200px' }}>
              <span>🔍</span>
              <input
                type="text"
                placeholder="Buscar por nombre o correo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              value={filterModalidad}
              onChange={(e) => setFilterModalidad(e.target.value)}
              className="search-bar"
              style={{ flex: '0 1 180px', padding: '10px', outline: 'none' }}
            >
              <option value="all">🏋️ Todas Modalidades</option>
              <option value="remoto">🌐 Remotos</option>
              <option value="presencial">🏋️ Presenciales</option>
            </select>
          </div>
        </div>
        <div style={{ flex: '0 1 auto', display: 'flex', gap: '10px', flexDirection: 'column', alignItems: 'flex-end' }}>
          <button
            onClick={() => setRegisterOpen(true)}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: "'Orbitron', sans-serif", fontSize: '11px', fontWeight: 700 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="17" y1="11" x2="23" y2="11" />
            </svg>
            Registrar Nuevo Atleta
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--theme-primary)', fontFamily: 'Orbitron, sans-serif' }}>
          <span>Cargando atletas vinculados...</span>
        </div>
      ) : filteredClientes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--theme-card-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid var(--theme-border)', borderRadius: '16px' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)' }}>No se encontraron atletas vinculados.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredClientes.map((atleta) => {
            const formattedDate = atleta.fecha_inicio ? atleta.fecha_inicio.split('-').reverse().join('/') : '-';
            return (
              <div
                key={atleta.id}
                className="stagger-item"
                style={{
                  background: 'var(--theme-card-bg)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid var(--theme-border)',
                  borderRadius: '16px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '20px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--theme-btn-gradient)' }} />

                <span style={{
                  position: 'absolute',
                  top: '12px',
                  right: '16px',
                  background: atleta.modalidad === 'presencial' ? 'rgba(255, 107, 0, 0.15)' : 'rgba(0, 212, 255, 0.15)',
                  border: atleta.modalidad === 'presencial' ? '1px solid rgba(255, 107, 0, 0.4)' : '1px solid rgba(0, 212, 255, 0.4)',
                  color: atleta.modalidad === 'presencial' ? '#ff8c00' : '#00d4ff',
                  padding: '3px 8px',
                  borderRadius: '8px',
                  fontSize: '9px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  fontFamily: "'Orbitron', sans-serif",
                  letterSpacing: '0.5px'
                }}>
                  {atleta.modalidad === 'presencial' ? '🏋️ Presencial' : '🌐 Remoto'}
                </span>

                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '90px' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--theme-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> {atleta.nombre}
                  </h3>
                  <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{atleta.email}</p>
                  
                  <div className="perfil-atleta-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>Objetivo:</span>
                      <span style={{ fontWeight: 600, color: 'var(--theme-primary)' }}>{atleta.objetivo || 'Sin objetivo'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>Fecha inicio:</span>
                      <span style={{ fontWeight: 600 }}>{formattedDate}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>Vigencia (días):</span>
                      <input
                        type="number"
                        min="1"
                        max="9999"
                        disabled={updatingVigenciaId === atleta.id}
                        value={atleta.vigencia_dias !== undefined ? atleta.vigencia_dias : ''}
                        placeholder="30"
                        onChange={(e) => handleVigenciaLocalChange(atleta.id, e.target.value)}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            handleVigenciaSave(atleta.id, val);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseInt((e.target as HTMLInputElement).value, 10);
                            if (!isNaN(val)) {
                              handleVigenciaSave(atleta.id, val);
                              (e.target as HTMLInputElement).blur();
                            }
                          }
                        }}
                        style={{
                          width: '60px',
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          color: 'white',
                          textAlign: 'right',
                          fontSize: '11px',
                          fontFamily: "'Orbitron', sans-serif",
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', marginTop: '2px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>Racha Activa:</span>
                      <span style={{ fontWeight: 600, color: '#fbbf24' }}>
                        🔥 {clientesRachas[atleta.id]?.actual || 0} días
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>Logros:</span>
                      <span style={{ fontWeight: 600, color: '#34d399' }}>
                        🏆 {clientesLogros[atleta.id]?.length || 0}
                      </span>
                    </div>
                    {clientesLogros[atleta.id] && clientesLogros[atleta.id].length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                        {clientesLogros[atleta.id].map((logro, idx) => (
                          <span key={idx} title={logro.titulo} style={{ fontSize: '13px' }}>
                            {logro.icono}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => navigate(`/trainer/plan/${atleta.id}`)}
                      style={{ flex: 1, padding: '10px 0', fontSize: '11px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg> Planificar
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => navigate('/trainer/config')}
                      style={{ flex: 1, padding: '10px 0', fontSize: '11px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> Reglas
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <button
                      className="btn"
                      onClick={() => handleOpenRegisterSessionModal(atleta)}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        fontSize: '11px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(255, 107, 0, 0.08)',
                        border: '1px solid rgba(255, 107, 0, 0.25)',
                        borderRadius: '8px',
                        color: '#ff8c00',
                        cursor: 'pointer',
                        fontFamily: "'Orbitron', sans-serif",
                        fontWeight: 700
                      }}
                    >
                      ⏱️ Registrar Sesión
                    </button>
                    <button
                      className="btn"
                      onClick={() => handleOpenEvolutionModal(atleta)}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        fontSize: '11px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(0, 212, 255, 0.08)',
                        border: '1px solid rgba(0, 212, 255, 0.25)',
                        borderRadius: '8px',
                        color: '#00d4ff',
                        cursor: 'pointer',
                        fontFamily: "'Orbitron', sans-serif",
                        fontWeight: 700
                      }}
                    >
                      📈 Evolución / PDF
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default TrainerClientsTab;
