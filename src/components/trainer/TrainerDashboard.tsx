import React, { useState, useEffect, Suspense, lazy, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabase } from '../../context/SupabaseContext';
import { supabase } from '../../lib/supabaseClient';
import { Profile } from '../../types/database.types';
import Toast from '../common/Toast';
import TrainerAlertsHub from './TrainerAlertsHub';
import OnboardingModal from '../common/OnboardingModal';

import { useTrainerClients } from '../../hooks/trainer/useTrainerClients';
import { useTrainerAudits } from '../../hooks/trainer/useTrainerAudits';
import { useTrainerSubscription } from '../../hooks/trainer/useTrainerSubscription';

import TrainerClientsTab from './tabs/TrainerClientsTab';
import TrainerAuditsTab from './tabs/TrainerAuditsTab';

// Lazy Loaded Modals
const RegisterClientModal = lazy(() => import('./modals/RegisterClientModal'));
const RegisterSessionModal = lazy(() => import('./modals/RegisterSessionModal'));
const EvolutionModal = lazy(() => import('./modals/EvolutionModal'));
const RMCalculatorModal = lazy(() => import('./modals/RMCalculatorModal'));

export const TrainerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut, refreshProfile } = useSupabase();

  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    return localStorage.getItem('pwa_login_theme') || 'cyan';
  });

  const [toastState, setToastState] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info') => {
    setToastState({ visible: true, message: msg, type });
    // Ocultar toast automáticamente
    setTimeout(() => {
      setToastState(prev => ({ ...prev, visible: false }));
    }, 3000);
  }, []);

  // Hooks
  const { trainerSubscription, setTrainerSubscription } = useTrainerSubscription(profile, refreshProfile, showToast);
  
  const {
    clientes, setClientes, loading, searchQuery, setSearchQuery, filteredClientes: baseFilteredClientes,
    clientesLogros, clientesRachas, fetchClientes
  } = useTrainerClients(profile, showToast, setTrainerSubscription);

  const {
    actividades, alertasClientes, loadingAuditoria, fetchAuditoria, mostRecentSessionIds,
    availableExercisesForFilter, filasFiltradasProgresion, selectedAnalysisClient, setSelectedAnalysisClient,
    selectedAnalysisExercise, setSelectedAnalysisExercise, auditViewMode, setAuditViewMode,
    expandedActividades, setExpandedActividades
  } = useTrainerAudits(profile, showToast);

  const [activeSubTab, setActiveSubTab] = useState<'atletas' | 'auditoria'>('atletas');
  const [filterModalidad, setFilterModalidad] = useState<string>('all');
  const [registerOpen, setRegisterOpen] = useState<boolean>(false);
  const [updatingVigenciaId, setUpdatingVigenciaId] = useState<string | null>(null);
  
  const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState<boolean>(false);
  const [selectedAthleteForEvolution, setSelectedAthleteForEvolution] = useState<Profile | null>(null);

  const [isRegisterSessionModalOpen, setIsRegisterSessionModalOpen] = useState<boolean>(false);
  const [selectedAthleteForSession, setSelectedAthleteForSession] = useState<Profile | null>(null);

  const [is1RMModalOpen, setIs1RMModalOpen] = useState<boolean>(false);

  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [showAlertsHub, setShowAlertsHub] = useState<boolean>(false);
  const [themeOpen, setThemeOpen] = useState<boolean>(false);
  const [philosophyOpen, setPhilosophyOpen] = useState<boolean>(false);
  const [showPlanInfoModal, setShowPlanInfoModal] = useState<boolean>(false);
  const [showWelcomeGuide, setShowWelcomeGuide] = useState<boolean>(false);
  const [highlightSandbox, setHighlightSandbox] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchClientes();
    fetchAuditoria();
  }, [fetchClientes, fetchAuditoria]);

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setCurrentTheme(detail);
    };
    window.addEventListener('pwa-theme-changed', handleThemeChange);
    return () => window.removeEventListener('pwa-theme-changed', handleThemeChange);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setThemeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('payment_success') === 'true') {
      showToast('🎉 ¡Tu membresía ha sido renovada/actualizada!', 'success');
      refreshProfile();
      navigate(location.pathname, { replace: true });
    } else if (params.get('payment_cancel') === 'true') {
      showToast('Pago cancelado.', 'info');
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate, refreshProfile, showToast]);

  useEffect(() => {
    if (profile?.id) {
      const isOnboarded = localStorage.getItem(`evolution_trainer_onboarded_v1_${profile.id}`);
      if (!isOnboarded) {
        setShowOnboarding(true);
      } else {
        const hasSeenSandboxGuide = localStorage.getItem(`evolution_sandbox_guide_v1_${profile.id}`);
        if (!hasSeenSandboxGuide) {
          setShowWelcomeGuide(true);
          setHighlightSandbox(true);
        }
      }
    }
  }, [profile]);



  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error closing session:', error);
    }
  };

  const handleVigenciaLocalChange = (atletaId: string, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    setClientes((prev) => prev.map((c) => (c.id === atletaId ? { ...c, vigencia_dias: num } : c)));
  };

  const handleVigenciaSave = async (atletaId: string, newVigencia: number) => {
    setUpdatingVigenciaId(atletaId);
    try {
      const { error } = await supabase.from('profiles').update({ vigencia_dias: newVigencia }).eq('id', atletaId);
      if (error) throw error;
      showToast('✅ Vigencia de atleta actualizada.', 'success');
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setUpdatingVigenciaId(null);
    }
  };

  const handleOpenEvolutionModal = (atleta: Profile) => {
    setSelectedAthleteForEvolution(atleta);
    setIsEvolutionModalOpen(true);
  };

  const handleOpenRegisterSessionModal = (atleta: Profile) => {
    setSelectedAthleteForSession(atleta);
    setIsRegisterSessionModalOpen(true);
  };

  const finalFilteredClientes = baseFilteredClientes.filter(c => {
    if (filterModalidad === 'all') return true;
    return c.modalidad === filterModalidad;
  });

  if (!profile) return null;

  return (
    <div style={{ background: 'transparent', minHeight: '100vh', color: 'white', paddingBottom: '60px' }}>
      {toastState.visible && (
        <Toast
          message={toastState.message}
          type={toastState.type}
          visible={toastState.visible}
        />
      )}

      {showOnboarding && (
        <OnboardingModal
          rol="entrenador"
          trainerId={profile.id}
          onClose={() => {
            setShowOnboarding(false);
            setShowWelcomeGuide(true);
            setHighlightSandbox(true);
          }}
        />
      )}

      {/* HEADER BAR TRAINER */}
      <div className="top-bar" style={{ marginBottom: '10px', padding: '12px 0', position: 'relative', zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          
          {/* Logo & Greeting */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {profile?.logo_url ? (
              <div style={{ height: '68px', minWidth: '68px', maxWidth: '200px', borderRadius: '12px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)' }}>
                <img src={profile.logo_url} alt="Brand Logo" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
              </div>
            ) : profile?.marca ? (
              <div
                className="logo-symbol"
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(135deg, ${profile.marca.color_primario || '#00d4ff'}, ${profile.marca.color_secundario || '#0070a0'})`,
                  boxShadow: `0 0 12px ${(profile.marca.color_primario || '#00d4ff')}40`
                }}
              >
                <span style={{ fontSize: '20px', fontWeight: 800, color: 'white', fontFamily: "'Orbitron', sans-serif" }}>
                  {(profile.marca.nombre_display || profile.nombre || 'T').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
                </span>
              </div>
            ) : (
              <div className="logo-symbol" style={{ width: '68px', height: '68px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--theme-btn-gradient)', boxShadow: '0 0 15px var(--theme-glow)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
            )}
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
                  className={`tab ${activeSubTab === 'atletas' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('atletas')}
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
                  className={`tab ${activeSubTab === 'auditoria' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('auditoria')}
                  style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                >
                  <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  Auditoría / Sesiones
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

            {/* Dropdown theme selector */}
            <div ref={dropdownRef} style={{ position: 'relative', marginLeft: '10px', zIndex: 100 }}>
              <button
                onClick={() => setThemeOpen(!themeOpen)}
                style={{
                  fontSize: '11px',
                  fontFamily: "'Orbitron', sans-serif",
                  fontWeight: 700,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: 'white',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  height: '32px'
                }}
              >
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: currentTheme === 'gothic' ? '#990000' : (
                    currentTheme === 'cyberpunk' ? '#ccff00' :
                    currentTheme === 'monochrome' ? '#ffffff' :
                    currentTheme === 'green' ? '#00ff87' :
                    currentTheme === 'lava' ? '#ff6b00' :
                    currentTheme === 'gold' ? '#d4af37' : '#00d4ff'
                  ),
                  boxShadow: `0 0 6px ${
                    currentTheme === 'gothic' ? '#990000' : (
                      currentTheme === 'cyberpunk' ? '#ccff00' :
                      currentTheme === 'monochrome' ? '#ffffff' :
                      currentTheme === 'green' ? '#00ff87' :
                      currentTheme === 'lava' ? '#ff6b00' :
                      currentTheme === 'gold' ? '#d4af37' : '#00d4ff'
                    )
                  }`
                }} />
                Elegir Tema
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: themeOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {themeOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  background: 'rgba(15, 23, 42, 0.95)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  minWidth: '185px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  zIndex: 999
                }}>
                  {(['cyan', 'cyberpunk', 'monochrome', 'green', 'lava', 'gold', 'gothic'] as const).map((th) => {
                    const colors = {
                      cyan: '#00d4ff',
                      cyberpunk: '#ccff00',
                      monochrome: '#ffffff',
                      green: '#00ff87',
                      lava: '#ff6b00',
                      gold: '#d4af37',
                      gothic: '#990000'
                    };
                    const titles = {
                      cyan: 'Evolution Cyan',
                      cyberpunk: 'Cyberpunk Acid',
                      monochrome: 'Monochrome Raw',
                      green: 'Forest Bio-Green',
                      lava: 'Lava Crimson',
                      gold: 'Royal Gold',
                      gothic: 'Gothic Void'
                    };
                    const active = currentTheme === th;
                    return (
                      <button
                        key={th}
                        onClick={() => {
                          setCurrentTheme(th);
                          localStorage.setItem('pwa_login_theme', th);
                          document.documentElement.setAttribute('data-theme', th);
                          window.dispatchEvent(new CustomEvent('pwa-theme-changed', { detail: th }));
                          setThemeOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          width: '100%',
                          padding: '8px 12px',
                          background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                          border: 'none',
                          borderRadius: '8px',
                          color: active ? 'white' : 'rgba(255,255,255,0.65)',
                          fontSize: '11px',
                          fontFamily: "'Orbitron', sans-serif",
                          fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
                          }
                        }}
                      >
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: colors[th],
                          boxShadow: active ? `0 0 6px ${colors[th]}` : 'none'
                        }} />
                        {titles[th]}
                        {active && (
                          <span style={{ marginLeft: 'auto', color: 'var(--theme-primary)', fontWeight: 'bold', fontSize: '9px' }}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              style={{
                fontSize: '11px',
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 700,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '10px',
                color: '#fca5a5',
                padding: '8px 14px',
                cursor: 'pointer',
                marginLeft: '10px',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Salir
            </button>
          </div>
        </div>
      </div>

      {/* Banner de Suscripción Sutil del Entrenador */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        borderTop: '1px solid rgba(255, 255, 255, 0.02)',
        padding: '6px 20px',
        textAlign: 'center',
        fontSize: '9px',
        fontFamily: "'Orbitron', sans-serif",
        fontWeight: 600,
        letterSpacing: '1.2px',
        color: 'rgba(255, 255, 255, 0.65)',
        textTransform: 'uppercase',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '20px'
      }}>
        <span style={{
          display: 'inline-block',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: trainerSubscription?.estado === 'activo' ? 'var(--theme-primary)' : '#ef4444'
        }} />
        <span>
          Plan {
            trainerSubscription?.plan === 'free' ? 'Gratuito' :
            trainerSubscription?.plan === 'iniciacion' ? 'Iniciación' :
            trainerSubscription?.plan === 'intermedio' ? 'Intermedio' :
            trainerSubscription?.plan === 'profesional' ? 'Profesional' : 'Gratuito'
          }
        </span>
        <button
          onClick={() => setShowPlanInfoModal(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--theme-primary)',
            fontSize: '11px',
            cursor: 'pointer',
            padding: '2px 4px',
            display: 'inline-flex',
            alignItems: 'center',
            fontWeight: 'bold'
          }}
          title="Ver detalles del plan de entrenador"
        >
          ⓘ
        </button>
      </div>

      {/* Modal de Información del Plan del Entrenador */}
      {showPlanInfoModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }} onClick={() => setShowPlanInfoModal(false)}>
          <div style={{
            background: 'var(--theme-card-bg, #0f172a)',
            border: '1px solid var(--theme-border, rgba(255, 255, 255, 0.1))',
            borderRadius: '20px',
            padding: '24px',
            maxWidth: '420px',
            width: '100%',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            color: 'white',
            fontFamily: "'Orbitron', sans-serif",
            textAlign: 'left'
          }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowPlanInfoModal(false)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '18px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
            <h3 style={{ fontSize: '13px', color: 'var(--theme-primary, #00d4ff)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px', marginTop: 0 }}>
              Detalles de Suscripción Coach
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                <span>Plan actual:</span>
                <strong style={{ color: 'var(--theme-primary)', textTransform: 'uppercase' }}>
                  {trainerSubscription?.plan || 'Gratuito'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                <span>Estado:</span>
                <strong style={{ color: trainerSubscription?.estado === 'activo' ? '#10b981' : '#ef4444', textTransform: 'uppercase' }}>
                  {trainerSubscription?.estado || 'Activo'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Expira el:</span>
                <strong>
                  {trainerSubscription?.expira_at
                    ? new Date(trainerSubscription.expira_at).toLocaleDateString('es-ES')
                    : 'Nunca (Plan Gratuito)'
                  }
                </strong>
              </div>
            </div>
            
            <div style={{ background: 'rgba(0, 212, 255, 0.05)', border: '1px solid rgba(0, 212, 255, 0.15)', borderRadius: '12px', padding: '12px', marginBottom: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
              {trainerSubscription?.plan === 'free' ? (
                <span>El Plan Gratuito te permite gestionar hasta 2 atletas activos simultáneamente. Actualiza para atletas ilimitados.</span>
              ) : (
                <span>¡Gracias por ser miembro Premium! Tu plan incluye atletas y auditorías ilimitadas.</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowPlanInfoModal(false)}
                className="btn btn-ghost"
                style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'white', cursor: 'pointer' }}
              >
                Cerrar
              </button>
              {trainerSubscription?.plan === 'free' && (
                <button
                  onClick={() => {
                    setShowPlanInfoModal(false);
                    navigate('/trainer/config');
                  }}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', background: 'var(--theme-btn-gradient)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  Ver Planes
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
        
        <TrainerAlertsHub visible={showAlertsHub} onClose={() => setShowAlertsHub(false)} />

        {/* MI ENTRENAMIENTO PERSONAL CARD */}
        {profile && (
          <div style={{
            background: 'var(--theme-card-bg)',
            border: highlightSandbox ? '2px solid #00f2fe' : '1px solid var(--theme-border)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '15px',
            boxShadow: highlightSandbox ? '0 0 25px rgba(0, 242, 254, 0.6)' : '0 8px 32px 0 var(--theme-glow)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            transition: 'all 0.5s ease',
            animation: highlightSandbox ? 'pulseSandboxBorder 1.5s infinite alternate' : 'none',
          }}>
            <style>{`
              @keyframes pulseSandboxBorder {
                0% { border-color: rgba(0, 242, 254, 0.3); box-shadow: 0 0 10px rgba(0, 242, 254, 0.2); }
                100% { border-color: rgba(0, 242, 254, 1); box-shadow: 0 0 30px rgba(0, 242, 254, 0.8); }
              }
            `}</style>
            <div>
              <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--theme-primary)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <path d="M6.5 6.5h11M6.5 4h-2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2M17.5 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2" />
                </svg>
                MI ENTRENAMIENTO PERSONAL
              </h3>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
                Planifica tu propio programa de entrenamiento, registra tus sesiones de sobrecarga progresiva y mira tus métricas personales.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/trainer/plan/${profile.id}`)}
                style={{ background: 'var(--theme-btn-gradient)', fontSize: '11px', padding: '10px 16px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700, cursor: 'pointer', border: 'none', borderRadius: '8px', color: 'white', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 14px var(--theme-btn-glow)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg> Planificar Mi Rutina
              </button>
              <button
                className="btn"
                onClick={() => navigate('/dashboard')}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '11px', padding: '10px 16px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700, cursor: 'pointer', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M6.5 6.5h11M6.5 4h-2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2M17.5 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/></svg> Entrar a Entrenar
              </button>
            </div>
          </div>
        )}

        {/* COLLAPSIBLE PHILOSOPHY CARD */}
        <div style={{ marginBottom: '25px' }}>
          <div
            className={`philosophy-toggle${philosophyOpen ? ' open' : ''}`}
            onClick={() => setPhilosophyOpen(!philosophyOpen)}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            <span className="philosophy-toggle-title" style={{ fontWeight: 700, fontSize: '13px', fontFamily: "'Orbitron', sans-serif", color: 'var(--theme-primary)', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Nuestra Filosofía de Entrenamiento
            </span>
            <span className="philosophy-toggle-icon" style={{ fontSize: '12px', color: 'var(--theme-primary)', transition: 'transform 0.3s ease' }}>
              {philosophyOpen ? '▲' : '▼'}
            </span>
          </div>

          <div
            className="philosophy-collapsible"
            style={{
              maxHeight: philosophyOpen ? '3000px' : '0px',
              overflow: 'hidden',
              transition: 'all 0.5s cubic-bezier(0, 1, 0, 1)'
            }}
          >
            <div className="philosophy-section" style={{ borderTop: 'none', marginTop: 0, padding: '24px 20px', background: 'rgba(15, 23, 42, 0.35)', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
              <h2 className="philosophy-title" style={{ fontSize: '1.5rem' }}>SISTEMA DE ENTRENAMIENTO</h2>
              <p className="philosophy-author">
                Por <span id="trainerNameDisplay">{profile?.marca?.nombre_display || profile?.nombre || 'Evolution Lab'}</span>
              </p>

              <div className="philosophy-quote">
                <p style={{ whiteSpace: 'pre-line' }}>
                  {profile?.marca?.eslogan || 'NO NECESITAS ENTRENAR MÁS.\nNECESITAS ENTRENAR MEJOR.'}
                </p>
              </div>

              <p className="philosophy-description">
                Este sistema fue diseñado para maximizar resultados a través de estímulo inteligente, técnica eficiente y progresión estructurada.
              </p>

              <h3 className="philosophy-subtitle">¿QUÉ HACE DIFERENTE ESTE MÉTODO?</h3>

              <div className="philosophy-grid">
                {/* Pilar 1 */}
                <div className="philosophy-card">
                  <span className="pillar-number">Pilar 01</span>
                  <strong>ENTRENAMIENTO BASADO EN ESTÍMULO REAL</strong>
                  <p>Cada ejercicio tiene una función específica dentro del programa. Nada está puesto al azar.</p>
                </div>

                {/* Pilar 2 */}
                <div className="philosophy-card">
                  <span className="pillar-number">Pilar 02</span>
                  <strong>INTENSIDAD CONTROLADA</strong>
                  <p>No buscamos agotarte. Buscamos generar adaptación. La intensidad se utiliza estratégicamente para progresar sin destruir la recuperación.</p>
                </div>

                {/* Pilar 3 */}
                <div className="philosophy-card">
                  <span className="pillar-number">Pilar 03</span>
                  <strong>TÉCNICA COMO PRIORIDAD</strong>
                  <p>La ejecución determina qué músculo trabaja realmente. Menos ego. Más control. Más resultados.</p>
                </div>

                {/* Pilar 4 */}
                <div className="philosophy-card">
                  <span className="pillar-number">Pilar 04</span>
                  <strong>PROGRESIÓN MEDIBLE</strong>
                  <p>El objetivo no es “sentir” que entrenaste fuerte. El objetivo es mejorar rendimiento, composición corporal y capacidad física semana tras semana.</p>
                </div>

                {/* Pilar 5 */}
                <div className="philosophy-card full-width">
                  <span className="pillar-number">Pilar 05</span>
                  <strong>RECUPERACIÓN PLANIFICADA</strong>
                  <p>Dormir, recuperarse y manejar la fatiga también hacen parte del progreso.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {activeSubTab === 'atletas' ? (
          <TrainerClientsTab
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filterModalidad={filterModalidad}
            setFilterModalidad={setFilterModalidad}
            setRegisterOpen={setRegisterOpen}
            loading={loading}
            filteredClientes={finalFilteredClientes}
            updatingVigenciaId={updatingVigenciaId}
            handleVigenciaLocalChange={handleVigenciaLocalChange}
            handleVigenciaSave={handleVigenciaSave}
            clientesRachas={clientesRachas}
            clientesLogros={clientesLogros}
            navigate={navigate}
            handleOpenRegisterSessionModal={handleOpenRegisterSessionModal}
            handleOpenEvolutionModal={handleOpenEvolutionModal}
          />
        ) : (
          <TrainerAuditsTab
            actividades={actividades}
            alertasClientes={alertasClientes}
            loadingAuditoria={loadingAuditoria}
            fetchAuditoria={fetchAuditoria}
            mostRecentSessionIds={mostRecentSessionIds}
            availableExercisesForFilter={availableExercisesForFilter}
            filasFiltradasProgresion={filasFiltradasProgresion}
            selectedAnalysisClient={selectedAnalysisClient}
            setSelectedAnalysisClient={setSelectedAnalysisClient}
            selectedAnalysisExercise={selectedAnalysisExercise}
            setSelectedAnalysisExercise={setSelectedAnalysisExercise}
            auditViewMode={auditViewMode}
            setAuditViewMode={setAuditViewMode}
            expandedActividades={expandedActividades}
            setExpandedActividades={setExpandedActividades}
            clientes={clientes}
          />
        )}
      </div>

      <button
        id="fab1RMBtn"
        onClick={() => setIs1RMModalOpen(true)}
        style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--theme-btn-gradient)', border: 'none', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', boxShadow: '0 4px 20px var(--theme-btn-glow)', zIndex: 1000, transition: 'all 0.2s' }}
        title="Calculadora 1RM"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
          <line x1="9" y1="22" x2="9" y2="16" />
          <line x1="15" y1="22" x2="15" y2="16" />
          <line x1="9" y1="16" x2="15" y2="16" />
        </svg>
      </button>

      <Suspense fallback={<div style={{ display: 'none' }}>Cargando modales...</div>}>
        <RegisterClientModal
          isOpen={registerOpen}
          onClose={() => setRegisterOpen(false)}
          profile={profile}
          fetchClientes={fetchClientes}
          showToast={showToast}
          clientes={clientes}
        />

        <RegisterSessionModal
          isOpen={isRegisterSessionModalOpen}
          onClose={() => setIsRegisterSessionModalOpen(false)}
          selectedAthleteForSession={selectedAthleteForSession}
          showToast={showToast}
          fetchAuditoria={fetchAuditoria}
        />

        <EvolutionModal
          isOpen={isEvolutionModalOpen}
          onClose={() => setIsEvolutionModalOpen(false)}
          selectedAthleteForEvolution={selectedAthleteForEvolution}
          trainerSubscription={trainerSubscription}
          profile={profile}
          showToast={showToast}
        />

        <RMCalculatorModal
          isOpen={is1RMModalOpen}
          onClose={() => setIs1RMModalOpen(false)}
          showToast={showToast}
        />
      </Suspense>

      {/* Sandbox Guide Modal */}
      {showWelcomeGuide && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 8, 16, 0.85)', backdropFilter: 'blur(10px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          fontFamily: "'Inter', sans-serif"
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #0e172a 0%, #0b0f19 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 242, 254, 0.15)',
            borderRadius: '20px', maxWidth: '460px', width: '100%', padding: '30px',
            color: 'white', textAlign: 'center', position: 'relative'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧪</div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 10px 0', background: 'linear-gradient(to right, #00f2fe, #4facfe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ¡Tu Plan de Práctica está Listo!
            </h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              Hemos configurado un plan sandbox llamado <strong>🧪 Plan de práctica</strong>. En él pre-cargamos marcas científicas de 1RM ficticias para que puedas experimentar la prescripción del robot inteligente 🤖 de inmediato.
            </p>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '14px 16px', marginBottom: '24px', textAlign: 'left' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)' }}>
                <span style={{ fontSize: '14px' }}>👉</span>
                <span>
                  Baja a la sección <strong>"MI ENTRENAMIENTO PERSONAL"</strong> abajo en el dashboard y pulsa el botón <strong>"Planificar Mi Rutina"</strong>. La tarjeta estará brillando en azul.
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setShowWelcomeGuide(false);
                if (profile?.id) {
                  localStorage.setItem(`evolution_sandbox_guide_v1_${profile.id}`, 'true');
                }
                // Scroll suave a la tarjeta de entrenamiento personal
                setTimeout(() => {
                  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                }, 100);
              }}
              style={{
                width: '100%', background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                color: '#000', border: 'none', borderRadius: '10px', padding: '12px',
                fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0, 242, 254, 0.3)', transition: 'transform 0.2s'
              }}
            >
              Comenzar a explorar 🚀
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainerDashboard;
