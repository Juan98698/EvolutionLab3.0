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
    if (selectedMuscle === muscleKey) {
      onSelectMuscle(null);
    } else {
      onSelectMuscle(muscleKey);
    }
  };

  const isMuscleActive = (muscleKeys: string[]) => {
    return selectedMuscle && muscleKeys.includes(selectedMuscle.toLowerCase());
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: 'linear-gradient(135deg, rgba(10, 15, 30, 0.8) 0%, rgba(16, 24, 48, 0.7) 100%)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(0, 212, 255, 0.15)',
      borderRadius: '20px',
      padding: '24px 20px',
      width: '100%',
      maxWidth: '360px',
      margin: '0 auto',
      position: 'relative',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.05)',
      overflow: 'hidden'
    }}>
      {/* Estilos CSS globales inyectados para efectos interactivos fluidos */}
      <style dangerouslySetInnerHTML={{ __html: `
        .hud-muscle-path {
          fill: rgba(255, 255, 255, 0.04);
          stroke: rgba(255, 255, 255, 0.15);
          stroke-width: 1px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hud-muscle-path:hover {
          fill: rgba(0, 212, 255, 0.18) !important;
          stroke: rgba(0, 212, 255, 0.6) !important;
          filter: drop-shadow(0 0 6px rgba(0, 212, 255, 0.5));
        }
        .hud-muscle-path.active {
          fill: var(--theme-primary, #00d4ff) !important;
          stroke: var(--theme-primary, #00d4ff) !important;
          stroke-width: 1.5px !important;
          filter: drop-shadow(0 0 10px var(--theme-primary, #00d4ff)) !important;
        }
      ` }} />

      {/* Sci-Fi Decorative Corner Brackets */}
      <div style={{ position: 'absolute', top: '10px', left: '10px', width: '12px', height: '12px', borderTop: '2px solid rgba(0, 212, 255, 0.4)', borderLeft: '2px solid rgba(0, 212, 255, 0.4)' }} />
      <div style={{ position: 'absolute', top: '10px', right: '10px', width: '12px', height: '12px', borderTop: '2px solid rgba(0, 212, 255, 0.4)', borderRight: '2px solid rgba(0, 212, 255, 0.4)' }} />
      <div style={{ position: 'absolute', bottom: '10px', left: '10px', width: '12px', height: '12px', borderBottom: '2px solid rgba(0, 212, 255, 0.4)', borderLeft: '2px solid rgba(0, 212, 255, 0.4)' }} />
      <div style={{ position: 'absolute', bottom: '10px', right: '10px', width: '12px', height: '12px', borderBottom: '2px solid rgba(0, 212, 255, 0.4)', borderRight: '2px solid rgba(0, 212, 255, 0.4)' }} />

      {/* HUD Header Status */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        fontSize: '9px',
        fontFamily: "'Orbitron', sans-serif",
        color: 'rgba(0, 212, 255, 0.4)',
        letterSpacing: '1.5px',
        marginBottom: '16px',
        borderBottom: '1px dashed rgba(0, 212, 255, 0.15)',
        paddingBottom: '8px'
      }}>
        <span>ANATOMICAL_SCAN: OK</span>
        <span>SYS_v3.2_BIO</span>
      </div>

      {/* View Switcher Controls */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '20px',
        background: 'rgba(0, 212, 255, 0.03)',
        padding: '3px',
        borderRadius: '12px',
        border: '1px solid rgba(0, 212, 255, 0.1)',
        boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
        zIndex: 2
      }}>
        <button
          onClick={() => setView('front')}
          style={{
            background: view === 'front' ? 'var(--theme-primary, #00d4ff)' : 'transparent',
            color: view === 'front' ? '#000' : 'rgba(255, 255, 255, 0.6)',
            border: 'none',
            borderRadius: '9px',
            padding: '8px 18px',
            fontSize: '11px',
            fontWeight: 800,
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: '1px',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: view === 'front' ? '0 0 10px rgba(0, 212, 255, 0.5)' : 'none'
          }}
        >
          ANTERIOR
        </button>
        <button
          onClick={() => setView('back')}
          style={{
            background: view === 'back' ? 'var(--theme-primary, #00d4ff)' : 'transparent',
            color: view === 'back' ? '#000' : 'rgba(255, 255, 255, 0.6)',
            border: 'none',
            borderRadius: '9px',
            padding: '8px 18px',
            fontSize: '11px',
            fontWeight: 800,
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: '1px',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: view === 'back' ? '0 0 10px rgba(0, 212, 255, 0.5)' : 'none'
          }}
        >
          POSTERIOR
        </button>
      </div>

      {/* SVG Container */}
      <svg
        viewBox="0 0 200 400"
        width="100%"
        height="320px"
        style={{ overflow: 'visible', zIndex: 1 }}
      >
        <defs>
          <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(0, 212, 255, 0.02)" />
            <stop offset="100%" stopColor="rgba(0, 212, 255, 0.08)" />
          </linearGradient>
          <pattern id="hudGrid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(0, 212, 255, 0.02)" strokeWidth="0.5"/>
          </pattern>
        </defs>

        {/* Futuristic Grid Overlay */}
        <rect width="100%" height="100%" fill="url(#hudGrid)" rx="10" />

        {/* Holographic Radar Concentric Circles */}
        <circle cx="100" cy="180" r="140" fill="none" stroke="rgba(0, 212, 255, 0.03)" strokeWidth="1" strokeDasharray="5 5" />
        <circle cx="100" cy="180" r="110" fill="none" stroke="rgba(0, 212, 255, 0.05)" strokeWidth="1" />
        <circle cx="100" cy="180" r="80" fill="none" stroke="rgba(0, 212, 255, 0.02)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="100" y1="10" x2="100" y2="390" stroke="rgba(0, 212, 255, 0.04)" strokeWidth="1" strokeDasharray="2 4" />

        {/* Body Base Silhouette */}
        <path
          d="M100 30 C85 30, 80 45, 80 55 C80 65, 88 75, 100 75 C112 75, 120 65, 120 55 C120 45, 115 30, 100 30 Z 
             M80 75 C60 80, 50 90, 48 115 C45 130, 40 180, 40 210 C40 220, 50 220, 52 210 C55 190, 60 140, 64 125 L65 180 C65 210, 60 250, 58 290 C55 330, 55 370, 62 385 C65 390, 75 390, 78 385 C84 370, 88 340, 92 300 L95 210 L100 210 L105 210 L108 300 C112 340, 116 370, 122 385 C125 390, 135 390, 138 385 C145 370, 145 330, 142 290 C140 250, 135 210, 135 180 L136 125 C140 140, 145 190, 148 210 C150 220, 160 220, 160 210 C160 180, 155 130, 152 115 C150 90, 140 80, 120 75 Z"
          fill="url(#bodyGrad)"
          stroke="rgba(0, 212, 255, 0.15)"
          strokeWidth="1px"
        />

        {/* --- VISTA ANTERIOR (DELANTERA) --- */}
        {view === 'front' && (
          <g>
            {/* Cabeza */}
            <circle cx="100" cy="53" r="20" fill="none" stroke="rgba(0,212,255,0.2)" strokeWidth="1" />
            <path d="M90 70 L82 82 M110 70 L118 82" stroke="rgba(0,212,255,0.2)" strokeWidth="1" />

            {/* Pecho (Pectoral) */}
            <path
              d="M72 90 Q85 85 100 95 Q115 85 128 90 L124 116 Q100 120 76 116 Z"
              className={`hud-muscle-path ${isMuscleActive(['pecho']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('pecho')}
            >
              <title>Pecho / Pectorales</title>
            </path>

            {/* Hombros (Deltoides) */}
            <path
              d="M62 82 Q48 88 48 108 L62 112 Q68 98 62 82 Z"
              className={`hud-muscle-path ${isMuscleActive(['hombros']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('hombros')}
            >
              <title>Hombro Izquierdo</title>
            </path>
            <path
              d="M138 82 Q152 88 152 108 L138 112 Q132 98 138 82 Z"
              className={`hud-muscle-path ${isMuscleActive(['hombros']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('hombros')}
            >
              <title>Hombro Derecho</title>
            </path>

            {/* Bíceps */}
            <path
              d="M47 114 L42 150 Q48 154 55 145 L58 117 Z"
              className={`hud-muscle-path ${isMuscleActive(['biceps']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('biceps')}
            >
              <title>Bíceps Izquierdo</title>
            </path>
            <path
              d="M153 114 L158 150 Q152 154 145 145 L142 117 Z"
              className={`hud-muscle-path ${isMuscleActive(['biceps']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('biceps')}
            >
              <title>Bíceps Derecho</title>
            </path>

            {/* Antebrazos (mapeados a biceps) */}
            <path
              d="M40 156 L38 190 Q44 195 48 186 L52 152 Z"
              className={`hud-muscle-path ${isMuscleActive(['antebrazo', 'biceps']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('biceps')}
            >
              <title>Antebrazo Izquierdo</title>
            </path>
            <path
              d="M160 156 L162 190 Q156 195 152 186 L148 152 Z"
              className={`hud-muscle-path ${isMuscleActive(['antebrazo', 'biceps']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('biceps')}
            >
              <title>Antebrazo Derecho</title>
            </path>

            {/* Abdomen (Core / Oblicuos) */}
            <rect
              x="80"
              y="125"
              width="40"
              height="55"
              rx="4"
              className={`hud-muscle-path ${isMuscleActive(['abdomen', 'oblicuos']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('abdomen')}
            >
              <title>Abdomen / Core</title>
            </rect>

            {/* Cuádriceps (Vista Anterior) - CLAVE SEPARADA */}
            <path
              d="M62 195 L60 260 Q76 265 92 258 L88 195 Z"
              className={`hud-muscle-path ${isMuscleActive(['cuadriceps']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('cuadriceps')}
            >
              <title>Cuádriceps Izquierdo</title>
            </path>
            <path
              d="M138 195 L140 260 Q124 265 108 258 L112 195 Z"
              className={`hud-muscle-path ${isMuscleActive(['cuadriceps']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('cuadriceps')}
            >
              <title>Cuádriceps Derecho</title>
            </path>
          </g>
        )}

        {/* --- VISTA POSTERIOR (TRASERA) --- */}
        {view === 'back' && (
          <g>
            {/* Espalda Alta / Trapecios */}
            <path
              d="M84 76 L100 96 L116 76 L124 94 Q100 115 76 94 Z"
              className={`hud-muscle-path ${isMuscleActive(['trapecio', 'espalda']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('espalda')}
            >
              <title>Espalda Alta / Trapecios</title>
            </path>

            {/* Dorsales */}
            <path
              d="M72 100 Q86 116 100 110 L100 145 L74 140 Z"
              className={`hud-muscle-path ${isMuscleActive(['dorsales', 'espalda']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('espalda')}
            >
              <title>Dorsal Ancho Izquierdo</title>
            </path>
            <path
              d="M128 100 Q114 116 100 110 L100 145 L126 140 Z"
              className={`hud-muscle-path ${isMuscleActive(['dorsales', 'espalda']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('espalda')}
            >
              <title>Dorsal Ancho Derecho</title>
            </path>

            {/* Espalda Baja / Lumbar */}
            <rect
              x="82"
              y="146"
              width="36"
              height="30"
              rx="2"
              className={`hud-muscle-path ${isMuscleActive(['lumbar', 'espalda']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('espalda')}
            >
              <title>Espalda Baja / Zona Lumbar</title>
            </rect>

            {/* Tríceps */}
            <path
              d="M48 114 L44 148 Q50 152 56 142 L56 117 Z"
              className={`hud-muscle-path ${isMuscleActive(['triceps']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('triceps')}
            >
              <title>Tríceps Izquierdo</title>
            </path>
            <path
              d="M152 114 L156 148 Q150 152 144 142 L144 117 Z"
              className={`hud-muscle-path ${isMuscleActive(['triceps']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('triceps')}
            >
              <title>Tríceps Derecho</title>
            </path>

            {/* Glúteos - CLAVE SEPARADA */}
            <path
              d="M66 182 L96 184 L96 215 L62 210 Z"
              className={`hud-muscle-path ${isMuscleActive(['gluteos']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('gluteos')}
            >
              <title>Glúteo Izquierdo</title>
            </path>
            <path
              d="M134 182 L104 184 L104 215 L138 210 Z"
              className={`hud-muscle-path ${isMuscleActive(['gluteos']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('gluteos')}
            >
              <title>Glúteo Derecho</title>
            </path>

            {/* Isquiosurales / Femorales - CLAVE SEPARADA */}
            <path
              d="M62 220 L60 270 Q76 276 92 268 L92 220 Z"
              className={`hud-muscle-path ${isMuscleActive(['isquiosurales']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('isquiosurales')}
            >
              <title>Femoral / Isquiosural Izquierdo</title>
            </path>
            <path
              d="M138 220 L140 270 Q124 276 108 268 L108 220 Z"
              className={`hud-muscle-path ${isMuscleActive(['isquiosurales']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('isquiosurales')}
            >
              <title>Femoral / Isquiosural Derecho</title>
            </path>

            {/* Pantorrillas - CLAVE SEPARADA */}
            <path
              d="M58 285 L60 338 Q74 342 88 335 L88 285 Z"
              className={`hud-muscle-path ${isMuscleActive(['pantorrillas']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('pantorrillas')}
            >
              <title>Pantorrilla Izquierda</title>
            </path>
            <path
              d="M142 285 L140 338 Q126 342 112 335 L112 285 Z"
              className={`hud-muscle-path ${isMuscleActive(['pantorrillas']) ? 'active' : ''}`}
              onClick={() => handleMuscleClick('pantorrillas')}
            >
              <title>Pantorrilla Derecha</title>
            </path>
          </g>
        )}
      </svg>

      {/* Active Filter Badge */}
      {selectedMuscle && (
        <div style={{
          marginTop: '16px',
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.7)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(0, 212, 255, 0.05)',
          padding: '6px 14px',
          borderRadius: '20px',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          fontFamily: "'Orbitron', sans-serif",
          boxShadow: '0 0 10px rgba(0, 212, 255, 0.1)',
          zIndex: 2
        }}>
          FILTRADO: {' '}
          <span style={{ color: 'var(--theme-primary, #00d4ff)', fontWeight: 800 }}>
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
              paddingLeft: '4px',
              transition: 'transform 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default BodyMuscleMap;
