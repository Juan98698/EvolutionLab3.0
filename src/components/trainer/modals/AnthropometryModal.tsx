import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Profile, ValoracionAntropometrica } from '../../../types/database.types';
import { processFullAnthropometry, getSomatotypeDiagnostic } from '../../../lib/anthropometryEngine';
import SomatochartCanvas from '../../anthropometry/SomatochartCanvas';
import FourMassesPieChart from '../../anthropometry/FourMassesPieChart';
import AnthropometryReportPDF from '../../anthropometry/AnthropometryReportPDF';
import { useModalA11y } from '../../../hooks/useModalA11y';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface AnthropometryModalProps {
  isOpen: boolean;
  onClose: () => void;
  atleta: Profile;
  trainerProfile: Profile | null;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AnthropometryModal: React.FC<AnthropometryModalProps> = ({
  isOpen,
  onClose,
  atleta,
  trainerProfile,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'medidas' | 'macros' | 'resultados'>('medidas');
  const [metodo, setMetodo] = useState<'Yuhasz' | 'Faulkner' | 'ISAK'>('Yuhasz');
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Handlers para permitir borrar inputs completamente sin que quede un '0' colgado
  const handleNumInput = (val: string, setter: (n: any) => void) => {
    if (val === '' || val === '-') {
      setter('');
    } else {
      const parsed = Number(val);
      setter(isNaN(parsed) ? '' : parsed);
    }
  };

  const handleNestedNumInput = (
    field: string,
    val: string,
    stateObj: Record<string, any>,
    setter: (newObj: any) => void
  ) => {
    if (val === '' || val === '-') {
      setter({ ...stateObj, [field]: '' });
    } else {
      const parsed = Number(val);
      setter({ ...stateObj, [field]: isNaN(parsed) ? '' : parsed });
    }
  };

  // Datos básicos
  const [peso, setPeso] = useState<number | ''>(70);
  const [estatura, setEstatura] = useState<number | ''>(170);
  const [estaturaSentado, setEstaturaSentado] = useState<number | ''>(90);
  const [edad, setEdad] = useState<number | ''>(25);
  const [genero, setGenero] = useState<'masculino' | 'femenino'>(atleta?.sexo || 'masculino');
  const getAjusteDefault = (obj: string): number => {
    if (!obj) return 0;
    if (obj.includes('Agresiva')) return -20;
    if (obj.includes('Pérdida')) return -15;
    if (obj.includes('Hipertrofia')) return 15;
    if (obj.includes('Ganancia')) return 10;
    if (obj.includes('Recomposición') || obj.includes('Recomposicion')) return 0;
    return 0;
  };

  const [objetivo, setObjetivo] = useState<string>(atleta?.objetivo || 'Recomposición Corporal');
  const [frecuenciaEntreno, setFrecuenciaEntreno] = useState<string>('3-4');

  const handleObjetivoChange = (newObj: string) => {
    setObjetivo(newObj);
    setAjusteCaloricoPct(getAjusteDefault(newObj));
  };

  // Pliegues (mm)
  const [pliegues, setPliegues] = useState<Record<string, number | ''>>({
    triceps: 12,
    subescapular: 14,
    suprailiaco: 15,
    abdominal: 18,
    muslo: 20,
    pantorrilla: 16,
    antebrazo: 10,
    supraespinal: 12,
  });

  // Perímetros (cm)
  const [perimetros, setPerimetros] = useState<Record<string, number | ''>>({
    brazo: 32,
    brazo_contraido: 34,
    torax: 95,
    cintura: 80,
    cadera: 98,
    muslo: 58,
    pantorrilla: 37,
    cefalico: 56,
  });

  // Diámetros (cm)
  const [diametros, setDiametros] = useState<Record<string, number | ''>>({
    codo: 6.8,
    rodilla: 9.5,
    biiliocrestal: 28,
    biliocrestal: 28,
    biacromial: 38,
    anteroposterior: 20,
    transversal: 30,
  });

  // Balance y Macros
  const [ajusteCaloricoPct, setAjusteCaloricoPct] = useState<number | ''>(() => getAjusteDefault(atleta?.objetivo || 'Recomposición Corporal'));
  const [gProteinaKg, setGProteinaKg] = useState<number | ''>(2.0);
  const [gGrasaKg, setGGrasaKg] = useState<number | ''>(1.0);

  useEffect(() => {
    if (isOpen && atleta?.id) {
      const loadLatestValuation = async () => {
        try {
          const query = supabase.from('valoraciones_antropometricas');
          if (!query || typeof query.select !== 'function') return;

          const { data, error } = await query
            .select('*')
            .eq('cliente_id', atleta.id)
            .order('fecha', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (data && !error) {
            if (data.peso !== undefined && data.peso !== null) setPeso(data.peso);
            if (data.estatura !== undefined && data.estatura !== null) setEstatura(data.estatura);
            if (data.estatura_sentado !== undefined && data.estatura_sentado !== null) setEstaturaSentado(data.estatura_sentado);
            if (data.edad !== undefined && data.edad !== null) setEdad(data.edad);
            if (data.genero) setGenero(data.genero as 'masculino' | 'femenino');
            if (data.metodo) setMetodo(data.metodo as 'Yuhasz' | 'Faulkner' | 'ISAK');
            if (data.objetivo) setObjetivo(data.objetivo);
            if (data.frecuencia_entreno) setFrecuenciaEntreno(data.frecuencia_entreno);
            if (data.pliegues) setPliegues((prev) => ({ ...prev, ...data.pliegues }));
            if (data.perimetros) setPerimetros((prev) => ({ ...prev, ...data.perimetros }));
            if (data.diametros) setDiametros((prev) => ({ ...prev, ...data.diametros }));
            if (data.ajuste_calorico_pct !== undefined && data.ajuste_calorico_pct !== null) {
              setAjusteCaloricoPct(data.ajuste_calorico_pct);
            }
            if (data.macros?.proteina?.gPerKg) setGProteinaKg(data.macros.proteina.gPerKg);
            if (data.macros?.grasa?.gPerKg) setGGrasaKg(data.macros.grasa.gPerKg);
          } else {
            const initObj = atleta.objetivo || 'Recomposición Corporal';
            setObjetivo(initObj);
            setGenero(atleta.sexo || 'masculino');
            setAjusteCaloricoPct(getAjusteDefault(initObj));
          }
        } catch (err) {
          console.error('Error al cargar última valoración:', err);
        }
      };

      loadLatestValuation();
    }
  }, [isOpen, atleta?.id]);

  const dialogRef = useModalA11y<HTMLDivElement>({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  // Filtrar perímetros para excluir cefálico si el método no es ISAK
  const cleanPerimetros = Object.fromEntries(
    Object.entries(perimetros)
      .filter(([k]) => metodo === 'ISAK' || k !== 'cefalico')
      .map(([k, v]) => [k, Number(v) || 0])
  );

  // Cálculo en tiempo real de la valoración completa
  const computed: ValoracionAntropometrica = processFullAnthropometry({
    cliente_id: atleta.id,
    entrenador_id: trainerProfile?.id,
    fecha: new Date().toISOString().split('T')[0],
    edad: Number(edad) || 0,
    peso: Number(peso) || 0,
    estatura: Number(estatura) || 0,
    estatura_sentado: metodo === 'ISAK' ? (Number(estaturaSentado) || 0) : undefined,
    metodo,
    objetivo,
    frecuencia_entreno: frecuenciaEntreno,
    pliegues: Object.fromEntries(Object.entries(pliegues).map(([k, v]) => [k, Number(v) || 0])),
    perimetros: cleanPerimetros,
    diametros: Object.fromEntries(Object.entries(diametros).map(([k, v]) => [k, Number(v) || 0])),
    ajuste_calorico_pct: ajusteCaloricoPct === '' ? 0 : Number(ajusteCaloricoPct),
    g_proteina_kg: Number(gProteinaKg) || 0,
    g_grasa_kg: Number(gGrasaKg) || 0,
    genero,
  });

  // Guardar en Supabase
  const handleSave = async () => {
    setSaving(true);
    try {
      // Garantizar que entrenador_id esté poblado si trainerProfile.id venía nulo
      const { data: authData } = await supabase.auth.getUser();
      const currentTrainerId = trainerProfile?.id || authData.user?.id || null;

      // Extraer campos calculados dinámicamente que no corresponden a columnas de la base de datos
      const { agua_recomendada_l, ...dbPayload } = computed;
      if (!dbPayload.entrenador_id && currentTrainerId) {
        dbPayload.entrenador_id = currentTrainerId;
      }

      // Eliminar claves con valores undefined para evitar payload corrupto en Supabase
      const cleanDbPayload = Object.fromEntries(
        Object.entries(dbPayload).filter(([_, v]) => v !== undefined)
      );

      const { error } = await supabase.from('valoraciones_antropometricas').insert([cleanDbPayload]);
      if (error) throw error;

      // Persistir el sexo y objetivo del atleta en su perfil para sincronización global
      if (atleta?.id) {
        await supabase
          .from('profiles')
          .update({
            sexo: genero,
            objetivo: objetivo,
          })
          .eq('id', atleta.id);
      }

      showToast('🎉 ¡Valoración antropométrica guardada exitosamente!', 'success');
      // Mantenemos el modal abierto sin ejecutar onClose()
    } catch (err: any) {
      showToast('Error al guardar valoración: ' + (err.message || err), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Generar y Descargar PDF Nativo de 2 páginas en 1 clic
  const handleDownloadPDF = async () => {
    setDownloadingPdf(true);
    try {
      const page1Element = document.getElementById('anthropometry-pdf-page-1');
      const page2Element = document.getElementById('anthropometry-pdf-page-2');

      if (!page1Element || !page2Element) {
        throw new Error('No se encontraron las páginas del informe PDF.');
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Renderizar Página 1
      const canvas1 = await html2canvas(page1Element, { scale: 2, useCORS: true });
      const imgData1 = canvas1.toDataURL('image/png');
      const height1 = (canvas1.height * pdfWidth) / canvas1.width;
      pdf.addImage(imgData1, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, height1));

      // Renderizar Página 2
      pdf.addPage();
      const canvas2 = await html2canvas(page2Element, { scale: 2, useCORS: true });
      const imgData2 = canvas2.toDataURL('image/png');
      const height2 = (canvas2.height * pdfWidth) / canvas2.width;
      pdf.addImage(imgData2, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, height2));

      pdf.save(`Valoracion_${atleta.nombre.replace(/\s+/g, '_')}_${computed.fecha}.pdf`);

      showToast('📄 PDF de 2 páginas descargado correctamente con tu Marca Blanca', 'success');
    } catch (err: any) {
      showToast('Error al generar PDF: ' + (err.message || err), 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="modal-overlay modal-overlay-enter open" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
      <div
        ref={dialogRef}
        className="modal-box modal-enter"
        style={{ maxWidth: '850px', width: '95%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--theme-border)', boxShadow: '0 20px 50px var(--theme-glow)', background: '#0b0f19' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="anthropometry-title"
        tabIndex={-1}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px', marginBottom: '16px' }}>
          <div>
            <h3 id="anthropometry-title" style={{ margin: 0, fontFamily: "'Orbitron', sans-serif", color: 'var(--theme-primary)', fontSize: '1.1rem', letterSpacing: '0.5px' }}>
              📐 VALORACIÓN ANTROPOMÉTRICA & MACROS
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
              Atleta: <strong style={{ color: 'white' }}>{atleta.nombre}</strong> ({atleta.email})
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
        </div>

        {/* Desplegable de Método Antropométrico */}
        <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, fontFamily: 'Orbitron, sans-serif', color: '#00d4ff', marginBottom: '6px' }}>
            SELECCIONA EL MÉTODO DE EVALUACIÓN:
          </label>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value as any)}
            style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
          >
            <option value="Yuhasz">Rose Guimares (YUHASZ) — 6 Pliegues (Estándar Deportivo)</option>
            <option value="Faulkner">Rose Guimares (FAULKNER) — 4 Pliegues</option>
            <option value="ISAK">Método Avanzado (ISAK 5 Componentes / Pliegues + Perímetros + Diámetros)</option>
          </select>
        </div>

        {/* Navegación por pestañas */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
          <button
            onClick={() => setActiveTab('medidas')}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: activeTab === 'medidas' ? 'var(--theme-primary)' : 'transparent', color: activeTab === 'medidas' ? '#000' : '#fff', fontWeight: 800, fontFamily: 'Orbitron, sans-serif', fontSize: '11px', cursor: 'pointer' }}
          >
            1. MEDIDAS Y PLIEGUES
          </button>
          <button
            onClick={() => setActiveTab('macros')}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: activeTab === 'macros' ? 'var(--theme-primary)' : 'transparent', color: activeTab === 'macros' ? '#000' : '#fff', fontWeight: 800, fontFamily: 'Orbitron, sans-serif', fontSize: '11px', cursor: 'pointer' }}
          >
            2. BALANCE Y MACROS
          </button>
          <button
            onClick={() => setActiveTab('resultados')}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: activeTab === 'resultados' ? 'var(--theme-primary)' : 'transparent', color: activeTab === 'resultados' ? '#000' : '#fff', fontWeight: 800, fontFamily: 'Orbitron, sans-serif', fontSize: '11px', cursor: 'pointer' }}
          >
            3. RESULTADOS & SOMATOCARTA
          </button>
        </div>

        {/* PESTAÑA 1: MEDIDAS Y PLIEGUES */}
        {activeTab === 'medidas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '4px' }}>PESO (KG)</label>
                <input type="number" value={peso} onChange={(e) => handleNumInput(e.target.value, setPeso)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '4px' }}>ESTATURA (CM)</label>
                <input type="number" value={estatura} onChange={(e) => handleNumInput(e.target.value, setEstatura)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '4px' }}>EDAD</label>
                <input type="number" value={edad} onChange={(e) => handleNumInput(e.target.value, setEdad)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '4px' }}>SEXO / GÉNERO</label>
                <select value={genero} onChange={(e) => setGenero(e.target.value as any)} style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', boxSizing: 'border-box' }}>
                  <option value="masculino">👨 Masculino</option>
                  <option value="femenino">👩 Femenino</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '4px' }}>FRECUENCIA DE ENTRENO</label>
                <select value={frecuenciaEntreno} onChange={(e) => setFrecuenciaEntreno(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', boxSizing: 'border-box' }}>
                  <option value="1-2">1-2 días/sem (Baja x1.20)</option>
                  <option value="3-4">3-4 días/sem (Moderada x1.45)</option>
                  <option value="5-6">5-6 días/sem (Alta x1.65)</option>
                  <option value="diario">Diario / Atleta (Muy Alta x1.80)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '4px' }}>OBJETIVO DEL ATLETA</label>
                <select value={objetivo} onChange={(e) => handleObjetivoChange(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', boxSizing: 'border-box' }}>
                  <option value="Recomposición Corporal">Recomposición Corporal (0%)</option>
                  <option value="Pérdida de Grasa (Déficit)">Pérdida de Grasa (-15%)</option>
                  <option value="Pérdida de Grasa Agresiva">Pérdida de Grasa Agresiva (-20%)</option>
                  <option value="Ganancia Muscular (Superávit)">Ganancia Muscular (+10%)</option>
                  <option value="Hipertrofia Avanzada">Hipertrofia Avanzada (+15%)</option>
                </select>
              </div>
              {metodo === 'ISAK' && (
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '4px' }}>ESTATURA SENTADO (CM)</label>
                  <input type="number" value={estaturaSentado} onChange={(e) => handleNumInput(e.target.value, setEstaturaSentado)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', boxSizing: 'border-box' }} />
                </div>
              )}
            </div>

            {/* Pliegues Cutáneos */}
            <div>
              <h4 style={{ fontSize: '11px', fontFamily: 'Orbitron, sans-serif', color: '#00d4ff', margin: '12px 0 8px' }}>PLIEGUES CUTÁNEOS (MM)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Tríceps</label>
                  <input type="number" value={pliegues.triceps} onChange={(e) => handleNestedNumInput('triceps', e.target.value, pliegues, setPliegues)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Subescapular</label>
                  <input type="number" value={pliegues.subescapular} onChange={(e) => handleNestedNumInput('subescapular', e.target.value, pliegues, setPliegues)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Suprailíaco</label>
                  <input type="number" value={pliegues.suprailiaco} onChange={(e) => handleNestedNumInput('suprailiaco', e.target.value, pliegues, setPliegues)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Abdominal</label>
                  <input type="number" value={pliegues.abdominal} onChange={(e) => handleNestedNumInput('abdominal', e.target.value, pliegues, setPliegues)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Muslo</label>
                  <input type="number" value={pliegues.muslo} onChange={(e) => handleNestedNumInput('muslo', e.target.value, pliegues, setPliegues)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Pantorrilla</label>
                  <input type="number" value={pliegues.pantorrilla} onChange={(e) => handleNestedNumInput('pantorrilla', e.target.value, pliegues, setPliegues)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                </div>
                {metodo === 'ISAK' && (
                  <>
                    <div>
                      <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Antebrazo</label>
                      <input type="number" value={pliegues.antebrazo} onChange={(e) => handleNestedNumInput('antebrazo', e.target.value, pliegues, setPliegues)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Supraespinal</label>
                      <input type="number" value={pliegues.supraespinal} onChange={(e) => handleNestedNumInput('supraespinal', e.target.value, pliegues, setPliegues)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Perímetros Corporales */}
            <div>
              <h4 style={{ fontSize: '11px', fontFamily: 'Orbitron, sans-serif', color: '#00d4ff', margin: '12px 0 8px' }}>PERÍMETROS CORPORALES (CM)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Brazo</label>
                  <input type="number" value={perimetros.brazo} onChange={(e) => handleNestedNumInput('brazo', e.target.value, perimetros, setPerimetros)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Brazo Contraído</label>
                  <input type="number" value={perimetros.brazo_contraido} onChange={(e) => handleNestedNumInput('brazo_contraido', e.target.value, perimetros, setPerimetros)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Tórax</label>
                  <input type="number" value={perimetros.torax} onChange={(e) => handleNestedNumInput('torax', e.target.value, perimetros, setPerimetros)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Cintura</label>
                  <input type="number" value={perimetros.cintura} onChange={(e) => handleNestedNumInput('cintura', e.target.value, perimetros, setPerimetros)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Cadera</label>
                  <input type="number" value={perimetros.cadera} onChange={(e) => handleNestedNumInput('cadera', e.target.value, perimetros, setPerimetros)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Muslo</label>
                  <input type="number" value={perimetros.muslo} onChange={(e) => handleNestedNumInput('muslo', e.target.value, perimetros, setPerimetros)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Pantorrilla</label>
                  <input type="number" value={perimetros.pantorrilla} onChange={(e) => handleNestedNumInput('pantorrilla', e.target.value, perimetros, setPerimetros)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                </div>
                {metodo === 'ISAK' && (
                  <div>
                    <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Perímetro Cefálico</label>
                    <input type="number" value={perimetros.cefalico} onChange={(e) => handleNestedNumInput('cefalico', e.target.value, perimetros, setPerimetros)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                  </div>
                )}
              </div>
            </div>

            {/* Diámetros Óseos */}
            <div>
              <h4 style={{ fontSize: '11px', fontFamily: 'Orbitron, sans-serif', color: '#00d4ff', margin: '12px 0 8px' }}>DIÁMETROS ÓSEOS (CM)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Codo</label>
                  <input type="number" step="0.1" value={diametros.codo} onChange={(e) => handleNestedNumInput('codo', e.target.value, diametros, setDiametros)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Rodilla</label>
                  <input type="number" step="0.1" value={diametros.rodilla} onChange={(e) => handleNestedNumInput('rodilla', e.target.value, diametros, setDiametros)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Anteroposterior (Muñeca)</label>
                  <input type="number" step="0.1" value={diametros.anteroposterior} onChange={(e) => handleNestedNumInput('anteroposterior', e.target.value, diametros, setDiametros)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                </div>
                {metodo === 'ISAK' && (
                  <>
                    <div>
                      <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Biiliocrestal</label>
                      <input type="number" step="0.1" value={diametros.biiliocrestal || diametros.biliocrestal} onChange={(e) => {
                        handleNestedNumInput('biiliocrestal', e.target.value, diametros, (newD) => {
                          setDiametros({ ...newD, biliocrestal: newD.biiliocrestal });
                        });
                      }} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Biacromial</label>
                      <input type="number" step="0.1" value={diametros.biacromial} onChange={(e) => handleNestedNumInput('biacromial', e.target.value, diametros, setDiametros)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Transversal</label>
                      <input type="number" step="0.1" value={diametros.transversal} onChange={(e) => handleNestedNumInput('transversal', e.target.value, diametros, setDiametros)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '6px' }} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: BALANCE Y MACROS */}
        {activeTab === 'macros' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px', borderRadius: '8px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>BMR (Gasto Basal)</span>
                <h4 style={{ margin: '4px 0 0', fontSize: '16px', color: '#00d4ff' }}>{computed.bmr} kcal</h4>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px', borderRadius: '8px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>TDEE (Mantenimiento)</span>
                <h4 style={{ margin: '4px 0 0', fontSize: '16px', color: '#00ff99' }}>{computed.tdee} kcal</h4>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px', borderRadius: '8px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Ajuste Calórico (%)</span>
                <input
                  type="number"
                  value={ajusteCaloricoPct}
                  onChange={(e) => handleNumInput(e.target.value, setAjusteCaloricoPct)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: 'white', padding: '4px 8px', marginTop: '4px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 800 }}>PROTEÍNA (G / KG PESO)</label>
                <input type="number" step="0.1" value={gProteinaKg} onChange={(e) => handleNumInput(e.target.value, setGProteinaKg)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px' }} />
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>Total: {computed.macros?.proteina.grams}g ({computed.macros?.proteina.calories} kcal)</span>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 800 }}>GRASA (G / KG PESO)</label>
                <input type="number" step="0.1" value={gGrasaKg} onChange={(e) => handleNumInput(e.target.value, setGGrasaKg)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px' }} />
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>Total: {computed.macros?.grasa.grams}g ({computed.macros?.grasa.calories} kcal)</span>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#10b981', fontWeight: 800 }}>CARBOHIDRATOS (RESTANTE)</label>
                <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#10b981', padding: '8px', fontWeight: 800 }}>
                  {computed.macros?.carbohidratos.gPerKg} g/kg ({computed.macros?.carbohidratos.grams}g)
                </div>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>Total: {computed.macros?.carbohidratos.calories} kcal ({computed.macros?.carbohidratos.percentage}%)</span>
              </div>
            </div>

            <div style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', padding: '12px', borderRadius: '8px', textAlign: 'center', fontFamily: 'Orbitron, sans-serif' }}>
              <span style={{ fontSize: '12px', color: '#00d4ff', fontWeight: 800 }}>OBJETIVO DE LA DIETA: {computed.target_calorias} KCAL / DÍA</span>
            </div>
          </div>
        )}

        {/* PESTAÑA 3: RESULTADOS Y SOMATOCARTA */}
        {activeTab === 'resultados' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', width: '100%' }}>
              <div style={{ width: '100%', overflow: 'hidden' }}>
                <SomatochartCanvas
                  x={computed.somatotipo?.x || 0}
                  y={computed.somatotipo?.y || 0}
                  endo={computed.somatotipo?.endo || 0}
                  meso={computed.somatotipo?.meso || 0}
                  ecto={computed.somatotipo?.ecto || 0}
                />
              </div>

              <div style={{ width: '100%', overflow: 'hidden' }}>
                <FourMassesPieChart
                  pesoTotal={computed.peso}
                  kgMusculo={computed.kg_musculo || 0}
                  pctMusculo={computed.pct_musculo || 0}
                  kgGrasa={computed.kg_grasa || 0}
                  pctGrasa={computed.pct_grasa || 0}
                  kgOseo={computed.kg_oseo || 0}
                  pctOseo={computed.pct_oseo || 0}
                  kgResidual={computed.kg_residual || 0}
                  pctResidual={computed.pct_residual || 0}
                  size={220}
                />
              </div>
            </div>

            {/* Diagnóstico explicativo en el modal */}
            <div style={{ background: 'rgba(0, 212, 255, 0.05)', border: '1px solid rgba(0, 212, 255, 0.2)', borderRadius: '12px', padding: '14px' }}>
              <h4 style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 800, color: '#00d4ff', fontFamily: 'Orbitron, sans-serif' }}>
                💡 DIAGNÓSTICO DEL SOMATOTIPO PARA EL ATLETA:
              </h4>
              <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.5' }}>
                {getSomatotypeDiagnostic(
                  computed.somatotipo?.endo || 0,
                  computed.somatotipo?.meso || 0,
                  computed.somatotipo?.ecto || 0,
                  atleta.nombre
                )}
              </p>
            </div>

            {/* Previsualización del PDF de 2 páginas en vivo */}
            <div style={{ background: '#334155', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 800, fontFamily: "'Orbitron', sans-serif" }}>
                  📋 PREVISUALIZACIÓN EN VIVO DEL INFORME PDF (2 PÁGINAS)
                </span>
                <span style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  👈 Desliza horizontalmente para ver el documento completo 👉
                </span>
              </div>
              <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '8px' }}>
                <div style={{ minWidth: '794px' }}>
                  <AnthropometryReportPDF valoracion={computed} atletaNombre={atleta.nombre} trainerProfile={trainerProfile} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Plantilla PDF en segundo plano cuando no está en la pestaña 3 para garantizar que la descarga nunca falle */}
        {activeTab !== 'resultados' && (
          <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
            <AnthropometryReportPDF valoracion={computed} atletaNombre={atleta.nombre} trainerProfile={trainerProfile} />
          </div>
        )}

        {/* Acciones del Modal por Pestaña */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
          {activeTab === 'medidas' && (
            <button onClick={() => setActiveTab('macros')} style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid rgba(0,212,255,0.4)', background: 'rgba(0,212,255,0.1)', color: '#00d4ff', fontWeight: 800, cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '11px' }}>
              SIGUIENTE: BALANCE Y MACROS ➔
            </button>
          )}

          {activeTab === 'macros' && (
            <button onClick={() => setActiveTab('resultados')} style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid rgba(0,212,255,0.4)', background: 'rgba(0,212,255,0.1)', color: '#00d4ff', fontWeight: 800, cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '11px' }}>
              SIGUIENTE: RESULTADOS & SOMATOCARTA ➔
            </button>
          )}

          {activeTab === 'resultados' && (
            <button onClick={handleDownloadPDF} disabled={downloadingPdf} style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid rgba(0,212,255,0.4)', background: 'rgba(0,212,255,0.1)', color: '#00d4ff', fontWeight: 800, cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '11px' }}>
              {downloadingPdf ? 'GENERANDO PDF...' : '📄 DESCARGAR PDF MARCA BLANCA'}
            </button>
          )}

          <button onClick={handleSave} disabled={saving} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--theme-primary)', color: '#000', fontWeight: 900, cursor: 'pointer', fontFamily: 'Orbitron, sans-serif', fontSize: '11px' }}>
            {saving ? 'GUARDANDO...' : '💾 GUARDAR VALORACIÓN'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnthropometryModal;
