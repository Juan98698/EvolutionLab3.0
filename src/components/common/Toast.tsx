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
  const classNames = [
    'show',
    type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : 'toast-info'
  ].join(' ');

  return (
    <div
      id="toast"
      className={visible ? classNames : ''}
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
    >
      {message}
    </div>
  );
};

export default Toast;
