import React from 'react';
import { TrainingDay, GlobalVariable } from '../../types/database.types';
import ExerciseList from './ExerciseList';

interface WorkoutCardProps {
  day: TrainingDay;
  globalVariables: GlobalVariable[];
  variableDefinitions: Record<string, string>;
  checkedExerciseIds: string[];
  onToggleCheck: (exerciseId: string) => void;
  onShowGuide?: (name: string, description: string) => void;
  isTrainerMode?: boolean;
  onRemoveDay?: (dayId: string) => void;
  onChangeDayName?: (dayId: string, newName: string) => void;
  onAddExercise?: (dayId: string) => void;
}

/**
 * Componente que renderiza una tarjeta de día de entrenamiento (day-card).
 * Admite tanto el modo Cliente (vista estática) como el modo Entrenador (renombrar, eliminar día, añadir ejercicio).
 */
export const WorkoutCard: React.FC<WorkoutCardProps> = ({
  day,
  globalVariables,
  variableDefinitions,
  checkedExerciseIds,
  onToggleCheck,
  onShowGuide,
  isTrainerMode = false,
  onRemoveDay,
  onChangeDayName,
  onAddExercise
}) => {
  return (
    <div className="day-card" data-day-id={day.id}>
      <div className="day-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div className="day-title" style={{ flexGrow: 1 }}>
          {!isTrainerMode ? (
            <span
              className="static-day-name"
              style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}
            >
              {day.name}
            </span>
          ) : (
            <input
              type="text"
              className="day-name-input"
              value={day.name}
              onChange={(e) => onChangeDayName?.(day.id, e.target.value)}
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: '1.2rem',
                fontWeight: 700,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: 'white',
                padding: '4px 8px',
                width: '100%',
                maxWidth: '300px'
              }}
            />
          )}
        </div>

        {isTrainerMode && onRemoveDay && (
          <button
            className="btn-remove-day"
            onClick={() => onRemoveDay(day.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#ef4444',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: "'Orbitron', sans-serif"
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: '6px' }}
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Eliminar día
          </button>
        )}
      </div>

      {/* Lista de ejercicios */}
      <ExerciseList
        exercises={day.exercises}
        dayId={day.id}
        globalVariables={globalVariables}
        variableDefinitions={variableDefinitions}
        checkedExerciseIds={checkedExerciseIds}
        onToggleCheck={onToggleCheck}
        onShowGuide={onShowGuide}
      />

      {/* Render placeholders for missing exercises to ensure three slots per day */}
      {day.exercises.length < 3 &&
        Array.from({ length: 3 - day.exercises.length }).map((_, idx) => (
          <div
            key={`placeholder-${idx}`}
            className="exercise placeholder"
            style={{
              padding: '8px',
              marginBottom: '8px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px dashed rgba(255,255,255,0.2)',
              borderRadius: '6px',
              color: '#aaa',
              fontFamily: "'Orbitron', sans-serif",
            }}
          >
            ejercicio {day.exercises.length + idx + 1}
          </div>
        ))}
      
      {isTrainerMode && onAddExercise && (
        <div className="exercise-actions" style={{ marginTop: '15px' }}>
          <button
            className="btn-sm btn-add-ex"
            onClick={() => onAddExercise(day.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              color: '#10b981',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: "'Orbitron', sans-serif"
            }}
          >
            ➕ Añadir ejercicio
          </button>
        </div>
      )}
    </div>
  );
};

export default WorkoutCard;
