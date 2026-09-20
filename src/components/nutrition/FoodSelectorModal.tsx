import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

  // Filtrado reactivo del catálogo base
  const filteredBaseFoods = useMemo(() => {
    let result = combinedCatalog;

    if (selectedGroup !== 'Todos') {
      result = result.filter((f) => f.grupo === selectedGroup);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (f) =>
          f.nombre.toLowerCase().includes(q) ||
          (f.marca && f.marca.toLowerCase().includes(q))
      );
    }

    return result.slice(0, 50); // Límite para scroll super fluido
  }, [combinedCatalog, selectedGroup, searchQuery]);

  // Búsqueda en Open Food Facts
  const handleSearchOff = useCallback(async () => {
    if (offQuery.trim().length < 2) return;
    setSearchingOff(true);
    setHasSearchedOff(true);
    try {
      const items = await searchOpenFoodFacts(offQuery);
      setOffResults(items);
    } finally {
      setSearchingOff(false);
    }
  }, [offQuery]);

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
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0d1322',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.8)',
          color: '#ffffff',
          fontFamily: "'Inter', sans-serif",
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABECERA */}
        <div
          style={{
            padding: '16px 20px',
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
            <h3 style={{ margin: '2px 0 0', fontSize: '16px', fontFamily: "'Orbitron', sans-serif", color: '#fff' }}>
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
            }}
          >
            ✕
          </button>
        </div>

        {/* SELECTOR DE PESTAÑAS DE FUENTE */}
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
              padding: '12px 16px',
              background: activeSourceTab === 'base' ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
              border: 'none',
              borderBottom: activeSourceTab === 'base' ? '2px solid #00d4ff' : '2px solid transparent',
              color: activeSourceTab === 'base' ? '#00d4ff' : 'rgba(255, 255, 255, 0.6)',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: "'Orbitron', sans-serif",
              cursor: 'pointer',
            }}
          >
            🏛️ Catálogo Oficial ({combinedCatalog.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSourceTab('openfoodfacts')}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: activeSourceTab === 'openfoodfacts' ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
              border: 'none',
              borderBottom: activeSourceTab === 'openfoodfacts' ? '2px solid #00d4ff' : '2px solid transparent',
              color: activeSourceTab === 'openfoodfacts' ? '#00d4ff' : 'rgba(255, 255, 255, 0.6)',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: "'Orbitron', sans-serif",
              cursor: 'pointer',
            }}
          >
            🌐 Supermercado (Open Food)
          </button>
          <button
            type="button"
            onClick={() => setActiveSourceTab('custom')}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: activeSourceTab === 'custom' ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
              border: 'none',
              borderBottom: activeSourceTab === 'custom' ? '2px solid #00d4ff' : '2px solid transparent',
              color: activeSourceTab === 'custom' ? '#00d4ff' : 'rgba(255, 255, 255, 0.6)',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: "'Orbitron', sans-serif",
              cursor: 'pointer',
            }}
          >
            ✍️ Crear Personalizado
          </button>
        </div>

        {/* CUERPO PRINCIPAL */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', minHeight: '300px' }}>
          {/* PESTAÑA 1: CATÁLOGO BASE */}
          {activeSourceTab === 'base' && (
            <div>
              {/* Buscador de texto */}
              <div style={{ marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="🔍 Buscar alimento (ej. pechuga, arroz, huevo, avena...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '10px 14px',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Filtro de grupos en pills scrolleables */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  overflowX: 'auto',
                  paddingBottom: '8px',
                  marginBottom: '14px',
                }}
              >
                {['Todos', 'Carnes y Aves', 'Pescados y Mariscos', 'Huevos', 'Lácteos y Quesos', 'Cereales y Tubérculos', 'Legumbres', 'Grasas y Frutos Secos', 'Frutas', 'Verduras', 'Suplementación', 'Bebidas y Varios', 'Mis Alimentos'].map((grp) => (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => setSelectedGroup(grp)}
                    style={{
                      whiteSpace: 'nowrap',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '11px',
                      border: selectedGroup === grp ? '1px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: selectedGroup === grp ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                      color: selectedGroup === grp ? '#00d4ff' : 'rgba(255, 255, 255, 0.7)',
                      cursor: 'pointer',
                      fontWeight: selectedGroup === grp ? 700 : 400,
                    }}
                  >
                    {grp}
                  </button>
                ))}
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
                        onClick={() => handleSelectFood(f)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          background: isSelected ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                          border: isSelected ? '1px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.06)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                          </div>
                          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                            Base: {f.cantidadBase} {f.unidad} • {f.grupo}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input
                  type="text"
                  placeholder="Escribe el nombre de la marca o producto..."
                  value={offQuery}
                  onChange={(e) => setOffQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchOff()}
                  style={{
                    flex: 1,
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '10px 14px',
                    fontSize: '13px',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSearchOff}
                  disabled={searchingOff || offQuery.trim().length < 2}
                  style={{
                    background: 'var(--theme-primary, #00d4ff)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#000',
                    fontWeight: 700,
                    padding: '0 16px',
                    fontSize: '12px',
                    cursor: searchingOff ? 'wait' : 'pointer',
                  }}
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
                    return (
                      <div
                        key={f.id}
                        onClick={() => handleSelectFood(f)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          background: isSelected ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                          border: isSelected ? '1px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.06)',
                          cursor: 'pointer',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#00d4ff' : '#ffffff' }}>
                            {f.nombre}
                          </div>
                          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                            Por 100g • {f.marca || 'Comercial'}
                          </div>
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
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              background: '#090d17',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
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
