import React from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
}

/**
 * Notificación Toast Sutil, Flotante y Glassmorphic.
 * Diseño compacto de alta gama que no bloquea la pantalla ni estira su tamaño.
 */
export const Toast: React.FC<ToastProps> = ({ message, type, visible }) => {
  if (!visible) return null;

  const accentColor =
    type === 'success'
      ? '#10b981'
      : type === 'error'
      ? '#ef4444'
      : '#00d4ff';

  const borderColor =
    type === 'success'
      ? 'rgba(16, 185, 129, 0.35)'
      : type === 'error'
      ? 'rgba(239, 68, 68, 0.35)'
      : 'rgba(0, 212, 255, 0.35)';

  const shadowGlow =
    type === 'success'
      ? '0 8px 24px rgba(16, 185, 129, 0.22), 0 2px 10px rgba(0, 0, 0, 0.5)'
      : type === 'error'
      ? '0 8px 24px rgba(239, 68, 68, 0.22), 0 2px 10px rgba(0, 0, 0, 0.5)'
      : '0 8px 24px rgba(0, 212, 255, 0.22), 0 2px 10px rgba(0, 0, 0, 0.5)';

  const icon =
    type === 'success'
      ? '✓'
      : type === 'error'
      ? '✕'
      : 'ℹ';

  return (
    <div
      id="toast"
      className="show"
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: '16px',
        left: '50%',
        bottom: 'auto',
        height: 'auto',
        minHeight: 'auto',
        maxHeight: 'none',
        transform: 'translateX(-50%)',
        zIndex: 9999999,
        background: 'rgba(11, 15, 25, 0.94)',
        color: '#f8fafc',
        padding: '10px 18px',
        borderRadius: '30px',
        boxShadow: shadowGlow,
        border: `1px solid ${borderColor}`,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: '12.5px',
        fontWeight: 600,
        textAlign: 'left',
        maxWidth: 'min(90vw, 420px)',
        width: 'max-content',
        lineHeight: 1.4,
        letterSpacing: '0.2px',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        pointerEvents: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        boxSizing: 'border-box',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: `rgba(${type === 'success' ? '16, 185, 129' : type === 'error' ? '239, 68, 68' : '0, 212, 255'}, 0.18)`,
          color: accentColor,
          fontSize: '11px',
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span>{message}</span>
    </div>
  );
};

export default Toast;
