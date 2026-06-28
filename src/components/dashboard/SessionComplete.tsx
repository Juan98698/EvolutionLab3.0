import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompletedSeries {
  reps: number;
  peso: string;
}

interface CompletedExercise {
  nombre: string;
  grupo: string;
  series: CompletedSeries[];
  feedback_estimulo: 'none' | 'good' | 'extreme';
  feedback_recuperacion: 'recovered' | 'just_in_time' | 'sore';
  targetRIR: string;
}

export interface SessionCompleteState {
  exercises: CompletedExercise[];
  fecha: string;
  savedOnline: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ESTIMULO_LABELS: Record<string, { emoji: string; label: string }> = {
  none:    { emoji: '😐', label: 'Sin estímulo' },
  good:    { emoji: '💪', label: 'Buen estímulo' },
  extreme: { emoji: '🔥', label: 'Estímulo extremo' },
};

const RECOVERY_LABELS: Record<string, { emoji: string; label: string }> = {
  recovered:    { emoji: '✅', label: 'Recuperado' },
  just_in_time: { emoji: '⚡', label: 'Justo a tiempo' },
  sore:         { emoji: '😫', label: 'Agotado' },
};

const formatDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
};

/**
 * SessionComplete — Post-session summary screen.
 *
 * Receives session data via React Router location.state (set by ActiveSession
 * after a successful save). Shows:
 *   • Congratulatory header with save status
 *   • Session stats: exercises, sets, volume
 *   • Per-exercise card with series log + feedback badges
 *   • CTA: back to dashboard
 *
 * If the user navigates here directly (no state), redirects to /dashboard.
 */
const SessionComplete: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as SessionCompleteState | null;

  // Redirect if no session data (direct nav or refresh)
  useEffect(() => {
    if (!state) {
      navigate('/dashboard', { replace: true });
    }
  }, [state, navigate]);

  // Confetti burst on mount
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!state) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ['#7c3aed', '#4f46e5', '#10b981', '#facc15', '#a78bfa', '#6ee7b7'];
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 100,
      r: 3 + Math.random() * 5,
      d: 2 + Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      tilt: Math.random() * 10 - 5,
      tiltAngle: 0,
      tiltAngleIncrement: 0.05 + Math.random() * 0.1,
    }));

    let frame = 0;
    let animId: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.tiltAngle += p.tiltAngleIncrement;
        p.y += p.d;
        p.tilt = Math.sin(p.tiltAngle) * 12;
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - p.y / canvas.height);
        ctx.ellipse(p.x + p.tilt, p.y, p.r, p.r * 0.4, p.tiltAngle, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      frame++;
      if (frame < 180) animId = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [state]);

  if (!state) return null;

  // ── Compute summary stats ──
  const totalSeries = state.exercises.reduce((acc, ex) => acc + ex.series.length, 0);
  const totalVolume = state.exercises.reduce((acc, ex) => {
    return acc + ex.series.reduce((s, serie) => {
      const peso = parseFloat(serie.peso) || 0;
      return s + peso * serie.reps;
    }, 0);
  }, 0);
  const totalReps = state.exercises.reduce((acc, ex) =>
    acc + ex.series.reduce((s, serie) => s + serie.reps, 0), 0
  );

  return (
    <div className="session-complete-root">
      {/* Confetti canvas (absolute, pointer-events-none) */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed', inset: 0, zIndex: 0,
          pointerEvents: 'none', width: '100%', height: '100%'
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* ── Header ── */}
        <div className="session-complete-header">
          <div className="session-complete-trophy">🏆</div>
          <h1 className="session-complete-title">¡Sesión completada!</h1>
          <p className="session-complete-date">{formatDate(state.fecha)}</p>
          <div className={`session-complete-sync-badge${state.savedOnline ? ' online' : ' offline'}`}>
            {state.savedOnline ? '☁️ Guardado en la nube' : '📱 Guardado localmente (offline)'}
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="session-complete-stats">
          <div className="session-complete-stat">
            <span className="session-complete-stat-value">{state.exercises.length}</span>
            <span className="session-complete-stat-label">Ejercicios</span>
          </div>
          <div className="session-complete-stat-divider" />
          <div className="session-complete-stat">
            <span className="session-complete-stat-value">{totalSeries}</span>
            <span className="session-complete-stat-label">Series</span>
          </div>
          <div className="session-complete-stat-divider" />
          <div className="session-complete-stat">
            <span className="session-complete-stat-value">{totalReps}</span>
            <span className="session-complete-stat-label">Reps</span>
          </div>
          {totalVolume > 0 && (
            <>
              <div className="session-complete-stat-divider" />
              <div className="session-complete-stat">
                <span className="session-complete-stat-value">{Math.round(totalVolume).toLocaleString('es-ES')}</span>
                <span className="session-complete-stat-label">kg volumen</span>
              </div>
            </>
          )}
        </div>

        {/* ── Per-exercise summary ── */}
        <div className="session-complete-exercises">
          {state.exercises.map((ex, idx) => {
            const estim  = ESTIMULO_LABELS[ex.feedback_estimulo]    ?? ESTIMULO_LABELS.good;
            const recov  = RECOVERY_LABELS[ex.feedback_recuperacion] ?? RECOVERY_LABELS.recovered;
            const exVol  = ex.series.reduce((s, serie) => s + (parseFloat(serie.peso) || 0) * serie.reps, 0);

            return (
              <div key={idx} className="session-complete-exercise-card">
                {/* Card header */}
                <div className="session-complete-exercise-header">
                  <span className="session-complete-exercise-num">{idx + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div className="session-complete-exercise-name">{ex.nombre}</div>
                    {ex.grupo && (
                      <div className="session-complete-exercise-group">{ex.grupo}</div>
                    )}
                  </div>
                  {exVol > 0 && (
                    <div className="session-complete-exercise-vol">
                      <span className="session-complete-exercise-vol-value">{Math.round(exVol).toLocaleString('es-ES')}</span>
                      <span className="session-complete-exercise-vol-unit">kg</span>
                    </div>
                  )}
                </div>

                {/* Series log */}
                <div className="session-complete-series-log">
                  {ex.series.map((serie, sIdx) => (
                    <div key={sIdx} className="session-complete-serie-row">
                      <span className="session-complete-serie-num">{sIdx + 1}</span>
                      <span className="session-complete-serie-data">
                        {serie.peso ? `${serie.peso} kg` : '—'}
                        <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 5px' }}>×</span>
                        {serie.reps} reps
                      </span>
                      {ex.targetRIR && (
                        <span className="session-complete-serie-rir">RIR {ex.targetRIR}</span>
                      )}
                      <span className="session-complete-serie-check">✓</span>
                    </div>
                  ))}
                </div>

                {/* Feedback badges */}
                <div className="session-complete-feedback-badges">
                  <span className="session-complete-badge">
                    {estim.emoji} {estim.label}
                  </span>
                  <span className="session-complete-badge">
                    {recov.emoji} {recov.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── CTA ── */}
        <div className="session-complete-cta">
          <button
            className="session-complete-done-btn"
            onClick={() => navigate('/dashboard')}
          >
            Volver al Dashboard
          </button>
          <button
            className="session-complete-history-btn"
            onClick={() => navigate('/historial')}
          >
            Ver historial
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionComplete;
