import React from 'react';

interface NotificationsEmptyStateProps {
  message: string;
  hint?: string;
  onAddSession?: () => void;
}

export const NotificationsEmptyState: React.FC<NotificationsEmptyStateProps> = ({
  message,
  hint,
  onAddSession,
}) => (
  <div
    style={{
      background: 'var(--theme-badge-bg)',
      border: '1px solid var(--theme-border)',
      borderRadius: '12px',
      padding: '16px 18px',
      backdropFilter: 'blur(12px)',
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
      }}
    >
      <span style={{ fontSize: '18px', lineHeight: 1.2 }}>📊</span>
      <div style={{ flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontFamily: "'Orbitron', sans-serif",
            fontWeight: 700,
            fontSize: '13px',
            color: 'var(--theme-primary, #00d4ff)',
            letterSpacing: '0.3px',
          }}
        >
          Motor de progresión
        </p>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'rgba(255, 255, 255, 0.85)',
          }}
        >
          {message}
        </p>
        {hint && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: '12px',
              lineHeight: 1.45,
              color: 'rgba(255, 255, 255, 0.55)',
            }}
          >
            {hint}
          </p>
        )}
        {onAddSession && (
          <button
            type="button"
            onClick={onAddSession}
            style={{
              marginTop: '12px',
              background: 'var(--theme-badge-bg)',
              border: '1px solid var(--theme-border)',
              borderRadius: '8px',
              color: 'var(--theme-primary)',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: "'Orbitron', sans-serif",
              cursor: 'pointer',
            }}
          >
            + Agregar sesión
          </button>
        )}
      </div>
    </div>
  </div>
);

export default NotificationsEmptyState;
