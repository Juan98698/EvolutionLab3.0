import { describe, it, expect } from 'vitest';
import {
  getNotificationKey,
  getNotificationsEmptyState,
  filterVisibleNotifications,
} from '../notifications';
import { Notification, Session } from '../overload';

const sesion = (
  id: string,
  fecha: string,
  ejercicio: string
): Session => ({
  id,
  fecha,
  ejercicio,
  peso: 100,
  repsArray: [5, 5, 5],
  rpe_rir: 2,
});

describe('notifications helpers', () => {
  it('builds stable notification keys', () => {
    const n: Notification = {
      id: 'subir_peso_reps',
      ejercicio: 'Sentadilla',
      tipo: 'success',
      mensaje: 'Subir peso',
    };
    expect(getNotificationKey(n)).toBe('subir_peso_reps::Sentadilla');
  });

  it('returns empty state when there are no sessions', () => {
    const state = getNotificationsEmptyState([]);
    expect(state).not.toBeNull();
    expect(state?.message).toContain('no has registrado sesiones');
  });

  it('returns empty state when max sessions per exercise is below minimum', () => {
    const sessions = [
      sesion('1', '2023-01-01', 'Squat'),
      sesion('2', '2023-01-08', 'Squat'),
    ];
    const state = getNotificationsEmptyState(sessions, 3);
    expect(state).not.toBeNull();
    expect(state?.message).toContain('3 sesiones');
    expect(state?.hint).toContain('Te faltan 1 sesión');
  });

  it('returns null when enough sessions exist', () => {
    const sessions = [
      sesion('1', '2023-01-01', 'Squat'),
      sesion('2', '2023-01-08', 'Squat'),
      sesion('3', '2023-01-15', 'Squat'),
    ];
    expect(getNotificationsEmptyState(sessions, 3)).toBeNull();
  });

  it('filters dismissed notifications', () => {
    const notifications: Notification[] = [
      { id: 'subir_peso_reps', ejercicio: 'Squat', tipo: 'success', mensaje: 'A' },
      { id: 'mantener_peso', ejercicio: 'Bench', tipo: 'info', mensaje: 'B' },
    ];
    const dismissed = ['subir_peso_reps::Squat'];
    const visible = filterVisibleNotifications(notifications, dismissed);
    expect(visible).toHaveLength(1);
    expect(visible[0].ejercicio).toBe('Bench');
  });
});
