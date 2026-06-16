import React, { useState, useEffect, useMemo } from 'react';
import { useSupabase } from '../../context/SupabaseContext';
import { supabase } from '../../lib/supabaseClient';
import { Logro } from '../../types/database.types';
import { Session } from '../../lib/overload';
import confetti from 'canvas-confetti';

export interface CustomBadgeDef {
  id?: string;
  titulo: string;
  descripcion: string;
  icono: string;
  tipo: 'logro' | 'insignia' | 'pr';
  condicion: 'sesiones_total' | 'ejercicios_diferentes' | 'racha_actual' | 'tiene_pr';
  valor_objetivo: number;
}

interface GamificacionPanelProps {
  sesiones: Session[];
  customBadges?: CustomBadgeDef[];
}

// Default Badge definitions
const INSIGNIAS_DEFS = [
  { id: 'primera_sesion', titulo: 'Primera Sesión', desc: 'Registraste tu primera sesión', icono: '🎯', tipo: 'logro' as const, condition: (s: Session[]) => s.length >= 1 },
  { id: 'semana_5', titulo: 'Semana Fuerte', desc: '5 sesiones registradas', icono: '💪', tipo: 'logro' as const, condition: (s: Session[]) => uniqueDates(s).length >= 5 },
  { id: 'mes_constante', titulo: 'Mes Constante', desc: '20 sesiones en total', icono: '🔥', tipo: 'logro' as const, condition: (s: Session[]) => uniqueDates(s).length >= 20 },
  { id: 'veterano_50', titulo: 'Veterano', desc: '50 sesiones registradas', icono: '🏆', tipo: 'logro' as const, condition: (s: Session[]) => uniqueDates(s).length >= 50 },
  { id: 'centurion', titulo: 'Centurión', desc: '100 sesiones completadas', icono: '⭐', tipo: 'logro' as const, condition: (s: Session[]) => uniqueDates(s).length >= 100 },
  { id: 'variedad_5', titulo: 'Versatil', desc: '5+ ejercicios diferentes', icono: '🧠', tipo: 'insignia' as const, condition: (s: Session[]) => uniqueExercises(s) >= 5 },
  { id: 'variedad_15', titulo: 'Arsenal Completo', desc: '15+ ejercicios diferentes', icono: '🛡️', tipo: 'insignia' as const, condition: (s: Session[]) => uniqueExercises(s) >= 15 },
  { id: 'pr_hunter', titulo: 'Cazador de PRs', desc: 'Superaste tu peso máximo en algún ejercicio', icono: '🚀', tipo: 'pr' as const, condition: (s: Session[]) => hasPR(s) },
];

function uniqueDates(sessions: Session[]): string[] {
  return [...new Set(sessions.map((s) => s.fecha))];
}

function uniqueExercises(sessions: Session[]): number {
  return new Set(sessions.map((s) => s.ejercicio.toLowerCase())).size;
}

function hasPR(sessions: Session[]): boolean {
  const maxByExercise: Record<string, number> = {};
  let foundPR = false;
  const sorted = [...sessions].sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const s of sorted) {
    const key = s.ejercicio.toLowerCase();
    if (s.peso > 0) {
      if (maxByExercise[key] !== undefined && s.peso > maxByExercise[key]) {
        foundPR = true;
      }
      maxByExercise[key] = Math.max(maxByExercise[key] || 0, s.peso);
    }
  }
  return foundPR;
}

function countPRs(sessions: Session[]): number {
  const maxByExercise: Record<string, number> = {};
  let prCount = 0;
  const sorted = [...sessions].sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const s of sorted) {
    const key = s.ejercicio.toLowerCase();
    if (s.peso > 0) {
      if (maxByExercise[key] !== undefined && s.peso > maxByExercise[key]) {
        prCount++;
      }
      maxByExercise[key] = Math.max(maxByExercise[key] || 0, s.peso);
    }
  }
  return prCount;
}

function calcularRacha(sessions: Session[]): { actual: number; maxima: number } {
  if (sessions.length === 0) return { actual: 0, maxima: 0 };

  const dates = uniqueDates(sessions).sort();
  if (dates.length === 0) return { actual: 0, maxima: 0 };

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 4) {
      currentStreak++;
    } else {
      maxStreak = Math.max(maxStreak, currentStreak);
      currentStreak = 1;
    }
  }
  maxStreak = Math.max(maxStreak, currentStreak);

  const lastDate = new Date(dates[dates.length - 1]);
  const daysSinceLast = Math.round((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  const activeStreak = daysSinceLast <= 4 ? currentStreak : 0;

  return { actual: activeStreak, maxima: maxStreak };
}

const evaluateCustomBadge = (badge: CustomBadgeDef, sessions: Session[], rachaActiva: number) => {
  switch (badge.condicion) {
    case 'sesiones_total':
      return uniqueDates(sessions).length >= badge.valor_objetivo;
    case 'ejercicios_diferentes':
      return uniqueExercises(sessions) >= badge.valor_objetivo;
    case 'racha_actual':
      return rachaActiva >= badge.valor_objetivo;
    case 'tiene_pr':
      return hasPR(sessions);
    default:
      return false;
  }
};

export const GamificacionPanel: React.FC<GamificacionPanelProps> = ({ sesiones, customBadges }) => {
  const { user } = useSupabase();
  const [savedLogros, setSavedLogros] = useState<Logro[]>([]);
  const [loadingLogros, setLoadingLogros] = useState<boolean>(true);
  const [celebratingBadge, setCelebratingBadge] = useState<any | null>(null);

  // Load saved achievements
  useEffect(() => {
    if (!user) return;
    const fetchLogros = async () => {
      try {
        setLoadingLogros(true);
        const { data } = await supabase
          .from('gamificacion')
          .select('*')
          .eq('cliente_id', user.id);
        if (data) setSavedLogros(data as Logro[]);
      } catch (e) {
        console.warn('Error al cargar logros:', e);
      } finally {
        setLoadingLogros(false);
      }
    };
    fetchLogros();
  }, [user]);

  // Calculate stats
  const racha = useMemo(() => calcularRacha(sesiones), [sesiones]);
  const totalSesiones = useMemo(() => uniqueDates(sesiones).length, [sesiones]);
  const prCount = useMemo(() => countPRs(sesiones), [sesiones]);

  // Merge default badges and trainer custom badges
  const badgesList = useMemo(() => {
    if (customBadges && customBadges.length > 0) {
      return customBadges.map((cb, idx) => ({
        id: cb.id || `custom_${idx}`,
        titulo: cb.titulo,
        desc: cb.descripcion,
        icono: cb.icono,
        tipo: cb.tipo,
        condition: (s: Session[]) => evaluateCustomBadge(cb, s, racha.actual)
      }));
    }
    return INSIGNIAS_DEFS;
  }, [customBadges, racha.actual]);

  // Calculate earned badges
  const earnedBadges = useMemo(() => {
    return badgesList.filter((badge) => badge.condition(sesiones));
  }, [sesiones, badgesList]);

  const lockedBadges = useMemo(() => {
    return badgesList.filter((badge) => !badge.condition(sesiones));
  }, [sesiones, badgesList]);

  // Save new achievements and celebrate them
  useEffect(() => {
    if (loadingLogros || !user || earnedBadges.length === 0) return;

    const saveBadgeToDb = async (badge: any) => {
      try {
        await supabase.from('gamificacion').upsert({
          cliente_id: user.id,
          tipo: badge.tipo,
          titulo: badge.titulo,
          descripcion: badge.desc,
          valor: 1,
          datos: { icono: badge.icono },
        }, { onConflict: 'cliente_id,tipo,titulo' });
      } catch (e) {
        console.warn('Error al guardar logro en BD:', e);
      }
    };

    const newBadges = earnedBadges.filter(
      (b) => !savedLogros.some((sl) => sl.titulo === b.titulo)
    );

    if (newBadges.length > 0) {
      const isFirstLoadRef = sessionStorage.getItem(`evolution_gam_loaded_${user.id}`);
      if (!isFirstLoadRef) {
        sessionStorage.setItem(`evolution_gam_loaded_${user.id}`, 'true');
        // Save silently
        newBadges.forEach(badge => saveBadgeToDb(badge));
        setSavedLogros(prev => [...prev, ...newBadges.map(b => ({ titulo: b.titulo }) as Logro)]);
      } else {
        // Celebrate the first new badge, save all
        const badgeToCelebrate = newBadges[0];
        setCelebratingBadge(badgeToCelebrate);
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
        
        newBadges.forEach(badge => saveBadgeToDb(badge));
        setSavedLogros(prev => [...prev, ...newBadges.map(b => ({ titulo: b.titulo }) as Logro)]);
      }
    }
  }, [loadingLogros, earnedBadges, savedLogros, user]);

  // Score and Level Calculations
  const totalPoints = useMemo(() => {
    return (totalSesiones * 50) + (earnedBadges.length * 200) + (racha.actual * 25) + (prCount * 100);
  }, [totalSesiones, earnedBadges.length, racha.actual, prCount]);

  const currentLevel = useMemo(() => {
    return Math.floor(Math.sqrt(totalPoints / 250)) + 1;
  }, [totalPoints]);

  const levelProgress = useMemo(() => {
    const nextLvl = currentLevel;
    const currentLvl = currentLevel - 1;
    const currentLvlPoints = Math.pow(currentLvl, 2) * 250;
    const nextLvlPoints = Math.pow(nextLvl, 2) * 250;
    const ptsGained = totalPoints - currentLvlPoints;
    const ptsNeeded = nextLvlPoints - currentLvlPoints;
    return {
      pointsGained: ptsGained,
      pointsNeeded: ptsNeeded,
      pct: ptsNeeded > 0 ? (ptsGained / ptsNeeded) * 100 : 100
    };
  }, [totalPoints, currentLevel]);

  // Weekly historical comparison (Tú vs Tú)
  const weeklyComparison = useMemo(() => {
    const now = new Date();
    const startOfThisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfLastWeek = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const thisWeekSessions = sesiones.filter(s => new Date(s.fecha) >= startOfThisWeek);
    const lastWeekSessions = sesiones.filter(s => {
      const d = new Date(s.fecha);
      return d >= startOfLastWeek && d < startOfThisWeek;
    });

    const getVol = (sess: Session[]) => sess.reduce((sum, s) => {
      const repsList = s.repsArray?.length ? s.repsArray : (s.series_reps?.length ? s.series_reps : (s.reps != null ? [s.reps] : [0]));
      const totalReps = repsList.reduce((a, b) => a + b, 0);
      return sum + (s.peso * totalReps);
    }, 0);

    const volThis = getVol(thisWeekSessions);
    const volLast = getVol(lastWeekSessions);

    const countThis = uniqueDates(thisWeekSessions).length;
    const countLast = uniqueDates(lastWeekSessions).length;

    const prsThis = countPRs(thisWeekSessions);
    const prsLast = countPRs(lastWeekSessions);

    return {
      vol: { current: volThis, last: volLast, pct: volLast ? ((volThis - volLast) / volLast) * 100 : 0 },
      count: { current: countThis, last: countLast, diff: countThis - countLast },
      prs: { current: prsThis, last: prsLast, diff: prsThis - prsLast }
    };
  }, [sesiones]);

  const nextMilestone = useMemo(() => {
    const milestones = [5, 20, 50, 100, 200];
    const next = milestones.find((m) => totalSesiones < m);
    if (!next) return null;
    return { target: next, progress: (totalSesiones / next) * 100 };
  }, [totalSesiones]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* LEVEL AND SCORE BOX */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.08), rgba(123, 47, 247, 0.08))',
        border: '1px solid rgba(0, 212, 255, 0.2)',
        borderRadius: '16px', padding: '16px',
        boxShadow: '0 8px 32px 0 rgba(0, 212, 255, 0.05)',
        display: 'flex', flexDirection: 'column', gap: '10px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '1px', fontFamily: "'Orbitron', sans-serif" }}>
              NIVEL ATLETA
            </span>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'white', fontFamily: "'Orbitron', sans-serif", display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <span>LVL {currentLevel}</span>
              <span style={{ fontSize: '16px', color: 'var(--theme-primary, #00d4ff)', fontWeight: 600 }}>⚡</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '1px', fontFamily: "'Orbitron', sans-serif" }}>
              PUNTOS TOTALES
            </span>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#a5b4fc', fontFamily: "'Orbitron', sans-serif", marginTop: '2px' }}>
              {totalPoints} <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>PTS</span>
            </div>
          </div>
        </div>

        {/* Experience Bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'rgba(255,255,255,0.45)', marginBottom: '4px', fontFamily: "'Orbitron', sans-serif" }}>
            <span>PROGRESO NIVEL</span>
            <span>{levelProgress.pointsGained} / {levelProgress.pointsNeeded} XP ({Math.round(levelProgress.pct)}%)</span>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${levelProgress.pct}%`,
              background: 'linear-gradient(90deg, var(--theme-primary, #00d4ff), var(--theme-secondary, #7b2ff7))',
              borderRadius: '4px',
              transition: 'width 0.6s ease',
              boxShadow: '0 0 10px rgba(0, 212, 255, 0.3)'
            }} />
          </div>
        </div>
      </div>

      {/* STATS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        <div style={{
          background: racha.actual > 0 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.02)',
          border: `1px solid ${racha.actual > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.06)'}`,
          borderRadius: '12px', padding: '14px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '22px', marginBottom: '4px' }}>{racha.actual > 0 ? '🔥' : '❄️'}</div>
          <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '20px', fontWeight: 800, color: racha.actual > 0 ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}>
            {racha.actual}
          </div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.5px', marginTop: '2px' }}>
            RACHA ACTIVA
          </div>
        </div>

        <div style={{
          background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: '12px', padding: '14px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '22px', marginBottom: '4px' }}>📊</div>
          <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '20px', fontWeight: 800, color: '#a5b4fc' }}>
            {totalSesiones}
          </div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.5px', marginTop: '2px' }}>
            SESIONES
          </div>
        </div>

        <div style={{
          background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '12px', padding: '14px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '22px', marginBottom: '4px' }}>🏆</div>
          <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '20px', fontWeight: 800, color: '#34d399' }}>
            {racha.maxima}
          </div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.5px', marginTop: '2px' }}>
            MEJOR RACHA
          </div>
        </div>
      </div>

      {/* WEEKLY HISTORICAL COMPARISON (TÚ VS TÚ) */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.4)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: '12px'
      }}>
        <div style={{ fontSize: '10px', color: 'var(--theme-primary, #00d4ff)', fontWeight: 700, letterSpacing: '1px', fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase' }}>
          Tú vs Tú — Progreso Semanal 📈
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px' }}>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>VOLUMEN SEMANAL</div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', marginTop: '2px', fontFamily: "'Orbitron', sans-serif" }}>
              {weeklyComparison.vol.current.toLocaleString()} kg
            </div>
            <div style={{ fontSize: '9px', color: weeklyComparison.vol.pct >= 0 ? '#34d399' : '#f87171', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '4px', fontWeight: 'bold' }}>
              {weeklyComparison.vol.pct >= 0 ? `▲ +${weeklyComparison.vol.pct.toFixed(1)}%` : `▼ ${weeklyComparison.vol.pct.toFixed(1)}%`}
              <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 'normal' }}> vs sem anterior ({weeklyComparison.vol.last.toLocaleString()} kg)</span>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px' }}>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>ENTRENAMIENTOS</div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', marginTop: '2px', fontFamily: "'Orbitron', sans-serif" }}>
              {weeklyComparison.count.current} sesiones
            </div>
            <div style={{ fontSize: '9px', color: weeklyComparison.count.diff >= 0 ? '#34d399' : '#f87171', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '4px', fontWeight: 'bold' }}>
              {weeklyComparison.count.diff >= 0 ? `▲ +${weeklyComparison.count.diff}` : `▼ ${weeklyComparison.count.diff}`}
              <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 'normal' }}> vs sem anterior ({weeklyComparison.count.last})</span>
            </div>
          </div>
        </div>
        <div style={{
          background: 'rgba(0, 212, 255, 0.02)',
          border: '1px solid rgba(0, 212, 255, 0.1)',
          borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>PRs Rotos esta semana:</span>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--theme-primary, #00d4ff)', fontFamily: "'Orbitron', sans-serif" }}>🚀 {weeklyComparison.prs.current} nuevos PRs</span>
        </div>
      </div>

      {/* PROGRESS BAR */}
      {nextMilestone && (
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '12px', padding: '14px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              Próximo hito: {nextMilestone.target} sesiones
            </span>
            <span style={{ fontSize: '10px', color: 'var(--theme-primary, #00d4ff)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif" }}>
              {Math.round(nextMilestone.progress)}%
            </span>
          </div>
          <div style={{
            height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: '3px', width: `${Math.min(nextMilestone.progress, 100)}%`,
              background: 'linear-gradient(90deg, var(--theme-primary, #00d4ff), var(--theme-secondary, #7b2ff7))',
              transition: 'width 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
              boxShadow: '0 0 8px rgba(0, 212, 255, 0.3)',
            }} />
          </div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginTop: '6px', textAlign: 'center' }}>
            {totalSesiones} / {nextMilestone.target} sesiones completadas
          </div>
        </div>
      )}

      {/* EARNED BADGES */}
      {earnedBadges.length > 0 && (
        <div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '1px', fontFamily: "'Orbitron', sans-serif", marginBottom: '10px', textTransform: 'uppercase' }}>
            Logros desbloqueados ({earnedBadges.length}/{badgesList.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
            {earnedBadges.map((badge) => (
              <div
                key={badge.id}
                style={{
                  background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '10px', padding: '12px', textAlign: 'center',
                  transition: 'transform 0.2s',
                }}
              >
                <div style={{ fontSize: '26px', marginBottom: '6px' }}>{badge.icono}</div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#34d399', marginBottom: '2px' }}>{badge.titulo}</div>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{badge.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LOCKED BADGES */}
      {lockedBadges.length > 0 && (
        <div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '1px', fontFamily: "'Orbitron', sans-serif", marginBottom: '10px', textTransform: 'uppercase' }}>
            Por desbloquear
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
            {lockedBadges.map((badge) => (
              <div
                key={badge.id}
                style={{
                  background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)',
                  borderRadius: '10px', padding: '12px', textAlign: 'center', opacity: 0.5,
                }}
              >
                <div style={{ fontSize: '26px', marginBottom: '6px', filter: 'grayscale(1)' }}>{badge.icono}</div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>{badge.titulo}</div>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>{badge.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CELEBRATION FULLSCREEN MODAL */}
      {celebratingBadge && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(5, 7, 12, 0.92)', backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          zIndex: 999999, padding: '20px'
        }} onClick={() => setCelebratingBadge(null)}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(10, 15, 28, 0.95))',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: '24px', padding: '40px 24px', maxWidth: '400px', width: '100%',
            textAlign: 'center', boxShadow: '0 20px 60px rgba(0, 212, 255, 0.15)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setCelebratingBadge(null)}
              style={{
                position: 'absolute', top: '15px', right: '15px',
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                fontSize: '18px', cursor: 'pointer'
              }}
            >
              ✕
            </button>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '44px', boxShadow: '0 0 25px rgba(0, 212, 255, 0.2)',
              animation: 'pulse 2s infinite'
            }}>
              {celebratingBadge.icono}
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--theme-primary, #00d4ff)', fontWeight: 800, letterSpacing: '2px', fontFamily: "'Orbitron', sans-serif" }}>
                ¡LOGRO DESBLOQUEADO!
              </span>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'white', fontFamily: "'Orbitron', sans-serif", margin: '6px 0 10px' }}>
                {celebratingBadge.titulo}
              </h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', margin: 0 }}>
                {celebratingBadge.desc}
              </p>
            </div>
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px', padding: '12px 20px', fontSize: '11px',
              color: '#34d399', fontWeight: 700, fontFamily: "'Orbitron', sans-serif"
            }}>
              ⭐ +200 PTS DE EXPERIENCIA
            </div>
            <button
              onClick={() => setCelebratingBadge(null)}
              style={{
                background: 'var(--theme-btn-gradient, linear-gradient(135deg, #00d4ff, #0070a0))',
                border: 'none', color: 'white', padding: '12px 28px', borderRadius: '12px',
                fontSize: '11px', fontWeight: 700, fontFamily: "'Orbitron', sans-serif",
                cursor: 'pointer', boxShadow: '0 4px 15px rgba(0, 212, 255, 0.3)', width: '100%'
              }}
            >
              ¡ENTENDIDO, A SEGUIR ASÍ!
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default GamificacionPanel;
