// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import RMCalculatorModal from '../modals/RMCalculatorModal';

/**
 * Test de componente aislado para RMCalculatorModal.
 *
 * Cubre el contrato observable del modal de calculadora 1RM:
 *   1. Visibilidad: el modal solo se renderiza cuando isOpen=true
 *   2. Selector de unidad KG/LBS: cambia el label y resetea el resultado
 *   3. Cálculo del 1RM: validaciones de inputs, fórmulas Epley/Brzycki/Promedio
 *      y tabla de porcentajes de carga resultante
 *   4. Cierre: botón × y clic en overlay llaman onClose
 *
 * Sin dependencias de Supabase, sin getByTestId — solo contrato visible
 * (texto en pantalla, callbacks llamados).
 */

// Helper: renderiza el modal con mocks espiables
function renderModal(isOpen = true) {
  const onClose = vi.fn();
  const showToast = vi.fn();
  const utils = render(
    <RMCalculatorModal isOpen={isOpen} onClose={onClose} showToast={showToast} />
  );
  return { ...utils, onClose, showToast };
}

/**
 * Suite 1: Visibilidad del modal según la prop isOpen.
 * Garantiza que el componente no monta nada cuando está cerrado
 * y que muestra el título correcto cuando está abierto.
 */
describe('RMCalculatorModal — visibilidad', () => {
  afterEach(cleanup);

  it('isOpen=false → no renderiza nada (título ausente)', () => {
    renderModal(false);
    expect(screen.queryByText('CALCULADORA 1RM')).toBeNull();
  });

  it('isOpen=true → muestra el título "CALCULADORA 1RM"', () => {
    renderModal(true);
    expect(screen.getByText('CALCULADORA 1RM')).toBeDefined();
  });
});

/**
 * Suite 2: Selector de unidad KG / LBS.
 * Los botones son <button type="button"> con texto exacto 'KG' y 'LBS'.
 * Cambiar la unidad actualiza el label del campo de peso y resetea el resultado calculado.
 */
describe('RMCalculatorModal — selector de unidad KG / LBS', () => {
  afterEach(cleanup);

  it('estado inicial: el label muestra "PESO LEVANTADO (KG)"', () => {
    renderModal();
    expect(screen.getByText(/PESO LEVANTADO \(KG\)/i)).toBeDefined();
  });

  it('clic en botón "LBS" → el label cambia a "PESO LEVANTADO (LBS)"', () => {
    renderModal();
    fireEvent.click(screen.getByText('LBS'));
    expect(screen.getByText(/PESO LEVANTADO \(LBS\)/i)).toBeDefined();
    expect(screen.queryByText(/PESO LEVANTADO \(KG\)/i)).toBeNull();
  });

  it('clic en "LBS" y luego en "KG" → label vuelve a "PESO LEVANTADO (KG)"', () => {
    renderModal();
    fireEvent.click(screen.getByText('LBS'));
    fireEvent.click(screen.getByText('KG'));
    expect(screen.getByText(/PESO LEVANTADO \(KG\)/i)).toBeDefined();
    expect(screen.queryByText(/PESO LEVANTADO \(LBS\)/i)).toBeNull();
  });

  it('cambiar unidad resetea el resultado: tras calcular con Epley, clic en "LBS" hace desaparecer "1RM Estimado"', () => {
    renderModal();

    // Calcular con Epley
    const pesoInput = screen.getByPlaceholderText(/Ej: 80/);
    const repsInput = screen.getByPlaceholderText(/Ej: 5/);
    fireEvent.change(pesoInput, { target: { value: '80' } });
    fireEvent.change(repsInput, { target: { value: '5' } });

    const formulaSelect = document.getElementById('select1RMFormula') as HTMLSelectElement;
    fireEvent.change(formulaSelect, { target: { value: 'epley' } });

    fireEvent.click(screen.getByText('🧮 Calcular 1RM'));

    // El resultado debe estar visible
    expect(screen.getByText('1RM Estimado')).toBeDefined();

    // Cambiar la unidad resetea el resultado
    fireEvent.click(screen.getByText('LBS'));
    expect(screen.queryByText('1RM Estimado')).toBeNull();
  });
});

/**
 * Suite 3: Cálculo del 1RM.
 * Verifica validaciones de entrada, las tres fórmulas disponibles
 * y la tabla de porcentajes de carga (9 filas de datos).
 *
 * Matemáticas del componente:
 *   Epley:   rm = peso * (1 + reps / 30)
 *   Brzycki: rm = peso / (1.0278 - 0.0278 * reps)
 *   Promedio: rm = (epley + brzycki) / 2
 *
 * Para peso=80, reps=5:
 *   Epley:   80 * (1 + 5/30) = 80 * 1.1666… ≈ 93.33  → toFixed(1) = "93.3"
 *   Brzycki: 80 / (1.0278 - 0.0278*5) = 80 / 0.8888 ≈ 90.00 → toFixed(1) = "90.0"
 *   Promedio: (93.33 + 90.00) / 2 ≈ 91.67 → toFixed(1) = "91.7"
 */
describe('RMCalculatorModal — cálculo del 1RM', () => {
  afterEach(cleanup);

  it('inputs vacíos → submit → showToast llamado con mensaje que contiene "válidos", sin tabla', () => {
    const { showToast } = renderModal();

    const form = document.querySelector('form')!;
    fireEvent.submit(form);

    expect(showToast).toHaveBeenCalledTimes(1);
    expect((showToast.mock.calls[0][0] as string)).toMatch(/válidos/);
    expect(screen.queryByText('Tabla de Porcentajes de Carga')).toBeNull();
  });

  it('reps = "35" (> 30) → submit → showToast llamado con mensaje que contiene "30 repeticiones"', () => {
    const { showToast } = renderModal();

    const pesoInput = screen.getByPlaceholderText(/Ej: 80/);
    const repsInput = screen.getByPlaceholderText(/Ej: 5/);
    fireEvent.change(pesoInput, { target: { value: '80' } });
    fireEvent.change(repsInput, { target: { value: '35' } });

    const form = document.querySelector('form')!;
    fireEvent.submit(form);

    expect(showToast).toHaveBeenCalledTimes(1);
    expect((showToast.mock.calls[0][0] as string)).toMatch(/30 repeticiones/);
    expect(screen.queryByText('Tabla de Porcentajes de Carga')).toBeNull();
  });

  it('fórmula Epley (peso=80, reps=5) → muestra resultado que empieza por "93." y la tabla de porcentajes', () => {
    renderModal();

    const pesoInput = screen.getByPlaceholderText(/Ej: 80/);
    const repsInput = screen.getByPlaceholderText(/Ej: 5/);
    fireEvent.change(pesoInput, { target: { value: '80' } });
    fireEvent.change(repsInput, { target: { value: '5' } });

    const formulaSelect = document.getElementById('select1RMFormula') as HTMLSelectElement;
    fireEvent.change(formulaSelect, { target: { value: 'epley' } });

    fireEvent.click(screen.getByText('🧮 Calcular 1RM'));

    // 80 * (1 + 5/30) = 93.333... → toFixed(1) = "93.3"
    expect(screen.getAllByText(/93\./).length).toBeGreaterThan(0);
    expect(screen.getByText('Tabla de Porcentajes de Carga')).toBeDefined();
  });

  it('fórmula Brzycki (peso=80, reps=5) → muestra resultado que empieza por "90."', () => {
    renderModal();

    const pesoInput = screen.getByPlaceholderText(/Ej: 80/);
    const repsInput = screen.getByPlaceholderText(/Ej: 5/);
    fireEvent.change(pesoInput, { target: { value: '80' } });
    fireEvent.change(repsInput, { target: { value: '5' } });

    const formulaSelect = document.getElementById('select1RMFormula') as HTMLSelectElement;
    fireEvent.change(formulaSelect, { target: { value: 'brzycki' } });

    fireEvent.click(screen.getByText('🧮 Calcular 1RM'));

    // 80 / (1.0278 - 0.0278*5) = 80 / 0.8888 ≈ 90.00 → toFixed(1) = "90.0"
    expect(screen.getAllByText(/90\./).length).toBeGreaterThan(0);
  });

  it('fórmula Promedio (peso=80, reps=5) → muestra resultado que empieza por "91."', () => {
    renderModal();

    const pesoInput = screen.getByPlaceholderText(/Ej: 80/);
    const repsInput = screen.getByPlaceholderText(/Ej: 5/);
    fireEvent.change(pesoInput, { target: { value: '80' } });
    fireEvent.change(repsInput, { target: { value: '5' } });

    // El select ya está en 'promedio' por defecto, pero lo establecemos explícitamente
    const formulaSelect = document.getElementById('select1RMFormula') as HTMLSelectElement;
    fireEvent.change(formulaSelect, { target: { value: 'promedio' } });

    fireEvent.click(screen.getByText('🧮 Calcular 1RM'));

    // Promedio: (93.333 + 90.0) / 2 = 91.666... → toFixed(1) = "91.7"
    expect(screen.getAllByText(/91\./).length).toBeGreaterThan(0);
  });

  it('tras calcular con Epley → la tabla tiene exactamente 10 filas (1 thead + 9 tbody)', () => {
    renderModal();

    const pesoInput = screen.getByPlaceholderText(/Ej: 80/);
    const repsInput = screen.getByPlaceholderText(/Ej: 5/);
    fireEvent.change(pesoInput, { target: { value: '80' } });
    fireEvent.change(repsInput, { target: { value: '5' } });

    const formulaSelect = document.getElementById('select1RMFormula') as HTMLSelectElement;
    fireEvent.change(formulaSelect, { target: { value: 'epley' } });

    fireEvent.click(screen.getByText('🧮 Calcular 1RM'));

    // 1 tr de thead + 9 tr de tbody = 10 total
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(10);

    // Verificar que los porcentajes extremos están presentes
    expect(screen.getByText('100%')).toBeDefined();
    expect(screen.getByText('60%')).toBeDefined();
  });
});

/**
 * Suite 4: Comportamiento de cierre del modal.
 * El botón × (renderizado como &times; → "×") llama a onClose.
 * El clic en el overlay (#modal-1rm) también llama a onClose porque
 * el handler verifica e.target === e.currentTarget.
 */
describe('RMCalculatorModal — cierre', () => {
  afterEach(cleanup);

  it('botón "×" → clic → onClose llamado 1 vez', () => {
    const { onClose } = renderModal();

    fireEvent.click(screen.getByText('×'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clic en el overlay (#modal-1rm) → onClose llamado 1 vez', () => {
    const { onClose } = renderModal();

    // El overlay es el div raíz con id="modal-1rm". Al hacer click directamente
    // en él, e.target === e.currentTarget, por lo que el handler llama a onClose.
    const overlayDiv = document.getElementById('modal-1rm')!;
    fireEvent.click(overlayDiv);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
