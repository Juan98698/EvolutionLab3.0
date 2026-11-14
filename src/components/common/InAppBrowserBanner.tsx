import React, { useState, useEffect } from 'react';
import {
  getInAppBrowserInfo,
  getAndroidChromeIntentUrl,
  copyCurrentUrl,
  InAppBrowserInfo
} from '../../lib/inAppBrowser';

export const InAppBrowserBanner: React.FC = () => {
  const [browserInfo, setBrowserInfo] = useState<InAppBrowserInfo | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const info = getInAppBrowserInfo();
    setBrowserInfo(info);

    if (info.isInApp) {
      const isDismissed = sessionStorage.getItem('evolab_dismiss_iab') === 'true';
      setDismissed(isDismissed);
    }
  }, []);

  if (!browserInfo?.isInApp || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('evolab_dismiss_iab', 'true');
    } catch {
      // Ignorar si sessionStorage está bloqueado
    }
  };

  const handleCopyLink = async () => {
    const success = await copyCurrentUrl();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const appTitle = browserInfo.appName || 'esta red social';
  const chromeIntentUrl = getAndroidChromeIntentUrl();

  return (
    <div
      role="region"
      aria-label="Aviso de navegador integrado"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: 'linear-gradient(180deg, rgba(18, 23, 22, 0.98) 0%, #1a211e 100%)',
        borderBottom: '2px solid #91b6a1',
        boxShadow: 'none',
        color: 'white',
        padding: '12px 16px',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: '560px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Cabecera con advertencia y botón de cerrar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0',
                color: '#91b6a1',
                textTransform: 'none',
              }}
            >
              Navegador de {appTitle}
            </span>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Cerrar aviso"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a4b0a8',
              fontSize: '18px',
              lineHeight: 1,
              cursor: 'pointer',
              padding: '2px 6px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Mensaje descriptivo */}
        <div style={{ fontSize: '12px', lineHeight: 1.45, color: '#e2e8f0' }}>
          Para <strong style={{ color: '#91b6a1' }}>iniciar con Google</strong>, no perder tus datos al salir e <strong style={{ color: '#91b6a1' }}>instalar la app</strong>, ábrela en tu navegador real:
        </div>

        {/* Acciones según el sistema operativo */}
        {browserInfo.isAndroid ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <a
              href={chromeIntentUrl}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #91b6a1 0%, #0070a0 100%)',
                color: '#040d1a',
                fontFamily: "'Inter', sans-serif",
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0',
                padding: '10px 14px',
                borderRadius: '8px',
                textDecoration: 'none',
                boxShadow: 'none',
              }}
            >
              <span>🚀</span> ABRIR EN GOOGLE CHROME
            </a>
            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: copied ? '#10b981' : '#cbd5e1',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copied ? '✓ ¡ENLACE COPIADO!' : 'Copiar enlace'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Instrucciones para iOS */}
            <div
              style={{
                background: 'rgba(145, 182, 161, 0.06)',
                border: '1px solid rgba(145, 182, 161, 0.2)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                lineHeight: 1.4,
                color: '#f1f5f9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#91b6a1', marginBottom: '4px' }}>
                <span>1.</span> Toca los tres puntos <strong style={{ fontSize: '13px' }}>( ••• )</strong> arriba a la derecha ↗
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>2.</span> Selecciona <strong style={{ color: '#fff' }}>"Abrir en el navegador"</strong> o <strong style={{ color: '#fff' }}>"Abrir en Safari"</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(145, 182, 161, 0.12)',
                border: copied ? '1px solid #10b981' : '1px solid #91b6a1',
                color: copied ? '#10b981' : '#91b6a1',
                fontFamily: "'Inter', sans-serif",
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0',
                padding: '8px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {copied ? '✓ ¡ENLACE COPIADO! PÉGALO EN SAFARI' : 'COPIAR ENLACE PARA SAFARI'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
