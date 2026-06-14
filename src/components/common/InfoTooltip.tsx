import React, { useState, useCallback } from 'react';

interface InfoTooltipProps {
  /** Título que se muestra en la cabecera del tooltip */
  title: string;
  /** Texto descriptivo que se muestra en el cuerpo del tooltip */
  body: string;
  /** Tamaño del icono en píxeles (por defecto 16px) */
  size?: number;
}

/**
 * Componente reutilizable de botón de información ⓘ con sheet-style modal.
 * Reutiliza el sistema de tooltip existente (.tooltip-overlay / .tooltip-sheet).
 * Diseñado para ser sutil y elegante, sin interrumpir el flujo visual de la UI.
 */
export const InfoTooltip: React.FC<InfoTooltipProps> = React.memo(({ title, body, size = 16 }) => {
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }, []);

  const handleClose = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
  }, []);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setOpen(false);
    }
  }, []);

  return (
    <>
      <button
        type="button"
        className="info-tooltip-trigger"
        onClick={handleOpen}
        aria-label={`Información: ${title}`}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(9, size - 5),
        }}
      >
        i
      </button>

      {open && (
        <div
          className={`tooltip-overlay${open ? ' open' : ''}`}
          onClick={handleOverlayClick}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="tooltip-sheet">
            <button
              type="button"
              className="tooltip-sheet-close"
              onClick={handleClose}
              aria-label="Cerrar"
            >
              ✕
            </button>
            <div className="tooltip-sheet-title">
              <span style={{ fontSize: '1.1em' }}>ⓘ</span>
              {title}
            </div>
            <div className="tooltip-sheet-body">{body}</div>
          </div>
        </div>
      )}
    </>
  );
});

InfoTooltip.displayName = 'InfoTooltip';

export default InfoTooltip;
