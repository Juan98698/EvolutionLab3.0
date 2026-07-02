import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabase } from '../../context/SupabaseContext';
import { supabase } from '../../lib/supabaseClient';
import Toast from './Toast';

export const AthleteNavbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut, isSoloClient } = useSupabase();

  const currentPath = location.pathname;

  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    const saved = localStorage.getItem('pwa_login_theme');
    return saved || 'cyan';
  });

  const [themeOpen, setThemeOpen] = useState(false);
  const [showPlanInfoModal, setShowPlanInfoModal] = useState(false);
  const [trainerProfile, setTrainerProfile] = useState<any>(() => {
      if (profile?.entrenador_id) {
        try {
          const cached = localStorage.getItem('pwa_trainer_profile_' + profile.entrenador_id);
          if (cached) return JSON.parse(cached);
        } catch(e) {}
      }
      return null;
    });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [streakWeeks, setStreakWeeks] = useState<number>(0);

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
      const response = await fetch('/api/create-mercadopago-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
    const calcularRachaNavbar = () => {
      try {
        const cached = localStorage.getItem('sobrecarga_v5');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const getISOWeek = (date: Date): string => {
              const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
              const dayNum = d.getUTCDay() || 7;
              d.setUTCDate(d.getUTCDate() + 4 - dayNum);
              const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
              const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
              return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
            };

            const sessionWeeks = new Set(parsed.map((s: any) => {
              if (!s.fecha) return '';
              const [year, month, day] = s.fecha.split('-').map(Number);
              return getISOWeek(new Date(year, month - 1, day));
            }).filter(Boolean));

            const getOffsetWeek = (weeksAgo: number): string => {
              const d = new Date();
              d.setDate(d.getDate() - 7 * weeksAgo);
              return getISOWeek(d);
            };

            let actual = 0;
            const currentWeek = getOffsetWeek(0);
            const lastWeek = getOffsetWeek(1);
            
            const hasCurrent = sessionWeeks.has(currentWeek);
            const hasLast = sessionWeeks.has(lastWeek);

            if (hasCurrent || hasLast) {
              let weeksAgo = hasCurrent ? 0 : 1;
              while (sessionWeeks.has(getOffsetWeek(weeksAgo))) {
                actual++;
                weeksAgo++;
              }
            }
            setStreakWeeks(actual);
          }
        } else {
          setStreakWeeks(0);
        }
      } catch (e) {
        console.warn('Error al calcular racha en navbar:', e);
      }
    };

    calcularRachaNavbar();

    window.addEventListener('pwa-sessions-updated', calcularRachaNavbar);
    return () => window.removeEventListener('pwa-sessions-updated', calcularRachaNavbar);
  }, [profile?.id]);

  // Fetch Trainer Profile for brand assets
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
              } catch(e) {}
          }
        } catch (e) {
          console.error('Error al cargar perfil del coach:', e);
        }
      }
    };
    fetchTrainerProfile();
  }, [profile?.entrenador_id]);

  const handleLogout = async () => {
    if (window.confirm('¿Seguro que deseas cerrar la sesión?')) {
      await signOut();
      navigate('/login');
    }
  };

  return (
    <>
      <div className="top-bar" style={{ marginBottom: '10px', padding: '12px 0', position: 'relative', zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          
          {/* Brand Logo & Greeting */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {trainerProfile?.logo_url ? (
              <div style={{ height: '68px', minWidth: '68px', maxWidth: '200px', borderRadius: '12px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)' }}>
                <img src={trainerProfile.logo_url} alt="Coach Logo" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
              </div>
            ) : trainerProfile?.marca ? (
              <div
                className="logo-symbol"
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: currentTheme === 'cyan'
                    ? `linear-gradient(135deg, ${trainerProfile.marca.color_primario || '#00d4ff'}, ${trainerProfile.marca.color_secundario || '#0070a0'})`
                    : 'var(--theme-btn-gradient)',
                  boxShadow: currentTheme === 'cyan'
                    ? `0 0 12px ${(trainerProfile.marca.color_primario || '#00d4ff')}40`
                    : '0 0 15px var(--theme-glow)'
                }}
              >
                <span style={{ fontSize: '20px', fontWeight: 800, color: 'white', fontFamily: "'Orbitron', sans-serif" }}>
                  {(trainerProfile.marca.nombre_display || trainerProfile.nombre || 'C').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
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
              <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '16px', fontWeight: 800, margin: 0, letterSpacing: '1px', display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ color: '#ffffff' }}>{trainerProfile?.marca?.nombre_display?.toUpperCase() || 'EVOLUTION'}</span> <span className="theme-text-gradient">{trainerProfile?.marca ? '' : 'LAB'}</span>
                <span style={{ fontSize: '9px', fontWeight: 500, color: 'rgba(255,255,255,0.45)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px' }}>Developed by Juan Manuel Cardona</span>
              </h1>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Hola, <span style={{ color: 'var(--theme-primary)', fontWeight: 600 }}>{profile?.nombre || 'Atleta'}</span>
                {streakWeeks >= 1 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    background: 'rgba(249, 115, 22, 0.15)', border: '1px solid rgba(249, 115, 22, 0.3)',
                    borderRadius: '12px', padding: '1px 6px', fontSize: '9px', fontWeight: 800,
                    color: '#fbbf24', marginLeft: '6px', fontFamily: "'Orbitron', sans-serif",
                    boxShadow: '0 0 6px rgba(249, 115, 22, 0.15)', verticalAlign: 'middle'
                  }} title={`Llevas ${streakWeeks} semanas consecutivas entrenando`}>
                    🔥 {streakWeeks} {streakWeeks === 1 ? 'SEM' : 'SEMS'}
                  </span>
                )}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--theme-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginLeft: '4px' }}>
                  <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v5" />
                  <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v6" />
                  <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v4.5" />
                  <path d="M6 10v6a6 6 0 0 0 6 6h1a6 6 0 0 0 5-5.5v-6.5" />
                </svg>
              </div>
            </div>
          </div>
  
          {/* Navigation Tabs */}
          <div className="nav-container" style={{ margin: 0, overflow: 'visible' }}>
            <div className="nav-group nav-group-plan" style={{ border: 'none', padding: 0 }}>
              <div className="nav-group-tabs" style={{ background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', display: 'flex', gap: '4px' }}>
                
                <button
                  className={`tab ${currentPath === '/dashboard' ? 'active' : ''}`}
                  onClick={() => navigate('/dashboard')}
                  style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                >
                  <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  </svg>
                  Mi Plan
                </button>
  
                <button
                  className={`tab ${currentPath === '/historial' ? 'active' : ''}`}
                  onClick={() => navigate('/historial')}
                  style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                >
                  <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  Historial
                </button>
  
                <button
                  className={`tab ${currentPath === '/analytics' ? 'active' : ''}`}
                  onClick={() => navigate('/analytics')}
                  style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                >
                  <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                  Progresión
                </button>
  
                <button
                  className={`tab ${currentPath === '/dashboard' && location.search.includes('tab=add') ? 'active' : ''}`}
                  onClick={() => navigate('/dashboard?tab=add')}
                  style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                >
                  <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  Sesión
                </button>

                <button
                  className={`tab ${currentPath === '/biblioteca' ? 'active' : ''}`}
                  onClick={() => navigate('/biblioteca')}
                  style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                >
                  <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5v-15z" />
                  </svg>
                  Biblioteca
                </button>
  
              </div>
            </div>
  
            {profile?.rol === 'entrenador' && (
              <button
                onClick={() => navigate('/trainer')}
                style={{
                  fontSize: '11px',
                  fontFamily: "'Orbitron', sans-serif",
                  fontWeight: 700,
                  background: 'var(--theme-badge-bg)',
                  border: '1px solid var(--theme-border)',
                  borderRadius: '10px',
                  color: 'var(--theme-primary)',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  marginLeft: '10px',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🔧 Panel Entrenador
              </button>
            )}
  
            {/* Professional dropdown theme selector button and floating menu */}
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
  
            {trainerProfile?.marca?.whatsapp && (
              <a
                href={`https://wa.me/${trainerProfile.marca.whatsapp.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '11px',
                  fontFamily: "'Orbitron', sans-serif",
                  fontWeight: 700,
                  background: 'rgba(37, 211, 102, 0.12)',
                  border: '1px solid rgba(37, 211, 102, 0.35)',
                  borderRadius: '10px',
                  color: '#4ade80',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  marginLeft: '10px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '32px',
                  boxSizing: 'border-box'
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.557-5.338 11.897-11.95 11.897-.003 0-.005 0-.008 0-2.002-.001-3.973-.51-5.713-1.478L0 24zm6.59-3.807c1.662.986 3.295 1.503 4.908 1.503a9.88 9.88 0 009.89-9.885c.002-2.641-1.03-5.124-2.906-7c-1.876-1.874-4.364-2.907-7.006-2.907-5.451 0-9.888 4.437-9.89 9.891 0 2.106.564 4.148 1.64 5.922l-.24 1.106-3.84 1.008.97 3.535 6.474-1.168z"/>
                </svg>
                Chat Coach
              </a>
            )}
  
            {isSoloClient && (
              <>
                <button
                  onClick={() => navigate('/solo/planner')}
                  style={{
                    fontSize: '11px',
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 700,
                    background: 'var(--theme-badge-bg)',
                    border: '1px solid var(--theme-border)',
                    borderRadius: '10px',
                    color: 'var(--theme-primary)',
                    padding: '8px 14px',
                    cursor: 'pointer',
                    marginLeft: '10px',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    height: '32px',
                    boxSizing: 'border-box'
                  }}
                >
                  ✏️ Editar Plan
                </button>
  
                <button
                  onClick={() => navigate('/solo/config')}
                  style={{
                    fontSize: '11px',
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 700,
                    background: 'var(--theme-badge-bg)',
                    border: '1px solid var(--theme-border)',
                    borderRadius: '10px',
                    color: 'var(--theme-primary)',
                    padding: '8px 14px',
                    cursor: 'pointer',
                    marginLeft: '10px',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    height: '32px',
                    boxSizing: 'border-box'
                  }}
                >
                  ⚙️ Motor Sobrecarga
                </button>
              </>
            )}
  
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
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Salir
            </button>
          </div>
  
        </div>
      </div>

      {/* Banner de Suscripción Sutil */}
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
        gap: '8px',
        marginBottom: '20px'
      }}>
        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: isSoloClient ? (profile?.suscripcion_plan === 'premium' ? 'var(--theme-primary)' : 'rgba(255,255,255,0.4)') : 'var(--theme-secondary)' }} />
        {isSoloClient ? (
          profile?.suscripcion_plan === 'premium' ? (
            <span>Plan Actual: Solo Lifter Premium Pro (Ilimitado) | Estado: Activo</span>
          ) : (
            <span>Plan Actual: Solo Lifter Gratuito | <span style={{ color: 'var(--theme-primary)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => window.dispatchEvent(new CustomEvent('pwa-show-upgrade-modal'))}>Obtener Pro ⚡</span></span>
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
            fontSize: '11px',
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
            <h3 style={{ fontSize: '13px', color: 'var(--theme-primary)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px', marginTop: 0 }}>
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
                      <p style={{ margin: '14px 0 0 0', color: 'var(--theme-primary)', fontWeight: 600, fontFamily: "'Orbitron', sans-serif", fontSize: '10px', letterSpacing: '0.5px' }}>
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
                      <p style={{ margin: '14px 0 0 0', color: '#fbbf24', fontWeight: 600, fontFamily: "'Orbitron', sans-serif", fontSize: '10px', letterSpacing: '0.5px' }}>
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
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      marginTop: '16px',
                      boxShadow: '0 4px 15px var(--theme-btn-glow)',
                      fontFamily: "'Orbitron', sans-serif",
                      letterSpacing: '0.5px'
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
        <div className="modal-overlay open" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(8px)' }}>
          <div className="modal-box" style={{ maxWidth: '450px', width: '90%', background: 'rgba(15, 23, 42, 0.98)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '28px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(123, 47, 247, 0.1)', border: '1px solid rgba(123, 47, 247, 0.25)', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#a855f7', marginBottom: '16px' }}>
              🧠
            </div>
            
            <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '16px', fontWeight: 800, color: 'white', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
              ACTUALIZA A SOLO LIFTER PRO
            </h3>
            
            <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', lineHeight: '1.6', marginBottom: '20px' }}>
              Las sugerencias pre-entrenamiento del <strong>Smart Coach</strong> y la automatización de sobrecarga progresiva son exclusivas del plan premium. ¡Desbloquea rutinas ilimitadas, reglas avanzadas y Smart Coach por solo <strong>$19.900 COP / mes</strong>!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => handleMercadoPagoCheckout('premium', '/dashboard')}
                disabled={paymentLoading}
                style={{
                  background: 'linear-gradient(135deg, #7b2ff7, #00d4ff)',
                  color: 'white', border: 'none', padding: '12px', borderRadius: '10px',
                  fontSize: '11px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 4px 15px rgba(123, 47, 247, 0.25)',
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
                  fontSize: '11px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700,
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
                  background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'rgba(255, 255, 255, 0.6)',
                  padding: '10px', borderRadius: '10px', fontSize: '11px', fontFamily: "'Orbitron', sans-serif",
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
