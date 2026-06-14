import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { writeSessionsToCache } from '../../lib/sessions';
import { PlanData } from '../../types/database.types';

interface AddSesionProps {
  plan: PlanData | null;
  expired: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onCancel: () => void;
}

interface TempExercise {
  nombre: string;
  grupo: string;
  peso: string;
  repsArray: number[];
  rpe: string;
  descanso: string;
  notas_ej: string;
}

export const AddSesion: React.FC<AddSesionProps> = ({
  plan,
  expired,
  showToast,
  onCancel
}) => {
  const getTodayISO = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [fecha, setFecha] = useState<string>(getTodayISO());
  const [notasSesion, setNotasSesion] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('pwa_login_theme') || 'cyan');

  React.useEffect(() => {
    const handleThemeChange = (e: Event) => {
      setCurrentTheme((e as CustomEvent).detail);
    };
    window.addEventListener('pwa-theme-changed', handleThemeChange);
    return () => window.removeEventListener('pwa-theme-changed', handleThemeChange);
  }, []);

  // Inicializar con un ejercicio vacío
  const [tempExercises, setTempExercises] = useState<TempExercise[]>([
    { nombre: '', grupo: 'Pecho', peso: '', repsArray: [10, 10, 10], rpe: '', descanso: '90', notas_ej: '' }
  ]);

  const [activeSuggestIdx, setActiveSuggestIdx] = useState<number | null>(null);
  const [catalogExercises, setCatalogExercises] = useState<{ nombre: string; grupo_muscular: string }[]>([]);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const { data, error } = await supabase
          .from('ejercicios_globales')
          .select('nombre, grupo_muscular')
          .order('nombre');
        if (!error && data) {
          setCatalogExercises(data);
        }
      } catch (err) {
        console.warn('Error al cargar ejercicios globales:', err);
      }
    };
    fetchCatalog();
  }, []);

  // Mapping of exercise name to its muscle group for auto-filling
  const exerciseToGroupMap = useMemo(() => {
    const map: Record<string, string> = {};
    catalogExercises.forEach(ej => {
      if (ej.nombre) {
        map[ej.nombre.trim().toLowerCase()] = ej.grupo_muscular;
      }
    });
    return map;
  }, [catalogExercises]);

  // Normalization function to map raw muscle groups to AddSesion dropdown select values
  const mapMuscleGroup = (g: string | undefined): string => {
    if (!g) return 'Pecho';
    const norm = g.toLowerCase().trim();
    if (norm.includes('pecho') || norm.includes('chest')) return 'Pecho';
    if (norm.includes('espalda') || norm.includes('back')) return 'Espalda';
    if (norm.includes('pierna') || norm.includes('cuad') || norm.includes('femoral') || norm.includes('glute') || norm.includes('pantorrilla')) return 'Piernas';
    if (norm.includes('hombro') || norm.includes('shoulder')) return 'Hombros';
    if (norm.includes('brazo') || norm.includes('biceps') || norm.includes('triceps') || norm.includes('antebrazo')) return 'Brazos';
    if (norm.includes('core') || norm.includes('abdomen') || norm.includes('abs')) return 'Core';
    return 'Pecho';
  };

  // Combined autocomplete suggestions (prioritizing plan exercises)
  const suggestions = useMemo(() => {
    const planNames = new Set<string>();
    if (plan?.trainingDays) {
      plan.trainingDays.forEach(day => {
        day.exercises.forEach(ex => {
          if (ex.nombre) planNames.add(ex.nombre.trim());
        });
      });
    }

    const planList = Array.from(planNames).map(name => ({
      nombre: name,
      isPlan: true,
      grupo: exerciseToGroupMap[name.toLowerCase()] || ''
    }));

    const globalList = catalogExercises
      .filter(ej => !planNames.has(ej.nombre.trim()))
      .map(ej => ({
        nombre: ej.nombre.trim(),
        isPlan: false,
        grupo: ej.grupo_muscular
      }));

    return [...planList, ...globalList];
  }, [plan, catalogExercises, exerciseToGroupMap]);

  // Helper to get filtered suggestions for a row
  const getFilteredSuggestions = (typedValue: string) => {
    const q = typedValue.toLowerCase().trim();
    if (!q) {
      // Show plan exercises first if empty
      return suggestions.filter(s => s.isPlan).slice(0, 10);
    }
    return suggestions
      .filter(s => s.nombre.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.isPlan && !b.isPlan) return -1;
        if (!a.isPlan && b.isPlan) return 1;
        return a.nombre.localeCompare(b.nombre);
      })
      .slice(0, 12);
  };

  const handleSelectSuggestion = (idx: number, nombre: string, grupoMuscular: string) => {
    setTempExercises(prev => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        nombre,
        grupo: mapMuscleGroup(grupoMuscular)
      };
      return copy;
    });
    setActiveSuggestIdx(null);
  };

  const handleAddTempExercise = () => {
    setTempExercises(prev => [
      ...prev,
      { nombre: '', grupo: 'Pecho', peso: '', repsArray: [10, 10, 10], rpe: '', descanso: '90', notas_ej: '' }
    ]);
  };

  const handleRemoveTempExercise = (idx: number) => {
    if (tempExercises.length <= 1) {
      showToast('Debe haber al menos un ejercicio en la sesión', 'error');
      return;
    }
    setTempExercises(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFieldChange = (idx: number, field: keyof TempExercise, val: any) => {
    setTempExercises(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
    setErrorMsg(null);
  };

  const handleSeriesCount = (idx: number, n: number) => {
    setTempExercises(prev => {
      const copy = [...prev];
      const current = copy[idx].repsArray;
      const nextArr: number[] = [];
      for (let i = 0; i < n; i++) {
        nextArr.push(current[i] !== undefined ? current[i] : (current[current.length - 1] || 10));
      }
      copy[idx].repsArray = nextArr;
      return copy;
    });
  };

  const handleRepsChange = (idx: number, sIdx: number, delta: number) => {
    setTempExercises(prev => {
      const copy = [...prev];
      const reps = copy[idx].repsArray[sIdx] || 10;
      const nextReps = Math.max(1, Math.min(50, reps + delta));
      const nextArr = [...copy[idx].repsArray];
      nextArr[sIdx] = nextReps;
      copy[idx].repsArray = nextArr;
      return copy;
    });
  };


  const handleSaveSession = async () => {
    setErrorMsg(null);

    if (expired) {
      setErrorMsg('⛔ Tu plan ha expirado. No puedes guardar nuevas sesiones de entrenamiento.');
      return;
    }

    if (!fecha) {
      setErrorMsg('Por favor selecciona la fecha de la sesión.');
      return;
    }

    // Validar ejercicios
    for (let i = 0; i < tempExercises.length; i++) {
      const ej = tempExercises[i];
      const num = i + 1;

      if (!ej.nombre || !ej.nombre.trim()) {
        setErrorMsg(`Ejercicio ${num}: ingresa el nombre del ejercicio.`);
        return;
      }

      const pesoRaw = (ej.peso || '').trim().toLowerCase();
      const peso = (pesoRaw === '' || pesoRaw === 'autocarga') ? 0 : parseFloat(pesoRaw);
      if (isNaN(peso) || peso < 0) {
        setErrorMsg(`Ejercicio ${num} ("${ej.nombre}"): el peso debe ser mayor o igual a 0 kg o la palabra "Autocarga".`);
        return;
      }

      const rpe = parseFloat(ej.rpe);
      if (isNaN(rpe) || rpe < 0 || rpe > 10) {
        setErrorMsg(`Ejercicio ${num} ("${ej.nombre}"): el RIR debe estar entre 0 y 10.`);
        return;
      }

      const descanso = parseInt(ej.descanso, 10);
      if (isNaN(descanso) || descanso < 30) {
        setErrorMsg(`Ejercicio ${num} ("${ej.nombre}"): el descanso mínimo es 30 segundos.`);
        return;
      }
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user;

      if (!currentUser) throw new Error('No se encontró una sesión activa de Supabase.');

      // 1. Guardar de forma local en el historial (offline-first)
      const cachedSessions = localStorage.getItem('sobrecarga_v5');
      const sesiones = cachedSessions ? JSON.parse(cachedSessions) : [];

      // Generar IDs locales temporales numéricos
      const nextSesionId = sesiones.length > 0 ? Math.max(...sesiones.map((s: any) => typeof s.id === 'number' ? s.id : 0)) + 1 : 1;
      const nextEjId = 1000 + nextSesionId * 20;

      const ejerciciosGuardar = tempExercises.map((ej, index) => {
        const nombreNorm = ej.nombre.trim().charAt(0).toUpperCase() + ej.nombre.trim().slice(1).toLowerCase();
        const pesoRaw = (ej.peso || '').trim().toLowerCase();
        return {
          id_ej: nextEjId + index,
          nombre: nombreNorm,
          grupo: ej.grupo,
          peso: (pesoRaw === '' || pesoRaw === 'autocarga') ? 0 : Number(pesoRaw),
          repsArray: ej.repsArray,
          rpe: Number(ej.rpe),
          descanso: Number(ej.descanso),
          notas_ej: ej.notas_ej || ''
        };
      });

      const nuevaSesion = {
        id: nextSesionId,
        fecha,
        notas_sesion: notasSesion,
        ejercicios: ejerciciosGuardar
      };

      // Agregar al historial local
      sesiones.push(nuevaSesion);
      writeSessionsToCache(sesiones);

      // 2. Sincronizar con Supabase si está online
      if (navigator.onLine) {
        showToast('Guardando en la nube... ☁️', 'info');

        // Insertar cabecera
        const { data: histData, error: histError } = await supabase
          .from('sesiones_historial')
          .insert({
            cliente_id: currentUser.id,
            fecha,
            notas_generales: notasSesion
          })
          .select('id')
          .single();

        if (histError) throw histError;

        const sesionId = histData.id;

        // Insertar detalles
        const ejerciciosInsert = ejerciciosGuardar.map(ej => {
          const totalReps = ej.repsArray.reduce((a, b) => a + b, 0);
          const vol = ej.peso * totalReps;
          
          const maxReps = Math.max(...ej.repsArray);
          const epley = ej.peso * (1 + maxReps / 30);
          const brzycki = ej.peso / (1.0278 - 0.0278 * maxReps);
          const rmEst = (epley + brzycki) / 2;

          return {
            sesion_id: sesionId,
            nombre_ejercicio: ej.nombre,
            grupo_muscular: ej.grupo,
            series_reps: ej.repsArray,
            peso: ej.peso,
            rpe_rir: ej.rpe,
            descanso: ej.descanso,
            volumen: vol,
            rm_estimado: rmEst
          };
        });

        const { data: ejData, error: ejError } = await supabase
          .from('sesiones_ejercicios')
          .insert(ejerciciosInsert)
          .select('id, nombre_ejercicio');

        if (ejError) throw ejError;

        // Actualizar UUIDs de Supabase en localStorage para mantener coherencia
        nuevaSesion.id = sesionId;
        if (ejData) {
          ejData.forEach((inserted: any) => {
            const match = nuevaSesion.ejercicios.find(e => e.nombre === inserted.nombre_ejercicio);
            if (match) match.id_ej = inserted.id;
          });
        }
        writeSessionsToCache(sesiones);

        showToast('¡Sesión guardada y sincronizada en la nube! ☁️', 'success');
      } else {
        // Encolar para sincronizar cuando vuelva a estar online
        let queue = JSON.parse(localStorage.getItem('evolution_sync_queue') || '[]');
        queue.push(nuevaSesion);
        localStorage.setItem('evolution_sync_queue', JSON.stringify(queue));

        showToast('Guardado en el historial local (Offline) 🔌. Pendiente de sincronizar.', 'info');
      }

      // Reiniciar formulario e ir a Historial
      setFecha(getTodayISO());
      setNotasSesion('');
      setTempExercises([{ nombre: '', grupo: 'Pecho', peso: '', repsArray: [10, 10, 10], rpe: '', descanso: '90', notas_ej: '' }]);
      onCancel(); // Vuelve a Dashboard
    } catch (err: any) {
      console.error('Error al guardar sesión:', err);
      showToast('Error al guardar: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div role="form" aria-label="Registrar Sesión de Entrenamiento" className="form-section stagger-3" style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
      
      {errorMsg && (
        <div className="validation-banner" style={{ display: 'block', margin: '0 0 20px 0', padding: '12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#fca5a5', fontSize: '12px' }}>
          {errorMsg}
        </div>
      )}

      {/* Cabecera de la sesión (Fecha y Notas generales) alineados elegantemente */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
        marginBottom: '28px',
        background: 'rgba(255, 255, 255, 0.01)',
        border: '1px solid var(--theme-border)',
        borderRadius: '12px',
        padding: '20px'
      }}>
        <div style={{ flex: '1 1 200px' }}>
          <label htmlFor="fecha-sesion" style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>FECHA DE LA SESIÓN</label>
          <input
            id="fecha-sesion"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--theme-border)',
              borderRadius: '10px',
              color: 'white',
              padding: '12px',
              fontSize: '13px',
              height: '44px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <div style={{ flex: '3 1 400px' }}>
          <label htmlFor="notas-sesion" style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>NOTAS GENERALES DE LA SESIÓN (opcional)</label>
          <textarea
            id="notas-sesion"
            rows={1}
            placeholder="Calentamiento, sensaciones generales, nivel de energía..."
            value={notasSesion}
            onChange={(e) => setNotasSesion(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--theme-border)',
              borderRadius: '10px',
              color: 'white',
              padding: '12px',
              fontSize: '13px',
              resize: 'none',
              height: '44px',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Listado de ejercicios en la sesión */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '28px' }}>
        {tempExercises.map((ej, idx) => (
          <div
            key={idx}
            className="ejercicio-group"
            style={{
              position: 'relative',
              background: 'var(--theme-card-bg)',
              border: '1px solid var(--theme-border)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              transition: 'all 0.3s ease'
            }}
          >
            {/* 1. Cabecera numerada del ejercicio con botón de eliminar mejor integrado */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  background: 'var(--theme-btn-gradient)',
                  color: 'white',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  fontFamily: "'Orbitron', sans-serif",
                  boxShadow: '0 0 10px var(--theme-btn-glow)'
                }}>{idx + 1}</span>
                <h3 style={{
                  margin: 0,
                  fontSize: '13px',
                  fontFamily: "'Orbitron', sans-serif",
                  color: 'white',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>Ejercicio {idx + 1}</h3>
              </div>
              {tempExercises.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveTempExercise(idx)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.18)',
                    borderRadius: '8px',
                    color: '#fca5a5',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    fontFamily: 'inherit'
                  }}
                  title="Eliminar ejercicio"
                >
                  ✕ Eliminar
                </button>
              )}
            </div>

            {/* 2. Grid Responsivo de Dos Columnas (Panel de Configuración vs Panel de Series) */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '24px',
              flexWrap: 'wrap',
              alignItems: 'stretch'
            }}>
              
              {/* Panel Izquierdo: Configuración General (60% en Desktop, 100% en Móvil) */}
              <div style={{
                flex: '2 1 450px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                
                {/* Fila 1: Nombre de Ejercicio (2/3) y Grupo Muscular (1/3) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr',
                  gap: '16px',
                  alignItems: 'end'
                }}>
                  <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                    <label htmlFor={`ej-nombre-${idx}`} style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>EJERCICIO</label>
                    <input
                      id={`ej-nombre-${idx}`}
                      type="text"
                      placeholder="Ej. Press banca, Sentadillas"
                      value={ej.nombre}
                      onChange={(e) => {
                        handleFieldChange(idx, 'nombre', e.target.value);
                        // If the typed exercise matches one in global list, auto fill group
                        const match = catalogExercises.find(x => x.nombre.toLowerCase().trim() === e.target.value.toLowerCase().trim());
                        if (match) {
                          handleFieldChange(idx, 'grupo', mapMuscleGroup(match.grupo_muscular));
                        }
                      }}
                      onFocus={() => setActiveSuggestIdx(idx)}
                      onBlur={() => {
                        setTimeout(() => {
                          setActiveSuggestIdx(curr => curr === idx ? null : curr);
                        }, 250);
                      }}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--theme-border)',
                        borderRadius: '10px',
                        color: 'white',
                        padding: '12px',
                        fontSize: '13px',
                        transition: 'all 0.2s',
                        height: '44px',
                        boxSizing: 'border-box'
                      }}
                    />
                    {activeSuggestIdx === idx && (() => {
                      const filtered = getFilteredSuggestions(ej.nombre);
                      if (filtered.length === 0) return null;
                      return (
                        <div style={{
                          position: 'absolute',
                          top: '66px',
                          left: 0,
                          width: '100%',
                          maxHeight: '220px',
                          overflowY: 'auto',
                          background: 'var(--theme-card-bg)',
                          backdropFilter: 'blur(20px)',
                          WebkitBackdropFilter: 'blur(20px)',
                          border: '1px solid var(--theme-border)',
                          borderRadius: '10px',
                          zIndex: 9999,
                          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.65)',
                          padding: '4px'
                        }}>
                          {filtered.map((sug, sIdx) => (
                            <div
                              key={sIdx}
                              onMouseDown={() => handleSelectSuggestion(idx, sug.nombre, sug.grupo)}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '12px',
                                color: 'white',
                                background: 'transparent',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{sug.nombre}</span>
                              {sug.isPlan ? (
                                <span style={{
                                  fontSize: '8px',
                                  fontFamily: "'Orbitron', sans-serif",
                                  fontWeight: 700,
                                  background: 'var(--theme-badge-bg)',
                                  border: '1px solid var(--theme-border)',
                                  color: 'var(--theme-primary)',
                                  padding: '2px 6px',
                                  borderRadius: '10px'
                                }}>
                                  PLAN
                                </span>
                              ) : (
                                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
                                  {sug.grupo}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor={`ej-grupo-${idx}`} style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>GRUPO MUSCULAR</label>
                    <select
                      id={`ej-grupo-${idx}`}
                      value={ej.grupo}
                      onChange={(e) => handleFieldChange(idx, 'grupo', e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--theme-border)',
                        borderRadius: '10px',
                        color: 'white',
                        padding: '10px 12px',
                        fontSize: '13px',
                        height: '44px',
                        boxSizing: 'border-box',
                        cursor: 'pointer'
                      }}
                    >
                      {['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core'].map(g => (
                        <option key={g} value={g} style={{ background: '#0b0f19', color: 'white' }}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Fila 2: Métricas de Carga - Peso (1/3), RIR (1/3), Descanso (1/3) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px'
                }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor={`ej-peso-${idx}`} style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>PESO DE TRABAJO (KG)</label>
                    <input
                      id={`ej-peso-${idx}`}
                      type="text"
                      placeholder="Ej. 50 o Autocarga"
                      value={ej.peso}
                      onChange={(e) => handleFieldChange(idx, 'peso', e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--theme-border)',
                        borderRadius: '10px',
                        color: 'white',
                        padding: '12px',
                        fontSize: '13px',
                        height: '44px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor={`ej-rir-${idx}`} style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>RIR (0-10)</label>
                    <input
                      id={`ej-rir-${idx}`}
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min="0"
                      max="10"
                      placeholder="Ej. 2"
                      value={ej.rpe}
                      onChange={(e) => handleFieldChange(idx, 'rpe', e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--theme-border)',
                        borderRadius: '10px',
                        color: 'white',
                        padding: '12px',
                        fontSize: '13px',
                        height: '44px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor={`ej-descanso-${idx}`} style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>DESCANSO (SEGUNDOS)</label>
                    <input
                      id={`ej-descanso-${idx}`}
                      type="number"
                      inputMode="numeric"
                      step="15"
                      placeholder="Ej. 90"
                      value={ej.descanso}
                      onChange={(e) => handleFieldChange(idx, 'descanso', e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--theme-border)',
                        borderRadius: '10px',
                        color: 'white',
                        padding: '12px',
                        fontSize: '13px',
                        height: '44px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* Fila 3: Notas del Ejercicio (Completa el espacio restante) */}
                <div className="form-group form-wide" style={{ margin: 0, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                  <label htmlFor={`ej-notas-${idx}`} style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>NOTAS (OPCIONAL)</label>
                  <textarea
                    id={`ej-notas-${idx}`}
                    placeholder="Técnica, sensaciones..."
                    rows={3}
                    value={ej.notas_ej}
                    onChange={(e) => handleFieldChange(idx, 'notas_ej', e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--theme-border)',
                      borderRadius: '10px',
                      color: 'white',
                      padding: '12px',
                      fontSize: '13px',
                      resize: 'none',
                      flexGrow: 1,
                      minHeight: '80px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Panel Derecho: Series y Repeticiones (40% en Desktop, 100% en Móvil) */}
              <div style={{
                flex: '1 1 320px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div className="form-group form-wide" style={{ margin: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>SERIES Y REPETICIONES</label>
                  <div className="series-builder" style={{
                    background: 'rgba(255,255,255,0.015)',
                    padding: '16px',
                    border: '1px solid var(--theme-border)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    height: '100%',
                    boxSizing: 'border-box',
                    justifyContent: 'space-between'
                  }}>
                    
                    {/* Selector de número de series */}
                    <div>
                      <div className="series-count-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Cantidad de series:</span>
                        <div style={{
                          display: 'flex',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--theme-border)',
                          borderRadius: '8px',
                          padding: '3px',
                          gap: '2px'
                        }}>
                          {[2, 3, 4, 5, 6, 7, 8].map(n => {
                            const isActive = ej.repsArray.length === n;
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => handleSeriesCount(idx, n)}
                                style={{
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontFamily: "'Orbitron', sans-serif",
                                  fontSize: '10px',
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '5px',
                                  background: isActive ? 'var(--theme-btn-gradient)' : 'transparent',
                                  color: isActive ? (['monochrome', 'cyberpunk', 'green', 'gold'].includes(currentTheme) ? '#000' : '#fff') : 'rgba(255,255,255,0.6)',
                                  fontWeight: isActive ? 'bold' : 'normal',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s ease',
                                  boxShadow: isActive ? '0 0 8px var(--theme-btn-glow)' : 'none'
                                }}
                              >
                                {n}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Listado de controles de repeticiones por serie */}
                      <div className="series-reps-list" style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        maxHeight: '260px',
                        overflowY: 'auto',
                        paddingRight: '4px'
                      }}>
                        {ej.repsArray.map((reps, sIdx) => (
                          <div
                            key={sIdx}
                            className="serie-row"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: 'rgba(255,255,255,0.01)',
                              border: '1px solid var(--theme-border)',
                              borderRadius: '8px',
                              padding: '8px 12px'
                            }}
                          >
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Serie {sIdx + 1}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <button
                                type="button"
                                className="reps-btn reps-minus"
                                onClick={() => handleRepsChange(idx, sIdx, -1)}
                                style={{
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--theme-border)',
                                  background: 'rgba(255,255,255,0.04)',
                                  color: 'white',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 'bold',
                                  fontSize: '14px',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                −
                              </button>
                              <span style={{
                                minWidth: '24px',
                                textAlign: 'center',
                                fontWeight: 700,
                                fontSize: '13px',
                                color: 'white',
                                fontFamily: "'Orbitron', sans-serif"
                              }}>{reps}</span>
                              <button
                                type="button"
                                className="reps-btn reps-plus"
                                onClick={() => handleRepsChange(idx, sIdx, 1)}
                                style={{
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--theme-border)',
                                  background: 'rgba(255,255,255,0.04)',
                                  color: 'white',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 'bold',
                                  fontSize: '14px',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                +
                              </button>
                              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', minWidth: '28px' }}>reps</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              </div>

            </div>

            {/* 3. Panel de Métricas/Previsualización de Volumen a lo ancho del Card */}
            {(() => {
              const pesoRaw = (ej.peso || '').trim().toLowerCase();
              const pesoNum = (pesoRaw === '' || pesoRaw === 'autocarga') ? 0 : parseFloat(pesoRaw);
              const totalReps = ej.repsArray.reduce((a, b) => a + b, 0);
              const volume = isNaN(pesoNum) ? 0 : pesoNum * totalReps;
              const maxReps = ej.repsArray.length > 0 ? Math.max(...ej.repsArray) : 0;
              const rm = isNaN(pesoNum) ? 0 : pesoNum * (1 + maxReps / 30);
              const isValid = ej.nombre && !isNaN(pesoNum) && ej.repsArray.length > 0;

              return (
                <div style={{
                  marginTop: '20px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: isValid ? 'var(--theme-badge-bg)' : 'rgba(255, 255, 255, 0.015)',
                  border: isValid ? '1px solid var(--theme-border)' : '1px solid rgba(255, 255, 255, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isValid ? 'space-between' : 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  transition: 'all 0.3s ease'
                }}>
                  {isValid ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px' }}>⚡</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.5px' }}>
                          MÉTRICAS ESTIMADAS DEL EJERCICIO:
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        {/* Volumen */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>VOLUMEN TOTAL</span>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--theme-primary)', fontFamily: "'Orbitron', sans-serif" }}>
                            {pesoNum === 0 ? 'Autocarga' : `${volume.toLocaleString()} kg`}
                          </span>
                        </div>
                        {/* Divider */}
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', alignSelf: 'stretch' }} />
                        {/* 1RM */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>1RM ESTIMADO</span>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--theme-primary)', fontFamily: "'Orbitron', sans-serif" }}>
                            {pesoNum === 0 ? 'Autocarga' : `${rm.toFixed(1)} kg`}
                          </span>
                        </div>
                        {/* Divider */}
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', alignSelf: 'stretch' }} />
                        {/* Series */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>SERIES</span>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'white', fontFamily: "'Orbitron', sans-serif" }}>
                            {ej.repsArray.length}
                          </span>
                        </div>
                        {/* Divider */}
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', alignSelf: 'stretch' }} />
                        {/* Reps Totales */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>REPS TOTALES</span>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'white', fontFamily: "'Orbitron', sans-serif" }}>
                            {totalReps}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', textAlign: 'center' }}>
                      Completa el ejercicio, peso y repeticiones para ver la estimación del volumen y 1RM.
                    </span>
                  )}
                </div>
              );
            })()}

          </div>
        ))}
      </div>

      {/* Acciones generales con separador estético */}
      <div className="btn-row" style={{
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        marginTop: '10px',
        paddingTop: '20px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={handleAddTempExercise}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          ➕ Agregar ejercicio
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSaveSession}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          {loading ? (
            <div className="spinner" style={{ display: 'block' }} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
          )}
          <span>{loading ? 'Guardando...' : 'Guardar sesión'}</span>
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>

    </div>
  );
};

export default AddSesion;
