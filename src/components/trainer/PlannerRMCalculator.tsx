import { useState } from 'react';
import type { TrainingDay } from '../../types/database.types';
import { useModalA11y } from '../../hooks/useModalA11y';
import { EstimateNotice } from '../common/EstimateNotice';

type Formula = 'epley_brzycki_avg' | 'epley' | 'brzycki';
type Props = { trainingDays: TrainingDay[]; marks: Record<string, number>; onClose: () => void; onApply: (lift: string, kg: number, formula: Formula) => void; showToast: (message: string, type: 'success' | 'error' | 'info') => void };
export function PlannerRMCalculator({ trainingDays, marks, onClose, onApply, showToast }: Props) {
  const [calcWeight, setCalcWeight] = useState(80);
  const [calcReps, setCalcReps] = useState(8);
  const [calcRIR, setCalcRIR] = useState(2);
  const [calcSelectedLift, setCalcSelectedLift] = useState('press de banca');
  const [calcUnit, setCalcUnit] = useState<'kg' | 'lbs'>('kg');
  const [calcFormula, setCalcFormula] = useState<'promedio' | 'epley' | 'brzycki'>('promedio');
  const dialogRef = useModalA11y({ isOpen: true, onClose });
  return (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 8, 16, 0.88)', backdropFilter: 'none',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          fontFamily: "'Inter', sans-serif"
        }}>
          <div ref={dialogRef} className="studio-planner-rm" role="dialog" aria-modal="true" aria-label="Calculadora de 1RM" tabIndex={-1} style={{
            background: 'var(--studio-surface)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: 'none',
            borderRadius: '24px', maxWidth: '480px', width: '100%', padding: '28px',
            color: 'white', position: 'relative'
          }}>
            <button
              type="button"
              aria-label="Cerrar calculadora"
              onClick={() => onClose()}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'none', border: 'none', color: '#a4b0a8',
                fontSize: '18px', cursor: 'pointer', outline: 'none'
              }}
            >
              ✕
            </button>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🧮</div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#91b6a1', fontFamily: "'Inter', sans-serif" }}>
                Calculadora de 1RM
              </h3><EstimateNotice />
              <p style={{ fontSize: '12px', color: '#a4b0a8', margin: '4px 0 0 0' }}>
                Estima tu Fuerza Máxima (1RM) a partir de una serie real y aplícala de inmediato a tu plan.
              </p>
            </div>

            {/* Unit Switcher & Formula Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '14px', marginBottom: '18px', textAlign: 'left' }}>
              <div>
                <label style={{ fontSize: 'var(--text-label-size)', fontWeight: 'var(--text-label-weight)', color: 'var(--text-label-color)', fontFamily: 'var(--text-label-family)', letterSpacing: 'var(--text-label-spacing)', textTransform: 'var(--text-label-transform)', display: 'block', marginBottom: '8px' }}>
                  UNIDAD
                </label>
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '3px' }}>
                  <button
                    type="button"
                    onClick={() => setCalcUnit('kg')}
                    style={{
                      flex: 1, border: 'none', borderRadius: '6px', padding: '5px 8px', fontSize: '12px',
                      fontFamily: "'Inter', sans-serif", fontWeight: 700, cursor: 'pointer',
                      background: calcUnit === 'kg' ? 'var(--studio-accent)' : 'transparent',
                      color: calcUnit === 'kg' ? '#000' : '#a4b0a8', transition: 'all 0.15s'
                    }}
                  >
                    KG
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalcUnit('lbs')}
                    style={{
                      flex: 1, border: 'none', borderRadius: '6px', padding: '5px 8px', fontSize: '12px',
                      fontFamily: "'Inter', sans-serif", fontWeight: 700, cursor: 'pointer',
                      background: calcUnit === 'lbs' ? 'var(--studio-accent)' : 'transparent',
                      color: calcUnit === 'lbs' ? '#000' : '#a4b0a8', transition: 'all 0.15s'
                    }}
                  >
                    LBS
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="planner-rm-formula" style={{ fontSize: 'var(--text-label-size)', fontWeight: 'var(--text-label-weight)', color: 'var(--text-label-color)', fontFamily: 'var(--text-label-family)', letterSpacing: 'var(--text-label-spacing)', textTransform: 'var(--text-label-transform)', display: 'block', marginBottom: '8px' }}>
                  FÓRMULA DE ESTIMACIÓN
                </label>
                <select
                  id="planner-rm-formula"
                  value={calcFormula}
                  onChange={(e) => setCalcFormula(e.target.value as any)}
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', height: '32px', boxSizing: 'border-box'
                  }}
                >
                  <option value="promedio">Promedio Automático (Recomendado)</option>
                  <option value="epley">Epley (1985)</option>
                  <option value="brzycki">Brzycki (1993)</option>
                </select>
              </div>
            </div>

            {/* Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              <div>
                <label htmlFor="planner-rm-weight" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#a4b0a8', marginBottom: '6px', textTransform: 'none' }}>
                  Peso ({calcUnit})
                </label>
                <input
                  id="planner-rm-weight" min="0" step="any"
                  type="number"
                  value={calcWeight || ''}
                  onChange={(e) => setCalcWeight(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', boxSizing: 'border-box' }}
                  placeholder={calcUnit === 'kg' ? '80' : '175'}
                />
              </div>
              <div>
                <label htmlFor="planner-rm-reps" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#a4b0a8', marginBottom: '6px', textTransform: 'none' }}>Reps hechas</label>
                <input
                  id="planner-rm-reps" min="1" max="30"
                  type="number"
                  value={calcReps || ''}
                  onChange={(e) => setCalcReps(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', boxSizing: 'border-box' }}
                  placeholder="8"
                />
              </div>
              <div>
                <label htmlFor="planner-rm-rir" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#a4b0a8', marginBottom: '6px', textTransform: 'none' }}>RIR de la serie</label>
                <input
                  id="planner-rm-rir" min="0" max="29"
                  type="number"
                  value={calcRIR ?? ''}
                  onChange={(e) => setCalcRIR(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', boxSizing: 'border-box' }}
                  placeholder="2"
                />
              </div>
            </div>

            {/* Calculations Breakdown */}
            {(() => {
              const effective = calcReps + (calcRIR || 0);
              if (!Number.isFinite(calcWeight) || calcWeight <= 0 || calcReps < 1 || calcRIR < 0 || !Number.isFinite(effective) || effective > 30) return <p>Ingresa un peso positivo y entre 1 y 30 repeticiones efectivas (repeticiones + RIR).</p>;
              const epleyVal = calcWeight * (1 + effective / 30);
              const denom = 1.0278 - 0.0278 * effective;
              const brzyckiVal = denom > 0.01 ? (calcWeight / denom) : calcWeight;
              const avgVal = (epleyVal + brzyckiVal) / 2;

              // Determinar qué valor y etiqueta mostrar según la fórmula seleccionada
              let selectedVal = avgVal;
              let formulaLabel = '1RM Promedio Estimado';
              if (calcFormula === 'epley') {
                selectedVal = epleyVal;
                formulaLabel = '1RM Epley Estimado';
              } else if (calcFormula === 'brzycki') {
                selectedVal = brzyckiVal;
                formulaLabel = '1RM Brzycki Estimado';
              }

              const roundedVal = Math.round(selectedVal * 10) / 10;
              const secondaryUnit = calcUnit === 'kg' ? 'lbs' : 'kg';
              const secondaryVal = calcUnit === 'kg' ? roundedVal * 2.20462 : roundedVal / 2.20462;

              // Collect exercises for applying
              const baseLifts = ['sentadilla', 'press de banca', 'peso muerto'];
              const planExerciseNames = trainingDays
                .flatMap(d => d.exercises)
                .map(ex => ex.nombre.trim().toLowerCase())
                .filter(n => n.length > 0);
              const existingMarcaKeys = Object.keys(marks);
              const allLifts = [...new Set([...baseLifts, ...planExerciseNames, ...existingMarcaKeys])];

              return (
                <div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px', marginBottom: '18px', fontSize: '12px', lineHeight: '1.4' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: '#a4b0a8', fontWeight: calcFormula === 'epley' ? 700 : 400 }}>
                        Fórmula Epley (1985): {calcFormula === 'epley' && '🎯'}
                      </span>
                      <strong style={{ color: calcFormula === 'epley' ? '#91b6a1' : '#fff' }}>
                        {(Math.round(epleyVal * 10) / 10).toFixed(1)} {calcUnit}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: '#a4b0a8', fontWeight: calcFormula === 'brzycki' ? 700 : 400 }}>
                        Fórmula Brzycki (1993): {calcFormula === 'brzycki' && '🎯'}
                      </span>
                      <strong style={{ color: calcFormula === 'brzycki' ? '#91b6a1' : '#fff' }}>
                        {(Math.round(brzyckiVal * 10) / 10).toFixed(1)} {calcUnit}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', marginTop: '8px', fontSize: '13px', alignItems: 'baseline' }}>
                      <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{formulaLabel}:</span>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ color: '#91b6a1', fontSize: '16px' }}>{roundedVal.toFixed(1)} {calcUnit}</strong>
                        <div style={{ fontSize: '12px', color: '#a4b0a8', fontFamily: "'Inter', sans-serif", marginTop: '2px' }}>
                          ≈ {secondaryVal.toFixed(1)} {secondaryUnit}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tabla de Equivalencias de Cargas */}
                  <div style={{ marginTop: '16px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#a5b4fc', marginBottom: '8px', textTransform: 'none', letterSpacing: '0.08em', textAlign: 'left', fontFamily: "'Inter', sans-serif" }}>
                      📋 TABLA DE PORCENTAJES DE CARGA (Basada en {calcFormula.toUpperCase()})
                    </div>
                    <div style={{
                      maxHeight: '170px',
                      overflowY: 'auto',
                      background: 'rgba(0,0,0,0.25)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '12px',
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', fontFamily: "'Inter', sans-serif" }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#a4b0a8', fontSize: '8.5px', textTransform: 'none', letterSpacing: '0.05em' }}>
                            <th style={{ padding: '8px 10px' }}>%</th>
                            <th style={{ padding: '8px 10px' }}>Carga ({calcUnit})</th>
                            <th style={{ padding: '8px 10px' }}>Equivalencia</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Reps Sugeridas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { pct: 100, reps: '1 rep' },
                            { pct: 95,  reps: '2 reps' },
                            { pct: 90,  reps: '4 reps' },
                            { pct: 85,  reps: '6 reps' },
                            { pct: 80,  reps: '8 reps' },
                            { pct: 75,  reps: '10 reps' },
                            { pct: 70,  reps: '12 reps' },
                            { pct: 65,  reps: '15 reps' },
                          ].map((row) => {
                            const mainVal = Math.round((roundedVal * (row.pct / 100)) * 10) / 10;
                            const eqVal = calcUnit === 'kg' ? mainVal * 2.20462 : mainVal / 2.20462;
                            const isSelected = row.pct === 85;
                            return (
                              <tr
                                key={row.pct}
                                style={{
                                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                                  background: isSelected ? 'rgba(145, 182, 161, 0.05)' : 'transparent',
                                  color: isSelected ? '#91b6a1' : 'rgba(255,255,255,0.85)',
                                  fontWeight: isSelected ? 700 : 400
                                }}
                              >
                                <th style={{ padding: '8px 10px', color: isSelected ? '#91b6a1' : 'rgba(145, 182, 161, 0.6)', fontWeight: 'bold' }}>{row.pct}%</th>
                                <td style={{ padding: '8px 10px', color: '#91b6a1', fontWeight: 'bold' }}>{mainVal.toFixed(1)} {calcUnit}</td>
                                <td style={{ padding: '8px 10px', color: '#a4b0a8' }}>{eqVal.toFixed(1)} {secondaryUnit}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#fff' }}>{row.reps}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Dropdown to Apply to Exercise */}
                  <div style={{ marginBottom: '20px' }}>
                    <label htmlFor="planner-rm-lift" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#a4b0a8', marginBottom: '6px', textTransform: 'none' }}>
                      Aplicar esta marca al Ejercicio:
                    </label>
                    <select
                      id="planner-rm-lift"
                      value={calcSelectedLift}
                      onChange={(e) => setCalcSelectedLift(e.target.value)}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', height: '38px', boxSizing: 'border-box' }}
                    >
                      <option value="">-- Seleccionar Ejercicio --</option>
                      {allLifts.map(lift => (
                        <option key={lift} value={lift} style={{ background: '#121716' }}>
                          {lift.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => {
                      if (!calcSelectedLift) {
                        showToast('Selecciona un ejercicio para aplicar el 1RM.', 'error');
                        return;
                      }
                      if (roundedVal <= 0) {
                        showToast('Ingresa valores de peso y reps válidos.', 'error');
                        return;
                      }

                      // SIEMPRE inyectar en KG al planificador (para mantener consistencia interna del robot)
                      const finalKgValue = calcUnit === 'kg' ? roundedVal : Math.round((roundedVal / 2.20462) * 10) / 10;

                      onApply(calcSelectedLift, finalKgValue, calcFormula === 'promedio' ? 'epley_brzycki_avg' : calcFormula);
                      onClose();
                    }}
                    style={{
                      width: '100%', background: 'var(--studio-accent)',
                      color: '#000', border: 'none', borderRadius: '10px', padding: '12px',
                      fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                      boxShadow: 'none'
                    }}
                  >
                    ✓ Aplicar Marca de 1RM al Plan
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
  );
}
