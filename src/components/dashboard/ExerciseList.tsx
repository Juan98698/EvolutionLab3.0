import React from 'react';
import { Exercise, GlobalVariable } from '../../types/database.types';
import ExerciseCard from './ExerciseCard';

interface ExerciseListProps {
  exercises: Exercise[];
  dayId: string;
  globalVariables: GlobalVariable[];
  variableDefinitions: Record<string, string>;
  checkedExerciseIds: string[];
  onToggleCheck: (exerciseId: string) => void;
  onShowGuide?: (name: string, description: string) => void;
}

/**
 * Componente que renderiza la lista de ejercicios de un día de entrenamiento.
 */
export const ExerciseList: React.FC<ExerciseListProps> = ({
  exercises,
  dayId,
  globalVariables,
  variableDefinitions,
  checkedExerciseIds,
  onToggleCheck,
  onShowGuide
}) => {
  if (!exercises || exercises.length === 0) {
    return (
      <div className="no-exercises" style={{ padding: '20px', textAlign: 'center', color: 'var(--text2)' }}>
        No hay ejercicios programados para este día.
      </div>
    );
  }

  return (
    <div className="exercises-list" data-day-id={dayId}>
      {exercises.map((exercise, index) => {
        const isChecked = checkedExerciseIds.includes(exercise.id);
        return (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            index={index}
            dayId={dayId}
            globalVariables={globalVariables}
            variableDefinitions={variableDefinitions}
            isChecked={isChecked}
            onToggleCheck={onToggleCheck}
            onShowGuide={onShowGuide}
          />
        );
      })}
    </div>
  );
};

export default ExerciseList;
