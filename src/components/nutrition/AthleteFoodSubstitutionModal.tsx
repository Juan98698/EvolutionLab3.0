import React, { useState, useEffect } from 'react';
import { MealFoodItem, FoodEquivalentOption } from '../../types/nutrition.types';

interface AthleteFoodSubstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalFood: MealFoodItem | null;
  approvedOptions: FoodEquivalentOption[];
  currentSubstitution?: FoodEquivalentOption | null;
  onApplySubstitution: (selectedOption: FoodEquivalentOption) => void;
  onRevertToOriginal: () => void;
}

export const AthleteFoodSubstitutionModal: React.FC<AthleteFoodSubstitutionModalProps> = ({
  isOpen,
  onClose,
  originalFood,
  approvedOptions,
  currentSubstitution,
  onApplySubstitution,
  onRevertToOriginal,
}) => {
  const [selectedFoodId, setSelectedFoodId] = useState<string | number | null>(null);

  useEffect(() => {
    if (currentSubstitution) {
      setSelectedFoodId(currentSubstitution.foodId);
    } else if (approvedOptions.length > 0) {
      setSelectedFoodId(approvedOptions[0].foodId);
    } else {
      setSelectedFoodId(null);
    }
  }, [currentSubstitution, approvedOptions, isOpen]);

  if (!isOpen || !originalFood) return null;

  const handleConfirm = () => {
    const chosen = approvedOptions.find((opt) => opt.foodId === selectedFoodId);
    if (chosen) {
      onApplySubstitution(chosen);
      onClose();
    }
  };

  const handleRevert = () => {
    onRevertToOriginal();
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#0d1322',
          border: '1px solid rgba(0, 212, 255, 0.35)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
          color: '#ffffff',
          fontFamily: "'Inter', sans-serif",
          overflow: 'hidden',
        }}
      >
        {/* CABECERA */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'linear-gradient(180deg, rgba(0, 212, 255, 0.1) 0%, transparent 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: "'Orbitron', sans-serif",
                  fontWeight: 800,
                  background: '#00d4ff',
                  color: '#000',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  display: 'inline-block',
                  marginBottom: '6px',
                }}
              >
                🔄 SUSTITUCIÓN DE ALIMENTO
              </span>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                Reemplazo para hoy
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              ✕
            </button>
          </div>

          {/* ALIMENTO ORIGINAL */}
          <div
            style={{
              marginTop: '12px',
              padding: '10px 12px',
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 600 }}>
              Prescrito por tu entrenador:
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
              🍗 {originalFood.nombre} ({originalFood.cantidad} {originalFood.unidad})
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.7)',
                marginTop: '4px',
                display: 'flex',
                gap: '8px',
              }}
            >
              <span>🔥 {originalFood.calorias} kcal</span>
              <span style={{ color: '#3b82f6' }}>P: {originalFood.proteina}g</span>
              <span style={{ color: '#10b981' }}>C: {originalFood.carbohidratos}g</span>
              <span style={{ color: '#f59e0b' }}>G: {originalFood.grasa}g</span>
            </div>
          </div>
        </div>

        {/* LISTADO DE OPCIONES AUTORIZADAS */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          <div
            style={{
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '10px',
              lineHeight: 1.4,
            }}
          >
            Selecciona la opción que deseas consumir hoy. Las cantidades están calculadas con
            exactitud para cumplir tus metas diarias:
          </div>

          {approvedOptions.length === 0 ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.5)',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            >
              Tu entrenador no ha configurado alternativas para este alimento aún.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {approvedOptions.map((opt) => {
                const isSelected = selectedFoodId === opt.foodId;
                const delta = opt.deltaCaloriasPct || 0;

                return (
                  <button
                    key={opt.foodId}
                    type="button"
                    onClick={() => setSelectedFoodId(opt.foodId)}
                    style={{
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: isSelected
                        ? 'rgba(0, 212, 255, 0.12)'
                        : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected
                        ? '1px solid #00d4ff'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        border: isSelected
                          ? '5px solid #00d4ff'
                          : '2px solid rgba(255, 255, 255, 0.3)',
                        boxSizing: 'border-box',
                        background: '#0d1322',
                      }}
                    />

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                        {opt.cantidad} {opt.unidad} {opt.nombre}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'rgba(255, 255, 255, 0.6)',
                          marginTop: '2px',
                        }}
                      >
                        P: {opt.proteina}g • C: {opt.carbohidratos}g • G: {opt.grasa}g
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#00d4ff' }}>
                        {opt.calorias} kcal
                      </div>
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background:
                            Math.abs(delta) <= 5
                              ? 'rgba(16, 185, 129, 0.2)'
                              : 'rgba(245, 158, 11, 0.2)',
                          color: Math.abs(delta) <= 5 ? '#10b981' : '#f59e0b',
                        }}
                      >
                        {delta === 0 ? '🎯 Exacto' : delta > 0 ? `+${delta}%` : `${delta}%`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* PIE DE ACCIONES */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          {currentSubstitution ? (
            <button
              type="button"
              onClick={handleRevert}
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#ef4444',
                padding: '8px 12px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ↺ Volver al original
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={approvedOptions.length === 0}
              style={{
                background: approvedOptions.length > 0 ? '#00d4ff' : 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '8px',
                color: approvedOptions.length > 0 ? '#000000' : 'rgba(255, 255, 255, 0.5)',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: "'Orbitron', sans-serif",
                cursor: approvedOptions.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              ✅ Usar este reemplazo hoy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AthleteFoodSubstitutionModal;
