import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /**
   * UI de reemplazo cuando algo se rompe adentro. Si no se pasa, se usa
   * el fallback genérico de `DefaultFallback` más abajo.
   */
  fallback?: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode);
  /** Etiqueta corta para identificar en consola/logs qué boundary atrapó el error (ej. "ActiveSession"). */
  label?: string;
  /** Se llama además de mostrar el fallback — punto de enganche para mandar el error a un servicio externo en el futuro. */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Error Boundary genérico y reutilizable.
 *
 * React solo puede atrapar errores de render con un componente de clase
 * (no existe un hook equivalente) — por eso este es el único componente
 * de clase del proyecto, es intencional.
 *
 * Uso:
 *   <ErrorBoundary label="ActiveSession — lista de ejercicios">
 *     <ListaDeEjercicios />
 *   </ErrorBoundary>
 *
 * Con fallback y botón de reintentar personalizados:
 *   <ErrorBoundary
 *     label="GamificacionPanel"
 *     fallback={(error, reset) => <MiFallback error={error} onRetry={reset} />}
 *   >
 *     <GamificacionPanel />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Punto único donde, en el futuro, se puede enganchar un servicio de
    // error tracking (Sentry, LogRocket, etc.) sin tocar cada boundary.
    console.error(`[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ''}]`, error, info.componentStack);
    this.props.onError?.(error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (typeof this.props.fallback === 'function') {
      return this.props.fallback(error, this.reset);
    }
    if (this.props.fallback) return this.props.fallback;

    return <DefaultFallback error={error} onRetry={this.reset} label={this.props.label} />;
  }
}

const DefaultFallback: React.FC<{ error: Error; onRetry: () => void; label?: string }> = ({
  error,
  onRetry,
  label,
}) => (
  <div
    role="alert"
    style={{
      background: 'rgba(239, 68, 68, 0.06)',
      border: '1px solid rgba(239, 68, 68, 0.25)',
      borderRadius: '14px',
      padding: '20px',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      textAlign: 'center',
    }}
  >
    <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
    <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
      {label ? `Esta sección (${label}) tuvo un problema` : 'Algo salió mal en esta sección'}
    </div>
    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginBottom: '14px' }}>
      El resto de la app sigue funcionando. Podés intentar de nuevo.
    </div>
    {import.meta.env.DEV && (
      <pre
        style={{
          fontSize: '10px',
          color: 'rgba(255,255,255,0.4)',
          textAlign: 'left',
          background: 'rgba(0,0,0,0.3)',
          padding: '8px',
          borderRadius: '8px',
          overflow: 'auto',
          maxHeight: '120px',
          marginBottom: '14px',
        }}
      >
        {error.message}
      </pre>
    )}
    <button
      type="button"
      onClick={onRetry}
      style={{
        background: 'rgba(239, 68, 68, 0.15)',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        color: '#fff',
        borderRadius: '8px',
        padding: '8px 16px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      Reintentar
    </button>
  </div>
);

export default ErrorBoundary;
