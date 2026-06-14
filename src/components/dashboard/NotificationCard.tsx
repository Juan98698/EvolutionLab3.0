import React from 'react';

export interface Notification {
  id: string;
  ejercicio: string;
  tipo: 'info' | 'warning' | 'error' | 'success';
  titulo?: string;
  mensaje: string;
}

interface NotificationCardProps {
  notif: Notification;
  onDismiss?: () => void;
}

const typeColors: Record<Notification['tipo'], { bg: string; border: string; icon: string; title: string }> = {
  info: {
    bg: 'rgba(14, 165, 233, 0.15)',
    border: 'rgba(14, 165, 233, 0.3)',
    icon: 'ℹ️',
    title: '#7dd3fc',
  },
  warning: {
    bg: 'rgba(245, 158, 11, 0.15)',
    border: 'rgba(245, 158, 11, 0.3)',
    icon: '⚠️',
    title: '#fcd34d',
  },
  error: {
    bg: 'rgba(239, 68, 68, 0.15)',
    border: 'rgba(239, 68, 68, 0.3)',
    icon: '❌',
    title: '#fca5a5',
  },
  success: {
    bg: 'rgba(34, 197, 94, 0.15)',
    border: 'rgba(34, 197, 94, 0.3)',
    icon: '✅',
    title: '#86efac',
  },
};

export const NotificationCard: React.FC<NotificationCardProps> = ({ notif, onDismiss }) => {
  const { bg, border, icon, title: titleColor } = typeColors[notif.tipo];

  return (
    <div
      className="notification-enter"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: '12px',
        padding: '12px 16px',
        margin: '10px 0',
        backdropFilter: 'blur(12px)',
        fontFamily: "'Orbitron', sans-serif",
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: notif.titulo || onDismiss ? '6px' : 0,
        }}
      >
        {(notif.titulo || icon) && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 700,
              fontSize: '12px',
              color: titleColor,
              letterSpacing: '0.3px',
            }}
          >
            <span>{icon}</span>
            {notif.titulo}
          </span>
        )}
        {onDismiss && (
          <button
            type="button"
            aria-label="Descartar notificación"
            onClick={onDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.45)',
              cursor: 'pointer',
              fontSize: '16px',
              lineHeight: 1,
              padding: '2px 4px',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        )}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: '13px',
          lineHeight: 1.5,
          color: 'rgba(255, 255, 255, 0.88)',
          fontWeight: 500,
        }}
      >
        {notif.mensaje}
      </p>
    </div>
  );
};

export default NotificationCard;
