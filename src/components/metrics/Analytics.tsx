import React, { useState, useEffect, useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, BarController, LineController, Tooltip, Legend } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { useSupabase } from '../../context/SupabaseContext';
import { supabase } from '../../lib/supabaseClient';
import { LocalSesion } from '../../types/database.types';
import AthleteNavbar from '../common/AthleteNavbar';
import Toast from '../common/Toast';

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  Tooltip,
  Legend
);

export const Analytics: React.FC = () => {
  const { user } = useSupabase();

  const [sesiones, setSesiones] = useState<LocalSesion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedEx, setSelectedEx] = useState<string>('');
  const [themeTick, setThemeTick] = useState<number>(0);

  useEffect(() => {
    const handleThemeChange = () => {
      setThemeTick(tick => tick + 1);
    };
    window.addEventListener('pwa-theme-changed', handleThemeChange);
    return () => window.removeEventListener('pwa-theme-changed', handleThemeChange);
  }, []);

  const themeColors = useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    const primary = style.getPropertyValue('--theme-primary').trim() || '#00d4ff';
    const secondary = style.getPropertyValue('--theme-secondary').trim() || '#7b2ff7';
    const primaryGlow = style.getPropertyValue('--theme-glow').trim() || 'rgba(0, 212, 255, 0.15)';
    
    return {
      primary,
      secondary,
      primaryGlow
    };
  }, [themeTick]);

  // Estados de Toast
  const [toastState, setToastState] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastState({ visible: true, message, type });
    setTimeout(() => {
      setToastState((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  // Cargar Historial
  const loadHistorial = async () => {
    if (!user) return;
    setLoading(true);

    let success = false;

    try {
      const { data, error } = await supabase
        .from('sesiones_historial')
        .select(`
          id,
          fecha,
          notas_generales,
          sesiones_ejercicios (
            id,
            nombre_ejercicio,
            grupo_muscular,
            series_reps,
            peso,
            rpe_rir,
            descanso,
            volumen,
            rm_estimado
          )
        `)
        .eq('cliente_id', user.id)
        .order('fecha', { ascending: true }); // Para gráficos es mejor orden cronológico ascendente

      if (error) throw error;

      if (data) {
        const formatted: LocalSesion[] = data.map((s: any) => ({
          id: s.id,
          fecha: s.fecha,
          notas_sesion: s.notas_generales || '',
          ejercicios: (s.sesiones_ejercicios || []).map((e: any) => ({
            id_ej: e.id,
            nombre: e.nombre_ejercicio,
            grupo: e.grupo_muscular || 'General',
            peso: e.peso,
            repsArray: e.series_reps || [],
            rpe: e.rpe_rir,
            descanso: e.descanso,
            notas_ej: ''
          }))
        }));

        setSesiones(formatted);
        localStorage.setItem('sobrecarga_v5', JSON.stringify(formatted));
        success = true;
      }
    } catch (err) {
      console.warn('No se pudo descargar el historial de la nube para gráficos, usando caché:', err);
    }

    if (!success) {
      // Offline / Caché fallback
      try {
        const cached = localStorage.getItem('sobrecarga_v5');
        if (cached) {
          setSesiones(JSON.parse(cached));
          showToast('Cargado en modo offline 🔌', 'info');
        } else {
          setSesiones([]);
        }
      } catch (e) {
        console.error('Error al cargar historial de caché:', e);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    loadHistorial();
  }, [user]);

  // Lista de todos los ejercicios únicos registrados para el filtro
  const allExercises = useMemo(() => {
    const names = new Set<string>();
    sesiones.forEach(s => s.ejercicios.forEach(e => names.add(e.nombre)));
    return Array.from(names).sort();
  }, [sesiones]);

  // Auto-seleccionar primer ejercicio si no hay seleccionado
  useEffect(() => {
    if (!selectedEx && allExercises.length > 0) {
      setSelectedEx(allExercises[0]);
    }
  }, [allExercises, selectedEx]);

  // Filtrar y aplanar filas del ejercicio seleccionado ordenadas por fecha ascendente
  const activeExData = useMemo(() => {
    if (!selectedEx) return { labels: [], volumes: [], rms: [] };

    const rows: { fecha: string; volumen: number; rm: number }[] = [];

    // Clonar sesiones y ordenar ascendente
    const sortedSesiones = [...sesiones].sort((a, b) => a.fecha.localeCompare(b.fecha));

    sortedSesiones.forEach(s => {
      s.ejercicios.forEach(e => {
        if (e.nombre === selectedEx) {
          const repsArray = e.repsArray || [];
          const totalReps = repsArray.reduce((a, b) => a + b, 0);
          const volumen = e.peso * totalReps;
          
          let rm = 0;
          if (repsArray.length > 0) {
            const maxReps = Math.max(...repsArray);
            const epley = e.peso * (1 + maxReps / 30);
            const brzycki = e.peso / (1.0278 - 0.0278 * maxReps);
            rm = (epley + brzycki) / 2;
          }

          rows.push({
            fecha: s.fecha,
            volumen,
            rm
          });
        }
      });
    });

    // Agrupar por fecha si por alguna razón tiene más de una sesión el mismo día
    const labels = rows.map(r => {
      const cleanDate = r.fecha.includes('-') ? r.fecha.split('-').reverse().join('/') : r.fecha;
      const parts = cleanDate.split('/');
      return parts.length >= 2 ? parts.slice(0, 2).join('/') : cleanDate;
    });

    const volumes = rows.map(r => r.volumen);
    const rms = rows.map(r => r.rm);

    return { labels, volumes, rms };
  }, [sesiones, selectedEx]);

  // Configuración de Datos del Gráfico
  const chartData = useMemo(() => {
    return {
      labels: activeExData.labels,
      datasets: [
        {
          type: 'bar' as const,
          label: 'Volumen (kg)',
          data: activeExData.volumes,
          backgroundColor: themeColors.primaryGlow,
          borderColor: themeColors.primary,
          borderWidth: 1.5,
          yAxisID: 'y',
        },
        {
          type: 'line' as const,
          label: '1RM estimado',
          data: activeExData.rms,
          borderColor: themeColors.secondary,
          backgroundColor: 'transparent',
          borderWidth: 3,
          pointBackgroundColor: themeColors.secondary,
          pointBorderColor: themeColors.primary,
          pointRadius: 5,
          tension: 0.3,
          yAxisID: 'y2',
        }
      ]
    };
  }, [activeExData, themeColors]);

  // Configuración de Opciones del Gráfico
  const chartOptions = useMemo(() => {
    const gridColor = 'rgba(255, 255, 255, 0.06)';
    const labelColor = '#94a3b8';

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      plugins: {
        legend: {
          display: false, // Usamos la leyenda personalizada del legacy
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()} kg`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: labelColor,
            maxRotation: 45,
            font: {
              size: 10
            }
          },
          grid: {
            color: gridColor
          }
        },
        y: {
          title: {
            display: true,
            text: 'Volumen (kg)',
            color: themeColors.primary,
            font: {
              size: 11,
              weight: 'bold' as const
            }
          },
          ticks: {
            color: themeColors.primary,
            font: {
              size: 10
            }
          },
          grid: {
            color: gridColor
          }
        },
        y2: {
          position: 'right' as const,
          title: {
            display: true,
            text: '1RM est. (kg)',
            color: themeColors.secondary,
            font: {
              size: 11,
              weight: 'bold' as const
            }
          },
          ticks: {
            color: themeColors.secondary,
            font: {
              size: 10
            }
          },
          grid: {
            display: false
          }
        }
      }
    };
  }, [themeColors]);

  return (
    <div style={{ background: 'transparent', minHeight: '100vh', color: 'white', paddingBottom: '60px' }}>
      <AthleteNavbar />

      <div className="container stagger-3" style={{ padding: '0 20px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header and Filter */}
        <div className="top-bar" style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '1.5rem', background: 'none', border: 'none', padding: 0 }}>
          <div id="chartTitle" style={{ margin: 0, flex: 1, fontSize: '15px', color: 'white', fontFamily: "'Orbitron',sans-serif", letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Progresión {selectedEx ? `— ${selectedEx}` : ''}
          </div>
          
          <select
            id="ejercicioSelectChart"
            value={selectedEx}
            onChange={(e) => setSelectedEx(e.target.value)}
            style={{ minWidth: '180px', maxWidth: '280px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', padding: '8px 12px' }}
          >
            {allExercises.length === 0 ? (
              <option value="">Sin ejercicios registrados</option>
            ) : (
              allExercises.map(name => (
                <option key={name} value={name}>{name}</option>
              ))
            )}
          </select>
        </div>

        {/* CHART CARD CONTAINER */}
        <div className="chart-card" style={{ background: 'rgba(15, 23, 42, 0.45)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px' }}>
          
          {/* Custom Legends Bar */}
          <div className="chart-legend" style={{ display: 'flex', gap: '20px', fontSize: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="legend-sq" style={{ display: 'inline-block', width: '12px', height: '12px', background: themeColors.primary, borderRadius: '2px' }} />
              Volumen total (kg)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="legend-sq" style={{ display: 'inline-block', width: '12px', height: '12px', background: themeColors.secondary, borderRadius: '50%' }} />
              1RM estimado (kg)
            </span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '260px' }}>
              <div className="spinner" style={{ display: 'block', width: '30px', height: '30px' }} />
            </div>
          ) : !selectedEx ? (
            <div id="chartEmptyState" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '260px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', gap: '16px', padding: '20px' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 8px rgba(0, 212, 255, 0.3))' }}>
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              <span style={{ fontSize: '14px', maxWidth: '320px', fontWeight: 500, lineHeight: 1.4, color: 'rgba(255,255,255,0.6)' }}>
                Registra sesiones en tu historial para ver tu progresión de sobrecarga progresiva.
              </span>
            </div>
          ) : (
            <div id="chartContainer" style={{ position: 'relative', width: '100%', height: '280px' }}>
              <Chart
                type="bar"
                data={chartData}
                options={chartOptions as any}
              />
            </div>
          )}

        </div>

      </div>

      <Toast message={toastState.message} type={toastState.type} visible={toastState.visible} />
    </div>
  );
};

export default Analytics;
