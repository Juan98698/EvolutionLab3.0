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
  width = 340,
  height = 320,
}) => {
  // Mapeo de coordenadas Somatotípicas (-9 a +9 X, -10 a +15 Y) a coordenadas SVG (pixels)
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

  // Vértices del triángulo somatotípico de Heath-Carter
  const mesoApexX = mapX(0);
  const mesoApexY = mapY(13);
  const endoApexX = mapX(-6.5);
  const endoApexY = mapY(-7);
  const ectoApexX = mapX(6.5);
  const ectoApexY = mapY(-7);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(7, 10, 19, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '10px', fontSize: '11px', fontFamily: "'Orbitron', sans-serif", color: 'rgba(255,255,255,0.7)' }}>
        <span style={{ color: '#00d4ff', fontWeight: 700 }}>SOMATOCARTA HEATH-CARTER</span>
        <span style={{ color: '#ff3366', fontWeight: 800 }}>X: {x} | Y: {y}</span>
      </div>

      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        {/* Zonas de color del triángulo */}
        <polygon
          points={`${mesoApexX},${mesoApexY} 0,0 ${mapX(0)},${mapY(0)}`}
          fill="rgba(0, 212, 255, 0.05)"
        />
        <polygon
          points={`${mesoApexX},${mesoApexY} ${endoApexX},${endoApexY} ${ectoApexX},${ectoApexY}`}
          fill="none"
          stroke="rgba(0, 212, 255, 0.3)"
          strokeWidth="1.5"
        />

        {/* Ejes X e Y central */}
        <line x1={mapX(-9)} y1={mapY(0)} x2={mapX(9)} y2={mapY(0)} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
        <line x1={mapX(0)} y1={mapY(-10)} x2={mapX(0)} y2={mapY(15)} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />

        {/* Etiqueta Zonas Somatotípicas */}
        <text x={mesoApexX} y={mesoApexY - 8} fill="#00d4ff" fontSize="10" fontWeight="800" textAnchor="middle" fontFamily="Orbitron, sans-serif">
          MESOMORFIA ({meso})
        </text>
        <text x={endoApexX - 10} y={endoApexY + 16} fill="#ff3366" fontSize="10" fontWeight="800" textAnchor="middle" fontFamily="Orbitron, sans-serif">
          ENDOMORFIA ({endo})
        </text>
        <text x={ectoApexX + 10} y={ectoApexY + 16} fill="#00ff99" fontSize="10" fontWeight="800" textAnchor="middle" fontFamily="Orbitron, sans-serif">
          ECTOMORFIA ({ecto})
        </text>

        {/* Historial de trayectoria con línea punteada */}
        {history.length > 1 && (
          <polyline
            points={history.map(h => `${mapX(h.x)},${mapY(h.y)}`).join(' ')}
            fill="none"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        )}

        {/* Puntos de evaluaciones pasadas */}
        {history.map((h, idx) => (
          <circle
            key={idx}
            cx={mapX(h.x)}
            cy={mapY(h.y)}
            r="4"
            fill="rgba(255, 255, 255, 0.5)"
            stroke="#000"
            strokeWidth="1"
          />
        ))}

        {/* Punto de Evaluación Actual */}
        <circle cx={currentSvgX} cy={currentSvgY} r="7" fill="#ff3366" stroke="#ffffff" strokeWidth="2.5" />
        <circle cx={currentSvgX} cy={currentSvgY} r="12" fill="rgba(255, 51, 102, 0.25)" />
      </svg>
    </div>
  );
};
export default SomatochartCanvas;
