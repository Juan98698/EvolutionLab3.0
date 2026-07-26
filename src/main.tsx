import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { SupabaseProvider } from './context/SupabaseContext.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import { inject } from '@vercel/analytics';
import { initErrorTracking } from './lib/errorTracking.ts';
import './index.css';

// Auto-recuperación de "Failed to fetch dynamically imported module": pasa
// cuando el navegador tiene un index.html/bundle viejo en memoria que
// apunta a un chunk (ej. ConfigRules-xxxxx.js) que un deploy más nuevo ya
// borró del servidor. Vite emite este evento específicamente para este
// caso — antes esto dejaba al usuario con una pantalla rota hasta que
// refrescara manualmente una segunda vez.
window.addEventListener('vite:preloadError', (event) => {
  console.warn('⚠️ Chunk desactualizado detectado, recargando automáticamente...', event);
  event.preventDefault();
  window.location.reload();
});

// Síncronamente inicializar el tema de enfoque para evitar parpadeos visuales (cero-flicker)
const savedTheme = localStorage.getItem('pwa_login_theme') || 'cyan';
document.documentElement.setAttribute('data-theme', savedTheme);

// Capturar el evento de instalación PWA globalmente de inmediato para evitar perderlo en re-renderizados
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).deferredPWAInstallPrompt = e;
  window.dispatchEvent(new CustomEvent('pwa-prompt-available', { detail: e }));
});

// Limpieza de Service Workers obsoletos o corruptos y sus cachés.
// Se ejecuta UNA SOLA VEZ por versión de despliegue. Si la clave no existe en localStorage,
// desregistra TODOS los SW activos, vacía TODAS las cachés, y recarga la página.
const purgeOldServiceWorkersAndCaches = async (): Promise<boolean> => {
  try {
    const CLEANUP_KEY = 'evolab_sw_cleanup_v4.2';
    if (localStorage.getItem(CLEANUP_KEY) !== 'true') {
      console.log('🔄 Iniciando purga automática de Service Workers y cachés obsoletos...');

      // 1. Desregistrar todos los Service Workers activos
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.log('🗑️ Service Worker desregistrado con éxito.');
        }
      }

      // 2. Borrar todas las cachés del navegador (precache, runtime, etc.)
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
          console.log(`🗑️ Caché eliminada: ${cacheName}`);
        }
      }

      // Marcar como purgado para evitar bucles de limpieza
      localStorage.setItem(CLEANUP_KEY, 'true');
      console.log('🚀 Purga completada. Reiniciando aplicación limpia...');

      // Recargar la página para asegurar que todo corre sin interceptores viejos
      window.location.reload();
      return true;
    }
  } catch (error) {
    console.error('Error durante la purga de Service Workers:', error);
  }
  return false;
};

// Ejecutar purga PRIMERO, y solo después registrar el SW y montar React.
// Esto garantiza que nunca se re-registra un SW viejo/corrupto antes de purgarlo.
purgeOldServiceWorkersAndCaches().then((wasPurged) => {
  if (wasPurged) return; // La recarga ya está en curso, no inicializar nada.

  // Inicializar el servicio de error tracking ANTES de montar React, para
  // que cualquier error en la inicialización del árbol ya sea capturado.
  initErrorTracking();

  // Inicializar analíticas de Vercel
  inject();

  // Registrar el Service Worker DESPUÉS de verificar que la caché está limpia.
  // Importar dinámicamente para que no se ejecute en el scope global antes de la purga.
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({ immediate: true });

    // El navegador solo revisa automáticamente si hay una versión nueva del
    // Service Worker al navegar. En una SPA, si alguien deja la pestaña
    // abierta sin recargar, nunca se entera de un deploy nuevo hasta que
    // por casualidad falla algo. Revisamos manualmente al volver a la
    // pestaña y cada 30 minutos mientras sigue abierta.
    const checkForUpdate = () => updateSW(false).catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    });
    setInterval(checkForUpdate, 30 * 60 * 1000);
  });

  const GlobalErrorFallback = (error: Error, reset: () => void) => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#0b0f19',
      color: 'white',
      fontFamily: "'Orbitron', sans-serif",
      padding: '24px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
      <div style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '8px' }}>
        ALGO SALIÓ MAL
      </div>
      <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '20px', maxWidth: '360px', fontFamily: 'system-ui, sans-serif' }}>
        Tus datos están a salvo — se guardan localmente y en la nube antes de llegar a este punto.
        Probá recargar la página.
      </div>
      {import.meta.env.DEV && (
        <pre style={{ fontSize: '10px', opacity: 0.4, maxWidth: '90vw', overflow: 'auto', marginBottom: '20px' }}>
          {error.message}
        </pre>
      )}
      <button
        type="button"
        onClick={() => { reset(); window.location.reload(); }}
        style={{
          background: 'rgba(0, 212, 255, 0.12)',
          border: '1px solid rgba(0, 212, 255, 0.4)',
          color: '#00d4ff',
          borderRadius: '10px',
          padding: '10px 20px',
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '0.5px',
          cursor: 'pointer',
          fontFamily: "'Orbitron', sans-serif",
        }}
      >
        RECARGAR
      </button>
    </div>
  );

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary label="App" fallback={GlobalErrorFallback}>
        <SupabaseProvider>
          <App />
        </SupabaseProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
});
