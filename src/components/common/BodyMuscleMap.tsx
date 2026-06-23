import React, { useState } from 'react';

interface BodyMuscleMapProps {
  selectedMuscle: string | null;
  onSelectMuscle: (muscle: string | null) => void;
}

export const BodyMuscleMap: React.FC<BodyMuscleMapProps> = ({
  selectedMuscle,
  onSelectMuscle
}) => {
  const [view, setView] = useState<'front' | 'back'>('front');



  const handleMuscleClick = (muscleKey: string) => {
    // Si ya está seleccionado, lo quitamos
    if (selectedMuscle === muscleKey) {
      onSelectMuscle(null);
    } else {
      onSelectMuscle(muscleKey);
    }
  };

  const isHighlighted = (muscleKeys: string[]) => {
    return selectedMuscle && muscleKeys.includes(selectedMuscle.toLowerCase());
  };

  const getStyleForMuscle = (muscleKeys: string[]) => {
    const active = isHighlighted(muscleKeys);
    return {
      fill: active ? 'var(--theme-primary, #00d4ff)' : 'rgba(255, 255, 255, 0.12)',
      stroke: active ? 'var(--theme-primary, #00d4ff)' : 'rgba(255, 255, 255, 0.3)',
      strokeWidth: active ? '2px' : '1px',
      cursor: 'pointer',
      transition: 'all 0.25s ease',
      filter: active ? 'drop-shadow(0 0 5px var(--theme-primary, #00d4ff))' : 'none'
    };
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: 'var(--theme-card-bg, #0f172a)',
      border: '1px solid var(--theme-border, rgba(255, 255, 255, 0.08))',
      borderRadius: '16px',
      padding: '20px',
      width: '100%',
      maxWidth: '360px',
      margin: '0 auto',
      position: 'relative'
    }}>
      {/* Botones de Control de Vista */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        background: 'rgba(255, 255, 255, 0.03)',
        padding: '4px',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <button
          onClick={() => setView('front')}
          style={{
            background: view === 'front' ? 'var(--theme-primary, #00d4ff)' : 'transparent',
            color: view === 'front' ? '#000' : '#fff',
            border: 'none',
            borderRadius: '7px',
            padding: '6px 16px',
            fontSize: '11px',
            fontWeight: 800,
            fontFamily: "'Orbitron', sans-serif",
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          DELANTERO
        </button>
        <button
          onClick={() => setView('back')}
          style={{
            background: view === 'back' ? 'var(--theme-primary, #00d4ff)' : 'transparent',
            color: view === 'back' ? '#000' : '#fff',
            border: 'none',
            borderRadius: '7px',
            padding: '6px 16px',
            fontSize: '11px',
            fontWeight: 800,
            fontFamily: "'Orbitron', sans-serif",
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          TRASERO
        </button>
      </div>

      {/* SVG del Mapa Muscular Estilizado Sci-Fi */}
      <svg
        viewBox="0 0 200 400"
        width="100%"
        height="320px"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.02)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
          </linearGradient>
        </defs>

        {/* Silueta de Fondo General (Cuerpo Completo) */}
        <path
          d="M100 30 C85 30, 80 45, 80 55 C80 65, 88 75, 100 75 C112 75, 120 65, 120 55 C120 45, 115 30, 100 30 Z 
             M80 75 C60 80, 50 90, 48 115 C45 130, 40 180, 40 210 C40 220, 50 220, 52 210 C55 190, 60 140, 64 125 L65 180 C65 210, 60 250, 58 290 C55 330, 55 370, 62 385 C65 390, 75 390, 78 385 C84 370, 88 340, 92 300 L95 210 L100 210 L105 210 L108 300 C112 340, 116 370, 122 385 C125 390, 135 390, 138 385 C145 370, 145 330, 142 290 C140 250, 135 210, 135 180 L136 125 C140 140, 145 190, 148 210 C150 220, 160 220, 160 210 C160 180, 155 130, 152 115 C150 90, 140 80, 120 75 Z"
          fill="url(#bodyGrad)"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth="1px"
        />

        {/* --- VISTA DELANTERA --- */}
        {view === 'front' && (
          <g>
            {/* Cabeza (Sin interactividad directa) */}
            <circle cx="100" cy="53" r="20" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <path d="M90 70 L82 82 M110 70 L118 82" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

            {/* Pecho (Pectoral) */}
            <path
              d="M72 90 Q85 85 100 95 Q115 85 128 90 L124 116 Q100 120 76 116 Z"
              style={getStyleForMuscle(['pecho'])}
              onClick={() => handleMuscleClick('pecho')}
            >
              <title>Pecho / Pectorales</title>
            </path>

            {/* Hombros (Deltoides) */}
            <path
              d="M62 82 Q48 88 48 108 L62 112 Q68 98 62 82 Z"
              style={getStyleForMuscle(['hombros'])}
              onClick={() => handleMuscleClick('hombros')}
            >
              <title>Hombro Izquierdo</title>
            </path>
            <path
              d="M138 82 Q152 88 152 108 L138 112 Q132 98 138 82 Z"
              style={getStyleForMuscle(['hombros'])}
              onClick={() => handleMuscleClick('hombros')}
            >
              <title>Hombro Derecho</title>
            </path>

            {/* Bíceps (Brazos superiores) */}
            <path
              d="M47 114 L42 150 Q48 154 55 145 L58 117 Z"
              style={getStyleForMuscle(['biceps'])}
              onClick={() => handleMuscleClick('biceps')}
            >
              <title>Bíceps Izquierdo</title>
            </path>
            <path
              d="M153 114 L158 150 Q152 154 145 145 L142 117 Z"
              style={getStyleForMuscle(['biceps'])}
              onClick={() => handleMuscleClick('biceps')}
            >
              <title>Bíceps Derecho</title>
            </path>

            {/* Antebrazo */}
            <path
              d="M40 156 L38 190 Q44 195 48 186 L52 152 Z"
              style={getStyleForMuscle(['antebrazo', 'biceps'])}
              onClick={() => handleMuscleClick('biceps')}
            >
              <title>Antebrazo Izquierdo</title>
            </path>
            <path
              d="M160 156 L162 190 Q156 195 152 186 L148 152 Z"
              style={getStyleForMuscle(['antebrazo', 'biceps'])}
              onClick={() => handleMuscleClick('biceps')}
            >
              <title>Antebrazo Derecho</title>
            </path>

            {/* Abdomen (Core) */}
            <rect
              x="80"
              y="125"
              width="40"
              height="55"
              rx="4"
              style={getStyleForMuscle(['abdomen', 'oblicuos'])}
              onClick={() => handleMuscleClick('abdomen')}
            >
              <title>Abdomen / Core</title>
            </rect>

            {/* Cuádriceps (Muslos delanteros) */}
            <path
              d="M62 195 L60 260 Q76 265 92 258 L88 195 Z"
              style={getStyleForMuscle(['cuadriceps', 'piernas'])}
              onClick={() => handleMuscleClick('piernas')}
            >
              <title>Cuádriceps Izquierdo</title>
            </path>
            <path
              d="M138 195 L140 260 Q124 265 108 258 L112 195 Z"
              style={getStyleForMuscle(['cuadriceps', 'piernas'])}
              onClick={() => handleMuscleClick('piernas')}
            >
              <title>Cuádriceps Derecho</title>
            </path>
          </g>
        )}

        {/* --- VISTA TRASERA --- */}
        {view === 'back' && (
          <g>
            {/* Trapecios y Romboides (Espalda alta) */}
            <path
              d="M84 76 L100 96 L116 76 L124 94 Q100 115 76 94 Z"
              style={getStyleForMuscle(['trapecio', 'espalda'])}
              onClick={() => handleMuscleClick('espalda')}
            >
              <title>Espalda Alta / Trapecios</title>
            </path>

            {/* Dorsales (Espalda media) */}
            <path
              d="M72 100 Q86 116 100 110 L100 145 L74 140 Z"
              style={getStyleForMuscle(['dorsales', 'espalda'])}
              onClick={() => handleMuscleClick('espalda')}
            >
              <title>Dorsal Ancho Izquierdo</title>
            </path>
            <path
              d="M128 100 Q114 116 100 110 L100 145 L126 140 Z"
              style={getStyleForMuscle(['dorsales', 'espalda'])}
              onClick={() => handleMuscleClick('espalda')}
            >
              <title>Dorsal Ancho Derecho</title>
            </path>

            {/* Lumbar (Espalda baja) */}
            <rect
              x="82"
              y="146"
              width="36"
              height="30"
              rx="2"
              style={getStyleForMuscle(['lumbar', 'espalda'])}
              onClick={() => handleMuscleClick('espalda')}
            >
              <title>Espalda Baja / Zona Lumbar</title>
            </rect>

            {/* Tríceps */}
            <path
              d="M48 114 L44 148 Q50 152 56 142 L56 117 Z"
              style={getStyleForMuscle(['triceps'])}
              onClick={() => handleMuscleClick('triceps')}
            >
              <title>Tríceps Izquierdo</title>
            </path>
            <path
              d="M152 114 L156 148 Q150 152 144 142 L144 117 Z"
              style={getStyleForMuscle(['triceps'])}
              onClick={() => handleMuscleClick('triceps')}
            >
              <title>Tríceps Derecho</title>
            </path>

            {/* Glúteos */}
            <path
              d="M66 182 L96 184 L96 215 L62 210 Z"
              style={getStyleForMuscle(['gluteos', 'piernas'])}
              onClick={() => handleMuscleClick('piernas')}
            >
              <title>Glúteo Izquierdo</title>
            </path>
            <path
              d="M134 182 L104 184 L104 215 L138 210 Z"
              style={getStyleForMuscle(['gluteos', 'piernas'])}
              onClick={() => handleMuscleClick('piernas')}
            >
              <title>Glúteo Derecho</title>
            </path>

            {/* Isquiosurales (Femorales) */}
            <path
              d="M62 220 L60 270 Q76 276 92 268 L92 220 Z"
              style={getStyleForMuscle(['isquiosurales', 'piernas'])}
              onClick={() => handleMuscleClick('piernas')}
            >
              <title>Femoral / Isquiosural Izquierdo</title>
            </path>
            <path
              d="M138 220 L140 270 Q124 276 108 268 L108 220 Z"
              style={getStyleForMuscle(['isquiosurales', 'piernas'])}
              onClick={() => handleMuscleClick('piernas')}
            >
              <title>Femoral / Isquiosural Derecho</title>
            </path>

            {/* Pantorrillas */}
            <path
              d="M58 285 L60 338 Q74 342 88 335 L88 285 Z"
              style={getStyleForMuscle(['pantorrillas', 'piernas'])}
              onClick={() => handleMuscleClick('piernas')}
            >
              <title>Pantorrilla Izquierda</title>
            </path>
            <path
              d="M142 285 L140 338 Q126 342 112 335 L112 285 Z"
              style={getStyleForMuscle(['pantorrillas', 'piernas'])}
              onClick={() => handleMuscleClick('piernas')}
            >
              <title>Pantorrilla Derecha</title>
            </path>
          </g>
        )}
      </svg>

      {/* Indicador de Filtro Activo */}
      {selectedMuscle && (
        <div style={{
          marginTop: '15px',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.6)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.02)',
          padding: '6px 12px',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          fontFamily: "'Orbitron', sans-serif"
        }}>
          Filtrando por:{' '}
          <span style={{ color: 'var(--theme-primary, #00d4ff)', fontWeight: 700 }}>
            {selectedMuscle.toUpperCase()}
          </span>
          <button
            onClick={() => onSelectMuscle(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--theme-primary, #00d4ff)',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '12px',
              paddingLeft: '4px'
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default BodyMuscleMap;
