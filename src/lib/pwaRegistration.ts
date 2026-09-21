/**
 * pwaRegistration.ts
 *
 * Manejo robusto y seguro de la inicialización y ciclo de vida del Service Worker (PWA).
 * Previene errores de desestructuración ('registerSW' of undefined) provocados por recargas
 * asíncronas de chunks de Vite o entornos in-app restringidos (Instagram/Facebook WebViews).
 */

export async function registerPwaServiceWorker(
  loader: () => Promise<any> = () => import('virtual:pwa-register')
): Promise<void> {
  // 1. Validar soporte en el navegador (WebViews o entornos sin Service Worker)
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !navigator.serviceWorker) {
    return;
  }

  try {
    const pwaModule = await loader();

    // 2. Proteger contra promesas resueltas con undefined (Vite preloadError preventDefault)
    if (!pwaModule || typeof pwaModule.registerSW !== 'function') {
      return;
    }

    const { registerSW } = pwaModule;
    const updateSW = registerSW({ immediate: true });

    // 3. Revisión periódica y reactiva al volver a la pestaña activa
    const checkForUpdate = () => {
      try {
        const res = updateSW?.(false);
        if (res && typeof (res as any).catch === 'function') {
          (res as any).catch(() => {});
        }
      } catch {
        // Ignorar si el SW no soporta verificación en este entorno
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForUpdate();
        }
      });
      setInterval(checkForUpdate, 30 * 60 * 1000);
    }
  } catch (error) {
    // Captura defensiva de fallos de red o módulos desactualizados sin arrojar unhandled rejection
    console.warn('⚠️ No se pudo inicializar el Service Worker PWA:', error);
  }
}
