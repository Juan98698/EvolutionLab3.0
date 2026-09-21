import React, { useState } from 'react';
import { NutritionPlan, NutritionTemplate } from '../../types/nutrition.types';
import { saveNutritionTemplate } from '../../lib/nutritionTemplates';

interface SaveNutritionTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainerId: string;
  currentPlan: NutritionPlan;
  onSaveSuccess: (template: NutritionTemplate) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const SaveNutritionTemplateModal: React.FC<SaveNutritionTemplateModalProps> = ({
  isOpen,
  onClose,
  trainerId,
  currentPlan,
  onSaveSuccess,
  showToast,
}) => {
  const [nombre, setNombre] = useState(currentPlan.nombre || 'Plantilla de Dieta Estándar');
  const [descripcion, setDescripcion] = useState('');
  const [objetivo, setObjetivo] = useState(currentPlan.objetivo || 'Mantenimiento');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      showToast?.('Por favor ingresa un nombre para la plantilla.', 'error');
      return;
    }

    setSaving(true);
    try {
      const saved = await saveNutritionTemplate({
        entrenador_id: trainerId || 'default',
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        objetivo: objetivo || null,
        target_calorias: currentPlan.target_calorias,
        target_proteina_g: currentPlan.target_proteina_g,
        target_carbohidratos_g: currentPlan.target_carbohidratos_g,
        target_grasa_g: currentPlan.target_grasa_g,
        datos_plan: currentPlan.datos_plan,
      });

      showToast?.(`✅ Plantilla de dieta "${saved.nombre}" guardada con éxito.`, 'success');
      onSaveSuccess(saved);
      onClose();
    } catch (err: any) {
      showToast?.('Error al guardar plantilla: ' + (err.message || err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- modal backdrop
    <div
      className="nutrition-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 15, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#0d1322',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '480px',
          padding: '24px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontFamily: "'Orbitron', sans-serif", color: '#00d4ff' }}>
              💾 GUARDAR COMO PLANTILLA DE DIETA
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
              Podrás cargar esta dieta completa en otros atletas y editarla libremente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.8)', marginBottom: '6px' }}>
              Nombre de la Plantilla *
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Definición 2.000 kcal - 4 Comidas"
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '10px 12px',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.8)', marginBottom: '6px' }}>
              Objetivo Nutricional
            </label>
            <input
              type="text"
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              placeholder="Ej. Ganancia Muscular, Pérdida de Grasa, Salud"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '10px 12px',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.8)', marginBottom: '6px' }}>
              Descripción o Indicaciones (Opcional)
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Notas sobre el timing de comidas, suplementación, etc."
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '10px 12px',
                fontSize: '13px',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          <div
            style={{
              padding: '10px 12px',
              background: 'rgba(0, 212, 255, 0.05)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              borderRadius: '8px',
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            🔥 Calorías de la plantilla: <strong style={{ color: '#00d4ff' }}>{currentPlan.target_calorias} kcal</strong> • P: {currentPlan.target_proteina_g}g | C: {currentPlan.target_carbohidratos_g}g | G: {currentPlan.target_grasa_g}g
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: 'linear-gradient(135deg, #00d4ff 0%, #0099ff 100%)',
                border: 'none',
                color: '#000000',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: saving ? 'wait' : 'pointer',
                fontFamily: "'Orbitron', sans-serif",
              }}
            >
              {saving ? 'Guardando...' : '💾 GUARDAR PLANTILLA'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
