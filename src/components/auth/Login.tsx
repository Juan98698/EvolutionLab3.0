import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabase } from '../../context/SupabaseContext';
import { supabase } from '../../lib/supabaseClient';
import { isRealEmailDomain } from '../../lib/validations';

function LoginAccordion({
  title,
  open,
  onToggle,
  children,
  accentColor,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  accentColor: string;
}) {
  return (
    <div style={{ width: '100%' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '12px 16px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: `1px solid ${accentColor}33`,
          borderRadius: open ? '12px 12px 0 0' : '12px',
          color: 'white',
          fontFamily: "'Orbitron', sans-serif",
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: accentColor, boxShadow: `0 0 8px ${accentColor}` }} />
          {title}
        </span>
        <span style={{ color: accentColor, fontSize: '10px' }}>{open ? '▲' : '▼'}</span>
      </button>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          opacity: open ? 1 : 0,
          overflow: 'hidden',
          transition: 'grid-template-rows 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease',
          border: `1px solid ${accentColor}22`,
          borderTop: open ? 'none' : `1px solid ${accentColor}22`,
          borderRadius: '0 0 12px 12px',
          background: 'rgba(255, 255, 255, 0.02)',
        }}
      >
        <div
          style={{
            minHeight: '0px',
            padding: open ? '16px' : '0px',
            transition: 'padding 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

interface BiomechanicalSimulatorProps {
  pri: string;
  sec: string;
  theme: string;
  themeStyles: any;
}

const BiomechanicalSimulator: React.FC<BiomechanicalSimulatorProps> = ({ pri, sec, theme, themeStyles }) => {
  const [demoOpen, setDemoOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  useEffect(() => {
    if (!demoOpen) setIsPlaying(false);
  }, [demoOpen]);
  const [activeExercise, setActiveExercise] = useState<'squat' | 'bench' | 'deadlift' | 'hipthrust'>('squat');
  const [viewAngle, setViewAngle] = useState<'lateral' | 'frontal' | 'cenital'>('lateral');
  const [tempoConfig, setTempoConfig] = useState<'standard' | 'slow' | 'power'>('standard');
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [metrics, setMetrics] = useState({
    phase: 'Excéntrica (Descenso)',
    velocity: 0,
    acceleration: 0,
    power: 0,
    yPercent: 0
  });



  useEffect(() => {
    if (!isPlaying || !demoOpen) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let accumulatedTime = 0;

    const tempos = {
      standard: [2.5, 1.0, 1.2, 0.8],
      slow: [4.0, 2.0, 1.5, 1.0],
      power: [1.2, 0.2, 0.8, 0.8],
    };

    const update = (time: number) => {
      const dt = ((time - lastTime) / 1000) * speedMultiplier;
      lastTime = time;
      accumulatedTime += dt;

      const [tDescent, tPause, tAscent, tTop] = tempos[tempoConfig];
      const totalDuration = tDescent + tPause + tAscent + tTop;
      const cycleTime = accumulatedTime % totalDuration;

      let y = 0;
      let vel = 0;
      let acc = 0;
      let pow = 0;
      let phase = 'Excéntrica';

      if (cycleTime < tDescent) {
        phase = 'Excéntrica (Descenso)';
        const p = cycleTime / tDescent;
        y = (1 - Math.cos(p * Math.PI)) / 2;
        const maxVel = 1.5 / tDescent;
        vel = -maxVel * Math.sin(p * Math.PI);
        acc = -(Math.PI * maxVel / tDescent) * Math.cos(p * Math.PI);
        pow = Math.abs(vel) * 180;
      } else if (cycleTime < tDescent + tPause) {
        phase = 'Pausa Isométrica';
        y = 1.0;
        vel = 0;
        acc = 0;
        pow = 40;
      } else if (cycleTime < tDescent + tPause + tAscent) {
        phase = 'Concéntrica (Empuje)';
        const p = (cycleTime - tDescent - tPause) / tAscent;
        y = 1.0 - Math.sin((p * Math.PI) / 2);
        const maxVel = 2.2 / tAscent;
        vel = maxVel * Math.cos((p * Math.PI) / 2);
        acc = -(Math.PI / (2 * tAscent)) * maxVel * Math.sin((p * Math.PI) / 2);
        pow = vel * 480;
      } else {
        phase = 'Bloqueo (Final)';
        y = 0.0;
        vel = 0;
        acc = 0;
        pow = 10;
      }

      setMetrics({
        phase,
        velocity: parseFloat(vel.toFixed(2)),
        acceleration: parseFloat(acc.toFixed(2)),
        power: Math.round(pow),
        yPercent: y * 100
      });

      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, demoOpen, tempoConfig, speedMultiplier, activeExercise]);

  const t = metrics.yPercent / 100;

  return (
    <LoginAccordion
      title="Ver demo biomecánico"
      open={demoOpen}
      onToggle={() => {
        setDemoOpen((v) => {
          const next = !v;
          if (next) setIsPlaying(true);
          return next;
        });
      }}
      accentColor={sec}
    >
      <div className="origin-card" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box', margin: 0 }}>
        
        {/* Header: Title + Exercise Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h5 style={{ margin: 0, fontSize: '12px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700, letterSpacing: '0.5px', color: pri, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: pri, boxShadow: `0 0 10px ${pri}`, animation: 'pulse 1.5s infinite' }}></span>
            SIMULADOR BIOMECÁNICO
          </h5>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {(['squat', 'bench', 'deadlift', 'hipthrust'] as const).map((ex) => (
              <button key={ex} onClick={() => setActiveExercise(ex)} style={{
                background: activeExercise === ex ? themeStyles[theme].btnGradient : 'rgba(255,255,255,0.03)',
                border: `1px solid ${activeExercise === ex ? pri : 'rgba(255,255,255,0.08)'}`,
                color: activeExercise === ex ? (theme === 'monochrome' ? '#000' : '#fff') : 'rgba(255,255,255,0.6)',
                fontWeight: activeExercise === ex ? 800 : 500,
                padding: '4px 8px', borderRadius: '20px', fontSize: '9px',
                fontFamily: "'Orbitron', sans-serif", cursor: 'pointer',
                transition: 'all 0.25s ease', textTransform: 'uppercase', letterSpacing: '0.5px',
                boxShadow: activeExercise === ex ? `0 0 12px ${pri}44` : 'none'
              }}>
                {ex === 'squat' ? 'Sentadilla' : ex === 'bench' ? 'Banca' : ex === 'deadlift' ? 'P. Muerto' : 'Hip Thrust'}
              </button>
            ))}
          </div>
        </div>

        {/* Canvas + Telemetry Grid */}
        <div className="carousel-inner-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'center' }}>
          
          {/* SVG BIOMECHANICAL CANVAS */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)', borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.04)', padding: '12px',
            position: 'relative', height: '210px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.6)'
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
              backgroundSize: '15px 15px', pointerEvents: 'none'
            }} />

            <div style={{
              position: 'absolute', top: '8px', left: '8px', zIndex: 3,
              background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px', padding: '2px 7px',
              fontSize: '7px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700,
              color: pri, letterSpacing: '1px', textTransform: 'uppercase'
            }}>
              {viewAngle === 'lateral' ? 'VISTA LATERAL' : viewAngle === 'frontal' ? 'VISTA FRONTAL' : 'VISTA CENITAL'}
            </div>

            {viewAngle !== 'cenital' && (
              <div style={{ position: 'absolute', right: '12px', top: '25px', bottom: '25px', width: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
                <div style={{
                  position: 'absolute', top: `${metrics.yPercent}%`, left: '-4px',
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: pri, boxShadow: `0 0 10px ${pri}`,
                  transition: 'top 0.05s linear'
                }} />
                <span style={{ position: 'absolute', right: '12px', top: `${metrics.yPercent}%`, transform: 'translateY(-50%)', fontSize: '8px', color: pri, fontFamily: 'monospace', fontWeight: 'bold' }}>
                  {Math.round(metrics.yPercent)}%
                </span>
              </div>
            )}

            <svg width="100%" height="100%" viewBox="0 0 300 190" style={{ zIndex: 1 }}>
              {viewAngle !== 'cenital' && (
                <line x1="15" y1="165" x2="270" y2="165" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3 3" />
              )}
              {/* SQUAT - LATERAL */}
              {activeExercise === 'squat' && viewAngle === 'lateral' && (
                <g>
                  <line x1="75" y1="165" x2="75" y2="30" stroke="rgba(255,255,255,0.05)" strokeWidth="2.5" />
                  <line x1="225" y1="165" x2="225" y2="30" stroke="rgba(255,255,255,0.05)" strokeWidth="2.5" />
                  <line x1="75" y1="52" x2="90" y2="52" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                  <line x1="225" y1="52" x2="210" y2="52" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                  <ellipse cx="136" cy="164" rx="8" ry="3" fill="rgba(255,255,255,0.1)" />
                  <ellipse cx="164" cy="164" rx="8" ry="3" fill="rgba(255,255,255,0.1)" />
                  <line x1="136" y1="162" x2={134 - t * 14} y2={132 + t * 18} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="164" y1="162" x2={166 + t * 14} y2={132 + t * 18} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1={134 - t * 14} y1={132 + t * 18} x2="150" y2={90 + t * 52} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1={166 + t * 14} y1={132 + t * 18} x2="150" y2={90 + t * 52} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="150" y1={90 + t * 52} x2={150 + t * 5} y2={52 + t * 56} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="7" strokeLinecap="round" />
                  <circle cx={150 + t * 4} cy={38 + t * 56} r="9" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                  <line x1={142 + t * 4} y1={36 + t * 56} x2={150 + t * 4} y2={36 + t * 56} stroke={pri} strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx={134 - t * 14} cy={132 + t * 18} r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx={166 + t * 14} cy={132 + t * 18} r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx="150" cy={90 + t * 52} r="4.5" fill="#000" stroke={pri} strokeWidth="2" />
                  <circle cx={150 + t * 5} cy={52 + t * 56} r="3.5" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <line x1="136" y1="162" x2={134 - t * 14} y2={132 + t * 18} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="164" y1="162" x2={166 + t * 14} y2={132 + t * 18} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1={134 - t * 14} y1={132 + t * 18} x2="150" y2={90 + t * 52} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1={166 + t * 14} y1={132 + t * 18} x2="150" y2={90 + t * 52} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="150" y1={90 + t * 52} x2={150 + t * 5} y2={52 + t * 56} stroke={pri} strokeWidth="1.5" strokeDasharray="2 3" />
                  <line x1="78" y1={52 + t * 56} x2="222" y2={52 + t * 56} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="78" y1={52 + t * 56} x2="222" y2={52 + t * 56} stroke={pri} strokeWidth="7" opacity="0.2" strokeLinecap="round" />
                  <rect x="60" y={42 + t * 56} width="14" height="20" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                  <rect x="48" y={37 + t * 56} width="10" height="30" rx="2" fill={pri} opacity="0.8" />
                  <rect x="226" y={42 + t * 56} width="14" height="20" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                  <rect x="242" y={37 + t * 56} width="10" height="30" rx="2" fill={pri} opacity="0.8" />
                </g>
              )}
              {/* SQUAT - FRONTAL */}
              {activeExercise === 'squat' && viewAngle === 'frontal' && (
                <g>
                  <ellipse cx="118" cy="164" rx="8" ry="3" fill="rgba(255,255,255,0.1)" />
                  <ellipse cx="182" cy="164" rx="8" ry="3" fill="rgba(255,255,255,0.1)" />
                  <line x1="118" y1="162" x2={118 - t * 16} y2={130 + t * 16} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="182" y1="162" x2={182 + t * 8} y2={130 + t * 16} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1={118 - t * 16} y1={130 + t * 16} x2="150" y2={95 + t * 38} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1={182 + t * 16} y1={130 + t * 16} x2="150" y2={95 + t * 38} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="150" y1={95 + t * 38} x2="150" y2={56 + t * 44} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="7" strokeLinecap="round" />
                  <line x1={112 - t * 4} y1={56 + t * 44} x2={188 + t * 4} y2={56 + t * 44} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5" strokeLinecap="round" />
                  <circle cx="150" cy={40 + t * 44} r="9" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                  <line x1="144" y1={38 + t * 44} x2="156" y2={38 + t * 44} stroke={pri} strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx={118 - t * 16} cy={130 + t * 16} r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx={182 + t * 16} cy={130 + t * 16} r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx="150" cy={95 + t * 38} r="4.5" fill="#000" stroke={pri} strokeWidth="2" />
                  <circle cx="150" cy={56 + t * 44} r="3.5" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <line x1="118" y1="162" x2={118 - t * 16} y2={130 + t * 16} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="182" y1="162" x2={182 + t * 8} y2={130 + t * 16} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1={118 - t * 16} y1={130 + t * 16} x2="150" y2={95 + t * 38} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1={182 + t * 16} y1={130 + t * 16} x2="150" y2={95 + t * 38} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="150" y1={95 + t * 38} x2="150" y2={56 + t * 44} stroke={pri} strokeWidth="1.5" strokeDasharray="2 3" />
                  <line x1="55" y1={56 + t * 44} x2="245" y2={56 + t * 44} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="55" y1={56 + t * 44} x2="245" y2={56 + t * 44} stroke={pri} strokeWidth="7" opacity="0.2" strokeLinecap="round" />
                  <rect x="38" y={46 + t * 44} width="14" height="20" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                  <rect x="248" y={46 + t * 44} width="14" height="20" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                </g>
              )}
              {/* SQUAT - CENITAL */}
              {activeExercise === 'squat' && viewAngle === 'cenital' && (
                <g>
                  <line x1="150" y1="15" x2="150" y2="185" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="30" y1="55" x2="270" y2="55" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  <line x1="30" y1="55" x2="270" y2="55" stroke={pri} strokeWidth="8" opacity="0.15" strokeLinecap="round" />
                  <rect x="15" y="43" width="12" height="24" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                  <rect x="273" y="43" width="12" height="24" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                  <rect x="108" y="50" width="84" height="16" rx="6" fill="rgba(255,255,255,0.04)" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="2.5" />
                  <rect x="120" y="66" width="60" height="40" rx="8" fill="rgba(255,255,255,0.08)" stroke="rgba(241, 245, 249, 0.5)" strokeWidth="1.5" />
                  <rect x="115" y="106" width="70" height="14" rx="6" fill="rgba(255,255,255,0.04)" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="2.5" />
                  <line x1="128" y1="120" x2={122 - t * 14} y2="145" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="172" y1="120" x2={178 + t * 14} y2="145" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <circle cx="150" cy="50" r="10" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                  <line x1="144" y1="46" x2="156" y2="46" stroke={pri} strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx={122 - t * 14} cy="147" r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx={178 + t * 14} cy="147" r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <line x1="128" y1="120" x2={122 - t * 14} y2="145" stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="172" y1="120" x2={178 + t * 14} y2="145" stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <ellipse cx={118 - t * 6} cy="168" rx="6" ry="10" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                  <ellipse cx={182 + t * 6} cy="168" rx="6" ry="10" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                  <line x1={118 - t * 6} y1="182" x2={182 + t * 6} y2="182" stroke={pri} strokeWidth="0.5" opacity="0.5" />
                  <text x="150" y="189" textAnchor="middle" fill={pri} fontSize="7" fontFamily="'Orbitron', sans-serif" opacity="0.6">
                    STANCE {Math.round(64 + t * 20)}cm
                  </text>
                </g>
              )}
              {/* BENCH PRESS - LATERAL */}
              {activeExercise === 'bench' && viewAngle === 'lateral' && (
                <g>
                  <rect x="68" y="120" width="140" height="10" rx="3" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                  <line x1="82" y1="130" x2="82" y2="165" stroke="rgba(255,255,255,0.15)" strokeWidth="3" strokeLinecap="round" />
                  <line x1="194" y1="130" x2="194" y2="165" stroke="rgba(255,255,255,0.15)" strokeWidth="3" strokeLinecap="round" />
                  <line x1="76" y1="120" x2="76" y2="55" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                  <line x1="88" y1="120" x2="88" y2="55" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                  <line x1="76" y1="68" x2="85" y2="68" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                  <line x1="88" y1="68" x2="97" y2="68" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                  <path d={`M 82,114 Q 82,108 92,108 L 190,112 Q 200,112 200,116`} fill="rgba(255,255,255,0.05)" stroke="rgba(241, 245, 249, 0.5)" strokeWidth="2.5" />
                  <circle cx="78" cy="110" r="9" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                  <line x1="76" y1="106" x2="84" y2="106" stroke={pri} strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="112" y1="114" x2={114 - t * 18} y2={82 + t * 34} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1={114 - t * 18} y1={82 + t * 34} x2="122" y2={56 + t * 52} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="188" y1="118" x2="198" y2="138" stroke="rgba(241, 245, 249, 0.5)" strokeWidth="4.5" strokeLinecap="round" />
                  <line x1="198" y1="138" x2="195" y2="162" stroke="rgba(241, 245, 249, 0.5)" strokeWidth="4.5" strokeLinecap="round" />
                  <circle cx="195" cy="163" r="2.5" fill="rgba(255,255,255,0.2)" />
                  <circle cx="112" cy="114" r="3.5" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx={114 - t * 18} cy={82 + t * 34} r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <line x1="112" y1="114" x2={114 - t * 18} y2={82 + t * 34} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1={114 - t * 18} y1={82 + t * 34} x2="122" y2={56 + t * 52} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <circle cx="122" cy={56 + t * 52} r="4" fill="rgba(255,255,255,0.3)" stroke="#fff" strokeWidth="1.5" />
                  <rect x="108" y={44 + t * 52} width="10" height="24" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                  <rect x="98" y={40 + t * 52} width="8" height="32" rx="2" fill={pri} opacity="0.7" />
                  <line x1="122" y1="56" x2="122" y2="108" stroke={pri} strokeWidth="0.5" opacity="0.2" strokeDasharray="2 2" />
                </g>
              )}
              {/* BENCH PRESS - FRONTAL */}
              {activeExercise === 'bench' && viewAngle === 'frontal' && (
                <g>
                  <rect x="135" y="105" width="30" height="60" rx="3" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  <line x1="140" y1="165" x2="140" y2="162" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
                  <line x1="160" y1="165" x2="160" y2="162" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
                  <ellipse cx="150" cy="108" rx="42" ry="18" fill="rgba(255,255,255,0.05)" stroke="rgba(241, 245, 249, 0.5)" strokeWidth="2.5" />
                  <circle cx="150" cy="82" r="9" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                  <line x1="144" y1="80" x2="156" y2="80" stroke={pri} strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="92" y1="105" x2="208" y2="105" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="6" strokeLinecap="round" />
                  <line x1="92" y1="105" x2={88 - t * 28} y2={72 + t * 36} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="208" y1="105" x2={212 + t * 28} y2={72 + t * 36} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1={88 - t * 28} y1={72 + t * 36} x2="92" y2={40 + t * 58} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1={212 + t * 28} y1={72 + t * 36} x2="208" y2={40 + t * 58} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <circle cx="92" cy="105" r="3.5" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx="208" cy="105" r="3.5" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx={88 - t * 28} cy={72 + t * 36} r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx={212 + t * 28} cy={72 + t * 36} r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <line x1="92" y1="105" x2={88 - t * 28} y2={72 + t * 36} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="208" y1="105" x2={212 + t * 28} y2={72 + t * 36} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1={88 - t * 28} y1={72 + t * 36} x2="92" y2={40 + t * 58} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1={212 + t * 28} y1={72 + t * 36} x2="208" y2={40 + t * 58} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="35" y1={40 + t * 58} x2="265" y2={40 + t * 58} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="35" y1={40 + t * 58} x2="265" y2={40 + t * 58} stroke={pri} strokeWidth="7" opacity="0.2" strokeLinecap="round" />
                  <rect x="18" y={28 + t * 58} width="14" height="24" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                  <rect x="268" y={28 + t * 58} width="14" height="24" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                  <circle cx="92" cy={40 + t * 58} r="3" fill="rgba(255,255,255,0.4)" />
                  <circle cx="208" cy={40 + t * 58} r="3" fill="rgba(255,255,255,0.4)" />
                </g>
              )}
              {/* BENCH PRESS - CENITAL */}
              {activeExercise === 'bench' && viewAngle === 'cenital' && (
                <g>
                  <line x1="150" y1="10" x2="150" y2="185" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="3 3" />
                  <rect x="128" y="40" width="44" height="120" rx="4" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  <ellipse cx="150" cy="95" rx="38" ry="50" fill="rgba(255,255,255,0.05)" stroke="rgba(241, 245, 249, 0.5)" strokeWidth="1.5" />
                  <circle cx="150" cy="42" r="9" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                  <line x1="144" y1="38" x2="156" y2="38" stroke={pri} strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="112" y1="68" x2="188" y2="68" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="6" strokeLinecap="round" />
                  <line x1="112" y1="68" x2={80 - t * 22} y2={82 + t * 5} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="188" y1="68" x2={220 + t * 22} y2={82 + t * 5} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1={80 - t * 22} y1={82 + t * 5} x2={95} y2={56 + t * 10} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1={220 + t * 22} y1={82 + t * 5} x2={205} y2={56 + t * 10} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <circle cx="112" cy="68" r="3.5" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx="188" cy="68" r="3.5" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx={80 - t * 22} cy={82 + t * 5} r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx={220 + t * 22} cy={82 + t * 5} r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <line x1="112" y1="68" x2={80 - t * 22} y2={82 + t * 5} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="188" y1="68" x2={220 + t * 22} y2={82 + t * 5} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1={80 - t * 22} y1={82 + t * 5} x2={95} y2={56 + t * 10} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1={220 + t * 22} y1={82 + t * 5} x2={205} y2={56 + t * 10} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="25" y1={56 + t * 10} x2="275" y2={56 + t * 10} stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  <line x1="25" y1={56 + t * 10} x2="275" y2={56 + t * 10} stroke={pri} strokeWidth="8" opacity="0.12" strokeLinecap="round" />
                  <rect x="10" y={44 + t * 10} width="12" height="24" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                  <rect x="278" y={44 + t * 10} width="12" height="24" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                  <line x1="95" y1={50 + t * 10} x2="205" y2={50 + t * 10} stroke={pri} strokeWidth="0.5" opacity="0.4" strokeDasharray="2 2" />
                  <text x="150" y={47 + t * 10} textAnchor="middle" fill={pri} fontSize="7" fontFamily="'Orbitron', sans-serif" opacity="0.5">
                    GRIP 81cm
                  </text>
                </g>
              )}
              {/* HIP THRUST - LATERAL */}
              {activeExercise === 'hipthrust' && viewAngle === 'lateral' && (
                <g>
                  <rect x="200" y="100" width="48" height="65" rx="3" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                  <text x="224" y="138" textAnchor="middle" fill="rgba(255,255,255,0.06)" fontSize="7" fontFamily="'Orbitron', sans-serif">BENCH</text>
                  <circle cx="220" cy="88" r="8" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                  <line x1="213" y1="84" x2="221" y2="84" stroke={pri} strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="212" y1="92" x2="200" y2="100" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="4" strokeLinecap="round" />
                  <line x1="200" y1="100" x2="148" y2={100 + t * 40} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="7" strokeLinecap="round" />
                  <line x1="148" y1={100 + t * 40} x2="108" y2={102 + t * 24} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="108" y1={102 + t * 24} x2="105" y2="162" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <ellipse cx="105" cy="164" rx="10" ry="3" fill="rgba(255,255,255,0.1)" />
                  <line x1="195" y1="104" x2="170" y2={100 + t * 40} stroke="rgba(241, 245, 249, 0.5)" strokeWidth="4.5" strokeLinecap="round" />
                  <line x1="195" y1="104" x2="132" y2={100 + t * 40} stroke="rgba(241, 245, 249, 0.5)" strokeWidth="4.5" strokeLinecap="round" />
                  <circle cx="200" cy="100" r="3.5" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx="148" cy={100 + t * 40} r="4" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx="108" cy={102 + t * 24} r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <line x1="200" y1="100" x2="148" y2={100 + t * 40} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="148" y1={100 + t * 40} x2="108" y2={102 + t * 24} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="108" y1={102 + t * 24} x2="105" y2="162" stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="120" y1={100 + t * 40} x2="176" y2={100 + t * 40} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="120" y1={100 + t * 40} x2="176" y2={100 + t * 40} stroke={pri} strokeWidth="7" opacity="0.2" strokeLinecap="round" />
                  <rect x="102" y={88 + t * 40} width="14" height="24" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                  <rect x="90" y={84 + t * 40} width="10" height="32" rx="2" fill={pri} opacity="0.7" />
                  <rect x="180" y={88 + t * 40} width="14" height="24" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                </g>
              )}
              {/* HIP THRUST - FRONTAL */}
              {activeExercise === 'hipthrust' && viewAngle === 'frontal' && (
                <g>
                  <rect x="95" y="96" width="110" height="20" rx="3" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  <line x1="105" y1="116" x2="105" y2="165" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                  <line x1="195" y1="116" x2="195" y2="165" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                  <circle cx="150" cy="80" r="9" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                  <line x1="144" y1="78" x2="156" y2="78" stroke={pri} strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="112" y1="100" x2="188" y2="100" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="150" y1="100" x2="150" y2={106 + t * 36} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="7" strokeLinecap="round" />
                  <line x1="135" y1={106 + t * 36} x2="118" y2="140" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="165" y1={106 + t * 36} x2="182" y2="140" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="118" y1="140" x2="118" y2="162" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="182" y1="140" x2="182" y2="162" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <ellipse cx="118" cy="164" rx="8" ry="3" fill="rgba(255,255,255,0.1)" />
                  <ellipse cx="182" cy="164" rx="8" ry="3" fill="rgba(255,255,255,0.1)" />
                  <line x1="112" y1="100" x2="105" y2={106 + t * 36} stroke="rgba(241, 245, 249, 0.5)" strokeWidth="4.5" strokeLinecap="round" />
                  <line x1="188" y1="100" x2="195" y2={106 + t * 36} stroke="rgba(241, 245, 249, 0.5)" strokeWidth="4.5" strokeLinecap="round" />
                  <circle cx="112" cy="100" r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx="188" cy="100" r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx="150" cy={106 + t * 36} r="4.5" fill="#000" stroke={pri} strokeWidth="2" />
                  <circle cx="118" cy="140" r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx="182" cy="140" r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <line x1="150" y1="100" x2="150" y2={106 + t * 36} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="135" y1={106 + t * 36} x2="118" y2="140" stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="165" y1={106 + t * 36} x2="182" y2="140" stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="118" y1="140" x2="118" y2="162" stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="182" y1="140" x2="182" y2="162" stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="42" y1={106 + t * 36} x2="258" y2={106 + t * 36} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="42" y1={106 + t * 36} x2="258" y2={106 + t * 36} stroke={pri} strokeWidth="7" opacity="0.2" strokeLinecap="round" />
                  <rect x="25" y={94 + t * 36} width="14" height="24" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                  <rect x="261" y={94 + t * 36} width="14" height="24" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                </g>
              )}
              {/* HIP THRUST - CENITAL */}
              {activeExercise === 'hipthrust' && viewAngle === 'cenital' && (
                <g>
                  <line x1="150" y1="10" x2="150" y2="185" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="3 3" />
                  <rect x="100" y="22" width="100" height="30" rx="4" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  <text x="150" y="40" textAnchor="middle" fill="rgba(255,255,255,0.08)" fontSize="8" fontFamily="'Orbitron', sans-serif">BENCH</text>
                  <ellipse cx="150" cy="55" rx="38" ry="10" fill="rgba(255,255,255,0.04)" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="2.5" />
                  <rect x="122" y="65" width="56" height="35" rx="8" fill="rgba(255,255,255,0.08)" stroke="rgba(241, 245, 249, 0.5)" strokeWidth="1.5" />
                  <ellipse cx="150" cy="108" rx="35" ry="10" fill="rgba(255,255,255,0.04)" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="2.5" />
                  <line x1="132" y1="118" x2="122" y2="148" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="168" y1="118" x2="178" y2="148" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="122" y1="153" x2="120" y2="170" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="178" y1="153" x2="180" y2="170" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <circle cx="150" cy="42" r="9" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                  <line x1="144" y1="38" x2="156" y2="38" stroke={pri} strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="122" cy="150" r="3.5" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx="178" cy="150" r="3.5" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <line x1="132" y1="118" x2="122" y2="148" stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="168" y1="118" x2="178" y2="148" stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="122" y1="153" x2="120" y2="170" stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="178" y1="153" x2="180" y2="170" stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <ellipse cx="120" cy="175" rx="6" ry="8" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                  <ellipse cx="180" cy="175" rx="6" ry="8" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                  <line x1="30" y1="108" x2="270" y2="108" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  <line x1="30" y1="108" x2="270" y2="108" stroke={pri} strokeWidth="8" opacity="0.12" strokeLinecap="round" />
                  <rect x="15" y="96" width="12" height="24" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                  <rect x="273" y="96" width="12" height="24" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                </g>
              )}
              {/* DEADLIFT - LATERAL */}
              {activeExercise === 'deadlift' && viewAngle === 'lateral' && (
                <g>
                  <ellipse cx="135" cy="164" rx="8" ry="3" fill="rgba(255,255,255,0.1)" />
                  <line x1="135" y1="162" x2={135 - t * 15} y2={132 + t * 8} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1={135 - t * 15} y1={132 + t * 8} x2={150 + t * 30} y2={98 + t * 30} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1={150 + t * 30} y1={98 + t * 30} x2={135 + t * 12} y2={56 + t * 44} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="7" strokeLinecap="round" />
                  <circle cx={132 + t * 12} cy={40 + t * 44} r="9" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                  <line x1={124 + t * 12} y1={38 + t * 44} x2={132 + t * 12} y2={38 + t * 44} stroke={pri} strokeWidth="1.5" strokeLinecap="round" />
                  <line x1={135 + t * 12} y1={56 + t * 44} x2="135" y2={96 + t * 59} stroke="rgba(241, 245, 249, 0.6)" strokeWidth="4.5" strokeLinecap="round" />
                  <circle cx={135 - t * 15} cy={132 + t * 8} r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx={150 + t * 30} cy={98 + t * 30} r="4" fill="#000" stroke={pri} strokeWidth="2" />
                  <circle cx={135 + t * 12} cy={56 + t * 44} r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <line x1="135" y1="162" x2={135 - t * 15} y2={132 + t * 8} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1={135 - t * 15} y1={132 + t * 8} x2={150 + t * 30} y2={98 + t * 30} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1={150 + t * 30} y1={98 + t * 30} x2={135 + t * 12} y2={56 + t * 44} stroke={pri} strokeWidth="1.5" strokeDasharray="2 3" />
                  <line x1={135 + t * 12} y1={56 + t * 44} x2="135" y2={96 + t * 59} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="135" y1="56" x2="135" y2="160" stroke={pri} strokeWidth="0.5" opacity="0.25" strokeDasharray="3 3" />
                  <circle cx="135" cy={96 + t * 59} r="4" fill="rgba(255,255,255,0.3)" stroke="#fff" strokeWidth="1.5" />
                  <rect x="122" y={84 + t * 59} width="10" height="24" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                  <rect x="112" y={80 + t * 59} width="8" height="32" rx="2" fill={pri} opacity="0.7" />
                </g>
              )}
              {/* DEADLIFT - FRONTAL */}
              {activeExercise === 'deadlift' && viewAngle === 'frontal' && (
                <g>
                  <ellipse cx="120" cy="164" rx="8" ry="3" fill="rgba(255,255,255,0.1)" />
                  <ellipse cx="182" cy="164" rx="8" ry="3" fill="rgba(255,255,255,0.1)" />
                  <line x1="120" y1="162" x2={120 - t * 8} y2={132 + t * 6} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="182" y1="162" x2={182 + t * 8} y2={132 + t * 6} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1={120 - t * 8} y1={132 + t * 6} x2="150" y2={98 + t * 30} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1={182 + t * 8} y1={132 + t * 6} x2="150" y2={98 + t * 30} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="150" y1={98 + t * 30} x2="150" y2={58 + t * 42} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="7" strokeLinecap="round" />
                  <line x1={112 - t * 2} y1={58 + t * 42} x2={188 + t * 2} y2={58 + t * 42} stroke="rgba(241, 245, 249, 0.85)" strokeWidth="5" strokeLinecap="round" />
                  <circle cx="150" cy={42 + t * 42} r="9" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                  <line x1="144" y1={40 + t * 42} x2="156" y2={40 + t * 42} stroke={pri} strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx={120 - t * 8} cy={132 + t * 6} r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx={182 + t * 8} cy={132 + t * 6} r="3" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <circle cx="150" cy={98 + t * 30} r="4.5" fill="#000" stroke={pri} strokeWidth="2" />
                  <circle cx="150" cy={58 + t * 42} r="3.5" fill="#000" stroke={pri} strokeWidth="1.5" />
                  <line x1="120" y1="162" x2={120 - t * 8} y2={132 + t * 6} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="182" y1="162" x2={182 + t * 8} y2={132 + t * 6} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1={120 - t * 8} y1={132 + t * 6} x2="150" y2={98 + t * 30} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1={182 + t * 8} y1={132 + t * 6} x2="150" y2={98 + t * 30} stroke={pri} strokeWidth="1.2" strokeDasharray="2 3" />
                  <line x1="150" y1={98 + t * 30} x2="150" y2={58 + t * 42} stroke={pri} strokeWidth="1.5" strokeDasharray="2 3" />
                  <line x1="50" y1={102 + t * 59} x2="250" y2={102 + t * 59} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="50" y1={102 + t * 59} x2="250" y2={102 + t * 59} stroke={pri} strokeWidth="7" opacity="0.2" strokeLinecap="round" />
                  <rect x="33" y={92 + t * 59} width="14" height="20" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                  <rect x="253" y={92 + t * 59} width="14" height="20" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                  <line x1={112 - t * 2} y1={58 + t * 42} x2="135" y2={102 + t * 59} stroke="rgba(241, 245, 249, 0.6)" strokeWidth="4.5" strokeLinecap="round" />
                  <line x1={188 + t * 2} y1={58 + t * 42} x2="165" y2={102 + t * 59} stroke="rgba(241, 245, 249, 0.6)" strokeWidth="4.5" strokeLinecap="round" />
                </g>
              )}
              {/* DEADLIFT - CENITAL */}
              {activeExercise === 'deadlift' && viewAngle === 'cenital' && (
                <g>
                  <line x1="150" y1="15" x2="150" y2="185" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="25" y1="102" x2="275" y2="102" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  <line x1="25" y1="102" x2="275" y2="102" stroke={pri} strokeWidth="8" opacity="0.12" strokeLinecap="round" />
                  <rect x="10" y="90" width="12" height="24" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                  <rect x="278" y="90" width="12" height="24" rx="2" fill={sec} stroke={pri} strokeWidth="1" />
                  <rect x="110" y="70" width="80" height="15" rx="6" fill="rgba(255,255,255,0.04)" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="2.5" />
                  <rect x="122" y="85" width="56" height="35" rx="8" fill="rgba(255,255,255,0.08)" stroke="rgba(241, 245, 249, 0.5)" strokeWidth="1.5" />
                  <rect x="115" y="120" width="70" height="14" rx="6" fill="rgba(255,255,255,0.04)" stroke="rgba(241, 245, 249, 0.85)" strokeWidth="2.5" />
                  <circle cx="150" cy="70" r="10" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                  <line x1="144" y1="66" x2="156" y2="66" stroke={pri} strokeWidth="1.5" strokeLinecap="round" />
                  <ellipse cx="120" cy="145" rx="6" ry="10" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                  <ellipse cx="180" cy="145" rx="6" ry="10" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                  <line x1="112" y1="72" x2="116" y2="102" stroke="rgba(241, 245, 249, 0.6)" strokeWidth="4.5" strokeLinecap="round" />
                  <line x1="188" y1="72" x2="184" y2="102" stroke="rgba(241, 245, 249, 0.6)" strokeWidth="4.5" strokeLinecap="round" />
                  <circle cx="116" cy="102" r="2.5" fill="rgba(255,255,255,0.4)" />
                  <circle cx="184" cy="102" r="2.5" fill="rgba(255,255,255,0.4)" />
                </g>
              )}
            </svg>
          </div>

          {/* TELEMETRY */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '16px', padding: '12px', boxSizing: 'border-box' }}>
            <span style={{ fontSize: '7px', color: pri, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, letterSpacing: '0.5px' }}>TELEMETRÍA EN VIVO</span>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '4px' }}>
              <span style={{ fontSize: '8px', opacity: 0.6 }}>Fase:</span>
              <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#fff' }}>{metrics.phase}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '4px' }}>
              <span style={{ fontSize: '8px', opacity: 0.6 }}>Velocidad:</span>
              <span style={{ fontSize: '8px', fontWeight: 'bold', fontFamily: 'monospace', color: metrics.velocity > 0 ? '#4adf8a' : '#fff' }}>
                {Math.abs(metrics.velocity)} m/s
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '4px' }}>
              <span style={{ fontSize: '8px', opacity: 0.6 }}>Aceleración:</span>
              <span style={{ fontSize: '8px', fontWeight: 'bold', fontFamily: 'monospace', color: '#fff' }}>
                {metrics.acceleration} m/s²
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '4px' }}>
              <span style={{ fontSize: '8px', opacity: 0.6 }}>Potencia Estimada:</span>
              <span style={{ fontSize: '8px', fontWeight: 'bold', fontFamily: 'monospace', color: pri }}>
                {metrics.power} W
              </span>
            </div>

            {/* View selectors */}
            <div style={{ display: 'flex', gap: '3px', marginTop: '6px', justifyContent: 'space-between' }}>
              {(['lateral', 'frontal', 'cenital'] as const).map((angle) => (
                <button key={angle} onClick={() => setViewAngle(angle)} style={{
                  background: viewAngle === angle ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: `1px solid ${viewAngle === angle ? pri : 'rgba(255,255,255,0.08)'}`,
                  color: viewAngle === angle ? pri : 'rgba(255,255,255,0.5)',
                  fontSize: '7px', fontFamily: "'Orbitron', sans-serif",
                  padding: '2px 5px', borderRadius: '4px', cursor: 'pointer',
                  fontWeight: viewAngle === angle ? 700 : 400, transition: 'all 0.2s ease',
                  textTransform: 'uppercase', flex: 1, textAlign: 'center'
                }}>
                  {angle === 'cenital' ? 'Cenit' : angle === 'frontal' ? 'Front' : 'Lat'}
                </button>
              ))}
            </div>

            {/* Tempos selectors */}
            <div style={{ display: 'flex', gap: '3px', marginTop: '4px', justifyContent: 'space-between' }}>
              {(['standard', 'slow', 'power'] as const).map((tp) => (
                <button key={tp} onClick={() => setTempoConfig(tp)} style={{
                  background: tempoConfig === tp ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: `1px solid ${tempoConfig === tp ? pri : 'rgba(255,255,255,0.08)'}`,
                  color: tempoConfig === tp ? pri : 'rgba(255,255,255,0.5)',
                  fontSize: '7px', fontFamily: "'Orbitron', sans-serif",
                  padding: '2px 6px', borderRadius: '5px', cursor: 'pointer',
                  fontWeight: tempoConfig === tp ? 700 : 400, transition: 'all 0.2s ease',
                  flex: 1, textTransform: 'uppercase', textAlign: 'center'
                }}>
                  {tp === 'standard' ? '3-1-1' : tp === 'slow' ? '4-2-1' : 'EXPLO'}
                </button>
              ))}
            </div>

            {/* Speed */}
            <button type="button" onClick={() => setSpeedMultiplier(speedMultiplier === 1 ? 0.5 : 1)} style={{
              background: speedMultiplier === 0.5 ? 'rgba(255,255,255,0.06)' : 'transparent',
              border: `1px solid ${speedMultiplier === 0.5 ? 'rgba(255,255,255,0.15)' : 'transparent'}`,
              color: speedMultiplier === 0.5 ? pri : 'rgba(255,255,255,0.5)',
              fontSize: '8px', fontFamily: "'Orbitron', sans-serif",
              padding: '2px 8px', borderRadius: '5px', cursor: 'pointer',
              fontWeight: speedMultiplier === 0.5 ? 700 : 400, transition: 'all 0.2s ease',
              marginTop: '4px', width: '100%'
            }}>
              {speedMultiplier === 0.5 ? '▶ CÁM.LENTA' : '▶ REAL'}
            </button>
          </div>

        </div>
        {/* END Canvas + Telemetry Grid */}

      </div>
    </LoginAccordion>
  );
};

const containerStyle = {
  flex: 1,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  overflow: 'hidden',
  borderRadius: '6px',
  height: '100%',
  minHeight: 0,
};

const imgStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover' as const,
  objectPosition: 'top' as const,
  background: '#0b0f19',
};

const AUDIENCE_DATA = {
  trainer: {
    accentColor: '#2dd4bf',
    slogan: 'Digitaliza tu asesoría, escala tu negocio y audita en tiempo real.',
    benefits: [], // Kept empty or omitted since we now render dynamic slides, but keep for type compatibility
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    slides: [
      {
        title: 'PANEL DEL COACH',
        subtitle: 'Gestión de Atletas',
        description: 'Un panel consolidado para visualizar a todos tus alumnos, su adherencia, nivel de fatiga y estado físico general de forma instantánea.',
        features: ['Indicador de adherencia visual (Semáforo)', 'Acceso directo a planificadores', 'Buscador y filtros avanzados de alumnos'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Panel_Del_Coach.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'GESTION DE ATLETAS',
        subtitle: 'Visualiza tus atletas',
        description: 'Lista detallada de deportistas vinculados, y accesos a su programación.',
        features: ['Registra y gestiona tus atletas', 'Gestiona su estado de vinculación', 'Visualización rápida con motor de buscqueda'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Gestion_Atletas.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'MOTOR DE SOBRECARGA',
        subtitle: 'Configura las condiciones de sobrecarga progresiva',
        description: 'El cerebro de Evolution Lab. Permite configurar reglas lógicas basadas en ciencia para auditar a tus atletas de manera automática.',
        features: ['Reglas científicas configurables a tu criterio', 'Umbrales de volumen objetivo', 'Detección automatizada de mesetas'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Motor_Sobrecarga.jpeg" alt="Captura 3" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'MOTOR DE SOBRECARGA',
        subtitle: 'Mas de 10 reglas configurables',
        description: 'Personaliza los umbrales de esfuerzo, RIR, series efectivas y fallos musculares para que el sistema audite por ti.',
        features: ['Configuración flexible por RIR', 'Control de series acumulativas', 'Filtro de volumen basura'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Motor_Sobrecarga_dos.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'PLANIFICA LOS ENTRENAMIENTOS',
        subtitle: 'Planificador flexible',
        description: 'Estructura el microciclo semanal de tus atletas, asignando las variables que consideres adecuadas por ejercicio de forma adaptativa.',
        features: ['Distribución semanal flexible', 'Ajuste dinámico de variables', 'Personalización de variables del entrenamiento'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Planifica_entrenamientos_dos.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'PLANIFICA LOS ENTRENAMIENTOS',
        subtitle: 'Instrucciones Técnicas Precisas',
        description: 'Asegura la ejecución perfecta vinculando notas personalizadas, vídeos tutoriales tuyos o de otros de youtube/Drive y GIFs explicativos.',
        features: ['Integración directa de vídeos explicativos', 'Notas de técnica y posicionamiento', 'Animaciones GIF automáticas sin internet'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Planifica_Entrenamientos.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'PERSONALIZA TU MARCA',
        subtitle: 'Tu Marca Personal',
        description: 'Evolution Lab se adapta a ti. Configura el logotipo, plasma tu identidad y usa la paleta de colores de tu preferencia.',
        features: ['Sistema de Marca Blanca', 'Tu Logotipo e identidad propia en PWA', 'Diseño de interfaz personalizado'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Personaliza_Tu_Marca.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'PERSONALIZA TU MARCA',
        subtitle: 'Plasmas tu Filosofía',
        description: 'Establece tu eslogan, transmite tu intención y perspectiva a través de pilares, tus atletas se sentiran mas famirializados contigo.',
        features: ['Muro de pilares y valores', 'Enlaces de contacto integrados', 'Canal directo de comunicación'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Personaliza_tu_Filosofia.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'AUDITA TUS ATLETAS',
        subtitle: 'Hub de Alertas',
        description: 'El centro de control te notifica inmediatamente si un deportista completó su sesión, se ha estancado o no registró su entrenamiento.',
        features: ['Notificación en vivo de entrenamientos', 'Detección de estancamientos', 'Auditoría automática por tus reglas impuestas'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Hub_De_Atletas.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'AUDITA TUS ATLETAS',
        subtitle: 'Visualiza entrenamientos en tiempo real',
        description: 'Revisa de forma remota las repeticiones, cargas y RIR reales completados en la última sesión de tu deportista.',
        features: ['Desglose exacto de series', 'Auditoría a distancia', 'Historial detallado del atleta', 'Visualiza a detalle como trabajaron tus atletas'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Audita_Tus_Atletas.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      }
    ]
  },
  solo: {
    accentColor: '#00d4ff',
    slogan: 'El motor de sobrecarga progresiva más potente en tu bolsillo.',
    benefits: [],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    slides: [
      {
        title: 'VISTA CLIENTE AUTÓNOMO',
        subtitle: 'Panel Central e Indicadores',
        description: 'Accede a tu resumen semanal de volumen, tus récords actuales de fuerza estimada (1RM) y el estado de tu rutina.',
        features: ['Calendario rápido de entrenamiento', 'Indicadores clave de volumen', 'Últimos logros desbloqueados'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Vista_Cliente_autonomo.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'PLANIFICACIÓN DEL PLAN',
        subtitle: 'Diseña tu Rutina Inteligente',
        description: 'Planifica y configura tus rutinas autónomamente ó Elige una plantilla de nuestra base de datos y define tus series objetivo.',
        features: ['Base de datos global de ejercicios', 'Estructuración por días de entreno', 'Definición precisa de objetivo y fecha'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Planificacion_Plan_CA.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'REGISTRO DE SESIONES',
        subtitle: 'Registra tus sesiones en el Gimnasio',
        description: 'Interfaz optimizada para registrar series, pesos, repeticiones y RIR en el fragor de la sala de pesas.',
        features: ['Esta información servira como base para el motor de sobrecarga', 'Copia rápida de series', 'RIR asistido por historial'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Registra_Sesiones_CA.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'HISTORIAL DE SESIONES',
        subtitle: 'Registro Histórico Completo',
        description: 'Consulta tus sesiones pasadas organizadas cronológicamente para comprobar tu adherencia al programa.',
        features: ['Filtrado por ejercicios en especifico', 'Indicadores de volumen de sesión', 'Resúmenes semanales consolidados'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Historial_Sesiones_CA.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'DETALLE DE LA SESIÓN',
        subtitle: 'Inspecciona tus Variables',
        description: 'Desglose exhaustivo de los pesos, repeticiones y RIR ejecutados en cualquier sesión de entrenamiento previa.',
        features: ['Detalle serie por serie', 'Comparación con marcas anteriores', 'Notas personales de la sesión'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Historial_Sesiones_dos_CA.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'MOTOR DE SOBRECARGA',
        subtitle: 'Auditoría Científica de Progreso',
        description: 'La app evalúa tus marcas y te indica si estás progresando en base a la sobrecarga progresiva científica que puede ser configurable a tu criterio.',
        features: ['Detección automática de estancamientos', 'Recomendaciones de carga/esfuerzo', 'Auditoría de consistencia'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Historial_Sobrecarga_CA.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'PROGRESIÓN POR CADA EJERCICIO',
        subtitle: 'Gráficos de Evolución Física',
        description: 'Visualiza la evolución actual de tu volumen efectivo de entrenamiento, tonelaje y fuerza máxima estimada.',
        features: ['Gráficas de volumen por ejercicio', 'Curvas históricas de fuerza', 'Métricas avanzadas de fatiga'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Vista_Progresion_CA.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'CALCULADORA 1RM',
        subtitle: 'Estima tu Fuerza Máxima',
        description: 'Determina tu Repetición Máxima (1RM) teórica a partir de tus levantamientos pesados de forma segura (el algoritmo puede usar la formula e epley, brzycki o el promedio de ambos).',
        features: ['Cálculo multiparámetro avanzado', 'Tabla de porcentajes de intensidad', 'Vincular peso y reps directamente a cada ejercicio'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Calculadora_1RM_CA.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'LOGROS Y MEDALLAS',
        subtitle: 'Gamificación Científica',
        description: 'Consigue medallas y récords desbloqueables a medida que mantienes consistencia y bates marcas de fuerza.',
        features: ['Histórico de récords logrados', 'Medallas de consistencia', 'Cada sesión te acerca a una recompensa'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Desbloquea_Logros_CA.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'NOTIFICACIONES',
        subtitle: 'Alertas de Rendimiento',
        description: 'Recibe alertas personalizadas sobre tus progresiones notables, recordatorios de rutinas y consejos de entrenamiento.',
        features: ['Notificaciones inteligentes', 'Ajustes automáticos semanales', 'Mensajes del motor de sobrecarga'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Recibe_Notificaciones_CA.jpeg" style={{ ...imgStyle, objectFit: 'contain' }} loading="lazy" />
          </div>
        )
      }
    ]
  },
  guided: {
    accentColor: '#00ff87',
    slogan: 'Ejecuta la rutina perfecta planificada por tu preparador físico.',
    benefits: [],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    slides: [
      {
        title: 'PORTADA DEL PLAN',
        subtitle: 'Acceso Directo y Bienvenida',
        description: 'La pantalla de inicio con la identidad de tu entrenador. Acceso instantáneo a la sesión de hoy y canales de chat.',
        features: ['Branding y marca del coach', 'Enlace directo de chat', 'Acceso directo a la sesión de hoy'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Vista_Portada_CG.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'PLAN PERSONALIZADO',
        subtitle: 'Visualiza tus Rutinas Asignadas',
        description: 'Consulta los microciclos, días y entrenamientos que tu coach ha estructurado especialmente para tus objetivos.',
        features: ['Calendario interactivo de rutinas', 'Variables técnicas objetivo', 'Instrucciones del plan del coach'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Plan_Personalizado_CG.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'REGISTRO DE SESIONES',
        subtitle: 'Registra y Sincroniza al Instante',
        description: 'Completa tus series en el gimnasio. Los datos de peso, repeticiones y fatiga RIR se envían directamente a tu coach.',
        features: ['Sincronización en la nube en tiempo real', 'Asistente de RIR y RPE', 'Visualizador de marcas anteriores'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Refistra_Sesiones_CG.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'HISTORIAL DE SESIONES',
        subtitle: 'Tus Entrenamientos Completados',
        description: 'Revisa de forma ordenada todo tu historial de entrenamientos completados bajo la dirección de tu preparador.',
        features: ['Calendario histórico de sesiones', 'Sesiones marcadas como auditadas', 'Resúmenes de adherencia deportiva'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Hitorial_Sesiones_CG.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'DETALLE DE LA SESIÓN',
        subtitle: 'Desglose Técnico de la Sesión',
        description: 'Visualiza las variables logradas y los comentarios técnicos que registraste o que tu coach te ha retroalimentado.',
        features: ['Desglose serie por serie', 'Comentarios del coach asignados', 'Comparativa contra objetivos planificados'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Historial_Sesiones_dos_CG.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'VISTA DE PROGRESIONES',
        subtitle: 'Tus Avances de Fuerza',
        description: 'Gráficos interactivos del progreso de tu fuerza estimada y volumen de series, compartidos directamente con tu coach.',
        features: ['Gráficas de fuerza máxima 1RM', 'Tonelaje levantado por sesión', 'Progreso de volumen semanal'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Vista_Progresiones_CG.jpeg" style={{ ...imgStyle, objectFit: 'contain' }} loading="lazy" />
          </div>
        )
      },
      {
        title: 'CALCULADORA 1RM',
        subtitle: 'Cálculo de Fuerza Máxima',
        description: 'Estima tu fuerza máxima para ajustar correctamente las cargas relativas (% del 1RM) prescritas por tu coach.',
        features: ['Cálculo rápido y libre de fallos', 'Tabla de intensidades de fuerza', 'Integrado con el plan del preparador'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Calculadore_1RM_CG.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'VIDEOS EXPLICATIVOS',
        subtitle: 'Vídeo Tutoriales de Técnica',
        description: 'Accede de forma directo al tutorial de Youtube de cada ejercicio vinculado por tu coach para entrenar con seguridad.',
        features: ['Ejecución técnica paso a paso', 'Evita lesiones en sala de musculación', 'Optimiza el reclutamiento motor'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Videos_Explicativos_CG.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'ANIMACIONES OFFLINE',
        subtitle: 'Guía de Técnica sin Conexión',
        description: '¿Entrenas en un sótano sin datos móviles? La PWA activa automáticamente animaciones GIF offline de técnica.',
        features: ['Carga automática sin internet', 'Animaciones de técnica fluidas', 'Independencia de conexión móvil'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Gifs_en_el_modo_oflline_CG.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      },
      {
        title: 'FILOSOFÍA DEL COACH',
        subtitle: 'Conoce los Pilares de tu Coach',
        description: 'Lee la visión, valores deportivos, pautas nutricionales y filosofía de vida redactadas especialmente por tu entrenador.',
        features: ['Pautas generales de adherencia', 'Visión y valores deportivos del coach', 'Consejos generales de estilo de vida'],
        content: (_color: string) => (
          <div style={containerStyle}>
            <img src="/capturas/Conoce_Filosofia_Entrenador_CG.jpeg" style={imgStyle} loading="lazy" />
          </div>
        )
      }
    ]
  }
};

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isTrainer, loading: authLoading } = useSupabase();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saberMasOpen, setSaberMasOpen] = useState(false);
  const [activeAudience, setActiveAudience] = useState<'trainer' | 'solo' | 'guided'>('trainer');
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Estados de Registro
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [registerRole, setRegisterRole] = useState<'cliente' | 'entrenador'>('cliente');
  const [registerWhatsapp, setRegisterWhatsapp] = useState('');
  const [trainerParam, setTrainerParam] = useState<string | null>(null);
  const [trainerName, setTrainerName] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const trainerId = params.get('trainer') || params.get('ref');
    if (trainerId) {
      setTrainerParam(trainerId);
      setIsRegisterMode(true);
      setRegisterRole('cliente');
      supabase
        .from('profiles')
        .select('nombre')
        .eq('id', trainerId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.nombre) {
            setTrainerName(data.nombre);
          }
        });
    }
  }, [location.search]);

  useEffect(() => {
    setCarouselIndex(0);
  }, [activeAudience]);

  const [isExiting, setIsExiting] = useState(false);
  const skipAutoRedirect = useRef(false);

  // ═══ Idea 6: Focus Mode Themes ═══
  const [theme, setTheme] = useState<'cyan' | 'cyberpunk' | 'monochrome' | 'green' | 'lava' | 'gold' | 'gothic'>(() => {
    const saved = localStorage.getItem('pwa_login_theme');
    return (saved === 'cyan' || saved === 'cyberpunk' || saved === 'monochrome' || saved === 'green' || saved === 'lava' || saved === 'gold' || saved === 'gothic') ? saved as any : 'cyan';
  });

  const [themeOpen, setThemeOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Suscribirse a cambios de tema globales
  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setTheme(detail);
    };
    window.addEventListener('pwa-theme-changed', handleThemeChange);
    return () => window.removeEventListener('pwa-theme-changed', handleThemeChange);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setThemeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  // Dynamic Theme Styling Tokens
  const themeStyles = {
    cyan: {
      primary: '#00d4ff',
      secondary: '#7b2ff7',
      glow: 'rgba(0, 212, 255, 0.15)',
      border: 'rgba(0, 212, 255, 0.2)',
      textGradient: 'linear-gradient(135deg, #00d4ff 30%, #7b2ff7 100%)',
      btnGradient: 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
      btnGlow: 'rgba(0, 212, 255, 0.25)',
      cardBg: 'rgba(15, 23, 42, 0.78)',
      cardHoverBorder: 'rgba(0, 212, 255, 0.3)',
      inputFocus: '#00d4ff',
      inputFocusGlow: 'rgba(0, 212, 255, 0.18)',
      badgeBg: 'rgba(0, 212, 255, 0.08)',
    },
    cyberpunk: {
      primary: '#ccff00',
      secondary: '#ff0055',
      glow: 'rgba(204, 255, 0, 0.15)',
      border: 'rgba(204, 255, 0, 0.2)',
      textGradient: 'linear-gradient(135deg, #ccff00 30%, #ff0055 100%)',
      btnGradient: 'linear-gradient(135deg, #ccff00 0%, #ff0055 100%)',
      btnGlow: 'rgba(204, 255, 0, 0.25)',
      cardBg: 'rgba(20, 10, 30, 0.86)',
      cardHoverBorder: 'rgba(204, 255, 0, 0.3)',
      inputFocus: '#ccff00',
      inputFocusGlow: 'rgba(204, 255, 0, 0.18)',
      badgeBg: 'rgba(204, 255, 0, 0.08)',
    },
    monochrome: {
      primary: '#ffffff',
      secondary: '#555555',
      glow: 'rgba(255, 255, 255, 0.1)',
      border: 'rgba(255, 255, 255, 0.15)',
      textGradient: 'linear-gradient(135deg, #ffffff 30%, #888888 100%)',
      btnGradient: 'linear-gradient(135deg, #ffffff 0%, #555555 100%)',
      btnGlow: 'rgba(255, 255, 255, 0.15)',
      cardBg: 'rgba(10, 10, 10, 0.94)',
      cardHoverBorder: 'rgba(255, 255, 255, 0.3)',
      inputFocus: '#ffffff',
      inputFocusGlow: 'rgba(255, 255, 255, 0.15)',
      badgeBg: 'rgba(255, 255, 255, 0.05)',
    },
    green: {
      primary: '#00ff87',
      secondary: '#00a8ff',
      glow: 'rgba(0, 255, 135, 0.15)',
      border: 'rgba(0, 255, 135, 0.2)',
      textGradient: 'linear-gradient(135deg, #00ff87 30%, #00a8ff 100%)',
      btnGradient: 'linear-gradient(135deg, #00ff87 0%, #00a8ff 100%)',
      btnGlow: 'rgba(0, 255, 135, 0.25)',
      cardBg: 'rgba(10, 25, 20, 0.82)',
      cardHoverBorder: 'rgba(0, 255, 135, 0.3)',
      inputFocus: '#00ff87',
      inputFocusGlow: 'rgba(0, 255, 135, 0.18)',
      badgeBg: 'rgba(0, 255, 135, 0.08)',
    },
    lava: {
      primary: '#ff6b00',
      secondary: '#ff003c',
      glow: 'rgba(255, 107, 0, 0.15)',
      border: 'rgba(255, 107, 0, 0.2)',
      textGradient: 'linear-gradient(135deg, #ff6b00 30%, #ff003c 100%)',
      btnGradient: 'linear-gradient(135deg, #ff6b00 0%, #ff003c 100%)',
      btnGlow: 'rgba(255, 107, 0, 0.25)',
      cardBg: 'rgba(24, 10, 10, 0.86)',
      cardHoverBorder: 'rgba(255, 107, 0, 0.3)',
      inputFocus: '#ff6b00',
      inputFocusGlow: 'rgba(255, 107, 0, 0.18)',
      badgeBg: 'rgba(255, 107, 0, 0.08)',
    },
    gold: {
      primary: '#d4af37',
      secondary: '#aa7c11',
      glow: 'rgba(212, 175, 55, 0.12)',
      border: 'rgba(212, 175, 55, 0.18)',
      textGradient: 'linear-gradient(135deg, #d4af37 30%, #f3e5ab 100%)',
      btnGradient: 'linear-gradient(135deg, #d4af37 0%, #aa7c11 100%)',
      btnGlow: 'rgba(212, 175, 55, 0.2)',
      cardBg: 'rgba(20, 18, 12, 0.86)',
      cardHoverBorder: 'rgba(212, 175, 55, 0.28)',
      inputFocus: '#d4af37',
      inputFocusGlow: 'rgba(212, 175, 55, 0.15)',
      badgeBg: 'rgba(212, 175, 55, 0.06)',
    },
    gothic: {
      primary: '#990000',
      secondary: '#110002',
      glow: 'rgba(153, 27, 27, 0.15)',
      border: 'rgba(153, 27, 27, 0.22)',
      textGradient: 'linear-gradient(135deg, #b91c1c 20%, #450a0a 100%)',
      btnGradient: 'linear-gradient(135deg, #b91c1c 0%, #1c1917 100%)',
      btnGlow: 'rgba(153, 27, 27, 0.3)',
      cardBg: 'rgba(4, 4, 4, 0.95)',
      cardHoverBorder: 'rgba(185, 28, 28, 0.4)',
      inputFocus: '#b91c1c',
      inputFocusGlow: 'rgba(185, 28, 28, 0.2)',
      badgeBg: 'rgba(185, 28, 28, 0.1)',
    }
  };

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (!authLoading && isAuthenticated && !skipAutoRedirect.current) {
      if (isTrainer) {
        navigate('/trainer', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, isTrainer, authLoading, navigate]);



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      // Evitar que el useEffect de redirección automática interfiera durante la autenticación activa
      skipAutoRedirect.current = true;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) throw error;

      let target = '/dashboard';
      if (data.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('rol')
          .eq('id', data.user.id)
          .maybeSingle();
        if (profile?.rol === 'entrenador') target = '/trainer';
      }

      setIsExiting(true);
      setLoading(false);
      window.setTimeout(() => navigate(target, { replace: true }), 450);
    } catch (err: unknown) {
      console.error('Error de login:', err);
      // Restaurar a false si falla el inicio de sesión
      skipAutoRedirect.current = false;
      setErrorMsg(err instanceof Error ? err.message : 'Correo o contraseña incorrectos.');
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (!registerName.trim()) {
        throw new Error('Por favor ingresa tu nombre completo.');
      }

      if (!isRealEmailDomain(email)) {
        throw new Error('Por favor ingresa un correo electrónico real y válido (ej: usuario@gmail.com, usuario@hotmail.com). No se admiten correos temporales ni ficticios.');
      }

      if (trainerParam) {
        const { data: trainerProfile, error: trainerError } = await supabase
          .from('profiles')
          .select('suscripcion_plan, suscripcion_estado, suscripcion_expira_at')
          .eq('id', trainerParam)
          .maybeSingle();

        if (trainerError) throw trainerError;

        const estado = trainerProfile?.suscripcion_estado || 'activo';
        let isExpired = estado === 'expirado' || estado === 'cancelado';
        if (trainerProfile?.suscripcion_expira_at) {
          const expDate = new Date(trainerProfile.suscripcion_expira_at);
          if (!isNaN(expDate.getTime()) && expDate < new Date()) {
            isExpired = true;
          }
        }

        if (isExpired) {
          throw new Error('La membresía de tu entrenador está inactiva o ha expirado. Por favor, avísale para que pueda renovar su servicio.');
        }

        const { count, error: countError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('rol', 'cliente')
          .eq('entrenador_id', trainerParam);

        if (countError) throw countError;

        const plan = trainerProfile?.suscripcion_plan || 'free';
        let limit = 1;
        if (plan === 'iniciacion') limit = 2;
        else if (plan === 'intermedio') limit = 10;
        else if (plan === 'profesional') limit = 999999;

        if (count !== null && count >= limit) {
          throw new Error(`El plan de tu entrenador ha alcanzado el límite máximo de atletas (${limit}). Avísale para que actualice su plan.`);
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            nombre: registerName.trim(),
            rol: registerRole,
            entrenador_id: trainerParam || null,
            vigencia_dias: 30,
            suscripcion_plan: 'free',
            suscripcion_estado: 'activo',
            suscripcion_expira_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          }
        }
      });

      if (error) throw error;

      if (registerRole === 'entrenador' && data?.user?.id) {
        const defaultMarca = {
          nombre_display: registerName.trim(),
          color_primario: '#00d4ff',
          color_secundario: '#0070a0',
          tipografia: 'Inter' as const,
          eslogan: '',
        };
        await supabase
          .from('profiles')
          .update({ marca: defaultMarca })
          .eq('id', data.user.id);
      }

      alert('¡Cuenta creada correctamente! Ya puedes iniciar sesión.');
      setIsRegisterMode(false);
      setPassword('');
      setErrorMsg(null);
    } catch (err: any) {
      console.error('Error al registrarse:', err);
      setErrorMsg(err.message || 'Ocurrió un error al registrar tu cuenta.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0b0f19', color: '#00d4ff', fontFamily: 'Orbitron, sans-serif' }}>
        <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '1.5px' }}>EVOLUTION LAB</span>
        <span style={{ fontSize: '12px', opacity: 0.7 }}>Iniciando sesión...</span>
      </div>
    );
  }


  const pri = themeStyles[theme].primary;
  const sec = themeStyles[theme].secondary;



  const activeData = AUDIENCE_DATA[activeAudience];
  const currentSlide = activeData.slides[carouselIndex];

  const handleNextSlide = () => {
    setCarouselIndex((prev) => (prev + 1) % activeData.slides.length);
  };

  const handlePrevSlide = () => {
    setCarouselIndex((prev) => (prev - 1 + activeData.slides.length) % activeData.slides.length);
  };

  return (
    <div className={`auth-landing-wrapper${isExiting ? ' login-exiting' : ''}`} style={{ display: 'flex', minHeight: '100vh', color: 'white', background: 'transparent', width: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Global Theme Selector (Top Right) */}
      <div style={{ position: 'absolute', top: '24px', right: '24px', zIndex: 1000 }}>
        {/* ═══ Idea 6: Focus Mode Theme Selector (Select Dropdown) ═══ */}
            <div ref={dropdownRef} style={{ position: 'relative', margin: '0', width: '100%', maxWidth: '220px', zIndex: 100 }}>
              <button
                type="button"
                onClick={() => setThemeOpen(!themeOpen)}
                style={{
                  fontSize: '11px',
                  fontFamily: "'Orbitron', sans-serif",
                  fontWeight: 700,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: 'white',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  height: '32px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: theme === 'gothic' ? '#990000' : (
                    theme === 'cyberpunk' ? '#ccff00' :
                    theme === 'monochrome' ? '#ffffff' :
                    theme === 'green' ? '#00ff87' :
                    theme === 'lava' ? '#ff6b00' :
                    theme === 'gold' ? '#d4af37' : '#00d4ff'
                  ),
                  boxShadow: `0 0 6px ${
                    theme === 'gothic' ? '#990000' : (
                      theme === 'cyberpunk' ? '#ccff00' :
                      theme === 'monochrome' ? '#ffffff' :
                      theme === 'green' ? '#00ff87' :
                      theme === 'lava' ? '#ff6b00' :
                      theme === 'gold' ? '#d4af37' : '#00d4ff'
                    )
                  }`
                }} />
                Elegir Tema
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: themeOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {themeOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: '8px',
                  background: 'rgba(15, 23, 42, 0.95)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  width: '100%',
                  minWidth: '185px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  zIndex: 999
                }}>
                  {(['cyan', 'cyberpunk', 'monochrome', 'green', 'lava', 'gold', 'gothic'] as const).map((th) => {
                    const colors = {
                      cyan: '#00d4ff',
                      cyberpunk: '#ccff00',
                      monochrome: '#ffffff',
                      green: '#00ff87',
                      lava: '#ff6b00',
                      gold: '#d4af37',
                      gothic: '#990000'
                    };
                    const titles = {
                      cyan: 'Evolution Cyan',
                      cyberpunk: 'Cyberpunk Acid',
                      monochrome: 'Monochrome Raw',
                      green: 'Forest Bio-Green',
                      lava: 'Lava Crimson',
                      gold: 'Royal Gold',
                      gothic: 'Gothic Void'
                    };
                    const active = theme === th;
                    return (
                      <button
                        key={th}
                        type="button"
                        onClick={() => {
                          setTheme(th);
                          localStorage.setItem('pwa_login_theme', th);
                          document.documentElement.setAttribute('data-theme', th);
                          window.dispatchEvent(new CustomEvent('pwa-theme-changed', { detail: th }));
                          setThemeOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          width: '100%',
                          padding: '8px 12px',
                          background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                          border: 'none',
                          borderRadius: '8px',
                          color: active ? 'white' : 'rgba(255,255,255,0.65)',
                          fontSize: '11px',
                          fontFamily: "'Orbitron', sans-serif",
                          fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
                          }
                        }}
                      >
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: colors[th],
                          boxShadow: active ? `0 0 6px ${colors[th]}` : 'none'
                        }} />
                        {titles[th]}
                        {active && (
                          <span style={{ marginLeft: 'auto', color: 'var(--theme-primary)', fontWeight: 'bold', fontSize: '9px' }}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
      </div>

      
      {/* ═══ Global dynamic SVG gradient ═══ */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <linearGradient id="dynamicThemeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={pri} />
            <stop offset="100%" stopColor={sec} />
          </linearGradient>
        </defs>
      </svg>

      {/* ═══ CSS Override Styles ═══ */}
      <style>{`
        @keyframes floatGlow1 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(60px, 30px) scale(1.12); }
        }
        @keyframes floatGlow2 {
          0% { transform: translate(0, 0) scale(1.1); }
          100% { transform: translate(-40px, -50px) scale(0.9); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.2); }
        }

        .login-card {
          background: ${themeStyles[theme].cardBg} !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border: 1px solid ${themeStyles[theme].border} !important;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45) !important;
          border-radius: 24px !important;
          padding: 35px !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          position: relative;
          z-index: 2;
        }
        .login-card:hover {
          border-color: ${pri}50 !important;
          box-shadow: 0 25px 60px ${pri}14, 0 20px 50px rgba(0, 0, 0, 0.45) !important;
        }

        .origin-card {
          background: ${themeStyles[theme].badgeBg} !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border: 1px solid ${themeStyles[theme].border} !important;
          border-radius: 18px !important;
          padding: 20px !important;
          transition: all 0.3s ease !important;
          position: relative;
          z-index: 2;
        }
        .origin-card:hover {
          background: rgba(255, 255, 255, 0.025) !important;
          border-color: ${pri}aa !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 0 15px ${themeStyles[theme].glow} !important;
        }

        .feature-item {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          border-radius: 14px !important;
          padding: 15px !important;
          margin-left: -12px !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          background: rgba(255, 255, 255, 0.02) !important;
          border: 1px solid ${themeStyles[theme].border}33 !important;
        }
        .feature-item:hover {
          background: rgba(255, 255, 255, 0.05) !important;
          border-color: ${pri}aa !important;
          transform: translateX(8px) !important;
        }

        /* Feature Cards Stagger Entry (Triggered when accordion opens) */
        .feature-stagger-1,
        .feature-stagger-2,
        .feature-stagger-3,
        .feature-stagger-4,
        .feature-stagger-5 {
          opacity: 0;
        }
        .features-list.animate-features .feature-stagger-1 {
          animation: fadeInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both;
        }
        .features-list.animate-features .feature-stagger-2 {
          animation: fadeInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.12s both;
        }
        .features-list.animate-features .feature-stagger-3 {
          animation: fadeInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.19s both;
        }
        .features-list.animate-features .feature-stagger-4 {
          animation: fadeInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.26s both;
        }
        .features-list.animate-features .feature-stagger-5 {
          animation: fadeInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.33s both;
        }
        .feature-icon {
          transition: all 0.3s ease !important;
          background: rgba(255, 255, 255, 0.02) !important;
          border: 1px solid rgba(255, 255, 255, 0.06) !important;
          border-radius: 10px !important;
          width: 42px !important;
          height: 42px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .feature-item:hover .feature-icon {
          transform: scale(1.1) rotate(4deg) !important;
          background: ${pri}1a !important;
          border-color: ${pri}50 !important;
          box-shadow: 0 0 15px ${pri}33 !important;
        }

        .form-control {
          background: rgba(255, 255, 255, 0.02) !important;
          border: 1px solid ${themeStyles[theme].border} !important;
          border-radius: 10px !important;
          height: 44px !important;
          padding: 12px 14px 12px 42px !important;
          color: white !important;
          font-size: 13px !important;
          transition: all 0.25s ease !important;
          box-sizing: border-box !important;
        }
        .form-control:focus {
          background: rgba(255, 255, 255, 0.04) !important;
          border-color: ${themeStyles[theme].inputFocus} !important;
          box-shadow: 0 0 12px ${themeStyles[theme].inputFocusGlow} !important;
          outline: none !important;
        }
        .input-icon {
          position: absolute !important;
          left: 14px !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          color: rgba(255, 255, 255, 0.4) !important;
          transition: color 0.25s ease !important;
          display: flex !important;
          align-items: center !important;
          pointer-events: none !important;
        }
        .form-control:focus ~ .input-icon { color: ${pri} !important; }
        .form-control:focus ~ .floating-label,
        .form-control:not(:placeholder-shown) ~ .floating-label { color: ${pri} !important; }

        .btn-submit {
          background: ${themeStyles[theme].btnGradient} !important;
          border: none !important;
          border-radius: 10px !important;
          height: 46px !important;
          font-family: 'Orbitron', sans-serif !important;
          font-weight: 700 !important;
          letter-spacing: 1px !important;
          color: ${theme === 'monochrome' ? '#000' : 'white'} !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          box-shadow: 0 4px 15px ${themeStyles[theme].btnGlow} !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .btn-submit:hover:not(:disabled) {
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 25px ${pri}50 !important;
          filter: brightness(1.1) !important;
        }
        .btn-submit:active { transform: translateY(0) !important; }

        .btn-whatsapp {
          background: rgba(37, 211, 102, 0.1) !important;
          border: 1px solid rgba(37, 211, 102, 0.2) !important;
          color: #25d366 !important;
          border-radius: 30px !important;
          padding: 12px 24px !important;
          font-size: 11px !important;
          font-family: 'Orbitron', sans-serif !important;
          font-weight: 700 !important;
          letter-spacing: 0.5px !important;
          transition: all 0.3s ease !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 8px !important;
          text-decoration: none !important;
        }
        .btn-whatsapp:hover {
          background: #25d366 !important;
          color: white !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 20px rgba(37, 211, 102, 0.3) !important;
        }
        .btn-instagram {
          background: rgba(225, 48, 108, 0.1) !important;
          border: 1px solid rgba(225, 48, 108, 0.2) !important;
          color: #e1306c !important;
          border-radius: 30px !important;
          padding: 12px 24px !important;
          font-size: 11px !important;
          font-family: 'Orbitron', sans-serif !important;
          font-weight: 700 !important;
          letter-spacing: 0.5px !important;
          transition: all 0.3s ease !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 8px !important;
          text-decoration: none !important;
        }
        .btn-instagram:hover {
          background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%) !important;
          color: white !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 20px rgba(225, 48, 108, 0.3) !important;
        }

        .brand-badge {
          background: ${themeStyles[theme].badgeBg} !important;
          border: 1px solid ${pri}33 !important;
          color: ${pri} !important;
          font-family: 'Orbitron', sans-serif !important;
          font-weight: 700 !important;
          font-size: 9px !important;
          letter-spacing: 1px !important;
          padding: 6px 12px !important;
          border-radius: 40px !important;
          text-transform: uppercase !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          box-shadow: 0 0 15px ${pri}1a !important;
        }
        .logo-symbol {
          width: 52px !important;
          height: 52px !important;
          background: ${themeStyles[theme].btnGradient} !important;
          border-radius: 50% !important;
          box-shadow: 0 0 20px ${pri}40 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        @media (max-width: 600px) {
          .carousel-inner-grid { grid-template-columns: 1fr !important; }
        }

        .login-exiting {
          opacity: 0 !important;
          transform: scale(0.98) !important;
          transition: opacity 0.45s ease, transform 0.45s ease !important;
          pointer-events: none !important;
        }

        .login-value-prop {
          background: ${themeStyles[theme].badgeBg} !important;
          border: 1px solid ${pri}33 !important;
          border-radius: 12px !important;
          padding: 12px 14px !important;
          margin-bottom: 20px !important;
          text-align: center !important;
        }
        .login-value-prop p {
          margin: 0 !important;
          font-size: 12px !important;
          line-height: 1.55 !important;
          color: rgba(255, 255, 255, 0.88) !important;
        }

        @media (max-width: 899px) {
          .landing-grid-container {
            display: flex !important;
            flex-direction: column !important;
            gap: 24px !important;
          }
          .auth-section { order: -1 !important; width: 100% !important; }
          .hero-section { order: 1 !important; width: 100% !important; }
        }

        /* ═══ CSS para la Portada / Showcase Comercial ═══ */
        .tab-selector {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 10px 0 20px 0;
          width: 100%;
        }
        .tab-btn {
          font-family: 'Orbitron', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          padding: 8px 14px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          white-space: nowrap;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(15, 23, 42, 0.65);
          color: rgba(255, 255, 255, 0.6);
          flex: 1 1 auto;
        }
        .tab-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.18);
        }
        .tab-btn.active-trainer {
          background: linear-gradient(${pri}33, ${pri}33), rgba(15, 23, 42, 0.85) !important;
          border-color: ${pri}cc !important;
          color: ${pri} !important;
          box-shadow: 0 0 12px ${pri}44 !important;
        }
        .tab-btn.active-solo {
          background: linear-gradient(${pri}33, ${pri}33), rgba(15, 23, 42, 0.85) !important;
          border-color: ${pri}cc !important;
          color: ${pri} !important;
          box-shadow: 0 0 12px ${pri}44 !important;
        }
        .tab-btn.active-guided {
          background: linear-gradient(${pri}33, ${pri}33), rgba(15, 23, 42, 0.85) !important;
          border-color: ${pri}cc !important;
          color: ${pri} !important;
          box-shadow: 0 0 12px ${pri}44 !important;
        }

        .showcase-layout {
          display: flex;
          gap: 30px;
          align-items: center;
          width: 100%;
          margin-bottom: 15px;
        }
        @media (max-width: 600px) {
          .showcase-layout {
            flex-direction: column;
            gap: 20px;
          }
        }
        .showcase-info {
          flex: 1.2;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .showcase-media {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        /* Device Frame CSS Phone Mockup */
        .device-frame {
          width: 300px;
          height: 620px;
          border-radius: 32px;
          border: 8px solid rgba(255, 255, 255, 0.12);
          background: #090e17;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6), inset 0 0 16px rgba(0, 0, 0, 0.8);
          position: relative;
          overflow: hidden;
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          transform-style: preserve-3d;
          perspective: 1000px;
        }
        .device-frame:hover {
          transform: translateY(-5px) rotateY(4deg) rotateX(4deg);
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.7);
        }
        .device-notch {
          width: 80px;
          height: 14px;
          background: #090e17;
          border-bottom-left-radius: 12px;
          border-bottom-right-radius: 12px;
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
        }
        .device-screen {
          width: 100%;
          height: 100%;
          position: relative;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          padding: 20px 0px 4px 0px;
          background: #0b0f19;
        }
 
        .mock-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          padding: 6px;
          margin-bottom: 6px;
          font-size: 8px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        .mock-badge {
          display: inline-block;
          font-size: 6px;
          font-weight: 800;
          padding: 1px 4px;
          border-radius: 3px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        /* Video button and Modal styling */
        .btn-video {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          color: #fff;
          font-family: 'Orbitron', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
          padding: 8px 16px;
          border-radius: 20px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.25s ease;
          align-self: flex-start;
          margin-top: 5px;
        }
        .btn-video:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }

        .dot-indicators {
          display: flex;
          justify-content: center;
          gap: 6px;
          margin-top: 10px;
        }
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.15);
          cursor: pointer;
          transition: all 0.25s ease;
        }
        .dot.active {
          width: 14px;
          border-radius: 3px;
        }

        /* Video Modal Styles */
        .video-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(5, 8, 16, 0.88);
          backdrop-filter: blur(35px);
          -webkit-backdrop-filter: blur(35px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .video-modal-container {
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 24px;
          width: 100%;
          max-width: 680px;
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.8);
          position: relative;
        }
        .video-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 50%;
          width: 30px;
          height: 30px;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .video-modal-close:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }
        .video-player-mock {
          background: #070a13;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          position: relative;
          width: 100%;
          aspect-ratio: 16/9;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          box-shadow: inset 0 0 30px rgba(0,0,0,0.8);
        }
      `}</style>

      {/* ═══ Background glowing spheres ═══ */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%', width: '600px', height: '600px',
        background: `radial-gradient(circle, ${pri}12 0%, ${pri}00 70%)`,
        borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0,
        animation: 'floatGlow1 12s infinite alternate ease-in-out', transition: 'background 0.8s ease'
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-10%', width: '700px', height: '700px',
        background: `radial-gradient(circle, ${sec}12 0%, ${sec}00 70%)`,
        borderRadius: '50%', filter: 'blur(120px)', pointerEvents: 'none', zIndex: 0,
        animation: 'floatGlow2 15s infinite alternate ease-in-out', transition: 'background 0.8s ease'
      }} />

      <div className="landing-grid-container" style={{ width: '100%', maxWidth: '1440px', margin: '0 auto', padding: '40px 20px', position: 'relative', zIndex: 1 }}>
        
        {/* ═══ Column Left: Brand Landing & Features ═══ */}
        <div className="hero-section" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start', width: '100%' }}>
          
          <div className="brand-badge stagger-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3h6l1 7h-8l1-7z"/><path d="M10 10v4a2 2 0 002 2h0a2 2 0 002-2v-4"/>
              <line x1="12" y1="16" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/>
            </svg>
            Ciencia & Evidencia
          </div>
 
          <h1 className="hero-title" style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(34px, 5vw, 54px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '1px', margin: 0 }}>
            EVOLUTION <span className="theme-text-gradient">LAB</span>
          </h1>
          <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(14px, 2vw, 17px)', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', margin: '0 0 10px 0', letterSpacing: '0.5px' }}>
            Planificación científica, análisis de sobrecarga progresiva y automatización de marcas. La herramienta definitiva para entrenadores y atletas independientes.
          </p>

          {/* ═══ Audience Selector Tabs ═══ */}
          <div className="tab-selector">
            <button
              type="button"
              className={`tab-btn ${activeAudience === 'trainer' ? 'active-trainer' : ''}`}
              onClick={() => setActiveAudience('trainer')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Entrenadores
            </button>
            <button
              type="button"
              className={`tab-btn ${activeAudience === 'solo' ? 'active-solo' : ''}`}
              onClick={() => setActiveAudience('solo')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                <path d="M6.5 2h11L20 6v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6l2.5-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              Atleta Autónomo
            </button>
            <button
              type="button"
              className={`tab-btn ${activeAudience === 'guided' ? 'active-guided' : ''}`}
              onClick={() => setActiveAudience('guided')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/>
              </svg>
              Cliente Asesorado
            </button>
          </div>

          {/* ═══ Showcase Layout — Tour Interactivo Premium ═══ */}
          <div className="showcase-layout">
            <div className="showcase-info">
              <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '18px', fontWeight: 800, color: pri, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.3 }}>
                {activeData.slogan}
              </h2>
              
              {/* Stepper dinámico de características */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '14px', width: '100%' }}>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', opacity: 0.4, letterSpacing: '1px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700 }}>Explorar características</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {activeData.slides.map((slide, sIdx) => {
                    const active = carouselIndex === sIdx;
                    // Mapear nombres largos para mantener los botones compactos y limpios
                    const label = slide.title
                      .replace('PLANIFICA LOS ENTRENAMIENTOS', 'Planificación')
                      .replace('REGISTRO DE SESIONES', 'Registro')
                      .replace('MOTOR DE SOBRECARGA', 'Sobrecarga')
                      .replace('HISTORIAL DE SESIONES', 'Historial')
                      .replace('VISTA CLIENTE AUTÓNOMO', 'Resumen')
                      .replace('PLANIFICACIÓN DEL PLAN', 'Configuración')
                      .replace('PORTADA DEL PLAN', 'Portada')
                      .replace('PLAN PERSONALIZADO', 'Ver Plan')
                      .replace('VIDEOS EXPLICATIVOS', 'Técnica')
                      .replace('ANIMACIONES OFFLINE', 'Modo Offline')
                      .replace('FILOSOFÍA DEL COACH', 'Filosofía')
                      .replace('PERSONALIZA TU MARCA', 'Identidad')
                      .replace('AUDITA TUS ATLETAS', 'Auditoría')
                      .replace('DETALLE DE LA SESIÓN', 'Sesión')
                      .replace('PROGRESIÓN DE VARIABLES', 'Progresiones')
                      .replace('CALCULADORA 1RM', 'Calculadora')
                      .replace('LOGROS Y MEDALLAS', 'Logros')
                      .replace('NOTIFICACIONES', 'Notificaciones')
                      .replace('GESTION DE ATLETAS', 'Gestión')
                      .replace('PANEL DEL COACH', 'Inicio');

                    return (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => setCarouselIndex(sIdx)}
                        style={{
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: '8.5px',
                          padding: '5px 10px',
                          borderRadius: '20px',
                          cursor: 'pointer',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          background: active ? `linear-gradient(${pri}33, ${pri}33), rgba(15, 23, 42, 0.85)` : 'rgba(15, 23, 42, 0.65)',
                          border: `1px solid ${active ? `${pri}cc` : 'rgba(255,255,255,0.1)'}`,
                          color: active ? pri : 'rgba(255,255,255,0.6)',
                          fontWeight: active ? 800 : 500,
                          boxShadow: active ? `0 0 8px ${pri}44` : 'none',
                          letterSpacing: '0.3px',
                          textTransform: 'uppercase'
                        }}
                        onMouseEnter={(e) => {
                          if (!active) {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
                            e.currentTarget.style.color = '#fff';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            e.currentTarget.style.background = 'rgba(15, 23, 42, 0.65)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                          }
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tarjeta dinámica de información específica de la captura con Fade-In Animation */}
              <div 
                key={`${activeAudience}-${carouselIndex}`} 
                className="animate-fade-in"
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${themeStyles[theme].border}33`,
                  borderRadius: '16px',
                  padding: '16px',
                  marginTop: '12px',
                  minHeight: '140px',
                  boxSizing: 'border-box',
                }}
              >
                <h5 style={{ margin: '0 0 6px 0', fontSize: '12.5px', fontFamily: "'Orbitron', sans-serif", fontWeight: 800, color: '#fff', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  {currentSlide.title}
                </h5>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <div style={{ width: '3px', height: '9px', borderRadius: '1.5px', background: pri }} />
                  <span style={{ fontSize: '9px', fontWeight: 700, color: pri, fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                    {currentSlide.subtitle}
                  </span>
                </div>
                
                <p style={{ margin: '0 0 12px 0', fontSize: '11px', lineHeight: 1.5, color: 'rgba(255, 255, 255, 0.85)' }}>
                  {currentSlide.description || 'Explora las capturas para conocer los detalles del sistema.'}
                </p>

                {currentSlide.features && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {currentSlide.features.map((feat, fIdx) => (
                      <div key={fIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={pri} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.75)' }}>{feat}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="showcase-media" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* CSS Phone Mockup */}
              <div className="device-frame" style={{ boxShadow: `0 25px 50px rgba(0, 0, 0, 0.6), inset 0 0 16px rgba(0, 0, 0, 0.8), 0 0 30px ${pri}18` }}>
                <div className="device-notch" />
                
                <div className="device-screen">
                  {/* Glass Reflection Overlay */}
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 55%)',
                    pointerEvents: 'none',
                    zIndex: 99,
                  }} />

                  {/* Status Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '6px', opacity: 0.5, marginBottom: '6px', fontFamily: 'monospace', padding: '0 10px' }}>
                    <span>9:41 AM</span>
                    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                      <span>LTE</span>
                      <div style={{ width: '10px', height: '5px', border: '0.5px solid rgba(255,255,255,0.5)', padding: '0.5px', boxSizing: 'border-box' }}>
                        <div style={{ width: '100%', height: '100%', background: '#fff' }} />
                      </div>
                    </div>
                  </div>

                  {/* App Mockup Header and Subtitle removed to avoid redundancy and fit full height screenshot */}

                  {/* Slide Content track wrapper */}
                  <div style={{ flex: 1, display: 'flex', overflow: 'hidden', width: '100%', minHeight: 0, position: 'relative' }}>
                    
                    {/* Sliding track */}
                    <div style={{
                      display: 'flex',
                      width: '100%',
                      height: '100%',
                      transform: `translateX(-${carouselIndex * 100}%)`,
                      transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}>
                      {activeData.slides.map((slide, idx) => {
                        // Renderizar únicamente la diapositiva activa y sus adyacentes para óptimo rendimiento de carga
                        const shouldRender = Math.abs(idx - carouselIndex) <= 1;
                        return (
                          <div key={idx} style={{ minWidth: '100%', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                            {shouldRender ? slide.content(pri) : <div style={containerStyle} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Slide controls inside the phone screen */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', borderTop: '0.5px solid rgba(255,255,255,0.06)', paddingTop: '6px', paddingLeft: '10px', paddingRight: '10px', zIndex: 10 }}>
                    <button
                      type="button"
                      onClick={handlePrevSlide}
                      style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '8px', cursor: 'pointer', padding: '2px 4px' }}
                    >
                      ◀
                    </button>
                    <span style={{ fontSize: '6px', color: 'rgba(255,255,255,0.4)' }}>
                      Pág. {carouselIndex + 1} de {activeData.slides.length}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextSlide}
                      style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '8px', cursor: 'pointer', padding: '2px 4px' }}
                    >
                      ▶
                    </button>
                  </div>
                </div>
              </div>

              {/* Dot Indicators */}
              <div className="dot-indicators">
                {activeData.slides.map((_, sIdx) => (
                  <div
                    key={sIdx}
                    className={`dot ${carouselIndex === sIdx ? 'active' : ''}`}
                    style={{ background: carouselIndex === sIdx ? pri : 'rgba(255, 255, 255, 0.15)' }}
                    onClick={() => setCarouselIndex(sIdx)}
                  />
                ))}
              </div>
            </div>
          </div>
          {/* Accordion 1: Qué es Evolution Lab */}
          <LoginAccordion
            title="Que es Evolution Lab"
            open={saberMasOpen}
            onToggle={() => setSaberMasOpen((v) => !v)}
            accentColor={pri}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="origin-card" style={{ margin: 0 }}>
                <h5 style={{ margin: '0 0 10px 0', fontSize: '12px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700, letterSpacing: '0.5px', color: pri, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>
                  </svg>
                  EL MÉTODO EVOLUTION LAB
                </h5>
                <p style={{ margin: '0 0 10px 0', fontSize: '13px', lineHeight: 1.6, opacity: 0.85 }}>
                  Meticulosamente diseñado por un profesional experto y apasionado para colocar tus metas individuales como prioridad absoluta, <strong>Evolution Lab</strong> nace como respuesta a las rutinas planas en PDF, Excels aburridos y mensajes de WhatsApp que no te orientan adecuadamente y te generan más duda que certeza en plena sala de pesas.
                </p>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: pri, fontWeight: 600 }}>
                  Transformamos el entrenamiento estático en un ecosistema interactivo y vivo en tu teléfono para que optimices tu fuerza y domines tu sobrecarga con claridad absoluta.
                </p>
              </div>

              {/* Features List */}
              <div className="features-list animate-features" style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                <div className="feature-item" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#dynamicThemeGrad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <polyline points="16 11 18 13 22 9"/>
                    </svg>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>Planificación 100% a tu Medida</h4>
                    <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, opacity: 0.7 }}>Diseñamos cada rutina de forma exclusiva según tu nivel, objetivos y estilo de vida. Ya sea que busques ganar masa muscular, perder tejido graso o mejorar tu salud, estructuramos el enfoque exacto para ti.</p>
                  </div>
                </div>
                <div className="feature-item" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#dynamicThemeGrad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3v18h18"/><path d="M7 16l4-4 3 3 5-7"/>
                    </svg>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>Registro & Progreso Inteligente</h4>
                    <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, opacity: 0.7 }}>Registra cada serie y visualiza tu progreso sesión tras sesión. Recibe guias en automático de acuerdo a tu historial para ajustar tus cargas y nunca estancarte.</p>
                  </div>
                </div>
                <div className="feature-item" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#dynamicThemeGrad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                    </svg>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>Valoración & Seguimiento Continuo</h4>
                    <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, opacity: 0.7 }}>Cada plan incluye una valoración antropométrica detallada y un seguimiento constante para asegurar que tu evolución física avance correctamente.</p>
                  </div>
                </div>
                <div className="feature-item" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#dynamicThemeGrad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3"/><line x1="19" y1="3" x2="19" y2="21" strokeDasharray="2 2"/>
                    </svg>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>Videos Guía & GIFs Offline</h4>
                    <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, opacity: 0.7 }}>Accede a videos explicativos detallados con conexión. ¿Sin internet? Las animaciones GIF se activan automáticamente para guiar tu técnica offline.</p>
                  </div>
                </div>
                <div className="feature-item" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div className="feature-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#dynamicThemeGrad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="2" width="16" height="20" rx="2"/>
                      <line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/>
                      <circle cx="15" cy="17" r="2.5"/><path d="M16.8 18.8L18 20"/>
                    </svg>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>Calculadora 1RM Avanzada</h4>
                    <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, opacity: 0.7 }}>Estima tus marcas máximas de fuerza directamente desde tu teléfono para ajustar tus cargas de manera científica y segura.</p>
                  </div>
                </div>
              </div>
            </div>
          </LoginAccordion>

          <BiomechanicalSimulator
            pri={pri}
            sec={sec}
            theme={theme}
            themeStyles={themeStyles}
          />



          {/* CTA Buttons */}
          <div className="cta-buttons stagger-8" style={{ display: 'flex', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
            <a href="https://wa.me/573113666959?text=Hola!%20Vi%20tu%20perfil%20y%20quiero%20empezar%20mi%20entrenamiento%20personalizado%20en%20Evolution%20Lab" target="_blank" rel="noopener noreferrer" className="btn-whatsapp btn-shine">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              ¡Quiero mi Plan!
            </a>
            <a href="https://www.instagram.com/manuel_betancur" target="_blank" rel="noopener noreferrer" className="btn-instagram btn-shine">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
              Sígueme en Instagram
            </a>
          </div>
        </div>

        {/* ═══ Column Right: Login Form Portal ═══ */}
        <div className="auth-section" style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <div className="login-card stagger-card" style={{ width: '100%', maxWidth: '440px' }}>
            <div className="header" style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div className="logo-symbol" style={{ margin: '0 auto 16px auto' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
              </div>
              <h1 style={{ fontSize: '18px', margin: '0 0 4px 0', fontFamily: "'Orbitron', sans-serif", fontWeight: 800, letterSpacing: '1px' }}>
                {isRegisterMode ? 'REGISTRARSE' : 'PORTAL ATLETA'}
              </h1>
              <p style={{ margin: 0, fontSize: '12px', opacity: 0.6 }}>
                {isRegisterMode 
                  ? (trainerParam ? `Como atleta del Coach ${trainerName || 'cargando...'}` : 'Crea tu cuenta de Evolution Lab')
                  : 'Ingresa a tu plan de entrenamiento'}
              </p>
            </div>

            <div className="login-value-prop">
              <p>
                {isRegisterMode 
                  ? 'Planificación científica e historial de sobrecarga inteligente.'
                  : 'Tu plan inteligente con guias automaticas de progresión basadas en tu historial.'}
              </p>
            </div>

            {errorMsg && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '10px', color: '#fca5a5', fontSize: '12px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}

            {!isRegisterMode ? (
              /* FORMULARIO DE INICIO DE SESIÓN */
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ margin: 0, position: 'relative' }}>
                  <div className="input-wrapper">
                    <span className="input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4l-10 8L2 4"/>
                      </svg>
                    </span>
                    <input type="email" id="email" className="form-control" placeholder="ejemplo@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" style={{ width: '100%' }} />
                    <label htmlFor="email" className="floating-label">Correo Electrónico</label>
                  </div>
                </div>

                <div style={{ margin: 0, position: 'relative' }}>
                  <div className="input-wrapper">
                    <span className="input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                    </span>
                    <input type={showPassword ? 'text' : 'password'} id="password" className="form-control" placeholder="••••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" style={{ width: '100%' }} />
                    <label htmlFor="password" className="floating-label">Contraseña</label>
                    <button type="button" className={`password-toggle${showPassword ? ' visible' : ''}`} onClick={() => setShowPassword(!showPassword)} aria-label="Mostrar u ocultar contraseña">
                      <svg className="eye-on" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                      <svg className="eye-off" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn-submit" disabled={loading} style={{ marginTop: '5px', width: '100%' }}>
                  <span>{loading ? 'VERIFICANDO...' : 'ENTRAR'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(true);
                    setRegisterRole('cliente');
                    setTrainerParam(null);
                    setTrainerName(null);
                    setErrorMsg(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: `1px solid rgba(255, 255, 255, 0.08)`,
                    borderRadius: '10px',
                    height: '40px',
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 700,
                    fontSize: '11px',
                    letterSpacing: '0.5px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    marginTop: '10px',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = pri + '55';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.boxShadow = `0 0 10px ${pri}11`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  ¿NO TIENES CUENTA? REGÍSTRATE GRATIS
                </button>
              </form>
            ) : (
              /* FORMULARIO DE AUTO-REGISTRO */
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ margin: 0, position: 'relative' }}>
                  <div className="input-wrapper">
                    <span className="input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                    </span>
                    <input type="text" id="registerName" className="form-control" placeholder="Ej. Juan Manuel" value={registerName} onChange={(e) => setRegisterName(e.target.value)} required style={{ width: '100%' }} />
                    <label htmlFor="registerName" className="floating-label">Nombre Completo</label>
                  </div>
                </div>

                <div style={{ margin: 0, position: 'relative' }}>
                  <div className="input-wrapper">
                    <span className="input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4l-10 8L2 4"/>
                      </svg>
                    </span>
                    <input type="email" id="email" className="form-control" placeholder="ejemplo@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" style={{ width: '100%' }} />
                    <label htmlFor="email" className="floating-label">Correo Electrónico</label>
                  </div>
                </div>

                <div style={{ margin: 0, position: 'relative' }}>
                  <div className="input-wrapper">
                    <span className="input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                    </span>
                    <input type={showPassword ? 'text' : 'password'} id="password" className="form-control" placeholder="••••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" style={{ width: '100%' }} />
                    <label htmlFor="password" className="floating-label">Contraseña</label>
                  </div>
                </div>

                {!trainerParam && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '5px' }}>
                    <button
                      type="button"
                      onClick={() => setRegisterRole('cliente')}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '10px',
                        border: '1px solid ' + (registerRole === 'cliente' ? pri : 'rgba(255,255,255,0.08)'),
                        background: registerRole === 'cliente' ? pri + '40' : 'rgba(15, 23, 42, 0.65)',
                        color: registerRole === 'cliente' ? '#fff' : 'rgba(255,255,255,0.6)',
                        fontFamily: "'Orbitron', sans-serif", fontSize: '10px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >
                      ATLETA AUTÓNOMO
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterRole('entrenador')}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '10px',
                        border: '1px solid ' + (registerRole === 'entrenador' ? pri : 'rgba(255,255,255,0.08)'),
                        background: registerRole === 'entrenador' ? pri + '40' : 'rgba(15, 23, 42, 0.65)',
                        color: registerRole === 'entrenador' ? '#fff' : 'rgba(255,255,255,0.6)',
                        fontFamily: "'Orbitron', sans-serif", fontSize: '10px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >
                      ENTRENADOR
                    </button>
                  </div>
                )}

                {registerRole === 'entrenador' && (
                  <div style={{ margin: 0, position: 'relative' }}>
                    <div className="input-wrapper">
                      <span className="input-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                      </span>
                      <input type="text" id="registerWhatsapp" className="form-control" placeholder="Ej. +573112223344" value={registerWhatsapp} onChange={(e) => setRegisterWhatsapp(e.target.value)} required style={{ width: '100%' }} />
                      <label htmlFor="registerWhatsapp" className="floating-label">WhatsApp de Contacto</label>
                    </div>
                  </div>
                )}

                <button type="submit" className="btn-submit" disabled={loading} style={{ marginTop: '5px', width: '100%' }}>
                  <span>{loading ? 'REGISTRANDO...' : 'REGISTRARSE'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(false);
                    setErrorMsg(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: `1px solid rgba(255, 255, 255, 0.08)`,
                    borderRadius: '10px',
                    height: '40px',
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 700,
                    fontSize: '11px',
                    letterSpacing: '0.5px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    marginTop: '10px',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = pri + '55';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.boxShadow = `0 0 10px ${pri}11`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  ¿YA TIENES CUENTA? INICIA SESIÓN
                </button>
              </form>
            )}

            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={pri} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 3h6l1 7h-8l1-7z"/><path d="M10 10v4a2 2 0 002 2h0a2 2 0 002-2v-4"/><line x1="12" y1="16" x2="12" y2="21"/>
                </svg>
                Diseñado bajo evidencia científica
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={sec} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Exclusivo para ti por Evolution Lab
              </span>
              <span style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginTop: '8px', textAlign: 'center', fontFamily: "'Orbitron', sans-serif" }}>Developed by Juan Manuel Cardona</span>
            </div>
          </div>
        </div>

      </div>

      {/* ═══ Video Modal ═══ */}
      {isVideoModalOpen && (
        <div className="video-modal-overlay" onClick={() => setIsVideoModalOpen(false)}>
          <div className="video-modal-container" onClick={(e) => e.stopPropagation()}>
            <button className="video-modal-close" onClick={() => setIsVideoModalOpen(false)}>✕</button>
            <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '16px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Presentación: Evolution Lab para {activeAudience === 'trainer' ? 'Entrenadores' : activeAudience === 'solo' ? 'Lifters Autónomos' : 'Clientes'}
            </h3>
            <div className="video-player-mock">
              <iframe
                width="100%"
                height="100%"
                src={activeData.videoUrl}
                title="Evolution Lab Presentation"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                style={{ borderRadius: '12px', border: 'none' }}
              ></iframe>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
