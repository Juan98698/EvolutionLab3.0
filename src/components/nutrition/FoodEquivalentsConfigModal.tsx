import React, { useState, useMemo } from 'react';
import {
  MealFoodItem,
  FoodItem,
  FoodEquivalentOption,
} from '../../types/nutrition.types';
import {
  getDominantMacro,
  normalizeFoodSearchText,
  getGroupedEquivalentsSuggestions,
} from '../../lib/nutritionEngine';
import { BASE_FOOD_CATALOG } from '../../data/foodCatalog';

interface FoodEquivalentsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetFood: MealFoodItem | null;
  equivalents: FoodEquivalentOption[];
  onToggleActive: (index: number) => void;
  onToggleAllActive?: (active: boolean) => void;
  onUpdateQuantity: (index: number, newQty: number) => void;
  onRemoveOption: (index: number) => void;
  onAddCustomOption: (candidate: FoodItem) => void;
  onAddOption?: (option: FoodEquivalentOption) => void;
  onResetToAutomatic: () => void;
  onSave: (foodKey: string, updatedOptions: FoodEquivalentOption[]) => void;
  planFoods?: MealFoodItem[];
  savedEquivalencias?: Record<string, FoodEquivalentOption[]>;
  onSelectFood?: (food: MealFoodItem, prevFoodKey?: string, prevOptions?: FoodEquivalentOption[]) => void;
}

export const FoodEquivalentsConfigModal: React.FC<FoodEquivalentsConfigModalProps> = ({
  isOpen,
  onClose,
  targetFood,
  equivalents,
  onToggleActive,
  onToggleAllActive,
  onUpdateQuantity,
  onRemoveOption,
  onAddCustomOption,
  onAddOption,
  onResetToAutomatic,
  onSave,
  planFoods,
  savedEquivalencias,
  onSelectFood,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const dominantMacro = useMemo(() => {
    return targetFood ? getDominantMacro(targetFood) : 'proteina';
  }, [targetFood]);

  const suggestions = useMemo(() => {
    if (!targetFood) return { strictMatches: [], macroMatches: [] };
    return getGroupedEquivalentsSuggestions(targetFood, BASE_FOOD_CATALOG);
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

  const getExistingOption = (optName: string, optId: string | number) => {
    const norm = normalizeFoodSearchText(optName);
    return equivalents.find(
      (e) => String(e.foodId) === String(optId) || normalizeFoodSearchText(e.nombre) === norm
    );
  };

  const handleAddSuggestedOption = (opt: FoodEquivalentOption) => {
    const norm = normalizeFoodSearchText(opt.nombre);
    const existingIndex = equivalents.findIndex(
      (e) => String(e.foodId) === String(opt.foodId) || normalizeFoodSearchText(e.nombre) === norm
    );
    // Si ya existe en la lista, asegurar que quede activado
    if (existingIndex >= 0) {
      if (equivalents[existingIndex].activo === false) {
        onToggleActive(existingIndex);
      }
      return;
    }

    if (onAddOption) {
      onAddOption(opt);
    } else {
      const candidateItem = BASE_FOOD_CATALOG.find(
        (f) =>
          String(f.id) === String(opt.foodId) ||
          normalizeFoodSearchText(f.nombre) === norm
      );
      if (candidateItem) {
        onAddCustomOption(candidateItem);
      }
    }
  };

  const handleAddAllStrictSuggestions = () => {
    suggestions.strictMatches.forEach((s) => {
      handleAddSuggestedOption(s);
    });
  };

  const handleActivateAll = () => {
    if (equivalents.length > 0) {
      if (onToggleAllActive) {
        onToggleAllActive(true);
      } else {
        equivalents.forEach((opt, idx) => {
          if (opt.activo === false) onToggleActive(idx);
        });
      }
    } else {
      handleAddAllStrictSuggestions();
    }
  };

  const handleDeactivateAll = () => {
    if (onToggleAllActive) {
      onToggleAllActive(false);
    } else {
      equivalents.forEach((opt, idx) => {
        if (opt.activo !== false) onToggleActive(idx);
      });
    }
  };

  const handleSelectCandidate = (candidate: FoodItem) => {
    onAddCustomOption(candidate);
    setSearchQuery('');
  };

  const handleSaveClick = () => {
    onSave(normalizeFoodSearchText(targetFood.nombre), equivalents);
    onClose();
  };

  const handleFoodChipClick = (food: MealFoodItem) => {
    if (!targetFood || food.nombre === targetFood.nombre) return;
    const currentKey = normalizeFoodSearchText(targetFood.nombre);
    onSave(currentKey, equivalents);
    if (onSelectFood) {
      onSelectFood(food, currentKey, equivalents);
    }
  };

  const activeOptionsCount = equivalents.filter((opt) => opt.activo !== false).length;
  const hasActiveOptions = activeOptionsCount > 0;

  const getMacroIcon = (macro: string) => {
    if (macro === 'proteina') return '🥩';
    if (macro === 'carbohidratos') return '🍚';
    return '🥑';
  };

  return (
    <div
      className="food-equiv-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="food-equiv-modal-window"
        style={{
          backgroundColor: '#0d1322',
          border: '1px solid rgba(0, 212, 255, 0.35)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '740px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
          color: '#ffffff',
          fontFamily: "'Inter', sans-serif",
          overflow: 'hidden',
        }}
      >
        {/* CABECERA */}
        <div
          style={{
            padding: '18px 24px 14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'linear-gradient(180deg, rgba(0, 212, 255, 0.1) 0%, transparent 100%)',
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
                    letterSpacing: '0.5px',
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
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  Dominante: {dominantMacro}
                </span>
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#fff' }}>
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
              gap: '12px',
              marginTop: '10px',
              flexWrap: 'wrap',
              fontSize: '12px',
            }}
          >
            <span style={{ color: '#fff', fontWeight: 700 }}>🔥 {targetFood.calorias} kcal</span>
            <span style={{ color: '#3b82f6', fontWeight: 600 }}>🥩 P: {targetFood.proteina}g</span>
            <span style={{ color: '#10b981', fontWeight: 600 }}>🍚 C: {targetFood.carbohidratos}g</span>
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>🥑 G: {targetFood.grasa}g</span>
          </div>
        </div>

        {/* SELECTOR RÁPIDO DE ALIMENTOS DEL PLAN (SI HAY MÁS DE 1) */}
        {planFoods && planFoods.length > 1 && (
          <div
            style={{
              padding: '10px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(0, 0, 0, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
            }}
          >
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap' }}>
              Alimentos en tu plan:
            </span>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
              {planFoods.map((food, fIdx) => {
                const fKey = normalizeFoodSearchText(food.nombre);
                const isSelected = targetFood && normalizeFoodSearchText(targetFood.nombre) === fKey;
                const foodMacro = getDominantMacro(food);
                const configured = savedEquivalencias?.[fKey];
                const activeCount = isSelected
                  ? activeOptionsCount
                  : Array.isArray(configured)
                    ? configured.filter((c) => c.activo !== false).length
                    : 0;

                return (
                  <button
                    key={`${food.nombre}-${fIdx}`}
                    type="button"
                    onClick={() => handleFoodChipClick(food)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: isSelected ? 700 : 500,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      border: isSelected
                        ? '1px solid #00d4ff'
                        : '1px solid rgba(255, 255, 255, 0.12)',
                      background: isSelected
                        ? 'rgba(0, 212, 255, 0.2)'
                        : 'rgba(255, 255, 255, 0.04)',
                      color: isSelected ? '#00d4ff' : 'rgba(255, 255, 255, 0.8)',
                    }}
                  >
                    <span>{getMacroIcon(foodMacro)}</span>
                    <span>{food.nombre}</span>
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '1px 5px',
                        borderRadius: '10px',
                        background: activeCount > 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                        color: activeCount > 0 ? '#10b981' : 'rgba(255, 255, 255, 0.4)',
                        fontWeight: 700,
                      }}
                    >
                      {activeCount > 0 ? `✓ ${activeCount}` : '0'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* CONTENIDO SCROLLABLE */}
        <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* BANNER DE ESTADO EN PDF */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: hasActiveOptions ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)',
              border: hasActiveOptions ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: hasActiveOptions ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{hasActiveOptions ? '✅' : '⚪'}</span>
                <span>
                  {hasActiveOptions
                    ? `Habilitado en el PDF (${activeOptionsCount} ${activeOptionsCount === 1 ? 'opción de reemplazo' : 'opciones de reemplazo'})`
                    : 'Deshabilitado en el PDF (no generará ruido en el documento)'}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                {hasActiveOptions
                  ? 'Este alimento se imprimirá en la Guía de Intercambios del PDF con las opciones marcadas.'
                  : 'Solo los alimentos donde apruebes reemplazos aparecerán en el PDF generado.'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {hasActiveOptions ? (
                <button
                  type="button"
                  onClick={handleDeactivateAll}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#f87171',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Desmarcar todas las opciones para este alimento"
                >
                  🚫 Desactivar todos en PDF
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleActivateAll}
                  style={{
                    background: 'rgba(0, 212, 255, 0.15)',
                    border: '1px solid rgba(0, 212, 255, 0.4)',
                    color: '#00d4ff',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Activar todas las opciones para este alimento en el PDF"
                >
                  ⚡ {equivalents.length > 0 ? 'Activar todos en PDF' : 'Añadir sugerencias recomendadas'}
                </button>
              )}
            </div>
          </div>

          {/* SECCIÓN 1: OPCIONES CONFIGURADAS PARA EL PDF */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.9)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📋 Opciones Aprobadas para el PDF ({activeOptionsCount})
              </div>
              {equivalents.length > 0 && (
                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                  {activeOptionsCount === equivalents.length
                    ? `${activeOptionsCount} de ${equivalents.length} activas`
                    : `${activeOptionsCount} de ${equivalents.length} activas (${equivalents.length - activeOptionsCount} deshabilitadas)`}
                </div>
              )}
            </div>

            {equivalents.length === 0 ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.45)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  border: '1px dashed rgba(255, 255, 255, 0.1)',
                }}
              >
                No hay opciones agregadas para este alimento. Usa las sugerencias de abajo o el buscador para añadir opciones de reemplazo.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {equivalents.map((opt, idx) => {
                  const delta = opt.deltaCaloriasPct || 0;
                  return (
                    <div
                      key={`${opt.foodId}-${idx}`}
                      className="food-equiv-card"
                      style={{
                        borderRadius: '8px',
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
                      {/* EN MÓVIL: FILA 1 CON CHECKBOX, NOMBRE Y BASURA */}
                      <div className="food-equiv-card-row1">
                        {/* CHECKBOX */}
                        <input
                          type="checkbox"
                          checked={opt.activo}
                          onChange={() => onToggleActive(idx)}
                          style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: '#00d4ff', flexShrink: 0 }}
                          title="Activar / Desactivar en el PDF"
                        />

                        {/* NOMBRE Y GRUPO */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

                        {/* BOTÓN ELIMINAR EN MÓVIL */}
                        <button
                          type="button"
                          className="food-equiv-delete-mobile"
                          onClick={() => onRemoveOption(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'rgba(239, 68, 68, 0.7)',
                            fontSize: '14px',
                            cursor: 'pointer',
                            padding: '4px',
                            flexShrink: 0,
                          }}
                          title="Quitar opción"
                        >
                          🗑️
                        </button>
                      </div>

                      {/* EN MÓVIL: FILA 2 CON CANTIDAD EDITABLE, MACROS Y BASURA DESKTOP */}
                      <div className="food-equiv-card-row2">
                        {/* CANTIDAD EDITABLE */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <input
                            type="number"
                            min="1"
                            value={opt.cantidad}
                            onChange={(e) => onUpdateQuantity(idx, Number(e.target.value) || 0)}
                            style={{
                              width: '58px',
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
                        <div style={{ textAlign: 'right', minWidth: '115px', flex: 1 }}>
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
                                  Math.abs(delta) <= 10
                                    ? 'rgba(16, 185, 129, 0.2)'
                                    : 'rgba(245, 158, 11, 0.2)',
                                color: Math.abs(delta) <= 10 ? '#10b981' : '#f59e0b',
                                border: `1px solid ${
                                  Math.abs(delta) <= 10
                                    ? 'rgba(16, 185, 129, 0.4)'
                                    : 'rgba(245, 158, 11, 0.4)'
                                }`,
                              }}
                            >
                              {delta > 0 ? `+${delta}% kcal` : `${delta}% kcal`}
                            </span>
                          </div>
                        </div>

                        {/* BOTÓN ELIMINAR EN DESKTOP */}
                        <button
                          type="button"
                          className="food-equiv-delete-desktop"
                          onClick={() => onRemoveOption(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'rgba(239, 68, 68, 0.7)',
                            fontSize: '14px',
                            cursor: 'pointer',
                            padding: '4px',
                            flexShrink: 0,
                          }}
                          title="Quitar opción"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECCIÓN 2: SUGERENCIAS INTELIGENTES ORGANIZADAS EN 2 NIVELES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* NIVEL 1: TOLERANCIA ESTRICTA (±10% KCAL) */}
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.04)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '10px',
                padding: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🎯</span>
                    <span>NIVEL 1: EQUIVALENTES CALÓRICOS RECOMENDADOS (±10% kcal)</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                    Igualan el aporte de {dominantMacro} manteniendo intactas las calorías objetivo del día.
                  </div>
                </div>
              </div>

              {suggestions.strictMatches.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic', padding: '6px 0' }}>
                  No se encontraron alimentos en el catálogo con diferencia menor al ±10%.
                </div>
              ) : (
                <div className="food-equiv-grid-suggestions" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px', marginTop: '6px' }}>
                  {suggestions.strictMatches.map((cand, cIdx) => {
                    const existing = getExistingOption(cand.nombre, cand.foodId);
                    const isInList = !!existing;
                    const isActive = existing ? existing.activo !== false : false;
                    return (
                      <div
                        key={`strict-${cand.foodId}-${cIdx}`}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: isInList
                            ? isActive
                              ? '1px solid rgba(16, 185, 129, 0.4)'
                              : '1px dashed rgba(255, 255, 255, 0.2)'
                            : '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cand.nombre}
                          </div>
                          <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px' }}>
                            <strong>{cand.cantidad} {cand.unidad}</strong> • {cand.calorias} kcal ({cand.deltaCaloriasPct > 0 ? `+${cand.deltaCaloriasPct}%` : `${cand.deltaCaloriasPct}%`})
                          </div>
                        </div>

                        {isInList && isActive ? (
                          <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 700, padding: '3px 8px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '4px' }}>
                            ✓ En lista
                          </span>
                        ) : isInList && !isActive ? (
                          <button
                            type="button"
                            onClick={() => handleAddSuggestedOption(cand)}
                            style={{
                              background: 'rgba(0, 212, 255, 0.15)',
                              border: '1px solid rgba(0, 212, 255, 0.5)',
                              color: '#00d4ff',
                              borderRadius: '5px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                            title="Volver a activar para el PDF"
                          >
                            + Habilitar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddSuggestedOption(cand)}
                            style={{
                              background: '#00d4ff',
                              border: 'none',
                              color: '#000000',
                              borderRadius: '5px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            + Añadir
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* NIVEL 2: OTRAS FUENTES DEL MACRO (CALORÍAS VARIABLES) */}
            {suggestions.macroMatches.length > 0 && (
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.04)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: '10px',
                  padding: '14px',
                }}
              >
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>⚡</span>
                    <span>NIVEL 2: OTRAS FUENTES DE {dominantMacro.toUpperCase()} (Criterio del Entrenador)</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                    Alimentos que igualan la porción de {dominantMacro} pero cuyas calorías varían (&gt;10%). Útiles para dar variedad cuando el balance calórico global lo permita.
                  </div>
                </div>

                <div className="food-equiv-grid-suggestions" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px', marginTop: '6px' }}>
                  {suggestions.macroMatches.map((cand, cIdx) => {
                    const existing = getExistingOption(cand.nombre, cand.foodId);
                    const isInList = !!existing;
                    const isActive = existing ? existing.activo !== false : false;
                    const delta = cand.deltaCaloriasPct || 0;
                    return (
                      <div
                        key={`macro-${cand.foodId}-${cIdx}`}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: isInList
                            ? isActive
                              ? '1px solid rgba(245, 158, 11, 0.4)'
                              : '1px dashed rgba(255, 255, 255, 0.2)'
                            : '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cand.nombre}
                          </div>
                          <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px' }}>
                            <strong>{cand.cantidad} {cand.unidad}</strong> • {cand.calorias} kcal{' '}
                            <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                              ({delta > 0 ? `+${delta}%` : `${delta}%`} kcal)
                            </span>
                          </div>
                        </div>

                        {isInList && isActive ? (
                          <span style={{ fontSize: '10px', color: '#fbbf24', fontWeight: 700, padding: '3px 8px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '4px' }}>
                            ✓ En lista
                          </span>
                        ) : isInList && !isActive ? (
                          <button
                            type="button"
                            onClick={() => handleAddSuggestedOption(cand)}
                            style={{
                              background: 'rgba(245, 158, 11, 0.2)',
                              border: '1px solid rgba(245, 158, 11, 0.5)',
                              color: '#fbbf24',
                              borderRadius: '5px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                            title="Volver a activar para el PDF"
                          >
                            + Habilitar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddSuggestedOption(cand)}
                            style={{
                              background: 'rgba(245, 158, 11, 0.2)',
                              border: '1px solid rgba(245, 158, 11, 0.5)',
                              color: '#fbbf24',
                              borderRadius: '5px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            + Añadir
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* BUSCADOR PARA AÑADIR ALTERNATIVA PERSONALIZADA DEL CATÁLOGO */}
          <div
            style={{
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
              + Buscar cualquier otro alimento del catálogo:
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre (ej: Tilapia, Avena, Tofu, Salmón, Batata)..."
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
          className="food-equiv-modal-footer"
          style={{
            padding: '14px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            background: 'rgba(0, 0, 0, 0.3)',
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
