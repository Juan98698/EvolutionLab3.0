import React, { useState, useEffect } from 'react';

export const PWAInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showiOSModal, setShowiOSModal] = useState<boolean>(false);

  useEffect(() => {
    // 1. Verificar si ya se está ejecutando como PWA (standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      return; // No mostrar nada si ya está instalada e iniciada como PWA
    }

    // 2. Verificar si el usuario ya la rechazó
    const dismissed = localStorage.getItem('pwa_install_dismissed');
    if (dismissed === 'true') {
      return;
    }

    // 3. Detectar si es iOS (iPhone/iPad)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const detectIOS = /iphone|ipad|ipod/.test(userAgent) || 
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(detectIOS);

    if (detectIOS) {
      // En iOS no hay evento 'beforeinstallprompt', por lo que mostramos el banner manual
      setShowBanner(true);
      return;
    }

    // 4. Verificar si el evento de instalación ya fue capturado globalmente por main.tsx
    if ((window as any).deferredPWAInstallPrompt) {
      setDeferredPrompt((window as any).deferredPWAInstallPrompt);
      setShowBanner(true);
    }

    // 5. Escuchar si el evento se dispara nativamente
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    // 6. Escuchar nuestro evento personalizado global por si se capturó antes de que este banner se montara
    const handleCustomPromptAvailable = (e: any) => {
      setDeferredPrompt(e.detail);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-available', handleCustomPromptAvailable as EventListener);

    // 7. Escuchar si la app se instala con éxito
    const handleAppInstalled = () => {
      setShowBanner(false);
      setDeferredPrompt(null);
      localStorage.setItem('pwa_install_dismissed', 'true');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-available', handleCustomPromptAvailable as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowiOSModal(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      localStorage.setItem('pwa_install_dismissed', 'true');
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa_install_dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <>
      {/* ═══ Floating PWA Banner ═══ */}
      <div 
        className="pwa-install-banner"
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '500px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(0, 212, 255, 0.25)',
          borderRadius: '20px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          zIndex: 9999,
          boxShadow: '0 10px 40px rgba(0, 212, 255, 0.15)',
          animation: 'slideUpBanner 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexGrow: 1 }}>
          {/* Breathing App Icon */}
          <div 
            className="pwa-logo-wrapper"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #7b2ff7 0%, #00d4ff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 15px rgba(0, 212, 255, 0.3)'
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h4 style={{ margin: '0 0 2px 0', fontSize: '13px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700, color: 'white', letterSpacing: '0.5px' }}>
              Evolution Lab
            </h4>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>
              Instala la aplicación en tu celular para acceso offline y mayor rapidez.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={handleInstallClick}
            style={{
              background: 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
              border: 'none',
              borderRadius: '40px',
              color: 'white',
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '11px',
              fontWeight: 800,
              padding: '8px 16px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0, 212, 255, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            {isIOS ? 'Instalar' : 'Instalar'}
          </button>
          <button 
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px 8px',
              transition: 'color 0.2s ease'
            }}
            title="Cerrar"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ═══ iOS Instructions Modal ═══ */}
      {showiOSModal && (
        <div 
          className="ios-modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
            animation: 'fadeInModal 0.25s ease'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowiOSModal(false);
          }}
        >
          <div 
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(0, 212, 255, 0.25)',
              borderRadius: '24px',
              padding: '30px 24px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 20px 50px rgba(0, 212, 255, 0.15)',
              textAlign: 'center',
              color: 'white',
              position: 'relative'
            }}
          >
            {/* Close Button */}
            <button 
              onClick={() => setShowiOSModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '20px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>

            {/* Apple Icon */}
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.22.67-2.94 1.5-.62.71-1.16 1.85-1.02 2.96 1.12.09 2.27-.56 2.97-1.4z"/>
              </svg>
            </div>

            <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '18px', fontWeight: 800, color: '#00d4ff', marginBottom: '8px', letterSpacing: '0.5px' }}>
              Instalar en iPhone / iPad
            </h3>
            <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '24px' }}>
              Sigue estos simples pasos para añadir **Evolution Lab** a tu pantalla de inicio usando Safari:
            </p>

            {/* Steps Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left', marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{
                  background: 'rgba(0, 212, 255, 0.1)',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  color: '#00d4ff',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  fontFamily: "'Orbitron', sans-serif",
                  flexShrink: 0
                }}>1</span>
                <p style={{ margin: 0, fontSize: '12px', color: '#e2e8f0', lineHeight: 1.4 }}>
                  Toca el botón de <strong>Compartir</strong> <span style={{ fontSize: '14px' }}>📤</span> (el icono cuadrado con la flecha hacia arriba en la barra inferior de Safari).
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{
                  background: 'rgba(0, 212, 255, 0.1)',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  color: '#00d4ff',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  fontFamily: "'Orbitron', sans-serif",
                  flexShrink: 0
                }}>2</span>
                <p style={{ margin: 0, fontSize: '12px', color: '#e2e8f0', lineHeight: 1.4 }}>
                  Desplázate hacia abajo en el menú y selecciona <strong>Agregar al inicio</strong> <span style={{ fontSize: '14px' }}>➕</span> (o <em>"Add to Home Screen"</em>).
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{
                  background: 'rgba(0, 212, 255, 0.1)',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  color: '#00d4ff',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  fontFamily: "'Orbitron', sans-serif",
                  flexShrink: 0
                }}>3</span>
                <p style={{ margin: 0, fontSize: '12px', color: '#e2e8f0', lineHeight: 1.4 }}>
                  Toca <strong>Agregar</strong> en la esquina superior derecha del panel para confirmar la instalación. ¡Y listo!
                </p>
              </div>
            </div>

            <button 
              onClick={() => setShowiOSModal(false)}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
                border: 'none',
                borderRadius: '40px',
                color: 'white',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: '12px',
                fontWeight: 800,
                padding: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 212, 255, 0.25)',
                transition: 'all 0.2s'
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PWAInstallBanner;
