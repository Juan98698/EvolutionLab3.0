import React from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
}

/**
 * Sistema reactivo de notificaciones Toast.
 * Coincide visualmente con el sistema legacy de #toast.
 */
export const Toast: React.FC<ToastProps> = ({ message, type, visible }) => {
  if (!visible) return null;

  const bgGradient =
    type === 'success'
      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
      : type === 'error'
      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
      : 'linear-gradient(135deg, #00d4ff 0%, #3b82f6 100%)';

  const borderColor =
    type === 'success'
      ? 'rgba(16, 185, 129, 0.4)'
      : type === 'error'
      ? 'rgba(239, 68, 68, 0.4)'
      : 'rgba(0, 212, 255, 0.4)';

  const shadowGlow =
    type === 'success'
      ? '0 10px 30px rgba(16, 185, 129, 0.4)'
      : type === 'error'
      ? '0 10px 30px rgba(239, 68, 68, 0.4)'
      : '0 10px 30px rgba(0, 212, 255, 0.4)';

  return (
    <div
      id="toast"
      className="show"
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999999,
        background: bgGradient,
        color: '#ffffff',
        padding: '12px 24px',
        borderRadius: '50px',
        boxShadow: shadowGlow,
        border: `1px solid ${borderColor}`,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: '13px',
        fontWeight: 700,
        textAlign: 'center',
        maxWidth: 'calc(100vw - 32px)',
        width: 'max-content',
        lineHeight: 1.4,
        letterSpacing: '0.3px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        boxSizing: 'border-box',
      }}
    >
      {message}
    </div>
  );
};

export default Toast;
