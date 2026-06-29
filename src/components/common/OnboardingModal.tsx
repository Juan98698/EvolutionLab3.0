/**
 * OnboardingModal.tsx — Reescrito con Opción C
 *
 * Flujo de 4 pasos para entrenador nuevo:
 *   1. Diagnóstico de metodología → calibra el lenguaje del resto
 *   2. Objetivo del bloque        → qué quiere lograr
 *   3. Estructura del plan        → días y semanas
 *   4. Confirmación + CTA         → crea plan sandbox bajo el propio perfil
 *
 * Opción C: el plan de práctica se crea bajo el id del propio entrenador,
 * sin migración de DB, sin localStorage volátil, sin usuario falso.
 *
 * Para clientes (guiado y autónomo): mantiene el flujo original simplificado.
 */

import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getProtocolsForContext } from '../../lib/protocols';
import { TrainingDay } from '../../types/database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Metodologia  = 'intuitiva' | 'experiencia' | 'cientifica';
type SandboxObj   = 'hipertrofia' | 'fuerza' | 'mantenimiento';
type SandboxLevel = 'principiante' | 'intermedio' | 'avanzado';

interface OnboardingModalProps {
  onClose:          () => void;
  rol:              'entrenador' | 'cliente_guiado' | 'cliente_autonomo';
  suscripcionPlan?: string;
  trainerId?:       string; // id del entrenador — necesario para crear el plan sandbox
}

const ACCENT = '#c2ff00';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deriva el nivel recomendado desde la metodología del entrenador */
const deriveLevel = (m: Metodologia): SandboxLevel => ({
  intuitiva:   'principiante',
  experiencia: 'intermedio',
  cientifica:  'avanzado',
}[m] as SandboxLevel);

/** Texto adaptado según metodología para los labels de la app */
const languageMode = (m: Metodologia) => m === 'cientifica' ? 'tecnico' : 'simple';

// ─── Componente ───────────────────────────────────────────────────────────────

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  onClose, rol, trainerId
}) => {
  // ── Estado entrenador ──
  const [step,        setStep]       = useState(1);
  const [metodologia, setMetodologia]= useState<Metodologia | null>(null);
  const [objetivo,    setObjetivo]   = useState<SandboxObj | null>(null);
  const [dias,        setDias]       = useState(4);
  const [semanas,     setSemanas]    = useState(6);
  const [creating,    setCreating]   = useState(false);

  // ── Cliente — slides estáticos simplificados ──
  const [clientStep, setClientStep]  = useState(1);
  const clientSlides = rol === 'cliente_guiado'
    ? [
        { emoji: '👋', title: 'Tu plan está listo', text: 'Tu entrenador configuró todo. Solo tienes que entrenar y registrar cada serie.' },
        { emoji: '📝', title: 'Registra cada serie', text: 'Marca el checkbox al terminar cada serie. Si el peso o las reps fueron diferentes, cámbialos antes de marcar.' },
        { emoji: '🤖', title: 'Pesos automáticos', text: 'El sistema te sugiere los pesos para la próxima semana basado en lo que registraste. Cuanto más registres, mejor la sugerencia.' },
      ]
    : [
        { emoji: '👋', title: 'Bienvenido', text: 'Crea tu plan, registra tus sesiones y el sistema aprende de tu rendimiento para sugerirte cargas cada semana.' },
        { emoji: '📝', title: 'Registra cada serie', text: 'Marca el checkbox al terminar. Ajusta peso y reps si difieren del plan. Eso alimenta el motor de sugerencias.' },
        { emoji: '⚡', title: 'Funciona offline', text: 'Mala señal en el gym, no hay problema. La app guarda todo localmente y sincroniza cuando recuperes conexión.' },
      ];

  // ── Handlers entrenador ──

  const handleCreateSandbox = async () => {
    if (!objetivo || !metodologia || !trainerId) return;
    setCreating(true);

    try {
      const level    = deriveLevel(metodologia);
      const protocols = getProtocolsForContext(objetivo, level);
      const best      = protocols.find(p => p.daysPerWeek === dias) || protocols[0];

      const trainingDays: TrainingDay[] = best
        ? best.days.map((day, idx) => ({
            id:        `day_${idx + 1}`,
            dayNumber: idx + 1,
            name:      day.label,
            exercises: day.exercises.map(ex => ({
              id:              crypto.randomUUID(),
              nombre:          ex.name,
              nombre_original: ex.name,
              grupo_muscular:  ex.muscle,
              variables: {
                'series de trabajo': ex.sets,
                'repeticiones':      ex.reps,
                'rir':               ex.rir,
                'descanso':          ex.rest,
              },
            })),
          }))
        : [];

      const planPayload = {
        cliente_id: trainerId,
        creador_id: trainerId,
        activo: true,
        datos_plan: {
          portada: {
            userName:      '🧪 Plan de práctica',
            userGoal:      objetivo === 'hipertrofia' ? 'Hipertrofia' : objetivo === 'fuerza' ? 'Fuerza' : 'Mantenimiento',
            startDate:     new Date().toISOString().split('T')[0],
            planVigenciaPlan: String(semanas * 7),
            trainerName:   '',
            whatsappLink:  '',
            globalNote:    'Plan creado durante el onboarding para explorar la app. Puedes modificarlo o eliminarlo cuando quieras.'
          },
          trainingDays,
          globalVariables: {},
          periodizationConfig: {
            enabled:       true,
            objetivo,
            semana_actual: 1,
            total_semanas: semanas,
            marcas_1rm: {
              'sentadilla': 100,
              'sentadilla con barra': 100,
              'press de banca': 80,
              'press de banca con barra': 80,
              'peso muerto': 120,
              'peso muerto con barra': 120,
              'press militar': 50,
              'press militar con barra': 50,
              'prensa': 200,
              'remo con barra': 70
            },
            mrv_limite_alcanzado: false,
            puntos_debiles: { sentadilla: 'abajo', banca: 'pecho', peso_muerto: 'despegue' },
          },
          is_sandbox: true,
          language_mode: languageMode(metodologia),
        }
      };

      await supabase.from('planes').insert(planPayload);
    } catch (e) {
      console.warn('No se pudo crear el plan sandbox:', e);
    }

    localStorage.setItem('evolution_trainer_onboarded_v1', 'true');
    setCreating(false);
    onClose();
  };

  const handleSkipSandbox = () => {
    localStorage.setItem('evolution_trainer_onboarded_v1', 'true');
    onClose();
  };

  // ─── Render cliente ────────────────────────────────────────────────────────

  if (rol !== 'entrenador') {
    const slide = clientSlides[clientStep - 1];
    const isLast = clientStep === clientSlides.length;

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.96)', backdropFilter: 'blur(12px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: 'rgba(15,23,42,0.9)', border: `1px solid ${ACCENT}22`, borderRadius: '24px', maxWidth: '420px', width: '100%', padding: '36px 28px', textAlign: 'center', boxShadow: `0 20px 50px rgba(0,0,0,0.5)` }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>{slide.emoji}</div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>{slide.title}</h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: '28px' }}>{slide.text}</p>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '20px' }}>
            {clientSlides.map((_, i) => (
              <div key={i} style={{ height: '4px', width: i + 1 <= clientStep ? '24px' : '8px', borderRadius: '2px', background: i + 1 <= clientStep ? ACCENT : 'rgba(255,255,255,0.1)', transition: 'all 0.3s' }} />
            ))}
          </div>
          <button
            onClick={() => {
              if (!isLast) { setClientStep(s => s + 1); }
              else { localStorage.setItem('evolution_onboarded_v1', 'true'); onClose(); }
            }}
            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`, color: '#000', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}
          >
            {isLast ? 'Empezar →' : 'Siguiente →'}
          </button>
        </div>
      </div>
    );
  }

  // ─── Render entrenador — 4 pasos ──────────────────────────────────────────

  const totalSteps = 4;
  const canNext = step === 1 ? metodologia !== null : step === 2 ? objetivo !== null : true;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.97)', backdropFilter: 'blur(16px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Inter','Roboto',sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '520px', background: 'rgba(15,23,42,0.92)', border: `1px solid ${ACCENT}22`, borderRadius: '24px', padding: '36px 32px', position: 'relative', overflow: 'hidden', boxShadow: `0 24px 64px rgba(0,0,0,0.6)` }}>

        {/* Glow */}
        <div style={{ position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)', width: '200px', height: '200px', background: ACCENT, filter: 'blur(80px)', opacity: 0.06, pointerEvents: 'none', borderRadius: '50%' }} />

        {/* Progress */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '28px' }}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} style={{ height: '4px', borderRadius: '2px', transition: 'all 0.3s', width: i + 1 === step ? '32px' : '12px', background: i + 1 <= step ? ACCENT : 'rgba(255,255,255,0.1)' }} />
          ))}
        </div>

        {/* ── Paso 1 — Metodología ── */}
        {step === 1 && (
          <div>
            <p style={{ fontSize: '11px', color: ACCENT, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>Paso 1 de 4</p>
            <h2 style={{ fontSize: '21px', fontWeight: 800, color: '#fff', marginBottom: '6px', lineHeight: 1.3 }}>¿Cómo describes tu metodología de entrenamiento?</h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '22px' }}>Esto adapta el lenguaje de la app a tu nivel de familiaridad con la ciencia del ejercicio.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {([
                { value: 'intuitiva',   emoji: '🎯', label: 'Intuitiva',            hint: 'Ajusto según cómo se ve y siente el atleta' },
                { value: 'experiencia', emoji: '📚', label: 'Basada en experiencia', hint: 'Tengo métodos probados que funcionan' },
                { value: 'cientifica',  emoji: '🧬', label: 'Científica',            hint: 'Uso periodización, RIR, control de volumen' },
              ] as { value: Metodologia; emoji: string; label: string; hint: string }[]).map(opt => (
                <button key={opt.value} onClick={() => setMetodologia(opt.value)}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '12px', cursor: 'pointer', border: `1px solid ${metodologia === opt.value ? ACCENT : 'rgba(255,255,255,0.1)'}`, background: metodologia === opt.value ? `${ACCENT}12` : 'rgba(255,255,255,0.03)', transition: 'all 0.2s', textAlign: 'left' }}>
                  <span style={{ fontSize: '22px', flexShrink: 0 }}>{opt.emoji}</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: metodologia === opt.value ? ACCENT : '#e5e7eb', marginBottom: '2px' }}>{opt.label}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>{opt.hint}</div>
                  </div>
                  {metodologia === opt.value && <span style={{ marginLeft: 'auto', color: ACCENT }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Paso 2 — Objetivo del plan sandbox ── */}
        {step === 2 && (
          <div>
            <p style={{ fontSize: '11px', color: ACCENT, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>Paso 2 de 4</p>
            <h2 style={{ fontSize: '21px', fontWeight: 800, color: '#fff', marginBottom: '6px', lineHeight: 1.3 }}>Crea un plan de práctica para explorar la app</h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '22px' }}>Se creará bajo tu perfil, puedes modificarlo o eliminarlo cuando quieras. ¿Cuál sería el objetivo?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {([
                { value: 'hipertrofia',    emoji: '💪', label: 'Ganar músculo' },
                { value: 'fuerza',         emoji: '🏋️', label: 'Ganar fuerza' },
                { value: 'mantenimiento',  emoji: '🔄', label: 'Mantener' },
              ] as { value: SandboxObj; emoji: string; label: string }[]).map(opt => (
                <button key={opt.value} onClick={() => setObjetivo(opt.value)}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '12px', cursor: 'pointer', border: `1px solid ${objetivo === opt.value ? ACCENT : 'rgba(255,255,255,0.1)'}`, background: objetivo === opt.value ? `${ACCENT}12` : 'rgba(255,255,255,0.03)', transition: 'all 0.2s' }}>
                  <span style={{ fontSize: '22px' }}>{opt.emoji}</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: objetivo === opt.value ? ACCENT : '#e5e7eb' }}>{opt.label}</span>
                  {objetivo === opt.value && <span style={{ marginLeft: 'auto', color: ACCENT }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Paso 3 — Estructura ── */}
        {step === 3 && (
          <div>
            <p style={{ fontSize: '11px', color: ACCENT, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>Paso 3 de 4</p>
            <h2 style={{ fontSize: '21px', fontWeight: 800, color: '#fff', marginBottom: '6px', lineHeight: 1.3 }}>¿Cómo estructurarías el plan?</h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '22px' }}>Estos valores se pueden cambiar después.</p>

            <div style={{ marginBottom: '22px' }}>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Días por semana</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[3, 4, 5, 6].map(d => (
                  <button key={d} onClick={() => setDias(d)}
                    style={{ flex: 1, padding: '12px 0', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${dias === d ? ACCENT : 'rgba(255,255,255,0.1)'}`, background: dias === d ? `${ACCENT}12` : 'rgba(255,255,255,0.03)', color: dias === d ? ACCENT : '#9ca3af', fontWeight: 700, fontSize: '16px', transition: 'all 0.2s' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Duración del bloque</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[4, 6, 8, 12].map(w => (
                  <button key={w} onClick={() => setSemanas(w)}
                    style={{ flex: 1, padding: '10px 0', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${semanas === w ? ACCENT : 'rgba(255,255,255,0.1)'}`, background: semanas === w ? `${ACCENT}12` : 'rgba(255,255,255,0.03)', color: semanas === w ? ACCENT : '#9ca3af', fontWeight: 700, fontSize: '13px', transition: 'all 0.2s' }}>
                    {w} sem
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Paso 4 — Confirmación ── */}
        {step === 4 && objetivo && metodologia && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</div>
            <p style={{ fontSize: '11px', color: ACCENT, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>Paso 4 de 4</p>
            <h2 style={{ fontSize: '21px', fontWeight: 800, color: '#fff', marginBottom: '12px', lineHeight: 1.3 }}>Todo listo para crear tu plan de práctica</h2>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', marginBottom: '20px', textAlign: 'left' }}>
              {[
                { label: 'Metodología', value: { intuitiva: 'Intuitiva', experiencia: 'Experiencia', cientifica: 'Científica' }[metodologia] },
                { label: 'Objetivo',   value: { hipertrofia: 'Ganar músculo', fuerza: 'Ganar fuerza', mantenimiento: 'Mantener' }[objetivo] },
                { label: 'Días/sem',   value: `${dias} días` },
                { label: 'Duración',   value: `${semanas} semanas` },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>{row.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#e5e7eb' }}>{row.value}</span>
                </div>
              ))}
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                El plan aparecerá en tu lista bajo el nombre "🧪 Plan de práctica"
              </div>
            </div>

            <button
              onClick={handleCreateSandbox}
              disabled={creating}
              style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: creating ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`, color: creating ? '#4b5563' : '#000', fontWeight: 800, fontSize: '14px', cursor: creating ? 'not-allowed' : 'pointer', boxShadow: creating ? 'none' : `0 4px 20px ${ACCENT}40`, transition: 'all 0.2s', marginBottom: '10px' }}
            >
              {creating ? 'Creando plan...' : '🚀 Crear plan y entrar a la app'}
            </button>
            <button onClick={handleSkipSandbox} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
              Saltar, ya sé lo que hago
            </button>
          </div>
        )}

        {/* Botón siguiente (pasos 1-3) */}
        {step < 4 && (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext}
            style={{ width: '100%', marginTop: '24px', padding: '14px', borderRadius: '12px', border: 'none', background: canNext ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)` : 'rgba(255,255,255,0.06)', color: canNext ? '#000' : '#4b5563', fontWeight: 800, fontSize: '14px', cursor: canNext ? 'pointer' : 'not-allowed', transition: 'all 0.2s', boxShadow: canNext ? `0 4px 20px ${ACCENT}30` : 'none' }}
          >
            Siguiente →
          </button>
        )}

        {step > 1 && step < 4 && (
          <button onClick={() => setStep(s => s - 1)} style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: '12px', cursor: 'pointer' }}>
            ← Atrás
          </button>
        )}
      </div>
    </div>
  );
};

export default OnboardingModal;
