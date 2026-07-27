import React from 'react';
import { ValoracionAntropometrica, Profile } from '../../types/database.types';
import SomatochartCanvas from './SomatochartCanvas';

interface AnthropometryReportPDFProps {
  valoracion: ValoracionAntropometrica;
  atletaNombre: string;
  trainerProfile: Profile | null;
}

export const AnthropometryReportPDF: React.FC<AnthropometryReportPDFProps> = ({
  valoracion,
  atletaNombre,
  trainerProfile,
}) => {
  const brandName = trainerProfile?.marca?.nombre_display || trainerProfile?.nombre || 'EVOLUTION LAB';
  const brandEslogan = trainerProfile?.marca?.eslogan || 'Sistemas de Entrenamiento & Nutrición de Alta Precisión';

  const imc = valoracion.imc || 0;
  const pctGrasa = valoracion.pct_grasa || 0;
  const pctMusculo = valoracion.pct_musculo || 0;

  return (
    <div
      id="anthropometry-pdf-report"
      style={{
        width: '800px',
        padding: '32px',
        background: '#ffffff',
        color: '#1e293b',
        fontFamily: "'Inter', sans-serif",
        boxSizing: 'border-box',
      }}
    >
      {/* Header Marca Blanca del Entrenador */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '20px' }}>
        <div>
          {trainerProfile?.logo_url ? (
            <img src={trainerProfile.logo_url} alt={brandName} style={{ height: '48px', objectFit: 'contain' }} />
          ) : (
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900, letterSpacing: '1px', color: '#0f172a', fontFamily: 'Orbitron, sans-serif' }}>
              {brandName}
            </h1>
          )}
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>{brandEslogan}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>INFORME ANTROPOMÉTRICO</h2>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>Fecha: {valoracion.fecha}</p>
        </div>
      </div>

      {/* Datos del Valorado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', marginBottom: '20px', fontSize: '12px' }}>
        <div><strong>Atleta:</strong> {atletaNombre}</div>
        <div><strong>Edad:</strong> {valoracion.edad} años</div>
        <div><strong>Peso:</strong> {valoracion.peso} kg</div>
        <div><strong>Estatura:</strong> {valoracion.estatura} cm</div>
        <div><strong>IMC:</strong> {valoracion.imc} kg/m²</div>
        <div><strong>Método:</strong> {valoracion.metodo}</div>
        <div style={{ gridColumn: 'span 2' }}><strong>Objetivo:</strong> {valoracion.objetivo || 'Recomposición Corporal'}</div>
      </div>

      {/* Grid Central: Somatocarta + Composición 4 Masas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Somatocarta */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>SOMATOCARTA HEATH-CARTER</h4>
          <SomatochartCanvas
            x={valoracion.somatotipo?.x || 0}
            y={valoracion.somatotipo?.y || 0}
            endo={valoracion.somatotipo?.endo || 0}
            meso={valoracion.somatotipo?.meso || 0}
            ecto={valoracion.somatotipo?.ecto || 0}
            width={320}
            height={240}
          />
        </div>

        {/* Desglose de 4 Masas */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>COMPOSICIÓN CORPORAL (4 MASAS)</h4>
          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px 0', color: '#ef4444', fontWeight: 700 }}>Masa Muscular:</td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 800 }}>{valoracion.kg_musculo} kg ({valoracion.pct_musculo}%)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px 0', color: '#d97706', fontWeight: 700 }}>Masa Grasa:</td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 800 }}>{valoracion.kg_grasa} kg ({valoracion.pct_grasa}%)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px 0', color: '#854d0e', fontWeight: 700 }}>Masa Ósea:</td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 800 }}>{valoracion.kg_oseo} kg ({valoracion.pct_oseo}%)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '6px 0', color: '#3b82f6', fontWeight: 700 }}>Masa Residual:</td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 800 }}>{valoracion.kg_residual} kg ({valoracion.pct_residual}%)</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0 0', fontWeight: 800, color: '#0f172a' }}>Ratio M/G:</td>
                <td style={{ padding: '8px 0 0', textAlign: 'right', fontWeight: 900, color: '#2563eb' }}>{valoracion.ratio_musculo_grasa}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── TABLAS NORMATIVAS DE CLASIFICACIÓN (REQUISITO USUARIO) ──────────────── */}

      {/* Tabla 2.1 — Índice de Masa Corporal (IMC - OMS) */}
      <div style={{ marginBottom: '18px' }}>
        <h4 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>2.1 Índice de Masa Corporal (IMC) — Organización Mundial de la Salud</h4>
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', border: '1px solid #cbd5e1' }}>
          <thead>
            <tr style={{ background: '#334155', color: 'white' }}>
              <th style={{ padding: '5px 8px', textAlign: 'left' }}>Clasificación</th>
              <th style={{ padding: '5px 8px', textAlign: 'left' }}>Rango IMC (kg/m²)</th>
              <th style={{ padding: '5px 8px', textAlign: 'left' }}>Valoración</th>
            </tr>
          </thead>
          <tbody>
            {[
              { cat: 'Bajo peso', range: '< 18.5', min: 0, max: 18.49 },
              { cat: 'Normal', range: '18.5 – 24.9', min: 18.5, max: 24.99 },
              { cat: 'Sobrepeso', range: '25.0 – 29.9', min: 25.0, max: 29.99 },
              { cat: 'Obesidad grado I', range: '30.0 – 34.9', min: 30.0, max: 34.99 },
              { cat: 'Obesidad grado II', range: '35.0 – 39.9', min: 35.0, max: 39.99 },
              { cat: 'Obesidad grado III', range: '≥ 40.0', min: 40.0, max: 999 },
            ].map((row, i) => {
              const isMatch = imc >= row.min && imc <= row.max;
              return (
                <tr key={i} style={{ background: isMatch ? '#e0f2fe' : 'transparent', fontWeight: isMatch ? 800 : 400, borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '4px 8px' }}>{row.cat}</td>
                  <td style={{ padding: '4px 8px' }}>{row.range}</td>
                  <td style={{ padding: '4px 8px', color: isMatch ? '#0284c7' : '#64748b' }}>
                    {isMatch ? `◄ ${atletaNombre} (${imc})` : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tabla 2.2.1 — Clasificación % Grasa Corporal (ACE) */}
      <div style={{ marginBottom: '18px' }}>
        <h4 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>2.2.1 Clasificación del % de Grasa Corporal — American Council on Exercise (ACE)</h4>
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', border: '1px solid #cbd5e1' }}>
          <thead>
            <tr style={{ background: '#334155', color: 'white' }}>
              <th style={{ padding: '5px 8px', textAlign: 'left' }}>Clasificación</th>
              <th style={{ padding: '5px 8px', textAlign: 'left' }}>Rango % Grasa</th>
              <th style={{ padding: '5px 8px', textAlign: 'left' }}>Valoración</th>
            </tr>
          </thead>
          <tbody>
            {[
              { cat: 'Grasa esencial', range: '10 – 13 %' },
              { cat: 'Atletas', range: '14 – 20 %' },
              { cat: 'Buena forma física (fitness)', range: '21 – 24 %' },
              { cat: 'Aceptable', range: '25 – 31 %' },
              { cat: 'Obesidad', range: '≥ 32 %' },
            ].map((row, i) => {
              const isMatch = valoracion.clasificacion_grasa?.toLowerCase().includes(row.cat.toLowerCase());
              return (
                <tr key={i} style={{ background: isMatch ? '#fef3c7' : 'transparent', fontWeight: isMatch ? 800 : 400, borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '4px 8px' }}>{row.cat}</td>
                  <td style={{ padding: '4px 8px' }}>{row.range}</td>
                  <td style={{ padding: '4px 8px', color: isMatch ? '#d97706' : '#64748b' }}>
                    {isMatch ? `◄ ${atletaNombre} (${pctGrasa}%)` : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tabla 2.2.2 — Clasificación del % de Masa Muscular */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>2.2.2 Clasificación del % de Masa Muscular</h4>
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', border: '1px solid #cbd5e1' }}>
          <thead>
            <tr style={{ background: '#334155', color: 'white' }}>
              <th style={{ padding: '5px 8px', textAlign: 'left' }}>Clasificación</th>
              <th style={{ padding: '5px 8px', textAlign: 'left' }}>Rango % Muscular</th>
              <th style={{ padding: '5px 8px', textAlign: 'left' }}>Valoración</th>
            </tr>
          </thead>
          <tbody>
            {[
              { cat: 'Bajo', range: '< 28 %' },
              { cat: 'Promedio', range: '28 – 34 %' },
              { cat: 'Bueno', range: '34 – 38 %' },
              { cat: 'Alto', range: '> 38 %' },
            ].map((row, i) => {
              const isMatch = valoracion.clasificacion_musculo?.toLowerCase().includes(row.cat.toLowerCase());
              return (
                <tr key={i} style={{ background: isMatch ? '#dcfce7' : 'transparent', fontWeight: isMatch ? 800 : 400, borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '4px 8px' }}>{row.cat}</td>
                  <td style={{ padding: '4px 8px' }}>{row.range}</td>
                  <td style={{ padding: '4px 8px', color: isMatch ? '#16a34a' : '#64748b' }}>
                    {isMatch ? `◄ ${atletaNombre} (${pctMusculo}%)` : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Metabolismo y Macronutrientes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 700 }}>PROTEÍNA ({valoracion.macros?.proteina.gPerKg} g/kg)</span>
          <h3 style={{ margin: '4px 0 0', color: '#1d4ed8', fontSize: '16px', fontWeight: 900 }}>{valoracion.macros?.proteina.grams} g</h3>
          <span style={{ fontSize: '10px', color: '#3b82f6' }}>{valoracion.macros?.proteina.calories} kcal ({valoracion.macros?.proteina.percentage}%)</span>
        </div>
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', color: '#92400e', fontWeight: 700 }}>GRASA ({valoracion.macros?.grasa.gPerKg} g/kg)</span>
          <h3 style={{ margin: '4px 0 0', color: '#b45309', fontSize: '16px', fontWeight: 900 }}>{valoracion.macros?.grasa.grams} g</h3>
          <span style={{ fontSize: '10px', color: '#d97706' }}>{valoracion.macros?.grasa.calories} kcal ({valoracion.macros?.grasa.percentage}%)</span>
        </div>
        <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', color: '#166534', fontWeight: 700 }}>CARBOHIDRATOS ({valoracion.macros?.carbohidratos.gPerKg} g/kg)</span>
          <h3 style={{ margin: '4px 0 0', color: '#15803d', fontSize: '16px', fontWeight: 900 }}>{valoracion.macros?.carbohidratos.grams} g</h3>
          <span style={{ fontSize: '10px', color: '#16a34a' }}>{valoracion.macros?.carbohidratos.calories} kcal ({valoracion.macros?.carbohidratos.percentage}%)</span>
        </div>
      </div>

      <div style={{ textAlign: 'center', background: '#0f172a', color: 'white', borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 800 }}>
        OBJETIVO CALÓRICO DIARIO: {valoracion.target_calorias} kcal / día
      </div>
    </div>
  );
};

export default AnthropometryReportPDF;
