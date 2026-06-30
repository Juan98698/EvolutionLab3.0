// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { VolumeTracker } from '../VolumeTracker';
const mockTrainingDays = [
  {
    id: 'day-1',
    name: 'Día 1: Pecho',
    exercises: [
      {
        nombre: 'Press de banca plano con barra',
        grupo_muscular: 'Pecho',
        variables: {
          'series de trabajo': '4',
          'repeticiones': '10',
          'rir': '2',
        }
      }
    ]
  }
];

describe('VolumeTracker Component', () => {
  afterEach(cleanup);

  it('should render weekly volume details for hypertrophy mode', () => {
    render(
      <VolumeTracker
        trainingDays={mockTrainingDays as any}
        weeklyTargets={{ Pecho: 10 }}
        athleteLevel="intermedio"
        blockObjective="hipertrofia"
      />
    );

    // Hypertrophy tracker should display the muscle group and total series (4)
    expect(screen.getByText('Pecho')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
  });

  it('should render weekly volume details for strength mode in NL', () => {
    render(
      <VolumeTracker
        trainingDays={mockTrainingDays as any}
        weeklyTargets={{}}
        athleteLevel="intermedio"
        blockObjective="fuerza"
      />
    );

    // In strength mode, Press de banca plano con barra maps to "Empuje horizontal" pattern and total NL (28)
    expect(screen.getByText(/empuje horizontal/i)).toBeDefined();
    expect(screen.getByText('28')).toBeDefined();
  });

  it('should toggle expanded details when item is clicked', () => {
    render(
      <VolumeTracker
        trainingDays={mockTrainingDays as any}
        weeklyTargets={{ Pecho: 10 }}
        athleteLevel="intermedio"
        blockObjective="hipertrofia"
      />
    );

    // Verify detail is not present initially
    expect(screen.queryByText('MRV 26')).toBeNull();

    // Click the row to expand details
    const row = screen.getByText('Pecho');
    fireEvent.click(row);

    // Details for exercises in that group should expand/reveal
    expect(screen.getByText('MRV 26')).toBeDefined();
    expect(screen.getByText(/Faltan/)).toBeDefined();
  });
});
