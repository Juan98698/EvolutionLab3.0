import React from 'react';
import { ValoracionAntropometrica, Profile } from '../../types/database.types';
import SomatochartCanvas from './SomatochartCanvas';
import FourMassesPieChart from './FourMassesPieChart';
import { getSomatotypeDiagnostic } from '../../lib/anthropometryEngine';

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

  // Diagnóstico del somatotipo para el cliente
  const somatoDiagnostic = getSomatotypeDiagnostic(
    valoracion.somatotipo?.endo || 0,
    valoracion.somatotipo?.meso || 0,
    valoracion.somatotipo?.ecto || 0,
    atletaNombre
  );

  return (
    <div
      id="anthropometry-pdf-report"
      style={{
        width: '800px',
        background: '#ffffff',
        color: '#1e293b',
        fontFamily: "'Inter', sans-serif",
        boxSizing: 'border-box',
      }}
    >
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PÁGINA 1: SOMATOCARTA, DIAGNÓSTICO Y GRÁFICO CIRCULAR DE 4 MASAS       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ padding: '32px', minHeight: '1080px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {/* Header Marca Blanca */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '14px', marginBottom: '20px' }}>
            <div>
              {trainerProfile?.logo_url ? (
                <img src={trainerProfile.logo_url} alt={brandName} style={{ height: '75px', maxHeight: '85px', maxWidth: '280px', objectFit: 'contain' }} />
              ) : (
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, letterSpacing: '1px', color: '#0f172a', fontFamily: 'Orbitron, sans-serif' }}>
                  {brandName}
                </h1>
              )}
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{brandEslogan}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>INFORME ANTROPOMÉTRICO (PÁG 1)</h2>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>Fecha: {valoracion.fecha}</p>
            </div>
          </div>

          {/* Datos del Valorado */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', marginBottom: '24px', fontSize: '12px' }}>
            <div><strong>Valorador:</strong> {trainerProfile?.nombre || brandName}</div>
            <div><strong>Atleta:</strong> {atletaNombre}</div>
            <div><strong>Edad:</strong> {valoracion.edad} años</div>
            <div><strong>Peso:</strong> {valoracion.peso} kg</div>
            <div><strong>Estatura:</strong> {valoracion.estatura} cm</div>
            <div><strong>IMC:</strong> {valoracion.imc} kg/m²</div>
            <div><strong>Método:</strong> {valoracion.metodo}</div>
            <div><strong>Objetivo:</strong> {valoracion.objetivo || 'Recomposición Corporal'}</div>
          </div>

          {/* Grid Principal Pág 1: Somatocarta vs Gráfico Circular */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '20px' }}>
            {/* Somatocarta con Maniquíes */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', background: '#fafafa', textAlign: 'center' }}>
              <SomatochartCanvas
                x={valoracion.somatotipo?.x || 0}
                y={valoracion.somatotipo?.y || 0}
                endo={valoracion.somatotipo?.endo || 0}
                meso={valoracion.somatotipo?.meso || 0}
                ecto={valoracion.somatotipo?.ecto || 0}
                width={330}
                height={260}
              />
            </div>

            {/* Gráfico Circular Torta (4 Masas) */}
            <FourMassesPieChart
              pesoTotal={valoracion.peso}
              kgMusculo={valoracion.kg_musculo || 0}
              pctMusculo={valoracion.pct_musculo || 0}
              kgGrasa={valoracion.kg_grasa || 0}
              pctGrasa={valoracion.pct_grasa || 0}
              kgOseo={valoracion.kg_oseo || 0}
              pctOseo={valoracion.pct_oseo || 0}
              kgResidual={valoracion.kg_residual || 0}
              pctResidual={valoracion.pct_residual || 0}
              size={240}
            />
          </div>

          {/* Diagnóstico Explicativo del Somatotipo para el Cliente */}
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 800, color: '#0369a1', fontFamily: 'Orbitron, sans-serif', display: 'flex', alignItems: 'center', gap: '6px' }}>
              💡 DIAGNÓSTICO EXPLICATIVO DEL BIOTIPO & SOMATOTIPO
            </h4>
            <p style={{ margin: 0, fontSize: '12px', color: '#0c4a6e', lineHeight: '1.5' }}>
              {somatoDiagnostic}
            </p>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', textAlign: 'center', fontSize: '10px', color: '#94a3b8' }}>
          Documento generado por {brandName} — Página 1 de 2
        </div>
      </div>

      {/* Salto de página para el PDF */}
      <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }}></div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PÁGINA 2: TABLAS DE MEDIDAS, TABLAS NORMATIVAS Y MACROS               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ padding: '32px', minHeight: '1080px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {/* Subencabezado Pág 2 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '10px', marginBottom: '20px' }}>
            <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a', textTransform: 'uppercase' }}>{atletaNombre} — MEDIDAS & TABLAS NORMATIVAS</span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Página 2 de 2</span>
          </div>

          {/* Grid de Medidas Físicas (Pliegues, Perímetros, Diámetros) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {/* Pliegues Cutáneos */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#334155', color: 'white', padding: '6px 10px', fontSize: '11px', fontWeight: 800 }}>PLIEGUES CUTÁNEOS (MM)</div>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Tríceps:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.pliegues?.triceps || 0} mm</td></tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Subescapular:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.pliegues?.subescapular || 0} mm</td></tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Suprailíaco:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.pliegues?.suprailiaco || 0} mm</td></tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Abdominal:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.pliegues?.abdominal || 0} mm</td></tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Muslo:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.pliegues?.muslo || 0} mm</td></tr>
                  <tr><td style={{ padding: '4px 8px' }}>Pantorrilla:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.pliegues?.pantorrilla || 0} mm</td></tr>
                </tbody>
              </table>
            </div>

            {/* Perímetros Corporales */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#334155', color: 'white', padding: '6px 10px', fontSize: '11px', fontWeight: 800 }}>PERÍMETROS (CM)</div>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Brazo:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.perimetros?.brazo || 0} cm</td></tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Brazo Contraído:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.perimetros?.brazo_contraido || 0} cm</td></tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Tórax:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.perimetros?.torax || 0} cm</td></tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Cintura:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.perimetros?.cintura || 0} cm</td></tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Cadera:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.perimetros?.cadera || 0} cm</td></tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Muslo:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.perimetros?.muslo || 0} cm</td></tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Pantorrilla:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.perimetros?.pantorrilla || 0} cm</td></tr>
                  {valoracion.perimetros?.cefalico ? (
                    <tr><td style={{ padding: '4px 8px' }}>Cefálico:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.perimetros?.cefalico} cm</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* Diámetros Óseos (6 campos exactos como la captura) */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#334155', color: 'white', padding: '6px 10px', fontSize: '11px', fontWeight: 800 }}>DIÁMETROS (CM)</div>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Codo:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.diametros?.codo || 0} cm</td></tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Rodilla:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.diametros?.rodilla || 0} cm</td></tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Biiliocrestal:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.diametros?.biiliocrestal || valoracion.diametros?.biliocrestal || 0} cm</td></tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Biacromial:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.diametros?.biacromial || 0} cm</td></tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Anteroposterior:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.diametros?.anteroposterior || 0} cm</td></tr>
                  <tr><td style={{ padding: '4px 8px' }}>Transversal:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.diametros?.transversal || 0} cm</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── TABLAS NORMATIVAS DE CLASIFICACIÓN ────────────────────────────────── */}
          {/* Tabla 2.1 — IMC (OMS) */}
          <div style={{ marginBottom: '18px' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>2.1 Índice de Masa Corporal (IMC) — OMS</h4>
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

          {/* Tabla 2.2.1 — % Grasa (ACE) */}
          <div style={{ marginBottom: '18px' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>2.2.1 Clasificación del % de Grasa Corporal — ACE</h4>
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

          {/* Tabla 2.2.2 — % Masa Muscular */}
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

          {/* Tarjetas de Prescripción Macronutrientes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
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
            TARGET CALÓRICO DIARIO: {valoracion.target_calorias} kcal / día
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', textAlign: 'center', fontSize: '10px', color: '#94a3b8' }}>
          Documento generado por {brandName} — Página 2 de 2
        </div>
      </div>
    </div>
  );
};

export default AnthropometryReportPDF;
