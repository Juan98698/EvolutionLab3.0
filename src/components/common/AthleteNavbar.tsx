import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../../context/SupabaseContext';
import { supabase } from '../../lib/supabaseClient';
import { useModalA11y } from '../../hooks/useModalA11y';
import Toast from './Toast';

export const AthleteNavbar: React.FC<{ onOpenCalculator?: () => void }> = ({ onOpenCalculator }) => {
  const navigate = useNavigate();
  const { profile, isSoloClient } = useSupabase();


  const [showPlanInfoModal, setShowPlanInfoModal] = useState(false);
  const planInfoDialogRef = useModalA11y<HTMLDivElement>({
    isOpen: showPlanInfoModal,
    onClose: () => setShowPlanInfoModal(false),
  });
  const [trainerProfile, setTrainerProfile] = useState<any>(() => {
      if (profile?.entrenador_id) {
        try {
          const cached = localStorage.getItem('pwa_trainer_profile_' + profile.entrenador_id);
          if (cached) return JSON.parse(cached);
        } catch{}
      }
      return null;
    });
  // Estados del modal de pago global Solo Lifter
  const [paymentLoading, setPaymentLoading] = useState<boolean>(false);
  const [showSoloUpgradeModal, setShowSoloUpgradeModal] = useState<boolean>(false);
  const [toastState, setToastState] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastState({ visible: true, message, type });
    setTimeout(() => {
      setToastState((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  const handleMercadoPagoCheckout = async (plan: 'premium' | 'coach', redirectPath: string) => {
    setPaymentLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Debes iniciar sesión para realizar la compra.');
      }

      const response = await fetch('/api/create-mercadopago-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: profile?.id,
          email: profile?.email,
          plan,
          redirectPath,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; // Redirigir a MercadoPago Checkout
      } else {
        throw new Error(data.error || 'No se obtuvo la URL de pago');
      }
    } catch (err: any) {
      console.error('MercadoPago redirect error:', err);
      showToast('Error al conectar con MercadoPago: ' + err.message, 'error');
    } finally {
      setPaymentLoading(false);
    }
  };

  useEffect(() => {
    const handleShowUpgrade = () => {
      setShowSoloUpgradeModal(true);
    };
    window.addEventListener('pwa-show-upgrade-modal', handleShowUpgrade);
    return () => window.removeEventListener('pwa-show-upgrade-modal', handleShowUpgrade);
  }, []);

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
              try {
                localStorage.setItem('pwa_trainer_profile_' + profile.entrenador_id, JSON.stringify(data));
              } catch{}
          }
        } catch (e) {
          console.error('Error al cargar perfil del coach:', e);
        }
      }
    };
    fetchTrainerProfile();
  }, [profile?.entrenador_id]);

  return (
    <>
      <div className="studio-athlete-toolbar">
        <p>Hola, <strong>{profile?.nombre || 'Atleta'}</strong></p>
        <div>
          {onOpenCalculator && <button className="btn btn-ghost" onClick={onOpenCalculator}>Calculadora 1RM</button>}
          {isSoloClient && <><button className="btn btn-ghost" onClick={() => navigate('/solo/planner')}>Editar plan</button><button className="btn btn-ghost" onClick={() => navigate('/solo/config')}>Motor de progresión</button></>}
          {trainerProfile?.marca?.whatsapp && <a className="btn btn-ghost" href={`https://wa.me/${trainerProfile.marca.whatsapp.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer">Contactar entrenador</a>}
        </div>
      </div>

      {/* Banner de Suscripción Sutil */}
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
        gap: '8px',
        marginBottom: '20px'
      }}>
        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: isSoloClient ? (profile?.suscripcion_plan === 'premium' ? 'var(--theme-primary)' : '#a4b0a8') : 'var(--theme-secondary)' }} />
        {isSoloClient ? (
          profile?.suscripcion_plan === 'premium' ? (
            <span>Plan Actual: Solo Lifter Premium Pro (Ilimitado) | Estado: Activo</span>
          ) : (
            <span>Plan Actual: Solo Lifter Gratuito | <button type="button" style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--theme-primary)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => window.dispatchEvent(new CustomEvent('pwa-show-upgrade-modal'))}>Obtener Pro ⚡</button></span>
          )
        ) : (
          <span>Plan Actual: Atleta Guiado | Entrenador: {trainerProfile?.marca?.nombre_display || trainerProfile?.nombre || 'Mi Coach'}</span>
        )}
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
          title="Ver detalles del plan"
        >
          ⓘ
        </button>
      </div>

      {/* Modal de Información del Plan */}
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
            aria-labelledby="athlete-navbar-plan-info-title"
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
            <h3 id="athlete-navbar-plan-info-title" style={{ fontSize: '13px', color: 'var(--theme-primary)', letterSpacing: '0', textTransform: 'none', marginBottom: '16px', marginTop: 0 }}>
              Detalles de tu Plan
            </h3>
            
            {isSoloClient ? (
              profile?.suscripcion_plan === 'premium' ? (
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '12px' }}>
                    Solo Lifter Premium Pro ⚡
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', fontFamily: 'sans-serif' }}>
                    <p style={{ margin: '0 0 10px 0' }}>• <strong>Planes Activos:</strong> Ilimitados.</p>
                    <p style={{ margin: '0 0 10px 0' }}>• <strong>Smart Coach:</strong> Habilitado. Recomendaciones de sobrecarga progresiva inteligente en tiempo real.</p>
                    <p style={{ margin: '0 0 10px 0' }}>• <strong>Restricciones:</strong> Ninguna. Acceso total a todas las herramientas de sobrecarga progresiva.</p>
                    {profile?.suscripcion_expira_at && (
                      <p style={{ margin: '14px 0 0 0', color: 'var(--theme-primary)', fontWeight: 600, fontFamily: "'Inter', sans-serif", fontSize: '12px', letterSpacing: '0' }}>
                        VENCE: {new Date(profile.suscripcion_expira_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '12px' }}>
                    Solo Lifter Gratuito (Free)
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', fontFamily: 'sans-serif' }}>
                    <p style={{ margin: '0 0 10px 0' }}>• <strong>Planes Activos:</strong> Máximo 1 plan activo.</p>
                    <p style={{ margin: '0 0 10px 0' }}>• <strong>Smart Coach:</strong> Deshabilitado (requiere plan Premium Pro).</p>
                    <p style={{ margin: '0 0 10px 0' }}>• <strong>Restricciones:</strong> No puedes configurar reglas avanzadas de sobrecarga progresiva en tu motor.</p>
                    {profile?.suscripcion_expira_at && (
                      <p style={{ margin: '14px 0 0 0', color: '#fbbf24', fontWeight: 600, fontFamily: "'Inter', sans-serif", fontSize: '12px', letterSpacing: '0' }}>
                        VENCE: {new Date(profile.suscripcion_expira_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setShowPlanInfoModal(false);
                      window.dispatchEvent(new CustomEvent('pwa-show-upgrade-modal'));
                    }}
                    style={{
                      width: '100%',
                      background: 'var(--theme-btn-gradient)',
                      border: 'none',
                      borderRadius: '30px',
                      color: 'white',
                      padding: '12px 20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      marginTop: '16px',
                      boxShadow: 'none',
                      fontFamily: "'Inter', sans-serif",
                      letterSpacing: '0'
                    }}
                  >
                    SUBIR A PREMIUM PRO ⚡
                  </button>
                </div>
              )
            ) : (
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '12px' }}>
                  Plan: Atleta Guiado
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', fontFamily: 'sans-serif' }}>
                  <p style={{ margin: '0 0 10px 0' }}>• <strong>Coach:</strong> {trainerProfile?.marca?.nombre_display || trainerProfile?.nombre || 'Mi Entrenador'}.</p>
                  <p style={{ margin: '0 0 10px 0' }}>• <strong>Vigencia:</strong> Tu acceso de visualización de rutinas está asignado directamente por tu entrenador.</p>
                  <p style={{ margin: '0 0 10px 0' }}>• <strong>Restricciones:</strong> Si la membresía de tu entrenador expira, tu cuenta se suspenderá temporalmente hasta su renovación.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upgrade Modal para Clientes Autónomos (Solo Lifter) */}
      {showSoloUpgradeModal && (
        <div className="modal-overlay open" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backdropFilter: 'none' }}>
          <div className="modal-box" style={{ maxWidth: '450px', width: '90%', background: '#1a211e', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '28px', boxShadow: 'none', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(118, 152, 136, 0.1)', border: '1px solid rgba(118, 152, 136, 0.25)', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#a855f7', marginBottom: '16px' }}>
              🧠
            </div>
            
            <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: '16px', fontWeight: 800, color: 'white', letterSpacing: '0', textTransform: 'none', marginBottom: '12px' }}>
              ACTUALIZA A SOLO LIFTER PRO
            </h3>
            
            <p style={{ fontSize: '13px', color: '#a4b0a8', lineHeight: '1.6', marginBottom: '20px' }}>
              Las sugerencias pre-entrenamiento del <strong>Smart Coach</strong> y la automatización de sobrecarga progresiva son exclusivas del plan premium. ¡Desbloquea rutinas ilimitadas, reglas avanzadas y Smart Coach por solo <strong>$19.900 COP / mes</strong>!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => handleMercadoPagoCheckout('premium', '/dashboard')}
                disabled={paymentLoading}
                style={{
                  background: 'linear-gradient(135deg, #769888, #91b6a1)',
                  color: 'white', border: 'none', padding: '12px', borderRadius: '10px',
                  fontSize: '12px', fontFamily: "'Inter', sans-serif", fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: 'none',
                  cursor: paymentLoading ? 'not-allowed' : 'pointer',
                  opacity: paymentLoading ? 0.7 : 1
                }}
              >
                {paymentLoading ? 'PROCESANDO PAGO...' : 'PAGAR CON MERCADOPAGO 💳'}
              </button>
              
              <a
                href={`https://wa.me/573113666959?text=Hola!%20Quiero%20adquirir%20el%20plan%20Solo%20Lifter%20Pro%20en%20Evolution%20Lab.%20Mi%20correo%20de%20usuario%20es:%20${encodeURIComponent(profile?.email || '')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'rgba(37, 211, 102, 0.12)',
                  border: '1px solid rgba(37, 211, 102, 0.35)',
                  color: '#4ade80', textDecoration: 'none', padding: '12px', borderRadius: '10px',
                  fontSize: '12px', fontFamily: "'Inter', sans-serif", fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  cursor: paymentLoading ? 'not-allowed' : 'pointer',
                  pointerEvents: paymentLoading ? 'none' : 'auto'
                }}
              >
                PAGAR CON NEQUI/PSE (WHATSAPP 💬)
              </a>

              <button
                onClick={() => setShowSoloUpgradeModal(false)}
                disabled={paymentLoading}
                style={{
                  background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#a4b0a8',
                  padding: '10px', borderRadius: '10px', fontSize: '12px', fontFamily: "'Inter', sans-serif",
                  fontWeight: 700, cursor: paymentLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
                }}
              >
                LUEGO
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toastState.message} type={toastState.type} visible={toastState.visible} />
    </>
  );
};

export default AthleteNavbar;
