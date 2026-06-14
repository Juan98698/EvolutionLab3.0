// src/components/dashboard/ShareableProgressCard.tsx
import React, { useRef, useEffect, useState } from 'react';
import { Session } from '../../lib/overload';

interface ShareableProgressCardProps {
  onClose: () => void;
  athleteName: string;
  themeColor: string;
  themeSecondaryColor: string;
  sesiones: Session[];
}

export const ShareableProgressCard: React.FC<ShareableProgressCardProps> = ({
  onClose,
  athleteName,
  themeColor,
  themeSecondaryColor,
  sesiones
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>('');

  // 1. Calcular métricas semanales
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
      // Sumar reps * peso para cada serie en repsArray
      const repsCount = s.repsArray?.reduce((a, b) => a + b, 0) || 0;
      volume += (s.peso || 0) * repsCount;
    });

    // PRs rotos en los últimos 7 días
    // Un PR ocurre si el peso de hoy supera el peso máximo histórico anterior de ese ejercicio
    const prsCount = (() => {
      let prs = 0;
      const maxByExerciseBeforeWeek: Record<string, number> = {};
      
      // Ordenar por fecha histórica
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
            // Primer registro del ejercicio
            maxByExerciseBeforeWeek[key] = s.peso;
          }
        }
      });
      return prs;
    })();

    // Calcular racha activa (copiado de GamificacionPanel)
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

    return {
      sessionsCount,
      volume,
      prsCount,
      activeStreak
    };
  }, [sesiones]);

  // 2. Dibujar Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dimensiones 1080 x 1920 (Instagram Story)
    const W = 1080;
    const H = 1920;
    canvas.width = W;
    canvas.height = H;

    // A. Fondo Oscuro profundo
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, W, H);

    // B. Resplandores radiales de neon en las esquinas
    // Glow 1: Cian en la esquina superior izquierda
    const grad1 = ctx.createRadialGradient(0, 0, 100, 200, 200, 700);
    grad1.addColorStop(0, themeColor + '25'); // ~15% opacidad
    grad1.addColorStop(1, 'transparent');
    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, W, H);

    // Glow 2: Morado en la esquina inferior derecha
    const grad2 = ctx.createRadialGradient(W, H, 100, W - 200, H - 200, 800);
    grad2.addColorStop(0, themeSecondaryColor + '30'); // ~20% opacidad
    grad2.addColorStop(1, 'transparent');
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, W, H);

    // C. Rejilla tecnológica (Grid)
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.02)';
    ctx.lineWidth = 2;
    const gridSpacing = 80;
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

    // D. Líneas decorativas sci-fi en los bordes (Brackets)
    ctx.strokeStyle = themeColor + '50';
    ctx.lineWidth = 4;
    const pad = 50;
    const bLen = 60;
    // Esquina superior izquierda
    ctx.beginPath();
    ctx.moveTo(pad + bLen, pad);
    ctx.lineTo(pad, pad);
    ctx.lineTo(pad, pad + bLen);
    ctx.stroke();
    // Esquina superior derecha
    ctx.beginPath();
    ctx.moveTo(W - pad - bLen, pad);
    ctx.lineTo(W - pad, pad);
    ctx.lineTo(W - pad, pad + bLen);
    ctx.stroke();
    // Esquina inferior izquierda
    ctx.beginPath();
    ctx.moveTo(pad + bLen, H - pad);
    ctx.lineTo(pad, H - pad);
    ctx.lineTo(pad, H - pad + bLen);
    ctx.stroke();
    // Esquina inferior derecha
    ctx.beginPath();
    ctx.moveTo(W - pad - bLen, H - pad);
    ctx.lineTo(W - pad, H - pad);
    ctx.lineTo(W - pad, H - pad + bLen);
    ctx.stroke();

    // E. Textos y Cabecera
    // Badge superior "EVOLUTION LAB"
    ctx.fillStyle = 'rgba(0, 212, 255, 0.06)';
    const badgeW = 400;
    const badgeH = 70;
    const badgeX = (W - badgeW) / 2;
    const badgeY = 180;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 35);
    ctx.fill();
    ctx.strokeStyle = themeColor + '40';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = themeColor;
    ctx.font = "bold 26px 'Orbitron', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EVOLUTION LAB 3.0', W / 2, badgeY + badgeH / 2 + 2);

    // Título Principal
    ctx.fillStyle = '#ffffff';
    ctx.font = "900 68px 'Orbitron', sans-serif";
    ctx.fillText('DESEMPEÑO SEMANAL', W / 2, 330);

    // Línea de división de gradiente
    const lineGrad = ctx.createLinearGradient(W / 2 - 250, 0, W / 2 + 250, 0);
    lineGrad.addColorStop(0, 'transparent');
    lineGrad.addColorStop(0.5, themeColor);
    lineGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 250, 390);
    ctx.lineTo(W / 2 + 250, 390);
    ctx.stroke();

    // F. Nombre del Atleta
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 38px 'Orbitron', sans-serif";
    ctx.fillText('ATLETA', W / 2, 470);
    
    ctx.fillStyle = themeColor;
    ctx.font = "bold 56px 'Orbitron', sans-serif";
    ctx.fillText(athleteName.toUpperCase(), W / 2, 540);

    // G. Tarjetas de Indicadores (Stats Blocks)
    const startY = 670;
    const blockH = 190;
    const blockW = 860;
    const blockX = (W - blockW) / 2;
    const gap = 50;

    const cardsData = [
      { label: 'RACHA DE ENTRENAMIENTO', val: `${metrics.activeStreak} Días`, desc: 'Mantén la consistencia y activa tu sobrecarga', icon: '🔥', glow: '#ef4444' },
      { label: 'VOLUMEN MOVILIZADO (7D)', val: `${metrics.volume.toLocaleString('es-CO')} kg`, desc: 'Peso total movilizado en la semana', icon: '🏋️', glow: themeColor },
      { label: 'RÉCORDS PERSONALES (PRs)', val: `${metrics.prsCount} PRs Rotos`, desc: 'Has superado tus marcas históricas', icon: '🚀', glow: '#eab308' },
      { label: 'SESIONES COMPLETADAS', val: `${metrics.sessionsCount} Sesiones`, desc: 'Rutinas de entrenamiento ejecutadas', icon: '✅', glow: '#10b981' }
    ];

    cardsData.forEach((card, idx) => {
      const y = startY + idx * (blockH + gap);

      // Fondo del bloque
      ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
      ctx.beginPath();
      ctx.roundRect(blockX, y, blockW, blockH, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Línea de acento izquierda de color
      ctx.fillStyle = card.glow;
      ctx.fillRect(blockX, y + 25, 6, blockH - 50);

      // Icono
      ctx.font = "60px 'Inter', sans-serif";
      ctx.textAlign = 'left';
      ctx.fillText(card.icon, blockX + 45, y + blockH / 2 + 5);

      // Textos de la tarjeta
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = "bold 20px 'Orbitron', sans-serif";
      ctx.fillText(card.label, blockX + 140, y + 55);

      ctx.fillStyle = '#ffffff';
      ctx.font = "bold 44px 'Orbitron', sans-serif";
      ctx.fillText(card.val, blockX + 140, y + 112);

      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = "500 18px 'Inter', sans-serif";
      ctx.fillText(card.desc, blockX + 140, y + 152);
    });

    // H. Pie de página y crédito
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = "bold 22px 'Orbitron', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('PLANIFICACIÓN INTELIGENTE 🧬 EJECUCIÓN IMPECABLE', W / 2, H - 220);

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = "16px 'Orbitron', sans-serif";
    ctx.fillText('EVOLUTIONLAB.FIT', W / 2, H - 170);

    // Guardar URL de descarga
    setDownloadUrl(canvas.toDataURL('image/png'));
  }, [athleteName, themeColor, themeSecondaryColor, metrics, sesiones]);

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
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '24px', cursor: 'pointer', lineHeght: 1 }}>&times;</button>
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
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'block'
            }}
          />
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
              transition: 'all 0.2s'
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
