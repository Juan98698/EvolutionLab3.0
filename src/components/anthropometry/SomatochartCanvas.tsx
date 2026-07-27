import React from 'react';

interface SomatochartCanvasProps {
  x: number;
  y: number;
  endo: number;
  meso: number;
  ecto: number;
  history?: Array<{ x: number; y: number; fecha: string }>;
  width?: number;
  height?: number;
}

export const SomatochartCanvas: React.FC<SomatochartCanvasProps> = ({
  x,
  y,
  endo,
  meso,
  ecto,
  history = [],
  width = 360,
  height = 320,
}) => {
  const mapX = (valX: number) => {
    const minX = -9;
    const maxX = 9;
    return ((valX - minX) / (maxX - minX)) * (width - 40) + 20;
  };

  const mapY = (valY: number) => {
    const minY = -10;
    const maxY = 15;
    return height - 25 - ((valY - minY) / (maxY - minY)) * (height - 50);
  };

  const currentSvgX = mapX(x);
  const currentSvgY = mapY(y);

  // Vértices del triángulo somatotípico
  const mesoApexX = mapX(0);
  const mesoApexY = mapY(13);
  const endoApexX = mapX(-7.5);
  const endoApexY = mapY(-7.5);
  const ectoApexX = mapX(7.5);
  const ectoApexY = mapY(-7.5);
  const centerX = mapX(0);
  const centerY = mapY(0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(7, 10, 19, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '8px', fontSize: '11px', fontFamily: "'Orbitron', sans-serif", color: 'rgba(255,255,255,0.7)', flexWrap: 'wrap', gap: '6px' }}>
        <span style={{ color: '#00d4ff', fontWeight: 700 }}>SOMATOCARTA HEATH-CARTER</span>
        <span style={{ color: '#ff3366', fontWeight: 800 }}>X: {x} | Y: {y}</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', maxWidth: `${width}px`, overflow: 'visible' }}>
        <defs>
          <linearGradient id="mesoSectorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#facc15" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#84cc16" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="endoSectorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="ectoSectorGrad" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* 1. Sector Mesomórfico (Superior - Amarillo/Verde) */}
        <polygon
          points={`${mesoApexX},${mesoApexY} ${ectoApexX},${ectoApexY} ${centerX},${centerY}`}
          fill="url(#mesoSectorGrad)"
        />
        <polygon
          points={`${mesoApexX},${mesoApexY} ${endoApexX},${endoApexY} ${centerX},${centerY}`}
          fill="url(#mesoSectorGrad)"
        />

        {/* 2. Sector Endomórfico (Izquierda - Verde) */}
        <polygon
          points={`${endoApexX},${endoApexY} ${centerX},${centerY} ${mapX(0)},${mapY(-7.5)}`}
          fill="url(#endoSectorGrad)"
        />

        {/* 3. Sector Ectomórfico (Derecha - Azul/Cian) */}
        <polygon
          points={`${ectoApexX},${ectoApexY} ${centerX},${centerY} ${mapX(0)},${mapY(-7.5)}`}
          fill="url(#ectoSectorGrad)"
        />

        {/* Borde del Triángulo Somatotípico */}
        <polygon
          points={`${mesoApexX},${mesoApexY} ${endoApexX},${endoApexY} ${ectoApexX},${ectoApexY}`}
          fill="none"
          stroke="rgba(0, 212, 255, 0.5)"
          strokeWidth="2"
        />

        {/* Líneas divisorias internas */}
        <line x1={mesoApexX} y1={mesoApexY} x2={centerX} y2={centerY} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
        <line x1={endoApexX} y1={endoApexY} x2={centerX} y2={centerY} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
        <line x1={ectoApexX} y1={ectoApexY} x2={centerX} y2={centerY} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
        <line x1={mapX(-9)} y1={mapY(0)} x2={mapX(9)} y2={mapY(0)} stroke="rgba(255,255,255,0.15)" strokeDasharray="2 2" />

        {/* ── MANIQUÍS DE LOS 3 CUADRANTES ────────────────────────── */}
        {/* 1. Maniquí Mesomórfico (Superior - Musculoso) */}
        <g transform={`translate(${mesoApexX - 14}, ${mesoApexY + 20}) scale(0.65)`} opacity="0.85">
          {/* Cabeza */}
          <circle cx="20" cy="8" r="6" fill="#fde047" />
          {/* Hombros anchos & Pecho muscular */}
          <path d="M6 18 L34 18 L30 38 L10 38 Z" fill="#fde047" />
          {/* Brazos potentes */}
          <path d="M4 18 L0 32 L4 33 L8 20 Z" fill="#eab308" />
          <path d="M36 18 L40 32 L36 33 L32 20 Z" fill="#eab308" />
          {/* Piernas musculosas */}
          <rect x="11" y="39" width="7" height="24" rx="2" fill="#fde047" />
          <rect x="22" y="39" width="7" height="24" rx="2" fill="#fde047" />
        </g>

        {/* 2. Maniquí Endomórfico (Izquierda - Robusto/Ancho) */}
        <g transform={`translate(${endoApexX + 25}, ${endoApexY - 42}) scale(0.65)`} opacity="0.85">
          <circle cx="20" cy="8" r="6.5" fill="#4ade80" />
          {/* Torso robusto/redondeado */}
          <ellipse cx="20" cy="28" rx="15" ry="12" fill="#4ade80" />
          <rect x="11" y="39" width="8" height="22" rx="3" fill="#22c55e" />
          <rect x="21" y="39" width="8" height="22" rx="3" fill="#22c55e" />
        </g>

        {/* 3. Maniquí Ectomórfico (Derecha - Estilizado/Delgado) */}
        <g transform={`translate(${ectoApexX - 35}, ${ectoApexY - 42}) scale(0.65)`} opacity="0.85">
          <circle cx="20" cy="8" r="5" fill="#38bdf8" />
          {/* Torso delgado */}
          <path d="M11 18 L29 18 L26 38 L14 38 Z" fill="#38bdf8" />
          {/* Brazos y piernas esbeltas */}
          <rect x="7" y="18" width="3" height="22" rx="1.5" fill="#06b6d4" />
          <rect x="30" y="18" width="3" height="22" rx="1.5" fill="#06b6d4" />
          <rect x="13" y="39" width="5" height="26" rx="2" fill="#38bdf8" />
          <rect x="22" y="39" width="5" height="26" rx="2" fill="#38bdf8" />
        </g>

        {/* Etiquetas Zonas Somatotípicas */}
        <text x={mesoApexX} y={mesoApexY - 8} fill="#fde047" fontSize="10" fontWeight="900" textAnchor="middle" fontFamily="Orbitron, sans-serif">
          MESOMORFIA ({meso})
        </text>
        <text x={endoApexX - 5} y={endoApexY + 16} fill="#4ade80" fontSize="10" fontWeight="900" textAnchor="middle" fontFamily="Orbitron, sans-serif">
          ENDOMORFIA ({endo})
        </text>
        <text x={ectoApexX + 5} y={ectoApexY + 16} fill="#38bdf8" fontSize="10" fontWeight="900" textAnchor="middle" fontFamily="Orbitron, sans-serif">
          ECTOMORFIA ({ecto})
        </text>

        {/* Historial de trayectoria */}
        {history.length > 1 && (
          <polyline
            points={history.map(h => `${mapX(h.x)},${mapY(h.y)}`).join(' ')}
            fill="none"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        )}

        {/* Punto de Evaluación Actual */}
        <circle cx={currentSvgX} cy={currentSvgY} r="7" fill="#ff3366" stroke="#ffffff" strokeWidth="2.5" />
        <circle cx={currentSvgX} cy={currentSvgY} r="12" fill="rgba(255, 51, 102, 0.25)" />
      </svg>
    </div>
  );
};

export default SomatochartCanvas;
