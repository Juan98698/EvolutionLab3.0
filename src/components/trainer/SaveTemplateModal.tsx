import React, { useState, useEffect } from 'react';
import { TrainingDay, GlobalVariable, PeriodizationConfig, TrainerTemplate } from '../../types/database.types';
import { saveTrainerTemplate, getTrainerTemplates } from '../../lib/trainerTemplates';

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainerId: string;
  trainingDays: TrainingDay[];
  weeklyTargets?: Record<string, number>;
  globalVariables?: GlobalVariable[];
  periodizationConfig?: Partial<PeriodizationConfig>;
  onSaveSuccess: (template: TrainerTemplate) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const SaveTemplateModal: React.FC<SaveTemplateModalProps> = ({
  isOpen,
  onClose,
  trainerId,
  trainingDays,
  weeklyTargets,
  globalVariables,
  periodizationConfig,
  onSaveSuccess,
  showToast
}) => {
  const [mode, setMode] = useState<'new' | 'overwrite'>('new');
  const [existingTemplates, setExistingTemplates] = useState<TrainerTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  
  const [nombre, setNombre] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [objetivo, setObjetivo] = useState<'hipertrofia' | 'fuerza' | 'perdida_grasa' | 'mantenimiento' | 'salud'>('hipertrofia');
  const [nivelAtleta, setNivelAtleta] = useState<'principiante' | 'intermedio' | 'avanzado'>('intermedio');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      // Cargar plantillas existentes para permitir sobrescribir
      getTrainerTemplates(trainerId).then(list => {
        setExistingTemplates(list);
        if (list.length > 0 && mode === 'overwrite') {
          setSelectedTemplateId(list[0].id);
          populateFormWithTemplate(list[0]);
        }
      });
    }
  }, [isOpen, trainerId, mode]);

  if (!isOpen) return null;

  const populateFormWithTemplate = (tpl: TrainerTemplate) => {
    setNombre(tpl.nombre);
    setDescripcion(tpl.descripcion || '');
    setObjetivo(tpl.objetivo);
    setNivelAtleta(tpl.nivel_atleta);
  };

  const handleSelectTemplateToOverwrite = (id: string) => {
    setSelectedTemplateId(id);
    const found = existingTemplates.find(t => t.id === id);
    if (found) {
      populateFormWithTemplate(found);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      if (showToast) showToast('Por favor escribe un nombre para la plantilla.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const templateIdToUse = mode === 'overwrite' ? selectedTemplateId : undefined;
      const saved = await saveTrainerTemplate({
        id: templateIdToUse,
        trainer_id: trainerId || 'default',
        nombre,
        descripcion,
        objetivo,
        nivel_atleta: nivelAtleta,
        dias_semana: trainingDays.length || 4,
        trainingDays,
        weeklyTargets,
        globalVariables,
        periodizationConfig
      });

      if (showToast) {
        showToast(
          mode === 'overwrite'
            ? `✅ Plantilla "${saved.nombre}" actualizada correctamente.`
            : `✅ Plantilla "${saved.nombre}" guardada en tus plantillas.`,
          'success'
        );
      }

      onSaveSuccess(saved);
      onClose();
    } catch (err) {
      console.error('[SaveTemplateModal] Error al guardar plantilla:', err);
      const mensaje = err instanceof Error && err.message
        ? err.message
        : 'No se pudo guardar la plantilla. Intenta de nuevo.';
      if (showToast) showToast(mensaje, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5, 8, 16, 0.85)', backdropFilter: 'blur(12px)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        background: '#0a0f1d', border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '20px', width: '100%', maxWidth: '550px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 28px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)'
        }}>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>💾</span> Guardar como Plantilla Reutilizable
            </h3>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
              Guarda este plan conservando ejercicios, multimedia y series para otros clientes.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: '#64748b', fontSize: '1.5rem',
              cursor: 'pointer', padding: '4px', lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} style={{ padding: '24px 28px' }}>
          {/* Mode Selector */}
          {existingTemplates.length > 0 && (
            <div style={{
              display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '12px',
              padding: '4px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.06)'
            }}>
              <button
                type="button"
                onClick={() => setMode('new')}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '8px', border: 'none',
                  fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  background: mode === 'new' ? 'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)' : 'transparent',
                  color: mode === 'new' ? '#04070e' : '#94a3b8'
                }}
              >
                ➕ Crear Nueva Plantilla
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('overwrite');
                  if (existingTemplates.length > 0) {
                    setSelectedTemplateId(existingTemplates[0].id);
                    populateFormWithTemplate(existingTemplates[0]);
                  }
                }}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '8px', border: 'none',
                  fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  background: mode === 'overwrite' ? 'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)' : 'transparent',
                  color: mode === 'overwrite' ? '#04070e' : '#94a3b8'
                }}
              >
                🔄 Sobrescribir Existente
              </button>
            </div>
          )}

          {/* Overwrite Selector */}
          {mode === 'overwrite' && existingTemplates.length > 0 && (
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Selecciona la plantilla a actualizar:
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplateToOverwrite(e.target.value)}
                style={{
                  width: '100%', background: '#131b2e', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '0.9rem', outline: 'none'
                }}
              >
                {existingTemplates.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.nombre} ({tpl.dias_semana} días • {tpl.objetivo.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Nombre */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Nombre de la Plantilla <span style={{ color: '#00F2FE' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Torso / Pierna Frecuencia 2 (Hipertrofia)"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              style={{
                width: '100%', background: '#131b2e', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '0.9rem', outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Descripción / Notas */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Notas del Entrenador (Opcional)
            </label>
            <textarea
              placeholder="Escribe recomendaciones, enfoque metodológico o para qué tipo de cliente aplica..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              style={{
                width: '100%', background: '#131b2e', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '0.85rem', outline: 'none',
                resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Objetivo y Nivel */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Objetivo Principal
              </label>
              <select
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value as any)}
                style={{
                  width: '100%', background: '#131b2e', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '0.85rem', outline: 'none'
                }}
              >
                <option value="hipertrofia">🔥 Hipertrofia</option>
                <option value="fuerza">⚡ Fuerza Máxima</option>
                <option value="perdida_grasa">✂️ Pérdida de Grasa</option>
                <option value="mantenimiento">⚖️ Mantenimiento</option>
                <option value="salud">🩺 Salud General</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Nivel Recomendado
              </label>
              <select
                value={nivelAtleta}
                onChange={(e) => setNivelAtleta(e.target.value as any)}
                style={{
                  width: '100%', background: '#131b2e', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '0.85rem', outline: 'none'
                }}
              >
                <option value="principiante">🌱 Principiante</option>
                <option value="intermedio">🚀 Intermedio</option>
                <option value="avanzado">🏆 Avanzado</option>
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8', padding: '10px 18px', borderRadius: '10px', fontSize: '0.85rem',
                fontWeight: 600, cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                background: 'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)',
                border: 'none', color: '#04070e', padding: '10px 22px', borderRadius: '10px',
                fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              {isSaving ? 'Guardando...' : (mode === 'overwrite' ? '🔄 Actualizar Plantilla' : '💾 Guardar Plantilla')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
