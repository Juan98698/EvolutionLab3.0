import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FoodItem, FoodGroup, MealFoodItem } from '../../types/nutrition.types';
import {
  calculatePortionMacros,
  searchOpenFoodFacts,
  validateAndSanitizeFood,
  saveCustomFood,
  getCustomFoods,
  deleteCustomFood,
} from '../../lib/nutritionEngine';

interface FoodSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealName: string;
  onAddFood: (foodItem: MealFoodItem) => void;
}

export const FoodSelectorModal: React.FC<FoodSelectorModalProps> = ({
  isOpen,
  onClose,
  mealName,
  onAddFood,
}) => {
  const [activeSourceTab, setActiveSourceTab] = useState<'base' | 'openfoodfacts' | 'custom'>('base');
  const [baseCatalog, setBaseCatalog] = useState<FoodItem[]>([]);
  const [customCatalog, setCustomCatalog] = useState<FoodItem[]>([]);
  const [loadingBase, setLoadingBase] = useState<boolean>(false);

  // Filtros
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('Todos');

  // Open Food Facts
  const [offQuery, setOffQuery] = useState<string>('');
  const [offResults, setOffResults] = useState<FoodItem[]>([]);
  const [searchingOff, setSearchingOff] = useState<boolean>(false);
  const [hasSearchedOff, setHasSearchedOff] = useState<boolean>(false);

  // Formulario de alimento personalizado
  const [customNombre, setCustomNombre] = useState<string>('');
  const customGrupo: FoodGroup = 'Mis Alimentos';
  const [customCantidadBase, setCustomCantidadBase] = useState<number>(100);
  const [customUnidad, setCustomUnidad] = useState<string>('gr');
  const [customCalorias, setCustomCalorias] = useState<number | ''>('');
  const [customProteina, setCustomProteina] = useState<number | ''>('');
  const [customCarbos, setCustomCarbos] = useState<number | ''>('');
  const [customGrasa, setCustomGrasa] = useState<number | ''>('');
  const [customWarning, setCustomWarning] = useState<string | null>(null);

  // Alimento seleccionado para agregar con su porción
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [portionAmount, setPortionAmount] = useState<number>(100);

  // Carga diferida (Dynamic import) del catálogo base para no inflar el bundle inicial
  useEffect(() => {
    if (isOpen && baseCatalog.length === 0) {
      setLoadingBase(true);
      import('../../data/foodCatalog')
        .then((mod) => {
          setBaseCatalog(mod.BASE_FOOD_CATALOG);
        })
        .catch((err) => {
          console.error('Error al cargar catálogo de alimentos:', err);
        })
        .finally(() => {
          setLoadingBase(false);
        });

      // Cargar alimentos personalizados (IndexedDB local + Supabase en la nube)
      getCustomFoods().then((customs) => {
        setCustomCatalog(customs);
      });
    }
  }, [isOpen, baseCatalog.length]);

  // Al seleccionar un alimento, inicializar la cantidad con su porción base
  const handleSelectFood = (food: FoodItem) => {
    setSelectedFood(food);
    setPortionAmount(food.cantidadBase || 100);
  };

  // Preview de macros en tiempo real según la porción ingresada
  const portionPreview = useMemo(() => {
    if (!selectedFood) return { calorias: 0, proteina: 0, carbohidratos: 0, grasa: 0 };
    return calculatePortionMacros(selectedFood, portionAmount);
  }, [selectedFood, portionAmount]);

  // Lista combinada de catálogo base + personalizados locales
  const combinedCatalog = useMemo(() => {
    return [...customCatalog, ...baseCatalog];
  }, [customCatalog, baseCatalog]);

  // Categorías y grupos disponibles calculados dinámicamente con sus conteos
  const availableCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    let customCount = 0;

    combinedCatalog.forEach((f) => {
      if (f.esPersonalizado || f.grupo === 'Mis Alimentos' || f.subgrupo?.startsWith('Personalizados')) {
        customCount++;
      } else {
        const key = f.subgrupo || f.grupo || 'Otros';
        counts[key] = (counts[key] || 0) + 1;
      }
    });

    const list: { id: string; label: string; count: number; isCustom?: boolean }[] = [
      { id: 'Todos', label: 'Todos', count: combinedCatalog.length },
      { id: 'Mis Alimentos', label: '⭐ Mis Alimentos', count: customCount, isCustom: true },
    ];

    const subgrupoKeys = Object.keys(counts).sort((a, b) => {
      if (a === 'Base ICBF / USDA') return 1;
      if (b === 'Base ICBF / USDA') return -1;
      return a.localeCompare(b, 'es', { sensitivity: 'base' });
    });

    subgrupoKeys.forEach((sg) => {
      list.push({
        id: sg,
        label: sg,
        count: counts[sg],
      });
    });

    return list;
  }, [combinedCatalog]);

  // Filtrado reactivo del catálogo base
  const filteredBaseFoods = useMemo(() => {
    let result = combinedCatalog;

    if (selectedGroup !== 'Todos') {
      if (selectedGroup === 'Mis Alimentos' || selectedGroup === 'Personalizados') {
        result = result.filter(
          (f) => f.esPersonalizado || f.grupo === 'Mis Alimentos' || f.subgrupo?.startsWith('Personalizados')
        );
      } else {
        result = result.filter(
          (f) => f.subgrupo === selectedGroup || f.grupo === selectedGroup
        );
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (f) =>
          f.nombre.toLowerCase().includes(q) ||
          (f.subgrupo && f.subgrupo.toLowerCase().includes(q)) ||
          (f.marca && f.marca.toLowerCase().includes(q)) ||
          (f.grupo && f.grupo.toLowerCase().includes(q))
      );
    }

    return result.slice(0, 150); // Límite generoso para ver grupos completos
  }, [combinedCatalog, selectedGroup, searchQuery]);

  // Búsqueda en Open Food Facts / Supermercado
  const offDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchOff = useCallback(async (queryOverride?: string) => {
    const term = (queryOverride !== undefined ? queryOverride : offQuery).trim();
    if (term.length < 2) return;

    if (offDebounceRef.current) {
      clearTimeout(offDebounceRef.current);
      offDebounceRef.current = null;
    }

    setSearchingOff(true);
    setHasSearchedOff(true);
    try {
      const items = await searchOpenFoodFacts(term);
      setOffResults(items);
    } finally {
      setSearchingOff(false);
    }
  }, [offQuery]);

  // Debounce automático al escribir (450ms)
  useEffect(() => {
    if (activeSourceTab !== 'openfoodfacts') return;
    const term = offQuery.trim();
    if (term.length < 2) {
      if (term.length === 0) {
        setOffResults([]);
        setHasSearchedOff(false);
      }
      return;
    }

    offDebounceRef.current = setTimeout(() => {
      handleSearchOff(term);
    }, 450);

    return () => {
      if (offDebounceRef.current) {
        clearTimeout(offDebounceRef.current);
      }
    };
  }, [offQuery, activeSourceTab, handleSearchOff]);

  // Guardar alimento personalizado
  const handleSaveCustomFood = async (e: React.FormEvent) => {
    e.preventDefault();
    const { valid, food, warning, error } = validateAndSanitizeFood({
      nombre: customNombre,
      grupo: customGrupo,
      cantidadBase: customCantidadBase,
      unidad: customUnidad,
      caloriasBase: Number(customCalorias) || 0,
      proteinaBase: Number(customProteina) || 0,
      carbohidratosBase: Number(customCarbos) || 0,
      grasaBase: Number(customGrasa) || 0,
      esPersonalizado: true,
      fuente: 'Personalizado',
    });

    if (!valid || !food) {
      alert(error || 'Por favor completa los campos del alimento.');
      return;
    }

    if (warning && !customWarning) {
      setCustomWarning(warning);
      return;
    }

    const savedFood = await saveCustomFood(food);
    setCustomCatalog((prev) => [savedFood, ...prev.filter((f) => f.id !== savedFood.id)]);
    setSelectedFood(savedFood);
    setPortionAmount(savedFood.cantidadBase);
    setActiveSourceTab('base');
    setCustomWarning(null);

    // Reset form
    setCustomNombre('');
    setCustomCalorias('');
    setCustomProteina('');
    setCustomCarbos('');
    setCustomGrasa('');
  };

  // Eliminar alimento personalizado
  const handleDeleteCustomFood = async (foodId: string | number, foodName: string) => {
    if (!window.confirm(`¿Eliminar «${foodName}» de tu catálogo de alimentos personalizados?`)) {
      return;
    }
    await deleteCustomFood(foodId);
    setCustomCatalog((prev) => prev.filter((f) => f.id !== foodId));
    if (selectedFood?.id === foodId) {
      setSelectedFood(null);
    }
  };

  // Confirmar y agregar al plan
  const handleConfirmAdd = () => {
    if (!selectedFood) return;

    const item: MealFoodItem = {
      id: 'item_' + Math.random().toString(36).substring(2, 9),
      foodId: selectedFood.id,
      nombre: selectedFood.nombre,
      grupo: selectedFood.grupo,
      cantidad: Number(portionAmount) || 0,
      cantidadBase: selectedFood.cantidadBase,
      unidad: selectedFood.unidad,
      calorias: portionPreview.calorias,
      proteina: portionPreview.proteina,
      carbohidratos: portionPreview.carbohidratos,
      grasa: portionPreview.grasa,
    };

    onAddFood(item);
    setSelectedFood(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop de modal
    <div
      className="nutrition-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="food-selector-modal-window">
        {/* CABECERA */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0, 212, 255, 0.03)',
          }}
        >
          <div>
            <span style={{ fontSize: '10px', color: '#00d4ff', letterSpacing: '1px', fontWeight: 700, textTransform: 'uppercase' }}>
              AGREGAR ALIMENTO A:
            </span>
            <h3 style={{ margin: '2px 0 0', fontSize: '15px', fontFamily: "'Orbitron', sans-serif", color: '#fff' }}>
              {mealName}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '22px',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '4px',
            }}
            title="Cerrar buscador"
          >
            ✕
          </button>
        </div>

        {/* SELECTOR DE PESTAÑAS DE FUENTE RESPONSIVO */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveSourceTab('base')}
            style={{
              flex: 1,
              padding: '10px 8px',
              background: activeSourceTab === 'base' ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
              border: 'none',
              borderBottom: activeSourceTab === 'base' ? '2px solid #00d4ff' : '2px solid transparent',
              color: activeSourceTab === 'base' ? '#00d4ff' : 'rgba(255, 255, 255, 0.6)',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: "'Orbitron', sans-serif",
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            🏛️ Catálogo ({combinedCatalog.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSourceTab('openfoodfacts')}
            style={{
              flex: 1,
              padding: '10px 8px',
              background: activeSourceTab === 'openfoodfacts' ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
              border: 'none',
              borderBottom: activeSourceTab === 'openfoodfacts' ? '2px solid #00d4ff' : '2px solid transparent',
              color: activeSourceTab === 'openfoodfacts' ? '#00d4ff' : 'rgba(255, 255, 255, 0.6)',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: "'Orbitron', sans-serif",
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            🌐 Supermercado
          </button>
          <button
            type="button"
            onClick={() => setActiveSourceTab('custom')}
            style={{
              flex: 1,
              padding: '10px 8px',
              background: activeSourceTab === 'custom' ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
              border: 'none',
              borderBottom: activeSourceTab === 'custom' ? '2px solid #00d4ff' : '2px solid transparent',
              color: activeSourceTab === 'custom' ? '#00d4ff' : 'rgba(255, 255, 255, 0.6)',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: "'Orbitron', sans-serif",
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            ✍️ Crear
          </button>
        </div>

        {/* CUERPO PRINCIPAL */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', minHeight: '300px' }}>
          {/* PESTAÑA 1: CATÁLOGO BASE */}
          {activeSourceTab === 'base' && (
            <div>
              {/* Buscador de texto y selector rápido de grupo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                <div className="food-selector-search-row" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="🔍 Buscar alimento (ej. pechuga, cerdo, res, avena...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="food-selector-search-input"
                    style={{
                      flex: '1 1 auto',
                      minWidth: '180px',
                      height: '42px',
                      boxSizing: 'border-box',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      padding: '0 14px',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                  {/* Selector desplegable directo de grupos */}
                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    title="Filtrar por categoría o grupo de alimentos"
                    className="food-selector-search-select"
                    style={{
                      flex: '0 0 auto',
                      maxWidth: '100%',
                      background: '#121829',
                      border: '1px solid rgba(0, 212, 255, 0.35)',
                      borderRadius: '8px',
                      color: '#00d4ff',
                      padding: '10px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {availableCategories.map((c) => (
                      <option key={c.id} value={c.id} style={{ background: '#0d1322', color: '#ffffff' }}>
                        {c.label} ({c.count})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro activo / Limpiar filtro rápido */}
                {selectedGroup !== 'Todos' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
                      Grupo activo: <strong style={{ color: '#00d4ff' }}>{selectedGroup}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedGroup('Todos')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Mostrar todos los grupos
                    </button>
                  </div>
                )}
              </div>

              {/* Barra scrolleable con los 46 grupos oficiales + Mis Alimentos + Todos */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  overflowX: 'auto',
                  paddingBottom: '8px',
                  marginBottom: '14px',
                  scrollbarWidth: 'thin',
                }}
              >
                {availableCategories.map((cat) => {
                  const isSelected = selectedGroup === cat.id;
                  const isCustom = cat.id === 'Mis Alimentos';
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedGroup(cat.id)}
                      style={{
                        whiteSpace: 'nowrap',
                        padding: '4px 10px',
                        borderRadius: '16px',
                        fontSize: '11px',
                        border: isSelected
                          ? '1px solid #00d4ff'
                          : isCustom
                          ? '1px solid rgba(0, 212, 255, 0.45)'
                          : '1px solid rgba(255, 255, 255, 0.1)',
                        background: isSelected
                          ? 'rgba(0, 212, 255, 0.25)'
                          : isCustom
                          ? 'rgba(0, 212, 255, 0.1)'
                          : 'rgba(255, 255, 255, 0.03)',
                        color: isSelected
                          ? '#00d4ff'
                          : isCustom
                          ? '#38bdf8'
                          : 'rgba(255, 255, 255, 0.7)',
                        cursor: 'pointer',
                        fontWeight: isSelected || isCustom ? 700 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>{cat.label}</span>
                      <span
                        style={{
                          fontSize: '9px',
                          padding: '0 4px',
                          borderRadius: '8px',
                          background: isSelected ? 'rgba(0, 212, 255, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                          color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.55)',
                        }}
                      >
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Lista de alimentos */}
              {loadingBase ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                  Cargando catálogo oficial...
                </div>
              ) : filteredBaseFoods.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                  No se encontraron alimentos con ese término. Puedes buscar en <strong>Supermercado (Open Food)</strong> o <strong>Crear uno Personalizado</strong>.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredBaseFoods.map((f) => {
                    const isSelected = selectedFood?.id === f.id;
                    return (
                      <div
                        key={f.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectFood(f)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectFood(f);
                          }
                        }}
                        className="food-selector-item-card"
                        style={{
                          background: isSelected ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                          border: isSelected ? '1px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        <div className="food-selector-card-top">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#00d4ff' : '#ffffff' }}>
                              {f.nombre}
                            </span>
                            {f.esPersonalizado && (
                              <span
                                style={{
                                  fontSize: '9px',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: 'rgba(0, 212, 255, 0.15)',
                                  color: '#00d4ff',
                                  border: '1px solid rgba(0, 212, 255, 0.3)',
                                  fontWeight: 700,
                                }}
                                title="Alimento personalizado sincronizado en la nube"
                              >
                                ☁️ Mi Alimento
                              </span>
                            )}
                            {f.subgrupo && !f.esPersonalizado && (
                              <span
                                style={{
                                  fontSize: '9px',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: 'rgba(255, 255, 255, 0.06)',
                                  color: 'rgba(255, 255, 255, 0.6)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                }}
                              >
                                {f.subgrupo}
                              </span>
                            )}
                          </div>
                          {f.esPersonalizado && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCustomFood(f.id, f.nombre);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(239, 68, 68, 0.5)',
                                cursor: 'pointer',
                                padding: '4px',
                                fontSize: '12px',
                                transition: 'color 0.2s',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(239, 68, 68, 0.5)')}
                              title={`Eliminar «${f.nombre}» de mi catálogo`}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                        <div className="food-selector-card-bottom">
                          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                            Base: {f.cantidadBase} {f.unidad} • {f.grupo}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                              {f.caloriasBase} kcal
                            </span>
                            <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px' }}>
                              <span style={{ color: '#3b82f6' }}>P: {f.proteinaBase}g</span> •{' '}
                              <span style={{ color: '#10b981' }}>C: {f.carbohidratosBase}g</span> •{' '}
                              <span style={{ color: '#f59e0b' }}>G: {f.grasaBase}g</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA 2: OPEN FOOD FACTS */}
          {activeSourceTab === 'openfoodfacts' && (
            <div>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: '0 0 12px' }}>
                Busca productos de supermercado en vivo de marcas de Colombia y LatAm (Colanta, Bimbo, Alpina, Tosh, Zenú, etc.):
              </p>
              <div className="food-selector-supermarket-search-row">
                <div className="food-selector-supermarket-input-wrapper">
                  <input
                    type="text"
                    placeholder="Escribe el nombre de la marca o producto..."
                    value={offQuery}
                    onChange={(e) => setOffQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchOff();
                      }
                    }}
                    className="food-selector-supermarket-input"
                    aria-label="Buscar producto en supermercado"
                  />
                  {offQuery.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setOffQuery('');
                        setOffResults([]);
                        setHasSearchedOff(false);
                      }}
                      className="food-selector-supermarket-clear-btn"
                      title="Borrar búsqueda"
                      aria-label="Borrar búsqueda"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleSearchOff()}
                  disabled={searchingOff || offQuery.trim().length < 2}
                  className="food-selector-supermarket-btn"
                >
                  {searchingOff ? 'Buscando...' : 'Buscar'}
                </button>
              </div>

              {/* Estado: Buscando */}
              {searchingOff && (
                <div style={{ textAlign: 'center', padding: '28px 16px', color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px', animation: 'spin 1s linear infinite' }}>🔄</div>
                  <div>Consultando base de datos de supermercado...</div>
                </div>
              )}

              {/* Estado: Sin resultados tras buscar */}
              {!searchingOff && hasSearchedOff && offResults.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '28px 16px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px dashed rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    margin: '8px 0',
                  }}
                >
                  <div style={{ fontSize: '26px', marginBottom: '8px' }}>🥫</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '6px' }}>
                    No se encontraron alimentos para «{offQuery}»
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'rgba(255, 255, 255, 0.55)',
                      maxWidth: '400px',
                      margin: '0 auto 14px',
                      lineHeight: '1.4',
                    }}
                  >
                    Intenta con otra palabra clave (ej. «huevo», «leche», «atún», «avena») o crea tu propio alimento personalizado con su tabla nutricional.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomNombre(offQuery);
                      setActiveSourceTab('custom');
                    }}
                    style={{
                      background: 'rgba(0, 212, 255, 0.12)',
                      border: '1px solid #00d4ff',
                      color: '#00d4ff',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    + Crear «{offQuery}» como Personalizado
                  </button>
                </div>
              )}

              {/* Lista de resultados encontrados */}
              {!searchingOff && offResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {offResults.map((f) => {
                    const isSelected = selectedFood?.id === f.id;
                    const isSinMacros =
                      (f as any).sinMacros ||
                      f.fuente?.includes('Sin macros') ||
                      (f.caloriasBase === 0 && f.proteinaBase === 0 && f.carbohidratosBase === 0 && f.grasaBase === 0);

                    return (
                      <div
                        key={f.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectFood(f)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectFood(f);
                          }
                        }}
                        className="food-selector-item-card"
                        style={{
                          background: isSelected ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                          border: isSelected ? '1px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        <div className="food-selector-card-top">
                          <div style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#00d4ff' : '#ffffff' }}>
                            {f.nombre}
                          </div>
                          {f.marca && (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'rgba(0, 212, 255, 0.15)',
                                color: '#00d4ff',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {f.marca}
                            </span>
                          )}
                        </div>
                        <div className="food-selector-card-bottom">
                          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                            Por 100g • {f.marca || 'Comercial'}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            {isSinMacros ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCustomNombre(f.nombre);
                                  setActiveSourceTab('custom');
                                }}
                                style={{
                                  background: 'rgba(245, 158, 11, 0.12)',
                                  border: '1px solid #f59e0b',
                                  color: '#f59e0b',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  borderRadius: '4px',
                                  padding: '2px 8px',
                                  cursor: 'pointer',
                                }}
                              >
                                Completar macros
                              </button>
                            ) : (
                              <>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                                  {f.caloriasBase} kcal
                                </span>
                                <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px' }}>
                                  <span style={{ color: '#3b82f6' }}>P: {f.proteinaBase}g</span> •{' '}
                                  <span style={{ color: '#10b981' }}>C: {f.carbohidratosBase}g</span> •{' '}
                                  <span style={{ color: '#f59e0b' }}>G: {f.grasaBase}g</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA 3: CREAR PERSONALIZADO */}
          {activeSourceTab === 'custom' && (
            <form onSubmit={handleSaveCustomFood} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  background: 'rgba(0, 212, 255, 0.08)',
                  border: '1px solid rgba(0, 212, 255, 0.25)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.85)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '14px' }}>☁️</span>
                <span>
                  Este alimento se sincronizará con tu cuenta en la nube (PostgreSQL) y estará disponible en todos tus dispositivos.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                  NOMBRE DEL ALIMENTO / RECETA *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Tostadas francesas proteicas"
                  value={customNombre}
                  onChange={(e) => setCustomNombre(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '8px 12px',
                    marginTop: '4px',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                    CANTIDAD BASE *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={customCantidadBase}
                    onChange={(e) => setCustomCantidadBase(Number(e.target.value) || 100)}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      color: '#ffffff',
                      padding: '8px 12px',
                      marginTop: '4px',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                    UNIDAD DE MEDIDA *
                  </label>
                  <select
                    value={customUnidad}
                    onChange={(e) => setCustomUnidad(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#121829',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      color: '#ffffff',
                      padding: '8px 12px',
                      marginTop: '4px',
                      fontSize: '13px',
                    }}
                  >
                    <option value="gr">Gramos (gr)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="u">Unidad (u)</option>
                    <option value="Tajada">Tajada</option>
                    <option value="scoop">Scoop</option>
                    <option value="cucharada">Cucharada</option>
                    <option value="Taza">Taza</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>
                    CALORÍAS
                  </label>
                  <input
                    type="number"
                    placeholder="Auto"
                    value={customCalorias}
                    onChange={(e) => setCustomCalorias(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      color: '#ffffff',
                      padding: '8px',
                      marginTop: '4px',
                      fontSize: '12px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 700 }}>
                    PROTEÍNA (g)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="0"
                    value={customProteina}
                    onChange={(e) => setCustomProteina(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      color: '#ffffff',
                      padding: '8px',
                      marginTop: '4px',
                      fontSize: '12px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: '#10b981', fontWeight: 700 }}>
                    CARBOS (g)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="0"
                    value={customCarbos}
                    onChange={(e) => setCustomCarbos(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      color: '#ffffff',
                      padding: '8px',
                      marginTop: '4px',
                      fontSize: '12px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 700 }}>
                    GRASA (g)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="0"
                    value={customGrasa}
                    onChange={(e) => setCustomGrasa(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      color: '#ffffff',
                      padding: '8px',
                      marginTop: '4px',
                      fontSize: '12px',
                    }}
                  />
                </div>
              </div>

              {customWarning && (
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid #f59e0b',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '11px',
                    color: '#f59e0b',
                  }}
                >
                  ⚠️ {customWarning} Presiona Guardar de nuevo para confirmar.
                </div>
              )}

              <button
                type="submit"
                style={{
                  marginTop: '8px',
                  background: 'var(--theme-primary, #00d4ff)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#000000',
                  fontWeight: 800,
                  fontFamily: "'Orbitron', sans-serif",
                  padding: '10px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                GUARDAR ALIMENTO EN MI BIBLIOTECA
              </button>
            </form>
          )}
        </div>

        {/* FOOTER: AJUSTE DE PORCIÓN Y BOTÓN AGREGAR */}
        {selectedFood && (
          <div className="food-selector-bottom-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                Porción:
              </span>
              <input
                type="number"
                min="1"
                step="any"
                value={portionAmount}
                onChange={(e) => setPortionAmount(Math.max(0, Number(e.target.value) || 0))}
                style={{
                  width: '80px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid #00d4ff',
                  borderRadius: '6px',
                  color: '#ffffff',
                  padding: '6px 10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  textAlign: 'center',
                }}
              />
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                {selectedFood.unidad}
              </span>
            </div>

            {/* Preview de macros calculados para esa porción */}
            <div style={{ fontSize: '11px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ color: '#ffffff', fontWeight: 700 }}>
                {portionPreview.calorias} kcal
              </span>
              <span style={{ color: '#3b82f6' }}>P: {portionPreview.proteina}g</span>
              <span style={{ color: '#10b981' }}>C: {portionPreview.carbohidratos}g</span>
              <span style={{ color: '#f59e0b' }}>G: {portionPreview.grasa}g</span>
            </div>

            <button
              type="button"
              onClick={handleConfirmAdd}
              className="food-selector-bottom-btn"
              style={{
                background: 'var(--theme-primary, #00d4ff)',
                border: 'none',
                borderRadius: '8px',
                color: '#000000',
                padding: '8px 18px',
                fontSize: '12px',
                fontWeight: 800,
                fontFamily: "'Orbitron', sans-serif",
                cursor: 'pointer',
              }}
            >
              + AGREGAR A {mealName.toUpperCase()}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FoodSelectorModal;
