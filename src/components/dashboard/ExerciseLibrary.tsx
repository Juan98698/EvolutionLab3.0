import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../../context/SupabaseContext';
import { supabase } from '../../lib/supabaseClient';
import { EjercicioGlobal, Profile } from '../../types/database.types';
import BodyMuscleMap from '../common/BodyMuscleMap';
import AthleteNavbar from '../common/AthleteNavbar';
import { useModalA11y } from '../../hooks/useModalA11y';

const normalizeText = (str: string) => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

export const ExerciseLibrary: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useSupabase();
  const isTrainer = profile?.rol === 'entrenador';
  const [exercises, setExercises] = useState<EjercicioGlobal[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [selectedModality, setSelectedModality] = useState<'todos' | 'musculacion' | 'funcional' | 'calistenia'>('todos');
  const [trainerProfile, setTrainerProfile] = useState<Profile | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);

  // GIF Viewer state
  const [gifViewerExercise, setGifViewerExercise] = useState<EjercicioGlobal | null>(null);
  const [gifViewerMediaType, setGifViewerMediaType] = useState<'image' | 'gif'>('gif');
  const isGifViewerOpen = gifViewerExercise !== null;

  const gifModalRef = useModalA11y<HTMLDivElement>({
    isOpen: isGifViewerOpen,
    onClose: () => setGifViewerExercise(null),
  });

  const openGifViewer = (exercise: EjercicioGlobal, startWith: 'image' | 'gif' = 'gif') => {
    setGifViewerMediaType(startWith);
    setGifViewerExercise(exercise);
  };

  // Resetear paginación al cambiar filtros o búsquedas
  useEffect(() => {
    setVisibleCount(12);
  }, [searchQuery, selectedMuscle, selectedModality]);

  // Determinar si es cliente autónomo free
  const isAutonomousClient = profile?.rol === 'cliente' && !profile?.entrenador_id;
  const isFreeClient = profile?.suscripcion_plan === 'free';
  const isBlocked = isAutonomousClient && isFreeClient;

  // Cargar perfil del entrenador para la marca blanca si es atleta guiado
  useEffect(() => {
    const fetchTrainerProfile = async () => {
      if (profile?.entrenador_id) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', profile.entrenador_id)
            .single();
          if (!error && data) {
            setTrainerProfile(data);
          }
        } catch (e) {
          console.error('Error al cargar perfil del entrenador para marca blanca:', e);
        }
      }
    };
    fetchTrainerProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.entrenador_id, supabase]);

  // Cargar catálogo global de ejercicios de Supabase
  useEffect(() => {
    const fetchExercises = async () => {
      if (isBlocked) {
        setLoadingExercises(false);
        return;
      }
      try {
        setLoadingExercises(true);
        const { data, error } = await supabase
          .from('ejercicios_globales')
          .select('*')
          .order('nombre', { ascending: true });
        
        if (!error && data) {
          setExercises(data as EjercicioGlobal[]);
        }
      } catch (e) {
        console.error('Error al cargar la biblioteca de ejercicios:', e);
      } finally {
        setLoadingExercises(false);
      }
    };
    fetchExercises();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, isBlocked]);

  // Filtrado de ejercicios por texto, modalidad y grupo muscular (primario + secundario)
  const filteredExercises = exercises.filter((ex) => {
    const normName = normalizeText(ex.nombre);
    const normDesc = normalizeText(ex.descripcion || '');
    const normGroup = normalizeText(ex.grupo_muscular || '');
    const normQuery = normalizeText(searchQuery);

    // Filtro por Modalidad
    if (selectedModality !== 'todos') {
      const cat = normalizeText(ex.categoria || 'musculacion');
      if (selectedModality === 'funcional') {
        const isFunc = cat === 'funcional' || cat === 'hiit' || cat === 'cardio' || normGroup === 'full body';
        if (!isFunc) return false;
      } else if (cat !== selectedModality) {
        return false;
      }
    }

    const queryTokens = normQuery.split(/\s+/).filter(Boolean);
    const secMusclesText = Array.isArray(ex.musculos_secundarios) ? ex.musculos_secundarios.join(' ') : '';
    const fullText = `${normName} ${normDesc} ${normGroup} ${normalizeText(secMusclesText)}`;
    const matchesSearch = queryTokens.length === 0 || queryTokens.every(token => fullText.includes(token));
    
    if (!selectedMuscle) return matchesSearch;

    const muscleGroup = normalizeText(ex.grupo_muscular);
    const filterText = normalizeText(selectedMuscle);
    const hasSecMuscle = Array.isArray(ex.musculos_secundarios) && ex.musculos_secundarios.some(m => normalizeText(m).includes(filterText));

    if (filterText === 'full body' || filterText === 'funcional') {
      return matchesSearch && (muscleGroup.includes('full body') || muscleGroup.includes('funcional') || ex.categoria === 'funcional');
    }

    if (filterText === 'espalda') {
      return matchesSearch && (
        muscleGroup.includes('espalda') || muscleGroup.includes('dorsal') || 
        muscleGroup.includes('lumbar') || muscleGroup.includes('trapecio') ||
        muscleGroup.includes('romboides') || hasSecMuscle
      );
    }
    if (filterText === 'pecho') {
      return matchesSearch && (
        muscleGroup.includes('pecho') || muscleGroup.includes('pectoral') || hasSecMuscle
      );
    }
    if (filterText === 'biceps') {
      return matchesSearch && (muscleGroup.includes('biceps') || hasSecMuscle);
    }
    if (filterText === 'triceps') {
      return matchesSearch && (muscleGroup.includes('triceps') || hasSecMuscle);
    }
    if (filterText === 'hombros') {
      return matchesSearch && (
        muscleGroup.includes('hombro') || muscleGroup.includes('deltoide') || hasSecMuscle
      );
    }
    if (filterText === 'abdomen') {
      return matchesSearch && (
        muscleGroup.includes('abdomen') || muscleGroup.includes('core') || 
        muscleGroup.includes('oblicuo') || muscleGroup.includes('abdominal') || hasSecMuscle
      );
    }
    if (filterText === 'gluteos') {
      return matchesSearch && (muscleGroup.includes('gluteo') || hasSecMuscle);
    }
    if (filterText === 'cuadriceps') {
      return matchesSearch && (
        muscleGroup.includes('cuadriceps') || muscleGroup.includes('cudriceps') || hasSecMuscle
      );
    }
    if (filterText === 'isquiosurales') {
      return matchesSearch && (
        muscleGroup.includes('femoral') || muscleGroup.includes('isquio') || hasSecMuscle
      );
    }
    if (filterText === 'pantorrillas') {
      return matchesSearch && (
        muscleGroup.includes('pantorrilla') || muscleGroup.includes('pantorilla') || hasSecMuscle
      );
    }
    if (filterText === 'piernas') {
      return matchesSearch && (
        muscleGroup.includes('pierna') || muscleGroup.includes('cuadriceps') || 
        muscleGroup.includes('isquio') || muscleGroup.includes('gluteo') || 
        muscleGroup.includes('pantorrilla') || hasSecMuscle
      );
    }
    return matchesSearch && (muscleGroup.includes(filterText) || filterText.includes(muscleGroup) || hasSecMuscle);
  });

  const handleUpgradeClick = () => {
    window.dispatchEvent(new CustomEvent('pwa-show-upgrade-modal'));
  };

  // Estilos de la marca blanca si aplica
  const themePrimaryColor = trainerProfile?.marca?.color_primario || 'var(--theme-primary, #00d4ff)';
  const themeFontFamily = trainerProfile?.marca?.tipografia || "'Orbitron', sans-serif";
  const brandName = trainerProfile?.marca?.nombre_display || 'EVOLUTION LAB';

  return (
    <>
    <div style={{ background: 'transparent', minHeight: '100vh', color: 'white', paddingBottom: '50px' }}>
      {isTrainer ? (
        <div className="top-bar" style={{ marginBottom: '10px', padding: '12px 0', position: 'relative', zIndex: 100 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
            
            {/* Logo & Heading */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => navigate('/trainer')}
                style={{
                  background: 'none',
                  border: '1px solid var(--theme-border)',
                  color: 'var(--theme-primary)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Orbitron', sans-serif",
                  padding: '8px 14px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                ← Volver al Panel
              </button>
              <div>
                <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '15px', fontWeight: 800, margin: 0, letterSpacing: '1px', display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#ffffff' }}>{profile?.marca?.nombre_display?.toUpperCase() || 'EVOLUTION'}</span> <span className="theme-text-gradient">{profile?.marca ? '' : 'LAB'}</span>
                  <span style={{ fontSize: '9px', fontWeight: 500, color: 'rgba(255,255,255,0.45)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px' }}>Developed by Juan Manuel Cardona</span>
                </h1>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Entrenador: <span style={{ color: 'var(--theme-secondary)', fontWeight: 600 }}>{profile?.marca?.nombre_display || profile?.nombre || 'Trainer'}</span>
                </div>
              </div>
            </div>

            {/* Navigation group */}
            <div className="nav-container" style={{ margin: 0, overflow: 'visible' }}>
              <div className="nav-group nav-group-plan" style={{ border: 'none', padding: 0 }}>
                <div className="nav-group-tabs" style={{ background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', display: 'flex', gap: '4px' }}>
                  <button
                    className="tab"
                    onClick={() => navigate('/trainer')}
                    style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                  >
                    <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Atletas
                  </button>
                  <button
                    className="tab"
                    onClick={() => navigate('/trainer')}
                    style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                  >
                    <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    Auditoría / Sesiones
                  </button>
                  <button
                    className="tab active"
                    onClick={() => navigate('/biblioteca')}
                    style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                  >
                    <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5v-15z" />
                    </svg>
                    Biblioteca
                  </button>
                  <button
                    className="tab"
                    onClick={() => navigate('/trainer/config')}
                    style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                  >
                    <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    Reglas Motor
                  </button>
                  <button
                    className="tab"
                    onClick={() => navigate('/trainer/branding')}
                    style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                  >
                    <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                    Mi Marca
                  </button>
                  <button
                    className="tab"
                    onClick={() => navigate('/dashboard')}
                    style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif", color: 'var(--theme-primary)' }}
                  >
                    <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                      <path d="M2 8h16v8H2z" />
                      <path d="M6 12h4" />
                    </svg>
                    Mi Entrenamiento
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      ) : (
        <AthleteNavbar />
      )}

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        {/* Cabecera de la Biblioteca */}
        <div style={{
          textAlign: 'center',
          marginBottom: '30px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '16px',
          padding: '24px',
          fontFamily: themeFontFamily
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 800,
            letterSpacing: '2px',
            margin: '0 0 8px 0',
            color: 'white'
          }}>
            BIBLIOTECA DE EJERCICIOS
          </h2>
          <p style={{
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.5)',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            margin: 0
          }}>
            Guía Ilustrada de Anatomía y Biomecánica{' '}
            {profile?.entrenador_id && (
              <span style={{ color: themePrimaryColor, fontWeight: 700 }}>
                | avalada por {brandName}
              </span>
            )}
          </p>
        </div>

        {/* --- MODO BLOQUEADO (PAYWALL) --- */}
        {isBlocked ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '450px',
            background: 'var(--theme-card-bg, #0f172a)',
            border: '1px solid var(--theme-border, rgba(255, 255, 255, 0.08))',
            borderRadius: '24px',
            padding: '40px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            maxWidth: '560px',
            margin: '40px auto 0 auto',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Efecto de Luz sci-fi */}
            <div style={{
              position: 'absolute',
              top: '-10%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '250px',
              height: '250px',
              background: 'radial-gradient(circle, rgba(0,212,255,0.15) 0%, transparent 70%)',
              filter: 'blur(30px)',
              pointerEvents: 'none'
            }} />

            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              boxShadow: '0 0 20px rgba(0, 212, 255, 0.2)'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--theme-primary, #00d4ff)" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            <h3 style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '18px',
              fontWeight: 800,
              letterSpacing: '1px',
              color: '#fff',
              margin: '0 0 12px 0'
            }}>
              BIBLIOTECA BIOMECÁNICA PREMIUM ⚡
            </h3>
            <p style={{
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.7)',
              lineHeight: '1.6',
              margin: '0 0 24px 0',
              fontFamily: 'sans-serif'
            }}>
              El catálogo completo con más de 100 ejercicios ilustrados, guías biomecánicas interactivas y búsqueda por mapa de calor muscular es una herramienta exclusiva para usuarios **Premium Pro**.
            </p>

            {/* Beneficios */}
            <div style={{
              textAlign: 'left',
              width: '100%',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '30px',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.8)',
              lineHeight: '1.8',
              fontFamily: 'sans-serif'
            }}>
              <p style={{ margin: '0 0 8px 0' }}>• 📷 <strong>100+ Guías Ilustradas:</strong> Fases inicial y final side-by-side.</p>
              <p style={{ margin: '0 0 8px 0' }}>• 🗺️ <strong>Buscador Muscular 3D:</strong> Filtra tocando músculos delantero/trasero.</p>
              <p style={{ margin: '0' }}>• 📈 <strong>Coach Inteligente:</strong> Recomendaciones de sobrecarga progresiva.</p>
            </div>

            <button
              onClick={handleUpgradeClick}
              className="theme-btn-gradient"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 800,
                fontSize: '12px',
                padding: '12px 30px',
                borderRadius: '12px',
                border: 'none',
                color: '#000',
                cursor: 'pointer',
                letterSpacing: '1px',
                boxShadow: '0 0 20px var(--theme-glow)'
              }}
            >
              OBTENER PREMIUM PRO 🚀
            </button>
          </div>
        ) : (
          /* --- MODO HABILITADO (PREMIUM O ENTRENADOR) --- */
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '30px',
            alignItems: 'start'
          }}>
            {/* Contenedor Grid Principal */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              width: '100%'
            }}>
              {/* Selector de Modalidad (Pestañas) */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <button
                  type="button"
                  onClick={() => { setSelectedModality('todos'); setSelectedMuscle(null); }}
                  style={{
                    padding: '8px 16px', borderRadius: '10px',
                    border: '1px solid ' + (selectedModality === 'todos' ? 'var(--theme-primary, #00d4ff)' : 'rgba(255,255,255,0.08)'),
                    background: selectedModality === 'todos' ? 'var(--theme-primary-alpha, rgba(0,212,255,0.15))' : 'rgba(15,23,42,0.6)',
                    color: selectedModality === 'todos' ? '#fff' : 'rgba(255,255,255,0.6)',
                    fontFamily: "'Orbitron', sans-serif", fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  TODOS
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedModality('musculacion'); setSelectedMuscle(null); }}
                  style={{
                    padding: '8px 16px', borderRadius: '10px',
                    border: '1px solid ' + (selectedModality === 'musculacion' ? '#00d4ff' : 'rgba(255,255,255,0.08)'),
                    background: selectedModality === 'musculacion' ? 'rgba(0,212,255,0.15)' : 'rgba(15,23,42,0.6)',
                    color: selectedModality === 'musculacion' ? '#fff' : 'rgba(255,255,255,0.6)',
                    fontFamily: "'Orbitron', sans-serif", fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  🏋️‍♂️ FUERZA
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedModality('funcional'); setSelectedMuscle(null); }}
                  style={{
                    padding: '8px 16px', borderRadius: '10px',
                    border: '1px solid ' + (selectedModality === 'funcional' ? '#ff7e2e' : 'rgba(255,255,255,0.08)'),
                    background: selectedModality === 'funcional' ? 'rgba(255,126,46,0.15)' : 'rgba(15,23,42,0.6)',
                    color: selectedModality === 'funcional' ? '#ff7e2e' : 'rgba(255,255,255,0.6)',
                    fontFamily: "'Orbitron', sans-serif", fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  ⚡ FUNCIONAL & HIIT
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedModality('calistenia'); setSelectedMuscle(null); }}
                  style={{
                    padding: '8px 16px', borderRadius: '10px',
                    border: '1px solid ' + (selectedModality === 'calistenia' ? '#10b981' : 'rgba(255,255,255,0.08)'),
                    background: selectedModality === 'calistenia' ? 'rgba(16,185,129,0.15)' : 'rgba(15,23,42,0.6)',
                    color: selectedModality === 'calistenia' ? '#10b981' : 'rgba(255,255,255,0.6)',
                    fontFamily: "'Orbitron', sans-serif", fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  🤸 CALISTENIA
                </button>
              </div>

              {/* Buscador de Texto */}
              <div style={{
                background: 'var(--theme-card-bg, #0f172a)',
                border: '1px solid var(--theme-border, rgba(255, 255, 255, 0.08))',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar ejercicio por nombre o palabra clave..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontSize: '13px',
                    width: '100%',
                    outline: 'none',
                    fontFamily: 'sans-serif'
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.4)',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Panel de Contenido: Mapa a la izquierda, lista a la derecha (en desktop) */}
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: '30px'
              }}>
                {/* Lateral: Mapa Muscular */}
                <div style={{
                  flex: '1 1 300px',
                  maxWidth: '360px',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <BodyMuscleMap
                    selectedMuscle={selectedMuscle}
                    onSelectMuscle={(muscle) => setSelectedMuscle(muscle)}
                  />

                  {/* Botón de acceso directo a Full Body / Funcionales */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMuscle(prev => prev === 'full body' ? null : 'full body');
                      setSelectedModality('funcional');
                    }}
                    style={{
                      width: '100%', marginTop: '12px', padding: '10px', borderRadius: '12px',
                      border: '1px solid ' + (selectedMuscle === 'full body' ? '#ff7e2e' : 'rgba(255,126,46,0.3)'),
                      background: selectedMuscle === 'full body' ? 'rgba(255,126,46,0.2)' : 'rgba(255,126,46,0.06)',
                      color: '#ff7e2e', fontFamily: "'Orbitron', sans-serif", fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    ⚡ VER EJERCICIOS FULL BODY / FUNCIONALES
                  </button>
                </div>

                {/* Lista de Ejercicios */}
                <div style={{
                  flex: '2 1 500px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px'
                }}>
                  {loadingExercises ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.4)' }}>
                      Cargando ejercicios de la biblioteca...
                    </div>
                  ) : filteredExercises.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '40px',
                      background: 'var(--theme-card-bg, #0f172a)',
                      border: '1px solid var(--theme-border, rgba(255, 255, 255, 0.08))',
                      borderRadius: '16px',
                      color: 'rgba(255, 255, 255, 0.4)',
                      fontFamily: 'sans-serif'
                    }}>
                      No se encontraron ejercicios con los filtros seleccionados.
                    </div>
                  ) : (
                    <>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '20px'
                      }}>
                        {filteredExercises.slice(0, visibleCount).map((exercise) => (
                        // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- efecto hover decorativo, no ejecuta ninguna acción de click; el link real es el <a> "Ver Video" de más abajo
                        <div
                          key={exercise.id}
                          style={{
                            background: 'var(--theme-card-bg, #0f172a)',
                            border: '1px solid var(--theme-border, rgba(255, 255, 255, 0.08))',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                            transition: 'transform 0.25s ease, border-color 0.25s ease',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                          }}
                        >
                          {/* Contenedor Imagen Biomecánica */}
                          <div style={{
                            width: '100%',
                            height: '180px',
                            background: '#04070e',
                            position: 'relative',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {exercise.imagen_url ? (
                              <img
                                src={exercise.imagen_url}
                                alt={exercise.nombre}
                                loading="lazy"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'contain'
                                }}
                              />
                            ) : (
                              <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', textTransform: 'uppercase', fontFamily: "'Orbitron', sans-serif" }}>
                                Ilustración Biomecánica
                              </div>
                            )}
                            {/* Grupo Muscular Badge */}
                            <span style={{
                              position: 'absolute',
                              top: '12px',
                              right: '12px',
                              background: 'rgba(7, 10, 19, 0.75)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '20px',
                              padding: '4px 10px',
                              fontSize: '9px',
                              fontWeight: 700,
                              color: 'white',
                              backdropFilter: 'blur(4px)',
                              fontFamily: "'Orbitron', sans-serif"
                            }}>
                              {exercise.grupo_muscular.toUpperCase()}
                            </span>
                          </div>

                          {/* Info Detalle */}
                          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                            <h4 style={{
                              fontFamily: "'Orbitron', sans-serif",
                              fontSize: '13px',
                              fontWeight: 800,
                              margin: '0 0 10px 0',
                              color: '#fff',
                              lineHeight: '1.4'
                            }}>
                              {exercise.nombre}
                            </h4>
                            <p style={{
                              fontSize: '11px',
                              color: 'rgba(255, 255, 255, 0.55)',
                              lineHeight: '1.6',
                              margin: '0 0 16px 0',
                              fontFamily: 'sans-serif',
                              flexGrow: 1
                            }}>
                              {exercise.descripcion || 'Sin descripción disponible para este ejercicio.'}
                            </p>

                            {/* Botones de acción: GIF + Video */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {/* Botón Ver GIF */}
                              {exercise.gif_url && (
                                <button
                                  type="button"
                                  onClick={() => openGifViewer(exercise, 'gif')}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    background: 'rgba(0, 212, 255, 0.08)',
                                    border: '1px solid rgba(0, 212, 255, 0.25)',
                                    borderRadius: '8px',
                                    padding: '8px 12px',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    color: 'var(--theme-primary, #00d4ff)',
                                    fontFamily: "'Orbitron', sans-serif",
                                    cursor: 'pointer',
                                    transition: 'background 0.2s ease, box-shadow 0.2s ease',
                                    width: '100%',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(0, 212, 255, 0.15)';
                                    e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 212, 255, 0.2)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(0, 212, 255, 0.08)';
                                    e.currentTarget.style.boxShadow = 'none';
                                  }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                  </svg>
                                  VER GIF
                                </button>
                              )}

                              {/* Botón Ver Video */}
                              {exercise.video_url && (
                                <a
                                  href={exercise.video_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '8px',
                                    padding: '8px 12px',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    color: 'white',
                                    textDecoration: 'none',
                                    fontFamily: "'Orbitron', sans-serif",
                                    transition: 'background 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--theme-primary, #00d4ff)" strokeWidth="2.5">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                  </svg>
                                  VER VIDEO GUÍA
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {filteredExercises.length > visibleCount && (
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '30px' }}>
                        <button
                          onClick={() => setVisibleCount((prev) => prev + 12)}
                          style={{
                            fontFamily: themeFontFamily,
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px',
                            color: 'white',
                            padding: '12px 24px',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            letterSpacing: '1px',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                            e.currentTarget.style.borderColor = themePrimaryColor;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                          }}
                        >
                          MOSTRAR MÁS EJERCICIOS 👇
                        </button>
                      </div>
                    )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ═══ MODAL VISOR DE GIF / IMAGEN ═══ */}
    {isGifViewerOpen && gifViewerExercise && (
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop de modal: cierra al hacer click afuera; el diálogo tiene Escape y foco atrapado vía useModalA11y
      <div
        onClick={() => setGifViewerExercise(null)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.88)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
      >
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- role="dialog" + Escape/foco atrapado vía useModalA11y; este onClick solo evita que el click se propague al backdrop */}
        <div
          ref={gifModalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="gif-viewer-title"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            background: '#04070e',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            overflow: 'hidden',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 0 60px rgba(0, 212, 255, 0.15)',
          }}
        >
          {/* Botón cerrar */}
          <button
            type="button"
            onClick={() => setGifViewerExercise(null)}
            aria-label="Cerrar visor"
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              zIndex: 10,
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
          >
            ✕
          </button>

          {/* Media: imagen o GIF protegido */}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- marco contenedor de proteccion contra clic derecho */}
          <div
            style={{ width: '100%', background: '#04070e', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '280px', flex: 1, overflow: 'hidden', position: 'relative' }}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          >
            <img
              src={
                gifViewerMediaType === 'gif'
                  ? (gifViewerExercise.gif_url || gifViewerExercise.imagen_url || '')
                  : (gifViewerExercise.imagen_url || gifViewerExercise.gif_url || '')
              }
              alt={gifViewerExercise.nombre}
              className="protected-media"
              style={{
                maxWidth: '100%',
                maxHeight: '60vh',
                objectFit: 'contain',
                display: 'block',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- capa transparente de proteccion contra clic derecho */}
            <div className="media-protection-overlay" onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()} />
          </div>

          {/* Footer: nombre + toggle */}
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}>
            <div>
              <p
                id="gif-viewer-title"
                style={{
                  margin: 0,
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'white',
                  letterSpacing: '0.5px',
                }}
              >
                {gifViewerExercise.nombre}
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {gifViewerExercise.grupo_muscular}
              </p>
            </div>

            {/* Botón toggle imagen ↔ GIF (solo si tiene ambos) */}
            {gifViewerExercise.imagen_url && gifViewerExercise.gif_url && (
              <button
                type="button"
                onClick={() => setGifViewerMediaType((prev) => (prev === 'gif' ? 'image' : 'gif'))}
                style={{
                  background: 'rgba(0, 212, 255, 0.1)',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  borderRadius: '20px',
                  padding: '6px 16px',
                  fontSize: '11px',
                  fontFamily: "'Orbitron', sans-serif",
                  fontWeight: 700,
                  color: 'var(--theme-primary, #00d4ff)',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 212, 255, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 212, 255, 0.1)'}
              >
                {gifViewerMediaType === 'gif' ? '🖼️ Ver Foto' : '🎬 Ver GIF'}
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default ExerciseLibrary;
