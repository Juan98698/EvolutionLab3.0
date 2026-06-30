import React, { useState } from 'react';

interface RMCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const RMCalculatorModal: React.FC<RMCalculatorModalProps> = ({
  isOpen,
  onClose,
  showToast
}) => {
  const [calcUnit, setCalcUnit] = useState<'kg' | 'lbs'>('kg');
  const [calcPeso, setCalcPeso] = useState<string>('');
  const [calcReps, setCalcReps] = useState<string>('');
  const [calcFormula, setCalcFormula] = useState<string>('promedio');
  const [rmResult, setRmResult] = useState<number | null>(null);
  const [rmTable, setRmTable] = useState<{ pct: number; carga: number; reps: number }[]>([]);

  if (!isOpen) return null;

  const handleCalculate1RM = (e: React.FormEvent) => {
    e.preventDefault();
    const peso = parseFloat(calcPeso);
    const reps = parseInt(calcReps, 10);

    if (isNaN(peso) || peso <= 0 || isNaN(reps) || reps <= 0) {
      showToast('Por favor, ingresa un peso y repeticiones válidos.', 'error');
      return;
    }

    if (reps > 30) {
      showToast('Las fórmulas no son precisas para más de 30 repeticiones.', 'error');
      return;
    }

    let rm = 0;
    if (calcFormula === 'brzycki') {
      rm = peso / (1.0278 - 0.0278 * reps);
    } else if (calcFormula === 'epley') {
      rm = peso * (1 + reps / 30);
    } else { // promedio
      const b = peso / (1.0278 - 0.0278 * reps);
      const e = peso * (1 + reps / 30);
      rm = (b + e) / 2;
    }

    setRmResult(rm);

    // Generar tabla de porcentajes sugeridos
    const tabla = [
      { pct: 100, reps: 1 },
      { pct: 95, reps: 2 },
      { pct: 90, reps: 4 },
      { pct: 85, reps: 6 },
      { pct: 80, reps: 8 },
      { pct: 75, reps: 10 },
      { pct: 70, reps: 12 },
      { pct: 65, reps: 15 },
      { pct: 60, reps: 18 },
    ].map((item) => ({
      pct: item.pct,
      carga: rm * (item.pct / 100),
      reps: item.reps,
    }));

    setRmTable(tabla);
  };

  return (
    <div id="modal-1rm" className={`modal-overlay-enter open`} onClick={(e) => { if (e.target === e.currentTarget) { onClose(); setRmResult(null); } }}>
      <div className="modal-1rm-box modal-enter">
        <div className="modal-1rm-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '16px' }}>🧮</span>
            <span className="modal-1rm-title">CALCULADORA 1RM</span>
          </div>
          <button className="modal-1rm-close" onClick={() => { onClose(); setRmResult(null); }}>&times;</button>
        </div>

        <form onSubmit={handleCalculate1RM} className="modal-1rm-form">
          <div className="modal-1rm-group full-width" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', fontFamily: "'Orbitron', sans-serif" }}>UNIDAD DE MEDIDA</label>
            <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--theme-border)', borderRadius: '10px', padding: '4px', maxWidth: '160px' }}>
              <button
                type="button"
                onClick={() => { setCalcUnit('kg'); setRmResult(null); }}
                style={{
                  flex: 1,
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontFamily: "'Orbitron', sans-serif",
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: calcUnit === 'kg' ? 'var(--theme-btn-gradient)' : 'transparent',
                  color: calcUnit === 'kg' ? 'white' : 'rgba(255,255,255,0.6)',
                  boxShadow: calcUnit === 'kg' ? '0 0 10px var(--theme-btn-glow)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                KG
              </button>
              <button
                type="button"
                onClick={() => { setCalcUnit('lbs'); setRmResult(null); }}
                style={{
                  flex: 1,
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontFamily: "'Orbitron', sans-serif",
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: calcUnit === 'lbs' ? 'var(--theme-btn-gradient)' : 'transparent',
                  color: calcUnit === 'lbs' ? 'white' : 'rgba(255,255,255,0.6)',
                  boxShadow: calcUnit === 'lbs' ? '0 0 10px var(--theme-btn-glow)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                LBS
              </button>
            </div>
          </div>

          <div className="modal-1rm-group">
            <label htmlFor="input1RMPeso" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>PESO LEVANTADO ({calcUnit.toUpperCase()})</span>
              {calcPeso && !isNaN(parseFloat(calcPeso)) && parseFloat(calcPeso) > 0 && (
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif" }}>
                  ≈ {(calcUnit === 'kg' ? parseFloat(calcPeso) * 2.20462 : parseFloat(calcPeso) / 2.20462).toFixed(1)} {calcUnit === 'kg' ? 'lbs' : 'kg'}
                </span>
              )}
            </label>
            <input
              type="number"
              id="input1RMPeso"
              step="any"
              value={calcPeso}
              onChange={(e) => setCalcPeso(e.target.value)}
              required
              placeholder={calcUnit === 'kg' ? 'Ej: 80' : 'Ej: 175'}
            />
          </div>
          <div className="modal-1rm-group">
            <label htmlFor="input1RMReps">REPETICIONES</label>
            <input
              type="number"
              id="input1RMReps"
              min="1"
              max="30"
              value={calcReps}
              onChange={(e) => setCalcReps(e.target.value)}
              required
              placeholder="Ej: 5"
            />
          </div>
          <div className="modal-1rm-group full-width">
            <label htmlFor="select1RMFormula">FÓRMULA</label>
            <select
              id="select1RMFormula"
              value={calcFormula}
              onChange={(e) => setCalcFormula(e.target.value)}
            >
              <option value="promedio">Promedio Automático (Recomendado)</option>
              <option value="brzycki">Brzycki</option>
              <option value="epley">Epley</option>
            </select>
          </div>
          <button type="submit" className="modal-1rm-btn-calc full-width">🧮 Calcular 1RM</button>
        </form>

        {rmResult !== null && (
          <div className="modal-1rm-result" style={{ display: 'block' }}>
            <div className="modal-1rm-result-title">1RM Estimado</div>
            <div className="modal-1rm-value-display" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 0' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '2.2rem', fontWeight: 800 }}>{rmResult.toFixed(1)}</span>
                <span style={{ fontSize: '1.1rem', color: 'var(--theme-primary)', fontWeight: 700 }}>{calcUnit}</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', fontFamily: "'Orbitron', sans-serif" }}>
                ≈ {(calcUnit === 'kg' ? rmResult * 2.20462 : rmResult / 2.20462).toFixed(1)} {calcUnit === 'kg' ? 'lbs' : 'kg'}
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px', textAlign: 'center' }}>Tabla de Porcentajes de Carga</div>
            <div className="modal-1rm-table-container">
              <table className="modal-1rm-table">
                <thead>
                  <tr>
                    <th>%</th>
                    <th>Carga ({calcUnit})</th>
                    <th>Equivalencia</th>
                    <th>Repeticiones sugeridas</th>
                  </tr>
                </thead>
                <tbody>
                  {rmTable.map((row) => {
                    const equiv = calcUnit === 'kg' ? row.carga * 2.20462 : row.carga / 2.20462;
                    return (
                      <tr key={row.pct}>
                        <td style={{ fontWeight: 600, color: 'var(--theme-primary)' }}>{row.pct}%</td>
                        <td style={{ fontWeight: 700, color: '#7EC94A' }}>{row.carga.toFixed(1)} {calcUnit}</td>
                        <td style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>{equiv.toFixed(1)} {calcUnit === 'kg' ? 'lbs' : 'kg'}</td>
                        <td>{row.reps} {row.reps === 1 ? 'rep' : 'reps'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RMCalculatorModal;
