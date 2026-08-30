import React, { useState, useCallback, useRef, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReasoningStep {
  label: string;      // "1RM registrado"
  value: string;      // "118.6 kg"
  formula?: string;   // "30 / (30 + 8 + 2) = 75%"
  highlight?: boolean; // Resaltar este paso con color de acento
}

interface ReasoningTooltipProps {
  /** The element that triggers the tooltip (e.g., the weight input/display) */
  trigger: React.ReactNode;
  /** Title shown at the top of the reasoning panel */
  title: string;
  /** Array of reasoning steps showing the calculation breakdown */
  steps: ReasoningStep[];
  /** Scientific source/citation for the formula used */
  source?: string;
  /** Optional confidence indicator */
  confidence?: 'high' | 'medium';
  /** Optional final result to highlight */
  result?: string;
  /** Optional recommendation text */
  recommendation?: string;
  /** Optional custom icon (default: '∑') */
  icon?: string;
  /** Optional flag to show/hide the trailing trigger icon (default: true) */
  showTriggerIcon?: boolean;
}

/**
 * ReasoningTooltip — Displays transparent calculation reasoning.
 * 
 * Unlike InfoTooltip (which explains general concepts), this component
 * shows athlete-specific data and the exact formulas applied.
 * 
 * - Desktop: Click to toggle an inline panel below the trigger
 * - Mobile: Click to toggle the same inline panel
 * - Design: Dark semi-transparent background, monospaced numbers,
 *   formula icon (∑) instead of info icon (ⓘ)
 */
export const ReasoningTooltip: React.FC<ReasoningTooltipProps> = React.memo(({
  trigger,
  title,
  steps,
  source,
  confidence,
  result,
  recommendation,
  icon = '∑',
  showTriggerIcon = true,
}) => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(prev => !prev);
  }, []);

  const handleClose = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setOpen(false);
  }, []);

  // Close panel on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <div className="reasoning-tooltip-wrapper">
      <div
        ref={triggerRef}
        className={`reasoning-tooltip-trigger${open ? ' active' : ''}`}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(prev => !prev);
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`Ver razonamiento: ${title}`}
      >
        {trigger}
        {showTriggerIcon && (
          <span className="reasoning-tooltip-icon" aria-hidden="true">{icon}</span>
        )}
      </div>

      {open && (
        <div
          className="reasoning-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setOpen(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
        >
          <div
            ref={panelRef}
            className="reasoning-panel"
            role="tooltip"
            aria-label={title}
          >
            {/* Botón de cierre superior */}
            <button
              type="button"
              className="reasoning-panel-close-btn"
              onClick={handleClose}
              aria-label="Cerrar panel de razonamiento"
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                zIndex: 10
              }}
            >
              ✕
            </button>

            {/* Header */}
            <div className="reasoning-panel-header" style={{ paddingRight: '32px' }}>
              <span className="reasoning-panel-icon">{icon}</span>
              <span className="reasoning-panel-title">{title}</span>
              {confidence && (
                <span className={`reasoning-confidence reasoning-confidence-${confidence}`}>
                  {confidence === 'high' ? '● Directo' : '◐ Estimado'}
                </span>
              )}
            </div>

            {/* Steps */}
            <div className="reasoning-panel-steps">
              {steps.map((step, i) => (
                <div
                  key={i}
                  className={`reasoning-step${step.highlight ? ' reasoning-step-highlight' : ''}`}
                >
                  <span className="reasoning-step-label">{step.label}</span>
                  <span className="reasoning-step-value">{step.value}</span>
                  {step.formula && (
                    <span className="reasoning-step-formula">{step.formula}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Result */}
            {result && (
              <div className="reasoning-panel-result">
                <span className="reasoning-result-label">Resultado</span>
                <span className="reasoning-result-value">{result}</span>
              </div>
            )}

            {/* Recommendation */}
            {recommendation && (
              <div className="reasoning-panel-recommendation">
                💡 {recommendation}
              </div>
            )}

            {/* Source */}
            {source && (
              <div className="reasoning-panel-source">
                📚 {source}
              </div>
            )}

            {/* Botón de acción para cerrar */}
            <button
              type="button"
              onClick={handleClose}
              style={{
                width: '100%',
                marginTop: '16px',
                background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(123, 47, 247, 0.25) 100%)',
                border: '1px solid rgba(0, 212, 255, 0.4)',
                borderRadius: '10px',
                color: '#fff',
                padding: '10px',
                fontSize: '12px',
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 700,
                letterSpacing: '0.5px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              ✓ Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

ReasoningTooltip.displayName = 'ReasoningTooltip';

// ─── Helper: Build reasoning steps from a LoadPrescription ────────────────────

export interface LoadPrescriptionForTooltip {
  weight: number;
  exactWeight: number;
  pct1RM: number;
  oneRM: number;
  reps: number;
  rir: number;
  effectiveReps: number;
  roundingIncrement: number;
  formulaLabel: string;
  formulaExpression: string;
  source: string;
}

/**
 * Converts a LoadPrescription object into ReasoningStep[] for the tooltip.
 * This is a pure helper — no React dependency.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const buildLoadReasoningSteps = (lp: LoadPrescriptionForTooltip): ReasoningStep[] => {
  return [
    {
      label: '1RM registrado',
      value: `${lp.oneRM} kg`,
    },
    {
      label: 'Reps objetivo',
      value: `${lp.reps}`,
    },
    {
      label: 'RIR objetivo',
      value: `${lp.rir}`,
    },
    {
      label: 'Reps efectivas (reps + RIR)',
      value: `${lp.effectiveReps}`,
    },
    {
      label: 'Fórmula aplicada',
      value: lp.formulaLabel,
      formula: lp.formulaExpression,
      highlight: true,
    },
    {
      label: 'Carga exacta',
      value: `${lp.oneRM} × ${(lp.pct1RM * 100).toFixed(1)}% = ${lp.exactWeight} kg`,
    },
    {
      label: `Redondeo (→ ${lp.roundingIncrement} kg)`,
      value: `${lp.weight} kg`,
      highlight: true,
    },
  ];
};

// ─── Helper: Build reasoning steps from a StrengthVolumeEvaluation ───────────

export interface VolumeEvaluationForTooltip {
  currentNL: number;
  humanLabel: string;
  reasoning: string;
  thresholds: { mev: number; mavMin: number; mavMax: number; mrv: number };
  source: string;
  recommendation?: string;
}

/**
 * Converts a StrengthVolumeEvaluation into ReasoningStep[] for the tooltip.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const buildVolumeReasoningSteps = (ev: VolumeEvaluationForTooltip): ReasoningStep[] => {
  return [
    {
      label: 'NL★ actuales',
      value: `${ev.currentNL}`,
      highlight: true,
    },
    {
      label: 'MEV (Volumen Mínimo Efectivo)',
      value: `${ev.thresholds.mev} NL★`,
    },
    {
      label: 'MAV (Volumen Adaptativo Máximo)',
      value: `${ev.thresholds.mavMin}–${ev.thresholds.mavMax} NL★`,
    },
    {
      label: 'MRV (Volumen Máximo Recuperable)',
      value: `${ev.thresholds.mrv} NL★`,
    },
    {
      label: 'Estado',
      value: ev.humanLabel,
      highlight: true,
    },
  ];
};

export default ReasoningTooltip;
