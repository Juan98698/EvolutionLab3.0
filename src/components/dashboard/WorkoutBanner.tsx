import React, { useMemo } from 'react';
import { TrainingDay } from '../../types/database.types';

interface WorkoutBannerProps {
  /** Mapeo de días de la semana (0=Dom..6=Sáb) a índice del día de entrenamiento (-1 = descanso) */
  weekdayMapping: Record<string, number>;
  /** Lista de días de entrenamiento con sus ejercicios */
  trainingDays: TrainingDay[];
  /** Fecha de inicio del plan (ISO string YYYY-MM-DD) */
  startDate?: string;
  /** Callback cuando el atleta hace clic en "Ver ejercicios" */
  onScrollToDay?: (dayIndex: number) => void;
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Banner inteligente "Tu entrenamiento de hoy".
 * 
 * Determina automáticamente si hoy es un día de entrenamiento o de descanso
 * usando el weekdayMapping del plan, muestra el nombre del día y el ciclo actual.
 */
export const WorkoutBanner: React.FC<WorkoutBannerProps> = ({
  weekdayMapping,
  trainingDays,
  startDate,
  onScrollToDay
}) => {
  const bannerData = useMemo(() => {
    // Verificar si hay algún día configurado de forma segura
    const hasConfig = weekdayMapping ? Object.values(weekdayMapping).some(v => Number(v) !== -1) : false;
    if (!hasConfig) return null;

    const hoy = new Date();
    const diaSemana = hoy.getDay();
    const diaIndex = (weekdayMapping && weekdayMapping[String(diaSemana)] !== undefined) ? Number(weekdayMapping[String(diaSemana)]) : -1;

    // Formatear la fecha de hoy
    const hoyStr = hoy.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    // Calcular semana del ciclo
    let cicloStr = '';
    if (startDate) {
      const start = new Date(startDate + 'T00:00:00');
      if (!isNaN(start.getTime())) {
        const diffDays = Math.floor((hoy.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
          const semana = Math.floor(diffDays / 7) + 1;
          cicloStr = `Semana ${semana} · ${diffDays + 1} días desde el inicio`;
        }
      }
    }

    // Obtener nombre del día
    const getDayName = (idx: number): string => {
      if (trainingDays && trainingDays[idx]) return trainingDays[idx].name;
      return `Día ${idx + 1}`;
    };

    if (diaIndex === -1) {
      // Día de descanso — buscar próximo entrenamiento
      let nextInfo = '';
      for (let i = 1; i <= 7; i++) {
        const nextDow = (diaSemana + i) % 7;
        const nextIdx = (weekdayMapping && weekdayMapping[String(nextDow)] !== undefined) ? Number(weekdayMapping[String(nextDow)]) : -1;
        if (nextIdx !== -1) {
          const nextName = getDayName(nextIdx);
          const nextDia = DIAS_SEMANA[nextDow];
          nextInfo = `Próximo: ${nextName} (${nextDia})`;
          break;
        }
      }

      return {
        isRestDay: true,
        hoyStr,
        cicloStr,
        nextInfo,
        dayName: '',
        diaIndex: -1
      };
    }

    return {
      isRestDay: false,
      hoyStr,
      cicloStr,
      nextInfo: '',
      dayName: getDayName(diaIndex),
      diaIndex
    };
  }, [weekdayMapping, trainingDays, startDate]);

  if (!bannerData) return null;

  const CalendarIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      style={{ marginRight: '6px', verticalAlign: '-1px' }}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );

  if (bannerData.isRestDay) {
    return (
      <div className="today-banner rest-day" style={{ display: 'block' }}>
        <div className="today-banner-title" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <CalendarIcon />
          {bannerData.hoyStr}
        </div>
        <div className="today-banner-day" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{ marginRight: '8px', verticalAlign: '-1px' }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 10" />
            <line x1="12" y1="2" x2="12" y2="4" />
          </svg>
          Hoy es día de descanso
        </div>
        <div className="today-banner-meta">
          {bannerData.cicloStr}
          {bannerData.nextInfo ? ` · ${bannerData.nextInfo}` : ''}
        </div>
      </div>
    );
  }

  return (
    <div className="today-banner" style={{ display: 'block' }}>
      <div className="today-banner-title" style={{ display: 'inline-flex', alignItems: 'center' }}>
        <CalendarIcon />
        Tu entrenamiento de hoy · {bannerData.hoyStr}
      </div>
      <div className="today-banner-day">{bannerData.dayName}</div>
      <div className="today-banner-meta">{bannerData.cicloStr}</div>
      <button
        className="today-banner-btn"
        onClick={() => onScrollToDay?.(bannerData.diaIndex)}
      >
        Ver ejercicios →
      </button>
    </div>
  );
};

export default WorkoutBanner;
