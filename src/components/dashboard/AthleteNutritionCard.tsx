import React, { useState, useEffect, useMemo } from 'react';
import { NutritionPlan, NutritionDay, DayOfWeek } from '../../types/nutrition.types';
import {
  calculateDayTotals,
  calculateMealTotals,
  calculateCompliance,
  getPlanOffline,
  savePlanOffline,
  sortMealsChronologically,
  DAYS_OF_WEEK,
} from '../../lib/nutritionEngine';
import { supabase } from '../../lib/supabaseClient';
import { NutritionReportPDF } from '../nutrition/NutritionReportPDF';
import { generateNutritionPDF } from '../../lib/nutritionPdf';
import { useSupabase } from '../../context/SupabaseContext';

interface AthleteNutritionCardProps {
  clienteId: string;
  trainerProfile?: any;
  defaultExpanded?: boolean;
}

export const AthleteNutritionCard: React.FC<AthleteNutritionCardProps> = ({
  clienteId,
  trainerProfile,
  defaultExpanded = true,
}) => {
  const { profile } = useSupabase();
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
  const [pdfScope, setPdfScope] = useState<'all' | 'current'>('all');
  const [resolvedTrainer, setResolvedTrainer] = useState<any>(trainerProfile || null);

  // Estado colapsado / desplegable para evitar scrolls excesivos
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('athlete_nutrition_card_expanded') : null;
    if (saved !== null) return saved === 'true';
    return defaultExpanded ?? true;
  });

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('athlete_nutrition_card_expanded', String(next));
      } catch {
        // Ignorar excepciones de almacenamiento
      }
      return next;
    });
  };

  // Obtener el día actual de la semana en español
  const todayKey = useMemo<DayOfWeek>(() => {
    const dayIndex = new Date().getDay(); // 0 es Domingo, 1 es Lunes
    const map: Record<number, DayOfWeek> = {
      0: 'domingo',
      1: 'lunes',
      2: 'martes',
      3: 'miercoles',
      4: 'jueves',
      5: 'viernes',
      6: 'sabado',
    };
    return map[dayIndex] || 'lunes';
  }, []);

  const [selectedDayKey, setSelectedDayKey] = useState<DayOfWeek>(todayKey);

  // Resolver el perfil del entrenador si no vino directamente por props
  useEffect(() => {
    if (trainerProfile) {
      setResolvedTrainer(trainerProfile);
      return;
    }

    if (plan?.entrenador_id) {
      void (async () => {
        try {
          const { data } = await supabase
            .from('perfiles')
            .select('*')
            .eq('id', plan.entrenador_id)
            .maybeSingle();
          if (data) setResolvedTrainer(data);
        } catch (err: unknown) {
          console.warn('No se pudo cargar perfil del entrenador para branding de dieta:', err);
        }
      })();
    }
  }, [trainerProfile, plan?.entrenador_id]);

  // Cargar plan activo
  useEffect(() => {
    let isMounted = true;
    const fetchPlan = async () => {
      setLoading(true);
      try {
        // 1. Intentar desde Supabase
        const { data, error } = await supabase
          .from('planes_nutricionales')
          .select('*')
          .eq('cliente_id', clienteId)
          .eq('activo', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data && !error && isMounted) {
          setPlan(data as unknown as NutritionPlan);
          await savePlanOffline(data as unknown as NutritionPlan);
          return;
        }

        // 2. Fallback a IndexedDB
        const offlinePlan = await getPlanOffline(clienteId);
        if (offlinePlan && isMounted) {
          setPlan(offlinePlan);
        }
      } catch (err) {
        console.error('Error al cargar plan de atleta:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPlan();

    return () => {
      isMounted = false;
    };
  }, [clienteId]);

  const currentDay: NutritionDay | undefined = useMemo(() => {
    if (!plan) return undefined;
    return plan.datos_plan.days[selectedDayKey] || Object.values(plan.datos_plan.days)[0];
  }, [plan, selectedDayKey]);

  // Comidas ordenadas en riguroso orden cronológico por hora
  const sortedMeals = useMemo(() => {
    return sortMealsChronologically(currentDay?.meals || []);
  }, [currentDay?.meals]);

  const dayTotals = useMemo(() => {
    return calculateDayTotals(currentDay);
  }, [currentDay]);

  const compliance = useMemo(() => {
    if (!plan) return null;
    return calculateCompliance(dayTotals, {
      calorias: plan.target_calorias,
      proteinaGrams: plan.target_proteina_g,
      carbohidratosGrams: plan.target_carbohidratos_g,
      grasaGrams: plan.target_grasa_g,
    });
  }, [plan, dayTotals]);

  // Alternar checkmark de alimento consumido
  const handleToggleFoodComplete = async (mealId: string, foodIndex: number) => {
    if (!plan || !currentDay) return;

    const originalMealIdx = currentDay.meals.findIndex((m) => m.id === mealId);
    if (originalMealIdx === -1) return;

    const newMeals = [...currentDay.meals];
    const targetMeal = { ...newMeals[originalMealIdx] };
    if (!targetMeal) return;

    targetMeal.foods = targetMeal.foods.map((f, idx) =>
      idx === foodIndex ? { ...f, completado: !f.completado } : f
    );
    newMeals[originalMealIdx] = targetMeal;

    const updatedPlan: NutritionPlan = {
      ...plan,
      datos_plan: {
        ...plan.datos_plan,
        days: {
          ...plan.datos_plan.days,
          [selectedDayKey]: {
            ...currentDay,
            meals: newMeals,
          },
        },
      },
      updated_at: new Date().toISOString(),
    };

    setPlan(updatedPlan);
    await savePlanOffline(updatedPlan);

    // Intentar sincronizar en Supabase si hay conexión
    if (plan.id) {
      supabase
        .from('planes_nutricionales')
        .update({
          datos_plan: updatedPlan.datos_plan,
          updated_at: updatedPlan.updated_at,
        })
        .eq('id', plan.id)
        .then();
    }
  };

  const handleDownloadPDF = async () => {
    setDownloadingPdf(true);
    try {
      const scopeSuffix = pdfScope === 'all' ? 'Semana_Completa' : (currentDay?.nombre || selectedDayKey);
      const filename = `Plan_Nutricional_${(profile?.nombre || 'Atleta').replace(/\s+/g, '_')}_${scopeSuffix}.pdf`;
      await generateNutritionPDF('athlete-pdf-render', filename);
    } catch (err) {
      console.error('Error al generar PDF:', err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '24px',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.5)',
          fontFamily: "'Orbitron', sans-serif",
          fontSize: '12px',
        }}
      >
        Cargando plan nutricional...
      </div>
    );
  }

  if (!plan) {
    return (
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(0, 212, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: '16px',
          padding: '28px',
          textAlign: 'center',
          color: '#ffffff',
        }}
      >
        <div style={{ fontSize: '36px', marginBottom: '8px' }}>🥗</div>
        <h3 style={{ margin: '0 0 6px', fontFamily: "'Orbitron', sans-serif", fontSize: '16px', color: '#00d4ff' }}>
          PLAN NUTRICIONAL Y MACROS
        </h3>
        <p style={{ margin: '0 auto', maxWidth: '420px', fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
          Aún no tienes un plan alimenticio activo asignado. Consulta con tu entrenador para realizar tu valoración antropométrica y programar tu dieta personalizada.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(0, 212, 255, 0.06) 0%, rgba(13, 19, 34, 0.8) 100%)',
        border: '1px solid rgba(0, 212, 255, 0.3)',
        borderRadius: '16px',
        padding: '16px 20px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        color: '#ffffff',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* CABECERA PRINCIPAL / ACORDEÓN DESPLEGABLE */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <button
          type="button"
          onClick={toggleExpanded}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            textAlign: 'left',
            cursor: 'pointer',
            flex: '1 1 240px',
            color: 'inherit',
            font: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '10px',
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 800,
                background: 'var(--theme-primary, #00d4ff)',
                color: '#000',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              🥗 MI DIETA
            </span>
            <h3 style={{ margin: 0, fontSize: '15px', fontFamily: "'Orbitron', sans-serif", color: '#fff' }}>
              {plan.nombre}
            </h3>
            {plan.objetivo && (
              <span
                style={{
                  fontSize: '10px',
                  color: '#00d4ff',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  background: 'rgba(0, 212, 255, 0.1)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}
              >
                {plan.objetivo}
              </span>
            )}
          </div>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px', display: 'block' }}>
            {isExpanded
              ? 'Toca para contraer y reducir el scroll de la pantalla'
              : 'Toca para desplegar las comidas del día y registrar alimentos consumidos'}
          </span>
        </button>

        {/* ACCIONES RÁPIDAS EN CABECERA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={downloadingPdf}
            title={pdfScope === 'all' ? 'Descargar plan de la semana completa en PDF' : `Descargar día ${selectedDayKey} en PDF`}
            style={{
              background: 'rgba(0, 212, 255, 0.12)',
              border: '1px solid rgba(0, 212, 255, 0.4)',
              color: '#00d4ff',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: "'Orbitron', sans-serif",
              cursor: downloadingPdf ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            {downloadingPdf ? '⏳ Generando...' : '📄 Descargar PDF'}
          </button>

          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={isExpanded}
            style={{
              background: isExpanded ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 212, 255, 0.18)',
              border: isExpanded ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid #00d4ff',
              color: isExpanded ? 'rgba(255, 255, 255, 0.85)' : '#ffffff',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: "'Orbitron', sans-serif",
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            <span>{isExpanded ? 'Ocultar' : 'Ver Comidas'}</span>
            <span style={{ fontSize: '10px' }}>{isExpanded ? '▲' : '▼'}</span>
          </button>
        </div>
      </div>

      {/* PÍLDORAS RESUMEN DE MACROS DE HOY (Siempre visibles en cabecera) */}
      {compliance && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center',
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
            Meta Hoy ({DAYS_OF_WEEK.find((d) => d.key === selectedDayKey)?.label || selectedDayKey}):
          </div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#ffffff',
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.25)',
              borderRadius: '6px',
              padding: '3px 8px',
            }}
          >
            🔥 {dayTotals.calorias} / {plan.target_calorias} kcal
          </div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#3b82f6',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '6px',
              padding: '3px 8px',
            }}
          >
            🥩 {dayTotals.proteina}g / {plan.target_proteina_g}g
          </div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#10b981',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '6px',
              padding: '3px 8px',
            }}
          >
            🍚 {dayTotals.carbohidratos}g / {plan.target_carbohidratos_g}g
          </div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#f59e0b',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '6px',
              padding: '3px 8px',
            }}
          >
            🥑 {dayTotals.grasa}g / {plan.target_grasa_g}g
          </div>
        </div>
      )}

      {/* CONTENIDO DESPLEGABLE COMPLETO (Solo visible cuando isExpanded === true) */}
      {isExpanded && (
        <div style={{ marginTop: '16px' }}>
          {/* BARRA DE ALCANCE DEL PDF */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '8px 12px',
              marginBottom: '14px',
            }}
          >
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
              Formato de descarga PDF:
            </div>
            <div
              style={{
                display: 'inline-flex',
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '8px',
                padding: '2px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <button
                type="button"
                onClick={() => setPdfScope('all')}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  borderRadius: '6px',
                  border: 'none',
                  background: pdfScope === 'all' ? 'var(--theme-primary, #00d4ff)' : 'transparent',
                  color: pdfScope === 'all' ? '#000000' : 'rgba(255, 255, 255, 0.7)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Orbitron', sans-serif",
                }}
              >
                📅 Semana Completa
              </button>
              <button
                type="button"
                onClick={() => setPdfScope('current')}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  borderRadius: '6px',
                  border: 'none',
                  background: pdfScope === 'current' ? 'var(--theme-primary, #00d4ff)' : 'transparent',
                  color: pdfScope === 'current' ? '#000000' : 'rgba(255, 255, 255, 0.7)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Orbitron', sans-serif",
                }}
              >
                🔍 Solo {currentDay?.nombre || selectedDayKey}
              </button>
            </div>
          </div>

          {/* MONITOR DETALLADO DE MACROS CON BARRAS */}
          {compliance && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '10px',
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '16px',
              }}
            >
              <div>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                  🔥 CALORÍAS HOY
                </span>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#fff' }}>
                  {dayTotals.calorias} <span style={{ fontSize: '11px', fontWeight: 500 }}>/ {plan.target_calorias} kcal</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, compliance.caloriasPct)}%`, height: '100%', background: '#00d4ff', borderRadius: '2px' }} />
                </div>
              </div>

              <div>
                <span style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 700 }}>
                  🥩 PROTEÍNA
                </span>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#3b82f6' }}>
                  {dayTotals.proteina}g <span style={{ fontSize: '11px', fontWeight: 500 }}>/ {plan.target_proteina_g}g</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, compliance.proteinaPct)}%`, height: '100%', background: '#3b82f6', borderRadius: '2px' }} />
                </div>
              </div>

              <div>
                <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 700 }}>
                  🍚 CARBOS
                </span>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#10b981' }}>
                  {dayTotals.carbohidratos}g <span style={{ fontSize: '11px', fontWeight: 500 }}>/ {plan.target_carbohidratos_g}g</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, compliance.carbohidratosPct)}%`, height: '100%', background: '#10b981', borderRadius: '2px' }} />
                </div>
              </div>

              <div>
                <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 700 }}>
                  🥑 GRASAS
                </span>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#f59e0b' }}>
                  {dayTotals.grasa}g <span style={{ fontSize: '11px', fontWeight: 500 }}>/ {plan.target_grasa_g}g</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, compliance.grasaPct)}%`, height: '100%', background: '#f59e0b', borderRadius: '2px' }} />
                </div>
              </div>
            </div>
          )}

          {/* SELECTOR DE DÍAS */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '14px' }}>
            {DAYS_OF_WEEK.map((d) => {
              const isSelected = selectedDayKey === d.key;
              const isToday = todayKey === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setSelectedDayKey(d.key)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: isSelected ? '1px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: isSelected ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    color: isSelected ? '#00d4ff' : 'rgba(255, 255, 255, 0.7)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.label} {isToday && '⭐'}
                </button>
              );
            })}
          </div>

          {/* COMIDAS DEL DÍA EN ORDEN CRONOLÓGICO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sortedMeals.map((meal) => {
              const mTotals = calculateMealTotals(meal.foods);
              return (
                <div
                  key={meal.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800 }}>{meal.nombre}</span>
                      {meal.horario && (
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>
                          🕒 {meal.horario}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
                      <strong>{mTotals.calorias} kcal</strong>
                    </div>
                  </div>

                  <div style={{ padding: '8px 12px' }}>
                    {meal.foods.length === 0 ? (
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                        Sin alimentos asignados para esta comida.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {meal.foods.map((food, fIdx) => {
                          const isDone = Boolean(food.completado);
                          return (
                            <button
                              type="button"
                              key={food.id || fIdx}
                              onClick={() => handleToggleFoodComplete(meal.id, fIdx)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                textAlign: 'left',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                background: isDone ? 'rgba(16, 185, 129, 0.08)' : 'rgba(0, 0, 0, 0.2)',
                                border: isDone ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.04)',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                  type="checkbox"
                                  checked={isDone}
                                  onChange={() => {}}
                                  style={{ accentColor: '#10b981', cursor: 'pointer' }}
                                />
                                <span
                                  style={{
                                    fontSize: '12px',
                                    textDecoration: isDone ? 'line-through' : 'none',
                                    color: isDone ? 'rgba(255,255,255,0.5)' : '#ffffff',
                                  }}
                                >
                                  {food.nombre}
                                </span>
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                                {food.cantidad} {food.unidad} • {food.calorias} kcal
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* RECOMENDACIONES DEL ENTRENADOR */}
          {plan.recomendaciones && (
            <div
              style={{
                marginTop: '16px',
                background: 'rgba(0, 212, 255, 0.05)',
                border: '1px solid rgba(0, 212, 255, 0.2)',
                borderRadius: '10px',
                padding: '12px 14px',
              }}
            >
              <span style={{ fontSize: '11px', color: '#00d4ff', fontWeight: 800 }}>
                📋 PAUTAS DE TU ENTRENADOR:
              </span>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                {plan.recomendaciones}
              </p>
            </div>
          )}

          {/* BOTÓN INFERIOR PARA COLAPSAR Y REDUCIR EL SCROLL */}
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              type="button"
              onClick={toggleExpanded}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: 'rgba(255, 255, 255, 0.7)',
                padding: '8px 18px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Orbitron', sans-serif",
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>▲ Ocultar detalle de comidas</span>
            </button>
          </div>
        </div>
      )}

      {/* RENDER OCULTO PARA EL GENERADOR DE PDF (Estructura y Branding idénticos al Entrenador) */}
      <div
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '794px',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1,
        }}
        aria-hidden="true"
      >
        <div id="athlete-pdf-render" style={{ width: '794px', backgroundColor: '#ffffff' }}>
          <NutritionReportPDF
            plan={plan}
            atletaNombre={profile?.nombre || 'Atleta'}
            trainerProfile={resolvedTrainer}
            activeDayKey={pdfScope === 'all' ? 'todos' : selectedDayKey}
          />
        </div>
      </div>
    </div>
  );
};

export default AthleteNutritionCard;
