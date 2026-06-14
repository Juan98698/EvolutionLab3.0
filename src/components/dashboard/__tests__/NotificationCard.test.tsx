// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotificationCard, { Notification } from '../NotificationCard';

describe('NotificationCard', () => {
  const notif: Notification = {
    id: 'test1',
    ejercicio: 'Squat',
    tipo: 'success',
    titulo: 'Progreso',
    mensaje: 'Buen trabajo en la serie',
  };

  it('renders the message with correct styling', () => {
    render(<NotificationCard notif={notif} />);
    expect(screen.getByText(notif.mensaje)).toBeDefined();
    expect(screen.getByText('✅')).toBeDefined();
  });

  it('renders dismiss button and calls handler', () => {
    const onDismiss = vi.fn();
    render(<NotificationCard notif={notif} onDismiss={onDismiss} />);
    screen.getByLabelText('Descartar notificación').click();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
