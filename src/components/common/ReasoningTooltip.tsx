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
}) => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(prev => !prev);
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="reasoning-tooltip-wrapper">
      <div
        ref={triggerRef}
        className={`reasoning-tooltip-trigger${open ? ' active' : ''}`}
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`Ver razonamiento: ${title}`}
      >
        {trigger}
        <span className="reasoning-tooltip-icon" aria-hidden="true">∑</span>
      </div>

      {open && (
        <div
          ref={panelRef}
          className="reasoning-panel"
          role="tooltip"
          aria-label={title}
        >
          {/* Header */}
          <div className="reasoning-panel-header">
            <span className="reasoning-panel-icon">∑</span>
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
