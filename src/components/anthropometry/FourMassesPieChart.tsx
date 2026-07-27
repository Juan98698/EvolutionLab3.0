import React from 'react';

interface FourMassesPieChartProps {
  pesoTotal: number;
  kgMusculo: number;
  pctMusculo: number;
  kgGrasa: number;
  pctGrasa: number;
  kgOseo: number;
  pctOseo: number;
  kgResidual: number;
  pctResidual: number;
  size?: number;
}

export const FourMassesPieChart: React.FC<FourMassesPieChartProps> = ({
  pesoTotal,
  kgMusculo,
  pctMusculo,
  kgGrasa,
  pctGrasa,
  kgOseo,
  pctOseo,
  kgResidual,
  pctResidual,
  size = 280,
}) => {
  const center = size / 2;
  const radius = (size / 2) - 30;
  const strokeWidth = 36;
  const circumference = 2 * Math.PI * radius;

  // Calculamos los arcos acumulados para la gráfica circular (Donut chart)
  const segments = [
    { name: 'Masa Muscular', kg: kgMusculo, pct: pctMusculo, color: '#ef4444' },
    { name: 'Masa Grasa', kg: kgGrasa, pct: pctGrasa, color: '#d97706' },
    { name: 'Masa Ósea', kg: kgOseo, pct: pctOseo, color: '#ca8a04' },
    { name: 'Masa Residual', kg: kgResidual, pct: pctResidual, color: '#3b82f6' },
  ];

  let cumulativePct = 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box' }}>
      <h4 style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 800, color: '#0f172a', fontFamily: 'Orbitron, sans-serif', textAlign: 'center' }}>
        COMPOSICIÓN CORPORAL (4 MASAS)
      </h4>

      <div style={{ position: 'relative', width: '100%', maxWidth: `${size}px`, aspectRatio: '1/1', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', height: '100%' }}>
          {segments.map((seg, idx) => {
            const dashArray = `${(seg.pct / 100) * circumference} ${circumference}`;
            const dashOffset = -((cumulativePct / 100) * circumference);
            cumulativePct += seg.pct;

            return (
              <circle
                key={idx}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${center} ${center})`}
                style={{ transition: 'all 0.5s ease' }}
              />
            );
          })}
        </svg>

        {/* Centro Informativo */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>TU PESO DE</span>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 900, color: '#0f172a', fontFamily: 'Orbitron, sans-serif' }}>
            {pesoTotal} kg
          </h3>
        </div>
      </div>

      {/* Leyenda y Desglose Responsivo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px 12px', width: '100%', marginTop: '16px', fontSize: '11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }}></span>
          <span style={{ color: '#1e293b' }}><strong>Muscular:</strong> {kgMusculo} kg ({pctMusculo}%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#d97706', flexShrink: 0 }}></span>
          <span style={{ color: '#1e293b' }}><strong>Grasa:</strong> {kgGrasa} kg ({pctGrasa}%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ca8a04', flexShrink: 0 }}></span>
          <span style={{ color: '#1e293b' }}><strong>Ósea:</strong> {kgOseo} kg ({pctOseo}%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }}></span>
          <span style={{ color: '#1e293b' }}><strong>Residual:</strong> {kgResidual} kg ({pctResidual}%)</span>
        </div>
      </div>
    </div>
  );
};

export default FourMassesPieChart;
