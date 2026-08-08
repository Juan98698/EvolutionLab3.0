import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';

interface ConfirmOptions {
  /** Texto del botón de confirmar. Por defecto "Confirmar". */
  confirmText?: string;
  /** Texto del botón de cancelar. Por defecto "Cancelar". */
  cancelText?: string;
  /** Título corto del diálogo. Por defecto "Confirmar acción". */
  title?: string;
  /** true = estilo rojo/destructivo (borrar, reemplazar datos). Por defecto false. */
  danger?: boolean;
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

interface PendingConfirm extends Required<ConfirmOptions> {
  message: string;
  resolve: (value: boolean) => void;
}

const ConfirmDialogContext = createContext<ConfirmFn | null>(null);

/**
 * Reemplazo de window.confirm() con la estética glassmorphism de la app.
 *
 * Uso (idéntico en espíritu al window.confirm original, solo con await):
 *   const confirm = useConfirm();
 *   if (!(await confirm('¿Seguro que deseas eliminar este día?', { danger: true }))) return;
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error('useConfirm debe usarse dentro de un ConfirmDialogProvider');
  }
  return ctx;
}

export const ConfirmDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  // Evita que una promesa vieja resuelva dos veces si el usuario hace doble click.
  const resolvedRef = useRef(false);

  const confirm = useCallback<ConfirmFn>((message, options) => {
    return new Promise<boolean>((resolve) => {
      resolvedRef.current = false;
      setPending({
        message,
        title: options?.title ?? 'Confirmar acción',
        confirmText: options?.confirmText ?? 'Confirmar',
        cancelText: options?.cancelText ?? 'Cancelar',
        danger: options?.danger ?? false,
        resolve,
      });
    });
  }, []);

  const close = useCallback((result: boolean) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    pending?.resolve(result);
    setPending(null);
  }, [pending]);

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmDialogView
          message={pending.message}
          title={pending.title}
          confirmText={pending.confirmText}
          cancelText={pending.cancelText}
          danger={pending.danger}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      )}
    </ConfirmDialogContext.Provider>
  );
};

interface ConfirmDialogViewProps {
  message: string;
  title: string;
  confirmText: string;
  cancelText: string;
  danger: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialogView: React.FC<ConfirmDialogViewProps> = ({
  message, title, confirmText, cancelText, danger, onConfirm, onCancel
}) => {
  const dialogRef = useModalA11y<HTMLDivElement>({ isOpen: true, onClose: onCancel });
  const accentColor = danger ? '#ef4444' : 'var(--theme-primary, #00d4ff)';

  return (
    <div
      role="presentation"
      onClick={onCancel}
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        width: '100%', height: '100%',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1000000, padding: '20px', boxSizing: 'border-box'
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(10, 15, 30, 0.97)',
          border: `1px solid ${danger ? 'rgba(239, 68, 68, 0.25)' : 'rgba(0, 212, 255, 0.15)'}`,
          borderRadius: '18px',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
          color: 'white',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '24px 24px 16px 24px' }}>
          <h2
            id="confirm-dialog-title"
            style={{
              margin: '0 0 10px 0',
              fontSize: '15px',
              fontWeight: 800,
              fontFamily: "'Orbitron', sans-serif",
              letterSpacing: '0.5px',
              color: accentColor
            }}
          >
            {danger ? '⚠️ ' : ''}{title}
          </h2>
          <p
            id="confirm-dialog-message"
            style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.5, color: 'rgba(255,255,255,0.8)' }}
          >
            {message}
          </p>
        </div>

        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          background: 'rgba(0, 0, 0, 0.15)'
        }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.8)',
              padding: '10px 18px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              background: accentColor,
              border: 'none',
              borderRadius: '8px',
              color: danger ? 'white' : '#000',
              padding: '10px 18px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: danger ? '0 4px 12px rgba(239, 68, 68, 0.3)' : '0 4px 12px rgba(0, 212, 255, 0.2)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialogProvider;
