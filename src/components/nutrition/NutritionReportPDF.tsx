import React from 'react';
import { NutritionPlan, NutritionDay } from '../../types/nutrition.types';
import { calculateMealTotals, calculateDayTotals } from '../../lib/nutritionEngine';
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

  const currentDay: NutritionDay | undefined =
    plan.datos_plan.days[activeDayKey] || Object.values(plan.datos_plan.days)[0];
  const dayTotals = calculateDayTotals(currentDay);

  const tCal = plan.target_calorias || 2000;
  const tProt = plan.target_proteina_g || 150;
  const tCarb = plan.target_carbohidratos_g || 200;
  const tFat = plan.target_grasa_g || 60;

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
            {currentDay?.nombre || 'General'}
          </div>
        </div>
      </div>

      {/* METAS DIARIAS (TARGETS) */}
      <div
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
            Prescritas: {dayTotals.calorias} kcal
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
            Prescritas: {dayTotals.proteina}g
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
            Prescritos: {dayTotals.carbohidratos}g
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
            Prescritas: {dayTotals.grasa}g
          </span>
        </div>
      </div>

      {/* DETALLE DE COMIDAS E INGESTAS */}
      <div style={{ marginBottom: '24px' }}>
        <h2
          style={{
            margin: '0 0 12px',
            fontSize: '14px',
            fontFamily: "'Orbitron', sans-serif",
            color: '#0f172a',
            letterSpacing: '1px',
            borderBottom: '1px solid #cbd5e1',
            paddingBottom: '4px',
          }}
        >
          DISTRIBUCIÓN DE COMIDAS ({currentDay?.nombre ? currentDay.nombre.toUpperCase() : 'PLAN'})
        </h2>

        {currentDay?.meals.map((meal) => {
          const mTotals = calculateMealTotals(meal.foods);
          const mealKcalPct = dayTotals.calorias > 0 ? Math.round((mTotals.calorias / dayTotals.calorias) * 100) : 0;

          return (
            <div
              key={meal.id}
              style={{
                marginBottom: '16px',
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
                  backgroundColor: '#f1f5f9',
                  padding: '8px 14px',
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
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
                <div style={{ padding: '10px 14px', fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                  No hay alimentos registrados en esta comida.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '6px 12px', width: '50%' }}>Alimento</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', width: '15%' }}>Porción</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', width: '9%' }}>Prot</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', width: '9%' }}>Carbs</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', width: '9%' }}>Grasa</th>
                      <th style={{ padding: '6px 12px', textAlign: 'right', width: '11%' }}>Kcal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meal.foods.map((food, fIdx) => (
                      <tr
                        key={food.id || fIdx}
                        style={{
                          borderTop: '1px solid #f1f5f9',
                          backgroundColor: fIdx % 2 === 0 ? '#ffffff' : '#fafafa',
                        }}
                      >
                        <td style={{ padding: '6px 12px', color: '#1e293b', fontWeight: 600 }}>
                          {food.nombre}
                          {food.notas && (
                            <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 400 }}>
                              {food.notas}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', color: '#475569' }}>
                          {food.cantidad} {food.unidad}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1d4ed8' }}>
                          {food.proteina}g
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#a16207' }}>
                          {food.carbohidratos}g
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#c2410c' }}>
                          {food.grasa}g
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
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

      {/* PAUTAS Y RECOMENDACIONES GENERALES */}
      {plan.recomendaciones && (
        <div
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            backgroundColor: '#f8fafc',
            padding: '14px 16px',
            marginBottom: '20px',
          }}
        >
          <h3
            style={{
              margin: '0 0 6px',
              fontSize: '12px',
              fontWeight: 800,
              fontFamily: "'Orbitron', sans-serif",
              color: '#0284c7',
            }}
          >
            📋 RECOMENDACIONES DEL ENTRENADOR
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              lineHeight: 1.6,
              color: '#334155',
              whiteSpace: 'pre-line',
            }}
          >
            {plan.recomendaciones}
          </p>
        </div>
      )}

      {/* PIE DE PÁGINA */}
      <div
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
        <span>Página 1 / 1</span>
      </div>
    </div>
  );
};

export default NutritionReportPDF;
