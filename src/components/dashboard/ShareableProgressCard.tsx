// src/components/dashboard/ShareableProgressCard.tsx
import React, { useRef, useEffect, useState } from 'react';
import { Session } from '../../lib/overload';

interface ShareableProgressCardProps {
  onClose: () => void;
  athleteName: string;
  themeColor: string;
  themeSecondaryColor: string;
  sesiones: Session[];
  rol?: string;
  suscripcionPlan?: string;
}

const resolveColor = (colorStr: string, fallback: string): string => {
  if (!colorStr) return fallback;
  if (colorStr.startsWith('var(')) {
    const varName = colorStr.slice(4, -1).trim();
    if (typeof window !== 'undefined') {
      const resolved = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      if (resolved) return resolved;
    }
    return fallback;
  }
  return colorStr;
};

export const ShareableProgressCard: React.FC<ShareableProgressCardProps> = ({
  onClose,
  athleteName,
  themeColor,
  themeSecondaryColor,
  sesiones,
  rol = 'cliente_autonomo',
  suscripcionPlan = 'free'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [fontsLoaded, setFontsLoaded] = useState<boolean>(false);

  // Esperar a que las fuentes estén cargadas para que el canvas use Orbitron/Inter
  useEffect(() => {
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        setFontsLoaded(true);
      });
    } else {
      setFontsLoaded(true);
    }
  }, []);

  // 1. Calcular métricas semanales y XP
  const metrics = React.useMemo(() => {
    const nowMs = Date.now();
    const sevenDaysAgoStr = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Sesiones de los últimos 7 días
    const weeklySessionsList = sesiones.filter(s => s.fecha >= sevenDaysAgoStr);
    const uniqueWeeklyDates = Array.from(new Set(weeklySessionsList.map(s => s.fecha)));
    const sessionsCount = uniqueWeeklyDates.length;

    // Volumen de los últimos 7 días
    let volume = 0;
    weeklySessionsList.forEach(s => {
      const repsCount = s.repsArray?.reduce((a, b) => a + b, 0) || 0;
      volume += (s.peso || 0) * repsCount;
    });

    // PRs rotos en los últimos 7 días
    const prsCount = (() => {
      let prs = 0;
      const maxByExerciseBeforeWeek: Record<string, number> = {};
      
      const sorted = [...sesiones].sort((a, b) => a.fecha.localeCompare(b.fecha));
      
      sorted.forEach(s => {
        const key = s.ejercicio.toLowerCase().trim();
        if (s.fecha < sevenDaysAgoStr) {
          maxByExerciseBeforeWeek[key] = Math.max(maxByExerciseBeforeWeek[key] || 0, s.peso || 0);
        } else {
          const prevMax = maxByExerciseBeforeWeek[key] || 0;
          if (s.peso > prevMax && prevMax > 0) {
            prs++;
            maxByExerciseBeforeWeek[key] = s.peso;
          } else if (prevMax === 0 && s.peso > 0) {
            maxByExerciseBeforeWeek[key] = s.peso;
          }
        }
      });
      return prs;
    })();

    // Calcular racha activa
    const activeStreak = (() => {
      if (sesiones.length === 0) return 0;
      const dates = Array.from(new Set(sesiones.map(s => s.fecha))).sort();
      let currentStreak = 1;
      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1]);
        const curr = new Date(dates[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 4) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
      }
      const lastDate = new Date(dates[dates.length - 1]);
      const daysSinceLast = Math.round((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceLast <= 4 ? currentStreak : 0;
    })();

    // Total histórico de sesiones y badges
    const totalDaysHistorical = Array.from(new Set(sesiones.map(s => s.fecha))).length;
    const earnedBadgesCount = [
      sesiones.length >= 1, // primera_sesion
      totalDaysHistorical >= 5, // semana_5
      totalDaysHistorical >= 20, // mes_constante
      totalDaysHistorical >= 50, // veterano_50
      totalDaysHistorical >= 100, // centurion
      new Set(sesiones.map(s => s.ejercicio.toLowerCase())).size >= 5, // variedad_5
      new Set(sesiones.map(s => s.ejercicio.toLowerCase())).size >= 15, // variedad_15
      prsCount > 0 // pr_hunter
    ].filter(Boolean).length;

    // Calcular XP y Nivel Balanceado (Mismo motor que GamificacionPanel)
    const totalPoints = (totalDaysHistorical * 50) + (earnedBadgesCount * 200) + (activeStreak * 25) + (prsCount * 100);
    const currentLevel = Math.floor(Math.sqrt(totalPoints / 250)) + 1;

    // Calcular progreso del nivel
    const nextLvl = currentLevel;
    const currentLvl = currentLevel - 1;
    const currentLvlPoints = Math.pow(currentLvl, 2) * 250;
    const nextLvlPoints = Math.pow(nextLvl, 2) * 250;
    const ptsGained = totalPoints - currentLvlPoints;
    const ptsNeeded = nextLvlPoints - currentLvlPoints;
    const progressPct = ptsNeeded > 0 ? (ptsGained / ptsNeeded) * 100 : 100;

    return {
      sessionsCount,
      volume,
      prsCount,
      activeStreak,
      totalPoints,
      currentLevel,
      progressPct
    };
  }, [sesiones]);

  // 2. Dibujar Canvas Estilo Cyberpunk Premium
  useEffect(() => {
    if (!fontsLoaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dimensiones 1080 x 1920 (Instagram Story)
    const W = 1080;
    const H = 1920;
    canvas.width = W;
    canvas.height = H;

    // A. Resolver colores reales para evitar fallos de CSS variables en Canvas
    const primaryHex = resolveColor(themeColor, '#00d4ff');
    const secondaryHex = resolveColor(themeSecondaryColor, '#7b2ff7');

    // B. Fondo Oscuro profundo con gradiente
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#060814');
    bgGrad.addColorStop(1, '#0c1127');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // C. Resplandores radiales de neon en las esquinas (Atmospheric Glow)
    const glow1 = ctx.createRadialGradient(0, 0, 100, 200, 200, 800);
    glow1.addColorStop(0, primaryHex + '33'); // 20% opacity
    glow1.addColorStop(1, 'transparent');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, W, H);

    const glow2 = ctx.createRadialGradient(W, H, 100, W - 200, H - 200, 900);
    glow2.addColorStop(0, secondaryHex + '38'); // 22% opacity
    glow2.addColorStop(1, 'transparent');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, W, H);

    // D. Rejilla sci-fi (Grid Lines)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.lineWidth = 2;
    const gridSpacing = 90;
    for (let x = 0; x < W; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // E. Líneas decorativas sci-fi en las esquinas (Brackets)
    ctx.strokeStyle = primaryHex + '66';
    ctx.lineWidth = 5;
    const pad = 60;
    const bLen = 80;
    
    // Superior Izquierda
    ctx.beginPath(); ctx.moveTo(pad + bLen, pad); ctx.lineTo(pad, pad); ctx.lineTo(pad, pad + bLen); ctx.stroke();
    // Superior Derecha
    ctx.beginPath(); ctx.moveTo(W - pad - bLen, pad); ctx.lineTo(W - pad, pad); ctx.lineTo(W - pad, pad + bLen); ctx.stroke();
    // Inferior Izquierda
    ctx.beginPath(); ctx.moveTo(pad + bLen, H - pad); ctx.lineTo(pad, H - pad); ctx.lineTo(pad, H - pad + bLen); ctx.stroke();
    // Inferior Derecha
    ctx.beginPath(); ctx.moveTo(W - pad - bLen, H - pad); ctx.lineTo(W - pad, H - pad); ctx.lineTo(W - pad, H - pad + bLen); ctx.stroke();

    // F. Cabecera y Badge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    const badgeW = 460;
    const badgeH = 80;
    const badgeX = (W - badgeW) / 2;
    const badgeY = 160;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 40);
    ctx.fill();
    
    ctx.strokeStyle = primaryHex + '50';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Logo texto
    ctx.fillStyle = primaryHex;
    ctx.font = "bold 28px 'Orbitron', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EVOLUTION LAB 3.0', W / 2, badgeY + badgeH / 2 + 2);

    // Título de la tarjeta
    ctx.fillStyle = '#ffffff';
    ctx.font = "900 60px 'Orbitron', sans-serif";
    ctx.fillText('RENDIMIENTO ATLETA', W / 2, 310);

    // Nombre del Atleta
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 56px 'Orbitron', sans-serif";
    ctx.fillText(athleteName.toUpperCase(), W / 2, 420);

    // Rótulo de Plan actual (Free o Pro)
    const planLabel = (() => {
      if (rol === 'entrenador') return 'HEAD COACH';
      if (rol === 'cliente_guiado') return 'ATLETA GUIADO';
      return suscripcionPlan === 'premium' ? 'SOLO LIFTER PRO ⚡' : 'SOLO LIFTER FREE 🧬';
    })();

    ctx.fillStyle = secondaryHex;
    ctx.font = "900 24px 'Orbitron', sans-serif";
    ctx.fillText(planLabel, W / 2, 475);

    // G. Anillo de Nivel / XP Radial (Stunning neon glow ring)
    const ringX = W / 2;
    const ringY = 700;
    const ringRadius = 130;

    // Track de fondo del anillo
    ctx.beginPath();
    ctx.arc(ringX, ringY, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 16;
    ctx.stroke();

    // Relleno interior difuso
    ctx.beginPath();
    ctx.arc(ringX, ringY, ringRadius - 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.fill();

    // Arco de progreso
    const startAngle = -Math.PI / 2;
    const progressVal = Math.min(100, Math.max(0, metrics.progressPct));
    const endAngle = startAngle + (Math.PI * 2 * (progressVal / 100));

    ctx.beginPath();
    ctx.arc(ringX, ringY, ringRadius, startAngle, endAngle);
    const ringGrad = ctx.createLinearGradient(ringX - ringRadius, ringY, ringX + ringRadius, ringY);
    ringGrad.addColorStop(0, primaryHex);
    ringGrad.addColorStop(1, secondaryHex);
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    
    // Añadir sombra neon al progreso
    ctx.shadowColor = primaryHex;
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0; // Resetear sombra

    // Textos internos del anillo
    ctx.fillStyle = '#ffffff';
    ctx.font = "900 68px 'Orbitron', sans-serif";
    ctx.fillText(`LVL ${metrics.currentLevel}`, ringX, ringY - 15);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = "bold 22px 'Orbitron', sans-serif";
    ctx.fillText(`${metrics.totalPoints} XP`, ringX, ringY + 45);

    // H. Rejilla 2x2 de Estadísticas (Stats Grid)
    const startY = 930;
    const cardW = 420;
    const cardH = 300;
    const cardGap = 40;
    
    const xLeft = W / 2 - cardW - cardGap / 2;
    const xRight = W / 2 + cardGap / 2;
    
    const yRow1 = startY;
    const yRow2 = startY + cardH + cardGap;

    const cards = [
      { x: xLeft, y: yRow1, icon: '🔥', val: `${metrics.activeStreak}`, label: 'RACHA DIAS', desc: 'Consistencia activa', color: '#ef4444' },
      { x: xRight, y: yRow1, icon: '🏋️', val: `${metrics.volume.toLocaleString('es-CO')}`, label: 'VOLUMEN (7D)', desc: 'Kilos totales', color: primaryHex },
      { x: xLeft, y: yRow2, icon: '🚀', val: `${metrics.prsCount}`, label: 'PRs ROTOS', desc: 'Nuevas marcas', color: '#eab308' },
      { x: xRight, y: yRow2, icon: '✅', val: `${metrics.sessionsCount}`, label: 'SESIONES (7D)', desc: 'Rutinas completas', color: '#10b981' }
    ];

    cards.forEach((c) => {
      // 1. Fondo de la tarjeta glassmorphic
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, cardW, cardH, 24);
      ctx.fill();

      // Borde sutil
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Pequeño borde brillante de color a la izquierda
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.roundRect(c.x, c.y + 40, 6, cardH - 80, 3);
      ctx.fill();

      // 2. Icono en la esquina superior derecha
      ctx.font = "46px 'Inter', sans-serif";
      ctx.textAlign = 'right';
      ctx.fillText(c.icon, c.x + cardW - 35, c.y + 70);

      // 3. Valor principal gigante centrado verticalmente
      ctx.fillStyle = '#ffffff';
      ctx.font = "900 68px 'Orbitron', sans-serif";
      ctx.textAlign = 'left';
      ctx.fillText(c.val, c.x + 35, c.y + 140);

      // 4. Etiquetas inferiores
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = "900 20px 'Orbitron', sans-serif";
      ctx.fillText(c.label, c.x + 35, c.y + 215);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = "500 16px 'Inter', sans-serif";
      ctx.fillText(c.desc, c.x + 35, c.y + 250);
    });

    // I. Pie de Página (Branding / Motivación)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = "bold 20px 'Orbitron', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('PLANIFICACIÓN INTELIGENTE  🧬  EJECUCIÓN IMPECABLE', W / 2, H - 200);

    ctx.fillStyle = primaryHex + 'b3';
    ctx.font = "900 22px 'Orbitron', sans-serif";
    ctx.fillText('EVOLUTIONLAB.FIT', W / 2, H - 150);

    // Guardar URL de descarga final
    setDownloadUrl(canvas.toDataURL('image/png'));
  }, [athleteName, themeColor, themeSecondaryColor, metrics, sesiones, rol, suscripcionPlan, fontsLoaded]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 8, 16, 0.95)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid var(--theme-border)',
        borderRadius: '24px',
        maxWidth: '440px',
        width: '100%',
        padding: '28px',
        textAlign: 'center',
        boxShadow: '0 20px 50px var(--theme-glow)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontFamily: "'Orbitron', sans-serif", color: 'var(--theme-primary)', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            Compartir Progreso 📸
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '24px', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>

        {/* Canvas preview */}
        <div style={{
          width: '100%',
          maxWidth: '280px',
          aspectRatio: '9/16',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.1)',
          background: '#0b0f19',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
        }}>
          {!fontsLoaded ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', fontFamily: "'Orbitron', sans-serif", fontSize: '11px' }}>
              CARGANDO FUENTES...
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: '100%',
                display: 'block'
              }}
            />
          )}
        </div>

        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5', margin: 0 }}>
          Descarga esta tarjeta en alta definición (1080x1920) y compártela en tus Instagram o WhatsApp Stories.
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
              borderRadius: '12px',
              padding: '12px',
              fontSize: '11px',
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            LUEGO
          </button>
          <a
            href={downloadUrl}
            download={`EvolutionLab_Progreso_${athleteName}.png`}
            style={{
              flex: 1,
              background: 'var(--theme-btn-gradient)',
              color: 'white',
              borderRadius: '12px',
              padding: '12px',
              fontSize: '11px',
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px var(--theme-btn-glow)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              pointerEvents: downloadUrl ? 'auto' : 'none',
              opacity: downloadUrl ? 1 : 0.6
            }}
          >
            DESCARGAR 📥
          </a>
        </div>
      </div>
    </div>
  );
};

export default ShareableProgressCard;
