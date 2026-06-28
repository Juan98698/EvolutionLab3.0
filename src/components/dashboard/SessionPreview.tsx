import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlanData } from '../../types/database.types';

/**
 * SessionPreview — Day selector + workout preview.
 *
 * The athlete sees their training days laid out as cards.
 * They pick the day they want to train and then tap "Empezar".
 * This navigates to /session/active/:dayIndex (ActiveSession).
 *
 * Design: card per day, exercise list preview, one prominent CTA.
 * No trainer-side complexity is exposed here.
 */
const SessionPreview: React.FC = () => {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('pwa_client_plan');
      if (raw) {
        const parsed: PlanData = JSON.parse(raw);
        setPlan(parsed);
        // Default: select the first day that has exercises
        const firstIdx = parsed.trainingDays?.findIndex(d => d.exercises?.length > 0) ?? 0;
        setSelectedDay(firstIdx >= 0 ? firstIdx : 0);
      }
    } catch (e) {
      console.error('SessionPreview: error loading plan', e);
    }
  }, []);

  if (!plan || !plan.trainingDays?.length) {
    return (
      <div className="session-preview-root">
        <div className="session-preview-empty">
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
          <h2 style={{ margin: '0 0 8px', color: 'white', fontSize: '18px' }}>
            Sin plan activo
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', lineHeight: 1.5 }}>
            Tu entrenador aún no ha publicado un plan. Vuelve más tarde o contacta con él.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="session-preview-back-btn"
          >
            ← Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  const selectedDayData = selectedDay !== null ? plan.trainingDays[selectedDay] : null;

  return (
    <div className="session-preview-root">
      {/* ── Top ── */}
      <div className="session-preview-header">
        <button
          onClick={() => navigate('/dashboard')}
          className="session-preview-back-link"
          aria-label="Volver al dashboard"
        >
          ←
        </button>
        <div>
          <h1 className="session-preview-title">¿Qué entrenas hoy?</h1>
          {plan.portada?.userGoal && (
            <p className="session-preview-subtitle">{plan.portada.userGoal}</p>
          )}
        </div>
      </div>

      {/* ── Day Selector ── */}
      <div className="session-preview-day-scroller">
        {plan.trainingDays.map((day, idx) => {
          const hasExercises = day.exercises?.length > 0;
          const isSelected = selectedDay === idx;
          return (
            <button
              key={day.id || idx}
              className={`session-preview-day-chip${isSelected ? ' selected' : ''}${!hasExercises ? ' empty' : ''}`}
              onClick={() => hasExercises && setSelectedDay(idx)}
              disabled={!hasExercises}
              aria-pressed={isSelected}
            >
              <span className="session-preview-day-chip-label">{day.name || `Día ${idx + 1}`}</span>
              <span className="session-preview-day-chip-count">
                {hasExercises ? `${day.exercises.length} ej.` : 'Descanso'}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Exercise Preview ── */}
      {selectedDayData && selectedDayData.exercises?.length > 0 ? (
        <div className="session-preview-exercises">
          <h2 className="session-preview-exercises-title">
            {selectedDayData.name || `Día ${(selectedDay ?? 0) + 1}`}
          </h2>

          <div className="session-preview-exercise-list">
            {selectedDayData.exercises.map((ex, idx) => {
              const vars = ex.variables || {};
              const series = vars['series de trabajo'] || vars['series'] || '?';
              const reps = vars['repeticiones'] || vars['reps'] || '?';
              const peso = (vars['peso'] || '').replace(/^🤖\s*/, '');
              const rir = vars['rir'];

              return (
                <div key={ex.id || idx} className="session-preview-exercise-row">
                  <span className="session-preview-exercise-num">{idx + 1}</span>
                  <div className="session-preview-exercise-info">
                    <span className="session-preview-exercise-name">{ex.nombre}</span>
                    <div className="session-preview-exercise-vars">
                      <span className="session-preview-var-chip">{series}×{reps}</span>
                      {peso && <span className="session-preview-var-chip accent">{peso}</span>}
                      {rir !== undefined && rir !== '' && (
                        <span className="session-preview-var-chip">RIR {rir}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="session-preview-rest-day">
          <div style={{ fontSize: '36px' }}>😴</div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', margin: '8px 0 0' }}>
            Día de descanso
          </p>
        </div>
      )}

      {/* ── CTA ── */}
      {selectedDayData && selectedDayData.exercises?.length > 0 && (
        <div className="session-preview-cta-wrapper">
          <button
            className="session-preview-start-btn"
            onClick={() => navigate(`/session/active/${selectedDay}`)}
            aria-label={`Empezar ${selectedDayData.name || `Día ${(selectedDay ?? 0) + 1}`}`}
          >
            <span>🚀</span>
            <span>Empezar sesión</span>
          </button>
          <p className="session-preview-cta-hint">
            {selectedDayData.exercises.length} ejercicios · ~
            {Math.round(selectedDayData.exercises.reduce((acc, ex) => {
              const vars = ex.variables || {};
              const seriesStr = vars['series de trabajo'] || vars['series'] || '3';
              const nSeries = parseInt(seriesStr.match(/^\d+/)?.[0] || '3', 10);
              const descansoStr = vars['descanso'] || '90';
              const descanso = parseInt(descansoStr.match(/^\d+/)?.[0] || '90', 10);
              return acc + (nSeries * 45) + (nSeries * descanso);
            }, 0) / 60)} min estimados
          </p>
        </div>
      )}
    </div>
  );
};

export default SessionPreview;
