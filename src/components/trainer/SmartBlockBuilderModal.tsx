import React from 'react';
import { TrainingDay, Exercise } from '../../types/database.types';
import { generateProgressionText } from '../../lib/progressionTemplates';

export interface ProgModalState {
  isOpen: boolean;
  dayId: string;
  exId: string;
  template: string;
  params: any;
}

export interface ExerciseHistoryEntry {
  variables: Record<string, string>;
  progression_notes: string;
  progression_type?: string;
  progression_params?: any;
}

interface SmartBlockBuilderModalProps {
  progModal: ProgModalState | null;
  setProgModal: React.Dispatch<React.SetStateAction<ProgModalState | null>>;
  trainingDays: TrainingDay[];
  setTrainingDays: React.Dispatch<React.SetStateAction<TrainingDay[]>>;
  setExerciseHistory: React.Dispatch<React.SetStateAction<Record<string, ExerciseHistoryEntry>>>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * Modal "Smart Block Builder" — personalización de plantillas de progresión.
 *
 * Extraído de PlanPlanner.tsx (4038 líneas) como segundo candidato de
 * separación de responsabilidades, tras PeriodizationPanel. Concentra:
 *   - El formulario de parámetros por plantilla (lineal, doble, ondulante, deload)
 *   - La vista previa autogenerada de la "Regla de Juego"
 *   - La aplicación de la progresión al ejercicio (con historial para deshacer)
 *
 * Lo que NO se movió aquí (queda en PlanPlanner.tsx):
 *   - El dropdown "⚙️ Progresión" que abre el modal — vive entrelazado con
 *     el render de cada ejercicio individual dentro de la lista de días.
 *   - `autoProgExId` (qué dropdown está abierto) y `handleRevertProgression`
 *     (botón "Deshacer") — ambos dependen del layout de la lista de ejercicios,
 *     no del modal en sí.
 *   - `progModal` (el estado abierto/cerrado) sigue viviendo en el padre
 *     porque se setea desde `handleOpenProgression`, que es quien conecta
 *     el dropdown con este modal. Se pasa aquí como prop controlada.
 */
export const SmartBlockBuilderModal: React.FC<SmartBlockBuilderModalProps> = ({
  progModal,
  setProgModal,
  trainingDays,
  setTrainingDays,
  setExerciseHistory,
  showToast,
}) => {
  if (!progModal || !progModal.isOpen) return null;

  // Aplicar la progresión con los parámetros del modal
  const handleApplyProgressionCustom = (dayId: string, exId: string, template: string, params: any) => {
    // 1. Encontrar el ejercicio para guardar su estado original en el historial (Undo)
    let originalEx: Exercise | null = null;
    for (const d of trainingDays) {
      if (d.id === dayId) {
        const found = d.exercises.find(e => e.id === exId);
        if (found) {
          originalEx = found;
          break;
        }
      }
    }

    if (originalEx) {
      const historyKey = `${dayId}_${exId}`;
      setExerciseHistory(prev => ({
        ...prev,
        [historyKey]: {
          variables: { ...originalEx!.variables },
          progression_notes: originalEx!.progression_notes || '',
          progression_type: originalEx!.progression_type,
          progression_params: originalEx!.progression_params ? { ...originalEx!.progression_params } : undefined
        }
      }));
    }

    // 2. Generar el texto de progresión
    const generatedText = generateProgressionText(template, params);

    // 3. Actualizar variables principales y notas de progresión del ejercicio
    setTrainingDays(prev =>
      prev.map(d => {
        if (d.id !== dayId) return d;
        return {
          ...d,
          exercises: d.exercises.map(ex => {
            if (ex.id !== exId) return ex;
            const updatedVars = { ...ex.variables };

            // Escribir variables de control iniciales según la plantilla
            if (template === 'linear' || template === 'deload') {
              if (params.series) updatedVars['series de trabajo'] = params.series;
              if (params.repeticiones) updatedVars['repeticiones'] = params.repeticiones;
              if (params.rir) updatedVars['rir'] = params.rir;
            } else if (template === 'double') {
              if (params.series) updatedVars['series de trabajo'] = params.series;
              if (params.repsIniciales) updatedVars['repeticiones'] = params.repsIniciales;
              if (params.rir) updatedVars['rir'] = params.rir;
            } else if (template === 'undulating') {
              if (params.seriesFuerza) updatedVars['series de trabajo'] = `${params.seriesFuerza}-${params.seriesHipertrofia}`;
              if (params.repsFuerza) updatedVars['repeticiones'] = `${params.repsFuerza}-${params.repsHipertrofia}`;
              if (params.rirFuerza) updatedVars['rir'] = `${params.rirFuerza}-${params.rirHipertrofia}`;
            }

            return {
              ...ex,
              variables: updatedVars,
              progression_notes: generatedText,
              progression_type: template as any,
              progression_params: params
            };
          })
        };
      })
    );

    setProgModal(null);
    showToast(`Plantilla de progresión aplicada con éxito`, 'success');
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5, 5, 8, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease', padding: '16px'
    }}>
      <div style={{
        background: 'linear-gradient(165deg, rgba(20,20,24,0.98), rgba(12,12,16,0.99))',
        border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px',
        width: '100%', maxWidth: '520px', padding: '24px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column', gap: '20px'
      }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--theme-primary)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '1px', textTransform: 'uppercase' }}>
              Smart Block Builder
            </span>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 800, fontFamily: "'Orbitron', sans-serif", color: 'white', letterSpacing: '0.5px' }}>
              {progModal.template === 'linear' && '📈 CONFIGURAR PROGRESIÓN LINEAL'}
              {progModal.template === 'double' && '🔁 CONFIGURAR PROGRESIÓN DOBLE'}
              {progModal.template === 'undulating' && '🌊 CONFIGURAR PERIODIZACIÓN ONDULANTE'}
              {progModal.template === 'deload' && '💤 CONFIGURAR DESCARGA (DELOAD)'}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setProgModal(null)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '18px', cursor: 'pointer', transition: 'color 0.2s', fontWeight: 'bold' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'white')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
          >
            ✕
          </button>
        </div>

        {/* Formulario e Inputs de Criterios */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>

          {/* Parámetros Lineal */}
          {progModal.template === 'linear' && (
            <>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>DURACIÓN (SEMANAS)</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={progModal.params.duracion}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, duracion: parseInt(e.target.value, 10) || 4 } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>CARGA INICIAL</label>
                <input
                  type="text"
                  value={progModal.params.cargaInicial}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, cargaInicial: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>INCREMENTO (KG)</label>
                <input
                  type="text"
                  value={progModal.params.incremento}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, incremento: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>SERIES</label>
                <input
                  type="text"
                  value={progModal.params.series}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, series: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>REPETICIONES</label>
                <input
                  type="text"
                  value={progModal.params.repeticiones}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, repeticiones: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>RIR</label>
                <input
                  type="text"
                  value={progModal.params.rir}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, rir: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
            </>
          )}

          {/* Parámetros Doble */}
          {progModal.template === 'double' && (
            <>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>DURACIÓN (SEMANAS)</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={progModal.params.duracion}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, duracion: parseInt(e.target.value, 10) || 4 } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>CARGA INICIAL</label>
                <input
                  type="text"
                  value={progModal.params.cargaInicial}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, cargaInicial: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>INCREMENTO (KG)</label>
                <input
                  type="text"
                  value={progModal.params.incremento}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, incremento: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>SERIES</label>
                <input
                  type="text"
                  value={progModal.params.series}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, series: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>REPS INICIALES</label>
                <input
                  type="text"
                  value={progModal.params.repsIniciales}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, repsIniciales: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>REPS INTERMEDIAS</label>
                <input
                  type="text"
                  value={progModal.params.repsIntermedias}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, repsIntermedias: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>REPS MÁXIMAS</label>
                <input
                  type="text"
                  value={progModal.params.repsMaximas}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, repsMaximas: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>RIR</label>
                <input
                  type="text"
                  value={progModal.params.rir}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, rir: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
            </>
          )}

          {/* Parámetros Ondulante */}
          {progModal.template === 'undulating' && (
            <>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>DURACIÓN (SEMANAS)</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={progModal.params.duracion}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, duracion: parseInt(e.target.value, 10) || 4 } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>CARGA INICIAL</label>
                <input
                  type="text"
                  value={progModal.params.cargaInicial}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, cargaInicial: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>INCREMENTO FUERZA (KG)</label>
                <input
                  type="text"
                  value={progModal.params.incrementoFuerza}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, incrementoFuerza: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div></div>
              <div style={{ gridColumn: '1 / -1', fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
                Semanas Impares — Fuerza
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>SERIES (FUERZA)</label>
                <input
                  type="text"
                  value={progModal.params.seriesFuerza}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, seriesFuerza: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>REPS (FUERZA)</label>
                <input
                  type="text"
                  value={progModal.params.repsFuerza}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, repsFuerza: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>RIR (FUERZA)</label>
                <input
                  type="text"
                  value={progModal.params.rirFuerza}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, rirFuerza: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div></div>
              <div style={{ gridColumn: '1 / -1', fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
                Semanas Pares — Hipertrofia
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>SERIES (HIPERTROFIA)</label>
                <input
                  type="text"
                  value={progModal.params.seriesHipertrofia}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, seriesHipertrofia: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>REPS (HIPERTROFIA)</label>
                <input
                  type="text"
                  value={progModal.params.repsHipertrofia}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, repsHipertrofia: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>RIR (HIPERTROFIA)</label>
                <input
                  type="text"
                  value={progModal.params.rirHipertrofia}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, rirHipertrofia: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
            </>
          )}

          {/* Parámetros Deload */}
          {progModal.template === 'deload' && (
            <>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>DURACIÓN (SEMANAS)</label>
                <input
                  type="number"
                  min={1}
                  max={3}
                  value={progModal.params.duracion}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, duracion: parseInt(e.target.value, 10) || 1 } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>REDUCCIÓN VOLUMEN (%)</label>
                <input
                  type="text"
                  value={progModal.params.reduccionVolumen}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, reduccionVolumen: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>CARGA RECOMENDADA</label>
                <input
                  type="text"
                  value={progModal.params.cargaRecomendada}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, cargaRecomendada: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>SERIES</label>
                <input
                  type="text"
                  value={progModal.params.series}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, series: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>RIR</label>
                <input
                  type="text"
                  value={progModal.params.rir}
                  onChange={e => setProgModal({ ...progModal, params: { ...progModal.params, rir: e.target.value } })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
            </>
          )}
        </div>

        {/* Vista Previa del Texto autogenerado */}
        <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px' }}>
              VISTA PREVIA DE LA PAUTA
            </span>
            <span style={{ fontSize: '9px', color: '#ff7e2e', background: 'rgba(255, 126, 46, 0.1)', padding: '2px 8px', borderRadius: '4px', fontFamily: "'Orbitron', sans-serif" }}>
              AUTOGENERADO
            </span>
          </div>
          <pre style={{
            margin: 0,
            fontSize: '11px',
            color: 'rgba(255,255,255,0.85)',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
            maxHeight: '130px',
            overflowY: 'auto',
            lineHeight: '1.4'
          }}>
            {generateProgressionText(progModal.template, progModal.params)}
          </pre>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setProgModal(null)}
            style={{ flex: 1, height: '42px', fontSize: '11px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700 }}
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={() => handleApplyProgressionCustom(progModal.dayId, progModal.exId, progModal.template, progModal.params)}
            style={{
              flex: 2, height: '42px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #ff7e2e, #ff9a52)',
              color: 'white', fontSize: '11px', fontFamily: "'Orbitron', sans-serif", fontWeight: 800,
              cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(255, 126, 46, 0.25)'
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
          >
            APLICAR PROGRESIÓN
          </button>
        </div>

      </div>
    </div>
  );
};
