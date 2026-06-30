// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GuidedPlanSetup } from '../GuidedPlanSetup';

describe('GuidedPlanSetup Component', () => {
  afterEach(cleanup);

  it('should progress through steps and call onComplete with correct parameters', () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();

    render(<GuidedPlanSetup onComplete={onComplete} onSkip={onSkip} />);

    // Step 1: Verify elements are present
    expect(screen.getByText('Paso 1 de 3')).toBeDefined();
    expect(screen.getByText('¿Qué quieres lograr en este bloque?')).toBeDefined();

    // Verify "Siguiente" is disabled initially
    const nextBtn = screen.getByText('Siguiente →');
    expect((nextBtn as HTMLButtonElement).disabled).toBe(true);

    // Select "Ganar músculo" (hipertrofia)
    fireEvent.click(screen.getByText('Ganar músculo'));
    expect((nextBtn as HTMLButtonElement).disabled).toBe(false);

    // Click "Siguiente" to move to Step 2
    fireEvent.click(nextBtn);

    // Step 2: Verify step 2 elements
    expect(screen.getByText('Paso 2 de 3')).toBeDefined();
    expect(screen.getByText('¿Cuál es el nivel y la disponibilidad del atleta?')).toBeDefined();

    // "Siguiente" should be disabled initially on Step 2 because level is not selected
    expect((nextBtn as HTMLButtonElement).disabled).toBe(true);

    // Select level "Intermedio"
    fireEvent.click(screen.getByText('Intermedio'));
    expect((nextBtn as HTMLButtonElement).disabled).toBe(false);

    // Change days to 5
    fireEvent.click(screen.getByText('5'));

    // Change weeks to 8 sem
    fireEvent.click(screen.getByText('8 sem'));

    // Click "Siguiente" to move to Step 3
    fireEvent.click(nextBtn);

    // Step 3: Verify confirmation page
    expect(screen.getByText('Paso 3 de 3')).toBeDefined();
    expect(screen.getByText('Tu plan base está listo para generarse')).toBeDefined();
    expect(screen.getByText('Ganar músculo')).toBeDefined();
    expect(screen.getByText('Intermedio')).toBeDefined();
    expect(screen.getByText('5 días')).toBeDefined();
    expect(screen.getByText('8 semanas')).toBeDefined();

    // Click "No, ir directo al plan"
    fireEvent.click(screen.getByText('No, ir directo al plan'));

    expect(onComplete).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledWith({
      objetivo: 'hipertrofia',
      nivel: 'intermedio',
      dias: 5,
      semanas: 8,
      wantsTour: false,
    });
  });

  it('should call onSkip when skip button is clicked', () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();

    render(<GuidedPlanSetup onComplete={onComplete} onSkip={onSkip} />);

    fireEvent.click(screen.getByText('Saltar y configurar manualmente'));
    expect(onSkip).toHaveBeenCalledOnce();
  });
});
