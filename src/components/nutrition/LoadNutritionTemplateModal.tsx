import React, { useState, useEffect } from 'react';
import { NutritionTemplate } from '../../types/nutrition.types';
import { getNutritionTemplates, deleteNutritionTemplate } from '../../lib/nutritionTemplates';

interface LoadNutritionTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainerId: string;
  onSelectTemplate: (template: NutritionTemplate) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const LoadNutritionTemplateModal: React.FC<LoadNutritionTemplateModalProps> = ({
  isOpen,
  onClose,
  trainerId,
  onSelectTemplate,
  showToast,
}) => {
  const [templates, setTemplates] = useState<NutritionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<NutritionTemplate | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getNutritionTemplates(trainerId)
        .then((list) => {
          setTemplates(list);
          if (list.length > 0) setSelectedTemplate(list[0]);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, trainerId]);

  if (!isOpen) return null;

  const handleDelete = async (tId: string, tNombre: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar la plantilla de dieta "${tNombre}"?`)) return;
    await deleteNutritionTemplate(tId, trainerId);
    setTemplates((prev) => prev.filter((t) => t.id !== tId));
    if (selectedTemplate?.id === tId) {
      setSelectedTemplate(null);
    }
    showToast?.('Plantilla eliminada.', 'info');
  };

  const handleApply = (template: NutritionTemplate) => {
    onSelectTemplate(template);
    showToast?.(`✅ Dieta cargada desde plantilla "${template.nombre}". Es 100% editable.`, 'success');
    onClose();
  };

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- modal backdrop
    <div
      className="nutrition-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 15, 0.85)',
        backdropFilter: 'none',
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
          background: '#1a211e',
          border: '1px solid rgba(145, 182, 161, 0.3)',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'none',
          color: '#ffffff',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontFamily: "'Inter', sans-serif", color: '#91b6a1' }}>
              📂 CARGAR PLANTILLA DE DIETA
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#a4b0a8' }}>
              Selecciona una plantilla guardada para aplicarla a este atleta. Podrás editarla completamente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#a4b0a8', fontSize: '20px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#a4b0a8', fontSize: '12px' }}>
              Cargando plantillas de dieta...
            </div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#a4b0a8', fontSize: '13px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
              <div>No tienes plantillas de dieta guardadas todavía.</div>
              <div style={{ fontSize: '12px', marginTop: '6px', color: '#a4b0a8' }}>
                Puedes guardar cualquier plan nutricional actual haciendo clic en <strong>"💾 Guardar Plantilla"</strong> en la cabecera.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {templates.map((tpl) => {
                const isSelected = selectedTemplate?.id === tpl.id;
                const days = tpl.datos_plan?.days || {};
                const firstDayKey = Object.keys(days)[0];
                const sampleMeals = days[firstDayKey as any]?.meals || [];

                return (
                  <div
                    key={tpl.id}
                    role="button"
                    tabIndex={0}
                    style={{
                      background: isSelected ? 'rgba(145, 182, 161, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      border: isSelected ? '1px solid #91b6a1' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => setSelectedTemplate(tpl)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedTemplate(tpl);
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: isSelected ? '#91b6a1' : '#ffffff' }}>
                            {tpl.nombre}
                          </span>
                          {tpl.objetivo && (
                            <span
                              style={{
                                fontSize: '12px',
                                background: 'rgba(145, 182, 161, 0.15)',
                                color: '#91b6a1',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              {tpl.objetivo}
                            </span>
                          )}
                        </div>
                        {tpl.descripcion && (
                          <div style={{ fontSize: '12px', color: '#a4b0a8', marginTop: '4px' }}>
                            {tpl.descripcion}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(tpl.id, tpl.nombre);
                          }}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                          title="Eliminar plantilla"
                        >
                          🗑️
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApply(tpl);
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #91b6a1 0%, #0099ff 100%)',
                            border: 'none',
                            color: '#000',
                            borderRadius: '6px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          CARGAR PLAN ➔
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: '10px',
                        paddingTop: '8px',
                        borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px',
                        color: 'rgba(255, 255, 255, 0.7)',
                        flexWrap: 'wrap',
                        gap: '6px',
                      }}
                    >
                      <div>
                        🔥 Meta: <strong style={{ color: '#91b6a1' }}>{tpl.target_calorias || 0} kcal</strong> •{' '}
                        <span style={{ color: '#3b82f6' }}>P: {tpl.target_proteina_g || 0}g</span> |{' '}
                        <span style={{ color: '#10b981' }}>C: {tpl.target_carbohidratos_g || 0}g</span> |{' '}
                        <span style={{ color: '#f59e0b' }}>G: {tpl.target_grasa_g || 0}g</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#a4b0a8' }}>
                        {sampleMeals.length} comidas/día • Estructura semanal completa
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '8px 18px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
