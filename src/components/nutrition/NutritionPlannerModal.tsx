import React, { useState, useEffect, useMemo } from 'react';
import {
  NutritionPlan,
  NutritionDay,
  MealFoodItem,
  DayOfWeek,
  Meal,
} from '../../types/nutrition.types';
import { Profile, ValoracionAntropometrica } from '../../types/database.types';
import {
  createPlanFromValuation,
  copyNutritionDay,
  calculateDayTotals,
  calculateMealTotals,
  calculateCompliance,
  savePlanOffline,
  getPlanOffline,
  DAYS_OF_WEEK,
  round1,
} from '../../lib/nutritionEngine';
import { supabase } from '../../lib/supabaseClient';
import FoodSelectorModal from './FoodSelectorModal';
import CopyDayModal from './CopyDayModal';
import NutritionReportPDF from './NutritionReportPDF';
import { generateNutritionPDF } from '../../lib/nutritionPdf';

interface NutritionPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  atleta: Profile;
  initialValuation?: ValoracionAntropometrica | null;
  trainerProfile: Profile | null;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const NutritionPlannerModal: React.FC<NutritionPlannerModalProps> = ({
  isOpen,
  onClose,
  atleta,
  initialValuation,
  trainerProfile,
  showToast,
}) => {
  // Plan activo en edición
  const [plan, setPlan] = useState<NutritionPlan>(() =>
    createPlanFromValuation(atleta.id, initialValuation, trainerProfile?.id)
  );

  const [activeDayKey, setActiveDayKey] = useState<DayOfWeek>('lunes');
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
  const [syncedValuationDate, setSyncedValuationDate] = useState<string | null>(
    initialValuation?.fecha || null
  );

  // Modales
  const [foodModalOpen, setFoodModalOpen] = useState<boolean>(false);
  const [activeMealIndex, setActiveMealIndex] = useState<number>(0);
  const [copyModalOpen, setCopyModalOpen] = useState<boolean>(false);
  const [showPdfView, setShowPdfView] = useState<boolean>(false);

  // Cargar plan existente desde Supabase o IndexedDB al abrir, o resolver última valoración
  useEffect(() => {
    if (!isOpen || !atleta?.id) return;

    let isMounted = true;
    const loadPlan = async () => {
      setLoading(true);
      try {
        // Resolver la valoración más reciente del atleta (autónomamente si no vino por props)
        let resolvedValuation = initialValuation || null;
        try {
          const { data: valData } = await supabase
            .from('valoraciones_antropometricas')
            .select('*')
            .eq('cliente_id', atleta.id)
            .order('fecha', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (valData) {
            resolvedValuation = valData as ValoracionAntropometrica;
          }
        } catch (valErr) {
          console.warn('No se pudo verificar valoración en Supabase:', valErr);
        }

        if (resolvedValuation?.fecha && isMounted) {
          setSyncedValuationDate(resolvedValuation.fecha);
        }

        // 1. Intentar cargar plan guardado desde Supabase
        const { data: remotePlan, error } = await supabase
          .from('planes_nutricionales')
          .select('*')
          .eq('cliente_id', atleta.id)
          .eq('activo', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (remotePlan && !error && isMounted) {
          setPlan(remotePlan as unknown as NutritionPlan);
          return;
        }

        // 2. Fallback a IndexedDB
        const offlinePlan = await getPlanOffline(atleta.id);
        if (offlinePlan && isMounted) {
          setPlan(offlinePlan);
          return;
        }

        // 3. Si no hay plan previo guardado, inicializar con la valoración resuelta
        if (isMounted) {
          setPlan(createPlanFromValuation(atleta.id, resolvedValuation, trainerProfile?.id));
        }
      } catch (err) {
        console.error('Error al cargar plan nutricional:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPlan();

    return () => {
      isMounted = false;
    };
  }, [isOpen, atleta?.id, initialValuation, trainerProfile?.id]);

  const currentDay: NutritionDay = useMemo(() => {
    return plan.datos_plan.days[activeDayKey] || Object.values(plan.datos_plan.days)[0];
  }, [plan, activeDayKey]);

  // Totales y cumplimiento del día actual
  const currentDayTotals = useMemo(() => {
    return calculateDayTotals(currentDay);
  }, [currentDay]);

  const compliance = useMemo(() => {
    return calculateCompliance(currentDayTotals, {
      calorias: plan.target_calorias,
      proteinaGrams: plan.target_proteina_g,
      carbohidratosGrams: plan.target_carbohidratos_g,
      grasaGrams: plan.target_grasa_g,
    });
  }, [currentDayTotals, plan]);

  // Sincronizar macros manualmente con la última valoración antropométrica
  const handleSyncWithLatestValuation = async () => {
    try {
      const { data: latestVal, error } = await supabase
        .from('valoraciones_antropometricas')
        .select('*')
        .eq('cliente_id', atleta.id)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !latestVal) {
        showToast?.('No se encontró ninguna valoración previa para este atleta', 'info');
        return;
      }

      const val = latestVal as ValoracionAntropometrica;
      const targetCal =
        val.target_calorias || (val as any).calorias_recomendadas || val.tdee || 2000;
      const targetProt =
        (val.macros as any)?.proteina?.grams || (val as any).proteina_g || 150;
      const targetCarb =
        (val.macros as any)?.carbohidratos?.grams || (val as any).carbohidratos_g || 200;
      const targetFat =
        (val.macros as any)?.grasa?.grams || (val as any).grasas_g || 60;

      setPlan((prev) => ({
        ...prev,
        valoracion_id: val.id || prev.valoracion_id,
        target_calorias: targetCal,
        target_proteina_g: round1(targetProt),
        target_carbohidratos_g: round1(targetCarb),
        target_grasa_g: round1(targetFat),
        ajuste_calorico_pct: val.ajuste_calorico_pct || prev.ajuste_calorico_pct,
        objetivo: val.objetivo || prev.objetivo,
      }));
      setSyncedValuationDate(val.fecha);
      showToast?.(`Macros sincronizados con valoración del ${val.fecha}`, 'success');
    } catch (err: any) {
      console.error('Error al sincronizar con valoración:', err);
      showToast?.('Error al conectar con la base de datos', 'error');
    }
  };

  // Modificar horario de una comida
  const handleUpdateMealTime = (mealIndex: number, newTime: string) => {
    setPlan((prev) => {
      const day = prev.datos_plan.days[activeDayKey];
      if (!day) return prev;
      const newMeals = [...day.meals];
      if (!newMeals[mealIndex]) return prev;
      newMeals[mealIndex] = { ...newMeals[mealIndex], horario: newTime };
      return {
        ...prev,
        datos_plan: {
          ...prev.datos_plan,
          days: {
            ...prev.datos_plan.days,
            [activeDayKey]: { ...day, meals: newMeals },
          },
        },
      };
    });
  };

  // Modificar nombre de una comida
  const handleUpdateMealName = (mealIndex: number, newName: string) => {
    setPlan((prev) => {
      const day = prev.datos_plan.days[activeDayKey];
      if (!day) return prev;
      const newMeals = [...day.meals];
      if (!newMeals[mealIndex]) return prev;
      newMeals[mealIndex] = { ...newMeals[mealIndex], nombre: newName };
      return {
        ...prev,
        datos_plan: {
          ...prev.datos_plan,
          days: {
            ...prev.datos_plan.days,
            [activeDayKey]: { ...day, meals: newMeals },
          },
        },
      };
    });
  };

  // Eliminar comida del día
  const handleDeleteMeal = (mealIndex: number) => {
    const day = plan.datos_plan.days[activeDayKey];
    if (!day || !day.meals[mealIndex]) return;
    const mealToDelete = day.meals[mealIndex];

    if (mealToDelete.foods.length > 0) {
      const confirmDelete = window.confirm(
        `¿Eliminar «${mealToDelete.nombre}»? Se eliminarán ${mealToDelete.foods.length} alimento(s) de esta comida.`
      );
      if (!confirmDelete) return;
    }

    setPlan((prev) => {
      const d = prev.datos_plan.days[activeDayKey];
      if (!d) return prev;
      const newMeals = d.meals.filter((_, idx) => idx !== mealIndex);
      return {
        ...prev,
        datos_plan: {
          ...prev.datos_plan,
          days: {
            ...prev.datos_plan.days,
            [activeDayKey]: { ...d, meals: newMeals },
          },
        },
      };
    });
    showToast?.(`Comida «${mealToDelete.nombre}» eliminada`, 'info');
  };

  // Añadir nueva comida al día activo
  const handleAddMeal = (presetName: string = 'Merienda', defaultTime?: string) => {
    setPlan((prev) => {
      const day = prev.datos_plan.days[activeDayKey];
      if (!day) return prev;

      let suggestedTime = defaultTime;
      if (!suggestedTime) {
        const lower = presetName.toLowerCase();
        if (lower.includes('pre')) suggestedTime = '16:00';
        else if (lower.includes('post')) suggestedTime = '18:00';
        else if (lower.includes('merienda')) suggestedTime = '17:00';
        else if (lower.includes('desayuno')) suggestedTime = '08:00';
        else if (lower.includes('almuerzo')) suggestedTime = '13:30';
        else if (lower.includes('cena')) suggestedTime = '20:30';
        else if (lower.includes('colación') || lower.includes('snack')) suggestedTime = '11:00';
        else suggestedTime = '12:00';
      }

      const newMeal: Meal = {
        id: 'm_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        nombre: presetName,
        horario: suggestedTime,
        orden: day.meals.length + 1,
        foods: [],
      };

      return {
        ...prev,
        datos_plan: {
          ...prev.datos_plan,
          days: {
            ...prev.datos_plan.days,
            [activeDayKey]: {
              ...day,
              meals: [...day.meals, newMeal],
            },
          },
        },
      };
    });
    showToast?.(`Comida «${presetName}» agregada`, 'success');
  };

  // Ordenar comidas del día por horario
  const handleSortMealsByTime = () => {
    setPlan((prev) => {
      const day = prev.datos_plan.days[activeDayKey];
      if (!day || day.meals.length < 2) return prev;
      const sorted = [...day.meals].sort((a, b) => {
        const timeA = a.horario || '99:99';
        const timeB = b.horario || '99:99';
        return timeA.localeCompare(timeB);
      });
      return {
        ...prev,
        datos_plan: {
          ...prev.datos_plan,
          days: {
            ...prev.datos_plan.days,
            [activeDayKey]: { ...day, meals: sorted },
          },
        },
      };
    });
    showToast?.('Comidas ordenadas cronológicamente', 'info');
  };

  // Manejo de alimentos
  const handleOpenFoodModal = (mealIndex: number) => {
    setActiveMealIndex(mealIndex);
    setFoodModalOpen(true);
  };

  const handleAddFoodToMeal = (foodItem: MealFoodItem) => {
    setPlan((prev) => {
      const day = prev.datos_plan.days[activeDayKey];
      if (!day) return prev;

      const newMeals = [...day.meals];
      const targetMeal = newMeals[activeMealIndex];
      if (!targetMeal) return prev;

      newMeals[activeMealIndex] = {
        ...targetMeal,
        foods: [...targetMeal.foods, foodItem],
      };

      return {
        ...prev,
        datos_plan: {
          ...prev.datos_plan,
          days: {
            ...prev.datos_plan.days,
            [activeDayKey]: {
              ...day,
              meals: newMeals,
            },
          },
        },
      };
    });
  };

  const handleRemoveFoodFromMeal = (mealIndex: number, foodIndex: number) => {
    setPlan((prev) => {
      const day = prev.datos_plan.days[activeDayKey];
      if (!day) return prev;

      const newMeals = [...day.meals];
      const targetMeal = newMeals[mealIndex];
      if (!targetMeal) return prev;

      const newFoods = targetMeal.foods.filter((_, idx) => idx !== foodIndex);
      newMeals[mealIndex] = { ...targetMeal, foods: newFoods };

      return {
        ...prev,
        datos_plan: {
          ...prev.datos_plan,
          days: {
            ...prev.datos_plan.days,
            [activeDayKey]: {
              ...day,
              meals: newMeals,
            },
          },
        },
      };
    });
  };

  const handleUpdateFoodQuantity = (mealIndex: number, foodIndex: number, newQty: number) => {
    setPlan((prev) => {
      const day = prev.datos_plan.days[activeDayKey];
      if (!day) return prev;

      const newMeals = [...day.meals];
      const targetMeal = newMeals[mealIndex];
      if (!targetMeal) return prev;

      const food = targetMeal.foods[foodIndex];
      if (!food) return prev;

      const base = food.cantidadBase > 0 ? food.cantidadBase : 100;
      void base;

      const updatedFood: MealFoodItem = {
        ...food,
        cantidad: newQty,
        // Proporcional contra los valores base
        calorias: Math.round(
          food.cantidadBase > 0 ? (food.calorias / (food.cantidad || 1)) * newQty : food.calorias
        ),
        proteina: round1(
          food.cantidadBase > 0 ? (food.proteina / (food.cantidad || 1)) * newQty : food.proteina
        ),
        carbohidratos: round1(
          food.cantidadBase > 0 ? (food.carbohidratos / (food.cantidad || 1)) * newQty : food.carbohidratos
        ),
        grasa: round1(
          food.cantidadBase > 0 ? (food.grasa / (food.cantidad || 1)) * newQty : food.grasa
        ),
      };

      const newFoods = [...targetMeal.foods];
      newFoods[foodIndex] = updatedFood;
      newMeals[mealIndex] = { ...targetMeal, foods: newFoods };

      return {
        ...prev,
        datos_plan: {
          ...prev.datos_plan,
          days: {
            ...prev.datos_plan.days,
            [activeDayKey]: {
              ...day,
              meals: newMeals,
            },
          },
        },
      };
    });
  };

  // Copiar comidas de un día a otros días
  const handleConfirmCopyDays = (targetDays: DayOfWeek[]) => {
    setPlan((prev) => copyNutritionDay(prev, activeDayKey, targetDays));
    showToast?.(`✅ Menú de ${activeDayKey} copiado a ${targetDays.join(', ')}`, 'success');
  };

  // Guardar en Supabase e IndexedDB
  const handleSavePlan = async () => {
    setSaving(true);
    try {
      // 1. Guardar primero en IndexedDB (offline-first garantizado)
      await savePlanOffline(plan);

      // 2. Persistir en Supabase
      const payload = {
        cliente_id: plan.cliente_id,
        entrenador_id: plan.entrenador_id,
        valoracion_id: plan.valoracion_id,
        nombre: plan.nombre,
        activo: true,
        modo: plan.modo,
        objetivo: plan.objetivo,
        target_calorias: plan.target_calorias,
        target_proteina_g: plan.target_proteina_g,
        target_carbohidratos_g: plan.target_carbohidratos_g,
        target_grasa_g: plan.target_grasa_g,
        ajuste_calorico_pct: plan.ajuste_calorico_pct,
        datos_plan: plan.datos_plan,
        recomendaciones: plan.recomendaciones,
        updated_at: new Date().toISOString(),
      };

      if (plan.id) {
        const { error } = await supabase
          .from('planes_nutricionales')
          .update(payload)
          .eq('id', plan.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('planes_nutricionales')
          .insert([payload])
          .select('id')
          .single();
        if (error) throw error;
        if (data?.id) {
          setPlan((prev) => ({ ...prev, id: data.id }));
        }
      }

      showToast?.('🎉 ¡Plan nutricional guardado exitosamente!', 'success');
    } catch (err: any) {
      console.error('Error al guardar plan nutricional:', err);
      showToast?.('Error al sincronizar con la nube: ' + (err.message || err), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Generar y descargar PDF
  const handleDownloadPDF = async () => {
    setDownloadingPdf(true);
    try {
      const filename = `Plan_Nutricional_${atleta.nombre.replace(/\s+/g, '_')}.pdf`;
      await generateNutritionPDF('nutrition-pdf-content', filename);
      showToast?.('📄 PDF descargado correctamente.', 'success');
    } catch (err: any) {
      showToast?.('Error al generar PDF: ' + err.message, 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop de modal
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '12px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#0b0f19',
          border: '1px solid rgba(0, 212, 255, 0.35)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1040px',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.9)',
          color: '#ffffff',
          fontFamily: "'Inter', sans-serif",
          overflow: 'hidden',
        }}
      >
        {/* BARRA SUPERIOR: DATOS Y METAS NUTRICIONALES */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'linear-gradient(180deg, rgba(0, 212, 255, 0.08) 0%, rgba(11, 15, 25, 0.6) 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 800,
                    background: 'var(--theme-primary, #00d4ff)',
                    color: '#000000',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    letterSpacing: '1px',
                  }}
                >
                  🥗 NUTRICIÓN & DIETAS
                </span>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                  Atleta: <strong style={{ color: '#fff' }}>{atleta.nombre}</strong>
                  {loading && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#00d4ff' }}>(Cargando...)</span>}
                </span>
                {syncedValuationDate && (
                  <span
                    style={{
                      fontSize: '10px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      color: '#34d399',
                      padding: '2px 8px',
                      borderRadius: '12px',
                    }}
                    title={`Macros cargados desde la valoración antropométrica del ${syncedValuationDate}`}
                  >
                    🎯 Valoración Antropométrica ({syncedValuationDate})
                  </span>
                )}
                {plan.valoracion_id && !syncedValuationDate && (
                  <span
                    style={{
                      fontSize: '10px',
                      background: 'rgba(168, 85, 247, 0.2)',
                      border: '1px solid rgba(168, 85, 247, 0.5)',
                      color: '#c084fc',
                      padding: '2px 8px',
                      borderRadius: '12px',
                    }}
                  >
                    📐 Antropometría ({plan.objetivo})
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleSyncWithLatestValuation}
                title="Sincronizar calorías y macros objetivo desde la última valoración antropométrica"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'rgba(255, 255, 255, 0.85)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                🔄 Sincronizar Valoración
              </button>
              <button
                type="button"
                onClick={() => setShowPdfView(!showPdfView)}
                style={{
                  background: showPdfView ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  color: '#00d4ff',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {showPdfView ? '✏️ Modo Editor' : '👁️ Vista Previa PDF'}
              </button>
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
          </div>

          {/* MONITOR EN TIEMPO REAL: CALORÍAS Y BARRAS DE MACROS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
              gap: '12px',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '10px',
              padding: '10px 14px',
            }}
          >
            {/* CALORÍAS */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>🔥 CALORÍAS</span>
                <span style={{ fontWeight: 800, color: compliance.status === 'optimo' ? '#10b981' : compliance.status === 'deficit' ? '#00d4ff' : '#f59e0b' }}>
                  {currentDayTotals.calorias} / {plan.target_calorias} kcal ({compliance.caloriasPct}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, compliance.caloriasPct)}%`,
                    height: '100%',
                    background: compliance.status === 'optimo' ? '#10b981' : compliance.status === 'deficit' ? '#00d4ff' : '#f59e0b',
                    borderRadius: '3px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                Delta: {compliance.caloriasDiff > 0 ? `+${compliance.caloriasDiff}` : compliance.caloriasDiff} kcal
              </div>
            </div>

            {/* PROTEÍNAS */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: '#3b82f6', fontWeight: 700 }}>🥩 PROTEÍNA</span>
                <span style={{ fontWeight: 800, color: '#3b82f6' }}>
                  {currentDayTotals.proteina} / {plan.target_proteina_g}g ({compliance.proteinaPct}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, compliance.proteinaPct)}%`,
                    height: '100%',
                    background: '#3b82f6',
                    borderRadius: '3px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            {/* CARBOHIDRATOS */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: '#10b981', fontWeight: 700 }}>🍚 CARBOS</span>
                <span style={{ fontWeight: 800, color: '#10b981' }}>
                  {currentDayTotals.carbohidratos} / {plan.target_carbohidratos_g}g ({compliance.carbohidratosPct}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, compliance.carbohidratosPct)}%`,
                    height: '100%',
                    background: '#10b981',
                    borderRadius: '3px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            {/* GRASAS */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>🥑 GRASAS</span>
                <span style={{ fontWeight: 800, color: '#f59e0b' }}>
                  {currentDayTotals.grasa} / {plan.target_grasa_g}g ({compliance.grasaPct}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, compliance.grasaPct)}%`,
                    height: '100%',
                    background: '#f59e0b',
                    borderRadius: '3px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* PESTAÑAS DE DÍAS Y BOTÓN COPIAR DÍA */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.25)',
          }}
        >
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
            {DAYS_OF_WEEK.map((d) => {
              const isActive = activeDayKey === d.key;
              const dTotals = calculateDayTotals(plan.datos_plan.days[d.key]);
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setActiveDayKey(d.key)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: isActive ? '1px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: isActive ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    color: isActive ? '#00d4ff' : 'rgba(255, 255, 255, 0.7)',
                    fontSize: '11px',
                    fontWeight: 700,
                    fontFamily: "'Orbitron', sans-serif",
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  <span>{d.label}</span>
                  <span style={{ fontSize: '9px', fontWeight: 400, opacity: 0.8 }}>
                    {dTotals.calorias > 0 ? `${dTotals.calorias} kcal` : '—'}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setCopyModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.35)',
              color: '#00d4ff',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: "'Orbitron', sans-serif",
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            📋 COPIAR ESTE DÍA A...
          </button>
        </div>

        {/* CONTENIDO SCROLLEABLE: LISTADO DE COMIDAS O VISTA PREVIA PDF */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {showPdfView ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <NutritionReportPDF
                plan={plan}
                atletaNombre={atleta.nombre}
                trainerProfile={trainerProfile}
                activeDayKey={activeDayKey}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {currentDay?.meals.map((meal, mIdx) => {
                const mealTotals = calculateMealTotals(meal.foods);
                const mealKcalPct =
                  currentDayTotals.calorias > 0
                    ? Math.round((mealTotals.calorias / currentDayTotals.calorias) * 100)
                    : 0;

                return (
                  <div
                    key={meal.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                    }}
                  >
                    {/* CABECERA DE LA COMIDA */}
                    <div
                      style={{
                        padding: '12px 16px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {/* Nombre de comida editable */}
                        <input
                          type="text"
                          value={meal.nombre}
                          onChange={(e) => handleUpdateMealName(mIdx, e.target.value)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '6px',
                            color: '#ffffff',
                            fontSize: '14px',
                            fontWeight: 800,
                            padding: '4px 8px',
                            minWidth: '120px',
                            maxWidth: '170px',
                            outline: 'none',
                          }}
                          title="Haz clic para cambiar el nombre de la comida"
                        />

                        {/* Modificador interactivo de horario */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '6px',
                            padding: '2px 8px',
                          }}
                          title="Modificar horario de la comida"
                        >
                          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>🕒</span>
                          <input
                            type="time"
                            value={meal.horario || '08:00'}
                            onChange={(e) => handleUpdateMealTime(mIdx, e.target.value)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#00d4ff',
                              fontSize: '12px',
                              fontWeight: 700,
                              outline: 'none',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>
                          <strong>{mealTotals.calorias} kcal</strong> ({mealKcalPct}% del día) •{' '}
                          <span style={{ color: '#3b82f6' }}>P: {mealTotals.proteina}g</span> |{' '}
                          <span style={{ color: '#10b981' }}>C: {mealTotals.carbohidratos}g</span> |{' '}
                          <span style={{ color: '#f59e0b' }}>G: {mealTotals.grasa}g</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenFoodModal(mIdx)}
                          style={{
                            background: 'rgba(0, 212, 255, 0.12)',
                            border: '1px solid rgba(0, 212, 255, 0.4)',
                            color: '#00d4ff',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          + Agregar Alimento
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMeal(mIdx)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title={`Eliminar comida «${meal.nombre}»`}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* LISTADO DE ALIMENTOS EN LA COMIDA */}
                    <div style={{ padding: '8px 16px' }}>
                      {meal.foods.length === 0 ? (
                        <div
                          style={{
                            padding: '18px',
                            textAlign: 'center',
                            fontSize: '12px',
                            color: 'rgba(255,255,255,0.4)',
                            fontStyle: 'italic',
                          }}
                        >
                          No hay alimentos agregados a esta comida aún. Haz clic en "+ Agregar Alimento" para buscar en el catálogo.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {meal.foods.map((food, fIdx) => (
                            <div
                              key={food.id || fIdx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 12px',
                                background: 'rgba(0, 0, 0, 0.25)',
                                border: '1px solid rgba(255, 255, 255, 0.04)',
                                borderRadius: '8px',
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                                  {food.nombre}
                                </div>
                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                                  {food.grupo}
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                {/* Modificador de cantidad inline */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <input
                                    type="number"
                                    min="1"
                                    value={food.cantidad}
                                    onChange={(e) =>
                                      handleUpdateFoodQuantity(mIdx, fIdx, Number(e.target.value) || 0)
                                    }
                                    style={{
                                      width: '64px',
                                      background: 'rgba(255, 255, 255, 0.08)',
                                      border: '1px solid rgba(255, 255, 255, 0.2)',
                                      borderRadius: '4px',
                                      color: '#ffffff',
                                      padding: '4px 6px',
                                      fontSize: '12px',
                                      textAlign: 'center',
                                      fontWeight: 700,
                                    }}
                                  />
                                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                                    {food.unidad}
                                  </span>
                                </div>

                                {/* Macros del alimento */}
                                <div style={{ fontSize: '11px', textAlign: 'right', minWidth: '160px' }}>
                                  <strong style={{ color: '#fff' }}>{food.calorias} kcal</strong>
                                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>
                                    <span style={{ color: '#3b82f6' }}>P: {food.proteina}g</span> |{' '}
                                    <span style={{ color: '#10b981' }}>C: {food.carbohidratos}g</span> |{' '}
                                    <span style={{ color: '#f59e0b' }}>G: {food.grasa}g</span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveFoodFromMeal(mIdx, fIdx)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(239, 68, 68, 0.7)',
                                    fontSize: '16px',
                                    cursor: 'pointer',
                                    padding: '4px',
                                  }}
                                  title="Eliminar alimento"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* BOTONES DE GESTIÓN ÁGIL DE COMIDAS: AÑADIR COMIDA Y ORDENAR */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.7)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    + Añadir Comida rápida:
                  </span>
                  {['Pre-Entreno', 'Post-Entreno', 'Merienda', 'Colación', 'Snack Nocturno'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddMeal(preset)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '4px 10px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#00d4ff')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)')}
                    >
                      + {preset}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const name = window.prompt('Nombre de la nueva comida:', 'Comida Personalizada');
                      if (name && name.trim()) {
                        handleAddMeal(name.trim());
                      }
                    }}
                    style={{
                      background: 'rgba(0, 212, 255, 0.15)',
                      border: '1px solid #00d4ff',
                      borderRadius: '6px',
                      color: '#00d4ff',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    + Personalizada...
                  </button>
                </div>

                {currentDay?.meals && currentDay.meals.length > 1 && (
                  <button
                    type="button"
                    onClick={handleSortMealsByTime}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '11px',
                      padding: '4px 10px',
                      cursor: 'pointer',
                    }}
                    title="Reordenar las comidas del día de menor a mayor horario"
                  >
                    ⏱️ Ordenar por Horario
                  </button>
                )}
              </div>

              {/* RECOMENDACIONES GENERALES */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <label style={{ fontSize: '12px', color: '#00d4ff', fontWeight: 700, letterSpacing: '1px' }}>
                  📋 RECOMENDACIONES Y PAUTAS PARA EL ATLETA
                </label>
                <textarea
                  rows={4}
                  value={plan.recomendaciones || ''}
                  onChange={(e) => setPlan((prev) => ({ ...prev, recomendaciones: e.target.value }))}
                  placeholder="Escribe pautas de hidratación, preparación de alimentos, suplementación..."
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '10px 14px',
                    fontSize: '12px',
                    lineHeight: 1.5,
                    marginTop: '8px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* FOOTER DE ACCIONES */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: '#070a12',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
            Estado: {plan.id ? 'Sincronizado con Supabase' : 'Nuevo plan local'}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloadingPdf}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: downloadingPdf ? 'wait' : 'pointer',
              }}
            >
              {downloadingPdf ? 'Generando PDF...' : '📄 Descargar PDF'}
            </button>
            <button
              type="button"
              onClick={handleSavePlan}
              disabled={saving}
              style={{
                background: 'var(--theme-primary, #00d4ff)',
                border: 'none',
                borderRadius: '8px',
                color: '#000000',
                padding: '8px 20px',
                fontSize: '12px',
                fontWeight: 800,
                fontFamily: "'Orbitron', sans-serif",
                cursor: saving ? 'wait' : 'pointer',
              }}
            >
              {saving ? 'GUARDANDO...' : '💾 GUARDAR PLAN'}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL SELECTOR DE ALIMENTOS */}
      <FoodSelectorModal
        isOpen={foodModalOpen}
        onClose={() => setFoodModalOpen(false)}
        mealName={currentDay?.meals[activeMealIndex]?.nombre || 'Comida'}
        onAddFood={handleAddFoodToMeal}
      />

      {/* MODAL COPIAR DÍA */}
      <CopyDayModal
        isOpen={copyModalOpen}
        onClose={() => setCopyModalOpen(false)}
        sourceDayKey={activeDayKey}
        sourceDayLabel={currentDay?.nombre || activeDayKey}
        onConfirmCopy={handleConfirmCopyDays}
      />
    </div>
  );
};

export default NutritionPlannerModal;
