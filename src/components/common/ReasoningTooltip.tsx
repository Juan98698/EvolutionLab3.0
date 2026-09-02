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
  /** Optional exercise / subtitle name (e.g. "Press plano en máquina hammer") */
  exerciseSubtitle?: string;
  /** Optional human-friendly explanation for the athlete */
  humanExplanation?: string;
  /** Optional actionable mission / session goal for the athlete */
  sessionGoal?: string;
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
 * Shows clear human explanations for athletes while providing an optional
 * collapsible accordion for exact mathematical formulas and scientific citations.
 */
export const ReasoningTooltip: React.FC<ReasoningTooltipProps> = React.memo(({
  trigger,
  title,
  exerciseSubtitle,
  humanExplanation,
  sessionGoal,
  steps,
  source,
  confidence,
  result,
  recommendation,
  icon = '∑',
  showTriggerIcon = true,
}) => {
  const [open, setOpen] = useState(false);
  const [showDetails, setShowDetails] = useState<boolean>(!humanExplanation);
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

            {/* Header con título y subtítulo */}
            <div className="reasoning-panel-header" style={{ paddingRight: '36px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="reasoning-panel-icon" style={{ fontSize: '18px' }}>{icon}</span>
                  <span className="reasoning-panel-title" style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.4px', color: '#e2e8f0' }}>
                    {title}
                  </span>
                  {confidence && (
                    <span className={`reasoning-confidence reasoning-confidence-${confidence}`}>
                      {confidence === 'high' ? '● Directo' : '◐ Estimado'}
                    </span>
                  )}
                </div>
                {exerciseSubtitle && (
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, paddingLeft: '26px' }}>
                    {exerciseSubtitle}
                  </span>
                )}
              </div>
            </div>

            {/* Result Hero Banner */}
            {result && (
              <div
                className="reasoning-panel-result"
                style={{
                  background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.12), rgba(167, 139, 250, 0.1))',
                  border: '1px solid rgba(0, 212, 255, 0.35)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#67e8f9', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  🎯 Valor Calibrado
                </span>
                <span style={{ fontSize: '16px', fontWeight: 900, color: '#c2ff00', fontFamily: "'Orbitron', monospace", filter: 'drop-shadow(0 0 6px rgba(194, 255, 0, 0.35))' }}>
                  {result}
                </span>
              </div>
            )}

            {/* Explicación Humana y Clara */}
            {humanExplanation && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '10px',
                width: '100%',
                boxSizing: 'border-box',
                whiteSpace: 'normal'
              }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                  💬 ¿Por qué este valor?
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.92)', lineHeight: 1.5, whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                  {humanExplanation}
                </div>
              </div>
            )}

            {/* Objetivo de la Sesión */}
            {sessionGoal && (
              <div style={{
                background: 'rgba(234, 179, 8, 0.06)',
                border: '1px solid rgba(234, 179, 8, 0.25)',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '10px',
                width: '100%',
                boxSizing: 'border-box',
                whiteSpace: 'normal'
              }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                  ⚡ Objetivo de la Sesión
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.5, whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                  {sessionGoal}
                </div>
              </div>
            )}

            {/* Pauta del Entrenador / Motor */}
            {recommendation && (
              <div
                className="reasoning-panel-recommendation"
                style={{
                  margin: '0 0 10px 0',
                  fontSize: '11px',
                  color: '#fde047',
                  lineHeight: 1.45,
                  padding: '8px 12px',
                  background: 'rgba(251, 191, 36, 0.08)',
                  borderRadius: '8px',
                  borderLeft: '3px solid #f59e0b',
                  width: '100%',
                  boxSizing: 'border-box',
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word'
                }}
              >
                💡 <strong>Pauta:</strong> {recommendation}
              </div>
            )}

            {/* Desglose Matemático y Fórmulas (Colapsable / Opcional) */}
            {steps && steps.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowDetails(prev => !prev)}
                  style={{
                    background: 'rgba(167, 139, 250, 0.08)',
                    border: '1px solid rgba(167, 139, 250, 0.2)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: '#c4b5fd',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📐</span>
                    <span>{showDetails ? 'Ocultar cálculo matemático' : 'Ver cálculo matemático y fórmula'}</span>
                  </span>
                  <span style={{ fontSize: '10px', transition: 'transform 0.2s', transform: showDetails ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    ▶
                  </span>
                </button>

                {showDetails && (
                  <div style={{
                    marginTop: '8px',
                    padding: '12px 14px',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(167, 139, 250, 0.25)',
                    borderRadius: '10px',
                    animation: 'reasoningFadeIn 0.2s ease'
                  }}>
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

                    {/* Source */}
                    {source && (
                      <div className="reasoning-panel-source" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)' }}>
                        📚 {source}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Botón de acción principal */}
            <button
              type="button"
              onClick={handleClose}
              style={{
                width: '100%',
                marginTop: '16px',
                background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(123, 47, 247, 0.35) 100%)',
                border: '1px solid rgba(0, 212, 255, 0.5)',
                borderRadius: '12px',
                color: '#fff',
                padding: '12px',
                fontSize: '12px',
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 700,
                letterSpacing: '0.8px',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0, 212, 255, 0.2)',
                transition: 'all 0.2s'
              }}
            >
              ✓ ¡A ENTRENAR!
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
