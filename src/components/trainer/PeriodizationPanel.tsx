import React, { useMemo } from 'react';
import { TrainingDay, PeriodizationConfig, Exercise } from '../../types/database.types';
import { InfoTooltip } from '../common/InfoTooltip';
import { getWeakPointCorrection, calcTargetRIRForWeek } from '../../lib/periodizationEngine';
import { evaluateVolumeStatus, getThresholdsForMuscleGroup } from '../../lib/volumeThresholds';
import { humanizeAlert } from '../../lib/alertLanguage';
import {
  getStrengthThreshold,
  evaluateStrengthVolume,
  detectPatternFromExerciseName,
  MovementPattern,
} from '../../lib/strengthThresholds';

interface PeriodizationPanelProps {
  config: PeriodizationConfig | undefined;
  setConfig: React.Dispatch<React.SetStateAction<PeriodizationConfig | undefined>>;
  trainingDays: TrainingDay[];
  setTrainingDays: React.Dispatch<React.SetStateAction<TrainingDay[]>>;
  languageMode: 'simple' | 'tecnico';
  recalculatePlanWeights: (
    days: TrainingDay[],
    marcas: Record<string, number>,
    formula?: 'epley' | 'brzycki' | 'epley_brzycki_avg',
    redondeo?: number
  ) => TrainingDay[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  /** Abre el modal de ayuda PeriodizationHelpModal, que vive fuera de este panel */
  onOpenHelpModal: () => void;
  /** Abre la calculadora manual de 1RM, que vive fuera de este panel */
  onOpenCalculator: () => void;
  /** Objetivos de volumen custom por grupo muscular / patrón — estado del padre, solo lectura aquí */
  weeklyTargets: Record<string, number>;
}

/**
 * Panel de Periodización Científica y Autorregulación RIR.
 *
 * Extraído de PlanPlanner.tsx (que llegó a 5151 líneas) como parte de la
 * separación de responsabilidades. Este panel concentra toda la lógica de:
 *   - Activar/desactivar el bloque de periodización
 *   - Configurar objetivo, nivel del atleta, semanas, RIR inicial/progresión
 *   - Toggle de rir_override_manual
 *   - Selector de muscle_groups_in_focus (especialización para avanzados)
 *   - Preview de RIR semana a semana
 *   - Diagnóstico inicial (1RM, puntos débiles, edad, recuperación)
 *   - Panel de auditoría de volumen MRV
 *
 * Es deliberadamente el primer candidato a extracción: es la sección más
 * grande y autocontenida del archivo original, y coincide con el módulo que
 * más se ha modificado en las últimas sesiones de trabajo — aislarlo reduce
 * el riesgo de que un cambio aquí afecte por accidente otra parte del plan.
 */
export const PeriodizationPanel: React.FC<PeriodizationPanelProps> = ({
  config,
  setConfig,
  trainingDays,
  setTrainingDays,
  languageMode,
  recalculatePlanWeights,
  showToast,
  onOpenHelpModal,
  onOpenCalculator,
  weeklyTargets,
}) => {
  const generateId = (): string => Math.random().toString(36).substring(2, 11);

  const formatTempoDetail = (tempo: string) => {
    if (!tempo || !tempo.includes('-')) return '';
    const parts = tempo.split('-');
    if (parts.length !== 4) return `Tempo: ${tempo}`;

    const ecc = parseInt(parts[0], 10) || 0;
    const iso = parseInt(parts[1], 10) || 0;
    const con = parseInt(parts[2], 10) || 0;
    const pause = parseInt(parts[3], 10) || 0;

    return `Tempo ${tempo} explicado:
• Bajar (Fase Excéntrica): ${ecc} segundo${ecc === 1 ? '' : 's'}.
• Sostener (Pausa abajo/Isometría): ${iso} segundo${iso === 1 ? '' : 's'}.
• Subir (Fase Concéntrica): ${con} segundo${con === 1 ? '' : 's'} (fase concéntrica/empuje).
• Pausa arriba: ${pause} segundo${pause === 1 ? '' : 's'} (antes de iniciar la siguiente repetición).`;
  };

  const handleAddCorrectiveExercise = (liftKey: string, corrective: any) => {
    let keywords: string[] = [];
    let defaultGroup = 'General';
    if (liftKey === 'sentadilla') {
      keywords = ['sentadilla', 'squat'];
      defaultGroup = 'Cuádriceps';
    } else if (liftKey === 'banca') {
      keywords = ['press de banca', 'press banca', 'bench press'];
      defaultGroup = 'Pecho';
    } else if (liftKey === 'peso_muerto') {
      keywords = ['peso muerto', 'deadlift'];
      defaultGroup = 'Isquiosurales';
    }

    let targetDayId = '';
    let insertIndex = -1;

    for (let dIdx = 0; dIdx < trainingDays.length; dIdx++) {
      const day = trainingDays[dIdx];
      const exIdx = day.exercises.findIndex(ex =>
        ex.nombre && keywords.some(kw => ex.nombre.toLowerCase().includes(kw))
      );
      if (exIdx !== -1) {
        targetDayId = day.id;
        insertIndex = exIdx + 1;
        break;
      }
    }

    if (!targetDayId && trainingDays.length > 0) {
      targetDayId = trainingDays[0].id;
      insertIndex = trainingDays[0].exercises.length;
    }

    if (!targetDayId) {
      showToast('No hay días de entrenamiento programados para agregar el correctivo.', 'error');
      return;
    }

    const detailedTempo = formatTempoDetail(corrective.tempo);
    const notes = `Pauta del Smart Coach [Punto Débil]:\n${corrective.description}\n\n${detailedTempo}`;

    const newExercise: Exercise = {
      id: generateId(),
      nombre: `${corrective.name} (Correctivo)`,
      nombre_original: corrective.name,
      variables: {
        'series de trabajo': '3',
        'repeticiones': '6 a 8',
        'rir': '2',
        'tempo': corrective.tempo
      },
      progression_notes: notes,
      grupo_muscular: defaultGroup
    };

    setTrainingDays(prev =>
      prev.map(d => {
        if (d.id === targetDayId) {
          const newExs = [...d.exercises];
          newExs.splice(insertIndex, 0, newExercise);
          return {
            ...d,
            exercises: newExs
          };
        }
        return d;
      })
    );

    const targetDayName = trainingDays.find(d => d.id === targetDayId)?.name || 'su plan';
    showToast(`✅ Se agregó "${corrective.name}" al ${targetDayName}`, 'success');
  };

  // Helpers de parsing — duplicados intencionalmente del padre (PlanPlanner.tsx).
  // Son funciones puras de 10 líneas sin estado propio; duplicarlas aquí evita
  // tener que exponerlas como props solo para este panel, manteniendo la
  // interfaz de PeriodizationPanelProps mínima.
  const parseSeries = (seriesStr: string | undefined): number => {
    if (!seriesStr) return 0;
    const cleanStr = seriesStr.trim();
    if (!cleanStr) return 0;
    const rangeMatch = cleanStr.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1], 10);
      const max = parseInt(rangeMatch[2], 10);
      return (min + max) / 2;
    }
    const singleMatch = cleanStr.match(/^(\d+)/);
    if (singleMatch) {
      return parseInt(singleMatch[1], 10);
    }
    return 0;
  };

  const parseReps = (repsStr: string | undefined): number => {
    if (!repsStr) return 0;
    const cleanStr = repsStr.trim();
    if (!cleanStr) return 0;
    const rangeMatch = cleanStr.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1], 10);
      const max = parseInt(rangeMatch[2], 10);
      return (min + max) / 2;
    }
    const singleMatch = cleanStr.match(/^(\d+)/);
    if (singleMatch) {
      return parseInt(singleMatch[1], 10);
    }
    return 0;
  };

  // Sumar volumen total de Fuerza de TODA la semana por patrón (NL = series * reps).
  // Recalculado localmente: depende solo de `trainingDays`, que ya es prop de
  // este componente — evita que el padre tenga que mantener este cálculo
  // solo para pasarlo aquí.
  const weeklyNLData = useMemo(() => {
    const nlMap: Record<string, number> = {};
    if (trainingDays && Array.isArray(trainingDays)) {
      trainingDays.forEach(day => {
        if (day && Array.isArray(day.exercises)) {
          day.exercises.forEach(ex => {
            const pattern = detectPatternFromExerciseName(ex.nombre || '');
            if (pattern) {
              const seriesStr = ex.variables?.['series de trabajo'] || ex.variables?.['series'] || '';
              const repsStr = ex.variables?.['repeticiones'] || ex.variables?.['reps'] || '';
              const series = parseSeries(seriesStr);
              const reps = parseReps(repsStr);
              nlMap[pattern] = (nlMap[pattern] || 0) + (series * reps);
            }
          });
        }
      });
    }
    return nlMap;
  }, [trainingDays]);

  // Sumar volumen total de TODA la semana por grupo muscular (Auditoría MRV).
  // Mismo razonamiento: depende solo de trainingDays + config, ambos ya
  // disponibles como props.
  const weeklyVolumeData = useMemo(() => {
    const volumeMap: Record<string, number> = {};
    if (trainingDays && Array.isArray(trainingDays)) {
      trainingDays.forEach(day => {
        if (day && Array.isArray(day.exercises)) {
          day.exercises.forEach(ex => {
            const gm = getThresholdsForMuscleGroup((ex as any).grupo_muscular || '', config?.nivel_atleta, config?.objetivo as any).gm;
            const seriesStr = ex.variables?.['series de trabajo'] || ex.variables?.['series'] || '';
            const series = parseSeries(seriesStr);
            volumeMap[gm] = (volumeMap[gm] || 0) + series;
          });
        }
      });
    }
    return volumeMap;
  }, [trainingDays, config?.nivel_atleta, config?.objetivo]);

  return (
    <>
      {/* SECCIÓN 3.5: CONFIGURACIÓN DE PERIODIZACIÓN CIENTÍFICA (RIR) */}
      {config && (
  <div data-testid="periodization-card" style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '16px', padding: '20px', marginBottom: '24px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 8px 32px 0 var(--theme-glow)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
      <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '13px', color: 'var(--theme-primary)', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><polygon points="6 2 18 2 18 6 6 6 6 2"/><rect x="3" y="6" width="18" height="16" rx="2"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
        PERIODIZACIÓN CIENTÍFICA Y AUTORREGULACIÓN RIR
        <InfoTooltip title="Periodización Científica RIR" body="Activa la autorregulación automatizada de volumen y cargas (fórmulas RP e intensidad basada en 1RM) para optimizar el progreso del atleta y ahorrar tiempo de planificación." />
      </h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", userSelect: 'none' }}>
          {config.enabled ? 'ACTIVO' : 'DESACTIVADO'}
        </span>
        <div
          onClick={() => {
            setConfig(prev => prev ? { ...prev, enabled: !prev.enabled } : undefined);
          }}
          style={{
            width: '42px',
            height: '22px',
            background: config.enabled ? 'var(--theme-primary)' : 'rgba(255, 255, 255, 0.12)',
            borderRadius: '11px',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxSizing: 'border-box',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <div style={{
            width: '16px',
            height: '16px',
            background: config.enabled ? '#000' : '#fff',
            borderRadius: '50%',
            transform: config.enabled ? 'translateX(20px)' : 'translateX(0px)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }} />
        </div>
      </div>
    </div>

    <p style={{ margin: '0 0 16px 0', fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: '1.4' }}>
      Al activar este módulo, el plan del atleta calculará automáticamente las series y las intensidades recomendadas (pesos) basándose en su rendimiento. El atleta registrará su RIR y recuperación real al final de cada ejercicio para actualizar el volumen para la siguiente semana.
    </p>

    {/* Guía visual inline para el entrenador */}
    <div className="periodization-flow-guide-panel" style={{
      background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.04), rgba(0, 100, 200, 0.04))',
      border: '1px solid rgba(0, 212, 255, 0.1)',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '20px'
    }}>
      <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--theme-primary)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        ¿CÓMO FUNCIONA? — FLUJO COMPLETO
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
        {[
          { step: '1', title: 'Tú configuras', desc: 'Activas la periodización, defines semanas y objetivo del bloque.' },
          { step: '2', title: 'Atleta evalúa', desc: 'Completa un diagnóstico inicial con su 1RM, edad y puntos débiles.' },
          { step: '3', title: 'Entrena con guía', desc: 'Ve cargas sugeridas y RIR objetivo. Registra su sesión normal.' },
          { step: '4', title: 'Responde feedback', desc: '2 preguntas: estímulo muscular y estado de recuperación.' },
          { step: '5', title: 'Algoritmo ajusta', desc: 'Series y peso se actualizan automáticamente para la próxima semana.' },
          { step: '6', title: 'Deload automático', desc: 'Al terminar el bloque: 50% volumen + RIR 4. Reinicia ciclo.' }
        ].map(item => (
          <div key={item.step} style={{
            background: 'rgba(0,0,0,0.25)',
            borderRadius: '8px',
            padding: '10px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--theme-primary)', fontFamily: "'Orbitron', sans-serif", marginBottom: '4px' }}>{item.step}</div>
            <div style={{ fontSize: '9px', fontWeight: 700, color: 'white', marginBottom: '4px', textTransform: 'uppercase' }}>{item.title}</div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', lineHeight: '1.3' }}>{item.desc}</div>
          </div>
        ))}
      </div>
    </div>

    {config.enabled && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
        
        {/* Ajustes del Bloque */}
        <div>
          <h4 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '11px', color: 'var(--theme-primary)', letterSpacing: '0.5px', marginBottom: '12px', marginTop: 0, textTransform: 'uppercase', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            Ajustes del Bloque de Entrenamiento
            <InfoTooltip title="Bloque de Entrenamiento (Mesociclo)" body="Un bloque o mesociclo es un período de entrenamiento de varias semanas (típicamente 4-6). El volumen empieza bajo y sube gradualmente cada semana hasta llegar a una descarga automática al final. Así evitas el sobreentrenamiento y maximizas las ganancias." />
            <button
              type="button"
              onClick={() => onOpenHelpModal()}
              style={{
                background: 'rgba(0, 212, 255, 0.08)',
                border: '1px solid rgba(0, 212, 255, 0.2)',
                borderRadius: '6px',
                color: 'var(--theme-primary, #00d4ff)',
                fontSize: '9px',
                fontWeight: 800,
                fontFamily: "'Orbitron', sans-serif",
                padding: '4px 8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 212, 255, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 212, 255, 0.08)';
              }}
            >
              📘 Guía Científica y FAQ
            </button>
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label htmlFor="period-objetivo" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>OBJETIVO DEL BLOQUE</label>
              </div>
              <select
                id="period-objetivo"
                value={config.objetivo || 'hipertrofia'}
                onChange={(e) => {
                  const val = e.target.value as 'fuerza' | 'hipertrofia' | 'mantenimiento';
                  setConfig(prev => prev ? { ...prev, objetivo: val } : undefined);
                }}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', height: '38px', boxSizing: 'border-box' }}
              >
                <option value="hipertrofia" style={{ background: '#0b0f19' }}>Hipertrofia (Acumulación)</option>
                <option value="fuerza" style={{ background: '#0b0f19' }}>Fuerza (Intensificación)</option>
                <option value="mantenimiento" style={{ background: '#0b0f19' }}>Mantenimiento / Calórico</option>
              </select>
            </div>

            <div>
              <label htmlFor="period-semanas" style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '6px' }}>SEMANAS TOTALES DEL BLOQUE</label>
              <input
                id="period-semanas"
                type="number"
                min={3}
                max={12}
                value={config.total_semanas || 4}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 4;
                  setConfig(prev => prev ? { ...prev, total_semanas: val } : undefined);
                }}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', height: '38px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label htmlFor="period-semana-actual" style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '6px' }}>SEMANA ACTUAL (MICROCICLO)</label>
              <input
                id="period-semana-actual"
                type="number"
                min={1}
                max={config.total_semanas || 12}
                value={config.semana_actual || 1}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 1;
                  setConfig(prev => prev ? { ...prev, semana_actual: val } : undefined);
                }}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', height: '38px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* ─── RIR Progresión + Indicador en vivo ─── */}
          {(() => {
            const rirIni    = config.rir_inicial   ?? (config.nivel_atleta === 'avanzado' ? 4 : 3);
            const rirProg   = config.rir_progresion ?? (config.nivel_atleta === 'principiante' ? 'lenta' : 'normal');
            const nivAtl    = (config.nivel_atleta || 'intermedio') as 'principiante' | 'intermedio' | 'avanzado';
            const semActual = config.semana_actual || 1;
            const totalSem  = config.total_semanas || 4;

            // Usar directamente calcTargetRIRForWeek del engine — así el preview
            // siempre refleja exactamente lo que el motor va a calcular,
            // sin riesgo de divergencia si la lógica del engine cambia.
            const rirActual = calcTargetRIRForWeek(semActual, rirIni, nivAtl, rirProg);

            return (
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '6px' }}>RIR INICIAL DEL BLOQUE</label>
                    <select
                      value={rirIni}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setConfig(prev => prev ? { ...prev, rir_inicial: val } : undefined);
                      }}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', height: '38px', boxSizing: 'border-box' }}
                    >
                      <option value={2} style={{ background: '#0b0f19' }}>RIR 2 — Bloque corto / alta intensidad</option>
                      <option value={3} style={{ background: '#0b0f19' }}>RIR 3 — Estándar (Principiante / Intermedio)</option>
                      <option value={4} style={{ background: '#0b0f19' }}>RIR 4 — Bloque largo / Avanzado</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '6px' }}>VELOCIDAD DE PROGRESIÓN RIR</label>
                    <select
                      value={rirProg}
                      onChange={(e) => {
                        const val = e.target.value as 'lenta' | 'normal' | 'agresiva';
                        setConfig(prev => prev ? { ...prev, rir_progresion: val } : undefined);
                      }}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', height: '38px', boxSizing: 'border-box' }}
                    >
                      <option value="lenta" style={{ background: '#0b0f19' }}>Lenta — −1 RIR cada 2 semanas (Principiante)</option>
                      <option value="normal" style={{ background: '#0b0f19' }}>Normal — −1 RIR por semana (Intermedio)</option>
                      <option value="agresiva" style={{ background: '#0b0f19' }}>Agresiva — −1 RIR/semana desde RIR 4 (Avanzado)</option>
                    </select>
                  </div>
                </div>

                {/* Toggle: rir_override_manual */}
                {(() => {
                  const isOverride = !!config.rir_override_manual;
                  return (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isOverride ? 'rgba(251,191,36,0.08)' : 'rgba(0,0,0,0.15)',
                      border: `1px solid ${isOverride ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: '10px',
                      padding: '10px 14px',
                      marginBottom: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                      onClick={() => setConfig(prev => prev ? { ...prev, rir_override_manual: !prev.rir_override_manual } : undefined)}
                    >
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: isOverride ? 'rgba(251,191,36,0.9)' : 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>
                          {isOverride ? '🔒 RIR MANUAL ACTIVO' : '🤖 RIR AUTOMÁTICO'}
                        </div>
                        <div style={{ fontSize: '10px', color: isOverride ? 'rgba(251,191,36,0.6)' : 'rgba(255,255,255,0.3)', lineHeight: '1.3' }}>
                          {isOverride
                            ? 'El motor no tocará el RIR. Tú controlas cada ejercicio. Toca para volver al automático.'
                            : 'El motor actualiza el RIR semana a semana. Toca para tomar control manual.'}
                        </div>
                      </div>
                      <div style={{
                        width: '36px',
                        height: '20px',
                        borderRadius: '10px',
                        background: isOverride ? 'rgba(251,191,36,0.7)' : 'rgba(255,255,255,0.15)',
                        position: 'relative',
                        flexShrink: 0,
                        marginLeft: '12px',
                        transition: 'background 0.2s',
                      }}>
                        <div style={{
                          position: 'absolute',
                          top: '3px',
                          left: isOverride ? '19px' : '3px',
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: 'white',
                          transition: 'left 0.2s',
                        }} />
                      </div>
                    </div>
                  );
                })()}

                {/* Selector: muscle_groups_in_focus — especialización para avanzados */}
                {nivAtl === 'avanzado' && (() => {
                  // Grupos musculares disponibles: derivados de los ejercicios
                  // actuales del plan (no hardcodeados — siempre coinciden con
                  // lo que el atleta realmente entrena).
                  const gruposDisponibles = Array.from(
                    new Set(
                      trainingDays
                        .flatMap(d => d.exercises || [])
                        .map(ex => (ex as any).grupo_muscular)
                        .filter((g): g is string => !!g && g.trim() !== '')
                    )
                  ).sort();

                  const focoActual = config.muscle_groups_in_focus || [];
                  const especializacionActiva = focoActual.length > 0;

                  const toggleGrupo = (grupo: string) => {
                    setConfig(prev => {
                      if (!prev) return undefined;
                      const actual = prev.muscle_groups_in_focus || [];
                      const yaEsta = actual.includes(grupo);
                      const nuevo  = yaEsta
                        ? actual.filter(g => g !== grupo)
                        : [...actual, grupo];
                      return { ...prev, muscle_groups_in_focus: nuevo };
                    });
                  };

                  if (gruposDisponibles.length === 0) {
                    return null; // Sin ejercicios con grupo_muscular aún — no mostrar selector vacío
                  }

                  return (
                    <div style={{
                      background: especializacionActiva ? 'rgba(168,85,247,0.07)' : 'rgba(0,0,0,0.15)',
                      border: `1px solid ${especializacionActiva ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: '10px',
                      padding: '12px 14px',
                      marginBottom: '14px',
                    }}>
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: especializacionActiva ? 'rgba(192,132,252,0.9)' : 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>
                          {especializacionActiva ? '🎯 ESPECIALIZACIÓN ACTIVA' : '🎯 GRUPOS EN FOCO (opcional)'}
                        </div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: '1.3' }}>
                          {especializacionActiva
                            ? `Solo ${focoActual.length === 1 ? 'el grupo seleccionado recibe' : 'los grupos seleccionados reciben'} progresión dinámica completa. El resto se mantiene en volumen de mantenimiento (MV).`
                            : 'Selecciona 1–2 grupos rezagados para priorizar. Sin selección, todos los grupos progresan igual.'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {gruposDisponibles.map(grupo => {
                          const activo = focoActual.includes(grupo);
                          return (
                            <button
                              key={grupo}
                              type="button"
                              onClick={() => toggleGrupo(grupo)}
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '5px 12px',
                                borderRadius: '999px',
                                border: `1px solid ${activo ? 'rgba(168,85,247,0.6)' : 'rgba(255,255,255,0.12)'}`,
                                background: activo ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.04)',
                                color: activo ? 'rgba(216,180,254,1)' : 'rgba(255,255,255,0.5)',
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                                transition: 'all 0.15s',
                              }}
                            >
                              {activo ? '✓ ' : ''}{grupo}
                            </button>
                          );
                        })}
                      </div>
                      {especializacionActiva && (
                        <div
                          onClick={() => setConfig(prev => prev ? { ...prev, muscle_groups_in_focus: [] } : undefined)}
                          style={{
                            fontSize: '10px',
                            color: 'rgba(255,255,255,0.35)',
                            marginTop: '8px',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          Limpiar selección — volver a progresión uniforme
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Indicador visual: RIR actual + proyección del bloque */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(0,212,255,0.06), rgba(99,102,241,0.06))',
                  border: '1px solid rgba(0,212,255,0.15)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--theme-primary)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px' }}>
                      📊 RIR SEMANA A SEMANA
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: 'var(--theme-primary)',
                      fontFamily: "'Orbitron', sans-serif",
                      background: 'rgba(0,212,255,0.12)',
                      border: '1px solid rgba(0,212,255,0.3)',
                      borderRadius: '6px',
                      padding: '3px 10px',
                    }}>
                      AHORA: RIR {rirActual}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {Array.from({ length: totalSem }, (_, i) => i + 1).map(sem => {
                      const r     = calcTargetRIRForWeek(sem, rirIni, nivAtl, rirProg);
                      const isNow = sem === semActual;
                      return (
                        <div
                          key={sem}
                          style={{
                            flex: '1 1 36px',
                            minWidth: '36px',
                            background: isNow ? 'rgba(0,212,255,0.18)' : 'rgba(0,0,0,0.25)',
                            border: isNow ? '1px solid rgba(0,212,255,0.5)' : '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '8px',
                            padding: '8px 4px',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: '8px', color: isNow ? 'var(--theme-primary)' : 'rgba(255,255,255,0.35)', marginBottom: '4px', fontWeight: 700 }}>S{sem}</div>
                          <div style={{ fontSize: '14px', fontWeight: 900, color: isNow ? 'var(--theme-primary)' : 'rgba(255,255,255,0.65)', fontFamily: "'Orbitron', sans-serif" }}>{r}</div>
                          <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>RIR</div>
                        </div>
                      );
                    })}
                    {/* Deload */}
                    <div style={{
                      flex: '1 1 36px',
                      minWidth: '36px',
                      background: 'rgba(99,102,241,0.08)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      borderRadius: '8px',
                      padding: '8px 4px',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '8px', color: 'rgba(167,139,250,0.6)', marginBottom: '4px', fontWeight: 700 }}>DL</div>
                      <div style={{ fontSize: '14px', fontWeight: 900, color: 'rgba(167,139,250,0.8)', fontFamily: "'Orbitron', sans-serif" }}>4</div>
                      <div style={{ fontSize: '7px', color: 'rgba(167,139,250,0.4)', marginTop: '2px' }}>RIR</div>
                    </div>
                  </div>
                  <p style={{ margin: '10px 0 0 0', fontSize: '10px', color: 'rgba(255,255,255,0.35)', lineHeight: '1.4' }}>
                    {nivAtl === 'principiante'
                      ? '⚠️ Principiante: nunca llega a RIR 0 — protege la técnica y previene lesiones.'
                      : '🤖 El peso sube automáticamente al bajar el RIR. El 1RM actualizado lo potencia aún más.'}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Diagnóstico Inicial */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
          <h4 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '11px', color: 'var(--theme-primary)', letterSpacing: '0.5px', marginBottom: '12px', marginTop: 0, textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>
            Diagnóstico Inicial del Atleta (Trainer Overrides)
            <InfoTooltip title="Sobreescritura del Entrenador" body="Estos valores los puede completar el atleta en su evaluación inicial, PERO si tú los editas aquí, tus valores prevalecen. Usa esta sección para pre-configurar atletas que ya conoces bien, o para corregir datos incorrectos sin que el atleta tenga que repetir el diagnóstico." />
          </h4>
          <p style={{ margin: '0 0 16px 0', fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: '1.4' }}>
            Puedes preconfigurar o anular estos valores subjetivos y marcas de fuerza estimadas. El atleta los completará o los verá actualizados según su progreso.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div>
              <label htmlFor="period-nivel" style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '6px' }}>NIVEL DEL ATLETA</label>
              <select
                id="period-nivel"
                value={config.nivel_atleta || 'intermedio'}
                onChange={(e) => {
                  const val = e.target.value as 'principiante' | 'intermedio' | 'avanzado';
                  setConfig(prev => prev ? { ...prev, nivel_atleta: val } : undefined);
                }}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', height: '38px', boxSizing: 'border-box' }}
              >
                <option value="principiante" style={{ background: '#0b0f19' }}>Principiante (Bajo Volumen)</option>
                <option value="intermedio" style={{ background: '#0b0f19' }}>Intermedio (Estándar RP)</option>
                <option value="avanzado" style={{ background: '#0b0f19' }}>Avanzado (Alto Volumen)</option>
              </select>
            </div>
            <div>
              <label htmlFor="period-edad" style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '6px' }}>EDAD DEL ATLETA</label>
              <input
                id="period-edad"
                type="text" inputMode="numeric" pattern="[0-9]*" value={config.edad ?? 25}
                onChange={(e) => {
                    const val = e.target.value;
                    setConfig(prev => prev ? { ...prev, edad: val } as any : undefined);
                  }}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', height: '38px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label htmlFor="period-recup" style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '6px' }}>CAPACIDAD DE RECUPERACIÓN</label>
              <select
                id="period-recup"
                value={config.capacidad_recuperacion || 'media'}
                onChange={(e) => {
                  const val = e.target.value as 'alta' | 'media' | 'baja';
                  setConfig(prev => prev ? { ...prev, capacidad_recuperacion: val } : undefined);
                }}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', height: '38px', boxSizing: 'border-box' }}
              >
                <option value="alta" style={{ background: '#0b0f19' }}>Alta (Sueño profundo, bajo estrés)</option>
                <option value="media" style={{ background: '#0b0f19' }}>Media (Recuperación estándar)</option>
                <option value="baja" style={{ background: '#0b0f19' }}>Baja (Alto estrés o insomnio)</option>
              </select>
            </div>
          </div>

          {/* ─── Fórmula de Prescripción + Redondeo ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label htmlFor="period-formula" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '6px' }}>
                FÓRMULA DE PRESCRIPCIÓN DE CARGA
                <InfoTooltip
                  title="Fórmula de Prescripción"
                  body="Elige la fórmula que la app usará para calcular el peso sugerido a partir del 1RM, las repeticiones objetivo y el RIR. Epley (1985) es la más usada en powerlifting. Brzycki (1993) tiende a ser más precisa en rangos de 6-12 reps. El Promedio es la opción más conservadora y equilibrada."
                  size={14}
                />
              </label>
              <select
                id="period-formula"
                value={config.formula_preferida || 'epley'}
                onChange={(e) => {
                  const val = e.target.value as 'epley' | 'brzycki' | 'epley_brzycki_avg';
                  setConfig(prev => {
                    if (!prev) return prev;
                    const next = { ...prev, formula_preferida: val };
                    setTimeout(() => {
                      setTrainingDays(prevDays => recalculatePlanWeights(prevDays, next.marcas_1rm || {}, val, next.redondeo_peso || 2.5));
                    }, 50);
                    return next;
                  });
                }}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', height: '38px', boxSizing: 'border-box' }}
              >
                <option value="epley" style={{ background: '#0b0f19' }}>Epley (1985) — Estándar powerlifting</option>
                <option value="brzycki" style={{ background: '#0b0f19' }}>Brzycki (1993) — Precisa en 6-12 reps</option>
                <option value="epley_brzycki_avg" style={{ background: '#0b0f19' }}>Promedio Epley-Brzycki — Conservador</option>
              </select>
            </div>
            <div>
              <label htmlFor="period-redondeo" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '6px' }}>
                INCREMENTO DE REDONDEO (KG)
                <InfoTooltip
                  title="Redondeo de Peso"
                  body="El peso calculado se redondea al múltiplo de este valor. 2.5 kg es el estándar para barras con discos olímpicos. Usa 1.25 kg si tu atleta tiene micro-discos. Usa 2 kg para mancuernas que saltan de 2 en 2."
                  size={14}
                />
              </label>
              <select
                id="period-redondeo"
                value={config.redondeo_peso ?? 2.5}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setConfig(prev => {
                    if (!prev) return prev;
                    const next = { ...prev, redondeo_peso: val };
                    setTimeout(() => {
                      setTrainingDays(prevDays => recalculatePlanWeights(prevDays, next.marcas_1rm || {}, next.formula_preferida || 'epley', val));
                    }, 50);
                    return next;
                  });
                }}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', height: '38px', boxSizing: 'border-box' }}
              >
                <option value={0.5} style={{ background: '#0b0f19' }}>0.5 kg — Máxima precisión</option>
                <option value={1} style={{ background: '#0b0f19' }}>1.0 kg — Discos finos</option>
                <option value={1.25} style={{ background: '#0b0f19' }}>1.25 kg — Micro-discos olímpicos</option>
                <option value={2} style={{ background: '#0b0f19' }}>2.0 kg — Mancuernas estándar</option>
                <option value={2.5} style={{ background: '#0b0f19' }}>2.5 kg — Estándar (por defecto)</option>
                <option value={5} style={{ background: '#0b0f19' }}>5.0 kg — Gimnasio básico</option>
              </select>
            </div>
          </div>

          {/* Banner de Explicabilidad Científica de Fórmulas */}
          <div style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
            display: 'flex',
            gap: '12px',
            fontFamily: "'Inter', sans-serif"
          }}>
            <span style={{ fontSize: '20px' }}>🧪</span>
            <div style={{ textAlign: 'left' }}>
              <strong style={{ fontSize: '12px', color: '#a5b4fc', display: 'block', marginBottom: '4px' }}>
                Laboratorio Científico: ¡Prueba cambiar las fórmulas!
              </strong>
              <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.5 }}>
                El robot inteligente 🤖 utiliza la fórmula seleccionada arriba y las marcas de 1RM de abajo para prescribir cargas automáticas. 
                <strong> Intenta cambiar la fórmula de Epley a Brzycki</strong>: verás cómo los pesos calculados en las tarjetas de ejercicios de arriba se recalculan en directo. ¡Usa la que mejor se adapte a tu metodología!
              </p>
            </div>
          </div>

          {/* Marcas de Fuerza 1RM */}

          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>
                Fuerza Máxima Estimada (1RM)
                <InfoTooltip title="1RM — Repetición Máxima" body="Es el peso máximo que el atleta puede levantar una sola vez con buena técnica. Se calcula automáticamente usando las fórmulas Epley+Brzycki a partir del peso, reps y RIR que el atleta ingrese. Este valor se usa para sugerir las cargas de entrenamiento: ej. si tu 1RM de sentadilla es 120kg y el plan dice 'RIR 2 x 8 reps', la app sugiere ~82.5kg." />
              </label>
              <button
                type="button"
                onClick={() => onOpenCalculator()}
                style={{
                  background: 'rgba(194, 255, 0, 0.1)',
                  border: '1px solid rgba(194, 255, 0, 0.3)',
                  color: '#c2ff00',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontFamily: "'Orbitron', sans-serif"
                }}
              >
                🧮 Calculadora 1RM
              </button>
            </div>
            {/* Dynamic 1RM entries: 3 base powerlifts + all exercises from the plan + existing marcas */}
            {(() => {
              // Collect all unique exercise names: base 3 + plan exercises + existing marcas
              const baseLifts = ['sentadilla', 'press de banca', 'peso muerto'];
              const planExerciseNames = trainingDays
                .flatMap(d => d.exercises)
                .map(ex => ex.nombre.trim().toLowerCase())
                .filter(n => n.length > 0);
              const existingMarcaKeys = Object.keys(config.marcas_1rm || {});
              
              // Merge all sources into a unique, ordered list
              const allKeys = [...new Set([...baseLifts, ...planExerciseNames, ...existingMarcaKeys])];
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                    {allKeys.map(lift => {
                      const current1RM = config.marcas_1rm?.[lift] || 0;
                      const isBaseLift = baseLifts.includes(lift);
                      return (
                        <div key={lift} style={{
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid ' + (isBaseLift ? 'rgba(0, 212, 255, 0.1)' : 'rgba(255,255,255,0.04)'),
                          borderRadius: '10px',
                          padding: '10px',
                          position: 'relative'
                        }}>
                          {isBaseLift && (
                            <span style={{ position: 'absolute', top: '4px', right: '6px', fontSize: '7px', color: 'var(--theme-primary)', fontFamily: "'Orbitron', sans-serif", opacity: 0.5 }}>BASE</span>
                          )}
                          <label htmlFor={`1rm-${lift}`} style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: isBaseLift ? 'var(--theme-primary)' : 'rgba(255,255,255,0.6)', marginBottom: '4px', textTransform: 'uppercase', fontFamily: "'Orbitron', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lift}</label>
                          <input
                            id={`1rm-${lift}`}
                            type="number"
                            placeholder="0 kg"
                            value={current1RM || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const updatedMarcas = { ...(config?.marcas_1rm || {}), [lift]: val };
                              if (val === 0) delete updatedMarcas[lift];
                              
                              setConfig(prev => {
                                if (!prev) return prev;
                                return { ...prev, marcas_1rm: updatedMarcas };
                              });
                              
                              setTrainingDays(prevDays => recalculatePlanWeights(prevDays, updatedMarcas));
                            }}
                            style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 0', fontSize: '12px', outline: 'none' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '9px', color: 'rgba(255,255,255,0.3)', lineHeight: '1.3' }}>
                    Se muestran los 3 levantamientos base + todos los ejercicios del plan. Solo los ejercicios con 1RM registrado recibirán cargas sugeridas. El atleta también actualizará estas marcas automáticamente al registrar sus sesiones.
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Puntos Débiles */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>
              Puntos Débiles Mecánicos
              <InfoTooltip title="Puntos Débiles (Sticking Points)" body="Indica en qué parte del movimiento el atleta tiende a fallar cuando está cerca de su límite. El sistema usará esta información para sugerir ejercicios accesorios correctivos específicos (ej: Pause Squats si falla en la fase profunda de la sentadilla, o Close Grip Bench si falla en el bloqueo del press)." />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              
              {/* Sentadilla */}
              <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px' }}>
                <label htmlFor="weak-squat" style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: 'var(--theme-primary)', marginBottom: '4px', textTransform: 'uppercase', fontFamily: "'Orbitron', sans-serif" }}>Sentadilla</label>
                <select
                  id="weak-squat"
                  value={config.puntos_debiles?.sentadilla || 'abajo'}
                  onChange={(e) => {
                    const val = e.target.value as 'abajo' | 'mitad' | 'arriba';
                    setConfig(prev => {
                      if (!prev) return prev;
                      const updatedPoints = { ...prev.puntos_debiles, sentadilla: val };
                      return { ...prev, puntos_debiles: updatedPoints };
                    });
                  }}
                  style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 0', fontSize: '11px', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="abajo" style={{ background: '#0b0f19' }}>Fase Profunda (Salida)</option>
                  <option value="mitad" style={{ background: '#0b0f19' }}>Punto Medio</option>
                  <option value="arriba" style={{ background: '#0b0f19' }}>Bloqueo Arriba</option>
                </select>
              </div>

              {/* Press de Banca */}
              <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px' }}>
                <label htmlFor="weak-bench" style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: 'var(--theme-primary)', marginBottom: '4px', textTransform: 'uppercase', fontFamily: "'Orbitron', sans-serif" }}>Press de Banca</label>
                <select
                  id="weak-bench"
                  value={config.puntos_debiles?.banca || 'pecho'}
                  onChange={(e) => {
                    const val = e.target.value as 'pecho' | 'mitad' | 'bloqueo';
                    setConfig(prev => {
                      if (!prev) return prev;
                      const updatedPoints = { ...prev.puntos_debiles, banca: val };
                      return { ...prev, puntos_debiles: updatedPoints };
                    });
                  }}
                  style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 0', fontSize: '11px', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="pecho" style={{ background: '#0b0f19' }}>Del Pecho (Salida)</option>
                  <option value="mitad" style={{ background: '#0b0f19' }}>Mitad de Camino</option>
                  <option value="bloqueo" style={{ background: '#0b0f19' }}>Bloqueo Final</option>
                </select>
              </div>

              {/* Peso Muerto */}
              <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px' }}>
                <label htmlFor="weak-deadlift" style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: 'var(--theme-primary)', marginBottom: '4px', textTransform: 'uppercase', fontFamily: "'Orbitron', sans-serif" }}>Peso Muerto</label>
                <select
                  id="weak-deadlift"
                  value={config.puntos_debiles?.peso_muerto || 'despegue'}
                  onChange={(e) => {
                    const val = e.target.value as 'despegue' | 'rodillas' | 'bloqueo';
                    setConfig(prev => {
                      if (!prev) return prev;
                      const updatedPoints = { ...prev.puntos_debiles, peso_muerto: val };
                      return { ...prev, puntos_debiles: updatedPoints };
                    });
                  }}
                  style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 0', fontSize: '11px', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="despegue" style={{ background: '#0b0f19' }}>Despegue Suelo</option>
                  <option value="rodillas" style={{ background: '#0b0f19' }}>Bajo Rodillas</option>
                  <option value="bloqueo" style={{ background: '#0b0f19' }}>Bloqueo Arriba</option>
                </select>
              </div>

            </div>

            {/* Smart Coach suggestions box */}
            {(() => {
              if (!config) return null;
              const squatWeak = config.puntos_debiles?.sentadilla || 'abajo';
              const bancaWeak = config.puntos_debiles?.banca || 'pecho';
              const dlWeak = config.puntos_debiles?.peso_muerto || 'despegue';

              const findExerciseDayName = (keywords: string[]) => {
                for (const day of trainingDays) {
                  const hasEx = (day.exercises || []).some(ex => 
                    ex.nombre && keywords.some(kw => ex.nombre.toLowerCase().includes(kw))
                  );
                  if (hasEx) return day.name;
                }
                return null;
              };

              const squatDay = findExerciseDayName(['sentadilla', 'squat']);
              const benchDay = findExerciseDayName(['press de banca', 'press banca', 'bench press']);
              const dlDay = findExerciseDayName(['peso muerto', 'deadlift']);

              const correctionsToSuggest: { liftKey: string; liftLabel: string; point: string; dayName: string | null }[] = [];
              if (squatDay) correctionsToSuggest.push({ liftKey: 'sentadilla', liftLabel: 'Sentadilla', point: squatWeak, dayName: squatDay });
              if (benchDay) correctionsToSuggest.push({ liftKey: 'banca', liftLabel: 'Press de Banca', point: bancaWeak, dayName: benchDay });
              if (dlDay) correctionsToSuggest.push({ liftKey: 'peso_muerto', liftLabel: 'Peso Muerto', point: dlWeak, dayName: dlDay });

              if (correctionsToSuggest.length === 0) return null;

              return (
                <div className="smart-coach-suggestions-panel" style={{
                  marginTop: '20px',
                  background: 'rgba(0, 212, 255, 0.03)',
                  border: '1px solid rgba(0, 212, 255, 0.15)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>💡</span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      fontFamily: "'Orbitron', sans-serif",
                      color: 'var(--theme-primary, #00d4ff)',
                      letterSpacing: '1px',
                      textTransform: 'uppercase'
                    }}>
                      Sugerencias del Smart Coach
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {correctionsToSuggest.map((item) => {
                      const correction = getWeakPointCorrection(item.liftKey as any, item.point as any);
                      if (!correction) return null;

                      return (
                        <div key={item.liftKey} style={{
                          background: 'rgba(255, 255, 255, 0.01)',
                          border: '1px solid rgba(255, 255, 255, 0.04)',
                          borderRadius: '10px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <strong style={{ fontSize: '12px', color: 'white' }}>{correction.name}</strong>
                              <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', marginTop: '2px' }}>
                                Correctivo para {item.liftLabel} (Punto crítico: <span style={{ color: 'var(--theme-primary, #00d4ff)' }}>{item.point}</span>)
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddCorrectiveExercise(item.liftKey, correction)}
                              style={{
                                background: 'rgba(0, 212, 255, 0.1)',
                                border: '1px solid rgba(0, 212, 255, 0.25)',
                                borderRadius: '6px',
                                color: 'var(--theme-primary, #00d4ff)',
                                fontSize: '10px',
                                fontWeight: 800,
                                fontFamily: "'Orbitron', sans-serif",
                                padding: '6px 12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(0, 212, 255, 0.2)';
                                e.currentTarget.style.borderColor = 'var(--theme-primary, #00d4ff)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(0, 212, 255, 0.1)';
                                e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.25)';
                              }}
                            >
                              ➕ Agregar a {item.dayName}
                            </button>
                          </div>
                          
                          <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', margin: 0, lineHeight: '1.4' }}>
                            {correction.description}
                          </p>

                          <div style={{
                            background: 'rgba(249, 115, 22, 0.05)',
                            border: '1px solid rgba(249, 115, 22, 0.15)',
                            borderRadius: '8px',
                            padding: '10px',
                            fontSize: '11px',
                            color: '#ffaa66',
                            lineHeight: '1.4'
                          }}>
                            <strong style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ff7e2e', display: 'block', marginBottom: '4px' }}>
                              ⏱️ Explicación del Tempo ({correction.tempo})
                            </strong>
                            {formatTempoDetail(correction.tempo).split('\n').slice(1).join('\n')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

        </div>

        {/* PANEL DE AUDITORÍA DE VOLUMEN MRV */}
        <div className="weekly-volume-audit-panel" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', marginTop: '10px' }}>
          <h4 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '11px', color: 'var(--theme-primary)', letterSpacing: '0.5px', marginBottom: '12px', marginTop: 0, textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>
            {config?.objetivo === 'fuerza' ? 'Auditoría de Volumen de Fuerza Semanal (Patrones RP)' : 'Auditoría de Volumen Semanal (Periodización RP)'}
            <InfoTooltip 
              title={config?.objetivo === 'fuerza' ? 'Auditoría de Fuerza' : 'Auditoría MRV'} 
              body={config?.objetivo === 'fuerza' 
                ? 'Muestra la sumatoria de todos los NL (Número de Levantamientos = series * reps) programados en la semana por patrón de movimiento. Si superas el MRV, el algoritmo bloqueará incrementos adicionales.' 
                : 'Muestra la sumatoria de todas las series de trabajo programadas en la semana por grupo muscular. Si superas el MRV (Volumen Máximo Recuperable), el algoritmo bloqueará incrementos adicionales para prevenir el sobreentrenamiento.'} 
            />
          </h4>
          <p style={{ margin: '0 0 16px 0', fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: '1.4' }}>
            {config?.objetivo === 'fuerza' 
              ? 'Vigila que no hayas programado exceso de NL. Si el medidor está en rojo, reduce el volumen de levantamientos para evitar sobreentrenamiento neural.' 
              : 'Vigila que no hayas programado exceso de series. Si el medidor está en rojo, reduce el volumen inicial para que el atleta pueda progresar hacia el MRV durante el mesociclo.'}
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {config?.objetivo === 'fuerza' ? (
              Object.entries(weeklyNLData)
                .filter(([_, nl]) => nl > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([pattern, nl]) => {
                  const threshold = getStrengthThreshold(pattern as MovementPattern, config?.nivel_atleta || 'intermedio');
                  const { status } = evaluateStrengthVolume(pattern as MovementPattern, nl, config?.nivel_atleta || 'intermedio');
                  const humanized = humanizeAlert(status as any, {
                    label:       threshold.label,
                    current:     nl,
                    mev:         threshold.mev,
                    mavMin:      threshold.mavMin,
                    mavMax:      threshold.mavMax,
                    mrv:         threshold.mrv,
                    unit:        'NL★',
                    athleteLevel: (config?.nivel_atleta || 'intermedio') as any,
                    mrvSignals:  threshold.mrvSignals,
                  });
                  const isDanger  = status === 'danger';
                  const isOptimal = status === 'optimal';
                  const color = isDanger ? '#ef4444' : isOptimal ? '#22c55e' : '#eab308';

                  return (
                    <div key={pattern} style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: `1px solid ${isDanger ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.04)'}`,
                      borderRadius: '10px', padding: '12px',
                      position: 'relative', overflow: 'hidden'
                    }}>
                      {isDanger && <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: color }} />}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '11px', color: 'white', fontFamily: "'Orbitron', sans-serif" }}>{threshold.label}</strong>
                        <span style={{ fontSize: '12px', fontWeight: 800, color }}>{nl} NL★</span>
                      </div>
                      {/* Mensaje humanizado — siempre visible */}
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.4, marginBottom: humanized.action ? '6px' : 0 }}>
                        {humanized.headline}
                      </div>
                      {humanized.action && (
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, marginBottom: languageMode === 'tecnico' ? '6px' : 0 }}>
                          → {humanized.action}
                        </div>
                      )}
                      {/* Dato técnico — solo en modo técnico */}
                      {languageMode === 'tecnico' && (
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          {humanized.technical}
                        </div>
                      )}
                      {/* Señales MRV — solo en danger */}
                      {isDanger && humanized.signals && humanized.signals.length > 0 && (
                        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(239,68,68,0.15)' }}>
                          <div style={{ fontSize: '9px', color: 'rgba(239,68,68,0.7)', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Señales a observar en el atleta
                          </div>
                          {humanized.signals.map((s, i) => (
                            <div key={i} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>
                              › {s}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
            ) : (
              Object.entries(weeklyVolumeData)
                .filter(([gm, volume]) => volume > 0 && gm !== 'General' && gm !== 'Cardio')
                .sort((a, b) => b[1] - a[1])
                .map(([gm, volume]) => {
                  const thresholds = getThresholdsForMuscleGroup(gm, config.nivel_atleta, config.objetivo as any);
                  const { status } = evaluateVolumeStatus(gm, volume, config.nivel_atleta, config.objetivo as any, weeklyTargets[gm]);
                  const humanized = humanizeAlert(status as any, {
                    label:       gm,
                    current:     volume,
                    mev:         thresholds.mev,
                    mavMin:      thresholds.mavMin,
                    mavMax:      thresholds.mavMax,
                    mrv:         thresholds.mrv,
                    unit:        'series',
                    athleteLevel: (config?.nivel_atleta || 'intermedio') as any,
                  });
                  const isDanger  = status === 'danger';
                  const isOptimal = status === 'optimal';
                  const color = isDanger ? '#ef4444' : isOptimal ? '#22c55e' : '#eab308';

                  return (
                    <div key={gm} style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: `1px solid ${isDanger ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.04)'}`,
                      borderRadius: '10px', padding: '12px',
                      position: 'relative', overflow: 'hidden'
                    }}>
                      {isDanger && <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: color }} />}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '11px', color: 'white', fontFamily: "'Orbitron', sans-serif" }}>{gm}</strong>
                        <span style={{ fontSize: '12px', fontWeight: 800, color }}>{volume} series</span>
                      </div>
                      {/* Mensaje humanizado — siempre visible */}
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.4, marginBottom: humanized.action ? '6px' : 0 }}>
                        {humanized.headline}
                      </div>
                      {humanized.action && (
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, marginBottom: languageMode === 'tecnico' ? '6px' : 0 }}>
                          → {humanized.action}
                        </div>
                      )}
                      {/* Dato técnico — solo en modo técnico */}
                      {languageMode === 'tecnico' && (
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          {humanized.technical}
                        </div>
                      )}
                    </div>
                  );
                })
            )}
            {((config?.objetivo === 'fuerza' ? Object.values(weeklyNLData).reduce((a, b) => a + b, 0) : Object.values(weeklyVolumeData).reduce((a, b) => a + b, 0)) === 0) && (
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                {config?.objetivo === 'fuerza' ? 'No hay levantamientos de fuerza programados aún.' : 'No hay series programadas aún.'}
              </div>
            )}
          </div>
        </div>

      </div>
    )}
  </div>
      )}
    </>
  );
};
