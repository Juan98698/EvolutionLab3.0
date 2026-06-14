import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseRestTimerReturn {
  /** Segundos restantes del cronómetro */
  secondsLeft: number;
  /** Duración total configurada en segundos */
  totalSeconds: number;
  /** Si el cronómetro está corriendo */
  isRunning: boolean;
  /** Si el cronómetro terminó (llegó a 0) */
  isFinished: boolean;
  /** Progreso de 0 a 1 (útil para barras circulares y animaciones) */
  progress: number;
  /** Iniciar el cronómetro con una duración en segundos */
  start: (durationSeconds: number) => void;
  /** Pausar el cronómetro */
  pause: () => void;
  /** Reanudar el cronómetro desde donde se pausó */
  resume: () => void;
  /** Reiniciar completamente el cronómetro */
  reset: () => void;
}

/**
 * Hook de cronómetro de descanso robusto para dispositivos móviles.
 *
 * Usa marcas de tiempo absolutas (`Date.now()`) en vez de decrementar un
 * contador en cada tick del setInterval. Esto garantiza que si la app va
 * a segundo plano (pantalla bloqueada, pestaña inactiva en Safari/iOS),
 * al regresar, el tiempo restante se recalcule con precisión milimétrica.
 *
 * @param onFinish - Callback que se ejecuta cuando el cronómetro llega a 0.
 *                   Útil para reproducir audio o disparar notificaciones.
 */
export function useRestTimer(onFinish?: () => void): UseRestTimerReturn {
  // Marca de tiempo Unix (en ms) en la que el cronómetro debe terminar
  const [endTime, setEndTime] = useState<number | null>(null);
  // Duración total configurada (para calcular progreso)
  const [totalSeconds, setTotalSeconds] = useState<number>(0);
  // Segundos restantes calculados
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  // Estado del cronómetro
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  // Tiempo restante cuando se pausó (para reanudar)
  const pausedRemainingRef = useRef<number>(0);
  // Ref para el callback onFinish (evitar re-renders innecesarios)
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  // Intervalo que recalcula los segundos restantes basándose en Date.now()
  useEffect(() => {
    if (!isRunning || endTime === null) return;

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        setIsRunning(false);
        setIsFinished(true);
        setSecondsLeft(0);
        onFinishRef.current?.();
      }
    };

    // Ejecutar inmediatamente al montar (para recalcular al volver de background)
    tick();

    const intervalId = setInterval(tick, 250); // 250ms para mayor responsividad visual

    // Listener de visibilidad: recalcular cuando el usuario regresa a la pestaña
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isRunning, endTime]);

  const start = useCallback((durationSeconds: number) => {
    const duration = Math.max(1, Math.round(durationSeconds));
    setTotalSeconds(duration);
    setSecondsLeft(duration);
    setEndTime(Date.now() + duration * 1000);
    setIsRunning(true);
    setIsFinished(false);
    pausedRemainingRef.current = 0;
  }, []);

  const pause = useCallback(() => {
    if (!isRunning || endTime === null) return;
    const remaining = Math.max(0, (endTime - Date.now()) / 1000);
    pausedRemainingRef.current = remaining;
    setIsRunning(false);
    setEndTime(null);
  }, [isRunning, endTime]);

  const resume = useCallback(() => {
    if (isRunning || pausedRemainingRef.current <= 0) return;
    const remaining = pausedRemainingRef.current;
    setEndTime(Date.now() + remaining * 1000);
    setIsRunning(true);
    pausedRemainingRef.current = 0;
  }, [isRunning]);

  const reset = useCallback(() => {
    setEndTime(null);
    setSecondsLeft(0);
    setTotalSeconds(0);
    setIsRunning(false);
    setIsFinished(false);
    pausedRemainingRef.current = 0;
  }, []);

  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;

  return {
    secondsLeft,
    totalSeconds,
    isRunning,
    isFinished,
    progress,
    start,
    pause,
    resume,
    reset
  };
}
