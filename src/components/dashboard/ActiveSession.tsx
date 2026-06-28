import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { PlanData } from '../../types/database.types';
import { writeSessionsToCache } from '../../lib/sessions';
import { autoRegulatePlanForNextWeek } from '../../lib/periodizationEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeriesEntry {
  reps: number;
  peso: string;
  done: boolean;
}

interface ActiveExercise {
  nombre: string;
  grupo: string;
  suggestedPeso: string;   // Ghost value from plan variables
  suggestedReps: number;   // Ghost value from plan variables
  targetRIR: string;
  descanso: number;        // in seconds
  series: SeriesEntry[];
  feedback_estimulo: 'none' | 'good' | 'extreme';
  feedback_recuperacion: 'recovered' | 'just_in_time' | 'sore';
  video_url?: string;
  image_url?: string;
  gif_url?: string;
  description?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseNumericField = (val: string | undefined): number => {
  if (!val) return 0;
  const clean = val.trim();
  const range = clean.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (range) return Math.round((parseInt(range[1], 10) + parseInt(range[2], 10)) / 2);
  const single = clean.match(/^[\d.]+/);
  return single ? parseFloat(single[0]) : 0;
};

const parseSeries = (val: string | undefined): number => {
  if (!val) return 3;
  const n = parseNumericField(val);
  return Math.max(1, Math.min(10, n || 3));
};

const parseReps = (val: string | undefined): number => {
  if (!val) return 10;
  const n = parseNumericField(val);
  return Math.max(1, Math.min(50, n || 10));
};

const parsePeso = (val: string | undefined): string => {
  if (!val) return '';
  // Strip the robot prefix if present
  return val.replace(/^🤖\s*/, '').trim();
};

const parseDescanso = (val: string | undefined): number => {
  if (!val) return 90;
  const n = parseNumericField(val);
  return Math.max(30, n || 90);
};

/**
 * ActiveSession — Ultra-minimalist workout logging screen.
 *
 * Design principle: max 5 taps per set.
 *   Open → see exercise → tap peso → tap reps → tap ✓ → next
 *
 * This component is a standalone full-screen route (/session/active/:dayIndex)
 * without the athlete navbar, so there are zero distractions during the workout.
 */
const ActiveSession: React.FC = () => {
  const { dayIndex } = useParams<{ dayIndex: string }>();
  const navigate = useNavigate();

  // ─── Plan data ───────────────────────────────────────────────────────────
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [exercises, setExercises] = useState<ActiveExercise[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [showFullImage, setShowFullImage] = useState(false);

  // ─── Rest timer ──────────────────────────────────────────────────────────
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Load plan from localStorage ─────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pwa_client_plan');
      if (!raw) return;
      const parsed: PlanData = JSON.parse(raw);
      setPlan(parsed);

      const idx = parseInt(dayIndex || '0', 10);
      const day = parsed.trainingDays?.[idx];
      if (!day) return;

      // Build ActiveExercise array from plan exercises
      const built: ActiveExercise[] = day.exercises.map(ex => {
        const vars = ex.variables || {};
        const numSeries = parseSeries(vars['series de trabajo'] || vars['series']);
        const numReps = parseReps(vars['repeticiones'] || vars['reps']);
        const pesoSugerido = parsePeso(vars['peso']);
        const descanso = parseDescanso(vars['descanso']);

        const series: SeriesEntry[] = Array.from({ length: numSeries }, () => ({
          reps: numReps,
          peso: pesoSugerido,
          done: false,
        }));

        return {
          nombre: ex.nombre || 'Ejercicio',
          grupo: (ex as any).grupo_muscular || ex.grupo_muscular || '',
          suggestedPeso: pesoSugerido,
          suggestedReps: numReps,
          targetRIR: vars['rir'] || '',
          descanso,
          series,
          feedback_estimulo: 'good',
          feedback_recuperacion: 'recovered',
          video_url: ex.video_url || '',
          image_url: ex.image_url || ex.gif_url || '',
          description: ex.description || '',
        };
      });

      setExercises(built);
    } catch (e) {
      console.error('Error loading plan for ActiveSession:', e);
    }
  }, [dayIndex]);

  // ─── Rest timer logic ─────────────────────────────────────────────────────
  const startRestTimer = useCallback((seconds: number) => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setRestSecondsLeft(seconds);
    restIntervalRef.current = setInterval(() => {
      setRestSecondsLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(restIntervalRef.current!);
          // Vibrate on completion if supported
          if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, []);

  // ─── Series handlers ──────────────────────────────────────────────────────
  const handleSeriesFieldChange = useCallback(
    (exIdx: number, sIdx: number, field: 'reps' | 'peso', value: string) => {
      setExercises(prev => {
        const copy = [...prev];
        const series = [...copy[exIdx].series];
        if (field === 'reps') {
          series[sIdx] = { ...series[sIdx], reps: Math.max(1, parseInt(value, 10) || 1) };
        } else {
          series[sIdx] = { ...series[sIdx], peso: value };
        }
        copy[exIdx] = { ...copy[exIdx], series };
        return copy;
      });
    },
    []
  );

  const handleSeriesDone = useCallback(
    (exIdx: number, sIdx: number) => {
      setExercises(prev => {
        const copy = [...prev];
        const series = [...copy[exIdx].series];

        // Fill in ghost values if the field is still empty
        if (!series[sIdx].peso && copy[exIdx].suggestedPeso) {
          series[sIdx] = { ...series[sIdx], peso: copy[exIdx].suggestedPeso };
        }
        if (!series[sIdx].reps && copy[exIdx].suggestedReps) {
          series[sIdx] = { ...series[sIdx], reps: copy[exIdx].suggestedReps };
        }

        series[sIdx] = { ...series[sIdx], done: true };
        copy[exIdx] = { ...copy[exIdx], series };
        return copy;
      });

      // Start rest timer
      const descanso = exercises[exIdx]?.descanso || 90;
      startRestTimer(descanso);
    },
    [exercises, startRestTimer]
  );

  const handleFeedbackChange = useCallback(
    (exIdx: number, field: 'feedback_estimulo' | 'feedback_recuperacion', value: string) => {
      setExercises(prev => {
        const copy = [...prev];
        copy[exIdx] = { ...copy[exIdx], [field]: value };
        return copy;
      });
    },
    []
  );

  // ─── Navigation ───────────────────────────────────────────────────────────
  const currentExercise = exercises[currentIdx];
  const totalExercises = exercises.length;
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === totalExercises - 1;
  const allSeriesDone = currentExercise?.series.every(s => s.done) ?? false;

  const handleNext = useCallback(() => {
    if (currentIdx < totalExercises - 1) {
      setCurrentIdx(prev => prev + 1);
      // Cancel rest timer on manual nav
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
      setRestSecondsLeft(null);
    }
  }, [currentIdx, totalExercises]);

  const handlePrev = useCallback(() => {
    if (currentIdx > 0) {
      setCurrentIdx(prev => prev - 1);
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
      setRestSecondsLeft(null);
    }
  }, [currentIdx]);

  // ─── Save session ─────────────────────────────────────────────────────────
  const handleSaveSession = useCallback(async () => {
    if (!plan) return;
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user;
      if (!currentUser) throw new Error('No hay sesión activa.');

      const today = new Date();
      const fecha = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // Build exercises list for saving (mirrors AddSesion.handleSaveSession structure)
      const ejerciciosGuardar = exercises
        .filter(ex => ex.series.some(s => s.done))
        .map((ex, index) => {
          const repsArray = ex.series.filter(s => s.done).map(s => s.reps);
          const pesoRaw = (ex.series.find(s => s.done)?.peso || '').trim().toLowerCase();
          const pesoNum = (pesoRaw === '' || pesoRaw === 'autocarga') ? 0 : parseFloat(pesoRaw) || 0;
          return {
            id_ej: 1000 + index,
            nombre: ex.nombre.trim().charAt(0).toUpperCase() + ex.nombre.trim().slice(1),
            grupo: ex.grupo,
            peso: pesoNum,
            repsArray,
            rpe: parseFloat(ex.targetRIR) || 2,
            descanso: ex.descanso,
            notas_ej: '',
            feedback_estimulo: ex.feedback_estimulo,
            feedback_recuperacion: ex.feedback_recuperacion,
          };
        });

      // ── Offline-first: save to local cache ──
      const cachedSessions = localStorage.getItem('sobrecarga_v5');
      const sesiones = cachedSessions ? JSON.parse(cachedSessions) : [];
      const nextSesionId = sesiones.length > 0
        ? Math.max(...sesiones.map((s: any) => (typeof s.id === 'number' ? s.id : 0))) + 1
        : 1;

      const nuevaSesion = {
        id: nextSesionId,
        fecha,
        notas_sesion: sessionNotes,
        ejercicios: ejerciciosGuardar,
      };
      sesiones.push(nuevaSesion);
      writeSessionsToCache(sesiones);

      // ── Online: sync to Supabase ──
      if (navigator.onLine) {
        const { data: histData, error: histError } = await supabase
          .from('sesiones_historial')
          .insert({ cliente_id: currentUser.id, fecha, notas_generales: sessionNotes })
          .select('id')
          .single();

        if (histError) throw histError;

        const sesionId = histData.id;
        nuevaSesion.id = sesionId;

        const ejerciciosInsert = ejerciciosGuardar.map(ej => {
          const totalReps = ej.repsArray.reduce((a, b) => a + b, 0);
          const vol = ej.peso * totalReps;
          const maxReps = Math.max(...ej.repsArray);
          const epley = ej.peso * (1 + maxReps / 30);
          const brzyckiDenominator = 1.0278 - 0.0278 * maxReps;
          const brzycki = brzyckiDenominator > 0.01 ? ej.peso / brzyckiDenominator : ej.peso;
          const rmEst = (epley + brzycki) / 2;
          return {
            sesion_id: sesionId,
            nombre_ejercicio: ej.nombre,
            grupo_muscular: ej.grupo,
            series_reps: ej.repsArray,
            peso: ej.peso,
            rpe_rir: ej.rpe,
            descanso: ej.descanso,
            volumen: vol,
            rm_estimado: rmEst,
            feedback_estimulo: ej.feedback_estimulo || null,
            feedback_recuperacion: ej.feedback_recuperacion || null,
          };
        });

        await supabase.from('sesiones_ejercicios').insert(ejerciciosInsert);
        writeSessionsToCache(sesiones);
      }

      // ── Auto-regulation ──
      if (plan.periodizationConfig?.enabled) {
        try {
          const updatedPlan = autoRegulatePlanForNextWeek(
            plan,
            ejerciciosGuardar.map(e => ({
              nombre: e.nombre,
              repsArray: e.repsArray,
              peso: e.peso,
              rir: e.rpe,
              feedback_estimulo: e.feedback_estimulo,
              feedback_recuperacion: e.feedback_recuperacion,
            }))
          );
          if (updatedPlan) {
            localStorage.setItem('pwa_client_plan', JSON.stringify(updatedPlan));
            if (navigator.onLine) {
              const { data: activePlan } = await supabase
                .from('planes')
                .select('id')
                .eq('cliente_id', currentUser.id)
                .eq('activo', true)
                .maybeSingle();
              if (activePlan) {
                await supabase.from('planes').update({ datos_plan: updatedPlan }).eq('id', activePlan.id);
              }
            }
          }
        } catch (ePeriod) {
          console.error('Error en auto-regulación:', ePeriod);
        }
      }

      // ── Navigate to summary screen ──
      navigate('/session/complete', {
        state: {
          exercises: exercises
            .filter(ex => ex.series.some(s => s.done))
            .map(ex => ({
              nombre:                ex.nombre,
              grupo:                 ex.grupo,
              series:                ex.series
                                       .filter(s => s.done)
                                       .map(s => ({
                                         reps: s.reps,
                                         // Strip robot emoji from ghost values before passing
                                         peso: s.peso.replace(/^🤖\s*/, '').trim(),
                                       })),
              feedback_estimulo:     ex.feedback_estimulo,
              feedback_recuperacion: ex.feedback_recuperacion,
              targetRIR:             ex.targetRIR,
            })),
          fecha,
          savedOnline: navigator.onLine,
        },
      });
    } catch (err: any) {
      console.error('Error al guardar sesión:', err);
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [plan, exercises, sessionNotes, navigate]);

  // ─── Guard: no plan or exercises ──────────────────────────────────────────
  if (!plan || exercises.length === 0) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0b0f19', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px'
      }}>
        <div style={{ fontSize: '32px' }}>🏋️</div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Cargando sesión...</p>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '10px', color: 'rgba(255,255,255,0.6)', padding: '10px 20px',
            fontSize: '12px', cursor: 'pointer'
          }}
        >
          ← Volver al Dashboard
        </button>
      </div>
    );
  }

  const restPct = restSecondsLeft != null && currentExercise
    ? (restSecondsLeft / currentExercise.descanso) * 100
    : 0;

  return (
    <div className="active-session-root">
      {/* ── Exit Confirm Overlay ── */}
      {showExitConfirm && (
        <div className="active-session-overlay">
          <div className="active-session-exit-card">
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: 'white' }}>
              ¿Salir de la sesión?
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              El progreso no guardado se perderá.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="active-session-btn-secondary"
                onClick={() => setShowExitConfirm(false)}
              >
                Continuar
              </button>
              <button
                className="active-session-btn-danger"
                onClick={() => navigate('/dashboard')}
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top Bar ── */}
      <div className="active-session-topbar">
        <button
          className="active-session-exit-btn"
          onClick={() => setShowExitConfirm(true)}
          aria-label="Salir de la sesión"
        >
          ← Salir
        </button>
        <div className="active-session-progress-text">
          {currentIdx + 1} / {totalExercises} ejercicios
        </div>
        {/* Progress bar */}
        <div className="active-session-progress-bar-track">
          <div
            className="active-session-progress-bar-fill"
            style={{ width: `${((currentIdx + 1) / totalExercises) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Exercise Name ── */}
      <div className="active-session-exercise-header">
        <h1 className="active-session-exercise-name">
          {currentExercise.nombre}
        </h1>
        {currentExercise.grupo && (
          <span className="active-session-exercise-group">{currentExercise.grupo}</span>
        )}
        <div className="active-session-exercise-meta">
          {currentExercise.series.length} series
          {currentExercise.suggestedReps > 0 && ` · ${currentExercise.suggestedReps} reps objetivo`}
          {currentExercise.targetRIR && ` · RIR ${currentExercise.targetRIR}`}
        </div>
      </div>

      {/* ── Series Table ── */}
      <div className="active-session-series-container">
        {/* Header row */}
        <div className="active-session-series-header">
          <span className="active-session-col-label">Serie</span>
          <span className="active-session-col-label">Peso (kg)</span>
          <span className="active-session-col-label">Reps</span>
          <span className="active-session-col-label">✓</span>
        </div>

        {currentExercise.series.map((s, sIdx) => (
          <div
            key={sIdx}
            className={`active-session-series-row${s.done ? ' done' : ''}`}
          >
            {/* Series number */}
            <span className="active-session-series-num">{sIdx + 1}</span>

            {/* Peso input */}
            <input
              type="text"
              inputMode="decimal"
              className={`active-session-input${s.done ? ' done' : ''}`}
              value={s.peso}
              placeholder={currentExercise.suggestedPeso || '—'}
              onChange={e => handleSeriesFieldChange(currentIdx, sIdx, 'peso', e.target.value)}
              disabled={s.done}
              aria-label={`Peso serie ${sIdx + 1}`}
            />

            {/* Reps input */}
            <input
              type="number"
              inputMode="numeric"
              className={`active-session-input${s.done ? ' done' : ''}`}
              value={s.reps || ''}
              placeholder={String(currentExercise.suggestedReps || '—')}
              onChange={e => handleSeriesFieldChange(currentIdx, sIdx, 'reps', e.target.value)}
              disabled={s.done}
              min={1}
              max={50}
              aria-label={`Reps serie ${sIdx + 1}`}
            />

            {/* Done button */}
            <button
              className={`active-session-check-btn${s.done ? ' done' : ''}`}
              onClick={() => !s.done && handleSeriesDone(currentIdx, sIdx)}
              disabled={s.done}
              aria-label={s.done ? 'Serie completada' : `Marcar serie ${sIdx + 1} como completada`}
            >
              {s.done ? '✓' : '○'}
            </button>
          </div>
        ))}

        {/* ── Exercise Guide & Info ── */}
        {(currentExercise.image_url || currentExercise.gif_url || currentExercise.video_url || currentExercise.description) && (
          <div className="active-session-guide-card">
            <div className="active-session-guide-content">
              {/* Left side: Image thumbnail */}
              {(currentExercise.image_url || currentExercise.gif_url) && (
                <div className="active-session-guide-thumbnail-container" onClick={() => setShowFullImage(true)}>
                  <img
                    src={currentExercise.image_url || currentExercise.gif_url}
                    alt={currentExercise.nombre}
                    className="active-session-guide-thumbnail"
                  />
                  <span className="active-session-guide-zoom-badge">🔍</span>
                </div>
              )}
              
              {/* Right side: Description & Video button */}
              <div className="active-session-guide-details">
                <div className="active-session-guide-header-row">
                  <span className="active-session-guide-title">Guía de ejecución</span>
                  {currentExercise.video_url && (
                    <a
                      href={currentExercise.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="active-session-guide-video-link"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                        <path d="M23 7l-7 5 7 5V7z" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                      Ver Video
                    </a>
                  )}
                </div>
                
                {currentExercise.description ? (
                  <p className="active-session-guide-desc">
                    {currentExercise.description}
                  </p>
                ) : (
                  <p className="active-session-guide-desc-placeholder">
                    Sin descripción disponible. ¡Realiza el ejercicio con técnica controlada!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Rest Timer ── */}
      {restSecondsLeft !== null && (
        <div className="active-session-rest-timer">
          <div className="active-session-rest-track">
            <div
              className="active-session-rest-fill"
              style={{ width: `${restPct}%` }}
            />
          </div>
          <span className="active-session-rest-label">
            ⏱ Descanso: {Math.floor(restSecondsLeft / 60)}:{String(restSecondsLeft % 60).padStart(2, '0')}
          </span>
          <button
            className="active-session-rest-skip"
            onClick={() => {
              if (restIntervalRef.current) clearInterval(restIntervalRef.current);
              setRestSecondsLeft(null);
            }}
          >
            Saltar
          </button>
        </div>
      )}

      {/* ── Feedback (shown when all series are done) ── */}
      {allSeriesDone && (
        <div className="active-session-feedback">
          <p className="active-session-feedback-title">¿Cómo fue este ejercicio?</p>
          <div className="active-session-feedback-row">
            <span className="active-session-feedback-label">Estímulo</span>
            <div className="active-session-feedback-options">
              {(['none', 'good', 'extreme'] as const).map(opt => (
                <button
                  key={opt}
                  className={`active-session-feedback-btn${currentExercise.feedback_estimulo === opt ? ' selected' : ''}`}
                  onClick={() => handleFeedbackChange(currentIdx, 'feedback_estimulo', opt)}
                >
                  {opt === 'none' ? '😐 Ninguno' : opt === 'good' ? '💪 Bueno' : '🔥 Extremo'}
                </button>
              ))}
            </div>
          </div>
          <div className="active-session-feedback-row">
            <span className="active-session-feedback-label">Recuperación</span>
            <div className="active-session-feedback-options">
              {(['recovered', 'just_in_time', 'sore'] as const).map(opt => (
                <button
                  key={opt}
                  className={`active-session-feedback-btn${currentExercise.feedback_recuperacion === opt ? ' selected' : ''}`}
                  onClick={() => handleFeedbackChange(currentIdx, 'feedback_recuperacion', opt)}
                >
                  {opt === 'recovered' ? '✅ Recuperado' : opt === 'just_in_time' ? '⚡ Justo' : '😫 Agotado'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom Navigation ── */}
      <div className="active-session-bottom-nav">
        <button
          className="active-session-nav-btn"
          onClick={handlePrev}
          disabled={isFirst}
          aria-label="Ejercicio anterior"
        >
          ← Anterior
        </button>

        {isLast ? (
          <button
            className="active-session-finish-btn"
            onClick={handleSaveSession}
            disabled={saving}
          >
            {saving ? 'Guardando...' : '✅ Finalizar sesión'}
          </button>
        ) : (
          <button
            className="active-session-nav-btn primary"
            onClick={handleNext}
            aria-label="Siguiente ejercicio"
          >
            Siguiente →
          </button>
        )}
      </div>

      {/* ── Session Notes (inline, bottom) ── */}
      {isLast && (
        <div className="active-session-notes">
          <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Nota de sesión (opcional)
          </label>
          <textarea
            className="active-session-notes-input"
            value={sessionNotes}
            onChange={e => setSessionNotes(e.target.value)}
            placeholder="¿Cómo te sentiste hoy? Lesiones, motivación, sueño..."
            rows={2}
          />
        </div>
      )}

      {/* ── Full Screen Image Modal ── */}
      {showFullImage && (currentExercise.image_url || currentExercise.gif_url) && (
        <div className="active-session-image-overlay" onClick={() => setShowFullImage(false)}>
          <div className="active-session-image-modal-content" onClick={e => e.stopPropagation()}>
            <button className="active-session-image-close" onClick={() => setShowFullImage(false)}>✕</button>
            <img
              src={currentExercise.image_url || currentExercise.gif_url}
              alt={currentExercise.nombre}
              className="active-session-image-large"
            />
            <p className="active-session-image-caption">{currentExercise.nombre}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveSession;
