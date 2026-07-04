// @vitest-environment happy-dom
import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor, cleanup } from '@testing-library/react';
import { useModalA11y } from '../useModalA11y';

afterEach(() => {
  cleanup();
});

/** Componente de prueba: un botón que abre un "modal" con 2 botones adentro. */
function TestHarness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
    onClose?.();
  };
  const dialogRef = useModalA11y<HTMLDivElement>({ isOpen: open, onClose: close });

  return (
    <div>
      <button onClick={() => setOpen(true)}>abrir trigger</button>
      {open && (
        <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1} data-testid="dialog">
          <button>primero</button>
          <button>segundo</button>
        </div>
      )}
    </div>
  );
}

describe('useModalA11y', () => {
  it('mueve el foco al primer elemento enfocable del modal al abrirse', async () => {
    render(<TestHarness />);
    fireEvent.click(screen.getByText('abrir trigger'));

    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe('primero');
    });
  });

  it('atrapa el Tab: desde el último elemento, Tab vuelve al primero', async () => {
    render(<TestHarness />);
    fireEvent.click(screen.getByText('abrir trigger'));

    const last = await screen.findByText('segundo');
    last.focus();
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(document, { key: 'Tab' });

    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe('primero');
    });
  });

  it('atrapa el Shift+Tab: desde el primer elemento, vuelve al último', async () => {
    render(<TestHarness />);
    fireEvent.click(screen.getByText('abrir trigger'));

    const first = await screen.findByText('primero');
    await waitFor(() => expect(document.activeElement).toBe(first));

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

    await waitFor(() => {
      expect(document.activeElement?.textContent).toBe('segundo');
    });
  });

  it('cierra el modal al presionar Escape', async () => {
    const onClose = vi.fn();
    render(<TestHarness onClose={onClose} />);
    fireEvent.click(screen.getByText('abrir trigger'));

    await screen.findByTestId('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restaura el foco al elemento que lo tenía antes de abrir el modal', async () => {
    render(<TestHarness />);
    const trigger = screen.getByText('abrir trigger');
    trigger.focus();
    fireEvent.click(trigger);

    await screen.findByTestId('dialog');
    // El foco ya se movió adentro del modal
    await waitFor(() => expect(document.activeElement).not.toBe(trigger));

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });
});
