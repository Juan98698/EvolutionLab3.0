import React, { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabase } from '../../context/SupabaseContext';
import { usePaymentReturn } from '../../hooks/usePaymentReturn';
import { supabase } from '../../lib/supabaseClient';
import { lazyWithRetry } from '../../lib/lazyWithRetry';
import { Profile, ValoracionAntropometrica } from '../../types/database.types';
import Toast from '../common/Toast';
import TrainerAlertsHub from './TrainerAlertsHub';
import OnboardingModal from '../common/OnboardingModal';

import { useTrainerClients } from '../../hooks/trainer/useTrainerClients';
import { useModalA11y } from '../../hooks/useModalA11y';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { useTrainerAudits } from '../../hooks/trainer/useTrainerAudits';
import { useTrainerSubscription } from '../../hooks/trainer/useTrainerSubscription';
import { useConfirm } from '../../context/ConfirmDialogContext';

import TrainerClientsTab from './tabs/TrainerClientsTab';
import TrainerAuditsTab from './tabs/TrainerAuditsTab';
import {
  saveActiveNutritionSession,
  getActiveNutritionSession,
  clearActiveNutritionSession,
} from '../../lib/nutritionDraftStore';

// Lazy Loaded Modals
const RegisterClientModal = lazyWithRetry(() => import('./modals/RegisterClientModal'));
const RegisterSessionModal = lazyWithRetry(() => import('./modals/RegisterSessionModal'));
const EvolutionModal = lazyWithRetry(() => import('./modals/EvolutionModal'));
const RMCalculatorModal = lazyWithRetry(() => import('./modals/RMCalculatorModal'));
const AnthropometryModal = lazyWithRetry(() => import('./modals/AnthropometryModal'));
const NutritionPlannerModal = lazyWithRetry(() => import('../nutrition/NutritionPlannerModal'));

export const TrainerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut, refreshProfile } = useSupabase();
  const confirm = useConfirm();

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
  useEffect(() => { setActiveSubTab(new URLSearchParams(location.search).get('view') === 'auditoria' ? 'auditoria' : 'atletas'); }, [location.search]);
  const [filterModalidad, setFilterModalidad] = useState<string>('all');
  const [registerOpen, setRegisterOpen] = useState<boolean>(false);
  const [updatingVigenciaId, setUpdatingVigenciaId] = useState<string | null>(null);
  
  const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState<boolean>(false);
  const [selectedAthleteForEvolution, setSelectedAthleteForEvolution] = useState<Profile | null>(null);

  const [isRegisterSessionModalOpen, setIsRegisterSessionModalOpen] = useState<boolean>(false);
  const [selectedAthleteForSession, setSelectedAthleteForSession] = useState<Profile | null>(null);

  const [is1RMModalOpen, setIs1RMModalOpen] = useState<boolean>(false);

  const [isAnthropometryModalOpen, setIsAnthropometryModalOpen] = useState<boolean>(false);
  const [selectedAthleteForAnthropometry, setSelectedAthleteForAnthropometry] = useState<Profile | null>(null);

  // Sesión activa persistente de planificación nutricional
  const initialNutritionSession = useRef(getActiveNutritionSession());
  const [isNutritionModalOpen, setIsNutritionModalOpen] = useState<boolean>(() => {
    return Boolean(initialNutritionSession.current?.atleta);
  });
  const [selectedAthleteForNutrition, setSelectedAthleteForNutrition] = useState<Profile | null>(() => {
    return initialNutritionSession.current?.atleta || null;
  });
  const [selectedValuationForNutrition, setSelectedValuationForNutrition] = useState<ValoracionAntropometrica | null>(() => {
    return initialNutritionSession.current?.valuation || null;
  });

  const isPaidTrainer = Boolean(
    (trainerSubscription?.plan && trainerSubscription.plan !== 'free') ||
    (profile?.suscripcion_plan && profile.suscripcion_plan !== 'free')
  );

  // Validación de seguridad: si el perfil de entrenador cargado no coincide con el de la sesión restaurada, cerrar
  useEffect(() => {
    if (profile?.id && isNutritionModalOpen && initialNutritionSession.current?.trainerId) {
      if (initialNutritionSession.current.trainerId !== profile.id) {
        clearActiveNutritionSession();
        setIsNutritionModalOpen(false);
        setSelectedAthleteForNutrition(null);
        setSelectedValuationForNutrition(null);
      }
    }
  }, [profile?.id, isNutritionModalOpen]);

  const handleOpenAnthropometryModal = (atleta: Profile) => {
    if (!isPaidTrainer) {
      showToast('🔒 La valoración antropométrica y macros es una funcionalidad exclusiva para entrenadores con membresía de pago. ¡Actualiza tu plan para desbloquearla!', 'info');
      return;
    }
    setSelectedAthleteForAnthropometry(atleta);
    setIsAnthropometryModalOpen(true);
  };

  const handleOpenNutritionModal = async (atleta: Profile, valuation?: ValoracionAntropometrica | null) => {
    if (!isPaidTrainer) {
      showToast('🔒 La planificación de nutrición y dieta es una funcionalidad exclusiva para entrenadores con membresía de pago. ¡Actualiza tu plan para desbloquearla!', 'info');
      return;
    }
    setSelectedAthleteForNutrition(atleta);
    let resolvedValuation = valuation || null;
    if (resolvedValuation) {
      setSelectedValuationForNutrition(resolvedValuation);
    } else {
      try {
        const { data, error } = await supabase
          .from('valoraciones_antropometricas')
          .select('*')
          .eq('cliente_id', atleta.id)
          .order('fecha', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data && !error) {
          resolvedValuation = data as ValoracionAntropometrica;
          setSelectedValuationForNutrition(resolvedValuation);
        } else {
          setSelectedValuationForNutrition(null);
        }
      } catch (e) {
        console.error('Error al cargar valoración para nutrición:', e);
        setSelectedValuationForNutrition(null);
      }
    }
    saveActiveNutritionSession(atleta, resolvedValuation, profile?.id);
    setIsNutritionModalOpen(true);
  };

  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [showAlertsHub, setShowAlertsHub] = useState<boolean>(false);
  const [showPlanInfoModal, setShowPlanInfoModal] = useState<boolean>(false);
  const planInfoDialogRef = useModalA11y<HTMLDivElement>({
    isOpen: showPlanInfoModal,
    onClose: () => setShowPlanInfoModal(false),
  });
  const [showWelcomeGuide, setShowWelcomeGuide] = useState<boolean>(false);
  const [highlightSandbox, setHighlightSandbox] = useState<boolean>(false);


  useEffect(() => {
    fetchClientes();
    fetchAuditoria();
  }, [fetchClientes, fetchAuditoria]);

  // Si el usuario navega a la pestaña Auditoría y no hay datos (p. ej. el fetch
  // de mount falló porque profile era null), reintenta con force=true.
  useEffect(() => {
    if (activeSubTab === 'auditoria' && actividades.length === 0 && !loadingAuditoria) {
      fetchAuditoria(true);
    }
  }, [activeSubTab, actividades.length, loadingAuditoria, fetchAuditoria]);

  usePaymentReturn(showToast, {
    success: 'Tu membresía ha sido renovada/actualizada.',
    cancel: 'Pago cancelado.',
  });


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
    if (!(await confirm('¿Seguro que deseas cerrar la sesión?', { title: 'Cerrar sesión', confirmText: 'Cerrar sesión' }))) {
      return;
    }
    try {
      clearActiveNutritionSession();
      await signOut();
      navigate('/login');
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

      // Notificar al atleta en tiempo real para que refresque su perfil y vigencia sin recargar
      const channel = supabase.channel('plan-updates:' + atletaId);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'plan-updated',
            payload: { message: 'Se ha actualizado la vigencia de tu plan.' }
          });
          setTimeout(() => { supabase.removeChannel(channel); }, 1000);
        }
      });
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

      <div className="studio-page-heading">
        <div><p className="studio-eyebrow">{profile.marca?.nombre_display || profile.nombre}</p><h1>Tu equipo, al día.</h1><p>Planificación y seguimiento, en un solo espacio.</p></div>
        <div><button className="btn btn-ghost" onClick={() => setIs1RMModalOpen(true)}>Calculadora 1RM</button><button className="btn btn-ghost studio-standalone-signout" onClick={handleLogout}>Salir</button></div>
      </div>
      <div className="studio-summary"><div><span>Atletas vinculados</span><strong>{clientes.length}</strong></div><div><span>Sesiones recientes</span><strong>{actividades.length}</strong></div><div><span>Seguimientos disponibles</span><strong>{Object.values(alertasClientes).filter(alerts => alerts.length > 0).length}</strong></div></div>
      <div className="studio-tabs" aria-label="Vistas del equipo"><button onClick={() => setActiveSubTab('atletas')} aria-pressed={activeSubTab === 'atletas'}>Atletas</button><button onClick={() => setActiveSubTab('auditoria')} aria-pressed={activeSubTab === 'auditoria'}>Auditoría / Sesiones</button></div>
      {/* Banner de Suscripción Sutil del Entrenador */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        borderTop: '1px solid rgba(255, 255, 255, 0.02)',
        padding: '6px 20px',
        textAlign: 'center',
        fontSize: '12px',
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
        letterSpacing: '0',
        color: '#a4b0a8',
        textTransform: 'none',
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
          background: trainerSubscription?.estado === 'activo' ? 'var(--theme-primary)' : 'var(--color-danger)'
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
            fontSize: '12px',
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
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop de modal: cierra al hacer click afuera (conveniencia de mouse); el diálogo de abajo ya tiene cierre con Escape y foco atrapado vía useModalA11y
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }} onClick={() => setShowPlanInfoModal(false)}>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- ya tiene role="dialog" + Escape/foco atrapado vía useModalA11y; este onClick solo evita que el click se propague al backdrop */}
          <div
            ref={planInfoDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="trainer-plan-info-title"
            tabIndex={-1}
            style={{
            background: 'var(--theme-card-bg, #1a211e)',
            border: '1px solid var(--theme-border, rgba(255, 255, 255, 0.1))',
            borderRadius: '20px',
            padding: '24px',
            maxWidth: '420px',
            width: '100%',
            boxShadow: 'none',
            position: 'relative',
            color: 'white',
            fontFamily: "'Inter', sans-serif",
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
                color: '#a4b0a8',
                fontSize: '18px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
            <h3 id="trainer-plan-info-title" style={{ fontSize: '13px', color: 'var(--theme-primary, #91b6a1)', letterSpacing: '0', textTransform: 'none', marginBottom: '16px', marginTop: 0 }}>
              Detalles de Suscripción Coach
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                <span>Plan actual:</span>
                <strong style={{ color: 'var(--theme-primary)', textTransform: 'none' }}>
                  {trainerSubscription?.plan || 'Gratuito'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                <span>Estado:</span>
                <strong style={{ color: trainerSubscription?.estado === 'activo' ? 'var(--color-success)' : 'var(--color-danger)', textTransform: 'none' }}>
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
            
            <div style={{ background: 'rgba(145, 182, 161, 0.05)', border: '1px solid rgba(145, 182, 161, 0.15)', borderRadius: '12px', padding: '12px', marginBottom: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
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
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', background: 'var(--studio-accent)', color: 'var(--studio-bg)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  Ver Planes
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        <ErrorBoundary label="Central de Alertas">
          <TrainerAlertsHub visible={showAlertsHub} onClose={() => setShowAlertsHub(false)} />
        </ErrorBoundary>

        <details className="studio-details" open={highlightSandbox || undefined}>
          <summary>Mi entrenamiento personal</summary>
          <p>Organiza tu propio programa y registra tus sesiones.</p>
          <button className="btn btn-primary" onClick={() => navigate(`/trainer/plan/${profile.id}`)}>Planificar Mi Rutina</button>
          <button className="btn" onClick={() => navigate('/dashboard')}>Entrar a Entrenar</button>
        </details>
        <details className="studio-details">
          <summary>Nuestra filosofía de entrenamiento</summary>
          <p>{profile.marca?.eslogan || 'Entrenamiento con intención, progreso medible y recuperación planificada.'}</p>
          {profile.filosofia?.map(pillar => <div key={pillar.id}><h3>{pillar.titulo}</h3><p>{pillar.descripcion}</p></div>)}
        </details>

        {activeSubTab === 'atletas' ? (
          <ErrorBoundary label="Tab Atletas">
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
              handleOpenAnthropometryModal={handleOpenAnthropometryModal}
              handleOpenNutritionModal={handleOpenNutritionModal}
              trainerSubscription={trainerSubscription}
              trainerProfile={profile}
              showToast={showToast}
            />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary label="Tab Auditoría">
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
          </ErrorBoundary>
        )}
      </div>

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

        {isAnthropometryModalOpen && selectedAthleteForAnthropometry && (
          <AnthropometryModal
            isOpen={isAnthropometryModalOpen}
            onClose={() => setIsAnthropometryModalOpen(false)}
            atleta={selectedAthleteForAnthropometry}
            trainerProfile={profile}
            showToast={showToast}
            onOpenNutritionPlan={(atleta, valuation) => {
              setIsAnthropometryModalOpen(false);
              handleOpenNutritionModal(atleta, valuation);
            }}
          />
        )}

        {isNutritionModalOpen && selectedAthleteForNutrition && (
          <NutritionPlannerModal
            isOpen={isNutritionModalOpen}
            onClose={() => {
              clearActiveNutritionSession();
              setIsNutritionModalOpen(false);
              setSelectedAthleteForNutrition(null);
              setSelectedValuationForNutrition(null);
            }}
            atleta={selectedAthleteForNutrition}
            initialValuation={selectedValuationForNutrition}
            trainerProfile={profile}
            showToast={showToast}
          />
        )}
      </Suspense>

      {/* Sandbox Guide Modal */}
      {showWelcomeGuide && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 8, 16, 0.85)', backdropFilter: 'none',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          fontFamily: "'Inter', sans-serif"
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #0e172a 0%, #121716 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: 'none',
            borderRadius: '20px', maxWidth: '460px', width: '100%', padding: '30px',
            color: 'white', textAlign: 'center', position: 'relative'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧪</div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 10px 0', background: 'linear-gradient(to right, #91b6a1, #4facfe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ¡Tu Plan de Práctica está Listo!
            </h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              Hemos configurado un plan sandbox llamado <strong>🧪 Plan de práctica</strong>. En él pre-cargamos marcas científicas de 1RM ficticias para que puedas experimentar la prescripción del robot inteligente 🤖 de inmediato.
            </p>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '14px 16px', marginBottom: '24px', textAlign: 'left' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)' }}>
                <span style={{ fontSize: '14px' }}>👉</span>
                <span>
                  Baja a la sección <strong>"MI ENTRENAMIENTO PERSONAL"</strong> abajo en el dashboard y pulsa el botón <strong>"Planificar Mi Rutina"</strong>. Encontrarás las acciones dentro de Mi entrenamiento personal.
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
                width: '100%', background: 'linear-gradient(135deg, #91b6a1 0%, #4facfe 100%)',
                color: '#000', border: 'none', borderRadius: '10px', padding: '12px',
                fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                boxShadow: 'none', transition: 'transform 0.2s'
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
