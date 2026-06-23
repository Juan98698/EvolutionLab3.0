import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../context/SupabaseContext';
import { supabase } from '../../lib/supabaseClient';
import { EjercicioGlobal, Profile } from '../../types/database.types';
import BodyMuscleMap from '../common/BodyMuscleMap';
import AthleteNavbar from '../common/AthleteNavbar';

export const ExerciseLibrary: React.FC = () => {
  const { profile } = useSupabase();
  const [exercises, setExercises] = useState<EjercicioGlobal[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [trainerProfile, setTrainerProfile] = useState<Profile | null>(null);

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
  }, [supabase, isBlocked]);

  // Filtrado de ejercicios por texto y músculo
  const filteredExercises = exercises.filter((ex) => {
    const matchesSearch = ex.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (ex.descripcion?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    
    if (!selectedMuscle) return matchesSearch;

    const muscleGroup = ex.grupo_muscular.toLowerCase();
    const filterText = selectedMuscle.toLowerCase();

    // Mapeo flexible de filtros musculares del mapa a grupos musculares de ejercicios
    if (filterText === 'espalda') {
      return matchesSearch && (muscleGroup.includes('espalda') || muscleGroup.includes('dorsal') || muscleGroup.includes('lumbar'));
    }
    if (filterText === 'pecho') {
      return matchesSearch && (muscleGroup.includes('pecho') || muscleGroup.includes('pectoral'));
    }
    if (filterText === 'biceps' || filterText === 'triceps') {
      return matchesSearch && (muscleGroup.includes(filterText) || muscleGroup.includes('brazo'));
    }
    if (filterText === 'piernas') {
      return matchesSearch && (muscleGroup.includes('pierna') || muscleGroup.includes('cuadriceps') || muscleGroup.includes('femoral') || muscleGroup.includes('isquios') || muscleGroup.includes('gluteo') || muscleGroup.includes('pantorrilla'));
    }
    return matchesSearch && muscleGroup.includes(filterText);
  });

  const handleUpgradeClick = () => {
    window.dispatchEvent(new CustomEvent('pwa-show-upgrade-modal'));
  };

  // Estilos de la marca blanca si aplica
  const themePrimaryColor = trainerProfile?.marca?.color_primario || 'var(--theme-primary, #00d4ff)';
  const themeFontFamily = trainerProfile?.marca?.tipografia || "'Orbitron', sans-serif";
  const brandName = trainerProfile?.marca?.nombre_display || 'EVOLUTION LAB';

  return (
    <div style={{ background: '#070a13', minHeight: '100vh', color: 'white', paddingBottom: '50px' }}>
      <AthleteNavbar />

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
              gap: '30px',
              width: '100%'
            }}>
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
                  margin: '0 auto'
                }}>
                  <BodyMuscleMap
                    selectedMuscle={selectedMuscle}
                    onSelectMuscle={setSelectedMuscle}
                  />
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
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: '20px'
                    }}>
                      {filteredExercises.map((exercise) => (
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
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover'
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

                            {/* Botón Video */}
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
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExerciseLibrary;
