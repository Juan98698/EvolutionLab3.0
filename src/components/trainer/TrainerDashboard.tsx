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
  }, [location, navigate, refreshProfile]);

  useEffect(() => {
    if (profile?.id) {
      const isOnboarded = localStorage.getItem(`evolution_trainer_onboarded_v1_${profile.id}`);
      if (!isOnboarded) {
        setShowOnboarding(true);
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
    <div className={`app-container theme-${currentTheme}`}>
      <div className="noise-overlay"></div>
      {toastState.visible && (
        <Toast
          message={toastState.message}
          type={toastState.type}
          visible={toastState.visible}
        />
      )}

      {showOnboarding && <OnboardingModal rol="entrenador" trainerId={profile.id} onClose={() => setShowOnboarding(false)} />}

      <header className="header stagger-item" style={{ animationDelay: '0.1s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {profile.logo_url ? (
            <img src={profile.logo_url} alt="Logo" style={{ height: '40px', width: '40px', objectFit: 'contain', borderRadius: '50%' }} />
          ) : (
            <div className="logo-container">
              <span className="logo-icon">E</span>
            </div>
          )}
          <div>
            <h1 className="header-title" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              {profile.marca?.nombre_display || profile.nombre || 'EVOLUTION LAB'}
            </h1>
            <p className="header-subtitle">
              Plan {trainerSubscription?.plan.toUpperCase() || 'FREE'}
            </p>
          </div>
        </div>

        <div className="header-actions">
          {trainerSubscription?.plan === 'free' ? (
            <button className="btn" onClick={() => navigate('/trainer/config')} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px', background: 'var(--theme-btn-gradient)', color: 'white', border: 'none', borderRadius: '20px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700, boxShadow: '0 0 10px var(--theme-btn-glow)' }}>
              💎 Hazte Premium
            </button>
          ) : (
            <span style={{ fontSize: '10px', color: 'var(--theme-primary)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif", border: '1px solid var(--theme-primary)', padding: '4px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)' }}>
              💎 PREMIUM
            </span>
          )}

          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button className="icon-btn" onClick={() => setThemeOpen(!themeOpen)} title="Temas">
              🎨
            </button>
            {themeOpen && (
              <div style={{ position: 'absolute', top: '100%', right: '0', marginTop: '10px', background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '12px', padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', zIndex: 100, backdropFilter: 'blur(20px)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                {['cyan', 'orange', 'purple', 'green', 'rose', 'blue'].map(t => (
                  <button
                    key={t}
                    onClick={() => {
                      document.dispatchEvent(new CustomEvent('pwa-theme-changed', { detail: t }));
                      setThemeOpen(false);
                    }}
                    style={{ width: '30px', height: '30px', borderRadius: '50%', border: currentTheme === t ? '2px solid white' : 'none', background: `var(--theme-${t}-primary, #888)`, cursor: 'pointer' }}
                  />
                ))}
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={() => setShowAlertsHub(true)} title="Notificaciones">🔔</button>
          <button className="icon-btn" onClick={() => navigate('/trainer/profile')} title="Mi Perfil">👤</button>
          <button className="icon-btn" onClick={handleLogout} title="Cerrar Sesión">🚪</button>
        </div>
      </header>

      <main className="main-content">
        {showAlertsHub && (
          <TrainerAlertsHub
            visible={showAlertsHub}
            onClose={() => setShowAlertsHub(false)}
          />
        )}

        <div style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '16px', padding: '16px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontFamily: "'Orbitron', sans-serif", color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
              👤 MI ENTRENAMIENTO PERSONAL
            </h3>
            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Tu propio espacio de progreso</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-ghost" onClick={() => navigate(`/user/plan/${profile.id}`)} style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px' }}>
              🛠️ Editar mi plan
            </button>
            <button className="btn btn-primary" onClick={() => navigate(`/user/workout/${profile.id}`)} style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px' }}>
              ▶️ Iniciar Entrenamiento
            </button>
          </div>
        </div>

        <div className="tabs" style={{ marginBottom: '20px' }}>
          <button className={`tab ${activeSubTab === 'atletas' ? 'active' : ''}`} onClick={() => setActiveSubTab('atletas')}>
            👥 Mis Atletas
          </button>
          <button className={`tab ${activeSubTab === 'auditoria' ? 'active' : ''}`} onClick={() => setActiveSubTab('auditoria')}>
            📊 Auditoría
          </button>
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
      </main>

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
    </div>
  );
};

export default TrainerDashboard;
