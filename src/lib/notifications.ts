import { Notification, Session, DEFAULT_OVERLOAD_CONFIG } from './overload';

export const DISMISSED_NOTIFS_KEY = 'evolution_dismissed_notifs';

export function getNotificationKey(n: Notification): string {
  return `${n.id}::${n.ejercicio || ''}`;
}

export interface NotificationsEmptyState {
  message: string;
  hint?: string;
}

export function getNotificationsEmptyState(
  sessions: Session[],
  minSesiones: number = DEFAULT_OVERLOAD_CONFIG.minSesiones
): NotificationsEmptyState | null {
  if (sessions.length === 0) {
    return {
      message: 'Aún no has registrado sesiones de entrenamiento.',
      hint: 'Usa Agregar sesión para registrar tu progreso y activar sugerencias de sobrecarga.',
    };
  }

  const perExercise = new Map<string, number>();
  for (const s of sessions) {
    perExercise.set(s.ejercicio, (perExercise.get(s.ejercicio) ?? 0) + 1);
  }

  const maxSessions = Math.max(...perExercise.values(), 0);

  if (maxSessions < minSesiones) {
    const remaining = minSesiones - maxSessions;
    return {
      message: `Registra al menos ${minSesiones} sesiones de un ejercicio para recibir sugerencias personalizadas.`,
      hint: `Te faltan ${remaining} sesión${remaining === 1 ? '' : 'es'} (máximo actual: ${maxSessions}).`,
    };
  }

  return null;
}

export function filterVisibleNotifications(
  notifications: Notification[],
  dismissedKeys: string[]
): Notification[] {
  const dismissed = new Set(dismissedKeys);
  return notifications.filter((n) => !dismissed.has(getNotificationKey(n)));
}
