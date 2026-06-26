import { useState } from 'react';
import { AthleteLevel, BlockObjective } from '../../lib/volumeThresholds';
import { ProtocolTemplate, getProtocolsForContext } from '../../lib/protocols';
import { TrainingDay } from '../../types/database.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  objective: BlockObjective;
  level: AthleteLevel;
  onApplyProtocol: (days: TrainingDay[]) => void;
}

export function ProtocolSelectorModal({ isOpen, onClose, objective, level, onApplyProtocol }: Props) {
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolTemplate | null>(null);

  if (!isOpen) return null;

  const protocols = getProtocolsForContext(objective, level);

  const handleApply = () => {
    if (!selectedProtocol) return;

    // Convert ProtocolDay[] to TrainingDay[]
    const trainingDays: TrainingDay[] = selectedProtocol.days.map((day, idx) => ({
      id: crypto.randomUUID(),
      dayNumber: idx + 1,
      name: day.label,
      exercises: day.exercises.map(ex => ({
        id: crypto.randomUUID(),
        nombre: ex.name,
        grupo_muscular: ex.muscle,
        variables: {
          'series de trabajo': ex.sets,
          'repeticiones': ex.reps,
          'rir': ex.rir,
          'descanso': ex.rest
        }
      }))
    }));

    onApplyProtocol(trainingDays);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{
        background: '#111', width: '100%', maxWidth: '800px', maxHeight: '90vh',
        borderRadius: '12px', border: '1px solid #333', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', color: '#fff', fontFamily: 'system-ui, sans-serif'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>📚 Protocolos Científicos</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>
              Mostrando evidencia para: <strong style={{ color: '#0ea5e9', textTransform: 'capitalize' }}>{objective}</strong> • <strong style={{ color: '#0ea5e9', textTransform: 'capitalize' }}>{level}</strong>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* Sidebar: Lista de protocolos */}
          <div style={{ width: '300px', borderRight: '1px solid #222', overflowY: 'auto', padding: '16px' }}>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#666', letterSpacing: '0.05em', marginBottom: '12px' }}>Plantillas Recomendadas</h3>
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
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', color: selectedProtocol?.id === p.id ? '#0ea5e9' : '#fff' }}>
                  {p.name}
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
                  {p.daysPerWeek} días/semana • Nivel: <span style={{ textTransform: 'capitalize' }}>{p.level}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#aaa', lineHeight: 1.4 }}>
                  {p.description}
                </div>
              </div>
            ))}
          </div>

          {/* Main Area: Guía Científica */}
          <div style={{ flex: 1, padding: '24px', overflowY: 'auto', background: '#0a0a0a' }}>
            {selectedProtocol ? (
              <div>
                <div style={{ display: 'inline-block', background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
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
                      <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#0ea5e9', marginBottom: '8px' }}>{day.label}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {day.exercises.map((ex, eIdx) => (
                          <span key={eIdx} style={{ fontSize: '11px', background: '#222', padding: '4px 8px', borderRadius: '4px', color: '#aaa' }}>
                            {ex.name} ({ex.sets}x{ex.reps})
                          </span>
                        ))}
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
            disabled={!selectedProtocol}
            style={{ 
              padding: '8px 24px', borderRadius: '6px', border: 'none', 
              background: selectedProtocol ? '#0ea5e9' : '#333', 
              color: selectedProtocol ? '#fff' : '#888', 
              cursor: selectedProtocol ? 'pointer' : 'not-allowed',
              fontWeight: 'bold', fontSize: '14px', transition: 'background 0.2s'
            }}
          >
            Aplicar Protocolo al Plan
          </button>
        </div>
      </div>
    </div>
  );
}
