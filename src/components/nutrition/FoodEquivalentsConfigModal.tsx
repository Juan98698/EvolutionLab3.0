import React, { useState, useMemo } from 'react';
import {
  MealFoodItem,
  FoodItem,
  FoodEquivalentOption,
} from '../../types/nutrition.types';
import {
  getDominantMacro,
  normalizeFoodSearchText,
} from '../../lib/nutritionEngine';
import { BASE_FOOD_CATALOG } from '../../data/foodCatalog';

interface FoodEquivalentsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetFood: MealFoodItem | null;
  equivalents: FoodEquivalentOption[];
  onToggleActive: (index: number) => void;
  onUpdateQuantity: (index: number, newQty: number) => void;
  onRemoveOption: (index: number) => void;
  onAddCustomOption: (candidate: FoodItem) => void;
  onResetToAutomatic: () => void;
  onSave: (foodKey: string, updatedOptions: FoodEquivalentOption[]) => void;
}

export const FoodEquivalentsConfigModal: React.FC<FoodEquivalentsConfigModalProps> = ({
  isOpen,
  onClose,
  targetFood,
  equivalents,
  onToggleActive,
  onUpdateQuantity,
  onRemoveOption,
  onAddCustomOption,
  onResetToAutomatic,
  onSave,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const dominantMacro = useMemo(() => {
    return targetFood ? getDominantMacro(targetFood) : 'proteina';
  }, [targetFood]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !targetFood) return [];
    const queryNorm = normalizeFoodSearchText(searchQuery);
    const targetNorm = normalizeFoodSearchText(targetFood.nombre);

    return BASE_FOOD_CATALOG.filter((item) => {
      const itemNorm = normalizeFoodSearchText(item.nombre);
      if (itemNorm === targetNorm) return false;
      return itemNorm.includes(queryNorm);
    }).slice(0, 8);
  }, [searchQuery, targetFood]);

  if (!isOpen || !targetFood) return null;

  const handleSelectCandidate = (candidate: FoodItem) => {
    onAddCustomOption(candidate);
    setSearchQuery('');
  };

  const handleSaveClick = () => {
    onSave(normalizeFoodSearchText(targetFood.nombre), equivalents);
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
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          color: '#ffffff',
          fontFamily: "'Inter', sans-serif",
          overflow: 'hidden',
        }}
      >
        {/* CABECERA */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'linear-gradient(180deg, rgba(0, 212, 255, 0.08) 0%, transparent 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 800,
                    background: '#00d4ff',
                    color: '#000',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  🔄 EQUIVALENTES & SUSTITUCIONES
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    color: '#00d4ff',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    background: 'rgba(0, 212, 255, 0.1)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  Dominante: {dominantMacro}
                </span>
              </div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#fff' }}>
                {targetFood.nombre} ({targetFood.cantidad} {targetFood.unidad})
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '22px',
                cursor: 'pointer',
                padding: '4px',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          {/* METAS DEL ALIMENTO ORIGINAL */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              marginTop: '12px',
              flexWrap: 'wrap',
              fontSize: '12px',
            }}
          >
            <span style={{ color: '#fff', fontWeight: 700 }}>🔥 {targetFood.calorias} kcal</span>
            <span style={{ color: '#3b82f6', fontWeight: 600 }}>🥩 P: {targetFood.proteina}g</span>
            <span style={{ color: '#10b981', fontWeight: 600 }}>🍚 C: {targetFood.carbohidratos}g</span>
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>🥑 G: {targetFood.grasa}g</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginLeft: 'auto' }}>
              Filtro estricto: ±10% calorías
            </span>
          </div>
        </div>

        {/* LISTADO DE ALTERNATIVAS */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <div
            style={{
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '12px',
              lineHeight: 1.5,
            }}
          >
            Las siguientes opciones igualan el aporte de <strong>{dominantMacro}</strong>. Puedes
            activar o desactivar las alternativas que el atleta podrá usar y que aparecerán en el PDF:
          </div>

          {equivalents.length === 0 ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.5)',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px',
                fontSize: '13px',
              }}
            >
              No hay alternativas automáticas que cumplan el filtro de ±10% de calorías. Usa el
              buscador abajo para añadir opciones personalizadas.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {equivalents.map((opt, idx) => {
                const delta = opt.deltaCaloriasPct || 0;
                return (
                  <div
                    key={`${opt.foodId}-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: opt.activo
                        ? 'rgba(255, 255, 255, 0.04)'
                        : 'rgba(255, 255, 255, 0.01)',
                      border: opt.activo
                        ? '1px solid rgba(0, 212, 255, 0.25)'
                        : '1px dashed rgba(255, 255, 255, 0.1)',
                      opacity: opt.activo ? 1 : 0.45,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {/* CHECKBOX DE ACTIVACIÓN */}
                    <input
                      type="checkbox"
                      checked={opt.activo}
                      onChange={() => onToggleActive(idx)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      title="Activar / Desactivar esta alternativa"
                    />

                    {/* NOMBRE Y GRUPO */}
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                        {opt.nombre}
                      </div>
                      <div
                        style={{
                          fontSize: '10px',
                          color: 'rgba(255, 255, 255, 0.4)',
                          marginTop: '2px',
                        }}
                      >
                        {opt.grupo}
                      </div>
                    </div>

                    {/* CANTIDAD EDITABLE */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        min="1"
                        value={opt.cantidad}
                        onChange={(e) => onUpdateQuantity(idx, Number(e.target.value) || 0)}
                        style={{
                          width: '60px',
                          background: 'rgba(0, 0, 0, 0.4)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '6px',
                          color: '#00d4ff',
                          padding: '4px 6px',
                          fontSize: '12px',
                          textAlign: 'center',
                          fontWeight: 700,
                        }}
                      />
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                        {opt.unidad}
                      </span>
                    </div>

                    {/* MACROS & DELTA */}
                    <div style={{ textAlign: 'right', minWidth: '110px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>
                        {opt.calorias} kcal
                      </div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>
                        P: {opt.proteina}g • C: {opt.carbohidratos}g • G: {opt.grasa}g
                      </div>
                      <div style={{ marginTop: '2px' }}>
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
                            border: `1px solid ${
                              Math.abs(delta) <= 5
                                ? 'rgba(16, 185, 129, 0.4)'
                                : 'rgba(245, 158, 11, 0.4)'
                            }`,
                          }}
                        >
                          {delta > 0 ? `+${delta}% kcal` : `${delta}% kcal`}
                        </span>
                      </div>
                    </div>

                    {/* BOTÓN ELIMINAR */}
                    <button
                      type="button"
                      onClick={() => onRemoveOption(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(239, 68, 68, 0.7)',
                        fontSize: '14px',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      title="Quitar opción"
                    >
                      🗑️
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* BUSCADOR PARA AÑADIR ALTERNATIVA PERSONALIZADA */}
          <div
            style={{
              marginTop: '20px',
              padding: '14px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.8)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              + Añadir sustituto personalizado del catálogo:
            </div>
            <input
              type="text"
              placeholder="Buscar alimento (ej: Tilapia, Avena, Tofu, Salmón)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                color: '#fff',
                padding: '8px 12px',
                fontSize: '12px',
                boxSizing: 'border-box',
              }}
            />

            {searchResults.length > 0 && (
              <div
                style={{
                  marginTop: '8px',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectCandidate(item)}
                    style={{
                      textAlign: 'left',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      color: '#fff',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>
                      <strong>{item.nombre}</strong>{' '}
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                        ({item.grupo})
                      </span>
                    </span>
                    <span style={{ color: '#00d4ff', fontWeight: 600, fontSize: '11px' }}>
                      + Calcular & Añadir
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PIE DE ACCIONES */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <button
            type="button"
            onClick={onResetToAutomatic}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: 'rgba(255, 255, 255, 0.7)',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ↺ Restaurar sugeridos
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveClick}
              style={{
                background: '#00d4ff',
                border: 'none',
                borderRadius: '8px',
                color: '#000000',
                padding: '8px 20px',
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: "'Orbitron', sans-serif",
                cursor: 'pointer',
              }}
            >
              💾 Guardar para este Alimento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoodEquivalentsConfigModal;
