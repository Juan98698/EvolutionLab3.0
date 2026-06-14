import React, { useState, useEffect, useMemo } from 'react';
import { useSupabase } from '../../context/SupabaseContext';
import { supabase } from '../../lib/supabaseClient';
import {
  fetchAthleteSessions,
  writeSessionsToCache,
  readSessionsFromCache,
} from '../../lib/sessions';
import { LocalSesion } from '../../types/database.types';
import AthleteNavbar from '../common/AthleteNavbar';
import Toast from '../common/Toast';
import { InfoTooltip } from '../common/InfoTooltip';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  LineController,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Registrar componentes de Chart.js para la gráfica de e1RM
ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  LineController,
  ChartTooltip,
  Legend,
  Filler
);

export const Historial: React.FC = () => {
  const { user } = useSupabase();

  const [sesiones, setSesiones] = useState<LocalSesion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedEx, setSelectedEx] = useState<string>('');

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

  // Estados para Edición de Historial
  const [editingId, setEditingId] = useState<string | null>(null); // Combinación: `${id_sesion}_${id_ej}`
  const [editFecha, setEditFecha] = useState<string>('');
  const [editNombre, setEditNombre] = useState<string>('');
  const [editGrupo, setEditGrupo] = useState<string>('');
  const [editRepsStr, setEditRepsStr] = useState<string>('');
  const [editPeso, setEditPeso] = useState<string>('');
  const [editRpe, setEditRpe] = useState<string>('');
  const [editDescanso, setEditDescanso] = useState<string>('');
  const [editNotas, setEditNotas] = useState<string>('');

  const GRUPOS_MUSCULARES = ['Pecho', 'Espalda', 'Cuádriceps', 'Isquiosurales', 'Hombros', 'Bíceps', 'Tríceps', 'Core', 'Glúteos', 'Cardio', 'General'];

  const handleStartEdit = (f: any) => {
    setEditingId(`${f.id_sesion}_${f.id_ej}`);
    setEditFecha(f.fecha);
    setEditNombre(f.ejercicio);
    setEditGrupo(f.grupo);
    setEditRepsStr(f.repsStr);
    setEditPeso(String(f.peso));
    setEditRpe(String(f.rpe));
    setEditDescanso(String(f.descanso));
    setEditNotas(f.notas_ej);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (idSesion: string | number, idEj: string | number) => {
    const newRepsArray = editRepsStr.split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n));

    if (newRepsArray.length === 0) {
      showToast('Las repeticiones deben ser números separados por comas.', 'error');
      return;
    }

    const newPeso = parseFloat(editPeso);
    if (isNaN(newPeso) || newPeso < 0) {
      showToast('El peso debe ser un número válido mayor o igual a 0.', 'error');
      return;
    }

    const newRpe = parseFloat(editRpe);
    if (isNaN(newRpe) || newRpe < 0 || newRpe > 10) {
      showToast('El RIR/RPE debe ser un número entre 0 y 10.', 'error');
      return;
    }

    const newDescanso = parseInt(editDescanso, 10);
    if (isNaN(newDescanso) || newDescanso < 0) {
      showToast('El tiempo de descanso debe ser un número válido.', 'error');
      return;
    }

    const newNombre = editNombre.trim();
    if (!newNombre) {
      showToast('El nombre del ejercicio no puede estar vacío.', 'error');
      return;
    }

    const newGrupo = editGrupo.trim() || 'General';
    const newNotas = editNotas.trim();
    const newFecha = editFecha;

    try {
      // 1. Calcular volumen y RM estimado
      const totalReps = newRepsArray.reduce((a, b) => a + b, 0);
      const vol = newPeso * totalReps;
      
      let rmEst = 0;
      if (newRepsArray.length > 0) {
        const maxReps = Math.max(...newRepsArray);
        const epley = newPeso * (1 + maxReps / 30);
        const brzycki = newPeso / (1.0278 - 0.0278 * maxReps);
        rmEst = (epley + brzycki) / 2;
      }

      // 2. Actualizar estado local de sesiones
      const updatedSesiones = sesiones.map(s => {
        if (String(s.id) === String(idSesion)) {
          return {
            ...s,
            fecha: newFecha,
            ejercicios: s.ejercicios.map(e => {
              if (String(e.id_ej) === String(idEj)) {
                return {
                  ...e,
                  nombre: newNombre,
                  grupo: newGrupo,
                  peso: newPeso,
                  repsArray: newRepsArray,
                  rpe: newRpe,
                  descanso: newDescanso,
                  notas_ej: newNotas
                };
              }
              return e;
            })
          };
        }
        return s;
      });

      setSesiones(updatedSesiones);
      writeSessionsToCache(updatedSesiones);

      // 3. Sincronizar en Supabase (si está online)
      if (navigator.onLine && supabase) {
        if (typeof idSesion === 'string' && idSesion.includes('-')) {
          const { error: sError } = await supabase
            .from('sesiones_historial')
            .update({ fecha: newFecha })
            .eq('id', idSesion);
          if (sError) throw sError;
        }

        if (typeof idEj === 'string' && idEj.includes('-')) {
          const { error: eError } = await supabase
            .from('sesiones_ejercicios')
            .update({
              nombre_ejercicio: newNombre,
              grupo_muscular: newGrupo,
              series_reps: newRepsArray,
              peso: newPeso,
              rpe_rir: newRpe,
              descanso: newDescanso,
              volumen: vol,
              rm_estimado: rmEst
            })
            .eq('id', idEj);
          if (eError) throw eError;
        }
      }

      showToast('¡Registro actualizado con éxito! ☁️', 'success');
      setEditingId(null);
    } catch (err: any) {
      console.error('Error al actualizar registro de historial:', err);
      showToast('Error al guardar cambios: ' + err.message, 'error');
    }
  };

  // Cargar Historial
  const loadHistorial = async () => {
    if (!user) return;
    setLoading(true);

    let success = false;

    try {
      const formatted = await fetchAthleteSessions(user.id);
      setSesiones(formatted);
      writeSessionsToCache(formatted);
      success = true;
    } catch (err) {
      console.warn('No se pudo descargar el historial de la nube, usando caché local:', err);
    }

    if (!success) {
      try {
        const cached = readSessionsFromCache();
        if (cached.length > 0) {
          setSesiones(cached);
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

  // Aplanar filas filtradas por ejercicio
  const filasFiltradas = useMemo(() => {
    const rows: any[] = [];
    sesiones.forEach(s => {
      s.ejercicios.forEach(e => {
        if (!selectedEx || e.nombre === selectedEx) {
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
            id_sesion: s.id,
            id_ej: e.id_ej,
            fecha: s.fecha,
            ejercicio: e.nombre,
            grupo: e.grupo || 'General',
            series: repsArray.length,
            repsStr: repsArray.join(', '),
            peso: e.peso,
            rpe: e.rpe,
            descanso: e.descanso,
            volumen,
            rm,
            notas_ej: e.notas_ej || s.notas_sesion || ''
          });
        }
      });
    });

    // Ordenar por fecha cronológica ascendente para calcular deltas de forma correcta
    rows.sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Mapear delta de volumen comparando con la sesión anterior del MISMO ejercicio
    const mapPorEjercicio = new Map<string, any[]>();
    rows.forEach(r => {
      const key = r.ejercicio.toLowerCase();
      if (!mapPorEjercicio.has(key)) mapPorEjercicio.set(key, []);
      mapPorEjercicio.get(key)!.push(r);
    });

    const rowsWithDelta = rows.map(r => {
      const key = r.ejercicio.toLowerCase();
      const list = mapPorEjercicio.get(key) || [];
      const idx = list.findIndex(item => item.fecha === r.fecha && item.id_ej === r.id_ej);
      const prev = idx > 0 ? list[idx - 1] : null;

      let deltaHtml = '—';
      let deltaType: 'up' | 'dn' | 'eq' = 'eq';

      if (prev && prev.volumen > 0) {
        const diff = r.volumen - prev.volumen;
        const percent = (diff / prev.volumen) * 100;
        if (percent > 0.05) {
          deltaHtml = `▲ ${percent.toFixed(1)}%`;
          deltaType = 'up';
        } else if (percent < -0.05) {
          deltaHtml = `▼ ${Math.abs(percent).toFixed(1)}%`;
          deltaType = 'dn';
        } else {
          deltaHtml = `= 0%`;
          deltaType = 'eq';
        }
      }

      return { ...r, deltaHtml, deltaType };
    });

    // Para la visualización de la tabla, mostrar de más reciente a más antiguo
    return rowsWithDelta.reverse();
  }, [sesiones, selectedEx]);

  // Métricas globales en base al filtro
  const metrics = useMemo(() => {
    let mejor1RMGlobal = 0;
    let ultimoVolumen = 0;
    let penultimoVolumen = 0;
    const ejerciciosUnicos = new Set<string>();
    let sumaRPE = 0;
    let countRPE = 0;
    let bestExName = '';
    let bestExRM = 0;

    filasFiltradas.forEach((f, i) => {
      if (f.rm > mejor1RMGlobal) mejor1RMGlobal = f.rm;
      if (f.rm > bestExRM) {
        bestExRM = f.rm;
        bestExName = f.ejercicio;
      }
      ejerciciosUnicos.add(f.ejercicio);
      if (f.rpe !== undefined && f.rpe !== null) {
        sumaRPE += f.rpe;
        countRPE++;
      }
      // Al estar en orden reverso, el índice 0 es la última sesión del filtro
      if (i === 0) ultimoVolumen = f.volumen;
      if (i === 1 && selectedEx) penultimoVolumen = f.volumen;
    });

    const avgRpe = countRPE ? (sumaRPE / countRPE).toFixed(1) : '-';
    const count = selectedEx ? filasFiltradas.length : ejerciciosUnicos.size;

    let trendHtml = '';
    if (selectedEx && ultimoVolumen && penultimoVolumen) {
      const diff = ultimoVolumen - penultimoVolumen;
      const percent = (diff / penultimoVolumen) * 100;
      if (percent > 0) {
        trendHtml = `↑ +${percent.toFixed(1)}%`;
      } else if (percent < 0) {
        trendHtml = `↓ ${percent.toFixed(1)}%`;
      }
    }

    return {
      mejor1RMGlobal,
      ultimoVolumen,
      avgRpe,
      count,
      trendHtml,
      bestExName,
      bestExRM
    };
  }, [filasFiltradas, selectedEx]);

  // Eliminar ejercicio o sesión
  const handleDeleteRow = async (idSesion: string | number, idEj: string | number) => {
    const confirmMessage = '¿Seguro que deseas eliminar este registro del historial?';
    if (!window.confirm(confirmMessage)) return;

    try {
      const sessionToDelete = sesiones.find(s => String(s.id) === String(idSesion));
      if (!sessionToDelete) return;

      const isSingleEx = sessionToDelete.ejercicios.length <= 1;

      // 1. Eliminar localmente
      let updatedSesiones = [...sesiones];
      if (isSingleEx) {
        // Eliminar toda la sesión
        updatedSesiones = updatedSesiones.filter(s => String(s.id) !== String(idSesion));
      } else {
        // Eliminar solo el ejercicio de esa sesión
        updatedSesiones = updatedSesiones.map(s => {
          if (String(s.id) === String(idSesion)) {
            return {
              ...s,
              ejercicios: s.ejercicios.filter(e => String(e.id_ej) !== String(idEj))
            };
          }
          return s;
        });
      }

      setSesiones(updatedSesiones);
      writeSessionsToCache(updatedSesiones);

      // 2. Eliminar en Supabase (si está online y el ID es UUID string)
      if (navigator.onLine && supabase) {
        if (isSingleEx && typeof idSesion === 'string' && idSesion.includes('-')) {
          const { error } = await supabase
            .from('sesiones_historial')
            .delete()
            .eq('id', idSesion);
          if (error) throw error;
        } else if (!isSingleEx && typeof idEj === 'string' && idEj.includes('-')) {
          const { error } = await supabase
            .from('sesiones_ejercicios')
            .delete()
            .eq('id', idEj);
          if (error) throw error;
        }
      }

      showToast(isSingleEx ? '¡Sesión eliminada!' : '¡Ejercicio eliminado!', 'success');
    } catch (err: any) {
      console.error('Error al eliminar registro:', err);
      showToast('Error al eliminar: ' + err.message, 'error');
    }
  };

  return (
    <div style={{ background: 'transparent', minHeight: '100vh', color: 'white', paddingBottom: '60px' }}>
      <AthleteNavbar />

      <div className="container stagger-3" style={{ padding: '0 20px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Top bar controls */}
        <div className="top-bar" style={{ marginTop: '-0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'none', border: 'none', padding: 0 }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'white', flex: 1, display: 'inline-flex', alignItems: 'center' }}>
            Historial de Sobrecarga Progresiva
          </div>
          <select
            id="ejercicioSelect"
            value={selectedEx}
            onChange={(e) => setSelectedEx(e.target.value)}
            style={{ minWidth: '180px', maxWidth: '280px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--theme-border)', color: 'white', borderRadius: '8px', padding: '8px 12px' }}
          >
            <option value="">Todos los ejercicios</option>
            {allExercises.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* METRICS GRID */}
        <div className="metrics" id="metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '20px', marginBottom: '20px' }}>
          
          <div className="mcard" style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '12px', padding: '16px' }}>
            <div className="mcard-label" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Mejor 1RM estimado</div>
            <div className="mcard-value" style={{ color: 'var(--theme-primary)', fontSize: '24px', fontWeight: 800, fontFamily: "'Orbitron', sans-serif", display: 'flex', alignItems: 'center', gap: '6px' }}>
              {metrics.mejor1RMGlobal > 0 ? metrics.mejor1RMGlobal.toFixed(1) : '-'} <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>kg</span>
            </div>
          </div>

          <div className="mcard" style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '12px', padding: '16px' }}>
            <div className="mcard-label" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Volumen última sesión</div>
            <div className="mcard-value" style={{ color: 'white', fontSize: '24px', fontWeight: 800, fontFamily: "'Orbitron', sans-serif", display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {metrics.ultimoVolumen > 0 ? metrics.ultimoVolumen.toLocaleString() : '-'} <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>kg</span>
              {metrics.trendHtml && (
                <span style={{ color: metrics.trendHtml.includes('↑') ? '#10b981' : '#ef4444', fontSize: '11px', fontWeight: 700, marginLeft: '4px' }}>
                  {metrics.trendHtml}
                </span>
              )}
            </div>
          </div>

          <div className="mcard" style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '12px', padding: '16px' }}>
            <div className="mcard-label" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              {selectedEx ? 'Sesiones Realizadas' : 'Ejercicios Registrados'}
            </div>
            <div className="mcard-value" style={{ color: 'white', fontSize: '24px', fontWeight: 800, fontFamily: "'Orbitron', sans-serif" }}>
              {metrics.count}
            </div>
          </div>

          <div className="mcard" style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '12px', padding: '16px' }}>
            <div className="mcard-label" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>RIR promedio</div>
            <div className="mcard-value" style={{ color: 'white', fontSize: '24px', fontWeight: 800, fontFamily: "'Orbitron', sans-serif" }}>
              {metrics.avgRpe}
            </div>
          </div>

        </div>

        {/* Strongest Exercise Panel */}
        {!selectedEx && metrics.bestExRM > 0 && (
          <div id="strongestExercisePanel" style={{ marginBottom: '20px', padding: '12px 16px', background: 'rgba(123, 47, 247, 0.08)', borderRadius: '12px', border: '1px solid rgba(123, 47, 247, 0.2)' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Tu ejercicio más fuerte</div>
            <div id="strongestExerciseText" style={{ fontWeight: 700, fontSize: '14px', color: 'var(--theme-primary)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{metrics.bestExName}</span>
              <span>{metrics.bestExRM.toFixed(1)} kg (1RM est.)</span>
            </div>
          </div>
        )}

        {/* Motivacional Hook */}
        <div className="hook-banner" id="dynamicHookBanner" style={{ display: 'block', marginBottom: '25px', padding: '20px', background: 'var(--theme-card-bg)', borderRadius: '14px', border: '1px solid var(--theme-border)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          <span className="hook-quote-mark" style={{ display: 'block', fontSize: '32px', color: '#ff7e2e', lineHeight: 0.5, marginBottom: '10px' }}>&ldquo;</span>
          <p className="hook-text" id="dynamicHookText" style={{ margin: 0, fontSize: '12px', lineHeight: 1.6, color: '#94a3b8' }}>
            <strong style={{ fontSize: '15px', color: 'white', display: 'block', marginBottom: '8px' }}>
              {sesiones.length} sesiones completadas en total
            </strong>
            La sobrecarga progresiva — el principio más importante del entrenamiento de fuerza — requiere que sepas exactamente qué y cuánto hiciste la última vez para poder superarlo. Sin esa información, ese esfuerzo se pierde en el aire. Un registro completo convierte cada sesión en información útil.
          </p>
          <span className="hook-closing" id="dynamicHookSubtext" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#ff9f43', marginTop: '12px', fontWeight: 600 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff9f43" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Sin historial no hay progresión inteligente, registra tu entrenamiento hoy y supérate mañana.
          </span>
        </div>

        {/* e1RM STRENGTH PROGRESS CHART */}
        {selectedEx && filasFiltradas.length >= 2 && (() => {
          // Datos cronológicos (las filasFiltradas están en orden descendente, necesitamos ascendente)
          const chronoRows = [...filasFiltradas].reverse();
          const labels = chronoRows.map(f => {
            const [, m, d] = f.fecha.split('-');
            return `${d}/${m}`;
          });
          const rmValues = chronoRows.map(f => parseFloat(f.rm.toFixed(1)));

          // Detectar PRs (records personales): puntos donde el 1RM supera todos los anteriores
          let maxSoFar = 0;
          const isPR = rmValues.map(val => {
            const isNew = val > maxSoFar;
            if (isNew) maxSoFar = val;
            return isNew;
          });

          const pointBackgroundColors = isPR.map(pr => pr ? '#fbbf24' : 'rgba(0, 212, 255, 0.8)');
          const pointBorderColors = isPR.map(pr => pr ? '#f59e0b' : 'rgba(0, 212, 255, 0.5)');
          const pointRadii = isPR.map(pr => pr ? 6 : 3);

          return (
            <div style={{ marginBottom: '20px', padding: '20px', background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '16px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--theme-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                  <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: "'Orbitron', sans-serif", color: 'var(--theme-primary)', letterSpacing: '0.5px' }}>
                    PROGRESIÓN DE FUERZA (e1RM)
                  </span>
                  <InfoTooltip title="Progresión de Fuerza" body="Gráfica de tu 1RM estimado a lo largo del tiempo para el ejercicio seleccionado. Los puntos dorados ⭐ marcan récords personales (PR). Una línea ascendente indica que estás ganando fuerza progresivamente." />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} />
                    PR
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(0,212,255,0.8)', display: 'inline-block' }} />
                    Sesión
                  </span>
                </div>
              </div>
              <div style={{ height: '220px' }}>
                <Line
                  data={{
                    labels,
                    datasets: [{
                      label: '1RM est. (kg)',
                      data: rmValues,
                      borderColor: 'rgba(0, 212, 255, 0.7)',
                      backgroundColor: 'rgba(0, 212, 255, 0.05)',
                      pointBackgroundColor: pointBackgroundColors,
                      pointBorderColor: pointBorderColors,
                      pointRadius: pointRadii,
                      pointHoverRadius: 7,
                      borderWidth: 2,
                      tension: 0.3,
                      fill: true,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: 'rgba(12, 12, 16, 0.95)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        titleColor: '#fff',
                        bodyColor: 'rgba(255,255,255,0.8)',
                        padding: 10,
                        cornerRadius: 8,
                        titleFont: { family: "'Orbitron', sans-serif", size: 11, weight: 'bold' as const },
                        bodyFont: { size: 12 },
                        callbacks: {
                          label: (ctx: any) => `${ctx.parsed.y} kg`,
                          afterLabel: (ctx: any) => isPR[ctx.dataIndex] ? '⭐ Récord Personal' : '',
                        }
                      },
                    },
                    scales: {
                      x: {
                        grid: { color: 'rgba(255,255,255,0.03)' },
                        ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } },
                      },
                      y: {
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 }, callback: (val: any) => `${val} kg` },
                      },
                    },
                  }}
                />
              </div>
            </div>
          );
        })()}

        {/* HISTORIAL TABLE */}
        <div className="section-title" style={{ fontSize: '16px', fontWeight: 800, fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px', marginBottom: '15px' }}>
          Historial de Sesiones
        </div>

        <div className="table-wrap" style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '16px', overflow: 'hidden', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          <div className="table-scroll" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '12px 16px' }}>Fecha</th>
                  <th style={{ padding: '12px 16px' }}>Ejercicio</th>
                  <th style={{ padding: '12px 16px' }}>Grupo</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Series</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Reps</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Peso (kg)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}><span style={{ display: 'inline-flex', alignItems: 'center' }}>RIR<InfoTooltip title="RIR (Repeticiones en Reserva)" body="Indica cuántas repeticiones sientes que podrías haber hecho antes de llegar al fallo muscular total. Un RIR 0 = fallo completo. Un RIR 2 = terminaste con 2 repeticiones de margen. Es clave para regular la intensidad del entrenamiento." size={14} /></span></th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Descanso</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Volumen</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}><span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>1RM est.<InfoTooltip title="1RM Estimado (Fuerza Máxima)" body="Carga máxima teórica que podrías levantar en una sola repetición. Se calcula promediando las ecuaciones científicas de Epley y Brzycki usando tu peso y repeticiones máximas de la serie. Es el indicador principal de progreso de fuerza." size={14} /></span></th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}><span style={{ display: 'inline-flex', alignItems: 'center' }}>Δ Vol.<InfoTooltip title="Delta de Volumen (Δ Vol.)" body="Cambio porcentual del tonelaje total (peso × series × repeticiones) comparado con la sesión anterior del MISMO ejercicio. ▲ verde = aumento, ▼ rojo = disminución, = gris = sin cambio. Te ayuda a visualizar si estás progresando sesión a sesión." size={14} /></span></th>
                  <th style={{ padding: '12px 16px' }}>Notas</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>
                      Cargando historial de entrenamiento...
                    </td>
                  </tr>
                ) : filasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '40px' }}>
                      <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>No hay sesiones registradas.</p>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--theme-primary)', fontWeight: 600 }}>Toca "+ Sesión" en la barra de navegación para empezar.</p>
                    </td>
                  </tr>
                ) : (
                  filasFiltradas.map((f, index) => {
                    const formattedDate = f.fecha.split('-').reverse().join('/');
                    const isEditing = editingId === `${f.id_sesion}_${f.id_ej}`;

                    if (isEditing) {
                      return (
                        <tr key={index} style={{ borderBottom: '1px solid rgba(0, 212, 255, 0.2)', background: 'rgba(0, 212, 255, 0.02)' }}>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            <input
                              type="date"
                              value={editFecha}
                              onChange={(e) => setEditFecha(e.target.value)}
                              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--theme-border)', color: 'white', borderRadius: '6px', padding: '6px 8px', width: '120px', fontSize: '11px' }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            <input
                              type="text"
                              value={editNombre}
                              onChange={(e) => setEditNombre(e.target.value)}
                              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--theme-border)', color: 'white', borderRadius: '6px', padding: '6px 8px', width: '140px', fontSize: '11px', fontWeight: 600 }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <select
                              value={editGrupo}
                              onChange={(e) => setEditGrupo(e.target.value)}
                              style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid var(--theme-border)', color: 'white', borderRadius: '6px', padding: '6px 8px', width: '100px', fontSize: '11px' }}
                            >
                              {GRUPOS_MUSCULARES.map(g => (
                                <option key={g} value={g} style={{ background: '#0f172a' }}>{g}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {editRepsStr.split(',').filter(x => x.trim() !== '').length}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <input
                              type="text"
                              value={editRepsStr}
                              onChange={(e) => setEditRepsStr(e.target.value)}
                              placeholder="e.g. 10, 10"
                              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--theme-border)', color: 'white', borderRadius: '6px', padding: '6px 8px', width: '100px', fontSize: '11px', textAlign: 'center' }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <input
                              type="number"
                              step="any"
                              value={editPeso}
                              onChange={(e) => setEditPeso(e.target.value)}
                              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--theme-border)', color: 'white', borderRadius: '6px', padding: '6px 8px', width: '70px', fontSize: '11px', textAlign: 'center', fontWeight: 700 }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <input
                              type="number"
                              step="0.5"
                              value={editRpe}
                              onChange={(e) => setEditRpe(e.target.value)}
                              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--theme-border)', color: 'white', borderRadius: '6px', padding: '6px 8px', width: '60px', fontSize: '11px', textAlign: 'center' }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="number"
                                value={editDescanso}
                                onChange={(e) => setEditDescanso(e.target.value)}
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--theme-border)', color: 'white', borderRadius: '6px', padding: '6px 8px', width: '60px', fontSize: '11px', textAlign: 'center' }}
                              />
                              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>s</span>
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {(() => {
                              const reps = editRepsStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
                              const totalReps = reps.reduce((a, b) => a + b, 0);
                              const pesoNum = parseFloat(editPeso) || 0;
                              return (pesoNum * totalReps).toLocaleString();
                            })()}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--theme-primary)' }}>
                            {(() => {
                              const reps = editRepsStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
                              const pesoNum = parseFloat(editPeso) || 0;
                              if (reps.length === 0) return '—';
                              const maxReps = Math.max(...reps);
                              const epley = pesoNum * (1 + maxReps / 30);
                              const brzycki = pesoNum / (1.0278 - 0.0278 * maxReps);
                              const rm = (epley + brzycki) / 2;
                              return rm > 0 ? rm.toFixed(1) : '—';
                            })()}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                            —
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="text"
                              value={editNotas}
                              onChange={(e) => setEditNotas(e.target.value)}
                              placeholder="Notas del ejercicio..."
                              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--theme-border)', color: 'white', borderRadius: '6px', padding: '6px 8px', width: '150px', fontSize: '11px' }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <button
                              onClick={() => handleSaveEdit(f.id_sesion, f.id_ej)}
                              title="Guardar cambios"
                              style={{
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                borderRadius: '6px',
                                color: '#10b981',
                                padding: '6px',
                                marginRight: '6px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              title="Cancelar edición"
                              style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                borderRadius: '6px',
                                color: '#ef4444',
                                padding: '6px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{formattedDate}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>{f.ejercicio}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className={`badge badge-${f.grupo.toLowerCase()}`} style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                            {f.grupo}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{f.series}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>{f.repsStr}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>{f.peso}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{f.rpe}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{f.descanso}s</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{f.volumen.toLocaleString()}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--theme-primary)' }}>{f.rm.toFixed(1)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {f.deltaType === 'up' && <span style={{ color: '#10b981', fontWeight: 700 }}>{f.deltaHtml}</span>}
                          {f.deltaType === 'dn' && <span style={{ color: '#ef4444', fontWeight: 700 }}>{f.deltaHtml}</span>}
                          {f.deltaType === 'eq' && <span style={{ color: 'rgba(255,255,255,0.4)' }}>{f.deltaHtml}</span>}
                        </td>
                        <td style={{ padding: '12px 16px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.notas_ej}>
                          {f.notas_ej}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => handleStartEdit(f)}
                            title="Editar registro"
                            style={{
                              background: 'rgba(59, 130, 246, 0.1)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              borderRadius: '6px',
                              color: '#3b82f6',
                              padding: '5px',
                              marginRight: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            className="del-btn"
                            onClick={() => handleDeleteRow(f.id_sesion, f.id_ej)}
                            title="Eliminar registro"
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: '6px',
                              color: '#ef4444',
                              padding: '5px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <Toast message={toastState.message} type={toastState.type} visible={toastState.visible} />
    </div>
  );
};

export default Historial;
