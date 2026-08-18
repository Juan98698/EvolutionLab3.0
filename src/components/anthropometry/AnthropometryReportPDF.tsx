import React from 'react';
import { ValoracionAntropometrica, Profile } from '../../types/database.types';
import SomatochartCanvas from './SomatochartCanvas';
import FourMassesPieChart from './FourMassesPieChart';
import {
  getSomatotypeDiagnostic,
  classifyMuscleFatRatio,
  calculateWaterRequirement,
  calculateCardiometabolicRisk,
} from '../../lib/anthropometryEngine';

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

  const pctGrasa = valoracion.pct_grasa || 0;
  const pctMusculo = valoracion.pct_musculo || 0;
  const isFemenino = valoracion.genero === 'femenino';
  const generoStr = isFemenino ? 'Mujeres' : 'Hombres';
  const diametros = (valoracion.diametros || {}) as any;

  const ratioVal = valoracion.ratio_musculo_grasa || 0;
  const ratioInfo = classifyMuscleFatRatio(ratioVal, valoracion.genero || 'masculino');
  const waterStr = valoracion.agua_recomendada_l || calculateWaterRequirement(valoracion.peso, valoracion.frecuencia_entreno || '3-4').rangoStr;

  const cardioResult = calculateCardiometabolicRisk(
    valoracion.perimetros?.cintura || 0,
    valoracion.perimetros?.cadera,
    valoracion.estatura || 170,
    valoracion.genero || 'masculino',
    atletaNombre,
    valoracion.metodo || 'ISAK'
  );

  const fatRows = isFemenino
    ? [
        { cat: 'Grasa esencial', range: '10 – 13 %', min: 0, max: 13.99 },
        { cat: 'Atletas', range: '14 – 20 %', min: 14, max: 20.99 },
        { cat: 'Buena forma física (fitness)', range: '21 – 24 %', min: 21, max: 24.99 },
        { cat: 'Aceptable', range: '25 – 31 %', min: 25, max: 31.99 },
        { cat: 'Obesidad', range: '≥ 32 %', min: 32, max: 999 },
      ]
    : [
        { cat: 'Grasa esencial', range: '2 – 5 %', min: 0, max: 5.99 },
        { cat: 'Atletas', range: '6 – 13 %', min: 6, max: 13.99 },
        { cat: 'Buena forma física (fitness)', range: '14 – 17 %', min: 14, max: 17.99 },
        { cat: 'Aceptable', range: '18 – 24 %', min: 18, max: 24.99 },
        { cat: 'Obesidad', range: '≥ 25 %', min: 25, max: 999 },
      ];

  const muscleRows = isFemenino
    ? [
        { cat: 'Bajo', range: '< 28 %', min: 0, max: 27.9 },
        { cat: 'Promedio', range: '28 – 34 %', min: 28, max: 34.0 },
        { cat: 'Bueno', range: '34 – 38 %', min: 34.1, max: 38.0 },
        { cat: 'Alto', range: '> 38 %', min: 38.1, max: 999 },
      ]
    : [
        { cat: 'Bajo', range: '< 32 %', min: 0, max: 31.9 },
        { cat: 'Promedio', range: '32 – 38 %', min: 32, max: 38.0 },
        { cat: 'Bueno', range: '38 – 44 %', min: 38.1, max: 44.0 },
        { cat: 'Alto', range: '> 44 %', min: 44.1, max: 999 },
      ];

  const cardioRows = isFemenino
    ? [
        { cat: '🟢 Óptimo / Bajo Riesgo', range: '< 80.0 cm', whtr: '< 0.50', fuente: 'ALAD / IDF', isCurrent: cardioResult.categoria === 'Óptimo / Bajo Riesgo' },
        { cat: '🟡 Riesgo Elevado (ALAD / IDF / WHtR)', range: '80.0 – 87.9 cm', whtr: '≥ 0.50', fuente: 'ALAD / IDF / WHtR', isCurrent: cardioResult.categoria === 'Riesgo Elevado (ALAD / IDF / WHtR)' },
        { cat: '🔴 Riesgo Muy Elevado (ATP III / OMS)', range: '≥ 88.0 cm', whtr: 'Independiente', fuente: 'NCEP-ATP III / OMS', isCurrent: cardioResult.categoria === 'Riesgo Muy Elevado (ATP III / OMS)' },
      ]
    : [
        { cat: '🟢 Óptimo / Bajo Riesgo', range: '< 90.0 cm', whtr: '< 0.50', fuente: 'ALAD / IDF', isCurrent: cardioResult.categoria === 'Óptimo / Bajo Riesgo' },
        { cat: '🟡 Riesgo Elevado (ALAD / IDF / WHtR)', range: '90.0 – 101.9 cm', whtr: '≥ 0.50', fuente: 'ALAD / IDF / WHtR', isCurrent: cardioResult.categoria === 'Riesgo Elevado (ALAD / IDF / WHtR)' },
        { cat: '🔴 Riesgo Muy Elevado (ATP III / OMS)', range: '≥ 102.0 cm', whtr: 'Independiente', fuente: 'NCEP-ATP III / OMS', isCurrent: cardioResult.categoria === 'Riesgo Muy Elevado (ATP III / OMS)' },
      ];

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
        background: '#e2e8f0',
        color: '#1e293b',
        fontFamily: "'Inter', sans-serif",
        boxSizing: 'border-box',
      }}
    >
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PÁGINA 1: SOMATOCARTA, DIAGNÓSTICO Y GRÁFICO CIRCULAR DE 4 MASAS       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div
        id="anthropometry-pdf-page-1"
        style={{
          width: '800px',
          padding: '32px 36px',
          background: '#ffffff',
          boxSizing: 'border-box',
          marginBottom: '16px',
        }}
      >
        {/* Header Marca Blanca */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '14px', marginBottom: '20px' }}>
          <div>
            {trainerProfile?.logo_url ? (
              <img src={trainerProfile.logo_url} alt={brandName} style={{ height: '115px', maxHeight: '130px', maxWidth: '380px', objectFit: 'contain' }} />
            ) : (
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, letterSpacing: '1px', color: '#0f172a', fontFamily: 'Orbitron, sans-serif' }}>
                {brandName}
              </h1>
            )}
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{brandEslogan}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>INFORME ANTROPOMÉTRICO (PÁG 1)</h2>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>Fecha: {valoracion.fecha}</p>
          </div>
        </div>

        {/* Datos del Valorado */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', marginBottom: '14px', fontSize: '11px' }}>
          <div><strong>Valorador:</strong> {trainerProfile?.nombre || brandName}</div>
          <div><strong>Atleta:</strong> {atletaNombre}</div>
          <div><strong>Edad:</strong> {valoracion.edad} años</div>
          <div><strong>Peso:</strong> {valoracion.peso} kg</div>
          <div><strong>Estatura:</strong> {valoracion.estatura} cm</div>
          {valoracion.metodo === 'ISAK' && valoracion.estatura_sentado ? (
            <div><strong>Estatura Sentado:</strong> {valoracion.estatura_sentado} cm</div>
          ) : null}
          <div><strong>IMC:</strong> {valoracion.imc} kg/m²</div>
          <div><strong>Método:</strong> {valoracion.metodo}</div>
          <div><strong>Frecuencia:</strong> {valoracion.frecuencia_entreno ? `${valoracion.frecuencia_entreno} días/sem` : '3-4 días/sem'}</div>
          <div><strong>Objetivo:</strong> {valoracion.objetivo || 'Recomposición Corporal'}</div>
        </div>

        {/* Destacados de Composición Corporal & Salud */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚖️ Ratio Músculo / Grasa</span>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                {ratioVal} <span style={{ fontSize: '11px', color: ratioInfo.color, fontWeight: 800 }}>({ratioInfo.nivel})</span>
              </div>
              <div style={{ fontSize: '10px', color: '#334155', fontWeight: 600, marginTop: '3px' }}>
                Tienes <strong>{ratioVal} kg</strong> de músculo por cada <strong>1 kg</strong> de grasa.
              </div>
            </div>
            <div style={{ fontSize: '10px', color: '#475569', textAlign: 'right', maxWidth: '140px', lineHeight: '1.3' }}>
              {ratioInfo.desc}
            </div>
          </div>

          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#0369a1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>💧 Requerimiento Hídrico Diario</span>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
                {waterStr}
              </div>
            </div>
            <div style={{ fontSize: '10px', color: '#0369a1', textAlign: 'right', maxWidth: '150px', lineHeight: '1.3' }}>
              Estimado según {valoracion.peso} kg de peso y actividad física.
            </div>
          </div>
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
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 800, color: '#0369a1', fontFamily: 'Orbitron, sans-serif', display: 'flex', alignItems: 'center', gap: '6px' }}>
            💡 DIAGNÓSTICO EXPLICATIVO DEL BIOTIPO & SOMATOTIPO
          </h4>
          <p style={{ margin: 0, fontSize: '12px', color: '#0c4a6e', lineHeight: '1.5' }}>
            {somatoDiagnostic}
          </p>
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', textAlign: 'center', fontSize: '10px', color: '#94a3b8' }}>
          Documento generado por {brandName} — Página 1 de 3
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PÁGINA 2: TABLAS DE MEDIDAS, TABLAS NORMATIVAS Y MACROS               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div
        id="anthropometry-pdf-page-2"
        style={{
          width: '800px',
          padding: '32px 36px',
          background: '#ffffff',
          boxSizing: 'border-box',
          marginBottom: '16px',
        }}
      >
        {/* Subencabezado Pág 2 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '10px', marginBottom: '20px' }}>
          <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a', textTransform: 'uppercase' }}>{atletaNombre} — MEDIDAS & TABLAS NORMATIVAS</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Página 2 de 3</span>
        </div>

        {/* Grid de Medidas Físicas (Pliegues, Perímetros, Diámetros) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
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
                <tr><td style={{ padding: '4px 8px' }}>Pantorrilla:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{valoracion.perimetros?.pantorrilla || 0} cm</td></tr>
              </tbody>
            </table>
          </div>

          {/* Diámetros */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ background: '#334155', color: 'white', padding: '6px 10px', fontSize: '11px', fontWeight: 800 }}>DIÁMETROS (CM)</div>
            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Codo:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{diametros?.codo || 0} cm</td></tr>
                <tr style={{ borderBottom: valoracion.metodo === 'ISAK' ? '1px solid #f1f5f9' : 'none' }}><td style={{ padding: '4px 8px' }}>Rodilla:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{diametros?.rodilla || 0} cm</td></tr>
                {valoracion.metodo === 'ISAK' ? (
                  <>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Anteroposterior (Muñeca):</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{diametros?.anteroposterior || 0} cm</td></tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Biiliocrestal:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{diametros?.biiliocrestal || 0} cm</td></tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '4px 8px' }}>Biacromial:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{diametros?.biacromial || 0} cm</td></tr>
                    <tr><td style={{ padding: '4px 8px' }}>Transversal:</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{diametros?.transversal || 0} cm</td></tr>
                  </>
                ) : (
                  <tr><td style={{ padding: '4px 8px' }}>Anteroposterior (Muñeca):</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{diametros?.anteroposterior || 0} cm</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Índice de Masa Corporal (IMC) — OMS */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>Índice de Masa Corporal (IMC) — OMS</h4>
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
                const isMatch = valoracion.clasificacion_imc
                  ? row.cat.toLowerCase() === valoracion.clasificacion_imc.toLowerCase()
                  : (valoracion.imc || 0) >= row.min && (valoracion.imc || 0) <= row.max;
                return (
                  <tr key={i} style={{ background: isMatch ? '#e0f2fe' : 'transparent', fontWeight: isMatch ? 800 : 400, borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '4px 8px' }}>{row.cat}</td>
                    <td style={{ padding: '4px 8px' }}>{row.range}</td>
                    <td style={{ padding: '4px 8px', color: isMatch ? '#0284c7' : '#64748b' }}>
                      {isMatch ? `◄ ${atletaNombre} (${valoracion.imc || 0})` : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Clasificación del % de Grasa Corporal — ACE */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
            Clasificación del % de Grasa Corporal — ACE ({generoStr})
          </h4>
          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', border: '1px solid #cbd5e1' }}>
            <thead>
              <tr style={{ background: '#334155', color: 'white' }}>
                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Clasificación</th>
                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Rango % Grasa</th>
                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Valoración</th>
              </tr>
            </thead>
            <tbody>
              {fatRows.map((r, i) => {
                const isMatch = pctGrasa >= r.min && pctGrasa <= r.max;
                return (
                  <tr
                    key={i}
                    style={{
                      background: isMatch ? '#fef3c7' : 'transparent',
                      fontWeight: isMatch ? 800 : 400,
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    <td style={{ padding: '4px 8px' }}>{r.cat}</td>
                    <td style={{ padding: '4px 8px' }}>{r.range}</td>
                    <td style={{ padding: '4px 8px', color: isMatch ? '#d97706' : '#64748b', fontWeight: isMatch ? 800 : 400 }}>
                      {isMatch ? `◄ ${atletaNombre} (${pctGrasa}%)` : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Clasificación del % de Masa Muscular */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
            Clasificación del % de Masa Muscular ({generoStr})
          </h4>
          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', border: '1px solid #cbd5e1' }}>
            <thead>
              <tr style={{ background: '#334155', color: 'white' }}>
                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Clasificación</th>
                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Rango % Muscular</th>
                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Valoración</th>
              </tr>
            </thead>
            <tbody>
              {muscleRows.map((r, i) => {
                const isMatch = pctMusculo >= r.min && pctMusculo <= r.max;
                return (
                  <tr
                    key={i}
                    style={{
                      background: isMatch ? '#dcfce7' : 'transparent',
                      fontWeight: isMatch ? 800 : 400,
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    <td style={{ padding: '4px 8px' }}>{r.cat}</td>
                    <td style={{ padding: '4px 8px' }}>{r.range}</td>
                    <td style={{ padding: '4px 8px', color: isMatch ? '#15803d' : '#64748b', fontWeight: isMatch ? 800 : 400 }}>
                      {isMatch ? `◄ ${atletaNombre} (${pctMusculo}%)` : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Sección de Prescripción Nutricional / Macronutrientes */}
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', fontFamily: 'Orbitron, sans-serif' }}>
              📊 PRESCRIPCIÓN NUTRICIONAL & METABOLISMO
            </span>
            <span style={{ fontSize: '11px', color: '#475569' }}>
              TMB: <strong>{(valoracion as any).tmb || valoracion.bmr || 0} kcal</strong> | TDEE: <strong>{valoracion.tdee} kcal</strong>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '10px' }}>
            <div style={{ background: '#dbeafe', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
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
            OBJETIVO DE LA DIETA: {valoracion.target_calorias} KCAL / DÍA
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', textAlign: 'center', fontSize: '10px', color: '#94a3b8' }}>
          Documento generado por {brandName} — Página 2 de 3
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PÁGINA 3: SALUD CARDIOMETABÓLICA Y PERÍMETRO VISCERAL (ALAD/IDF/ATP III) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div
        id="anthropometry-pdf-page-3"
        style={{
          width: '800px',
          padding: '32px 36px',
          background: '#ffffff',
          boxSizing: 'border-box',
        }}
      >
        {/* Subencabezado Pág 3 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '10px', marginBottom: '20px' }}>
          <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a', textTransform: 'uppercase' }}>{atletaNombre} — SALUD CARDIOMETABÓLICA Y VISCERAL</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Página 3 de 3</span>
        </div>

        {/* Tarjetas Destacadas de Marcadores Cardiometabólicos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
          <div style={{
            background: !cardioResult.cinturaRegistrada ? '#f8fafc' : cardioResult.nivelRiesgo === 'alto' ? '#fef2f2' : cardioResult.nivelRiesgo === 'moderado' ? '#fffbeb' : '#f0fdf4',
            border: `1px solid ${!cardioResult.cinturaRegistrada ? '#cbd5e1' : cardioResult.nivelRiesgo === 'alto' ? '#fecaca' : cardioResult.nivelRiesgo === 'moderado' ? '#fef3c7' : '#bbf7d0'}`,
            borderRadius: '10px',
            padding: '12px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Perímetro de Cintura</span>
            <div style={{
              fontSize: !cardioResult.cinturaRegistrada ? '14px' : '18px',
              fontWeight: 900,
              color: !cardioResult.cinturaRegistrada ? '#64748b' : cardioResult.nivelRiesgo === 'alto' ? '#dc2626' : cardioResult.nivelRiesgo === 'moderado' ? '#d97706' : '#16a34a',
              marginTop: '4px'
            }}>
              {cardioResult.cinturaRegistrada ? `${cardioResult.cintura} cm` : 'Sin registrar'}
            </div>
            <span style={{ fontSize: '9px', color: '#475569', fontWeight: 600 }}>Corte Étnico: {isFemenino ? '<80.0 cm' : '<90.0 cm'}</span>
          </div>

          <div style={{
            background: !cardioResult.cinturaRegistrada ? '#f8fafc' : cardioResult.whtrAlerta ? '#fffbeb' : '#f0fdf4',
            border: `1px solid ${!cardioResult.cinturaRegistrada ? '#cbd5e1' : cardioResult.whtrAlerta ? '#fef3c7' : '#bbf7d0'}`,
            borderRadius: '10px',
            padding: '12px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Índice Cintura / Estatura (WHtR)</span>
            <div style={{
              fontSize: !cardioResult.cinturaRegistrada ? '14px' : '18px',
              fontWeight: 900,
              color: !cardioResult.cinturaRegistrada ? '#64748b' : cardioResult.whtrAlerta ? '#d97706' : '#16a34a',
              marginTop: '4px'
            }}>
              {cardioResult.cinturaRegistrada ? cardioResult.whtr : 'N/A'}
            </div>
            <span style={{ fontSize: '9px', color: '#475569', fontWeight: 600 }}>{cardioResult.whtrCategoria}</span>
          </div>

          <div style={{
            background: !cardioResult.cinturaRegistrada ? '#f8fafc' : cardioResult.iccCategoria.includes('Androide') ? '#fef2f2' : '#f8fafc',
            border: `1px solid ${!cardioResult.cinturaRegistrada ? '#cbd5e1' : cardioResult.iccCategoria.includes('Androide') ? '#fecaca' : '#cbd5e1'}`,
            borderRadius: '10px',
            padding: '12px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Índice Cintura / Cadera (ICC)</span>
            <div style={{
              fontSize: !cardioResult.cinturaRegistrada || cardioResult.icc === null ? '14px' : '18px',
              fontWeight: 900,
              color: !cardioResult.cinturaRegistrada ? '#64748b' : cardioResult.iccCategoria.includes('Androide') ? '#dc2626' : '#0f172a',
              marginTop: '4px'
            }}>
              {cardioResult.icc != null ? cardioResult.icc : 'N/A'}
            </div>
            <span style={{ fontSize: '9px', color: '#475569', fontWeight: 600 }}>{cardioResult.iccCategoria}</span>
          </div>
        </div>

        {/* Tabla Normativa de Riesgo Visceral & Étnico */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ background: '#0f172a', color: 'white', padding: '8px 12px', fontSize: '12px', fontWeight: 800, fontFamily: 'Orbitron, sans-serif' }}>
            🫀 TABLA NORMATIVA DE SALUD CARDIOMETABÓLICA Y VISCERAL ({generoStr.toUpperCase()})
          </div>
          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#334155', color: 'white', textTransform: 'uppercase', fontSize: '10px' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Categoría de Riesgo</th>
                <th style={{ padding: '6px 8px', textAlign: 'center' }}>Cintura Absoluta</th>
                <th style={{ padding: '6px 8px', textAlign: 'center' }}>Criterio WHtR</th>
                <th style={{ padding: '6px 8px', textAlign: 'center' }}>Fuente</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Valoración</th>
              </tr>
            </thead>
            <tbody>
              {cardioRows.map((r, i) => {
                const isActive = cardioResult.cinturaRegistrada && r.isCurrent;
                const activeColor = i === 2 ? '#dc2626' : i === 1 ? '#d97706' : '#15803d';
                const activeBg = i === 2 ? '#fef2f2' : i === 1 ? '#fffbeb' : '#f0fdf4';
                return (
                  <tr
                    key={i}
                    style={{
                      background: isActive ? activeBg : i % 2 === 0 ? '#ffffff' : '#f8fafc',
                      fontWeight: isActive ? 800 : 400,
                      color: isActive ? activeColor : '#334155',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    <td style={{ padding: '6px 8px' }}>{r.cat}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{r.range}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>{r.whtr}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: '10px', color: '#64748b' }}>{r.fuente}</td>
                    <td style={{ padding: '6px 8px', color: isActive ? activeColor : '#64748b', fontWeight: isActive ? 800 : 400 }}>
                      {isActive ? `◄ ${atletaNombre} (${cardioResult.cintura} cm)` : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Recuadro de Diagnóstico Metabólico Poblacional Explicativo */}
        <div style={{
          background: !cardioResult.cinturaRegistrada ? '#f8fafc' : cardioResult.nivelRiesgo === 'alto' ? '#fef2f2' : cardioResult.nivelRiesgo === 'moderado' ? '#fffbeb' : '#f0fdf4',
          border: `1px solid ${!cardioResult.cinturaRegistrada ? '#cbd5e1' : cardioResult.nivelRiesgo === 'alto' ? '#fecaca' : cardioResult.nivelRiesgo === 'moderado' ? '#fef3c7' : '#bbf7d0'}`,
          borderRadius: '10px',
          padding: '12px 14px',
          marginBottom: '16px'
        }}>
          <h4 style={{
            margin: '0 0 6px',
            fontSize: '12px',
            fontWeight: 800,
            color: !cardioResult.cinturaRegistrada ? '#475569' : cardioResult.nivelRiesgo === 'alto' ? '#991b1b' : cardioResult.nivelRiesgo === 'moderado' ? '#92400e' : '#166534',
            fontFamily: 'Orbitron, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            💡 DIAGNÓSTICO CLÍNICO POBLACIONAL DE ADIPOSIDAD VISCERAL
          </h4>
          <p style={{
            margin: 0,
            fontSize: '11px',
            color: !cardioResult.cinturaRegistrada ? '#475569' : cardioResult.nivelRiesgo === 'alto' ? '#7f1d1d' : cardioResult.nivelRiesgo === 'moderado' ? '#78350f' : '#14532d',
            lineHeight: '1.5'
          }}>
            {cardioResult.diagnosticoText}
          </p>
        </div>

        {/* Glosario de Siglas y Estándares Científicos Internacionales */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '10px',
          padding: '12px 14px',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
            <h4 style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#0f172a', fontFamily: 'Orbitron, sans-serif', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📚 GLOSARIO DE SIGLAS & ESTÁNDARES CIENTÍFICOS
            </h4>
            <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 600 }}>Guía de Interpretación Clínica</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px' }}>
            {/* ALAD */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '8.5px', fontWeight: 900, padding: '1px 4px', borderRadius: '3px' }}>ALAD</span>
                <strong style={{ fontSize: '9.5px', color: '#0f172a' }}>Asoc. Latinoamericana Diabetes</strong>
              </div>
              <p style={{ margin: 0, fontSize: '8.5px', color: '#475569', lineHeight: '1.3' }}>
                Cortes de cintura específicos (&lt;80 cm ♀ / &lt;90 cm ♂) por mayor predisposición hispana a grasa visceral.
              </p>
            </div>

            {/* WHtR */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '8.5px', fontWeight: 900, padding: '1px 4px', borderRadius: '3px' }}>WHtR</span>
                <strong style={{ fontSize: '9.5px', color: '#0f172a' }}>Waist-to-Height Ratio</strong>
              </div>
              <p style={{ margin: 0, fontSize: '8.5px', color: '#475569', lineHeight: '1.3' }}>
                Índice Cintura/Estatura. Regla universal: cintura menor a la mitad de la estatura (&lt;0.50) para proteger el corazón.
              </p>
            </div>

            {/* ATP III / OMS */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '8.5px', fontWeight: 900, padding: '1px 4px', borderRadius: '3px' }}>ATP III / OMS</span>
                <strong style={{ fontSize: '9.5px', color: '#0f172a' }}>Adult Treatment & OMS</strong>
              </div>
              <p style={{ margin: 0, fontSize: '8.5px', color: '#475569', lineHeight: '1.3' }}>
                Criterios internacionales para detectar síndrome metabólico y riesgo visceral elevado (≥88 cm ♀ / ≥102 cm ♂).
              </p>
            </div>

            {/* NCEP-ATP */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <span style={{ background: '#f1f5f9', color: '#334155', fontSize: '8.5px', fontWeight: 900, padding: '1px 4px', borderRadius: '3px' }}>NCEP-ATP</span>
                <strong style={{ fontSize: '9.5px', color: '#0f172a' }}>Natl. Cholesterol Program</strong>
              </div>
              <p style={{ margin: 0, fontSize: '8.5px', color: '#475569', lineHeight: '1.3' }}>
                Comité de referencia en estratificación del riesgo coronario, aterogénico y adiposidad intraabdominal.
              </p>
            </div>

            {/* ACE */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '8.5px', fontWeight: 900, padding: '1px 4px', borderRadius: '3px' }}>ACE</span>
                <strong style={{ fontSize: '9.5px', color: '#0f172a' }}>American Council Exercise</strong>
              </div>
              <p style={{ margin: 0, fontSize: '8.5px', color: '#475569', lineHeight: '1.3' }}>
                Escala estándar para clasificar los rangos de % de grasa corporal según sexo y condición física atlética.
              </p>
            </div>

            {/* IOF / IDF */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <span style={{ background: '#f3e8ff', color: '#7e22ce', fontSize: '8.5px', fontWeight: 900, padding: '1px 4px', borderRadius: '3px' }}>IOF / IDF</span>
                <strong style={{ fontSize: '9.5px', color: '#0f172a' }}>Intl. Osteoporosis & IDF</strong>
              </div>
              <p style={{ margin: 0, fontSize: '8.5px', color: '#475569', lineHeight: '1.3' }}>
                Consensos mundiales de salud metabólica y ósea para evaluar la distribución adiposa y proteger la masa magra.
              </p>
            </div>

            {/* TMB / BMR */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <span style={{ background: '#e0f2fe', color: '#0284c7', fontSize: '8.5px', fontWeight: 900, padding: '1px 4px', borderRadius: '3px' }}>TMB (BMR)</span>
                <strong style={{ fontSize: '9.5px', color: '#0f172a' }}>Tasa Metabólica Basal</strong>
              </div>
              <p style={{ margin: 0, fontSize: '8.5px', color: '#475569', lineHeight: '1.3' }}>
                Gasto calórico mínimo en reposo absoluto para funciones vitales (Katch-McArdle según tu masa magra libre de grasa).
              </p>
            </div>

            {/* TDEE */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: '8.5px', fontWeight: 900, padding: '1px 4px', borderRadius: '3px' }}>TDEE</span>
                <strong style={{ fontSize: '9.5px', color: '#0f172a' }}>Gasto Energético Diario</strong>
              </div>
              <p style={{ margin: 0, fontSize: '8.5px', color: '#475569', lineHeight: '1.3' }}>
                Calorías totales quemadas al día (TMB + actividad física). Base para calcular déficit, superávit o mantenimiento.
              </p>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', textAlign: 'center', fontSize: '10px', color: '#94a3b8' }}>
          Documento generado por {brandName} — Página 3 de 3
        </div>
      </div>
    </div>
  );
};

export default AnthropometryReportPDF;
