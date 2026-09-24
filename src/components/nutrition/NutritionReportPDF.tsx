import React from 'react';
import { NutritionPlan, NutritionDay, DayOfWeek } from '../../types/nutrition.types';
import {
  calculateMealTotals,
  calculateDayTotals,
  DAYS_OF_WEEK,
  sortMealsChronologically,
  getUniquePrescribedFoods,
  getAutomaticEquivalents,
  getDominantMacro,
  normalizeFoodSearchText,
} from '../../lib/nutritionEngine';
import { Profile } from '../../types/database.types';

interface NutritionReportPDFProps {
  plan: NutritionPlan;
  atletaNombre: string;
  trainerProfile: Profile | null;
  activeDayKey?: string;
}


export const NutritionReportPDF: React.FC<NutritionReportPDFProps> = ({
  plan,
  atletaNombre,
  trainerProfile,
  activeDayKey = 'lunes',
}) => {
  const brandName = trainerProfile?.marca?.nombre_display || trainerProfile?.nombre || 'EVOLUTION LAB';
  const brandEslogan = trainerProfile?.marca?.eslogan || 'Sistemas de Entrenamiento & Nutrición de Alta Precisión';
  const brandLogo = (trainerProfile?.marca as any)?.logo_url;

  const isMultiDay = activeDayKey === 'todos' || activeDayKey === 'all' || !activeDayKey;

  // Días que realmente contienen comidas con alimentos asignados
  const configuredDays = DAYS_OF_WEEK
    .map((d) => ({
      key: d.key,
      label: d.label,
      day: plan.datos_plan.days[d.key],
    }))
    .filter(({ day }) => day && Array.isArray(day.meals) && day.meals.some((m) => m.foods && m.foods.length > 0));

  // Si es multi-día y hay días poblados, renderizamos todos; si no, fallback al día activo o al primer día existente
  const fallbackSingleDayKey = (activeDayKey && activeDayKey !== 'todos' && activeDayKey !== 'all') ? activeDayKey : 'lunes';
  const singleDay: NutritionDay | undefined =
    plan.datos_plan.days[fallbackSingleDayKey as DayOfWeek] || Object.values(plan.datos_plan.days)[0];

  const daysToRender: Array<{ key: string; label: string; day?: NutritionDay }> = isMultiDay
    ? (configuredDays.length > 0
        ? configuredDays
        : [{ key: fallbackSingleDayKey, label: singleDay?.nombre || 'Lunes', day: singleDay }])
    : [{ key: fallbackSingleDayKey, label: singleDay?.nombre || 'Lunes', day: singleDay }];

  const currentDayTotals = calculateDayTotals(singleDay);

  const tCal = plan.target_calorias || 2000;
  const tProt = plan.target_proteina_g || 150;
  const tCarb = plan.target_carbohidratos_g || 200;
  const tFat = plan.target_grasa_g || 60;

  // Cálculo de Guía de Alimentos Equivalentes
  const includeEquivalents = plan.datos_plan?.incluirEquivalenciasPdf !== false;
  const uniqueFoods = includeEquivalents ? getUniquePrescribedFoods(plan) : [];

  const foodsWithEquivalents = uniqueFoods
    .map((food) => {
      const key = normalizeFoodSearchText(food.nombre);
      const configured = plan.datos_plan?.equivalencias?.[key];
      const allOptions = Array.isArray(configured)
        ? configured
        : getAutomaticEquivalents(food);
      const approvedOptions = allOptions.filter((opt) => opt.activo !== false);
      const macro = getDominantMacro(food);
      return {
        food,
        macro,
        approvedOptions,
      };
    })
    .filter(({ approvedOptions }) => approvedOptions.length > 0);

  const proteinEquivalents = foodsWithEquivalents.filter((f) => f.macro === 'proteina');
  const carbEquivalents = foodsWithEquivalents.filter((f) => f.macro === 'carbohidratos');
  const fatEquivalents = foodsWithEquivalents.filter((f) => f.macro === 'grasa');

  return (
    <div
      id="nutrition-pdf-content"
      style={{
        width: '794px', // Tamaño A4 estándar a 96 DPI
        minHeight: '1123px',
        backgroundColor: '#ffffff',
        color: '#1a202c',
        fontFamily: "'Inter', -apple-system, sans-serif",
        padding: '36px 40px',
        boxSizing: 'border-box',
        margin: '0 auto',
      }}
    >
      {/* ENCABEZADO Y BRANDING */}
      <div
        data-pdf-block="header-branding"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #00d4ff',
          paddingBottom: '16px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {brandLogo && (
            <img
              src={brandLogo}
              alt="Logo"
              style={{ width: '48px', height: '48px', objectFit: 'contain' }}
            />
          )}
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '22px',
                fontWeight: 900,
                fontFamily: "'Orbitron', sans-serif",
                color: '#0f172a',
                letterSpacing: '1px',
              }}
            >
              {brandName.toUpperCase()}
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
              {brandEslogan}
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              display: 'inline-block',
              background: '#00d4ff',
              color: '#000000',
              fontWeight: 800,
              fontSize: '10px',
              fontFamily: "'Orbitron', sans-serif",
              padding: '3px 8px',
              borderRadius: '4px',
              letterSpacing: '1px',
            }}
          >
            PLAN NUTRICIONAL
          </span>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Fecha: {new Date().toLocaleDateString('es-CO')}
          </div>
        </div>
      </div>

      {/* FICHA DEL ATLETA Y OBJETIVO */}
      <div
        data-pdf-block="athlete-info"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>ATLETA</span>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{atletaNombre}</div>
        </div>
        <div>
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>PLAN</span>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{plan.nombre}</div>
        </div>
        <div>
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>OBJETIVO</span>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0284c7' }}>
            {plan.objetivo || 'Recomposición'}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>DÍA DEL PLAN</span>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
            {isMultiDay
              ? (daysToRender.length > 1
                  ? `Semana Completa (${daysToRender.map((d) => d.label).join(', ')})`
                  : (daysToRender[0]?.label || singleDay?.nombre || 'General'))
              : (singleDay?.nombre || 'General')}
          </div>
        </div>
      </div>

      {/* METAS DIARIAS (TARGETS) */}
      <div
        data-pdf-block="daily-targets"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '10px 14px',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#166534' }}>CALORÍAS OBJETIVO</span>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#15803d', marginTop: '2px' }}>
            {tCal} <span style={{ fontSize: '11px', fontWeight: 500 }}>kcal</span>
          </div>
          <span style={{ fontSize: '9px', color: '#16a34a' }}>
            {isMultiDay
              ? `${daysToRender.length} día(s) con menú activo`
              : `Prescritas: ${currentDayTotals.calorias} kcal`}
          </span>
        </div>

        <div
          style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '10px 14px',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#1e40af' }}>PROTEÍNAS</span>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#1d4ed8', marginTop: '2px' }}>
            {tProt} <span style={{ fontSize: '11px', fontWeight: 500 }}>g</span>
          </div>
          <span style={{ fontSize: '9px', color: '#2563eb' }}>
            {isMultiDay ? 'Meta por jornada activa' : `Prescritas: ${currentDayTotals.proteina}g`}
          </span>
        </div>

        <div
          style={{
            backgroundColor: '#fefce8',
            border: '1px solid #fef08a',
            borderRadius: '8px',
            padding: '10px 14px',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#854d0e' }}>CARBOHIDRATOS</span>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#a16207', marginTop: '2px' }}>
            {tCarb} <span style={{ fontSize: '11px', fontWeight: 500 }}>g</span>
          </div>
          <span style={{ fontSize: '9px', color: '#ca8a04' }}>
            {isMultiDay ? 'Aporte glucídico equilibrado' : `Prescritos: ${currentDayTotals.carbohidratos}g`}
          </span>
        </div>

        <div
          style={{
            backgroundColor: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: '8px',
            padding: '10px 14px',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#9a3412' }}>GRASAS</span>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#c2410c', marginTop: '2px' }}>
            {tFat} <span style={{ fontSize: '11px', fontWeight: 500 }}>g</span>
          </div>
          <span style={{ fontSize: '9px', color: '#ea580c' }}>
            {isMultiDay ? 'Perfil lipídico esencial' : `Prescritas: ${currentDayTotals.grasa}g`}
          </span>
        </div>
      </div>

      {/* DETALLE DE COMIDAS E INGESTAS */}
      <div style={{ marginBottom: '24px' }}>
        {daysToRender.map(({ key: dayKey, label: dayLabel, day: renderedDay }, dIdx) => {
          if (!renderedDay) return null;
          const dayCalculatedTotals = calculateDayTotals(renderedDay);
          // Ordenar comidas siempre en orden cronológico en el reporte PDF
          const mealsToRender = sortMealsChronologically(renderedDay.meals);

          return (
            <div
              key={dayKey}
              data-pdf-block="day-card"
              style={{
                marginBottom: dIdx === daysToRender.length - 1 ? '16px' : '28px',
              }}
            >
              {/* ENCABEZADO DISTINTIVO DEL DÍA */}
              <div
                data-pdf-block="day-header"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '9px 14px',
                  marginBottom: '12px',
                  borderLeft: '4px solid #00d4ff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 900,
                      fontFamily: "'Orbitron', sans-serif",
                      letterSpacing: '1px',
                      color: '#ffffff',
                    }}
                  >
                    📅 {renderedDay.nombre ? renderedDay.nombre.toUpperCase() : dayLabel.toUpperCase()}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      background: 'rgba(0, 212, 255, 0.2)',
                      color: '#00d4ff',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 700,
                    }}
                  >
                    {dayCalculatedTotals.calorias} kcal
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                  <span style={{ color: '#93c5fd', fontWeight: 600 }}>P: {dayCalculatedTotals.proteina}g</span> |{' '}
                  <span style={{ color: '#fde047', fontWeight: 600 }}>C: {dayCalculatedTotals.carbohidratos}g</span> |{' '}
                  <span style={{ color: '#fdba74', fontWeight: 600 }}>G: {dayCalculatedTotals.grasa}g</span>
                </div>
              </div>

              {/* LISTA DE COMIDAS DEL DÍA */}
              {mealsToRender.map((meal) => {
                const mTotals = calculateMealTotals(meal.foods);
                const mealKcalPct =
                  dayCalculatedTotals.calorias > 0
                    ? Math.round((mTotals.calorias / dayCalculatedTotals.calorias) * 100)
                    : 0;

                return (
                  <div
                    key={meal.id}
                    data-pdf-block="meal-card"
                    style={{
                      marginBottom: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    {/* CABECERA DE LA COMIDA */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#f8fafc',
                        padding: '7px 12px',
                        borderBottom: '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                          {meal.nombre}
                        </span>
                        {meal.horario && (
                          <span
                            style={{
                              fontSize: '10px',
                              background: '#e2e8f0',
                              color: '#475569',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 600,
                            }}
                          >
                            🕒 {meal.horario}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#334155' }}>
                        <strong>{mTotals.calorias} kcal</strong> ({mealKcalPct}% del día) •{' '}
                        <span style={{ color: '#1d4ed8' }}>P: {mTotals.proteina}g</span> |{' '}
                        <span style={{ color: '#a16207' }}>C: {mTotals.carbohidratos}g</span> |{' '}
                        <span style={{ color: '#c2410c' }}>G: {mTotals.grasa}g</span>
                      </div>
                    </div>

                    {/* TABLA DE ALIMENTOS */}
                    {meal.foods.length === 0 ? (
                      <div style={{ padding: '8px 12px', fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                        No hay alimentos registrados en esta comida.
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f1f5f9', color: '#64748b', textAlign: 'left' }}>
                            <th style={{ padding: '5px 12px', width: '50%' }}>Alimento</th>
                            <th style={{ padding: '5px 8px', textAlign: 'center', width: '15%' }}>Porción</th>
                            <th style={{ padding: '5px 8px', textAlign: 'right', width: '9%' }}>Prot</th>
                            <th style={{ padding: '5px 8px', textAlign: 'right', width: '9%' }}>Carbs</th>
                            <th style={{ padding: '5px 8px', textAlign: 'right', width: '9%' }}>Grasa</th>
                            <th style={{ padding: '5px 12px', textAlign: 'right', width: '11%' }}>Kcal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {meal.foods.map((food, fIdx) => (
                            <tr
                              key={food.id || fIdx}
                              data-pdf-block="meal-row"
                              style={{
                                borderTop: '1px solid #f1f5f9',
                                backgroundColor: fIdx % 2 === 0 ? '#ffffff' : '#fafafa',
                              }}
                            >
                              <td style={{ padding: '5px 12px', color: '#1e293b', fontWeight: 600 }}>
                                {food.nombre}
                                {food.notas && (
                                  <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 400 }}>
                                    {food.notas}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '5px 8px', textAlign: 'center', color: '#475569' }}>
                                {food.cantidad} {food.unidad}
                              </td>
                              <td style={{ padding: '5px 8px', textAlign: 'right', color: '#1d4ed8' }}>
                                {food.proteina}g
                              </td>
                              <td style={{ padding: '5px 8px', textAlign: 'right', color: '#a16207' }}>
                                {food.carbohidratos}g
                              </td>
                              <td style={{ padding: '5px 8px', textAlign: 'right', color: '#c2410c' }}>
                                {food.grasa}g
                              </td>
                              <td style={{ padding: '5px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                {food.calorias}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* PAUTAS Y RECOMENDACIONES GENERALES */}
      {plan.recomendaciones && (
        <div
          data-pdf-block="recommendations-card"
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            backgroundColor: '#f8fafc',
            padding: '14px 16px',
            marginBottom: '20px',
          }}
        >
          <h3
            data-pdf-block="rec-header"
            style={{
              margin: '0 0 8px',
              fontSize: '12px',
              fontWeight: 800,
              fontFamily: "'Orbitron', sans-serif",
              color: '#0284c7',
            }}
          >
            📋 RECOMENDACIONES DEL ENTRENADOR
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {plan.recomendaciones
              .split('\n')
              .filter((line) => line.trim().length > 0)
              .map((line, lIdx) => (
                <p
                  key={lIdx}
                  data-pdf-block="rec-para"
                  style={{
                    margin: 0,
                    fontSize: '11px',
                    lineHeight: 1.6,
                    color: '#334155',
                  }}
                >
                  {line}
                </p>
              ))}
          </div>
        </div>
      )}

      {/* GUÍA DE INTERCAMBIOS Y ALIMENTOS EQUIVALENTES */}
      {includeEquivalents && foodsWithEquivalents.length > 0 && (
        <div
          data-pdf-block="equivalents-section"
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            padding: '16px 20px',
            marginBottom: '20px',
          }}
        >
          <div style={{ borderBottom: '2px solid #00d4ff', paddingBottom: '8px', marginBottom: '14px' }}>
            <h3
              style={{
                margin: 0,
                fontSize: '13px',
                fontWeight: 800,
                fontFamily: "'Orbitron', sans-serif",
                color: '#0f172a',
                letterSpacing: '0.5px',
              }}
            >
              🔄 GUÍA DE INTERCAMBIOS Y ALIMENTOS EQUIVALENTES
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#64748b', lineHeight: 1.4 }}>
              Puedes sustituir cualquier alimento prescrito en tu plan por cualquiera de las opciones listadas a continuación.
              Las cantidades han sido calculadas con estricta equivalencia calórica (±10%) para mantener intactos tus objetivos diarios.
            </p>
          </div>

          {/* TABLA DE PROTEÍNAS */}
          {proteinEquivalents.length > 0 && (
            <div data-pdf-block="equiv-card" style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  fontFamily: "'Orbitron', sans-serif",
                  color: '#0284c7',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>🥩</span>
                <span>FUENTES DE PROTEÍNA</span>
              </div>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '10px',
                }}
              >
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: '#334155', width: '32%' }}>
                      Alimento en tu Plan
                    </th>
                    <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 700, color: '#334155', width: '22%' }}>
                      Aporte Nutricional
                    </th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: '#334155', width: '46%' }}>
                      Opciones de Reemplazo Aprobadas (Elige 1)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {proteinEquivalents.map(({ food, approvedOptions }, idx) => (
                    <tr
                      key={idx}
                      data-pdf-block="equiv-row"
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                      }}
                    >
                      <td style={{ padding: '8px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{food.nombre}</div>
                        <div style={{ color: '#0284c7', fontWeight: 600, fontSize: '10px', marginTop: '2px' }}>
                          {food.cantidad} {food.unidad}
                        </div>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 700, color: '#3b82f6' }}>{food.proteina}g Proteína</div>
                        <div style={{ color: '#64748b', fontSize: '9px', marginTop: '2px' }}>
                          {food.calorias} kcal • {food.grasa}g G
                        </div>
                      </td>
                      <td style={{ padding: '8px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {approvedOptions.map((opt, optIdx) => (
                            <div key={optIdx} style={{ lineHeight: 1.3, color: '#1e293b' }}>
                              • <strong style={{ color: '#0f172a' }}>{opt.cantidad} {opt.unidad}</strong> {opt.nombre}{' '}
                              <span style={{ color: '#64748b', fontSize: '9px' }}>
                                ({opt.calorias} kcal)
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TABLA DE CARBOHIDRATOS */}
          {carbEquivalents.length > 0 && (
            <div data-pdf-block="equiv-card" style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  fontFamily: "'Orbitron', sans-serif",
                  color: '#059669',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>🍚</span>
                <span>FUENTES DE CARBOHIDRATOS</span>
              </div>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '10px',
                }}
              >
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: '#334155', width: '32%' }}>
                      Alimento en tu Plan
                    </th>
                    <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 700, color: '#334155', width: '22%' }}>
                      Aporte Nutricional
                    </th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: '#334155', width: '46%' }}>
                      Opciones de Reemplazo Aprobadas (Elige 1)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {carbEquivalents.map(({ food, approvedOptions }, idx) => (
                    <tr
                      key={idx}
                      data-pdf-block="equiv-row"
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                      }}
                    >
                      <td style={{ padding: '8px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{food.nombre}</div>
                        <div style={{ color: '#059669', fontWeight: 600, fontSize: '10px', marginTop: '2px' }}>
                          {food.cantidad} {food.unidad}
                        </div>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 700, color: '#10b981' }}>{food.carbohidratos}g Carbohidratos</div>
                        <div style={{ color: '#64748b', fontSize: '9px', marginTop: '2px' }}>
                          {food.calorias} kcal • {food.proteina}g P
                        </div>
                      </td>
                      <td style={{ padding: '8px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {approvedOptions.map((opt, optIdx) => (
                            <div key={optIdx} style={{ lineHeight: 1.3, color: '#1e293b' }}>
                              • <strong style={{ color: '#0f172a' }}>{opt.cantidad} {opt.unidad}</strong> {opt.nombre}{' '}
                              <span style={{ color: '#64748b', fontSize: '9px' }}>
                                ({opt.calorias} kcal)
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TABLA DE GRASAS */}
          {fatEquivalents.length > 0 && (
            <div data-pdf-block="equiv-card" style={{ marginBottom: '8px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  fontFamily: "'Orbitron', sans-serif",
                  color: '#d97706',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>🥑</span>
                <span>FUENTES DE GRASAS SALUDABLES</span>
              </div>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '10px',
                }}
              >
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: '#334155', width: '32%' }}>
                      Alimento en tu Plan
                    </th>
                    <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 700, color: '#334155', width: '22%' }}>
                      Aporte Nutricional
                    </th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: '#334155', width: '46%' }}>
                      Opciones de Reemplazo Aprobadas (Elige 1)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fatEquivalents.map(({ food, approvedOptions }, idx) => (
                    <tr
                      key={idx}
                      data-pdf-block="equiv-row"
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                      }}
                    >
                      <td style={{ padding: '8px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{food.nombre}</div>
                        <div style={{ color: '#d97706', fontWeight: 600, fontSize: '10px', marginTop: '2px' }}>
                          {food.cantidad} {food.unidad}
                        </div>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 700, color: '#f59e0b' }}>{food.grasa}g Grasas</div>
                        <div style={{ color: '#64748b', fontSize: '9px', marginTop: '2px' }}>
                          {food.calorias} kcal
                        </div>
                      </td>
                      <td style={{ padding: '8px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {approvedOptions.map((opt, optIdx) => (
                            <div key={optIdx} style={{ lineHeight: 1.3, color: '#1e293b' }}>
                              • <strong style={{ color: '#0f172a' }}>{opt.cantidad} {opt.unidad}</strong> {opt.nombre}{' '}
                              <span style={{ color: '#64748b', fontSize: '9px' }}>
                                ({opt.calorias} kcal)
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PIE DE PÁGINA */}
      <div
        data-pdf-block="footer"
        style={{
          borderTop: '1px solid #e2e8f0',
          paddingTop: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '9px',
          color: '#94a3b8',
        }}
      >
        <span>Generado por Evolution Lab 3.0 • Alta Precisión en Entrenamiento y Nutrición</span>
        <span>Plan Nutricional Personalizado</span>
      </div>
    </div>
  );
};

export default NutritionReportPDF;
