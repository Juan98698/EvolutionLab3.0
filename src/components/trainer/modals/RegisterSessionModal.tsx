import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Profile } from '../../../types/database.types';

const SUGGESTIONS_EJERCICIOS = [
  'Sentadilla Libre con Barra',
  'Prensa de Piernas',
  'Peso Muerto Rumano',
  'Peso Muerto Convencional',
  'Curl de Piernas Acostado',
  'Extensiones de Cuádriceps',
  'Zancadas Búlgaras',
  'Elevación de Talones de Pie',
  'Press de Banca Plano con Barra',
  'Press de Banca Inclinado con Mancuernas',
  'Aperturas con Mancuernas',
  'Cruces de Polea',
  'Remo con Barra',
  'Jalón al Pecho',
  'Remo Gironda en Polea',
  'Dominadas',
  'Press Militar con Barra',
  'Elevaciones Laterales con Mancuernas',
  'Pájaros con Mancuernas',
  'Curl de Bíceps Alterno con Mancuernas',
  'Curl de Bíceps en Banco Scott',
  'Copa de Tríceps a una Mano',
  'Extensiones de Tríceps en Polea Alta',
  'Fondos de Tríceps',
  'Plancha Abdominal',
  'Crunch Abdominal en Polea'
];

interface RegisterSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAthleteForSession: Profile | null;
  fetchAuditoria: (force: boolean) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const RegisterSessionModal: React.FC<RegisterSessionModalProps> = ({
  isOpen,
  onClose,
  selectedAthleteForSession,
  fetchAuditoria,
  showToast
}) => {
  const [sessionDate, setSessionDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [athleteActivePlan, setAthleteActivePlan] = useState<any | null>(null);
  const [selectedPlanDayIndex, setSelectedPlanDayIndex] = useState<string>('-1');
  const [sessionExercises, setSessionExercises] = useState<any[]>([]);
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [isSavingSession, setIsSavingSession] = useState<boolean>(false);
  const [searchExerciseQuery, setSearchExerciseQuery] = useState<string>('');
  const [exerciseSuggestions, setExerciseSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && selectedAthleteForSession) {
      setSessionDate(new Date().toISOString().split('T')[0]);
      setSessionNotes('');
      setSessionExercises([]);
      setSelectedPlanDayIndex('-1');
      
      const loadPlan = async () => {
        try {
          const { data, error } = await supabase
            .from('planes')
            .select('*')
            .eq('cliente_id', selectedAthleteForSession.id)
            .eq('activo', true)
            .maybeSingle();

          if (error) throw error;

          if (data && data.datos_plan) {
            setAthleteActivePlan(data.datos_plan);
            const plan = data.datos_plan as any;
            if (plan.trainingDays && plan.trainingDays.length > 0) {
              setSelectedPlanDayIndex('0');
              loadExercisesFromPlanDay(plan.trainingDays[0]);
            }
          } else {
            setAthleteActivePlan(null);
            setSelectedPlanDayIndex('-1');
          }
        } catch (err: any) {
          console.error('Error al cargar plan del atleta:', err);
          showToast('Error al cargar el plan del atleta: ' + err.message, 'error');
          setAthleteActivePlan(null);
          setSelectedPlanDayIndex('-1');
        }
      };

      loadPlan();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedAthleteForSession]);

  const loadExercisesFromPlanDay = (day: any) => {
    if (day && day.exercises && day.exercises.length > 0) {
      const mapped = day.exercises.map((ex: any) => ({
        nombre: ex.nombre,
        grupo: ex.grupoMuscular || 'General',
        descanso: Number(ex.descanso) || 90,
        series: Array(Number(ex.series) || 3).fill(null).map(() => ({ reps: '', peso: '', rpe: '2' }))
      }));
      setSessionExercises(mapped);
    } else {
      setSessionExercises([]);
    }
  };

  const handlePlanDayChange = (val: string) => {
    setSelectedPlanDayIndex(val);
    if (val === '-1') {
      setSessionExercises([]);
    } else {
      const idx = parseInt(val, 10);
      if (athleteActivePlan && athleteActivePlan.trainingDays && athleteActivePlan.trainingDays[idx]) {
        loadExercisesFromPlanDay(athleteActivePlan.trainingDays[idx]);
      }
    }
  };

  const handleAddFreeExercise = (exName: string) => {
    const norm = exName.toLowerCase().trim();
    let grupo = 'General';
    
    if (norm.includes('pecho') || norm.includes('press plano') || norm.includes('press inclinado') || norm.includes('aperturas') || norm.includes('cruces')) grupo = 'Pecho';
    else if (norm.includes('espalda') || norm.includes('remo') || norm.includes('jalon') || norm.includes('dominadas') || norm.includes('pull') || norm.includes('lumbares')) grupo = 'Espalda';
    else if (norm.includes('femoral') || norm.includes('isquio') || norm.includes('curl de pierna')) grupo = 'Isquiosurales';
    else if (norm.includes('pierna') || norm.includes('cuad') || norm.includes('sentadilla') || norm.includes('prensa') || norm.includes('extension') || norm.includes('zancada') || norm.includes('bulgara')) grupo = 'Cuádriceps';
    else if (norm.includes('glute') || norm.includes('cadera') || norm.includes('pantorrilla') || norm.includes('gemelos')) grupo = 'Glúteos';
    else if (norm.includes('hombro') || norm.includes('lateral') || norm.includes('militar') || norm.includes('deltoide')) grupo = 'Hombros';
    else if (norm.includes('biceps') || norm.includes('triceps') || norm.includes('curl') || norm.includes('copa') || norm.includes('brazos')) grupo = 'Brazos';
    else if (norm.includes('core') || norm.includes('abdomen') || norm.includes('plancha') || norm.includes('crunch')) grupo = 'Core';

    const newEx = {
      nombre: exName,
      grupo,
      descanso: 90,
      series: [{ reps: '', peso: '', rpe: '2' }, { reps: '', peso: '', rpe: '2' }, { reps: '', peso: '', rpe: '2' }]
    };

    setSessionExercises(prev => [...prev, newEx]);
    setSearchExerciseQuery('');
    setExerciseSuggestions([]);
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAthleteForSession) return;
    if (sessionExercises.length === 0) {
      showToast('Por favor, agrega al menos un ejercicio a la sesión.', 'error');
      return;
    }

    for (let i = 0; i < sessionExercises.length; i++) {
      const ex = sessionExercises[i];
      for (let j = 0; j < ex.series.length; j++) {
        const s = ex.series[j];
        if (!s.reps || isNaN(parseInt(s.reps)) || !s.peso || isNaN(parseFloat(s.peso))) {
          showToast(`Completa los valores de Peso y Repeticiones de todas las series para: ${ex.nombre}`, 'error');
          return;
        }
      }
    }

    setIsSavingSession(true);
    try {
      const { data: histData, error: histError } = await supabase
        .from('sesiones_historial')
        .insert({
          cliente_id: selectedAthleteForSession.id,
          fecha: sessionDate,
          notas_generales: sessionNotes.trim() || null
        })
        .select('id')
        .single();

      if (histError) throw histError;
      const sesionId = histData.id;

      const inserts = sessionExercises.map((ex) => {
        const repsList = ex.series.map((s: any) => parseInt(s.reps, 10));
        const pesosList = ex.series.map((s: any) => parseFloat(s.peso));
        const rpesList = ex.series.map((s: any) => parseFloat(s.rpe));

        const avgPeso = pesosList.reduce((sum: number, p: number) => sum + p, 0) / pesosList.length;
        const totalReps = repsList.reduce((sum: number, r: number) => sum + r, 0);
        const volumen = avgPeso * totalReps;

        let maxRM = 0;
        for (let idx = 0; idx < ex.series.length; idx++) {
          const w = pesosList[idx];
          const r = repsList[idx];
          if (w > 0 && r > 0) {
            const epley = w * (1 + r / 30);
            const brzycki = w / (1.0278 - 0.0278 * r);
            const rmVal = (epley + brzycki) / 2;
            if (rmVal > maxRM) maxRM = rmVal;
          }
        }

        const avgRpe = rpesList.reduce((sum: number, r: number) => sum + r, 0) / rpesList.length;

        return {
          sesion_id: sesionId,
          nombre_ejercicio: ex.nombre,
          grupo_muscular: ex.grupo,
          series_reps: repsList,
          peso: avgPeso,
          rpe_rir: avgRpe,
          descanso: ex.descanso,
          volumen,
          rm_estimado: maxRM
        };
      });

      const { error: ejerError } = await supabase
        .from('sesiones_ejercicios')
        .insert(inserts);

      if (ejerError) throw ejerError;

      showToast(`✅ Sesión guardada con éxito para ${selectedAthleteForSession.nombre}`, 'success');
      onClose();
      fetchAuditoria(true);
    } catch (err: any) {
      console.error('Error al guardar la sesión:', err);
      showToast('Error al guardar la sesión: ' + err.message, 'error');
    } finally {
      setIsSavingSession(false);
    }
  };

  if (!isOpen || !selectedAthleteForSession) return null;

  return (
    <div className="modal-overlay modal-overlay-enter open" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box modal-enter" style={{ maxWidth: '650px', width: '90%', maxHeight: '85vh', overflowY: 'auto', border: '1px solid var(--theme-border)', boxShadow: '0 20px 50px var(--theme-glow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, fontFamily: "'Orbitron', sans-serif", color: 'var(--theme-primary)', fontSize: '1.05rem', letterSpacing: '0.5px' }}>
            ⏱️ REGISTRAR ENTRENAMIENTO
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
        </div>
        
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '15px' }}>
          Atleta: <span style={{ color: 'white', fontWeight: 700 }}>{selectedAthleteForSession.nombre}</span> ({selectedAthleteForSession.modalidad === 'presencial' ? 'Presencial 🏋️' : 'Remoto 🌐'})
        </div>

        <form onSubmit={handleSaveSession} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px', marginBottom: '6px' }}>FECHA DEL ENTRENAMIENTO</label>
              <input
                type="date"
                required
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px' }}
              />
            </div>

            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px', marginBottom: '6px' }}>PLAN/DÍA DE ENTRENAMIENTO</label>
              <select
                value={selectedPlanDayIndex}
                onChange={(e) => handlePlanDayChange(e.target.value)}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px', outline: 'none' }}
              >
                {athleteActivePlan ? (
                  <>
                    {athleteActivePlan.trainingDays?.map((day: any, idx: number) => (
                      <option key={idx} value={String(idx)}>📋 Día {idx + 1}: {day.name || `Rutina ${idx + 1}`}</option>
                    ))}
                    <option value="-1">➕ Registrar Entrenamiento Libre</option>
                  </>
                ) : (
                  <option value="-1">🏋️ Sin Plan Activo (Entrenamiento Libre)</option>
                )}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
              EJERCICIOS COMPLETADOS ({sessionExercises.length})
            </div>

            {sessionExercises.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '10px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                No hay ejercicios en la lista. Agrega ejercicios usando el buscador de abajo.
              </div>
            ) : (
              sessionExercises.map((ex, exIdx) => (
                <div key={exIdx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, color: 'white', fontSize: '13px' }}>🏋️ {ex.nombre}</span>
                      <span className={`badge badge-${ex.grupo.toLowerCase()}`} style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase' }}>{ex.grupo}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSessionExercises(prev => prev.filter((_, idx) => idx !== exIdx))}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif", fontWeight: 700 }}
                    >
                      ✕ Eliminar Ejercicio
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                    {ex.series.map((s: any, sIdx: number) => (
                      <div key={sIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', minWidth: '50px', fontFamily: "'Orbitron', sans-serif" }}>Serie {sIdx + 1}:</span>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            step="any"
                            required
                            placeholder="Peso"
                            value={s.peso}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSessionExercises(prev => {
                                const next = [...prev];
                                next[exIdx].series[sIdx] = { ...next[exIdx].series[sIdx], peso: val };
                                return next;
                              });
                            }}
                            style={{ width: '70px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px 8px', fontSize: '11px', textAlign: 'center' }}
                          />
                          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>kg</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            required
                            placeholder="Reps"
                            value={s.reps}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSessionExercises(prev => {
                                const next = [...prev];
                                next[exIdx].series[sIdx] = { ...next[exIdx].series[sIdx], reps: val };
                                return next;
                              });
                            }}
                            style={{ width: '60px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px 8px', fontSize: '11px', textAlign: 'center' }}
                          />
                          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>reps</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif" }}>RIR:</span>
                          <select
                            value={s.rpe}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSessionExercises(prev => {
                                const next = [...prev];
                                next[exIdx].series[sIdx] = { ...next[exIdx].series[sIdx], rpe: val };
                                return next;
                              });
                            }}
                            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px', fontSize: '11px', outline: 'none' }}
                          >
                            {['0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4'].map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSessionExercises(prev => {
                            const next = [...prev];
                            next[exIdx].series.push({ reps: '', peso: '', rpe: '2' });
                            return next;
                          });
                        }}
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#a5b4fc', padding: '4px 8px', fontSize: '10px', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif", fontWeight: 700 }}
                      >
                        ➕ Añadir Serie
                      </button>
                      {ex.series.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSessionExercises(prev => {
                              const next = [...prev];
                              next[exIdx].series.pop();
                              return next;
                            });
                          }}
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fda4af', padding: '4px 8px', fontSize: '10px', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif", fontWeight: 700 }}
                        >
                          ➖ Quitar Serie
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                      <span>Descanso:</span>
                      <input
                        type="number"
                        value={ex.descanso}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setSessionExercises(prev => {
                            const next = [...prev];
                            next[exIdx].descanso = val;
                            return next;
                          });
                        }}
                        style={{ width: '50px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: 'white', padding: '4px 6px', fontSize: '11px', textAlign: 'center' }}
                      />
                      <span>seg</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px', position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px', marginBottom: '6px' }}>BUSCAR O AGREGAR EJERCICIO EXTRA</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Escribe el ejercicio... (Ej: Press de banca)"
                value={searchExerciseQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchExerciseQuery(val);
                  if (val.trim().length >= 2) {
                    const filtered = SUGGESTIONS_EJERCICIOS.filter(item => 
                      item.toLowerCase().includes(val.toLowerCase())
                    );
                    setExerciseSuggestions(filtered);
                  } else {
                    setExerciseSuggestions([]);
                  }
                }}
                style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px' }}
              />
              {searchExerciseQuery.trim() && (
                <button
                  type="button"
                  onClick={() => handleAddFreeExercise(searchExerciseQuery)}
                  style={{
                    background: 'var(--theme-btn-gradient)',
                    border: 'none',
                    color: 'white',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '11px',
                    fontWeight: 700,
                    fontFamily: "'Orbitron', sans-serif",
                    cursor: 'pointer',
                    boxShadow: '0 0 10px var(--theme-btn-glow)'
                  }}
                >
                  Añadir
                </button>
              )}
            </div>

            {exerciseSuggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: '14px', right: '14px', background: '#090f1d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', zIndex: 100, maxHeight: '180px', overflowY: 'auto', marginTop: '4px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                {exerciseSuggestions.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleAddFreeExercise(item)}
                    style={{ padding: '10px 14px', fontSize: '12px', color: 'rgba(255,255,255,0.8)', borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    🏋️ {item}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px', marginBottom: '6px' }}>NOTAS DE LA SESIÓN</label>
            <textarea
              placeholder="Escribe comentarios, sensaciones del cliente, fatiga percibida, etc..."
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              rows={2}
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '15px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 20px', borderRadius: '8px', fontSize: '11px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700, cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSavingSession}
              style={{
                background: 'var(--theme-btn-gradient)',
                border: 'none',
                color: 'white',
                padding: '10px 24px',
                borderRadius: '8px',
                fontSize: '11px',
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 700,
                cursor: isSavingSession ? 'not-allowed' : 'pointer',
                boxShadow: '0 0 15px var(--theme-btn-glow)',
                opacity: isSavingSession ? 0.7 : 1
              }}
            >
              {isSavingSession ? 'GUARDANDO ENTRENAMIENTO...' : '💾 Guardar Entrenamiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterSessionModal;
