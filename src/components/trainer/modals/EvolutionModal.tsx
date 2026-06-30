import React, { useState, useEffect, useMemo, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '../../../lib/supabaseClient';
import { Profile } from '../../../types/database.types';

interface EvolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAthleteForEvolution: Profile | null;
  trainerSubscription: { plan: string; estado: string; expira_at: string | null } | null;
  profile: Profile | null;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const EvolutionModal: React.FC<EvolutionModalProps> = ({
  isOpen,
  onClose,
  selectedAthleteForEvolution,
  trainerSubscription,
  profile,
  showToast
}) => {
  const [evolutionExercises, setEvolutionExercises] = useState<string[]>([]);
  const [selectedEvolutionExercise, setSelectedEvolutionExercise] = useState<string>('all');
  const [evolutionHistoryData, setEvolutionHistoryData] = useState<any[]>([]);
  const [loadingEvolution, setLoadingEvolution] = useState<boolean>(false);
  const [pdfDateRange, setPdfDateRange] = useState<'30' | '60' | '90' | 'custom'>('30');
  const [pdfStartDate, setPdfStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [pdfEndDate, setPdfEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [pdfFeedbackText, setPdfFeedbackText] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  const pdfReportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && selectedAthleteForEvolution) {
      const loadEvolutionData = async () => {
        setEvolutionExercises([]);
        setSelectedEvolutionExercise('all');
        setEvolutionHistoryData([]);
        setPdfFeedbackText('');
        setLoadingEvolution(true);

        try {
          const { data, error } = await supabase
            .from('sesiones_historial')
            .select(`
              id,
              fecha,
              notas_generales,
              sesiones_ejercicios(*)
            `)
            .eq('cliente_id', selectedAthleteForEvolution.id)
            .order('fecha', { ascending: true });

          if (error) throw error;

          const uniqueEx = new Set<string>();
          const rows: any[] = [];

          data?.forEach((sesion: any) => {
            const ejercicios = sesion.sesiones_ejercicios || [];
            ejercicios.forEach((ej: any) => {
              if (ej.nombre_ejercicio) {
                uniqueEx.add(ej.nombre_ejercicio.trim());
                
                const repsArray = Array.isArray(ej.series_reps) ? ej.series_reps : [];
                rows.push({
                  fecha: sesion.fecha,
                  ejercicio: ej.nombre_ejercicio.trim(),
                  peso: ej.peso,
                  reps: repsArray.join('-'),
                  volumen: ej.volumen,
                  rm: ej.rm_estimado,
                  rpe: ej.rpe_rir
                });
              }
            });
          });

          const exerciseList = Array.from(uniqueEx).sort();
          setEvolutionExercises(exerciseList);
          setEvolutionHistoryData(rows);

          if (exerciseList.length > 0) {
            setSelectedEvolutionExercise(exerciseList[0]);
          }
        } catch (err: any) {
          console.error('Error al cargar evolución:', err);
          showToast('Error al cargar datos de evolución: ' + err.message, 'error');
        } finally {
          setLoadingEvolution(false);
        }
      };

      loadEvolutionData();
    }
  }, [isOpen, selectedAthleteForEvolution, showToast]);

  const chartPoints = useMemo(() => {
    if (selectedEvolutionExercise === 'all' || !selectedEvolutionExercise) return [];
    return evolutionHistoryData.filter(d => d.ejercicio === selectedEvolutionExercise);
  }, [evolutionHistoryData, selectedEvolutionExercise]);

  const svgDimensions = { width: 520, height: 200, padding: 30 };

  const svgElements = useMemo(() => {
    if (chartPoints.length === 0) return { pathRm: '', pathVol: '', points: [], minRm: 0, maxRm: 0, minVol: 0, maxVol: 0 };

    const rms = chartPoints.map(p => p.rm);
    const vols = chartPoints.map(p => p.volumen);

    const minRm = Math.min(...rms) * 0.9;
    const maxRm = Math.max(...rms) * 1.1;
    const rmDiff = (maxRm - minRm) || 1;

    const minVol = Math.min(...vols) * 0.9;
    const maxVol = Math.max(...vols) * 1.1;
    const volDiff = (maxVol - minVol) || 1;

    const points: any[] = [];
    const width = svgDimensions.width;
    const height = svgDimensions.height;
    const padding = svgDimensions.padding;

    const pointsRm = chartPoints.map((p, idx) => {
      const x = padding + (idx / Math.max(chartPoints.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - ((p.rm - minRm) / rmDiff) * (height - padding * 2);
      const yVol = height - padding - ((p.volumen - minVol) / volDiff) * (height - padding * 2);

      points.push({
        x,
        yRm: y,
        yVol,
        fecha: p.fecha.split('-').reverse().join('/'),
        rm: p.rm,
        volumen: p.volumen,
        reps: p.reps,
        peso: p.peso
      });

      return `${x},${y}`;
    });

    const pointsVol = chartPoints.map((p, idx) => {
      const x = padding + (idx / Math.max(chartPoints.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - ((p.volumen - minVol) / volDiff) * (height - padding * 2);
      return `${x},${y}`;
    });

    const pathRm = chartPoints.length > 1 ? `M ${pointsRm.join(' L ')}` : '';
    const pathVol = chartPoints.length > 1 ? `M ${pointsVol.join(' L ')}` : '';

    return { pathRm, pathVol, points, minRm, maxRm, minVol, maxVol };
  }, [chartPoints]);

  const pdfReportSummary = useMemo(() => {
    if (!selectedAthleteForEvolution) return [];
    
    const start = new Date(pdfStartDate);
    const end = new Date(pdfEndDate);
    end.setHours(23, 59, 59, 999);

    const historyInPeriod = evolutionHistoryData.filter(d => {
      const dDate = new Date(d.fecha);
      return dDate >= start && dDate <= end;
    });

    const grouped: Record<string, any[]> = {};
    historyInPeriod.forEach(row => {
      if (!grouped[row.ejercicio]) {
        grouped[row.ejercicio] = [];
      }
      grouped[row.ejercicio].push(row);
    });

    const summaryList: any[] = [];
    Object.entries(grouped).forEach(([exName, list]) => {
      const first = list[0];
      const last = list[list.length - 1];
      
      const rmStart = first.rm || 0;
      const rmEnd = last.rm || 0;
      const rmDiff = rmEnd - rmStart;
      const rmPct = rmStart > 0 ? (rmDiff / rmStart) * 100 : 0;

      const volStart = first.volumen || 0;
      const volEnd = last.volumen || 0;
      const volDiff = volEnd - volStart;
      const volPct = volStart > 0 ? (volDiff / volStart) * 100 : 0;

      summaryList.push({
        ejercicio: exName,
        rmInicial: rmStart,
        rmFinal: rmEnd,
        rmDeltaPct: rmPct,
        volInicial: volStart,
        volFinal: volEnd,
        volDeltaPct: volPct,
        sesionesRegistradas: list.length
      });
    });

    return summaryList;
  }, [evolutionHistoryData, selectedAthleteForEvolution, pdfStartDate, pdfEndDate]);

  const handlePdfDateRangeChange = (val: '30' | '60' | '90' | 'custom') => {
    setPdfDateRange(val);
    if (val !== 'custom') {
      const days = parseInt(val, 10);
      const d = new Date();
      d.setDate(d.getDate() - days);
      setPdfStartDate(d.toISOString().split('T')[0]);
      setPdfEndDate(new Date().toISOString().split('T')[0]);
    }
  };

  const handlePrintPDFReport = async () => {
    if (!selectedAthleteForEvolution) return;

    const plan = trainerSubscription?.plan || 'free';
    if (plan === 'free') {
      showToast('⚠️ Generar Reportes PDF de Progreso es una funcionalidad Premium. Actualiza a un plan de pago para usarla.', 'info');
      return;
    }

    const reportEl = pdfReportRef.current;
    if (!reportEl) {
      showToast('Error interno: no se encontró el contenido del reporte.', 'error');
      return;
    }

    try {
      setIsGeneratingPdf(true);

      reportEl.style.position = 'absolute';
      reportEl.style.left = '0';
      reportEl.style.top = '0';
      reportEl.style.opacity = '1';
      reportEl.style.pointerEvents = 'auto';
      reportEl.style.zIndex = '-9999';

      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const canvas = await html2canvas(reportEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      reportEl.style.position = 'absolute';
      reportEl.style.left = '-9999px';
      reportEl.style.top = '0';
      reportEl.style.opacity = '0';
      reportEl.style.pointerEvents = 'none';
      reportEl.style.zIndex = '-1';

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pageContentHeight = pageHeight - (margin * 2);

      if (imgHeight <= pageContentHeight) {
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
      } else {
        const totalPages = Math.ceil(imgHeight / pageContentHeight);
        const scaleFactor = canvas.width / imgWidth;

        for (let page = 0; page < totalPages; page++) {
          if (page > 0) pdf.addPage();

          const sourceY = page * pageContentHeight * scaleFactor;
          const sourceH = Math.min(pageContentHeight * scaleFactor, canvas.height - sourceY);
          const destH = sourceH / scaleFactor;

          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sourceH;
          const sliceCtx = sliceCanvas.getContext('2d');
          if (sliceCtx) {
            sliceCtx.fillStyle = '#ffffff';
            sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            sliceCtx.drawImage(canvas, 0, sourceY, canvas.width, sourceH, 0, 0, canvas.width, sourceH);
          }

          const sliceData = sliceCanvas.toDataURL('image/png');
          pdf.addImage(sliceData, 'PNG', margin, margin, imgWidth, destH);
        }
      }

      const athleteName = selectedAthleteForEvolution.nombre?.replace(/\s+/g, '_') || 'Atleta';
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `Reporte_${athleteName}_${dateStr}.pdf`;

      pdf.save(fileName);
      showToast(`✅ Reporte PDF descargado: ${fileName}`, 'success');
    } catch (err: any) {
      console.error('Error al generar PDF:', err);
      showToast('Error al generar el PDF: ' + (err.message || 'Intenta de nuevo'), 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!isOpen || !selectedAthleteForEvolution) return null;

  return (
    <>
      <div className="modal-overlay modal-overlay-enter open" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal-box modal-enter" style={{ maxWidth: '800px', width: '95%', maxHeight: '85vh', overflowY: 'auto', border: '1px solid var(--theme-border)', boxShadow: '0 20px 50px var(--theme-glow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, fontFamily: "'Orbitron', sans-serif", color: 'var(--theme-primary)', fontSize: '1.05rem', letterSpacing: '0.5px' }}>
              📈 EVOLUCIÓN Y REPORTES
            </h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
          </div>

          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '15px' }}>
            Atleta: <span style={{ color: 'white', fontWeight: 700 }}>{selectedAthleteForEvolution.nombre}</span> | Objetivo: <span style={{ color: 'var(--theme-secondary)', fontWeight: 600 }}>{selectedAthleteForEvolution.objetivo || 'Sin objetivo'}</span>
          </div>

          {loadingEvolution ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--theme-primary)', fontFamily: 'Orbitron, sans-serif', fontSize: '12px' }}>
              Cargando historial de progresión del atleta...
            </div>
          ) : evolutionHistoryData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '10px' }}>
              El atleta aún no tiene sesiones registradas. Registra entrenamientos para ver las métricas de evolución.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px' }}>AUDITAR EJERCICIO</span>
                    <select
                      value={selectedEvolutionExercise}
                      onChange={(e) => setSelectedEvolutionExercise(e.target.value)}
                      style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid var(--theme-border)', borderRadius: '6px', color: 'white', padding: '6px 12px', fontSize: '11px', outline: 'none' }}
                    >
                      {evolutionExercises.map(exName => (
                        <option key={exName} value={exName}>🏋️ {exName}</option>
                      ))}
                    </select>
                  </div>

                  {chartPoints.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                      Selecciona un ejercicio válido del historial.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ position: 'relative' }}>
                        <svg viewBox="0 0 520 200" style={{ width: '100%', height: 'auto', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '10px' }}>
                          <line x1="30" y1="20" x2="30" y2="170" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                          <line x1="30" y1="170" x2="490" y2="170" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                          <line x1="30" y1="57" x2="490" y2="57" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3,3" />
                          <line x1="30" y1="95" x2="490" y2="95" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3,3" />
                          <line x1="30" y1="132" x2="490" y2="132" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3,3" />

                          {svgElements.pathRm && (
                            <path d={svgElements.pathRm} fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.4))' }} />
                          )}
                          {svgElements.pathVol && (
                            <path d={svgElements.pathVol} fill="none" stroke="#00d4ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,2" style={{ filter: 'drop-shadow(0 0 3px rgba(0, 212, 255, 0.3))' }} />
                          )}
                          {svgElements.points.map((pt, idx) => (
                            <g key={idx}>
                              <circle cx={pt.x} cy={pt.yRm} r="4" fill="#fbbf24" stroke="#090f1d" strokeWidth="1.5" />
                              <title>{`Fecha: ${pt.fecha}\n1RM: ${Math.round(pt.rm)} kg\nPeso: ${pt.peso} kg\nReps: ${pt.reps}`}</title>
                            </g>
                          ))}
                        </svg>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '10px', fontFamily: "'Orbitron', sans-serif", color: 'rgba(255,255,255,0.6)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24' }}></span> Fuerza (1RM)</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00d4ff' }}></span> Volumen</span>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px' }}>GENERADOR DE REPORTES PDF</span>
                    <div>
                      <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px', marginBottom: '4px' }}>RANGO DE FECHAS</label>
                      <select value={pdfDateRange} onChange={(e) => handlePdfDateRangeChange(e.target.value as any)} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '12px', outline: 'none', marginBottom: '8px' }}>
                        <option value="30">📅 Últimos 30 días</option>
                        <option value="60">📅 Últimos 60 días</option>
                        <option value="90">📅 Últimos 90 días</option>
                        <option value="custom">⚙️ Rango personalizado</option>
                      </select>
                      {pdfDateRange === 'custom' && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                          <input type="date" value={pdfStartDate} onChange={(e) => setPdfStartDate(e.target.value)} style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px', fontSize: '11px' }} />
                          <input type="date" value={pdfEndDate} onChange={(e) => setPdfEndDate(e.target.value)} style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px', fontSize: '11px' }} />
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px', marginBottom: '4px' }}>COMENTARIOS / FEEDBACK DEL COACH</label>
                      <textarea placeholder="Consejos de recuperación, fatiga percibida, qué mejorar el próximo mes..." value={pdfFeedbackText} onChange={(e) => setPdfFeedbackText(e.target.value)} rows={3} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', resize: 'vertical' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                    {trainerSubscription?.plan === 'free' ? (
                      <div style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(123, 47, 247, 0.05))', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '10px 14px', fontSize: '10px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.4' }}>
                        🔒 <strong>REPORTES DE PROGRESO PDF:</strong> Esta es una función exclusiva de los planes premium (Iniciación, Intermedio, Profesional). Permite generar reportes de progreso listos para imprimir con tu logotipo y eslogan.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#34d399', fontFamily: "'Orbitron', sans-serif" }}>
                        ⭐ Premium Activo ({trainerSubscription?.plan.toUpperCase()}) — Reportes ilimitados habilitados.
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handlePrintPDFReport}
                      disabled={isGeneratingPdf}
                      style={{
                        width: '100%',
                        background: trainerSubscription?.plan === 'free' ? 'rgba(255,255,255,0.03)' : 'var(--theme-btn-gradient)',
                        border: trainerSubscription?.plan === 'free' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        color: trainerSubscription?.plan === 'free' ? 'rgba(255,255,255,0.4)' : 'white',
                        padding: '12px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontFamily: "'Orbitron', sans-serif",
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: trainerSubscription?.plan === 'free' ? 'none' : '0 0 15px var(--theme-btn-glow)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      {isGeneratingPdf ? '⏳ Generando PDF...' : trainerSubscription?.plan === 'free' ? '🔒 Descargar Reporte PDF' : '📄 Descargar Reporte PDF'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        id="evolutionlab-pdf-report"
        ref={pdfReportRef}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '0',
          width: '794px',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1,
          background: '#ffffff',
          color: '#000000',
          padding: '30px',
          fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
          fontSize: '12px',
          lineHeight: '1.5',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ff6b00', paddingBottom: '15px', marginBottom: '20px' }}>
          <div>
            {profile?.logo_url ? (
              <img src={profile.logo_url} alt="Logo" style={{ maxHeight: '60px', maxWidth: '150px', objectFit: 'contain' }} />
            ) : (
              <h2 style={{ margin: 0, color: '#ff6b00', fontFamily: "'Orbitron', sans-serif", fontSize: '20px' }}>
                {profile?.marca?.nombre_display || 'EVOLUTION LAB'}
              </h2>
            )}
            {profile?.marca?.eslogan && (
              <p style={{ margin: '4px 0 0 0', fontSize: '9px', fontStyle: 'italic', color: '#666' }}>{profile.marca.eslogan}</p>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ margin: 0, fontSize: '16px', fontFamily: "'Orbitron', sans-serif" }}>REPORTE DE EVOLUCIÓN MENSUAL</h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#555' }}>
              Periodo: {new Date(pdfStartDate).toLocaleDateString()} al {new Date(pdfEndDate).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#333' }}>
          <div>
            <p style={{ margin: '0 0 4px 0' }}><strong>Atleta:</strong> {selectedAthleteForEvolution.nombre}</p>
            <p style={{ margin: 0 }}><strong>Email:</strong> {selectedAthleteForEvolution.email}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: '0 0 4px 0' }}><strong>Objetivo:</strong> {selectedAthleteForEvolution.objetivo || 'Hipertrofia / Fuerza'}</p>
            <p style={{ margin: 0 }}><strong>Coach:</strong> {profile?.nombre}</p>
          </div>
        </div>

        <h3 style={{ fontFamily: "'Orbitron', sans-serif", borderBottom: '1px solid #ddd', paddingBottom: '4px', fontSize: '12px', color: '#1a1a1a', marginTop: '20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          📊 ANÁLISIS DE SOBRECARGA PROGRESIVA
        </h3>
        
        {pdfReportSummary.length === 0 ? (
          <p style={{ fontSize: '11px', fontStyle: 'italic', color: '#666', padding: '15px 0' }}>No hay registros de ejercicios completados en este periodo.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginTop: '10px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', color: '#334155' }}>
                <th style={{ padding: '8px 10px' }}>Ejercicio</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Sesiones</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>1RM Inicial</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>1RM Final</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Progreso 1RM</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Vol. Inicial</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Vol. Final</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Progreso Vol.</th>
              </tr>
            </thead>
            <tbody>
              {pdfReportSummary.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', color: '#0f172a' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 'bold' }}>{item.ejercicio}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>{item.sesionesRegistradas}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{Math.round(item.rmInicial)} kg</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{Math.round(item.rmFinal)} kg</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: item.rmDeltaPct >= 0 ? '#15803d' : '#b91c1c' }}>
                    {item.rmDeltaPct >= 0 ? '+' : ''}{item.rmDeltaPct.toFixed(1)}%
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{Math.round(item.volInicial).toLocaleString()} kg</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{Math.round(item.volFinal).toLocaleString()} kg</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: item.volDeltaPct >= 0 ? '#15803d' : '#b91c1c' }}>
                    {item.volDeltaPct >= 0 ? '+' : ''}{item.volDeltaPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {pdfFeedbackText.trim() && (
          <div style={{ marginTop: '25px' }}>
            <h3 style={{ fontFamily: "'Orbitron', sans-serif", borderBottom: '1px solid #ddd', paddingBottom: '4px', fontSize: '12px', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              📝 CONSEJOS Y FEEDBACK DEL COACH
            </h3>
            <div style={{ padding: '12px 16px', background: '#f8fafc', borderLeft: '3px solid #ff6b00', fontSize: '11px', color: '#334155', fontStyle: 'italic', whiteSpace: 'pre-line', lineHeight: '1.5', marginTop: '8px' }}>
              "{pdfFeedbackText}"
            </div>
          </div>
        )}

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginTop: '30px', display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#64748b' }}>
          <span>Generado automáticamente por Evolution Lab</span>
          <span>© {new Date().getFullYear()} {profile?.marca?.nombre_display || profile?.nombre}</span>
        </div>
      </div>
    </>
  );
};

export default EvolutionModal;
