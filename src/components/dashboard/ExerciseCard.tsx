import React from 'react';
import { Exercise, GlobalVariable } from '../../types/database.types';
import RestTimer from '../common/RestTimer';

interface ExerciseCardProps {
  exercise: Exercise;
  dayId: string;
  globalVariables: GlobalVariable[];
  variableDefinitions: Record<string, string>;
  isChecked: boolean;
  onToggleCheck: (exerciseId: string) => void;
  onShowGuide?: (name: string, description: string) => void;
  index?: number;
}

/**
 * Tarjeta de ejercicio para la vista del atleta (MODO_CLIENTE).
 * Incluye:
 * - Checkbox de completado con persistencia en localStorage
 * - Badges de variables (series, reps, tempo, RIR, descanso, peso)
 * - Imagen/GIF del ejercicio
 * - Enlace a video explicativo
 * - Botón de guía teórica
 * - Cronómetro de descanso integrado (RestTimer)
 */
export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  dayId,
  globalVariables,
  variableDefinitions,
  isChecked,
  onToggleCheck,
  onShowGuide,
  index
}) => {
  // Detectar dinámicamente si está online u offline
  const [isOnline, setIsOnline] = React.useState<boolean>(() => navigator.onLine);

  React.useEffect(() => {
    let timeoutId: any = null;

    const handleOnline = () => {
      // Debounce de 3 segundos para evitar rebotes de señal móvil al pasar offline
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (navigator.onLine) {
          setIsOnline(true);
        }
      }, 3000);
    };

    const handleOffline = () => {
      if (timeoutId) clearTimeout(timeoutId);
      setIsOnline(false); // Transición instantánea a offline
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Obtener el valor de descanso en minutos para el RestTimer
  const getDescansoMinutes = (): number => {
    for (const v of globalVariables) {
      const varId = v.id.trim().toLowerCase();
      const isDescanso = varId === 'descanso' || v.label.toLowerCase().includes('descanso');
      if (isDescanso) {
        const rawVal = exercise.variables[v.id];
        const val = rawVal !== undefined && rawVal !== '' ? rawVal : v.defaultValue;
        if (val !== undefined && val !== '') {
          const parsed = parseFloat(String(val));
          if (isNaN(parsed)) return 0;
          // Si el valor es mayor o igual a 10, asumimos que está en segundos (ej. 90, 120, 180) y lo convertimos a minutos
          return parsed >= 10 ? parsed / 60 : parsed;
        }
      }
    }
    return 0;
  };

  const descansoMin = getDescansoMinutes();

  // Determinar la imagen a mostrar (preferir imagen estática de alta calidad estando online, y el GIF animado estando offline)
  const imageUrl = isOnline
    ? (exercise.image_url || exercise.gif_url || '')
    : (exercise.gif_url || exercise.image_url || '');

  // Escapar texto para seguridad
  const escapeHtml = (str: string): string => {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  // Mapa de iconos SVG por variable
  const iconMap: Record<string, string> = {
    'series de aproximacion': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>',
    'series de trabajo': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>',
    'repeticiones': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5h11M6.5 4h-2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2M17.5 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/></svg>',
    'tempo': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    'rir': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/></svg>',
    'descanso': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 10"></polyline><line x1="12" y1="2" x2="12" y2="4"></line></svg>',
    'peso': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
  };

  const defaultIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>';

  const displayName = (exercise.nombre || '').trim() || (index !== undefined ? `Ejercicio ${index + 1}` : 'Ejercicio');

  return (
    <div
      className={`exercise-card${isChecked ? ' completed' : ''}`}
      data-exercise-id={exercise.id}
      data-day-id={dayId}
    >
      <div className="exercise-header">
        {/* Checkbox */}
        <div
          className={`exercise-checkbox client-only-checkbox${isChecked ? ' checked' : ''}`}
          data-ex-id={exercise.id}
          data-day-id={dayId}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCheck(exercise.id);
          }}
        />

        {/* Nombre del ejercicio */}
        <div className="exercise-name" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <span
            className="static-exercise-name"
            style={{ fontSize: '1.1rem', fontWeight: 600 }}
          >
            {displayName}
          </span>
          {exercise.nombre_original && exercise.nombre_original.trim().toLowerCase() !== displayName.trim().toLowerCase() && (
            <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Base: {exercise.nombre_original}
            </span>
          )}
        </div>

        {/* Imagen / GIF del ejercicio */}
        {imageUrl && (
          <div className="img-zone">
            <div className="img-preview-container">
              <img
                className="exercise-media img-preview"
                src={imageUrl}
                alt={`Vista previa de ${displayName}`}
                style={{ display: 'block' }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="vars-badges" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
        {globalVariables.map((v) => {
          const rawVal = exercise.variables[v.id];
          const val = rawVal !== undefined && rawVal !== '' ? rawVal : v.defaultValue;
          const value = String(val ?? '').trim();
          if (!value || value === '(sin definir)') return null;

          const varId = v.id.trim().toLowerCase();
          const cleanLabel = v.label.toLowerCase().replace(/\(.*?\)/g, '').trim();
          const icon = iconMap[varId] || iconMap[cleanLabel] || defaultIcon;
          const isDescanso = varId === 'descanso' || cleanLabel.includes('descanso');

          let displayValue = value;
          if (isDescanso) {
            const parsed = parseFloat(value);
            if (!isNaN(parsed)) {
              if (parsed >= 10) {
                // Si el valor está en segundos, lo mostramos formateado en minutos
                const mins = Math.floor(parsed / 60);
                const secs = parsed % 60;
                displayValue = secs > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${mins}`;
              } else {
                displayValue = `${parsed}`;
              }
            }
          }

          const definition = variableDefinitions[varId] || variableDefinitions[cleanLabel] || '';

          return (
            <div
              key={v.id}
              className={`var-badge${isDescanso ? ' badge-descanso' : ''}`}
              data-descanso-val={isDescanso ? value : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                color: 'white'
              }}
            >
              <span
                className="var-badge-icon"
                style={{ marginRight: '4px' }}
                dangerouslySetInnerHTML={{ __html: icon }}
              />
              <span
                className="var-badge-label"
                style={{ fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginRight: '3px' }}
              >
                {escapeHtml(v.label)}:
              </span>
              {' '}{escapeHtml(displayValue)}
              {definition && (
                <span
                  className="var-tooltip-trigger"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); onShowGuide?.(v.label, definition); }}
                  style={{
                    cursor: 'pointer',
                    fontSize: '10px',
                    color: '#f97316',
                    marginLeft: '2px',
                    fontWeight: 'bold'
                  }}
                >
                  ⓘ
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Cronómetro de descanso */}
      {descansoMin > 0 && <RestTimer descansoMinutos={descansoMin} />}

      {/* Notas de Progresión */}
      {exercise.progression_notes && exercise.progression_notes.trim() && (
        <div
          className="progression-notes-box"
          style={{
            marginTop: '12px',
            background: 'rgba(249, 115, 22, 0.06)',
            border: '1px solid rgba(249, 115, 22, 0.25)',
            borderRadius: '10px',
            padding: '12px 14px',
            color: 'white',
            fontSize: '12.5px',
            lineHeight: '1.5',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <span style={{ display: 'inline-flex', color: '#ff7e2e' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </span>
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              color: '#ff7e2e',
              fontFamily: "'Orbitron', sans-serif",
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>
              Progreso y Pauta del Entrenador
            </span>
          </div>
          <div style={{ whiteSpace: 'pre-line', color: 'rgba(255, 255, 255, 0.95)', fontSize: '12.5px' }}>
            {exercise.progression_notes}
          </div>
        </div>
      )}

      {/* Acciones: Video y Guía Teórica */}
      {(exercise.video_url || (exercise as any).description) && (
        <div
          className="exercise-actions-row"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}
        >
          {exercise.video_url && (
            isOnline ? (
              <a
                href={exercise.video_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 14px',
                  background: 'rgba(59, 130, 246, 0.12)',
                  borderRadius: '40px',
                  color: '#60a5fa',
                  textDecoration: 'none',
                  fontWeight: 600,
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  transition: 'all 0.3s ease',
                  fontSize: '10px',
                  fontFamily: "'Orbitron', sans-serif",
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ marginRight: '6px', verticalAlign: '-1px' }}>
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                Ver video
              </a>
            ) : (
              <button
                disabled
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 14px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '40px',
                  color: 'rgba(255, 255, 255, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  fontWeight: 600,
                  fontSize: '10px',
                  fontFamily: "'Orbitron', sans-serif",
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  cursor: 'not-allowed'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ marginRight: '6px', verticalAlign: '-1px', opacity: 0.5 }}>
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                Offline, video no disponible
              </button>
            )
          )}

          {(exercise as any).description && (
            <button
              className="btn-sm btn-desc"
              onClick={() => onShowGuide?.(displayName, (exercise as any).description)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 14px',
                background: 'rgba(123, 47, 247, 0.12)',
                borderRadius: '40px',
                color: '#a78bfa',
                border: '1px solid rgba(123, 47, 247, 0.35)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '10px',
                transition: 'all 0.3s ease',
                fontFamily: "'Orbitron', sans-serif",
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ marginRight: '6px', verticalAlign: '-1px' }}>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              Abrir guía teórica
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ExerciseCard;
