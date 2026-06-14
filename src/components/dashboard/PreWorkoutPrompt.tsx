import React, { useMemo, useState } from 'react';
import { SugerenciaPreWorkout, Exercise } from '../../types/database.types';
import { Session, calcularSugerenciasPreWorkout } from '../../lib/overload';

interface PreWorkoutPromptProps {
  sesiones: Session[];
  ejerciciosDelDia: Exercise[];
  visible: boolean;
  onClose: () => void;
}

const TIPO_STYLES: Record<SugerenciaPreWorkout['tipo'], { gradient: string; icon: string; glow: string }> = {
  peso: { gradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(99, 102, 241, 0.04))', icon: '🏋️', glow: 'rgba(99, 102, 241, 0.2)' },
  reps: { gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.04))', icon: '🎯', glow: 'rgba(16, 185, 129, 0.2)' },
  descanso: { gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.04))', icon: '⏱️', glow: 'rgba(245, 158, 11, 0.2)' },
  general: { gradient: 'linear-gradient(135deg, rgba(148, 163, 184, 0.15), rgba(148, 163, 184, 0.04))', icon: '💡', glow: 'rgba(148, 163, 184, 0.15)' },
};

const getExplanation = (tip: SugerenciaPreWorkout) => {
  if (tip.tipo === 'peso') {
    if (tip.titulo.includes('Sube') || tip.titulo.includes('subir') || tip.titulo.includes('Progresión')) {
      return "Principio de Sobrecarga Progresiva: Para forzar la adaptación del músculo e inducir hipertrofia o ganancia de fuerza, es necesario aumentar la tensión mecánica a lo largo del tiempo. Si tu RIR (Repeticiones en Reserva) promedio es alto, el estímulo no está reclutando las unidades motoras de alto umbral. Incrementar la carga manteniendo el mismo rango de movimiento activo (ROM) es la forma más directa de asegurar tensión mecánica real.";
    }
    return "Calidad del Estímulo y RIR 0-1: Entrenar muy cerca de tu límite muscular (RIR 1 o 0) genera un gran estímulo de hipertrofia pero también produce altos niveles de fatiga neuromuscular. Si incrementas el peso prematuramente, tu cuerpo usará compensaciones biomecánicas perdiendo el control del movimiento. Quédate aquí hoy para consolidar las adaptaciones antes de dar el siguiente salto.";
  }
  if (tip.tipo === 'reps') {
    return "Densidad de Estímulo por Serie: Añadir una repetición extra con el mismo peso incrementa el volumen total de trabajo y extiende el Tiempo Bajo Tensión (TUT). Este estímulo promueve adaptaciones metabólicas locales y mejora la eficiencia de la conexión mente-músculo. Controla la fase de bajada lenta (excéntrica) para maximizar el estímulo.";
  }
  if (tip.tipo === 'descanso') {
    return "Densidad de Entrenamiento y Estrés Metabólico: Reducir el intervalo de descanso eleva la acumulación de metabolitos (ácido láctico) dentro del tejido muscular, lo que induce un fuerte estímulo de hipertrofia por estrés metabólico. También mejora la capacidad de recuperación local bajo fatiga acumulada.";
  }
  if (tip.tipo === 'general') {
    if (tip.titulo.includes('Reactiva') || tip.titulo.includes('tiempo sin entrenar')) {
      return "Readaptación Neuromuscular: Tras un periodo de descanso largo, la conexión neuromuscular y la rigidez tendinosa disminuyen. El cuerpo pierde temporalmente la eficiencia para reclutar fibras al 100%. Reducir un 10% la carga en la primera sesión permite reactivar estos patrones motores sin generar un daño muscular excesivo (agujetas limitantes).";
    }
    return "Smart Coach Core: El motor inteligente analiza la frecuencia de tus entrenamientos y las variables clave (volumen, intensidad, descanso) para sugerirte metas realistas que respeten el balance entre fatiga y recuperación, previniendo lesiones y asegurando el progreso a largo plazo.";
  }
  return "Smart Coach Core: Recomendación basada en tus métricas históricas de rendimiento para asegurar un estímulo efectivo y seguro.";
};

export const PreWorkoutPrompt: React.FC<PreWorkoutPromptProps> = ({
  sesiones,
  ejerciciosDelDia,
  visible,
  onClose,
}) => {
  const [expandedTips, setExpandedTips] = useState<Record<string, boolean>>({});

  const sugerencias = useMemo(
    () => calcularSugerenciasPreWorkout(sesiones, ejerciciosDelDia),
    [sesiones, ejerciciosDelDia]
  );

  if (!visible || sugerencias.length === 0) return null;

  // Group suggestions by exercise
  const grouped = sugerencias.reduce<Record<string, SugerenciaPreWorkout[]>>((acc, s) => {
    if (!acc[s.ejercicio]) acc[s.ejercicio] = [];
    acc[s.ejercicio].push(s);
    return acc;
  }, {});

  return (
    <div
      className="modal-overlay modal-overlay-enter open"
      style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 99999, backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="modal-box modal-enter"
        style={{
          maxWidth: '520px', width: '90%', maxHeight: '80vh',
          overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          background: 'rgba(10, 15, 28, 0.95)',
          borderRadius: '18px', padding: '0'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: 'rgba(10, 15, 28, 0.98)', zIndex: 1,
          borderRadius: '18px 18px 0 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--theme-primary, #00d4ff), var(--theme-secondary, #0070a0))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px var(--theme-glow, rgba(0,212,255,0.25))'
            }}>
              <span style={{ fontSize: '18px' }}>🧠</span>
            </div>
            <div>
              <h3 style={{ margin: 0, fontFamily: "'Orbitron', sans-serif", fontSize: '13px', fontWeight: 800, letterSpacing: '0.5px', color: 'white' }}>
                SMART COACH
              </h3>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '1px' }}>
                Sugerencias para tu entrenamiento de hoy
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', color: 'rgba(255,255,255,0.5)', padding: '6px 10px',
              cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 24px 24px' }}>
          {Object.entries(grouped).map(([ejercicio, tips]) => (
            <div key={ejercicio} style={{ marginBottom: '20px' }}>
              {/* Exercise name header */}
              <div style={{
                fontSize: '11px', fontWeight: 700, fontFamily: "'Orbitron', sans-serif",
                color: 'var(--theme-primary, #00d4ff)', letterSpacing: '0.5px',
                marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px',
                textTransform: 'uppercase'
              }}>
                <span style={{ width: '4px', height: '16px', borderRadius: '2px', background: 'var(--theme-primary, #00d4ff)' }}></span>
                {ejercicio}
              </div>

              {/* Tips for this exercise */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tips.map((tip, i) => {
                  const style = TIPO_STYLES[tip.tipo];
                  const tipKey = `${tip.ejercicio}-${tip.tipo}-${i}`;
                  const isExpanded = expandedTips[tipKey] || false;
                  return (
                    <div
                      key={tipKey}
                      style={{
                        background: style.gradient,
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '12px', padding: '14px 16px',
                        display: 'flex', gap: '12px', alignItems: 'flex-start',
                        boxShadow: `0 4px 12px ${style.glow}`,
                        transition: 'transform 0.2s ease',
                        flexDirection: 'column'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', width: '100%' }}>
                        <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>{style.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>
                            {tip.titulo}
                          </div>
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', lineHeight: '1.5' }}>
                            {tip.mensaje}
                          </div>
                          {tip.valor_sugerido > 0 && tip.unidad && (
                            <div style={{
                              marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px',
                              padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)',
                              fontSize: '11px', fontWeight: 700, fontFamily: "'Orbitron', sans-serif",
                              color: 'white'
                            }}>
                              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{tip.valor_actual} {tip.unidad}</span>
                              <span style={{ color: 'var(--theme-primary, #00d4ff)' }}>→</span>
                              <span>{tip.valor_sugerido} {tip.unidad}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ width: '100%', borderTop: isExpanded ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingTop: isExpanded ? '10px' : '0' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedTips(prev => ({ ...prev, [tipKey]: !isExpanded }));
                          }}
                          style={{
                            background: 'none', border: 'none', color: 'var(--theme-primary, #00d4ff)',
                            fontSize: '9px', fontWeight: 700, fontFamily: "'Orbitron', sans-serif",
                            cursor: 'pointer', padding: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px',
                            textTransform: 'uppercase', letterSpacing: '0.5px'
                          }}
                        >
                          {isExpanded ? 'Ocultar Explicación 🧠 ▲' : 'Ver Por Qué 🧠 ▼'}
                        </button>
                        {isExpanded && (
                          <div style={{
                            marginTop: '8px',
                            background: 'rgba(0, 0, 0, 0.25)',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            fontSize: '10px',
                            color: 'rgba(255, 255, 255, 0.75)',
                            lineHeight: '1.4',
                            fontFamily: 'sans-serif',
                            borderLeft: '2px solid var(--theme-primary, #00d4ff)'
                          }}>
                            {getExplanation(tip)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', bottom: 0, background: 'rgba(10, 15, 28, 0.98)',
          borderRadius: '0 0 18px 18px'
        }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
            Basado en {sesiones.length} sesiones registradas
          </div>
          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{
              fontFamily: "'Orbitron', sans-serif", fontSize: '11px', fontWeight: 700,
              padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '6px'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v8H2z"/></svg>
            ¡Comenzar a Entrenar!
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreWorkoutPrompt;
