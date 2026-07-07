import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  ArcElement,
  DoughnutController,
  Tooltip,
  Legend
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { useSupabase } from '../../context/SupabaseContext';
import { LocalSesion } from '../../types/database.types';
import { loadAthleteSessions, readSessionsFromCache } from '../../lib/sessions';
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
  ArcElement,
  DoughnutController,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

    try {
      // loadAthleteSessions ya sincroniza offline-first, fusiona sesiones
      // pendientes y escribe al caché compartido de forma segura (mismo
      // fix de la Fase 1). Antes esta función duplicaba esa lógica a mano
      // acá y pisaba el caché sin fusionar — arriesgando perder sesiones
      // offline si alguien abría esta pantalla de métricas con algo pendiente.
      const sessions = await loadAthleteSessions(user.id);
      setSesiones(sessions);
      if (!navigator.onLine) {
        showToast('Cargado en modo offline 🔌', 'info');
      }
    } catch (err) {
      console.warn('No se pudo descargar el historial de la nube para gráficos, usando caché:', err);
      setSesiones(readSessionsFromCache());
      showToast('Cargado en modo offline 🔌', 'info');
    }

    setLoading(false);
  };

  useEffect(() => {
    loadHistorial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Cálculo 1: Distribución de Series por Grupo Muscular en los Últimos 7 Días (Doughnut)
  const weeklyMuscleGroupSeries = useMemo(() => {
    const nowMs = Date.now();
    const sevenDaysAgoStr = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const counts: Record<string, number> = {};

    const recentSessions = sesiones.filter(s => s.fecha >= sevenDaysAgoStr);

    recentSessions.forEach(s => {
      s.ejercicios.forEach(e => {
        const group = e.grupo || 'Otros';
        const seriesCount = e.repsArray?.length || 0;
        if (seriesCount > 0) {
          counts[group] = (counts[group] || 0) + seriesCount;
        }
      });
    });

    return counts;
  }, [sesiones]);

  // Configuración de Datos para el Gráfico de Dona
  const doughnutData = useMemo(() => {
    const labels = Object.keys(weeklyMuscleGroupSeries);
    const data = Object.values(weeklyMuscleGroupSeries);

    const colors = [
      '#00d4ff', // Cyan
      '#7b2ff7', // Purple
      '#ff0055', // Red/Pink
      '#eab308', // Gold/Yellow
      '#10b981', // Green
      '#f97316', // Orange
      '#3b82f6', // Blue
      '#a855f7', // Light Purple
      '#64748b'  // Slate
    ];

    return {
      labels,
      datasets: [
        {
          label: 'Series completadas',
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: 'rgba(15, 23, 42, 0.85)',
          borderWidth: 2,
        }
      ]
    };
  }, [weeklyMuscleGroupSeries]);

  const doughnutOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'right' as const,
          labels: {
            color: '#94a3b8',
            font: {
              size: 10,
              family: "'Orbitron', sans-serif"
            },
            boxWidth: 12
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => ` ${ctx.label}: ${ctx.parsed} series`
          }
        }
      }
    };
  }, []);

  // Cálculo 2: Frecuencia Mensual de Entrenamientos (Últimos 6 meses)
  const monthlyFrequencies = useMemo(() => {
    const monthCounts: Record<string, number> = {};
    const monthLabels: string[] = [];

    const date = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const label = d.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthLabels.push(label);
      monthCounts[key] = 0;
    }

    sesiones.forEach(s => {
      if (!s.fecha) return;
      const key = s.fecha.substring(0, 7);
      if (monthCounts[key] !== undefined) {
        monthCounts[key]++;
      }
    });

    const data = Object.keys(monthCounts).map(k => monthCounts[k]);

    return {
      labels: monthLabels,
      data
    };
  }, [sesiones]);

  // Configuración de Datos para el Gráfico de Barras de Frecuencia
  const frequencyChartData = useMemo(() => {
    return {
      labels: monthlyFrequencies.labels,
      datasets: [
        {
          label: 'Entrenamientos',
          data: monthlyFrequencies.data,
          backgroundColor: themeColors.primaryGlow,
          borderColor: themeColors.primary,
          borderWidth: 1.5,
          borderRadius: 6
        }
      ]
    };
  }, [monthlyFrequencies, themeColors]);

  const frequencyChartOptions = useMemo(() => {
    const gridColor = 'rgba(255, 255, 255, 0.06)';
    const labelColor = '#94a3b8';

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => ` ${ctx.parsed.y} entrenamientos`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: labelColor,
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
            text: 'Sesiones',
            color: themeColors.primary,
            font: {
              size: 11,
              weight: 'bold' as const
            }
          },
          ticks: {
            color: labelColor,
            stepSize: 1,
            font: {
              size: 10
            }
          },
          grid: {
            color: gridColor
          }
        }
      }
    };
  }, [themeColors]);

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
              <span className="desc-text" style={{ fontSize: '14px', maxWidth: '320px', fontWeight: 500, lineHeight: 1.4, color: 'rgba(255,255,255,0.6)' }}>
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

        {/* CONTENEDOR GRID PARA LAS DOS NUEVAS MÉTRICAS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
          marginTop: '24px'
        }}>
          {/* Tarjeta 1: Distribución de Volumen Semanal (Doughnut) */}
          <div className="chart-card" style={{ background: 'rgba(15, 23, 42, 0.45)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '13px', color: 'white', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '16px' }}>
              Distribución de Volumen (Últimos 7 Días)
            </div>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '220px' }}>
                <div className="spinner" style={{ display: 'block', width: '30px', height: '30px' }} />
              </div>
            ) : Object.keys(weeklyMuscleGroupSeries).length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                Sin series registradas esta semana.
              </div>
            ) : (
              <div style={{ position: 'relative', width: '100%', height: '220px' }}>
                <Chart
                  type="doughnut"
                  data={doughnutData}
                  options={doughnutOptions as any}
                />
              </div>
            )}
          </div>

          {/* Tarjeta 2: Consistencia y Frecuencia Mensual (Bar Chart) */}
          <div className="chart-card" style={{ background: 'rgba(15, 23, 42, 0.45)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '13px', color: 'white', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '16px' }}>
              Frecuencia Mensual (Entrenamientos)
            </div>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '220px' }}>
                <div className="spinner" style={{ display: 'block', width: '30px', height: '30px' }} />
              </div>
            ) : monthlyFrequencies.labels.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                Sin sesiones registradas en el historial.
              </div>
            ) : (
              <div style={{ position: 'relative', width: '100%', height: '220px' }}>
                <Chart
                  type="bar"
                  data={frequencyChartData}
                  options={frequencyChartOptions as any}
                />
              </div>
            )}
          </div>
        </div>

      </div>

      <Toast message={toastState.message} type={toastState.type} visible={toastState.visible} />
    </div>
  );
};

export default Analytics;
