// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Componente que rompe a propósito en el render, para probar el boundary. */
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('boom de prueba');
  }
  return <div>todo bien</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React (y nuestro propio componentDidCatch) loguean a console.error a
    // propósito cuando atrapan un error — es el comportamiento esperado en
    // estos tests, no algo que deba ensuciar la salida del test runner.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renderiza los hijos normalmente cuando no hay error', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('todo bien')).toBeTruthy();
  });

  it('muestra el fallback genérico cuando un hijo lanza un error en el render', () => {
    render(
      <ErrorBoundary label="Sección de prueba">
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Sección de prueba/)).toBeTruthy();
    expect(screen.queryByText('todo bien')).toBeNull();
  });

  it('llama a onError con el error atrapado', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('boom de prueba');
  });

  it('el botón "Reintentar" vuelve a intentar renderizar los hijos', () => {
    let shouldThrow = true;
    const ThrowsOnce = () => <Bomb shouldThrow={shouldThrow} />;

    render(
      <ErrorBoundary>
        <ThrowsOnce />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeTruthy();

    // Se "arregla" la condición que rompía (como si el usuario recargara datos)
    shouldThrow = false;
    fireEvent.click(screen.getByText('Reintentar'));

    expect(screen.getByText('todo bien')).toBeTruthy();
  });

  it('acepta un fallback personalizado como render-prop, con acceso al error y a reset', () => {
    render(
      <ErrorBoundary
        fallback={(error, reset) => (
          <div>
            <span>fallback custom: {error.message}</span>
            <button onClick={reset}>volver a intentar</button>
          </div>
        )}
      >
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('fallback custom: boom de prueba')).toBeTruthy();
  });

  it('acepta un fallback estático (no función)', () => {
    render(
      <ErrorBoundary fallback={<div>fallback fijo</div>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('fallback fijo')).toBeTruthy();
  });

  it('un boundary no atrapa errores de un hermano fuera de él (aislamiento entre secciones)', () => {
    render(
      <div>
        <ErrorBoundary label="Sección A">
          <Bomb shouldThrow={true} />
        </ErrorBoundary>
        <ErrorBoundary label="Sección B">
          <Bomb shouldThrow={false} />
        </ErrorBoundary>
      </div>
    );

    // La sección A muestra el fallback...
    expect(screen.getByText(/Sección A/)).toBeTruthy();
    // ...pero la sección B sigue funcionando normalmente.
    expect(screen.getByText('todo bien')).toBeTruthy();
  });
});
