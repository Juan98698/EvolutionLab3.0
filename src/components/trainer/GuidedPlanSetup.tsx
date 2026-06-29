/**
 * GuidedPlanSetup.tsx
 *
 * Wizard de 3 pasos que aparece la primera vez que un entrenador
 * crea un plan. Reemplaza temporalmente la pantalla vacía del PlanPlanner
 * con un flujo guiado que genera un plan base automáticamente.
 *
 * Al completarse:
 *  - Llama a onComplete con los parámetros elegidos
 *  - El PlanPlanner aplica el protocolo correcto y muestra el plan generado
 *  - Guarda 'evolution_guided_plan_v1' en localStorage para no repetir el flujo
 *
 * Principio de diseño: hacer en lugar de explicar.
 * El entrenador sale del wizard con un plan real funcionando, no con un tutorial leído.
 */

import React, { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GuidedObjective = 'hipertrofia' | 'fuerza' | 'mantenimiento';
export type GuidedLevel     = 'principiante' | 'intermedio' | 'avanzado';

export interface GuidedPlanParams {
  objetivo:   GuidedObjective;
  nivel:      GuidedLevel;
  dias:       number;
  semanas:    number;
  wantsTour:  boolean;
}

interface Props {
  onComplete: (params: GuidedPlanParams) => void;
  onSkip:     () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const OBJECTIVES: { value: GuidedObjective; emoji: string; label: string; description: string }[] = [
  { value: 'hipertrofia', emoji: '💪', label: 'Ganar músculo',  description: 'Aumentar masa muscular con volumen progresivo' },
  { value: 'fuerza',      emoji: '🏋️', label: 'Ganar fuerza',   description: 'Mejorar rendimiento en los levantamientos base' },
  { value: 'mantenimiento', emoji: '🔄', label: 'Mantener',     description: 'Conservar lo ganado con menos volumen' },
];

const LEVELS: { value: GuidedLevel; label: string; hint: string }[] = [
  { value: 'principiante', label: 'Principiante', hint: '< 1 año de entrenamiento consistente' },
  { value: 'intermedio',   label: 'Intermedio',   hint: '1–3 años de entrenamiento consistente' },
  { value: 'avanzado',     label: 'Avanzado',     hint: '3+ años con periodización' },
];

const DAYS_OPTIONS   = [3, 4, 5, 6];
const WEEKS_OPTIONS  = [4, 6, 8, 12];

const ACCENT = '#c2ff00'; // acid green — color primario de Evolution Lab

// ─── Componente ───────────────────────────────────────────────────────────────

export const GuidedPlanSetup: React.FC<Props> = ({ onComplete, onSkip }) => {
  const [step,     setStep]     = useState(1);
  const [objetivo, setObjetivo] = useState<GuidedObjective | null>(null);
  const [nivel,    setNivel]    = useState<GuidedLevel | null>(null);
  const [dias,     setDias]     = useState<number>(4);
  const [semanas,  setSemanas]  = useState<number>(6);

  const totalSteps = 3;
  const canNext = step === 1
    ? objetivo !== null
    : step === 2
    ? nivel !== null
    : true;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(s => s + 1);
    }
  };

  const handleComplete = (wantsTour: boolean) => {
    if (!objetivo || !nivel) return;
    onComplete({ objetivo, nivel, dias, semanas, wantsTour });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(5, 8, 16, 0.97)',
      backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', fontFamily: "'Inter', 'Roboto', sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: '520px',
        background: 'rgba(15, 23, 42, 0.9)',
        border: `1px solid ${ACCENT}22`,
        borderRadius: '24px', padding: '36px 32px',
        boxShadow: `0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px ${ACCENT}11`,
        position: 'relative', overflow: 'hidden',
      }}>

        {/* Glow de fondo */}
        <div style={{
          position: 'absolute', top: '-60px', left: '50%',
          transform: 'translateX(-50%)',
          width: '200px', height: '200px',
          background: ACCENT, filter: 'blur(80px)',
          opacity: 0.06, pointerEvents: 'none', borderRadius: '50%',
        }} />

        {/* ── Indicador de pasos ── */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '32px' }}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} style={{
              height: '4px',
              borderRadius: '2px',
              transition: 'all 0.3s ease',
              width:      i + 1 === step ? '32px' : '12px',
              background: i + 1 <= step  ? ACCENT : 'rgba(255,255,255,0.12)',
            }} />
          ))}
        </div>

        {/* ── PASO 1 — Objetivo ── */}
        {step === 1 && (
          <div>
            <p style={{ fontSize: '12px', color: ACCENT, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>
              Paso 1 de 3
            </p>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '6px', lineHeight: 1.3 }}>
              ¿Qué quieres lograr en este bloque?
            </h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginBottom: '24px' }}>
              El sistema elegirá el protocolo y la forma de medir el volumen más adecuados.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {OBJECTIVES.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setObjetivo(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '16px 18px', borderRadius: '12px', cursor: 'pointer',
                    border: `1px solid ${objetivo === opt.value ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                    background: objetivo === opt.value ? `${ACCENT}12` : 'rgba(255,255,255,0.03)',
                    transition: 'all 0.2s ease', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '24px', flexShrink: 0 }}>{opt.emoji}</span>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: objetivo === opt.value ? ACCENT : '#e5e7eb', marginBottom: '2px' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                      {opt.description}
                    </div>
                  </div>
                  {objetivo === opt.value && (
                    <span style={{ marginLeft: 'auto', color: ACCENT, fontSize: '18px' }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── PASO 2 — Nivel y estructura ── */}
        {step === 2 && (
          <div>
            <p style={{ fontSize: '12px', color: ACCENT, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>
              Paso 2 de 3
            </p>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '6px', lineHeight: 1.3 }}>
              ¿Cuál es el nivel y la disponibilidad del atleta?
            </h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginBottom: '24px' }}>
              Esto calibra los rangos de volumen seguros y el protocolo más adecuado.
            </p>

            {/* Nivel */}
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Nivel del atleta
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {LEVELS.map(l => (
                  <button
                    key={l.value}
                    onClick={() => setNivel(l.value)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                      border: `1px solid ${nivel === l.value ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                      background: nivel === l.value ? `${ACCENT}10` : 'rgba(255,255,255,0.03)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: nivel === l.value ? ACCENT : '#e5e7eb' }}>
                        {l.label}
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
                        {l.hint}
                      </div>
                    </div>
                    {nivel === l.value && <span style={{ color: ACCENT }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Días por semana */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Días de entrenamiento por semana
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {DAYS_OPTIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => setDias(d)}
                    style={{
                      flex: 1, padding: '12px 0', borderRadius: '10px', cursor: 'pointer',
                      border: `1px solid ${dias === d ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                      background: dias === d ? `${ACCENT}12` : 'rgba(255,255,255,0.03)',
                      color: dias === d ? ACCENT : '#9ca3af',
                      fontWeight: 700, fontSize: '16px', transition: 'all 0.2s ease',
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Semanas del bloque */}
            <div>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Duración del bloque
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {WEEKS_OPTIONS.map(w => (
                  <button
                    key={w}
                    onClick={() => setSemanas(w)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: '10px', cursor: 'pointer',
                      border: `1px solid ${semanas === w ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                      background: semanas === w ? `${ACCENT}12` : 'rgba(255,255,255,0.03)',
                      color: semanas === w ? ACCENT : '#9ca3af',
                      fontWeight: 700, fontSize: '14px', transition: 'all 0.2s ease',
                    }}
                  >
                    {w} sem
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PASO 3 — Confirmación y tour ── */}
        {step === 3 && objetivo && nivel && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</div>
            <p style={{ fontSize: '12px', color: ACCENT, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>
              Paso 3 de 3
            </p>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '12px', lineHeight: 1.3 }}>
              Tu plan base está listo para generarse
            </h2>

            {/* Resumen */}
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px', padding: '16px', marginBottom: '24px', textAlign: 'left',
            }}>
              {[
                { label: 'Objetivo',  value: OBJECTIVES.find(o => o.value === objetivo)?.label || objetivo },
                { label: 'Nivel',     value: LEVELS.find(l => l.value === nivel)?.label || nivel },
                { label: 'Días/sem',  value: `${dias} días` },
                { label: 'Duración', value: `${semanas} semanas` },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>{row.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#e5e7eb' }}>{row.value}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>
              El sistema creará un punto de partida basado en evidencia. Puedes modificar cualquier cosa después.
            </p>

            {/* ¿Tour? */}
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '12px', fontWeight: 600 }}>
              ¿Quieres el tour rápido de 30 segundos?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => handleComplete(true)}
                style={{
                  flex: 1, padding: '14px', borderRadius: '12px',
                  background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`,
                  border: 'none', color: '#000', fontWeight: 800,
                  fontSize: '14px', cursor: 'pointer',
                  boxShadow: `0 4px 20px ${ACCENT}40`,
                  transition: 'all 0.2s',
                }}
              >
                Sí, mostrarme el tour
              </button>
              <button
                onClick={() => handleComplete(false)}
                style={{
                  flex: 1, padding: '14px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#9ca3af', fontWeight: 600,
                  fontSize: '14px', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                No, ir directo al plan
              </button>
            </div>
          </div>
        )}

        {/* ── Botón Siguiente (pasos 1 y 2) ── */}
        {step < 3 && (
          <button
            onClick={handleNext}
            disabled={!canNext}
            style={{
              width: '100%', marginTop: '28px',
              padding: '14px', borderRadius: '12px', border: 'none',
              background: canNext
                ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`
                : 'rgba(255,255,255,0.06)',
              color: canNext ? '#000' : '#4b5563',
              fontWeight: 800, fontSize: '14px',
              cursor: canNext ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              boxShadow: canNext ? `0 4px 20px ${ACCENT}30` : 'none',
            }}
          >
            Siguiente →
          </button>
        )}

        {/* ── Skip ── */}
        <button
          onClick={onSkip}
          style={{
            display: 'block', margin: '16px auto 0',
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.25)', fontSize: '12px',
            cursor: 'pointer', textDecoration: 'underline',
          }}
        >
          Saltar y configurar manualmente
        </button>
      </div>
    </div>
  );
};

export default GuidedPlanSetup;
