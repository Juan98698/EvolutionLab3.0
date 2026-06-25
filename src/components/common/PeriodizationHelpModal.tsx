// src/components/common/PeriodizationHelpModal.tsx
import React, { useState } from 'react';

interface PeriodizationHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'quickstart' | 'glossary' | 'faq';

export const PeriodizationHelpModal: React.FC<PeriodizationHelpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('quickstart');

  if (!isOpen) return null;

  const themeColor = 'var(--theme-primary, #00d4ff)';

  const faqs = [
    {
      q: '¿La periodización se aplica a todos los ejercicios o solo a los 3 grandes?',
      a: 'La autoregulación del volumen (subir o bajar series según tu recuperación) funciona para todos los ejercicios del plan. Lo que estaba limitado inicialmente era la sugerencia automática de cargas basada en 1RM. Ahora, cualquier ejercicio con una marca 1RM registrada en el plan puede recibir sugerencias de peso exactas calibradas a su RIR objetivo.'
    },
    {
      q: '¿Qué diferencia hay entre los objetivos del bloque (Hipertrofia, Fuerza y Mantenimiento)?',
      a: '• Hipertrofia (Acumulación): Enfocado en acumular volumen de series (rangos de 8-15 reps) para maximizar el estímulo hipertrófico.\n• Fuerza (Intensificación): Prioriza intensidades muy elevadas (1-6 reps a RIRs bajos) reduciendo el volumen de series para evitar que la fatiga arruine la fuerza neuromuscular.\n• Mantenimiento: Diseñado para periodos de alto estrés o déficit calórico severo, manteniendo el volumen estable en el mínimo efectivo para preservar músculo sin sobrecargar.'
    },
    {
      q: '¿Qué pasa si configuro un mesociclo de 8 o más semanas?',
      a: 'Un mesociclo normal dura 4-6 semanas. Si lo configuras a 8 semanas o más, retrasas la semana de descarga (Deload) automática global, lo que incrementa exponencialmente la fatiga del sistema nervioso central y los tendones. Aunque el motor autoregulará bajando series individuales si reportas dolor residual crónico, lo ideal es mantener bloques de 4-6 semanas para lograr la supercompensación fisiológica adecuada.'
    },
    {
      q: '¿Por qué los puntos débiles mecánicos solo aplican a sentadilla, banca y peso muerto?',
      a: 'Porque son movimientos multiarticulares biomecánicamente complejos con curvas de fuerza cambiantes y zonas de estancamiento (sticking points) muy claras. En ejercicios de aislamiento (como un curl de bíceps), el fallo se debe a fatiga local de una sola articulación, por lo que no se benefician de variantes técnicas o correctivos específicos de la misma manera.'
    },
    {
      q: '¿Cuándo y cómo se añaden los ejercicios correctivos del Smart Coach?',
      a: 'Se aplican como accesorios inmediatamente después de tu ejercicio base (ej: Sentadilla con Pausa justo después de tus Sentadillas pesadas). El entrenador puede agregarlos con 1 solo clic desde el panelizador. Al agregarse, inyectan automáticamente en las Notas de Progresión la explicación detallada del tempo biomecánico para que el atleta aprenda a dominar esa fase del movimiento.'
    },
    {
      q: '¿Cómo y dónde se actualiza mi peso si supero mis marcas?',
      a: 'Ocurre automáticamente al guardar tu sesión. El motor recalcula tu 1RM basándose en tus repeticiones y RIR reportados. Luego, recorre toda tu rutina de la próxima semana y **escribe físicamente el peso sugerido exacto** (basado en el RIR objetivo) en la casilla de peso de cada ejercicio. Podrás identificar estas cargas autoreguladas porque vienen acompañadas del icono 🤖.'
    },
    {
      q: '¿Por qué el algoritmo no sube las series aunque reporte buena recuperación?',
      a: 'El sistema integra una protección de Volumen Máximo Recuperable (MRV) que se ajusta a tu **Nivel de Atleta** (Principiante, Intermedio o Avanzado). Si tu plan ya alcanzó el límite científico de series semanales tolerables para un músculo según tu experiencia, el algoritmo bloqueará futuros incrementos para prevenir el sobreentrenamiento y posibles lesiones.'
    },
    {
      q: '¿Qué pasa con mis cargas 🤖 durante la Semana de Descarga (Deload)?',
      a: 'La autoregulación es biomecánicamente sinérgica. Al entrar en la semana de descarga planificada (final del bloque), el sistema corta las series a la mitad y sube tu RIR a un margen muy conservador (ej. RIR 4). Al detectar este nuevo RIR en tu plan, la fórmula inyectará automáticamente un peso 🤖 mucho más ligero, asegurando que logres una recuperación profunda del sistema nervioso central.'
    }
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, width: '100vw', height: '100vh',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
      zIndex: 999999, padding: '10px', boxSizing: 'border-box'
    }}>
      <style>{`
        .help-modal-box {
          width: 100%;
        }
        @media (max-width: 768px) {
          .help-modal-box {
            height: 95vh;
            max-height: 95vh !important;
          }
          .help-modal-header {
            padding: 16px !important;
          }
          .help-modal-content {
            padding: 16px !important;
          }
        }
      `}</style>
      <div className="help-modal-box" style={{
        background: 'rgba(10, 15, 30, 0.96)',
        border: '1px solid rgba(0, 212, 255, 0.15)',
        borderRadius: '20px',
        maxWidth: '680px',
        width: '100%',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
        color: 'white',
        fontFamily: 'sans-serif',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div className="help-modal-header" style={{
          padding: '24px 24px 16px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '9px', fontFamily: "'Orbitron', sans-serif", color: themeColor, letterSpacing: '2px', textTransform: 'uppercase' }}>🧬 CIENCIA APLICADA</span>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 800, fontFamily: "'Orbitron', sans-serif", letterSpacing: '1px' }}>GUÍA DE PERIODIZACIÓN RIR</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'white',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
          >
            ✕
          </button>
        </div>

        {/* Tab Headers */}
        <div style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.2)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          {([
            { id: 'quickstart', label: '¿CÓMO FUNCIONA?' },
            { id: 'glossary', label: 'GLOSARIO CIENTÍFICO' },
            { id: 'faq', label: 'PREGUNTAS FRECUENTES' }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab.id ? themeColor : 'transparent'}`,
                color: activeTab === tab.id ? 'white' : 'rgba(255, 255, 255, 0.4)',
                padding: '14px',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: "'Orbitron', sans-serif",
                cursor: 'pointer',
                transition: 'all 0.2s',
                letterSpacing: '0.5px'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="help-modal-content" style={{
          padding: '24px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* TAB: Quickstart */}
          {activeTab === 'quickstart' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13.5px', lineHeight: '1.6', color: 'rgba(255,255,255,0.75)' }}>
              <p style={{ margin: 0 }}>
                El módulo de <strong>Periodización Científica RIR</strong> automatiza la modulación del volumen (series) y la intensidad (kilos sugeridos) de tus entrenamientos basándose en la autoregulación biológica.
              </p>
              
              <div style={{
                background: 'rgba(0, 212, 255, 0.02)',
                border: '1px solid rgba(0, 212, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <strong style={{ color: 'white', fontFamily: "'Orbitron', sans-serif", fontSize: '12px' }}>EL CICLO DE AUTOREGULACIÓN:</strong>
                <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li><strong>Entrenamiento Inteligente:</strong> El sistema lee tus 1RMs y prescribe la carga recomendada exacta para el RIR objetivo de la semana.</li>
                  <li><strong>Cuestionario de Biofeedback:</strong> Al final del ejercicio, reportas tu RIR real y calificas tu bombeo muscular (Estímulo) y dolor residual (Recuperación).</li>
                  <li><strong>Modulación en Background:</strong> Si te recuperas de forma óptima, el sistema suma +1 serie para acercarte a tu potencial de crecimiento (siempre respetando el límite MRV científico de cada músculo). Si presentas dolor o fatiga residual crónica, reduce las series para evitar el sobreentrenamiento.</li>
                  <li><strong>Descarga Automática:</strong> Al terminar el bloque programado por tu coach, el sistema reduce el volumen un 50% para supercompensar y sanar tendones.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB: Glossary */}
          {activeTab === 'glossary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { term: 'RIR (Reps In Reserve)', desc: 'Repeticiones en Reserva. Representa cuántas repeticiones te faltaron por hacer antes de llegar al fallo muscular total. Un RIR 2 significa que te detuviste sintiendo que podías hacer exactamente 2 repeticiones más de forma limpia.' },
                { term: '1RM (1 Repetición Máxima)', desc: 'Es la cantidad máxima de peso que puedes levantar en un ejercicio para una sola repetición. La app calcula este valor teóricamente usando tu rendimiento de múltiples repeticiones mediante fórmulas integradas.' },
                { term: 'MEV (Volumen Mínimo Efectivo)', desc: 'La cantidad mínima de series de trabajo semanales que necesitas realizar para lograr ganancias de masa o fuerza.' },
                { term: 'MAV (Volumen Adaptativo Máximo)', desc: 'El rango dulce de series donde logras tus mejores resultados. El sistema busca mantenerte en este volumen dinámicamente.' },
                { term: 'MRV (Volumen Máximo Recuperable)', desc: 'El límite absoluto de series que tu cuerpo puede tolerar y recuperar. Sobrepasar el MRV por mucho tiempo causa fatiga del sistema nervioso y estancamiento.' },
                { term: 'Deload (Descarga)', desc: 'Una semana de recuperación activa planificada donde el volumen de series se reduce drásticamente (normalmente a la mitad) y las intensidades son muy ligeras (RIR 4 o superior) para permitir al cuerpo sanar.' }
              ].map(item => (
                <div key={item.term} style={{
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  borderRadius: '10px',
                  padding: '12px'
                }}>
                  <strong style={{ display: 'block', fontSize: '12px', color: themeColor, fontFamily: "'Orbitron', sans-serif", marginBottom: '4px' }}>{item.term}</strong>
                  <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}>{item.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* TAB: FAQ */}
          {activeTab === 'faq' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {faqs.map((faq, idx) => (
                <div key={idx} style={{
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <strong style={{ fontSize: '13px', color: 'white' }}>❓ {faq.q}</strong>
                  <p style={{
                    margin: 0,
                    fontSize: '12.5px',
                    color: 'rgba(255,255,255,0.65)',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-line',
                    borderLeft: `2px solid ${themeColor}`,
                    paddingLeft: '10px',
                    marginTop: '4px'
                  }}>
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'flex-end',
          background: 'rgba(0, 0, 0, 0.15)'
        }}>
          <button
            onClick={onClose}
            style={{
              background: themeColor,
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              padding: '10px 24px',
              fontSize: '11px',
              fontWeight: 800,
              fontFamily: "'Orbitron', sans-serif",
              cursor: 'pointer',
              letterSpacing: '1px',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(0, 212, 255, 0.2)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
          >
            ENTENDIDO
          </button>
        </div>
      </div>
    </div>
  );
};

export default PeriodizationHelpModal;
