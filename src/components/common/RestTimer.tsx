import React, { useCallback, useRef, useEffect } from 'react';
import { useRestTimer } from '../../hooks/useRestTimer';

interface RestTimerProps {
  /** Duración del descanso en minutos (tal como viene de la variable del plan) */
  descansoMinutos: number;
  /** Callback opcional al terminar el cronómetro */
  onFinish?: () => void;
}

/**
 * Cronómetro de descanso entre series con barra circular SVG animada.
 *
 * Usa el hook useRestTimer (basado en Date.now()) para no perder precisión
 * cuando el móvil bloquea la pantalla o la pestaña va a segundo plano.
 */
export const RestTimer: React.FC<RestTimerProps> = ({ descansoMinutos, onFinish }) => {
  const totalSec = Math.max(1, Math.round(descansoMinutos * 60));

  const playFinishSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (_) { /* Silenciar error si el AudioContext no está disponible */ }

    // Vibrar si el dispositivo lo soporta
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }

    onFinish?.();
  }, [onFinish]);

  const timer = useRestTimer(playFinishSound);
  const timerRef = useRef<HTMLDivElement>(null);

  // Hacer scroll suave al timer cuando se inicia
  useEffect(() => {
    if (timer.isRunning && timerRef.current) {
      timerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [timer.isRunning]);

  const circumference = 2 * Math.PI * 54;
  const offset = circumference * (1 - timer.progress);

  // Color dinámico de la barra de progreso
  const getProgressColor = () => {
    if (timer.secondsLeft <= 5) return '#10b981';  // Verde: ¡casi listo!
    if (timer.secondsLeft <= 10) return '#f0a830'; // Ámbar: quedan pocos segundos
    return '#00d4ff'; // Cyan: corriendo normalmente
  };

  const formatDisplay = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Estado: No iniciado
  if (!timer.isRunning && !timer.isFinished && timer.secondsLeft === 0) {
    return (
      <button
        className="rest-timer-btn"
        onClick={() => timer.start(totalSec)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '12px'
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ marginRight: '5px', verticalAlign: '-1.5px' }}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
          <line x1="12" y1="2" x2="12" y2="4" />
        </svg>
        Iniciar descanso ({formatDisplay(totalSec)})
      </button>
    );
  }

  // Estado: Terminado
  if (timer.isFinished) {
    return (
      <div className="rest-timer-active" ref={timerRef}>
        <div
          className="rest-timer-done"
          style={{
            animation: 'timerPulse 0.5s ease',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981"
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            style={{ marginRight: '6px', verticalAlign: '-1px' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          ¡Listo! Siguiente serie
        </div>
        <div className="rest-timer-actions" style={{ marginTop: '12px' }}>
          <button
            className="timer-reset"
            onClick={() => { timer.reset(); timer.start(totalSec); }}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ marginRight: '4px', verticalAlign: '-1px' }}>
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Repetir descanso
          </button>
        </div>
      </div>
    );
  }

  // Estado: Corriendo o Pausado
  return (
    <div className="rest-timer-active" ref={timerRef}>
      <div className="rest-timer-label">Descanso entre series</div>
      <div className="rest-timer-circle">
        <svg viewBox="0 0 120 120">
          <circle className="timer-bg" cx="60" cy="60" r="54" />
          <circle
            className="timer-progress"
            cx="60" cy="60" r="54"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              stroke: getProgressColor(),
              transition: 'stroke-dashoffset 0.25s linear, stroke 0.3s ease'
            }}
          />
        </svg>
        <div className="rest-timer-time">{formatDisplay(timer.secondsLeft)}</div>
      </div>
      <div className="rest-timer-actions">
        <button
          className="timer-pause"
          onClick={() => timer.isRunning ? timer.pause() : timer.resume()}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {timer.isRunning ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ marginRight: '4px', verticalAlign: '-1px' }}>
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
              Pausar
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ marginRight: '4px', verticalAlign: '-1px' }}>
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Reanudar
            </>
          )}
        </button>
        <button
          className="timer-reset"
          onClick={() => timer.reset()}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ marginRight: '4px', verticalAlign: '-1px' }}>
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          Reiniciar
        </button>
      </div>
    </div>
  );
};

export default RestTimer;
